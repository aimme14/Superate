/**
 * Servicio para el cálculo del ranking/puesto del estudiante.
 * Optimizado para lecturas paralelas y reutilización de caché.
 */

import { collection, getDocs, getFirestore } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import type { PhaseType } from "@/utils/firestoreHelpers";
import { getUserById } from "@/controllers/user.controller";
import { getFilteredStudents } from "@/controllers/student.controller";

const db = getFirestore(firebaseApp);

const NATURALES_SUBJECTS = ["Biologia", "Quimica", "Física"];
const POINTS_PER_NATURALES_SUBJECT = 100 / 3;
const POINTS_PER_REGULAR_SUBJECT = 100;

const SUBJECT_NAME_MAP: Record<string, string> = {
  biologia: "Biologia",
  biología: "Biologia",
  biology: "Biologia",
  quimica: "Quimica",
  química: "Quimica",
  chemistry: "Quimica",
  fisica: "Física",
  física: "Física",
  physics: "Física",
  matematicas: "Matemáticas",
  matemáticas: "Matemáticas",
  math: "Matemáticas",
  lenguaje: "Lenguaje",
  language: "Lenguaje",
  "ciencias sociales": "Ciencias Sociales",
  sociales: "Ciencias Sociales",
  ingles: "Inglés",
  inglés: "Inglés",
  english: "Inglés",
};

function normalizeSubjectName(subject: string): string {
  const normalized = subject.trim().toLowerCase();
  return SUBJECT_NAME_MAP[normalized] || subject;
}

interface EvaluationDoc {
  subject?: string;
  examTitle?: string;
  examId?: string;
  score?: {
    overallPercentage?: number;
    correctAnswers?: number;
    totalQuestions?: number;
  };
  questionDetails?: Array<{ isCorrect?: boolean }>;
  isCompleted?: boolean;
  completed?: boolean;
}

/** Variantes de nombre de fase para compatibilidad con datos legacy. Canonical primero. */
const PHASE_NAMES: Record<PhaseType, string[]> = {
  first: ["fase I", "Fase I", "fase 1", "first"],
  second: ["Fase II", "fase II", "fase 2", "second"],
  third: ["fase III", "Fase III", "fase 3", "third"],
};

/**
 * Obtiene las evaluaciones de un estudiante para una fase.
 * Prueba nombres canónicos y variantes legacy hasta obtener resultados.
 */
export async function getPhaseEvaluationsForRanking(
  studentId: string,
  phase: PhaseType
): Promise<EvaluationDoc[]> {
  for (const phaseName of PHASE_NAMES[phase]) {
    try {
      const phaseRef = collection(db, "results", studentId, phaseName);
      const phaseSnap = await getDocs(phaseRef);

      if (!phaseSnap.empty) {
        const evaluations: EvaluationDoc[] = [];
        phaseSnap.docs.forEach((doc) => {
          const examData = doc.data() as EvaluationDoc;
          const isCompleted =
            examData.isCompleted !== false && examData.completed !== false;
          if (isCompleted && examData.subject) {
            evaluations.push({ ...examData, examId: doc.id });
          }
        });
        if (evaluations.length > 0) return evaluations;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Error leyendo evaluaciones de ${studentId} fase ${phaseName}:`, error);
      }
    }
  }

  return [];
}

/**
 * Calcula el puntaje global ICFES a partir de evaluaciones.
 * Materias de naturales dividen 100 puntos entre las 3.
 */
export function calculateGlobalScoreFromEvaluations(
  evaluations: EvaluationDoc[]
): number {
  if (evaluations.length === 0) return 0;

  const subjectScores: Record<string, number> = {};

  evaluations.forEach((evalData) => {
    const subject = normalizeSubjectName(
      evalData.subject || evalData.examTitle || ""
    );

    let percentage = 0;
    if (evalData.score?.overallPercentage !== undefined) {
      percentage = evalData.score.overallPercentage;
    } else if (
      evalData.score?.correctAnswers !== undefined &&
      evalData.score?.totalQuestions !== undefined
    ) {
      const total = evalData.score.totalQuestions;
      const correct = evalData.score.correctAnswers;
      percentage = total > 0 ? (correct / total) * 100 : 0;
    } else if (
      evalData.questionDetails &&
      evalData.questionDetails.length > 0
    ) {
      const correct = evalData.questionDetails.filter(
        (q) => q.isCorrect
      ).length;
      const total = evalData.questionDetails.length;
      percentage = total > 0 ? (correct / total) * 100 : 0;
    }

    if (!subjectScores[subject] || percentage > subjectScores[subject]) {
      subjectScores[subject] = percentage;
    }
  });

  let globalScore = 0;
  Object.entries(subjectScores).forEach(([subject, percentage]) => {
    const pointsForSubject = NATURALES_SUBJECTS.includes(subject)
      ? (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
      : (percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
    globalScore += pointsForSubject;
  });

  return Math.round(globalScore * 100) / 100;
}

export interface StudentRankingResult {
  rank: number | null;
  totalInPhase: number;
  totalInGrade: number;
}

/**
 * Obtiene el puesto del estudiante en su grado para una fase.
 * Paraleliza las lecturas de Firestore para máximo rendimiento.
 */
export async function fetchStudentRanking(params: {
  userId: string;
  phase: PhaseType;
  currentStudentScore?: number;
}): Promise<StudentRankingResult> {
  const { userId, phase, currentStudentScore } = params;

  const userResult = await getUserById(userId);
  if (!userResult.success || !userResult.data) {
    return { rank: null, totalInPhase: 0, totalInGrade: 0 };
  }

  const studentData = userResult.data as {
    inst?: string;
    institutionId?: string;
    campus?: string;
    campusId?: string;
    grade?: string;
    gradeId?: string;
  };
  const institutionId = studentData.inst || studentData.institutionId;
  const campusId = studentData.campus || studentData.campusId;
  const gradeId = studentData.grade || studentData.gradeId;

  if (!institutionId || !campusId || !gradeId) {
    return { rank: null, totalInPhase: 0, totalInGrade: 0 };
  }

  const studentsResult = await getFilteredStudents({
    institutionId,
    campusId,
    gradeId,
    isActive: true,
  });

  if (!studentsResult.success || !studentsResult.data) {
    return { rank: null, totalInPhase: 0, totalInGrade: 0 };
  }

  const classmates = studentsResult.data;
  const totalInGrade = classmates.length;

  const studentIds = classmates
    .map((c: { id?: string; uid?: string }) => c.id || c.uid)
    .filter(Boolean) as string[];

  // Paralelizar: obtener puntaje de cada estudiante en paralelo
  const scorePromises = studentIds.map(async (studentId): Promise<{ studentId: string; score: number } | null> => {
    let score: number;

    if (studentId === userId && currentStudentScore !== undefined) {
      score = currentStudentScore;
    } else {
      const evaluations = await getPhaseEvaluationsForRanking(
        studentId,
        phase
      );
      score = calculateGlobalScoreFromEvaluations(evaluations);
    }

    return score > 0 ? { studentId, score } : null;
  });

  const results = await Promise.all(scorePromises);
  const studentScores = results.filter(
    (r): r is { studentId: string; score: number } => r !== null
  );

  studentScores.sort((a, b) => b.score - a.score);

  const currentIndex = studentScores.findIndex((s) => s.studentId === userId);
  const rank = currentIndex !== -1 ? currentIndex + 1 : null;
  const totalInPhase = studentScores.length;

  return { rank, totalInPhase, totalInGrade };
}
