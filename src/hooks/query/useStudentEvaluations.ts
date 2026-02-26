import { useQuery } from "@tanstack/react-query";
import { doc, getDoc, getFirestore, collection, getDocs } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { getAllPhases, getPhaseType } from "@/utils/firestoreHelpers";
import { useAuthContext } from "@/context/AuthContext";

export interface ExamScore {
  correctAnswers: number;
  totalAnswered: number;
  totalQuestions: number;
  percentage: number;
  overallPercentage: number;
}

export interface ExamResult {
  userId: string;
  examId: string;
  examTitle: string;
  answers: { [key: string]: string };
  score: ExamScore;
  topic: string;
  timeExpired: boolean;
  lockedByTabChange: boolean;
  tabChangeCount: number;
  startTime: string;
  endTime: string;
  timeSpent: number;
  completed: boolean;
  timestamp: number;
  phase?: string;
  questionDetails: Array<{
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
  }>;
}

interface UserResults {
  [examId: string]: ExamResult;
}

const db = getFirestore(firebaseApp);

async function fetchEvaluations(userId: string): Promise<ExamResult[]> {
  const phases = getAllPhases();
  const evaluationsArray: ExamResult[] = [];

  for (const phaseName of phases) {
    const phaseRef = collection(db, "results", userId, phaseName);
    const phaseSnap = await getDocs(phaseRef);
    phaseSnap.docs.forEach((docSnap) => {
      const examData = docSnap.data();
      const phaseFromCollection = getPhaseType(phaseName);
      const phaseFromDocument = examData.phase;

      let finalPhase: string = "first";
      if (phaseFromCollection) {
        finalPhase = phaseFromCollection;
      }
      if (phaseFromDocument) {
        const phaseType = getPhaseType(String(phaseFromDocument));
        if (phaseType) {
          finalPhase = phaseType;
        } else if (
          phaseFromDocument === "fase I" ||
          phaseFromDocument === "Fase I" ||
          phaseFromDocument === "Fase II" ||
          phaseFromDocument === "fase II" ||
          phaseFromDocument === "fase III" ||
          phaseFromDocument === "Fase III"
        ) {
          const convertedPhase = getPhaseType(phaseFromDocument);
          if (convertedPhase) {
            finalPhase = convertedPhase;
          }
        }
      }
      if (
        !finalPhase ||
        (finalPhase !== "first" && finalPhase !== "second" && finalPhase !== "third")
      ) {
        finalPhase = phaseFromCollection || "first";
      }

      evaluationsArray.push({
        ...examData,
        examId: docSnap.id,
        phase: finalPhase,
        tabChangeCount: examData.tabChangeCount ?? 0,
        lockedByTabChange: examData.lockedByTabChange === true,
      } as ExamResult);
    });
  }

  const oldDocRef = doc(db, "results", userId);
  const oldDocSnap = await getDoc(oldDocRef);
  if (oldDocSnap.exists()) {
    const oldData = oldDocSnap.data() as UserResults;
    Object.entries(oldData).forEach(([examId, examData]) => {
      let inferredPhase: string = "first";
      if (examData.phase) {
        const phaseType = getPhaseType(String(examData.phase));
        if (phaseType) {
          inferredPhase = phaseType;
        }
      } else if (examData.examTitle) {
        const title = String(examData.examTitle).toLowerCase();
        if (title.includes("fase ii") || title.includes("segunda fase")) {
          inferredPhase = "second";
        } else if (title.includes("fase iii") || title.includes("tercera fase")) {
          inferredPhase = "third";
        }
      }

      evaluationsArray.push({
        ...examData,
        examId,
        phase: inferredPhase,
        tabChangeCount: examData.tabChangeCount ?? 0,
        lockedByTabChange: examData.lockedByTabChange === true,
      } as ExamResult);
    });
  }

  evaluationsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return evaluationsArray;
}

const EVALUATIONS_QUERY_KEY = ["student-evaluations"] as const;

/**
 * Hook para obtener las evaluaciones del estudiante autenticado.
 * Usa React Query para caché: al navegar entre secciones, los datos se sirven desde caché.
 */
export function useStudentEvaluations() {
  const { user } = useAuthContext();
  const userId = user?.uid ?? "";

  return useQuery({
    queryKey: [...EVALUATIONS_QUERY_KEY, userId],
    queryFn: () => fetchEvaluations(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 min - los resultados pueden cambiar al terminar un examen
    gcTime: 10 * 60 * 1000, // 10 min
  });
}
