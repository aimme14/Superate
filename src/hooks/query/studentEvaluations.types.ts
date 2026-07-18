/**
 * Resultado de examen almacenado en Firestore / reconstruido desde studentSummaries.
 */

export interface ExamScore {
  correctAnswers: number
  totalAnswered: number
  totalQuestions: number
  percentage: number
  overallPercentage: number
}

export interface ExamResult {
  userId: string
  examId: string
  examTitle: string
  answers: { [key: string]: string }
  score: ExamScore
  topic: string
  timeExpired: boolean
  lockedByTabChange: boolean
  tabChangeCount: number
  fraudSignals?: {
    copyPaste: number
    contextMenu: number
    devtools: number
    secondScreen: boolean
  }
  startTime: string
  endTime: string
  timeSpent: number
  completed: boolean
  timestamp: number
  phase?: string
  subject?: string
  questionDetails: Array<{
    questionId: number | string
    questionText: string
    userAnswer: string | null
    correctAnswer: string
    topic: string
    isCorrect: boolean
    answered: boolean
    timeSpent?: number
  }>
}
