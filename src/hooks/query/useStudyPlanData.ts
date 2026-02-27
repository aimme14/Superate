import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dbService } from "@/services/firebase/db.service";
import { studyPlanAuthorizationService } from "@/services/studyPlan/studyPlanAuthorization.service";
import type { SubjectName, StudyPlanPhase } from "@/interfaces/studyPlan.interface";
import { GRADE_CODE_TO_NAME } from "@/utils/subjects.config";

export interface StudyPlanData {
  student_info: {
    studentId: string;
    phase: string;
    subject: string;
    weaknesses: Array<{
      topic: string;
      percentage: number;
      correct: number;
      total: number;
    }>;
  };
  diagnostic_summary: string;
  study_plan_summary: string;
  video_resources: Array<{
    title: string;
    url: string;
    description: string;
    videoId?: string;
    topic?: string;
    topicDisplayName?: string;
  }>;
  practice_exercises: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>;
  study_links: Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>;
}

export interface SubjectWithTopics {
  name: string;
  percentage: number;
  topics: Array<{ name: string; percentage: number; correct: number; total: number }>;
  strengths: string[];
  weaknesses: string[];
  neutrals: string[];
}

const FUNCTIONS_URL =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  "https://us-central1-superate-ia.cloudfunctions.net";

function toGradeNameForApi(grade: string | undefined): string | undefined {
  if (!grade || typeof grade !== "string") return undefined;
  const g = grade.trim();
  const byCode = GRADE_CODE_TO_NAME[g];
  if (byCode) return byCode;
  if (g === "10") return "Décimo";
  if (g === "11") return "Undécimo";
  const names = Object.values(GRADE_CODE_TO_NAME);
  if (names.includes(g)) return g;
  return g;
}

interface StudyPlanDataResult {
  subjectAuthorizations: Record<string, boolean>;
  studyPlans: Record<string, StudyPlanData>;
  studentGrade: string | undefined;
}

async function fetchStudyPlanData(
  studentId: string,
  phase: "first" | "second" | "third",
  subjectsWithTopics: SubjectWithTopics[]
): Promise<StudyPlanDataResult> {
  const subjectsWithWeaknesses = subjectsWithTopics.filter(
    (s) => s.weaknesses.length > 0
  );

  const userResult = await dbService.getUserById(studentId);
  if (!userResult.success || !userResult.data) {
    const emptyAuth: Record<string, boolean> = {};
    subjectsWithTopics.forEach((s) => (emptyAuth[s.name] = false));
    return {
      subjectAuthorizations: emptyAuth,
      studyPlans: {},
      studentGrade: undefined,
    };
  }

  const studentData = userResult.data as {
    gradeId?: string;
    grade?: string;
    gradeName?: string;
  };
  const gradeId =
    studentData.gradeId ||
    (typeof studentData.grade === "string" ? studentData.grade : undefined);
  const gradeName =
    studentData.gradeName ||
    (typeof studentData.grade === "string" ? studentData.grade : undefined);
  const rawGrade = gradeName || gradeId;
  const studentGrade = rawGrade
    ? (toGradeNameForApi(rawGrade) ?? rawGrade)
    : undefined;

  const studyPlanPhase: StudyPlanPhase | null =
    phase === "first" ? "first" : phase === "second" ? "second" : null;

  const authorizations: Record<string, boolean> = {};
  const plans: Record<string, StudyPlanData> = {};

  if (!studyPlanPhase) {
    subjectsWithTopics.forEach((s) => (authorizations[s.name] = false));
    return { subjectAuthorizations: authorizations, studyPlans: plans, studentGrade };
  }

  if (!gradeId) {
    subjectsWithTopics.forEach((s) => (authorizations[s.name] = false));
    return { subjectAuthorizations: authorizations, studyPlans: plans, studentGrade };
  }

  const authPromises = subjectsWithWeaknesses.map(async (subject) => {
    try {
      const authResult = await studyPlanAuthorizationService.isStudyPlanAuthorized(
        gradeId,
        studyPlanPhase,
        subject.name as SubjectName
      );
      return { name: subject.name, authorized: authResult.success ? authResult.data : false };
    } catch {
      return { name: subject.name, authorized: false };
    }
  });

  const planPromises = subjectsWithWeaknesses.map(async (subject) => {
    try {
      const response = await fetch(
        `${FUNCTIONS_URL}/getStudyPlan?studentId=${studentId}&phase=${phase}&subject=${encodeURIComponent(subject.name)}`
      );
      const result = await response.json();
      if (result.success && result.data) {
        return { name: subject.name, plan: result.data as StudyPlanData };
      }
      return { name: subject.name, plan: null };
    } catch {
      return { name: subject.name, plan: null };
    }
  });

  const [authResults, planResults] = await Promise.all([
    Promise.all(authPromises),
    Promise.all(planPromises),
  ]);

  authResults.forEach((r) => (authorizations[r.name] = r.authorized));
  planResults.forEach((r) => {
    if (r.plan) plans[r.name] = r.plan;
  });

  subjectsWithTopics.forEach((s) => {
    if (!(s.name in authorizations)) authorizations[s.name] = false;
  });

  return {
    subjectAuthorizations: authorizations,
    studyPlans: plans,
    studentGrade,
  };
}

export const studyPlanKeys = {
  all: ["study-plan-data"] as const,
  detail: (studentId: string, phase: string, subjectKeys: string) =>
    [...studyPlanKeys.all, studentId, phase, subjectKeys] as const,
};

/**
 * Hook para obtener autorizaciones y planes de estudio en paralelo.
 * Reemplaza los useEffects secuenciales de PersonalizedStudyPlan.
 */
export function useStudyPlanData(
  studentId: string,
  phase: "first" | "second" | "third",
  subjectsWithTopics: SubjectWithTopics[]
) {
  const queryClient = useQueryClient();
  const subjectKeys = subjectsWithTopics
    .map((s) => s.name)
    .sort()
    .join(",");

  const query = useQuery({
    queryKey: studyPlanKeys.detail(studentId, phase, subjectKeys),
    queryFn: () =>
      fetchStudyPlanData(studentId, phase, subjectsWithTopics),
    enabled:
      !!studentId &&
      subjectsWithTopics.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: studyPlanKeys.detail(studentId, phase, subjectKeys),
    });
  };

  const addPlanLocally = (subject: string, plan: StudyPlanData) => {
    const key = studyPlanKeys.detail(studentId, phase, subjectKeys);
    queryClient.setQueryData<StudyPlanDataResult>(key, (prev) =>
      prev
        ? { ...prev, studyPlans: { ...prev.studyPlans, [subject]: plan } }
        : prev
    );
  };

  return {
    subjectAuthorizations: query.data?.subjectAuthorizations ?? {},
    studyPlans: query.data?.studyPlans ?? {},
    studentGrade: query.data?.studentGrade,
    loadingPlans: query.isLoading,
    loadingAuthorizations: query.isLoading,
    refetch: query.refetch,
    invalidate,
    addPlanLocally,
  };
}
