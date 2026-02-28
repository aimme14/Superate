/**
 * Tipos e interfaces para el análisis ICFES y Plan de Estudio.
 */

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
  subject?: string;
  phase?: string;
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
  questionTimeTracking?: { [key: string]: { timeSpent: number; startTime?: number; endTime?: number } };
  questionDetails: Array<{
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
    timeSpent?: number;
  }>;
}

export interface SubjectAnalysis {
  name: string;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  timeSpent: number;
  percentage: number;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
}

export interface TopicAnalysis {
  name: string;
  percentage: number;
  correct: number;
  total: number;
}

export interface SubjectWithTopics {
  name: string;
  percentage: number;
  topics: TopicAnalysis[];
  strengths: string[];
  weaknesses: string[];
  neutrals: string[];
}

export interface AnalysisData {
  student: {
    name: string;
    id: string;
    testDate: string;
    testType: string;
  };
  overall: {
    score: number;
    percentile: number;
    phasePercentage: number;
    currentPhase: string;
    timeSpent: number;
    questionsAnswered: number;
    totalQuestions: number;
    averagePercentage: number;
  };
  subjects: SubjectAnalysis[];
  subjectsWithTopics: SubjectWithTopics[];
  patterns: {
    timeManagement: string;
    errorTypes: string[];
    strongestArea: string;
    weakestArea: string;
    completionRate: number;
    securityIssues: number;
    luckPercentage: number;
  };
  recommendations: Array<{
    priority: string;
    subject: string;
    topic: string;
    resources: string[];
    timeEstimate: string;
  }>;
}

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

export interface ICFESAnalysisInterfaceProps {
  planOnly?: boolean;
}
