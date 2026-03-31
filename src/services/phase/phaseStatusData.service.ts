/**
 * Servicio para obtener el estado de fases por materia del estudiante.
 * Centraliza lecturas y permite paralelización para mejor rendimiento.
 */

import { collection, getDocs, getFirestore } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { dbService } from "@/services/firebase/db.service";
import { phaseAuthorizationService } from "@/services/phase/phaseAuthorization.service";
import { getPhaseName } from "@/utils/firestoreHelpers";
import type { PhaseType } from "@/interfaces/phase.interface";
import { logger } from "@/utils/logger";
import { fetchStudentProgressSummaryByUserId } from "@/services/studentProgressSummary/fetchEvaluationsFromSummary";
import { subjectLabelToSlug } from "@/utils/subjectResultDocId";

const db = getFirestore(firebaseApp);

export const ALL_SUBJECTS = [
  "Matemáticas",
  "Lenguaje",
  "Ciencias Sociales",
  "Biologia",
  "Quimica",
  "Física",
  "Inglés",
] as const;

const SUBJECT_CODE_MAP: Record<string, string> = {
  IN: "inglés",
  MA: "matemáticas",
  LE: "lenguaje",
  CS: "ciencias sociales",
  BI: "biologia",
  QU: "quimica",
  FI: "física",
};

export interface PhaseState {
  phase: PhaseType;
  canAccess: boolean;
  isCompleted: boolean;
  isInProgress: boolean;
  isExamCompleted: boolean;
  allSubjectsCompleted: boolean;
  reason?: string;
}

export interface PhaseStatusData {
  phaseStatesBySubject: Record<string, Record<PhaseType, PhaseState>>;
  isPhase3Complete: boolean;
}

function normalizeSubject(s: string): string {
  return s.trim().toLowerCase();
}

function detectSubjectFromDocId(docId: string): string | null {
  const upper = docId.toUpperCase();
  for (const [code, subjectName] of Object.entries(SUBJECT_CODE_MAP)) {
    if (upper.startsWith(code)) return subjectName;
  }
  return null;
}

/** Obtiene los documentos de exámenes completados por fase desde Firestore */
export async function getPhaseResultsDocs(
  userId: string,
  phase: PhaseType
): Promise<{ subject: string; completed: boolean }[]> {
  const phaseName = getPhaseName(phase);
  const results: { subject: string; completed: boolean }[] = [];

  const collectionsToRead =
    phase === "second"
      ? ["Fase II", "fase II"]
      : [phaseName];

  for (const colName of collectionsToRead) {
    try {
      const ref = collection(db, "results", userId, colName);
      const snap = await getDocs(ref);
      snap.docs.forEach((d) => {
        const data = d.data();
        const completed = data.isCompleted !== false && data.completed !== false;
        const subjectRaw = data.subject || "";
        const subject = subjectRaw
          ? normalizeSubject(subjectRaw)
          : detectSubjectFromDocId(d.id);
        if (subject && completed) {
          results.push({ subject, completed });
        }
      });
    } catch (e) {
      logger.warn(`[phaseStatusData] Error leyendo ${colName}:`, e);
    }
  }

  return results;
}

/** Cuenta materias distintas con examen completado en la fase (desde results/). */
export async function countUniqueCompletedSubjectsInPhase(
  userId: string,
  phase: PhaseType
): Promise<number> {
  const rows = await getPhaseResultsDocs(userId, phase);
  return new Set(rows.map((r) => r.subject)).size;
}

/** Crea el estado por defecto para una fase */
function defaultPhaseState(phase: PhaseType): PhaseState {
  return {
    phase,
    canAccess: false,
    isCompleted: false,
    isInProgress: false,
    isExamCompleted: false,
    allSubjectsCompleted: false,
  };
}

/**
 * Obtiene todos los datos de estado de fases para un estudiante.
 * Modo summary-only: usa studentSummaries como fuente canónica del estado
 * para evitar lecturas de results/ en el flujo de actualización de módulos.
 */
export async function fetchPhaseStatusForStudent(
  userId: string
): Promise<PhaseStatusData> {
  const empty: PhaseStatusData = {
    phaseStatesBySubject: {},
    isPhase3Complete: false,
  };

  const userResult = await dbService.getUserById(userId);
  if (!userResult.success || !userResult.data) return empty;

  const studentData = userResult.data as { gradeId?: string; grade?: string };
  const gradeId = studentData.gradeId || studentData.grade;
  if (!gradeId) return empty;

  const phases: PhaseType[] = ["first", "second", "third"];

  const summaryPack = await fetchStudentProgressSummaryByUserId(userId);
  const summary = summaryPack?.summary ?? null;

  const accessResults = await Promise.all(
    phases.map((p) =>
      phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, p, { summary })
    )
  );
  const phaseStatesBySubject: Record<string, Record<PhaseType, PhaseState>> = {};

  for (const subject of ALL_SUBJECTS) {
    phaseStatesBySubject[subject] = {
      first: defaultPhaseState("first"),
      second: defaultPhaseState("second"),
      third: defaultPhaseState("third"),
    };

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const access = accessResults[i];
      const state = phaseStatesBySubject[subject][phase];

      state.canAccess = access.success && access.data?.canAccess === true;
      state.reason = access.success ? access.data?.reason : undefined;

      const slug = subjectLabelToSlug(subject);
      const block = summary?.phases?.[phase];
      const fromSummary = slug != null && block?.subjects?.[slug] != null;
      const done = fromSummary;

      state.isCompleted = done;
      state.isExamCompleted = done;
      state.isInProgress = false;
      state.allSubjectsCompleted = block?.isComplete === true;
    }
  }

  const phase3Completed = summary?.phases?.third?.isComplete === true;

  return {
    phaseStatesBySubject,
    isPhase3Complete: phase3Completed,
  };
}
