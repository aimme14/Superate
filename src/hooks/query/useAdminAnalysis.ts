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
              })
            }
          })
        }

        const phaseStats = {
          phase1: { count: 0, total: 0 },
          phase2: { count: 0, total: 0 },
          phase3: { count: 0, total: 0 },
        }

        const subjectStats: { [subject: string]: { count: number; total: number } } = {}

        results.forEach(result => {
          const score = result.score.overallPercentage || 0

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
          }
        })

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


