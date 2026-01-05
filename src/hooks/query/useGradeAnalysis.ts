import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getFilteredStudents } from '@/controllers/student.controller'
import { getAllInstitutions } from '@/controllers/institution.controller'
import { getAllPhases, getPhaseType } from '@/utils/firestoreHelpers'
import { ExamResult } from './useAdminAnalysis'

const db = getFirestore(firebaseApp)

export interface GradeInstitutionAnalysis {
  institutionId: string
  institutionName: string
  gradeName: string
  totalStudents: number
  totalExams: number
  averageScore: number
  phaseStats: {
    phase1: { count: number; average: number }
    phase2: { count: number; average: number }
    phase3: { count: number; average: number }
  }
}

/**
 * Obtiene resultados de exámenes para estudiantes de un grado específico
 */
const getGradeResults = async (studentIds: string[]): Promise<ExamResult[]> => {
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
 * Calcula estadísticas por institución para un grado específico
 */
const calculateGradeInstitutionAnalysis = (
  institutionId: string,
  institutionName: string,
  gradeName: string,
  results: ExamResult[],
  students: any[]
): GradeInstitutionAnalysis => {
  const phaseStats = {
    phase1: { count: 0, total: 0 },
    phase2: { count: 0, total: 0 },
    phase3: { count: 0, total: 0 },
  }

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
  })

  return {
    institutionId,
    institutionName,
    gradeName,
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
  }
}

/**
 * Hook para obtener análisis por grado específico
 */
export const useGradeAnalysis = (gradeName: string, enabled: boolean = true, jornada?: 'mañana' | 'tarde' | 'única', year?: number) => {
  return useQuery({
    queryKey: ['admin', 'grade-analysis', gradeName, jornada, year],
    queryFn: async () => {
      if (!gradeName || gradeName === 'all') {
        return []
      }

      // Obtener todas las instituciones
      const institutionsResult = await getAllInstitutions()
      if (!institutionsResult.success) {
        throw institutionsResult.error
      }

      const institutions = institutionsResult.data
      const analysis: GradeInstitutionAnalysis[] = []

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

      // Para cada institución, buscar el grado por nombre y obtener estudiantes
      for (const institution of institutions) {
        try {
          // Buscar el grado en esta institución
          let gradeId: string | null = null
          for (const campus of institution.campuses || []) {
            const grade = campus.grades?.find((g: any) => g.name === gradeName)
            if (grade) {
              gradeId = grade.id
              break
            }
          }

          if (!gradeId) {
            continue // Esta institución no tiene este grado
          }

          // Obtener todos los estudiantes de la institución con el grado específico
          const filters: any = {
            institutionId: institution.id,
            gradeId: gradeId,
            isActive: true,
          }
          
          if (jornada) {
            filters.jornada = jornada
          }
          
          const studentsResult = await getFilteredStudents(filters)

          if (!studentsResult.success || !studentsResult.data) {
            // Incluir institución incluso sin estudiantes, con datos vacíos
            analysis.push({
              institutionId: institution.id,
              institutionName: institution.name || 'Sin nombre',
              gradeName,
              totalStudents: 0,
              totalExams: 0,
              averageScore: 0,
              phaseStats: {
                phase1: { count: 0, average: 0 },
                phase2: { count: 0, average: 0 },
                phase3: { count: 0, average: 0 },
              },
            })
            continue
          }

          let gradeStudents = studentsResult.data
          
          // Filtrar por año si se especifica
          if (year !== undefined) {
            gradeStudents = gradeStudents.filter((student: any) => {
              const studentYear = getStudentYear(student)
              return studentYear === year
            })
          }
          
          const studentIds = gradeStudents.map((s: any) => s.id || s.uid).filter(Boolean) as string[]

          if (studentIds.length === 0) {
            // Incluir institución incluso sin estudiantes, con datos vacíos
            analysis.push({
              institutionId: institution.id,
              institutionName: institution.name || 'Sin nombre',
              gradeName,
              totalStudents: 0,
              totalExams: 0,
              averageScore: 0,
              phaseStats: {
                phase1: { count: 0, average: 0 },
                phase2: { count: 0, average: 0 },
                phase3: { count: 0, average: 0 },
              },
            })
            continue
          }

          // Obtener resultados de exámenes
          const results = await getGradeResults(studentIds)

          if (results.length === 0) {
            // Incluir institución incluso sin resultados, con datos vacíos
            analysis.push({
              institutionId: institution.id,
              institutionName: institution.name || 'Sin nombre',
              gradeName,
              totalStudents: gradeStudents.length,
              totalExams: 0,
              averageScore: 0,
              phaseStats: {
                phase1: { count: 0, average: 0 },
                phase2: { count: 0, average: 0 },
                phase3: { count: 0, average: 0 },
              },
            })
            continue
          }

          // Calcular análisis
          const gradeAnalysis = calculateGradeInstitutionAnalysis(
            institution.id,
            institution.name || 'Sin nombre',
            gradeName,
            results,
            gradeStudents
          )

          analysis.push(gradeAnalysis)
        } catch (error) {
          console.error(`Error procesando institución ${institution.id} para grado ${gradeName}:`, error)
        }
      }

      return analysis
    },
    enabled: enabled && !!gradeName && gradeName !== 'all',
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

