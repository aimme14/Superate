import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getFilteredStudents } from '@/controllers/student.controller'
import { getAllInstitutions } from '@/controllers/institution.controller'
import { getAllPhases, getPhaseType } from '@/utils/firestoreHelpers'

const db = getFirestore(firebaseApp)

export interface ExamResult {
  userId: string
  examId: string
  examTitle?: string
  subject?: string
  phase?: string
  score: {
    percentage: number
    overallPercentage: number
    correctAnswers: number
    totalQuestions: number
  }
  timestamp: number
  completed: boolean
}

export interface InstitutionAnalysis {
  institutionId: string
  institutionName: string
  totalStudents: number
  totalExams: number
  averageScore: number
  phaseStats: {
    phase1: { count: number; average: number }
    phase2: { count: number; average: number }
    phase3: { count: number; average: number }
  }
  subjectStats: {
    [subject: string]: {
      count: number
      average: number
    }
  }
  gradeStats: {
    [grade: string]: {
      count: number
      average: number
    }
  }
}

export interface StudentAnalysis {
  studentId: string
  studentName: string
  institutionId: string
  institutionName: string
  grade?: string
  totalExams: number
  averageScore: number
  phaseStats: {
    phase1: { count: number; average: number }
    phase2: { count: number; average: number }
    phase3: { count: number; average: number }
  }
  subjectStats: {
    [subject: string]: {
      count: number
      average: number
    }
  }
  subjectPhaseStats: {
    [subject: string]: {
      phase1: { count: number; average: number }
      phase2: { count: number; average: number }
      phase3: { count: number; average: number }
    }
  }
  // Métricas adicionales
  globalScore?: number
  phase1Percentage?: number
  phase2Percentage?: number
  phase3Percentage?: number
  averageTimePerQuestion?: number // en minutos
  fraudAttempts?: number
  luckPercentage?: number
  // Métricas por fase
  phaseMetrics?: {
    phase1: {
      globalScore: number
      phasePercentage: number
      averageTimePerQuestion: number
      fraudAttempts: number
      luckPercentage: number
      completedSubjects: number
    }
    phase2: {
      globalScore: number
      phasePercentage: number
      averageTimePerQuestion: number
      fraudAttempts: number
      luckPercentage: number
      completedSubjects: number
    }
    phase3: {
      globalScore: number
      phasePercentage: number
      averageTimePerQuestion: number
      fraudAttempts: number
      luckPercentage: number
      completedSubjects: number
    }
  }
}

/**
 * Obtiene todos los resultados de exámenes de una institución
 */
const getInstitutionResults = async (_institutionId: string, studentIds: string[]): Promise<ExamResult[]> => {
  const allResults: ExamResult[] = []
  const phases = getAllPhases()

  for (const studentId of studentIds) {
    try {
      for (const phaseName of phases) {
        const phaseRef = collection(db, 'results', studentId, phaseName)
        const phaseSnap = await getDocs(phaseRef)
        
        phaseSnap.docs.forEach(doc => {
          const examData = doc.data()
          const phase = getPhaseType(phaseName) || phaseName
          
          if (examData.completed && examData.score) {
            allResults.push({
              userId: studentId,
              examId: doc.id,
              examTitle: examData.examTitle,
              subject: examData.subject,
              phase,
              score: {
                percentage: examData.score.percentage || 0,
                overallPercentage: examData.score.overallPercentage || 0,
                correctAnswers: examData.score.correctAnswers || 0,
                totalQuestions: examData.score.totalQuestions || 0,
              },
              timestamp: examData.timestamp || 0,
              completed: examData.completed || false,
            })
          }
        })
      }
    } catch (error) {
      console.error(`Error obteniendo resultados para estudiante ${studentId}:`, error)
    }
  }

  return allResults
}

/**
 * Calcula estadísticas por institución
 */
const calculateInstitutionAnalysis = (
  institutionId: string,
  institutionName: string,
  results: ExamResult[],
  students: any[]
): InstitutionAnalysis => {
  const phaseStats = {
    phase1: { count: 0, total: 0 },
    phase2: { count: 0, total: 0 },
    phase3: { count: 0, total: 0 },
  }

  const subjectStats: { [subject: string]: { count: number; total: number } } = {}
  const gradeStats: { [grade: string]: { count: number; total: number } } = {}

  results.forEach(result => {
    const score = result.score.overallPercentage || 0

    // Estadísticas por fase
    if (result.phase === 'first' || result.phase === 'Fase I') {
      phaseStats.phase1.count++
      phaseStats.phase1.total += score
    } else if (result.phase === 'second' || result.phase === 'Fase II') {
      phaseStats.phase2.count++
      phaseStats.phase2.total += score
    } else if (result.phase === 'third' || result.phase === 'Fase III') {
      phaseStats.phase3.count++
      phaseStats.phase3.total += score
    }

    // Estadísticas por materia
    if (result.subject) {
      if (!subjectStats[result.subject]) {
        subjectStats[result.subject] = { count: 0, total: 0 }
      }
      subjectStats[result.subject].count++
      subjectStats[result.subject].total += score
    }
  })

  // Estadísticas por grado
  students.forEach(student => {
    const grade = student.grade || 'Sin grado'
    if (!gradeStats[grade]) {
      gradeStats[grade] = { count: 0, total: 0 }
    }
    
    const studentResults = results.filter(r => r.userId === student.id)
    const studentAvg = studentResults.length > 0
      ? studentResults.reduce((sum, r) => sum + (r.score.overallPercentage || 0), 0) / studentResults.length
      : 0

    gradeStats[grade].count += studentResults.length
    gradeStats[grade].total += studentAvg * studentResults.length
  })

  return {
    institutionId,
    institutionName,
    totalStudents: students.length,
    totalExams: results.length,
    averageScore: results.length > 0
      ? results.reduce((sum, r) => sum + (r.score.overallPercentage || 0), 0) / results.length
      : 0,
    phaseStats: {
      phase1: {
        count: phaseStats.phase1.count,
        average: phaseStats.phase1.count > 0 ? phaseStats.phase1.total / phaseStats.phase1.count : 0,
      },
      phase2: {
        count: phaseStats.phase2.count,
        average: phaseStats.phase2.count > 0 ? phaseStats.phase2.total / phaseStats.phase2.count : 0,
      },
      phase3: {
        count: phaseStats.phase3.count,
        average: phaseStats.phase3.count > 0 ? phaseStats.phase3.total / phaseStats.phase3.count : 0,
      },
    },
    subjectStats: Object.entries(subjectStats).reduce((acc, [subject, stats]) => {
      acc[subject] = {
        count: stats.count,
        average: stats.count > 0 ? stats.total / stats.count : 0,
      }
      return acc
    }, {} as { [subject: string]: { count: number; average: number } }),
    gradeStats: Object.entries(gradeStats).reduce((acc, [grade, stats]) => {
      acc[grade] = {
        count: stats.count,
        average: stats.count > 0 ? stats.total / stats.count : 0,
      }
      return acc
    }, {} as { [grade: string]: { count: number; average: number } }),
  }
}

/**
 * Hook para obtener análisis completo del sistema
 */
export const useAdminAnalysis = (jornada?: 'mañana' | 'tarde' | 'única', year?: number) => {
  return useQuery({
    queryKey: ['admin', 'analysis', jornada, year],
    queryFn: async () => {
      // Obtener todas las instituciones
      const institutionsResult = await getAllInstitutions()
      if (!institutionsResult.success) {
        throw institutionsResult.error
      }

      const institutions = institutionsResult.data
      const analysis: InstitutionAnalysis[] = []

      // Función auxiliar para obtener el año de creación del estudiante
      const getStudentYear = (student: any): number | null => {
        if (!student.createdAt) return null
        
        let date: Date
        if (typeof student.createdAt === 'string') {
          date = new Date(student.createdAt)
        } else if (student.createdAt?.toDate) {
          date = student.createdAt.toDate()
        } else if (student.createdAt?.seconds) {
          date = new Date(student.createdAt.seconds * 1000)
        } else if (student.createdAt instanceof Date) {
          date = student.createdAt
        } else {
          return null
        }
        
        return date.getFullYear()
      }

      // Para cada institución, obtener estudiantes y resultados
      for (const institution of institutions) {
        try {
          // Obtener estudiantes de la institución
          const filters: any = {
            institutionId: institution.id,
            isActive: true,
          }
          
          if (jornada) {
            filters.jornada = jornada
          }
          
          const studentsResult = await getFilteredStudents(filters)

          if (!studentsResult.success || !studentsResult.data) {
            continue
          }

          let students = studentsResult.data
          
          // Filtrar por año si se especifica
          if (year !== undefined) {
            students = students.filter((student: any) => {
              const studentYear = getStudentYear(student)
              return studentYear === year
            })
          }

          const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]

          if (studentIds.length === 0) {
            analysis.push({
              institutionId: institution.id,
              institutionName: institution.name || 'Sin nombre',
              totalStudents: 0,
              totalExams: 0,
              averageScore: 0,
              phaseStats: {
                phase1: { count: 0, average: 0 },
                phase2: { count: 0, average: 0 },
                phase3: { count: 0, average: 0 },
              },
              subjectStats: {},
              gradeStats: {},
            })
            continue
          }

          // Obtener resultados de exámenes
          const results = await getInstitutionResults(institution.id, studentIds)

          // Calcular análisis
          const institutionAnalysis = calculateInstitutionAnalysis(
            institution.id,
            institution.name || 'Sin nombre',
            results,
            students
          )

          analysis.push(institutionAnalysis)
        } catch (error) {
          console.error(`Error procesando institución ${institution.id}:`, error)
        }
      }

      return analysis
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000, // Refetch cada 10 minutos
  })
}

/**
 * Hook para obtener análisis de un estudiante específico
 */
export const useStudentAnalysis = (studentId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['admin', 'student-analysis', studentId],
    queryFn: async () => {
      const phases = getAllPhases()
      const results: ExamResult[] = []

      try {
        for (const phaseName of phases) {
          const phaseRef = collection(db, 'results', studentId, phaseName)
          const phaseSnap = await getDocs(phaseRef)
          
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            const phase = getPhaseType(phaseName) || phaseName
            
            if (examData.completed && examData.score) {
              results.push({
                userId: studentId,
                examId: doc.id,
                examTitle: examData.examTitle,
                subject: examData.subject,
                phase,
                score: {
                  percentage: examData.score.percentage || 0,
                  overallPercentage: examData.score.overallPercentage || 0,
                  correctAnswers: examData.score.correctAnswers || 0,
                  totalQuestions: examData.score.totalQuestions || 0,
                },
                timestamp: examData.timestamp || 0,
                completed: examData.completed || false,
                // Datos adicionales para métricas
                tabChangeCount: examData.tabChangeCount || 0,
                lockedByTabChange: examData.lockedByTabChange || false,
                questionDetails: examData.questionDetails || [],
                timeSpent: examData.timeSpent || 0,
              } as any)
            }
          })
        }

        const phaseStats = {
          phase1: { count: 0, total: 0 },
          phase2: { count: 0, total: 0 },
          phase3: { count: 0, total: 0 },
        }

        const subjectStats: { [subject: string]: { count: number; total: number } } = {}
        const subjectPhaseStats: { [subject: string]: { phase1: { count: number; total: number }; phase2: { count: number; total: number }; phase3: { count: number; total: number } } } = {}

        // Variables para métricas adicionales
        let fraudAttempts = 0
        let totalTimeFromQuestions = 0
        let totalQuestionsWithTime = 0
        let luckAnswers = 0
        let totalAnswersWithTime = 0
        const phase3Subjects = new Set<string>()
        const phase1Subjects = new Set<string>()
        const phase2Subjects = new Set<string>()
        const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
        const POINTS_PER_NATURALES_SUBJECT = 100 / 3 // 33.33 puntos por materia natural
        const POINTS_PER_REGULAR_SUBJECT = 100 // 100 puntos por materia regular
        const TOTAL_SUBJECTS = 7
        
        // Normalizar nombres de materias
        const normalizeSubjectName = (subject: string): string => {
          const normalized = subject.trim().toLowerCase()
          const subjectMap: Record<string, string> = {
            'biologia': 'Biologia',
            'biología': 'Biologia',
            'quimica': 'Quimica',
            'química': 'Quimica',
            'fisica': 'Física',
            'física': 'Física',
            'matematicas': 'Matemáticas',
            'matemáticas': 'Matemáticas',
            'lenguaje': 'Lenguaje',
            'ciencias sociales': 'Ciencias Sociales',
            'sociales': 'Ciencias Sociales',
            'ingles': 'Inglés',
            'inglés': 'Inglés'
          }
          return subjectMap[normalized] || subject
        }
        
        // Para calcular el mejor puntaje por materia (como en promedio.tsx)
        const subjectBestScores: { [subject: string]: number } = {}

        results.forEach(result => {
          const score = result.score.overallPercentage || 0
          const resultAny = result as any

          // Contar intentos de fraude
          if (resultAny.tabChangeCount > 0 || resultAny.lockedByTabChange === true) {
            fraudAttempts++
          }

          // Calcular tiempo y suerte por pregunta (igual que en promedio.tsx)
          if (resultAny.questionDetails && Array.isArray(resultAny.questionDetails)) {
            const normalizedSubject = normalizeSubjectName(result.subject || '')
            resultAny.questionDetails.forEach((q: any) => {
              const timeSpent = q.timeSpent || 0
              if (timeSpent > 0) {
                totalTimeFromQuestions += timeSpent
                totalQuestionsWithTime++
                
                // Solo contar para suerte si la pregunta fue contestada y no es Inglés
                if (q.answered && normalizedSubject !== 'Inglés') {
                  totalAnswersWithTime++
                  // Respuestas rápidas (< 10 segundos) se consideran "suerte"
                  if (timeSpent < 10) {
                    luckAnswers++
                  }
                }
              }
            })
          }

          // Guardar mejor puntaje de cada materia (como en promedio.tsx)
          if (result.subject) {
            const normalizedSubject = normalizeSubjectName(result.subject)
            if (!subjectBestScores[normalizedSubject] || score > subjectBestScores[normalizedSubject]) {
              subjectBestScores[normalizedSubject] = score
            }
          }

          // Contar materias completadas por fase
          if (result.subject) {
            const normalizedSubject = normalizeSubjectName(result.subject)
            const validSubjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
            if (validSubjects.includes(normalizedSubject)) {
              if (result.phase === 'first' || result.phase === 'Fase I') {
                phase1Subjects.add(normalizedSubject)
              } else if (result.phase === 'second' || result.phase === 'Fase II') {
                phase2Subjects.add(normalizedSubject)
              } else if (result.phase === 'third' || result.phase === 'Fase III') {
                phase3Subjects.add(normalizedSubject)
              }
            }
          }

          if (result.phase === 'first' || result.phase === 'Fase I') {
            phaseStats.phase1.count++
            phaseStats.phase1.total += score
          } else if (result.phase === 'second' || result.phase === 'Fase II') {
            phaseStats.phase2.count++
            phaseStats.phase2.total += score
          } else if (result.phase === 'third' || result.phase === 'Fase III') {
            phaseStats.phase3.count++
            phaseStats.phase3.total += score
          }

          if (result.subject) {
            if (!subjectStats[result.subject]) {
              subjectStats[result.subject] = { count: 0, total: 0 }
            }
            subjectStats[result.subject].count++
            subjectStats[result.subject].total += score

            // Estadísticas por materia y fase
            if (!subjectPhaseStats[result.subject]) {
              subjectPhaseStats[result.subject] = {
                phase1: { count: 0, total: 0 },
                phase2: { count: 0, total: 0 },
                phase3: { count: 0, total: 0 },
              }
            }

            if (result.phase === 'first' || result.phase === 'Fase I') {
              subjectPhaseStats[result.subject].phase1.count++
              subjectPhaseStats[result.subject].phase1.total += score
            } else if (result.phase === 'second' || result.phase === 'Fase II') {
              subjectPhaseStats[result.subject].phase2.count++
              subjectPhaseStats[result.subject].phase2.total += score
            } else if (result.phase === 'third' || result.phase === 'Fase III') {
              subjectPhaseStats[result.subject].phase3.count++
              subjectPhaseStats[result.subject].phase3.total += score
            }
          }
        })

        // Calcular puntaje global usando el mejor puntaje de cada materia (igual que promedio.tsx)
        let globalScore = 0
        Object.entries(subjectBestScores).forEach(([subject, percentage]) => {
          let pointsForSubject: number
          if (NATURALES_SUBJECTS.includes(subject)) {
            pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
          } else {
            pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT
          }
          globalScore += pointsForSubject
        })
        globalScore = Math.round(globalScore)

        // Calcular porcentajes de completitud por fase
        const phase1Percentage = Math.round((phase1Subjects.size / TOTAL_SUBJECTS) * 100)
        const phase2Percentage = Math.round((phase2Subjects.size / TOTAL_SUBJECTS) * 100)
        const phase3Percentage = Math.round((phase3Subjects.size / TOTAL_SUBJECTS) * 100)

        // Calcular métricas por fase (igual que calculatePhaseMetrics en promedio.tsx)
        const calculatePhaseMetrics = (phaseResults: any[], phaseSubjects: Set<string>) => {
          let phaseFraudAttempts = 0
          let phaseTotalTimeFromQuestions = 0
          let phaseTotalQuestionsWithTime = 0
          let phaseLuckAnswers = 0
          let phaseTotalAnswersWithTime = 0
          let phaseTotalQuestions = 0
          const phaseSubjectBestScores: { [subject: string]: { percentage: number } } = {}

          phaseResults.forEach(result => {
            const resultAny = result as any
            const subject = normalizeSubjectName(result.subject || result.examTitle || '')
            
            // Calcular porcentaje (igual que en promedio.tsx)
            let percentage = 0
            if (result.score?.overallPercentage !== undefined) {
              percentage = result.score.overallPercentage
            } else if (result.score?.correctAnswers !== undefined && result.score?.totalQuestions !== undefined) {
              const total = result.score.totalQuestions
              const correct = result.score.correctAnswers
              percentage = total > 0 ? (correct / total) * 100 : 0
              phaseTotalQuestions += total
            } else if (resultAny.questionDetails && Array.isArray(resultAny.questionDetails) && resultAny.questionDetails.length > 0) {
              const correct = resultAny.questionDetails.filter((q: any) => q.isCorrect).length
              const total = resultAny.questionDetails.length
              percentage = total > 0 ? (correct / total) * 100 : 0
              phaseTotalQuestions += total
            }

            // Guardar mejor puntaje de cada materia (igual que en promedio.tsx)
            if (!phaseSubjectBestScores[subject] || percentage > phaseSubjectBestScores[subject].percentage) {
              phaseSubjectBestScores[subject] = { percentage }
            }

            // Contar intentos de fraude
            if (resultAny.tabChangeCount > 0 || resultAny.lockedByTabChange === true) {
              phaseFraudAttempts++
            }

            // Calcular tiempo y suerte por pregunta (igual que en promedio.tsx)
            if (resultAny.questionDetails && Array.isArray(resultAny.questionDetails)) {
              resultAny.questionDetails.forEach((q: any) => {
                if (q.timeSpent && q.timeSpent > 0) {
                  phaseTotalTimeFromQuestions += q.timeSpent
                  phaseTotalQuestionsWithTime++
                  
                  // Solo contar para suerte si la pregunta fue contestada y no es Inglés
                  // Usar el subject normalizado del examen, no de la pregunta
                  if (q.answered && subject !== 'Inglés') {
                    phaseTotalAnswersWithTime++
                    if (q.timeSpent < 10) {
                      phaseLuckAnswers++
                    }
                  }
                }
              })
            }
          })

          // Calcular puntaje global de la fase (igual que en promedio.tsx)
          let phaseGlobalScore = 0
          Object.entries(phaseSubjectBestScores).forEach(([subject, data]) => {
            let pointsForSubject: number
            if (NATURALES_SUBJECTS.includes(subject)) {
              pointsForSubject = (data.percentage / 100) * POINTS_PER_NATURALES_SUBJECT
            } else {
              pointsForSubject = (data.percentage / 100) * POINTS_PER_REGULAR_SUBJECT
            }
            phaseGlobalScore += pointsForSubject
          })
          phaseGlobalScore = Math.round(phaseGlobalScore)

          const phasePercentage = Math.round((phaseSubjects.size / TOTAL_SUBJECTS) * 100)
          const phaseAverageTimePerQuestion = phaseTotalQuestionsWithTime > 0 
            ? (phaseTotalTimeFromQuestions / phaseTotalQuestionsWithTime) / 60 
            : 0
          const phaseLuckPercentage = phaseTotalAnswersWithTime > 0 
            ? Math.round((phaseLuckAnswers / phaseTotalAnswersWithTime) * 100) 
            : 0

          return {
            globalScore: phaseGlobalScore,
            phasePercentage,
            averageTimePerQuestion: phaseAverageTimePerQuestion,
            fraudAttempts: phaseFraudAttempts,
            luckPercentage: phaseLuckPercentage,
            completedSubjects: phaseSubjects.size,
            totalQuestions: phaseTotalQuestions
          }
        }

        // Filtrar resultados por fase
        const phase1Results = results.filter(r => r.phase === 'first' || r.phase === 'Fase I')
        const phase2Results = results.filter(r => r.phase === 'second' || r.phase === 'Fase II')
        const phase3Results = results.filter(r => r.phase === 'third' || r.phase === 'Fase III')

        // Calcular métricas por fase
        const phase1Metrics = calculatePhaseMetrics(phase1Results, phase1Subjects)
        const phase2Metrics = calculatePhaseMetrics(phase2Results, phase2Subjects)
        const phase3Metrics = calculatePhaseMetrics(phase3Results, phase3Subjects)

        // Calcular tiempo promedio por pregunta en minutos (todas las fases)
        const averageTimePerQuestion = totalQuestionsWithTime > 0 
          ? (totalTimeFromQuestions / totalQuestionsWithTime) / 60 
          : 0

        // Calcular porcentaje de suerte (todas las fases)
        const luckPercentage = totalAnswersWithTime > 0 
          ? Math.round((luckAnswers / totalAnswersWithTime) * 100) 
          : 0

        return {
          studentId,
          totalExams: results.length,
          averageScore: results.length > 0
            ? results.reduce((sum, r) => sum + (r.score.overallPercentage || 0), 0) / results.length
            : 0,
          phaseStats: {
            phase1: {
              count: phaseStats.phase1.count,
              average: phaseStats.phase1.count > 0 ? phaseStats.phase1.total / phaseStats.phase1.count : 0,
            },
            phase2: {
              count: phaseStats.phase2.count,
              average: phaseStats.phase2.count > 0 ? phaseStats.phase2.total / phaseStats.phase2.count : 0,
            },
            phase3: {
              count: phaseStats.phase3.count,
              average: phaseStats.phase3.count > 0 ? phaseStats.phase3.total / phaseStats.phase3.count : 0,
            },
          },
          subjectStats: Object.entries(subjectStats).reduce((acc, [subject, stats]) => {
            acc[subject] = {
              count: stats.count,
              average: stats.count > 0 ? stats.total / stats.count : 0,
            }
            return acc
          }, {} as { [subject: string]: { count: number; average: number } }),
          subjectPhaseStats: Object.entries(subjectPhaseStats).reduce((acc, [subject, stats]) => {
            acc[subject] = {
              phase1: {
                count: stats.phase1.count,
                average: stats.phase1.count > 0 ? stats.phase1.total / stats.phase1.count : 0,
              },
              phase2: {
                count: stats.phase2.count,
                average: stats.phase2.count > 0 ? stats.phase2.total / stats.phase2.count : 0,
              },
              phase3: {
                count: stats.phase3.count,
                average: stats.phase3.count > 0 ? stats.phase3.total / stats.phase3.count : 0,
              },
            }
            return acc
          }, {} as { [subject: string]: { phase1: { count: number; average: number }; phase2: { count: number; average: number }; phase3: { count: number; average: number } } }),
          // Métricas adicionales
          globalScore,
          phase1Percentage,
          phase2Percentage,
          phase3Percentage,
          averageTimePerQuestion,
          fraudAttempts,
          luckPercentage,
          // Métricas por fase
          phaseMetrics: {
            phase1: phase1Metrics,
            phase2: phase2Metrics,
            phase3: phase3Metrics,
          },
        }
      } catch (error) {
        console.error(`Error obteniendo análisis del estudiante ${studentId}:`, error)
        throw error
      }
    },
    enabled: enabled && !!studentId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Interface para el ranking de estudiantes
 */
export interface StudentRankingItem {
  studentId: string
  studentName: string
  institutionId: string
  institutionName: string
  score: number // Puntaje global o promedio
  totalExams: number
}

/**
 * Hook para obtener ranking de estudiantes por institución
 */
export const useStudentsRanking = (jornada?: 'mañana' | 'tarde' | 'única', year?: number) => {
  return useQuery({
    queryKey: ['admin', 'students-ranking', jornada, year],
    queryFn: async () => {
      // Obtener todas las instituciones
      const institutionsResult = await getAllInstitutions()
      if (!institutionsResult.success) {
        throw institutionsResult.error
      }

      const institutions = institutionsResult.data
      const bestStudentByInstitution = new Map<string, StudentRankingItem>()

      // Función auxiliar para obtener el año de creación del estudiante
      const getStudentYear = (student: any): number | null => {
        if (!student.createdAt) return null
        
        let date: Date
        if (typeof student.createdAt === 'string') {
          date = new Date(student.createdAt)
        } else if (student.createdAt?.toDate) {
          date = student.createdAt.toDate()
        } else if (student.createdAt?.seconds) {
          date = new Date(student.createdAt.seconds * 1000)
        } else if (student.createdAt instanceof Date) {
          date = student.createdAt
        } else {
          return null
        }
        
        return date.getFullYear()
      }

      // Para cada institución, obtener estudiantes y calcular sus puntajes
      for (const institution of institutions) {
        try {
          // Obtener estudiantes de la institución
          const filters: any = {
            institutionId: institution.id,
            isActive: true,
          }
          
          if (jornada) {
            filters.jornada = jornada
          }
          
          const studentsResult = await getFilteredStudents(filters)

          if (!studentsResult.success || !studentsResult.data) {
            continue
          }

          let students = studentsResult.data
          
          // Filtrar por año si se especifica
          if (year !== undefined) {
            students = students.filter((student: any) => {
              const studentYear = getStudentYear(student)
              return studentYear === year
            })
          }

          const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]

          if (studentIds.length === 0) {
            continue
          }

          // Obtener resultados de exámenes para todos los estudiantes
          const allResults = await getInstitutionResults(institution.id, studentIds)

          // Agrupar resultados por estudiante
          const resultsByStudent = new Map<string, ExamResult[]>()
          allResults.forEach(result => {
            if (!resultsByStudent.has(result.userId)) {
              resultsByStudent.set(result.userId, [])
            }
            resultsByStudent.get(result.userId)!.push(result)
          })

          // Calcular puntaje para cada estudiante de esta institución (solo Fase III)
          const institutionStudents: StudentRankingItem[] = []
          
          students.forEach((student: any) => {
            const studentId = student.id || student.uid
            if (!studentId) return

            const allStudentResults = resultsByStudent.get(studentId) || []
            
            // Filtrar solo resultados de Fase III
            const phase3Results = allStudentResults.filter(r => 
              r.phase === 'third' || r.phase === 'Fase III'
            )
            
            if (phase3Results.length === 0) {
              return // No incluir estudiantes sin resultados de Fase III
            }

            // Calcular promedio de puntajes solo de Fase III
            const phase3Score = phase3Results.length > 0
              ? phase3Results.reduce((sum, r) => sum + (r.score.overallPercentage || 0), 0) / phase3Results.length
              : 0

            institutionStudents.push({
              studentId,
              studentName: student.name || student.displayName || 'Sin nombre',
              institutionId: institution.id,
              institutionName: institution.name || 'Sin nombre',
              score: phase3Score,
              totalExams: phase3Results.length,
            })
          })

          // Obtener solo el mejor estudiante de esta institución
          if (institutionStudents.length > 0) {
            const bestStudent = institutionStudents.reduce((best, current) => {
              return current.score > best.score ? current : best
            })
            // Asegurarnos de que solo hay un estudiante por institución (por ID)
            // Si ya existe uno, solo lo reemplazamos si el nuevo tiene mejor puntaje
            const existing = bestStudentByInstitution.get(institution.id)
            if (!existing || bestStudent.score > existing.score) {
              bestStudentByInstitution.set(institution.id, bestStudent)
            }
          }
        } catch (error) {
          console.error(`Error procesando estudiantes de institución ${institution.id}:`, error)
        }
      }

      // Convertir el Map a array y ordenar por puntaje (de mayor a menor)
      const finalRanking = Array.from(bestStudentByInstitution.values())
      finalRanking.sort((a, b) => b.score - a.score)

      return finalRanking
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000, // Refetch cada 10 minutos
  })
}


