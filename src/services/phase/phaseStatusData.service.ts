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
async function getPhaseResultsDocs(
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

/** Construye un mapa de materias con examen completado por fase */
function buildCompletedByPhase(
  phaseResults: Record<PhaseType, { subject: string; completed: boolean }[]>
): Record<PhaseType, Set<string>> {
  const map: Record<PhaseType, Set<string>> = {
    first: new Set(),
    second: new Set(),
    third: new Set(),
  };
  for (const phase of ["first", "second", "third"] as PhaseType[]) {
    for (const { subject } of phaseResults[phase] || []) {
      map[phase].add(subject);
    }
  }
  return map;
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
 * Paraleliza: user, access×3, progress×3, results×3.
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

  const [accessResults, progressResults, resultsByPhase] = await Promise.all([
    Promise.all(
      phases.map((p) =>
        phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, p)
      )
    ),
    Promise.all(
      phases.map((p) => phaseAuthorizationService.getStudentPhaseProgress(userId, p))
    ),
    Promise.all(phases.map((p) => getPhaseResultsDocs(userId, p))),
  ]);

  const phaseResults: Record<PhaseType, { subject: string; completed: boolean }[]> = {
    first: resultsByPhase[0],
    second: resultsByPhase[1],
    third: resultsByPhase[2],
  };
  const completedByPhase = buildCompletedByPhase(phaseResults);

  const totalSubjects = ALL_SUBJECTS.length;
  const phaseStatesBySubject: Record<string, Record<PhaseType, PhaseState>> = {};

  for (const subject of ALL_SUBJECTS) {
    const normSubject = normalizeSubject(subject);
    phaseStatesBySubject[subject] = {
      first: defaultPhaseState("first"),
      second: defaultPhaseState("second"),
      third: defaultPhaseState("third"),
    };

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const access = accessResults[i];
      const progress = progressResults[i];
      const state = phaseStatesBySubject[subject][phase];

      state.canAccess = access.success && access.data?.canAccess === true;
      state.reason = access.success ? access.data?.reason : undefined;

      const completedInFirestore = completedByPhase[phase].has(normSubject);
      const progressData = progress?.success ? progress.data : null;
      const completedSubjects = (progressData?.subjectsCompleted ?? []).map(
        (s: string) => normalizeSubject(s)
      );
      const inProgressSubjects = (progressData?.subjectsInProgress ?? []).map(
        (s: string) => normalizeSubject(s)
      );

      state.isCompleted = completedSubjects.some((s) => s === normSubject);
      state.isInProgress = inProgressSubjects.some((s) => s === normSubject);
      state.allSubjectsCompleted = completedSubjects.length >= totalSubjects;

      if (completedInFirestore) {
        state.isExamCompleted = true;
        state.isCompleted = true;
      } else {
        state.isExamCompleted = false;
        if (state.isCompleted && !completedInFirestore) {
          state.isCompleted = false;
        }
      }
    }
  }

  const phase3Completed = completedByPhase.third.size >= totalSubjects;

  return {
    phaseStatesBySubject,
    isPhase3Complete: phase3Completed,
  };
}
