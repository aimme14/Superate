import { useState, useMemo, useEffect } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Download, 
  Search, 
  Loader2, 
  Target, 
  FileText,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/utils/logger'
import { useFilteredStudents } from '@/hooks/query/useStudentQuery'
import { useNotification } from '@/hooks/ui/useNotification'
import { studentSummaryService } from '@/services/studentSummary/studentSummary.service'
import { getUserById } from '@/controllers/user.controller'
import { getInstitutionById } from '@/controllers/institution.controller'
import { getFilteredStudents } from '@/controllers/student.controller'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'

const db = getFirestore(firebaseApp)

interface StudentPhaseReportsProps extends ThemeContextProps {}

export default function StudentPhaseReports({ theme }: StudentPhaseReportsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [isPhaseDialogOpen, setIsPhaseDialogOpen] = useState(false)
  const [selectedPhases, setSelectedPhases] = useState<Array<'first' | 'second' | 'third'>>([])
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [generatingPDFStudentId, setGeneratingPDFStudentId] = useState<string | null>(null)
  const [isCheckingPhases, setIsCheckingPhases] = useState(false)
  const [availablePhases, setAvailablePhases] = useState<Array<'first' | 'second' | 'third'>>([])
  const [phaseStatus, setPhaseStatus] = useState<{
    first: boolean
    second: boolean
    third: boolean
  }>({ first: false, second: false, third: false })
  
  // Estados para descarga masiva por grado
  const [isBulkDownloadDialogOpen, setIsBulkDownloadDialogOpen] = useState(false)
  const [selectedGradeForBulk, setSelectedGradeForBulk] = useState<{ students: any[], gradeName: string, gradeId: string } | null>(null)
  const [bulkSelectedPhases, setBulkSelectedPhases] = useState<Array<'first' | 'second' | 'third'>>([])
  const [isBulkGenerating, setIsBulkGenerating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ 
    current: 0, 
    total: 0, 
    currentStudent: '',
    successCount: 0,
    errorCount: 0,
    estimatedTimeRemaining: 0
  })
  const [isBulkCancelled, setIsBulkCancelled] = useState(false)

  const { notifySuccess, notifyError } = useNotification()

  // Obtener estudiantes filtrados
  const { students, isLoading: isLoadingStudents } = useFilteredStudents({
    searchTerm: searchTerm || undefined,
    institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
    isActive: true
  })

  // Obtener instituciones únicas para el filtro
  const institutions = useMemo(() => {
    const instSet = new Set<string>()
    const instMap = new Map<string, string>()
    
    students.forEach((student: any) => {
      const instId = student.institutionId || student.inst
      const instName = student.institutionName || 'Sin institución'
      if (instId) {
        instSet.add(instId)
        if (!instMap.has(instId)) {
          instMap.set(instId, instName)
        }
      }
    })
    
    return Array.from(instSet).map(id => ({
      id,
      name: instMap.get(id) || 'Sin nombre'
    }))
  }, [students])

  // Filtrar estudiantes por término de búsqueda
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students
    
    const term = searchTerm.toLowerCase()
    return students.filter((student: any) => {
      const name = (student.name || '').toLowerCase()
      const email = (student.email || '').toLowerCase()
      const idNumber = (student.idNumber || student.identification || '').toLowerCase()
      return name.includes(term) || email.includes(term) || idNumber.includes(term)
    })
  }, [students, searchTerm])

  // Estado para controlar qué secciones están expandidas
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Agrupar estudiantes jerárquicamente: Institución -> Año -> Sede -> Grado
  const groupedStudents = useMemo(() => {
    const groups: {
      [institutionKey: string]: {
        institutionId: string
        institutionName: string
        years: {
          [yearKey: string]: {
            year: number | string
            campuses: {
              [campusKey: string]: {
                campusId: string
                campusName: string
                grades: {
                  [gradeKey: string]: {
                    gradeId: string
                    gradeName: string
                    students: any[]
                  }
                }
              }
            }
          }
        }
      }
    } = {}

    filteredStudents.forEach((student: any) => {
      const institutionId = student.institutionId || student.inst || 'sin-institucion'
      const institutionName = student.institutionName || 'Sin institución'
      const academicYear = student.academicYear || student.year || 'Sin año'
      const campusId = student.campusId || student.campus || 'sin-sede'
      const campusName = student.campusName || 'Sin sede'
      const gradeId = student.gradeId || student.grade || 'sin-grado'
      const gradeName = student.gradeName || 'Sin grado'

      // Crear claves para la estructura jerárquica
      const institutionKey = institutionId
      const yearKey = `${institutionKey}-${academicYear}`
      const campusKey = `${yearKey}-${campusId}`
      const gradeKey = `${campusKey}-${gradeId}`

      // Inicializar institución si no existe
      if (!groups[institutionKey]) {
        groups[institutionKey] = {
          institutionId,
          institutionName,
          years: {}
        }
      }

      // Inicializar año si no existe
      if (!groups[institutionKey].years[yearKey]) {
        groups[institutionKey].years[yearKey] = {
          year: academicYear,
          campuses: {}
        }
      }

      // Inicializar sede si no existe
      if (!groups[institutionKey].years[yearKey].campuses[campusKey]) {
        groups[institutionKey].years[yearKey].campuses[campusKey] = {
          campusId,
          campusName,
          grades: {}
        }
      }

      // Inicializar grado si no existe
      if (!groups[institutionKey].years[yearKey].campuses[campusKey].grades[gradeKey]) {
        groups[institutionKey].years[yearKey].campuses[campusKey].grades[gradeKey] = {
          gradeId,
          gradeName,
          students: []
        }
      }

      // Agregar estudiante al grado correspondiente
      groups[institutionKey].years[yearKey].campuses[campusKey].grades[gradeKey].students.push(student)
    })

    return groups
  }, [filteredStudents])

  // Expandir/colapsar todas las secciones de un nivel específico
  const expandAllInLevel = (level: 'institution' | 'year' | 'campus' | 'grade') => {
    const newExpanded = new Set<string>()
    
    Object.values(groupedStudents).forEach((institution) => {
      const institutionKey = institution.institutionId
      
      if (level === 'institution') {
        newExpanded.add(institutionKey)
      }
      
      Object.values(institution.years).forEach((yearData) => {
        const yearKey = `${institutionKey}-${yearData.year}`
        
        if (level === 'year') {
          newExpanded.add(institutionKey)
          newExpanded.add(yearKey)
        }
        
        Object.values(yearData.campuses).forEach((campus) => {
          const campusKey = `${yearKey}-${campus.campusId}`
          
          if (level === 'campus') {
            newExpanded.add(institutionKey)
            newExpanded.add(yearKey)
            newExpanded.add(campusKey)
          }
          
          Object.values(campus.grades).forEach((grade) => {
            const gradeKey = `${campusKey}-${grade.gradeId}`
            
            if (level === 'grade') {
              newExpanded.add(institutionKey)
              newExpanded.add(yearKey)
              newExpanded.add(campusKey)
              newExpanded.add(gradeKey)
            }
          })
        })
      })
    })
    
    setExpandedSections(newExpanded)
  }

  const collapseAll = () => {
    setExpandedSections(new Set())
  }

  // Calcular total de estudiantes agrupados
  const totalStudentsCount = useMemo(() => {
    let count = 0
    Object.values(groupedStudents).forEach(institution => {
      Object.values(institution.years).forEach(year => {
        Object.values(year.campuses).forEach(campus => {
          Object.values(campus.grades).forEach(grade => {
            count += grade.students.length
          })
        })
      })
    })
    return count
  }, [groupedStudents])

  // Lista de todas las materias requeridas
  const ALL_SUBJECTS = [
    'Matemáticas',
    'Lenguaje',
    'Ciencias Sociales',
    'Biologia',
    'Quimica',
    'Física',
    'Inglés'
  ]

  // Función helper para normalizar nombres de materias
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

  // Función helper para obtener evaluaciones de una fase específica
  const getPhaseEvaluations = async (studentId: string, phase: 'first' | 'second' | 'third'): Promise<any[]> => {
    const phaseVariants: Record<string, string[]> = {
      first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
      second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
      third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
    }

    const evaluations: any[] = []
    const phaseNames = phaseVariants[phase] || []

    for (const phaseName of phaseNames) {
      try {
        const phaseRef = collection(db, "results", studentId, phaseName)
        const phaseSnap = await getDocs(phaseRef)
        
        if (!phaseSnap.empty) {
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            const isCompleted = examData.isCompleted !== false && examData.completed !== false
            if (isCompleted && examData.subject) {
              evaluations.push({
                ...examData,
                examId: doc.id,
                phase: phase,
              })
            }
          })
        }
      } catch (error: any) {
        logger.warn(`⚠️ Error buscando en fase ${phaseName}:`, error.message)
      }
    }

    return evaluations
  }

  // Verificar fases disponibles cuando se selecciona un estudiante
  useEffect(() => {
    const checkPhases = async () => {
      if (!selectedStudent) {
        setAvailablePhases([])
        setPhaseStatus({ first: false, second: false, third: false })
        setIsCheckingPhases(false)
        return
      }

      const studentId = selectedStudent.id || selectedStudent.uid
      if (!studentId) {
        setIsCheckingPhases(false)
        return
      }

      setIsCheckingPhases(true)
      setAvailablePhases([])
      setPhaseStatus({ first: false, second: false, third: false })

      try {
        // Verificar todas las fases en paralelo para mejorar el rendimiento
        const phaseChecks = await Promise.all(
          (['first', 'second', 'third'] as const).map(async (phase) => {
            try {
              const evaluations = await getPhaseEvaluations(studentId, phase)
              
              // Normalizar materias de las evaluaciones completadas
              const completedSubjectsSet = new Set<string>()
              evaluations.forEach(evalData => {
                const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
                if (subject && ALL_SUBJECTS.includes(subject)) {
                  completedSubjectsSet.add(subject)
                }
              })

              // Verificar si tiene las 7 materias requeridas
              const hasAllRequiredSubjects = ALL_SUBJECTS.every(subject => 
                completedSubjectsSet.has(subject)
              )

              return {
                phase,
                isComplete: hasAllRequiredSubjects && completedSubjectsSet.size >= 7
              }
            } catch (error) {
              logger.error(`Error verificando ${phase}:`, error)
              return { phase, isComplete: false }
            }
          })
        )

        const phases: Array<'first' | 'second' | 'third'> = []
        const status = { first: false, second: false, third: false }

        phaseChecks.forEach(({ phase, isComplete }) => {
          if (isComplete) {
            phases.push(phase)
            status[phase] = true
          }
        })

        setAvailablePhases(phases)
        setPhaseStatus(status)
      } catch (error) {
        logger.error('Error verificando fases:', error)
      } finally {
        setIsCheckingPhases(false)
      }
    }

    checkPhases()
  }, [selectedStudent])

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student)
    setSelectedPhases([])
    setIsPhaseDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsPhaseDialogOpen(false)
    setSelectedPhases([])
    setSelectedStudent(null)
    // No limpiar generatingPDFStudentId aquí porque el PDF puede seguir generándose
  }

  const handlePhaseToggle = (phase: 'first' | 'second' | 'third') => {
    setSelectedPhases(prev => {
      if (prev.includes(phase)) {
        return prev.filter(p => p !== phase)
      } else {
        return [...prev, phase]
      }
    })
  }

  const handleSelectAllPhases = () => {
    if (selectedPhases.length === availablePhases.length) {
      setSelectedPhases([])
    } else {
      setSelectedPhases([...availablePhases])
    }
  }

  // Función helper para calcular métricas de una fase específica
  const calculatePhaseMetrics = (evaluations: any[]): {
    globalScore: number
    phasePercentage: number
    averageTimePerQuestion: number
    fraudAttempts: number
    luckPercentage: number
    completedSubjects: number
    totalQuestions: number
  } => {
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

    const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
    const POINTS_PER_NATURALES_SUBJECT = 100 / 3
    const POINTS_PER_REGULAR_SUBJECT = 100
    const TOTAL_SUBJECTS = 7

    let totalTimeFromQuestions = 0
    let totalQuestionsWithTime = 0
    let luckAnswers = 0
    let totalAnswersWithTime = 0
    let fraudAttempts = 0
    let totalQuestions = 0

    const subjectScores: { [key: string]: { percentage: number } } = {}
    const completedSubjectsSet = new Set<string>()

    evaluations.forEach(evalData => {
      const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
      
      let percentage = 0
      if (evalData.score?.overallPercentage !== undefined) {
        percentage = evalData.score.overallPercentage
      } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
        const total = evalData.score.totalQuestions
        const correct = evalData.score.correctAnswers
        percentage = total > 0 ? (correct / total) * 100 : 0
        totalQuestions += total
      } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
        const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length
        const total = evalData.questionDetails.length
        percentage = total > 0 ? (correct / total) * 100 : 0
        totalQuestions += total
      }

      if (!subjectScores[subject] || percentage > subjectScores[subject].percentage) {
        subjectScores[subject] = { percentage }
      }

      const validSubjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      if (validSubjects.includes(subject)) {
        completedSubjectsSet.add(subject)
      }

      if (evalData.questionDetails && Array.isArray(evalData.questionDetails)) {
        evalData.questionDetails.forEach((question: any) => {
          if (question.timeSpent && question.timeSpent > 0) {
            totalTimeFromQuestions += question.timeSpent
            totalQuestionsWithTime++
            
            if (question.answered && subject !== 'Inglés') {
              totalAnswersWithTime++
              if (question.timeSpent < 10) {
                luckAnswers++
              }
            }
          }
        })
      }

      if ((evalData.tabChangeCount ?? 0) > 0 || evalData.lockedByTabChange === true) {
        fraudAttempts++
      }
    })

    let globalScore = 0
    Object.entries(subjectScores).forEach(([subject, data]) => {
      let pointsForSubject: number
      if (NATURALES_SUBJECTS.includes(subject)) {
        pointsForSubject = (data.percentage / 100) * POINTS_PER_NATURALES_SUBJECT
      } else {
        pointsForSubject = (data.percentage / 100) * POINTS_PER_REGULAR_SUBJECT
      }
      globalScore += pointsForSubject
    })
    globalScore = Math.round(globalScore)

    const phasePercentage = Math.round((completedSubjectsSet.size / TOTAL_SUBJECTS) * 100)
    const averageTimePerQuestion = totalQuestionsWithTime > 0 
      ? (totalTimeFromQuestions / totalQuestionsWithTime) / 60 
      : 0
    const luckPercentage = totalAnswersWithTime > 0 
      ? Math.round((luckAnswers / totalAnswersWithTime) * 100) 
      : 0

    return {
      globalScore,
      phasePercentage,
      averageTimePerQuestion,
      fraudAttempts,
      luckPercentage,
      completedSubjects: completedSubjectsSet.size,
      totalQuestions
    }
  }

  const calculatePercentile = (score: number): number => {
    if (score >= 90) return 95
    if (score >= 85) return 90
    if (score >= 80) return 85
    if (score >= 75) return 78
    if (score >= 70) return 70
    if (score >= 65) return 62
    if (score >= 60) return 55
    if (score >= 55) return 47
    if (score >= 50) return 40
    if (score >= 45) return 33
    if (score >= 40) return 27
    if (score >= 35) return 20
    if (score >= 30) return 15
    return Math.max(5, Math.round(score / 2))
  }

  const calculateStudentGlobalScoreForPhase = async (studentId: string, phase: 'first' | 'second' | 'third'): Promise<number> => {
    try {
      const evaluations = await getPhaseEvaluations(studentId, phase)
      
      if (evaluations.length === 0) {
        return 0
      }

      const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
      const POINTS_PER_NATURALES_SUBJECT = 100 / 3
      const POINTS_PER_REGULAR_SUBJECT = 100

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

      const subjectScores: { [subject: string]: number } = {}

      evaluations.forEach(evalData => {
        const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
        
        let percentage = 0
        if (evalData.score?.overallPercentage !== undefined) {
          percentage = evalData.score.overallPercentage
        } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
          const total = evalData.score.totalQuestions
          const correct = evalData.score.correctAnswers
          percentage = total > 0 ? (correct / total) * 100 : 0
        } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
          const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length
          const total = evalData.questionDetails.length
          percentage = total > 0 ? (correct / total) * 100 : 0
        }

        if (!subjectScores[subject] || percentage > subjectScores[subject]) {
          subjectScores[subject] = percentage
        }
      })

      let globalScore = 0
      
      Object.entries(subjectScores).forEach(([subject, percentage]) => {
        let pointsForSubject: number
        if (NATURALES_SUBJECTS.includes(subject)) {
          pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
        } else {
          pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT
        }
        
        globalScore += pointsForSubject
      })

      return Math.round(globalScore * 100) / 100
    } catch (error) {
      logger.error('Error calculando puntaje del estudiante para fase:', error)
      return 0
    }
  }

  // Importar funciones de generación de PDF desde promedio.tsx
  // Por ahora, vamos a usar una versión simplificada que llama a las funciones originales
  const handleExportPDF = async (studentId: string, phase: 'first' | 'second' | 'third', keepDialogOpen: boolean = false, isBulkDownload: boolean = false) => {
    if (!keepDialogOpen && !isBulkDownload) {
      setIsPhaseDialogOpen(false)
    }
    
    if (!isBulkDownload) {
      setIsGeneratingPDF(true)
      setGeneratingPDFStudentId(studentId)
    }

    try {
      const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III'
      
      // Obtener el resumen desde Firestore
      let summaryResult = await studentSummaryService.getSummary(studentId, phase)
      
      // Si no existe, intentar generarlo automáticamente
      if (!summaryResult.success || !summaryResult.data) {
        notifySuccess({
          title: 'Generando resumen',
          message: `El resumen de ${phaseName} no existe. Generándolo ahora, por favor espera...`
        })

        const generateResult = await studentSummaryService.generateSummary(studentId, phase, false)
        
        if (!generateResult.success || !generateResult.data) {
            const errorMsg = generateResult.success === false && 'error' in generateResult 
              ? generateResult.error.message 
              : `No se pudo generar el resumen académico de ${phaseName}. Asegúrate de que el estudiante haya completado las 7 evaluaciones requeridas.`
            
            if (!isBulkDownload) {
              notifyError({
                title: 'Error al generar resumen',
                message: errorMsg
              })
              setIsGeneratingPDF(false)
            }
            throw new Error(errorMsg)
          }

        summaryResult = { success: true, data: generateResult.data }
      }

      if (!summaryResult.success || !summaryResult.data) {
          notifyError({
            title: 'Resumen no disponible',
            message: `No se encontró un resumen académico para ${phaseName}.`
          })
          if (!isBulkDownload) {
            setIsGeneratingPDF(false)
          }
          throw new Error(`Resumen no disponible para ${phaseName}`)
        }

      const summary = summaryResult.data

      // Obtener evaluaciones de la fase
      const evaluations = await getPhaseEvaluations(studentId, phase)
      const phaseMetrics = calculatePhaseMetrics(evaluations)
      const isPhase3 = phase === 'third'

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

      // Calcular puntajes por materia
      const subjectScores: { [key: string]: { score: number; percentage: number } } = {}
      evaluations.forEach(evalData => {
        const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
        let percentage = 0
        
        if (evalData.score?.overallPercentage !== undefined) {
          percentage = evalData.score.overallPercentage
        } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
          const total = evalData.score.totalQuestions
          const correct = evalData.score.correctAnswers
          percentage = total > 0 ? (correct / total) * 100 : 0
        } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
          const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length
          const total = evalData.questionDetails.length
          percentage = total > 0 ? (correct / total) * 100 : 0
        }

        if (!subjectScores[subject] || percentage > subjectScores[subject].percentage) {
          subjectScores[subject] = {
            score: Math.round(percentage),
            percentage: percentage
          }
        }
      })

      // Calcular posiciones por materia (solo para Fase III)
      const subjectRanks: { [subjectName: string]: { position: number; totalStudents: number } } = {}
      if (isPhase3) {
        try {
          const userResult = await getUserById(studentId)
          if (userResult.success && userResult.data) {
            const studentData = userResult.data as any
            const institutionId = studentData.inst || studentData.institutionId
            const campusId = studentData.campus || studentData.campusId
            const gradeId = studentData.grade || studentData.gradeId

            if (institutionId && campusId && gradeId) {
              const studentsResult = await getFilteredStudents({
                institutionId,
                campusId,
                gradeId,
                isActive: true
              })

              if (studentsResult.success && studentsResult.data) {
                const classmates = studentsResult.data
                
                for (const [subjectName] of Object.entries(subjectScores)) {
                  const studentScores: { studentId: string; score: number }[] = []
                  
                  for (const classmate of classmates) {
                    const classmateId = (classmate as any).id || (classmate as any).uid
                    if (classmateId) {
                      try {
                        const classmateEvals = await getPhaseEvaluations(classmateId, phase)
                        const classmateSubjectScores: { [key: string]: number } = {}
                        
                        classmateEvals.forEach(evalData => {
                          const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
                          if (subject === subjectName) {
                            let percentage = 0
                            if (evalData.score?.overallPercentage !== undefined) {
                              percentage = evalData.score.overallPercentage
                            } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
                              const total = evalData.score.totalQuestions
                              const correct = evalData.score.correctAnswers
                              percentage = total > 0 ? (correct / total) * 100 : 0
                            } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
                              const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length
                              const total = evalData.questionDetails.length
                              percentage = total > 0 ? (correct / total) * 100 : 0
                            }
                            
                            if (!classmateSubjectScores[subject] || percentage > classmateSubjectScores[subject]) {
                              classmateSubjectScores[subject] = percentage
                            }
                          }
                        })
                        
                        if (classmateSubjectScores[subjectName]) {
                          studentScores.push({ studentId: classmateId, score: classmateSubjectScores[subjectName] })
                        }
                      } catch (error) {
                        // Continuar con el siguiente estudiante
                      }
                    }
                  }
                  
                  studentScores.sort((a, b) => b.score - a.score)
                  const currentStudentIndex = studentScores.findIndex(s => s.studentId === studentId)
                  
                  if (currentStudentIndex !== -1) {
                    subjectRanks[subjectName] = {
                      position: currentStudentIndex + 1,
                      totalStudents: classmates.length
                    }
                  } else {
                    subjectRanks[subjectName] = {
                      position: 0,
                      totalStudents: classmates.length
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.error('Error calculando posiciones por materia:', error)
        }
      }

      // Ordenar materias
      const subjectOrder = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      const sortedSubjects = subjectOrder.filter(subj => subjectScores[subj]).map(subj => {
        const rankInfo = subjectRanks[subj]
        return {
          name: subj,
          ...subjectScores[subj],
          percentile: calculatePercentile(subjectScores[subj].percentage),
          position: rankInfo?.position || null,
          totalStudentsInSubject: rankInfo?.totalStudents || null
        }
      })

      // Calcular puntaje global
      const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
      const POINTS_PER_NATURALES_SUBJECT = 100 / 3
      const POINTS_PER_REGULAR_SUBJECT = 100
      let globalScore = 0
      
      sortedSubjects.forEach(({ name, percentage }) => {
        let pointsForSubject: number
        if (NATURALES_SUBJECTS.includes(name)) {
          pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
        } else {
          pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT
        }
        globalScore += pointsForSubject
      })

      globalScore = Math.round(globalScore)
      const globalPercentile = calculatePercentile((globalScore / 500) * 100)

      // Crear ventana para PDF
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        notifyError({
          title: 'Error',
          message: 'No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes.'
        })
        setIsGeneratingPDF(false)
        return
      }

      // Obtener datos del estudiante (nombre, documento e institución)
      const userResult = await getUserById(studentId)
      let studentName = 'Estudiante'
      let studentIdNumber = studentId
      let pdfInstitutionName = ''
      if (userResult.success && userResult.data) {
        const userData = userResult.data as any
        studentName = userData.name || 'Estudiante'
        studentIdNumber = userData.idNumber || userData.identification || studentId
        const institutionId = userData.inst || userData.institutionId
        if (institutionId) {
          const instResult = await getInstitutionById(institutionId)
          if (instResult.success && instResult.data?.name) {
            pdfInstitutionName = instResult.data.name
          }
        }
      }

      const currentDate = new Date()

      // Calcular puesto del estudiante
      let pdfStudentRank: number | null = null
      let pdfTotalStudents: number | null = null
      
      try {
        const userResult = await getUserById(studentId)
        if (userResult.success && userResult.data) {
          const studentData = userResult.data as any
          const institutionId = studentData.inst || studentData.institutionId
          const campusId = studentData.campus || studentData.campusId
          const gradeId = studentData.grade || studentData.gradeId

          if (institutionId && campusId && gradeId) {
            const studentsResult = await getFilteredStudents({
              institutionId,
              campusId,
              gradeId,
              isActive: true
            })

            if (studentsResult.success && studentsResult.data) {
              const classmates = studentsResult.data
              const studentScores: { studentId: string; score: number }[] = []
              
              for (const classmate of classmates) {
                const classmateId = (classmate as any).id || (classmate as any).uid
                if (classmateId) {
                  try {
                    const score = await calculateStudentGlobalScoreForPhase(classmateId, phase)
                    if (score > 0) {
                      studentScores.push({ studentId: classmateId, score })
                    }
                  } catch (error) {
                    // Continuar con el siguiente estudiante
                  }
                }
              }

              studentScores.sort((a, b) => b.score - a.score)
              const currentStudentIndex = studentScores.findIndex(s => s.studentId === studentId)
              if (currentStudentIndex !== -1) {
                pdfStudentRank = currentStudentIndex + 1
                pdfTotalStudents = classmates.length
              } else {
                pdfTotalStudents = classmates.length
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error calculando puesto para PDF:', error)
      }

      // Para Fase III, obtener datos de fases anteriores
      let phase1SubjectsData: Array<{ name: string; percentage: number }> | undefined = undefined
      let phase2SubjectsData: Array<{ name: string; percentage: number }> | undefined = undefined
      
      if (isPhase3) {
        try {
          const phase1Evals = await getPhaseEvaluations(studentId, 'first')
          const phase1Scores: { [key: string]: number } = {}
          
          phase1Evals.forEach(evalData => {
            const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
            let percentage = 0
            if (evalData.score?.overallPercentage !== undefined) {
              percentage = evalData.score.overallPercentage
            } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
              const total = evalData.score.totalQuestions
              const correct = evalData.score.correctAnswers
              percentage = total > 0 ? (correct / total) * 100 : 0
            }
            if (!phase1Scores[subject] || percentage > phase1Scores[subject]) {
              phase1Scores[subject] = percentage
            }
          })
          
          phase1SubjectsData = subjectOrder.filter(subj => phase1Scores[subj]).map(subj => ({
            name: subj,
            percentage: phase1Scores[subj]
          }))
        } catch (error) {
          // Si hay error, continuar sin datos de Fase I
        }

        try {
          const phase2Evals = await getPhaseEvaluations(studentId, 'second')
          const phase2Scores: { [key: string]: number } = {}
          
          phase2Evals.forEach(evalData => {
            const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '')
            let percentage = 0
            if (evalData.score?.overallPercentage !== undefined) {
              percentage = evalData.score.overallPercentage
            } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
              const total = evalData.score.totalQuestions
              const correct = evalData.score.correctAnswers
              percentage = total > 0 ? (correct / total) * 100 : 0
            }
            if (!phase2Scores[subject] || percentage > phase2Scores[subject]) {
              phase2Scores[subject] = percentage
            }
          })
          
          phase2SubjectsData = subjectOrder.filter(subj => phase2Scores[subj]).map(subj => ({
            name: subj,
            percentage: phase2Scores[subj]
          }))
        } catch (error) {
          // Si hay error, continuar sin datos de Fase II
        }
      }

      // Importar funciones de generación de HTML desde promedio.tsx
      const { 
        generatePhase3PDFHTML, 
        generatePhase1And2PDFHTML
      } = await import('@/pages/promedio')
      
      const pdfHTML = isPhase3 
        ? generatePhase3PDFHTML(summary, studentName, studentIdNumber, pdfInstitutionName || 'No especificada', currentDate, sortedSubjects, globalScore, globalPercentile, phase1SubjectsData, phase2SubjectsData, phaseMetrics, pdfStudentRank, pdfTotalStudents)
        : generatePhase1And2PDFHTML(summary, studentName, studentIdNumber, pdfInstitutionName || 'No especificada', currentDate, phaseName, phaseMetrics, pdfStudentRank, pdfTotalStudents, sortedSubjects)

      printWindow.document.write(pdfHTML)
      printWindow.document.close()

      // Solo mostrar notificación si no se está manteniendo el diálogo abierto
      // (para múltiples fases, la notificación final se mostrará en handleExportSelectedPhases)
      // Y no mostrar en descarga masiva (se mostrará resumen al final)
      if (!keepDialogOpen && !isBulkDownload) {
        notifySuccess({
          title: 'PDF generado',
          message: 'El resumen académico se abrirá en una nueva ventana para imprimir o guardar como PDF.'
        })
      }
    } catch (error: any) {
      logger.error('Error generando PDF:', error)
      if (!isBulkDownload) {
        notifyError({
          title: 'Error',
          message: error.message || 'Error al generar el PDF. Por favor, inténtalo de nuevo.'
        })
      }
      throw error // Re-lanzar para que la descarga masiva pueda manejarlo
    } finally {
      if (!isBulkDownload) {
        setIsGeneratingPDF(false)
        // Solo limpiar generatingPDFStudentId si no hay más fases pendientes
        // Esto se manejará en handleExportSelectedPhases
      }
    }
  }

  const handleExportSelectedPhases = async () => {
    if (selectedPhases.length === 0) {
      notifyError({
        title: 'No hay fases seleccionadas',
        message: 'Por favor, selecciona al menos una fase para descargar.'
      })
      return
    }

    if (!selectedStudent) {
      notifyError({
        title: 'Error',
        message: 'No se ha seleccionado un estudiante.'
      })
      return
    }

    const studentId = selectedStudent.id || selectedStudent.uid
    if (!studentId) {
      notifyError({
        title: 'Error',
        message: 'No se pudo identificar al estudiante.'
      })
      return
    }

    // Cerrar el diálogo solo si hay una fase, para múltiples fases lo cerraremos al final
    if (selectedPhases.length === 1) {
      setIsPhaseDialogOpen(false)
    }
    
    setIsGeneratingPDF(true)
    setGeneratingPDFStudentId(studentId)

    try {
      // Descargar cada fase seleccionada
      for (let i = 0; i < selectedPhases.length; i++) {
        const phase = selectedPhases[i]
        const isLast = i === selectedPhases.length - 1
        
        // Para la última fase, no mantener el diálogo abierto
        await handleExportPDF(studentId, phase, false)
        
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      }

      const phaseNames = selectedPhases.map(p => 
        p === 'first' ? 'Fase I' : p === 'second' ? 'Fase II' : 'Fase III'
      ).join(', ')

      // Cerrar el diálogo y limpiar el estado después de completar todas las fases
      setIsPhaseDialogOpen(false)
      setSelectedPhases([])
      setSelectedStudent(null)

      notifySuccess({
        title: 'Descarga completada',
        message: `Se descargaron ${selectedPhases.length} fase(s): ${phaseNames}`
      })
    } catch (error: any) {
      logger.error('Error descargando fases seleccionadas:', error)
      notifyError({
        title: 'Error',
        message: 'Hubo un error al descargar algunas fases. Intenta descargarlas nuevamente.'
      })
      // Cerrar el diálogo incluso si hay error
      setIsPhaseDialogOpen(false)
      setSelectedPhases([])
    } finally {
      setIsGeneratingPDF(false)
      setGeneratingPDFStudentId(null)
    }
  }

  // Función para descarga masiva por grado con control de ventanas y procesamiento en lotes
  const handleBulkDownloadPhases = async () => {
    if (bulkSelectedPhases.length === 0) {
      notifyError({
        title: 'No hay fases seleccionadas',
        message: 'Por favor, selecciona al menos una fase para descargar.'
      })
      return
    }

    const studentsList = selectedGradeForBulk?.students || []

    if (studentsList.length === 0) {
      notifyError({
        title: 'Error',
        message: 'No se han seleccionado estudiantes para descargar.'
      })
      return
    }

    setIsBulkGenerating(true)
    setIsBulkCancelled(false)
    setIsBulkDownloadDialogOpen(false)
    
    const totalStudents = studentsList.length
    const totalPDFs = totalStudents * bulkSelectedPhases.length
    const MAX_CONCURRENT_WINDOWS = 5 // Máximo de ventanas abiertas simultáneamente
    const BATCH_SIZE = 3 // Procesar en lotes de 3 PDFs a la vez
    const DELAY_BETWEEN_BATCHES = 2000 // 2 segundos entre lotes
    const DELAY_BETWEEN_PDFS = 500 // 500ms entre PDFs individuales

    let successCount = 0
    let errorCount = 0
    let completedPDFs = 0
    const startTime = Date.now()
    const openWindows: Window[] = []

    setBulkProgress({
      current: 0,
      total: totalPDFs,
      currentStudent: '',
      successCount: 0,
      errorCount: 0,
      estimatedTimeRemaining: 0
    })

    try {
      // Crear cola de tareas: [estudiante, fase]
      const tasks: Array<{ student: any, phase: 'first' | 'second' | 'third' }> = []
      studentsList.forEach(student => {
        bulkSelectedPhases.forEach(phase => {
          tasks.push({ student, phase })
        })
      })

      // Procesar en lotes
      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        // Verificar si se canceló
        if (isBulkCancelled) {
          break
        }

        const batch = tasks.slice(i, i + BATCH_SIZE)
        const batchPromises: Promise<void>[] = []

        // Procesar cada tarea en el lote
        for (const task of batch) {
          const studentId = task.student.id || task.student.uid
          const studentName = task.student.name || 'Sin nombre'
          
          if (!studentId) {
            errorCount++
            completedPDFs++
            continue
          }

          // Crear promesa para procesar este PDF
          const pdfPromise = (async () => {
            // Actualizar progreso antes de procesar
            setBulkProgress(prev => ({
              ...prev,
              currentStudent: studentName
            }))

            try {
              // Llamar a handleExportPDF para generar el PDF real
              await handleExportPDF(studentId, task.phase, true, true)
              
              successCount++
              completedPDFs++
              
              setBulkProgress(prev => {
                const elapsed = (Date.now() - startTime) / 1000 // segundos
                const rate = completedPDFs > 0 ? elapsed / completedPDFs : 0 // segundos por PDF
                const remaining = prev.total - completedPDFs
                const estimatedSeconds = rate * remaining

                return {
                  ...prev,
                  successCount: successCount,
                  current: completedPDFs,
                  estimatedTimeRemaining: Math.round(estimatedSeconds)
                }
              })
            } catch (error) {
              logger.error(`Error generando PDF para ${studentName} - ${task.phase}:`, error)
              errorCount++
              completedPDFs++
              
              setBulkProgress(prev => {
                const elapsed = (Date.now() - startTime) / 1000 // segundos
                const rate = completedPDFs > 0 ? elapsed / completedPDFs : 0 // segundos por PDF
                const remaining = prev.total - completedPDFs
                const estimatedSeconds = rate * remaining

                return {
                  ...prev,
                  errorCount: errorCount,
                  current: completedPDFs,
                  estimatedTimeRemaining: Math.round(estimatedSeconds)
                }
              })
            }
          })()

          batchPromises.push(pdfPromise)
          
          // Pequeña pausa entre PDFs individuales
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PDFS))
        }

        // Esperar a que termine el lote
        await Promise.allSettled(batchPromises)

        // Limitar ventanas abiertas - cerrar las más antiguas si excedemos el límite
        while (openWindows.length > MAX_CONCURRENT_WINDOWS) {
          const oldestWindow = openWindows.shift()
          if (oldestWindow && !oldestWindow.closed) {
            oldestWindow.close()
          }
        }

        // Pausa entre lotes (excepto en el último)
        if (i + BATCH_SIZE < tasks.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }

      // Cerrar todas las ventanas abiertas al finalizar (opcional, comentado para que el usuario las cierre manualmente)
      // openWindows.forEach(w => { if (!w.closed) w.close() })

      // Mostrar resumen final
      const phaseNames = bulkSelectedPhases.map(p => 
        p === 'first' ? 'Fase I' : p === 'second' ? 'Fase II' : 'Fase III'
      ).join(', ')

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)

      if (isBulkCancelled) {
        notifyError({
          title: 'Descarga cancelada',
          message: `Se canceló la descarga. Se generaron ${successCount} PDF(s) de ${completedPDFs} intentados.`
        })
      } else if (errorCount === 0) {
        notifySuccess({
          title: 'Descarga masiva completada',
          message: `Se generaron ${successCount} PDF(s) para ${totalStudents} estudiante(s). Fases: ${phaseNames}. Tiempo: ${elapsedTime}s`
        })
      } else {
        notifyError({
          title: 'Descarga masiva parcial',
          message: `Se generaron ${successCount} PDF(s) exitosamente, pero hubo ${errorCount} error(es). Tiempo: ${elapsedTime}s`
        })
      }
    } catch (error: any) {
      logger.error('Error en descarga masiva:', error)
      notifyError({
        title: 'Error',
        message: 'Hubo un error durante la descarga masiva. Algunos PDFs pueden haberse generado correctamente.'
      })
    } finally {
      setIsBulkGenerating(false)
      setBulkProgress({ 
        current: 0, 
        total: 0, 
        currentStudent: '',
        successCount: 0,
        errorCount: 0,
        estimatedTimeRemaining: 0
      })
      if (!isBulkCancelled) {
        setSelectedGradeForBulk(null)
      }
      setBulkSelectedPhases([])
    }
  }

  const handleBulkPhaseToggle = (phase: 'first' | 'second' | 'third') => {
    setBulkSelectedPhases(prev => {
      if (prev.includes(phase)) {
        return prev.filter(p => p !== phase)
      } else {
        return [...prev, phase]
      }
    })
  }

  const handleBulkSelectAllPhases = () => {
    const allPhases: Array<'first' | 'second' | 'third'> = ['first', 'second', 'third']
    if (bulkSelectedPhases.length === allPhases.length) {
      setBulkSelectedPhases([])
    } else {
      setBulkSelectedPhases(allPhases)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Resúmenes de Fase PDF
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Descarga los resúmenes académicos en PDF de cualquier estudiante
          </p>
        </div>
      </div>

      {/* Filtros de búsqueda */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Buscar Estudiante
          </CardTitle>
          <CardDescription>
            Busca por nombre, email o número de identificación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                <Input
                  placeholder="Buscar estudiante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn("pl-10", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : '')}
                />
              </div>
            </div>
            {institutions.length > 0 && (
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger className={cn("w-[250px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : '')}>
                  <SelectValue placeholder="Todas las instituciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las instituciones</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de estudiantes */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Estudiantes
              </CardTitle>
              <CardDescription>
                {totalStudentsCount} estudiante(s) encontrado(s) agrupados por institución, año, sede y grado
              </CardDescription>
            </div>
            {totalStudentsCount > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={collapseAll}
                  className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
                >
                  Colapsar todo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => expandAllInLevel('institution')}
                  className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
                >
                  Expandir instituciones
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => expandAllInLevel('grade')}
                  className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
                >
                  Expandir todo
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : totalStudentsCount === 0 ? (
            <div className="text-center py-12">
              <User className={cn("h-12 w-12 mx-auto mb-4 opacity-50", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
              <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                No se encontraron estudiantes
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {Object.values(groupedStudents).map((institution) => {
                const institutionKey = institution.institutionId
                const isInstitutionExpanded = expandedSections.has(institutionKey)

                return (
                  <div
                    key={institutionKey}
                    className={cn(
                      "rounded-lg border",
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    {/* Header de Institución */}
                    <div
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer transition-colors",
                        theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'
                      )}
                      onClick={() => toggleSection(institutionKey)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {isInstitutionExpanded ? (
                          <ChevronDown className={cn("h-5 w-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        ) : (
                          <ChevronRight className={cn("h-5 w-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        )}
                        <Building className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                        <div>
                          <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {institution.institutionName}
                          </p>
                          <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {Object.values(institution.years).reduce((acc, year) => 
                              acc + Object.values(year.campuses).reduce((acc2, campus) => 
                                acc2 + Object.values(campus.grades).reduce((acc3, grade) => 
                                  acc3 + grade.students.length, 0), 0), 0
                            )} estudiante(s)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Años dentro de la institución */}
                    {isInstitutionExpanded && (
                      <div className="pl-4 pr-4 pb-4 space-y-2">
                        {Object.values(institution.years).map((yearData) => {
                          const yearKey = `${institutionKey}-${yearData.year}`
                          const isYearExpanded = expandedSections.has(yearKey)

                          return (
                            <div
                              key={yearKey}
                              className={cn(
                                "rounded-lg border",
                                theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-gray-200 bg-white'
                              )}
                            >
                              {/* Header de Año */}
                              <div
                                className={cn(
                                  "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                  theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'
                                )}
                                onClick={() => toggleSection(yearKey)}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  {isYearExpanded ? (
                                    <ChevronDown className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                  ) : (
                                    <ChevronRight className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                  )}
                                  <Calendar className={cn("h-4 w-4", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                                  <div>
                                    <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      Año {yearData.year}
                                    </p>
                                    <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                      {Object.values(yearData.campuses).reduce((acc, campus) => 
                                        acc + Object.values(campus.grades).reduce((acc2, grade) => 
                                          acc2 + grade.students.length, 0), 0
                                      )} estudiante(s)
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Sedes dentro del año */}
                              {isYearExpanded && (
                                <div className="pl-4 pr-4 pb-3 space-y-2">
                                  {Object.values(yearData.campuses).map((campus) => {
                                    const campusKey = `${yearKey}-${campus.campusId}`
                                    const isCampusExpanded = expandedSections.has(campusKey)

                                    return (
                                      <div
                                        key={campusKey}
                                        className={cn(
                                          "rounded-lg border",
                                          theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-200 bg-gray-50'
                                        )}
                                      >
                                        {/* Header de Sede */}
                                        <div
                                          className={cn(
                                            "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                            theme === 'dark' ? 'hover:bg-zinc-600' : 'hover:bg-gray-100'
                                          )}
                                          onClick={() => toggleSection(campusKey)}
                                        >
                                          <div className="flex items-center gap-3 flex-1">
                                            {isCampusExpanded ? (
                                              <ChevronDown className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                            ) : (
                                              <ChevronRight className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                            )}
                                            <MapPin className={cn("h-4 w-4", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                                            <div>
                                              <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                                {campus.campusName}
                                              </p>
                                              <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                                {Object.values(campus.grades).reduce((acc, grade) => 
                                                  acc + grade.students.length, 0
                                                )} estudiante(s)
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Grados dentro de la sede */}
                                        {isCampusExpanded && (
                                          <div className="pl-4 pr-4 pb-3 space-y-2">
                                            {Object.values(campus.grades).map((grade) => {
                                              const gradeKey = `${campusKey}-${grade.gradeId}`
                                              const isGradeExpanded = expandedSections.has(gradeKey)

                                              return (
                                                <div
                                                  key={gradeKey}
                                                  className={cn(
                                                    "rounded-lg border",
                                                    theme === 'dark' ? 'border-zinc-600 bg-zinc-700/30' : 'border-gray-200 bg-white'
                                                  )}
                                                >
                                                  {/* Header de Grado */}
                                                  <div
                                                    className={cn(
                                                      "flex items-center justify-between p-3 transition-colors",
                                                      theme === 'dark' ? 'hover:bg-zinc-600' : 'hover:bg-gray-100'
                                                    )}
                                                  >
                                                    <div 
                                                      className="flex items-center gap-3 flex-1 cursor-pointer"
                                                      onClick={() => toggleSection(gradeKey)}
                                                    >
                                                      {isGradeExpanded ? (
                                                        <ChevronDown className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                                      ) : (
                                                        <ChevronRight className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                                      )}
                                                      <GraduationCap className={cn("h-4 w-4", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
                                                      <div>
                                                        <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                                          {grade.gradeName}
                                                        </p>
                                                        <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                                          {grade.students.length} estudiante(s)
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedGradeForBulk({
                                                          students: grade.students,
                                                          gradeName: grade.gradeName,
                                                          gradeId: grade.gradeId
                                                        })
                                                        setBulkSelectedPhases([])
                                                        setIsBulkDownloadDialogOpen(true)
                                                      }}
                                                      disabled={isBulkGenerating || isGeneratingPDF}
                                                      className={cn(
                                                        "ml-2 gap-2",
                                                        theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '',
                                                        (isBulkGenerating || isGeneratingPDF) && 'opacity-50 cursor-not-allowed'
                                                      )}
                                                    >
                                                      <Download className="h-3 w-3" />
                                                      <span className="text-xs">Descargar PDFs</span>
                                                    </Button>
                                                  </div>

                                                  {/* Lista de estudiantes dentro del grado */}
                                                  {isGradeExpanded && (
                                                    <div className="pl-4 pr-4 pb-3 space-y-2">
                                                      {grade.students.map((student: any) => (
                                                        <div
                                                          key={student.id || student.uid}
                                                          className={cn(
                                                            "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                                                            theme === 'dark' 
                                                              ? 'border-zinc-600 bg-zinc-800/50 hover:bg-zinc-800' 
                                                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
                                                            selectedStudent?.id === student.id && 'ring-2 ring-blue-500'
                                                          )}
                                                          onClick={() => handleSelectStudent(student)}
                                                        >
                                                          <div className="flex items-center gap-3 flex-1">
                                                            <div className={cn(
                                                              "p-2 rounded-full",
                                                              theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200'
                                                            )}>
                                                              <User className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                              <p className={cn("font-medium text-sm truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                                                {student.name || 'Sin nombre'}
                                                              </p>
                                                              <div className="flex items-center gap-3 mt-1">
                                                                <p className={cn("text-xs truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                                                  {student.email || 'Sin email'}
                                                                </p>
                                                                {student.idNumber && (
                                                                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                                                    ID: {student.idNumber}
                                                                  </p>
                                                                )}
                                                              </div>
                                                            </div>
                                                          </div>
                                                          <Button
                                                            onClick={(e) => {
                                                              e.stopPropagation()
                                                              handleSelectStudent(student)
                                                            }}
                                                            disabled={generatingPDFStudentId === (student.id || student.uid) || isGeneratingPDF}
                                                            size="sm"
                                                            className="ml-3 min-w-[100px]"
                                                          >
                                                            {generatingPDFStudentId === (student.id || student.uid) ? (
                                                              <>
                                                                <div className="relative mr-2">
                                                                  <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin"></div>
                                                                </div>
                                                                Generando...
                                                              </>
                                                            ) : (
                                                              <>
                                                                <FileText className="h-3 w-3 mr-2" />
                                                                Ver Fases
                                                              </>
                                                            )}
                                                          </Button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para seleccionar fases */}
      <Dialog open={isPhaseDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseDialog()
        }
      }}>
        <DialogContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white', "max-w-md")}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Seleccionar Fase para PDF
            </DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {selectedStudent && (
                <span>
                  Estudiante: <strong>{selectedStudent.name || 'Sin nombre'}</strong>
                </span>
              )}
              <br />
              Selecciona una o más fases académicas para las cuales deseas generar el resumen en PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {isCheckingPhases && (
              <div className={cn(
                "flex items-center justify-center gap-2 p-4 rounded-lg border",
                theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-gray-50'
              )}>
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  Verificando fases completadas...
                </p>
              </div>
            )}

            {!isCheckingPhases && availablePhases.length > 1 && (
              <div className={cn(
                "flex items-center space-x-2 p-3 rounded-lg border",
                theme === 'dark' ? 'border-zinc-600' : 'border-gray-300'
              )}>
                <Checkbox
                  id="select-all"
                  checked={selectedPhases.length === availablePhases.length && availablePhases.length > 0}
                  onCheckedChange={handleSelectAllPhases}
                  disabled={isGeneratingPDF || availablePhases.length === 0}
                />
                <label
                  htmlFor="select-all"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || availablePhases.length === 0) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Seleccionar todas las fases ({availablePhases.length})
                </label>
              </div>
            )}

            <div className="space-y-3">
              {/* Fase I */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phaseStatus.first && "opacity-50"
              )}>
                <Checkbox
                  id="phase-first"
                  checked={selectedPhases.includes('first')}
                  onCheckedChange={() => handlePhaseToggle('first')}
                  disabled={isGeneratingPDF || isCheckingPhases || !phaseStatus.first}
                />
                <label
                  htmlFor="phase-first"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phaseStatus.first) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )} />
                  Fase I
                  {!phaseStatus.first && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                  {phaseStatus.first && (
                    <CheckCircle2 className={cn("h-4 w-4 ml-auto", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                  )}
                </label>
              </div>

              {/* Fase II */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phaseStatus.second && "opacity-50"
              )}>
                <Checkbox
                  id="phase-second"
                  checked={selectedPhases.includes('second')}
                  onCheckedChange={() => handlePhaseToggle('second')}
                  disabled={isGeneratingPDF || isCheckingPhases || !phaseStatus.second}
                />
                <label
                  htmlFor="phase-second"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phaseStatus.second) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )} />
                  Fase II
                  {!phaseStatus.second && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                  {phaseStatus.second && (
                    <CheckCircle2 className={cn("h-4 w-4 ml-auto", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                  )}
                </label>
              </div>

              {/* Fase III */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phaseStatus.third && "opacity-50"
              )}>
                <Checkbox
                  id="phase-third"
                  checked={selectedPhases.includes('third')}
                  onCheckedChange={() => handlePhaseToggle('third')}
                  disabled={isGeneratingPDF || isCheckingPhases || !phaseStatus.third}
                />
                <label
                  htmlFor="phase-third"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phaseStatus.third) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                  Fase III
                  {!phaseStatus.third && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                  {phaseStatus.third && (
                    <CheckCircle2 className={cn("h-4 w-4 ml-auto", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                  )}
                </label>
              </div>
            </div>

            {!isCheckingPhases && availablePhases.length === 0 && (
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? 'border-yellow-600 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-50'
              )}>
                <div className="flex items-center gap-2">
                  <AlertCircle className={cn("h-5 w-5", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
                  <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800')}>
                    Este estudiante no tiene resúmenes disponibles. Asegúrate de que haya completado las evaluaciones requeridas.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isGeneratingPDF || isCheckingPhases}
              className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportSelectedPhases}
              disabled={isGeneratingPDF || isCheckingPhases || selectedPhases.length === 0}
              className={cn(
                "bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]",
                (isGeneratingPDF || isCheckingPhases || selectedPhases.length === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar {selectedPhases.length > 0 ? `(${selectedPhases.length})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para descarga masiva por grado */}
      <Dialog open={isBulkDownloadDialogOpen} onOpenChange={(open) => {
        if (!open && !isBulkGenerating) {
          setIsBulkDownloadDialogOpen(false)
          setSelectedGradeForBulk(null)
          setBulkSelectedPhases([])
        }
      }}>
        <DialogContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white', "max-w-md")}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Descarga Masiva de PDFs por Grado
            </DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {selectedGradeForBulk && (
                <>
                  <span>
                    Grado: <strong>{selectedGradeForBulk.gradeName}</strong>
                  </span>
                  <br />
                  <span>
                    Estudiantes: <strong>{selectedGradeForBulk.students.length}</strong>
                  </span>
                  <br />
                  <br />
                </>
              )}
              Selecciona las fases académicas que deseas descargar para todos los estudiantes de este grado. 
              Se generarán múltiples ventanas de PDF, una por cada estudiante y fase seleccionada.
            </DialogDescription>
          </DialogHeader>
          
          {isBulkGenerating && (
            <div className={cn(
              "flex flex-col gap-3 p-4 rounded-lg border",
              theme === 'dark' ? 'border-blue-600 bg-blue-900/20' : 'border-blue-300 bg-blue-50'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                    Generando PDFs...
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsBulkCancelled(true)}
                  disabled={isBulkCancelled}
                  className={cn(
                    "text-xs",
                    theme === 'dark' ? 'border-red-600 bg-red-900/20 text-red-300 hover:bg-red-900/30' : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  )}
                >
                  Cancelar
                </Button>
              </div>
              {bulkProgress.total > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn("font-medium", theme === 'dark' ? 'text-gray-200' : 'text-gray-700')}>
                      {bulkProgress.currentStudent && `📄 ${bulkProgress.currentStudent}`}
                    </span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                      {bulkProgress.current} / {bulkProgress.total} PDFs
                    </span>
                  </div>
                  <div className={cn(
                    "h-3 rounded-full overflow-hidden",
                    theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200'
                  )}>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${Math.min((bulkProgress.current / bulkProgress.total) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className={cn(theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                        ✅ {bulkProgress.successCount} exitosos
                      </span>
                      {bulkProgress.errorCount > 0 && (
                        <span className={cn(theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                          ❌ {bulkProgress.errorCount} errores
                        </span>
                      )}
                    </div>
                    {bulkProgress.estimatedTimeRemaining > 0 && (
                      <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                        ⏱️ ~{Math.ceil(bulkProgress.estimatedTimeRemaining / 60)} min restantes
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "text-xs p-2 rounded",
                    theme === 'dark' ? 'bg-zinc-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  )}>
                    💡 <strong>Nota:</strong> Se están abriendo múltiples ventanas de PDF. Puedes cerrarlas manualmente o esperar a que finalice el proceso.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 py-4">
            {!isBulkGenerating && (
              <>
                <div className={cn(
                  "flex items-center space-x-2 p-3 rounded-lg border",
                  theme === 'dark' ? 'border-zinc-600' : 'border-gray-300'
                )}>
                  <Checkbox
                    id="bulk-select-all"
                    checked={bulkSelectedPhases.length === 3}
                    onCheckedChange={handleBulkSelectAllPhases}
                    disabled={isBulkGenerating}
                  />
                  <label
                    htmlFor="bulk-select-all"
                    className={cn(
                      "text-sm font-medium cursor-pointer flex-1",
                      theme === 'dark' ? 'text-white' : 'text-gray-900',
                      isBulkGenerating && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Seleccionar todas las fases (3)
                  </label>
                </div>

                <div className="space-y-3">
                  {/* Fase I */}
                  <div className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                    theme === 'dark' 
                      ? 'border-zinc-600 hover:bg-zinc-700/50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  )}>
                    <Checkbox
                      id="bulk-phase-first"
                      checked={bulkSelectedPhases.includes('first')}
                      onCheckedChange={() => handleBulkPhaseToggle('first')}
                      disabled={isBulkGenerating}
                    />
                    <label
                      htmlFor="bulk-phase-first"
                      className={cn(
                        "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900',
                        isBulkGenerating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Target className={cn(
                        "h-4 w-4",
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      )} />
                      Fase I
                    </label>
                  </div>

                  {/* Fase II */}
                  <div className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                    theme === 'dark' 
                      ? 'border-zinc-600 hover:bg-zinc-700/50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  )}>
                    <Checkbox
                      id="bulk-phase-second"
                      checked={bulkSelectedPhases.includes('second')}
                      onCheckedChange={() => handleBulkPhaseToggle('second')}
                      disabled={isBulkGenerating}
                    />
                    <label
                      htmlFor="bulk-phase-second"
                      className={cn(
                        "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900',
                        isBulkGenerating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Target className={cn(
                        "h-4 w-4",
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      )} />
                      Fase II
                    </label>
                  </div>

                  {/* Fase III */}
                  <div className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                    theme === 'dark' 
                      ? 'border-zinc-600 hover:bg-zinc-700/50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  )}>
                    <Checkbox
                      id="bulk-phase-third"
                      checked={bulkSelectedPhases.includes('third')}
                      onCheckedChange={() => handleBulkPhaseToggle('third')}
                      disabled={isBulkGenerating}
                    />
                    <label
                      htmlFor="bulk-phase-third"
                      className={cn(
                        "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900',
                        isBulkGenerating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Target className={cn(
                        "h-4 w-4",
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      )} />
                      Fase III
                    </label>
                  </div>
                </div>

                {bulkSelectedPhases.length > 0 && selectedGradeForBulk && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    theme === 'dark' ? 'border-purple-600 bg-purple-900/20' : 'border-purple-300 bg-purple-50'
                  )}>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-purple-300' : 'text-purple-800')}>
                      📊 Se generarán aproximadamente {selectedGradeForBulk.students.length * bulkSelectedPhases.length} PDF(s):
                      <br />
                      • {selectedGradeForBulk.students.length} estudiante(s) × {bulkSelectedPhases.length} fase(s)
                      <br />
                      <span className="text-xs opacity-75">
                        ⏱️ Tiempo estimado: ~{Math.ceil((selectedGradeForBulk.students.length * bulkSelectedPhases.length * 3) / 60)} minutos
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!isBulkGenerating) {
                  setIsBulkDownloadDialogOpen(false)
                  setSelectedGradeForBulk(null)
                  setBulkSelectedPhases([])
                }
              }}
              disabled={isBulkGenerating}
              className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBulkDownloadPhases}
              disabled={isBulkGenerating || bulkSelectedPhases.length === 0}
              className={cn(
                "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white min-w-[140px]",
                (isBulkGenerating || bulkSelectedPhases.length === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isBulkGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar {bulkSelectedPhases.length > 0 ? `(${bulkSelectedPhases.length})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
