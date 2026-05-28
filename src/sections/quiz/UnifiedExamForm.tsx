import { logger } from '@/utils/logger'
import {
  Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2,
  Timer, HelpCircle, Users, Play, Maximize, Database, X, ZoomIn, Shield,
  Calculator, BookOpen, BookMarked, Microscope, Atom, FlaskConical, BookCheck,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuthContext } from "@/context/AuthContext"
import { useQueryClient } from "@tanstack/react-query"
import { invalidateStudentEvaluationsAfterExamSave } from "@/hooks/query/useStudentEvaluations"
import { quizGeneratorService, GeneratedQuiz } from "@/services/quiz/quizGenerator.service"
import { saveExamResultsAndRegister, type ExamResultData } from "@/services/firebase/examResults.service"
import {
  validateExamPresentationGate,
  type StudentProgressSummaryPack,
} from "@/services/quiz/validateExamPresentationGate"
import { fetchStudentProgressSummaryByUserId } from "@/services/studentProgressSummary/fetchEvaluationsFromSummary"
import { usePrefetchAdjacentQuizImagesLinear } from "@/hooks/usePrefetchAdjacentQuizImages"
import { getQuizTheme, getQuizBackgroundStyle } from "@/utils/quizThemes"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import { checkPhaseAccess } from "@/utils/phaseIntegration"
import { useNotification } from "@/hooks/ui/useNotification"
import { processExamResults } from "@/utils/phaseIntegration"
import { gradeLabelToBankCode } from "@/utils/gradeMapping"
import { detectGroupedQuestions } from "@/utils/quizGroupedQuestions"
import { GroupedQuestionNotice } from "@/components/quiz/GroupedQuestionNotice"
import { QuizConnectionErrorScreen } from '@/components/quiz/QuizConnectionErrorScreen'
import { resolveQuizLoadFailureExamState } from '@/utils/networkError'
import ImageGallery from "@/components/common/ImageGallery"
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface QuestionTimeData {
  questionId: string
  timeSpent: number
  startTime: number
  endTime?: number
}

// ─── Config por materia ───────────────────────────────────────────────────────

interface SubjectConfig {
  subject: string
  themeKey: string
  Icon: React.ElementType
}

const SUBJECT_CONFIGS: Record<string, SubjectConfig> = {
  Lenguaje:            { subject: 'Lenguaje',          themeKey: 'lenguaje',      Icon: BookOpen      },
  Matemáticas:         { subject: 'Matemáticas',        themeKey: 'matemáticas',   Icon: Calculator    },
  Matematicas:         { subject: 'Matemáticas',        themeKey: 'matemáticas',   Icon: Calculator    },
  'Ciencias Sociales': { subject: 'Ciencias Sociales',  themeKey: 'sociales',      Icon: BookMarked    },
  Biologia:            { subject: 'Biologia',           themeKey: 'biología',      Icon: Microscope    },
  Física:              { subject: 'Física',             themeKey: 'física',        Icon: Atom          },
  Quimica:             { subject: 'Quimica',            themeKey: 'química',       Icon: FlaskConical  },
  Inglés:              { subject: 'Inglés',             themeKey: 'inglés',        Icon: BookCheck     },
}

const DEFAULT_CONFIG: SubjectConfig = { subject: 'General', themeKey: 'matemáticas', Icon: Brain }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripHtmlTags = (html: string): string => {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

const sanitizeHtml = (html: string): string => {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      'math','annotation','semantics','mtext','mn','mo','mi','mspace','mover','munder',
      'munderover','msup','msub','msubsup','mfrac','mroot','msqrt','mtable','mtr','mtd',
      'mlabeledtr','mrow','menclose','mstyle','mpadded','mphantom','mfenced','maction',
      'mmultiscripts','svg','path','g','line','rect','circle','use',
    ],
    ADD_ATTR: [
      'data-latex','class','style','aria-label','role','tabindex','xmlns','width','height',
      'viewBox','focusable','aria-hidden','stroke','fill','stroke-width','x','y','x1','x2',
      'y1','y2','d','transform',
    ],
  })
}

const renderMathInHtml = (html: string): string => {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('[data-latex]').forEach((el) => {
    const latex = el.getAttribute('data-latex')
    if (latex && !el.querySelector('.katex')) {
      try {
        const isDisplay = el.classList.contains('katex-display') || el.tagName === 'DIV'
        const rendered = katex.renderToString(latex, { throwOnError: false, displayMode: isDisplay, strict: false })
        if (rendered?.includes('katex')) {
          el.innerHTML = rendered
          el.classList.add('katex-formula')
          if (isDisplay) el.classList.add('katex-display')
        }
      } catch { /* silently ignore */ }
    }
  })
  return div.innerHTML
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const VALIDATION_SESSION_TTL_MS = 6 * 60 * 60 * 1000
const QUIZ_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // mismo TTL que validación

const saveExamResults = async (userId: string, examId: string, examData: ExamResultData) => {
  const result = await saveExamResultsAndRegister(userId, examId, examData)
  if (!result.success) throw result.error
  return { success: true as const, id: result.data.id }
}

// ─── Componente principal ─────────────────────────────────────────────────────

const UnifiedExamForm = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { user } = useAuthContext()
  const { theme: appTheme } = useThemeContext()
  const { notifyError } = useNotification()
  const userId = user?.uid

  const phaseParam = searchParams.get('phase') as 'first' | 'second' | 'third' | null
  const subjectParam = searchParams.get('subject') ?? ''
  const currentPhase = phaseParam ?? 'first'
  const currentSubject = subjectParam

  const subjectConfig = SUBJECT_CONFIGS[currentSubject] ?? DEFAULT_CONFIG
  const { Icon: SubjectIcon, themeKey } = subjectConfig

  const [quizData, setQuizData]   = useState<GeneratedQuiz | null>(null)
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [examState, setExamState] = useState('loading')
  const [validationChecking, setValidationChecking] = useState(false)
  const [timeLeft, setTimeLeft]   = useState(0)
  const [currentQuestion, setCurrentQuestion]       = useState(0)
  const [maxReachedQuestion, setMaxReachedQuestion] = useState(0)
  const [showWarning, setShowWarning]               = useState(false)
  const [isFullscreen, setIsFullscreen]             = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount]         = useState(0)
  const [examLocked, setExamLocked]                 = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [fullscreenExitWithTabChange, setFullscreenExitWithTabChange] = useState(false)
  const [isSubmitting, setIsSubmitting]             = useState(false)
  const [existingExamData, setExistingExamData]     = useState<unknown | null>(null)
  const [zoomedImage, setZoomedImage]               = useState<string | null>(null)
  const [groupedQuestionMessage, setGroupedQuestionMessage] = useState<{ start: number; end: number } | null>(null)

  const [questionTimeData, setQuestionTimeData]         = useState<Record<string, QuestionTimeData>>({})
  const [examStartTime, setExamStartTime]               = useState(0)
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState(0)
  const summaryPackRef = useRef<StudentProgressSummaryPack | undefined>(undefined)

  // ── Caché de validación ───────────────────────────────────────────────────

  const buildValidationCacheKey = useCallback(() => {
    if (!userId) return null
    return `quiz_validation_ok:${userId}:${currentPhase}:${currentSubject}`
  }, [userId, currentPhase, currentSubject])

  const hasRecentValidation = useCallback((key: string | null) => {
    if (!key) return false
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return false
      const ts = Number(raw)
      if (!Number.isFinite(ts)) return false
      if (Date.now() - ts > VALIDATION_SESSION_TTL_MS) { sessionStorage.removeItem(key); return false }
      return true
    } catch { return false }
  }, [])

  const markValidationAsRecent = useCallback((key: string | null) => {
    if (!key) return
    try { sessionStorage.setItem(key, String(Date.now())) } catch { /* noop */ }
  }, [])

  const clearValidationCache = useCallback((key: string | null) => {
    if (!key) return
    try { sessionStorage.removeItem(key) } catch { /* noop */ }
  }, [])

  const buildQuizCacheKey = useCallback(() => {
    if (!userId) return null
    return `quiz_data:${userId}:${currentPhase}:${currentSubject}`
  }, [userId, currentPhase, currentSubject])

  const getQuizFromCache = useCallback((key: string | null): GeneratedQuiz | null => {
    if (!key) return null
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { ts: number; quiz: GeneratedQuiz }
      if (Date.now() - parsed.ts > QUIZ_CACHE_TTL_MS) { sessionStorage.removeItem(key); return null }
      // Restaurar Date desde string
      parsed.quiz.createdAt = new Date(parsed.quiz.createdAt)
      parsed.quiz.questions = parsed.quiz.questions.map(q => ({
        ...q,
        createdAt: new Date(q.createdAt),
      }))
      return parsed.quiz
    } catch { return null }
  }, [])

  const saveQuizToCache = useCallback((key: string | null, quiz: GeneratedQuiz) => {
    if (!key) return
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), quiz })) } catch { /* noop — quota */ }
  }, [])

  const clearQuizCache = useCallback((key: string | null) => {
    if (!key) return
    try { sessionStorage.removeItem(key) } catch { /* noop */ }
  }, [])

  // ── Prefetch imágenes ─────────────────────────────────────────────────────

  usePrefetchAdjacentQuizImagesLinear(
    examState === 'active' && !!quizData?.questions?.length,
    quizData?.questions,
    currentQuestion,
  )

  // ── Carga del cuestionario ────────────────────────────────────────────────

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let isMounted = true

    const loadQuiz = async () => {
      if (!userId) return
      try {
        if (isMounted) setExamState('loading')

        // 1. Resumen del estudiante (necesario para fase y gate)
        const summaryPack = await fetchStudentProgressSummaryByUserId(userId)
        summaryPackRef.current = summaryPack
        const summary = summaryPack?.summary ?? null

        // 2. Verificar acceso a la fase — sale antes de tocar Firestore/preguntas
        const accessCheck = await checkPhaseAccess(userId, currentPhase, { summary })
        if (!accessCheck.canAccess) {
          if (isMounted) {
            setExamState('blocked')
            notifyError({ title: 'Acceso bloqueado', message: accessCheck.reason ?? 'Debes completar la fase anterior primero.' })
          }
          return
        }

        // 3. Gate ANTES de generateQuiz — evita lecturas si ya presentó
        const validationKey = buildValidationCacheKey()
        const quizCacheKey = buildQuizCacheKey()

        if (!hasRecentValidation(validationKey)) {
          setValidationChecking(true)
          try {
            // Usamos un quizId temporal para el gate pre-generación
            const tempQuizId = `pre_${userId}_${currentPhase}_${currentSubject}`
            const outcome = await validateExamPresentationGate({
              userId, phase: currentPhase, subjectLabel: currentSubject,
              quizId: tempQuizId, summaryPack: summaryPackRef.current,
            })
            if (!isMounted) return
            if (outcome.type === 'blocked') {
              clearValidationCache(validationKey)
              clearQuizCache(quizCacheKey)
              setExamState('blocked')
              notifyError({ title: 'Examen bloqueado', message: 'Verifica que la fase esté habilitada y hayas completado la anterior.' })
              return
            }
            if (outcome.type === 'already_taken') {
              clearValidationCache(validationKey)
              clearQuizCache(quizCacheKey)
              setExistingExamData(outcome.examSnapshot)
              setExamState('already_taken')
              return
            }
            // Gate ok — marcar caché
            markValidationAsRecent(validationKey)
          } catch (err) {
            logger.debug('[UnifiedExamForm] Validación pre-generación:', err)
            // Si el gate falla, continuar y generar el quiz igual
            // (awaiting_validation se maneja tras generar)
          } finally {
            if (isMounted) setValidationChecking(false)
          }
        }

        // 4. Intentar usar quiz cacheado — cero lecturas Firestore
        const cachedQuiz = getQuizFromCache(quizCacheKey)
        if (cachedQuiz) {
          if (!isMounted) return
          setQuizData(cachedQuiz)
          setTimeLeft(cachedQuiz.questions.length * 2 * 60)
          setExamState('welcome')
          clearTimeout(timeoutId)
          return
        }

        // 5. Generar quiz (solo si no hay caché y pasó el gate)
        const userGradeName = (user as { gradeName?: string; grade?: string })?.gradeName ?? (user as { grade?: string })?.grade
        const userGrade = gradeLabelToBankCode(userGradeName ?? '') ?? '1'

        const quizResult = await quizGeneratorService.generateQuiz(currentSubject, currentPhase, userGrade, userId)

        if (!quizResult.success) {
          logger.debug('Error generando cuestionario:', quizResult.error)
          if (isMounted) setExamState(resolveQuizLoadFailureExamState(quizResult.error))
          return
        }

        const quiz = quizResult.data
        if (!isMounted) return

        // 6. Guardar quiz en caché antes de mostrarlo
        saveQuizToCache(quizCacheKey, quiz)

        setQuizData(quiz)
        setTimeLeft(quiz.questions.length * 2 * 60)
        setExamState('welcome')
        clearTimeout(timeoutId)
      } catch (error) {
        logger.debug('Error cargando cuestionario:', error)
        if (isMounted) setExamState(resolveQuizLoadFailureExamState(error))
      }
    }

    timeoutId = setTimeout(() => {
      if (isMounted) setExamState(prev => prev === 'loading' ? 'network_error' : prev)
    }, 30_000)

    void loadQuiz()
    return () => { isMounted = false; clearTimeout(timeoutId) }
  }, [userId, currentPhase, currentSubject, hasRecentValidation, buildValidationCacheKey, clearValidationCache, markValidationAsRecent, notifyError, buildQuizCacheKey, getQuizFromCache, saveQuizToCache, clearQuizCache])

  // ── Validación manual ─────────────────────────────────────────────────────

  const runValidationFromSummary = useCallback(async () => {
    if (!userId || !quizData) return
    setValidationChecking(true)
    try {
      const outcome = await validateExamPresentationGate({
        userId, phase: currentPhase, subjectLabel: currentSubject,
        quizId: quizData.id, summaryPack: summaryPackRef.current,
      })
      if (outcome.type === 'blocked') {
        clearValidationCache(buildValidationCacheKey())
        setExamState('blocked')
        notifyError({ title: 'Examen bloqueado', message: 'Verifica que la fase esté habilitada y hayas completado la anterior.' })
        return
      }
      if (outcome.type === 'already_taken') {
        clearValidationCache(buildValidationCacheKey())
        setExistingExamData(outcome.examSnapshot)
        setExamState('already_taken')
        return
      }
      markValidationAsRecent(buildValidationCacheKey())
      setExamState('welcome')
    } catch {
      notifyError({ title: 'Error', message: 'No se pudo comprobar el acceso. Intenta de nuevo.' })
    } finally {
      setValidationChecking(false)
    }
  }, [userId, quizData, currentPhase, currentSubject, notifyError, buildValidationCacheKey, clearValidationCache, markValidationAsRecent])

  // ── Tiempo por pregunta ───────────────────────────────────────────────────

  const initializeQuestionTime = (questionId: string) => {
    const now = Date.now()
    setQuestionTimeData(prev => ({ ...prev, [questionId]: { questionId, timeSpent: 0, startTime: now } }))
    setCurrentQuestionStartTime(now)
  }

  const finalizeQuestionTime = (questionId: string) => {
    if (currentQuestionStartTime <= 0) return
    const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000)
    setQuestionTimeData(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], timeSpent: (prev[questionId]?.timeSpent ?? 0) + elapsed, endTime: Date.now() },
    }))
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  const internalChangeQuestion = (newIndex: number) => {
    if (!quizData) return
    const currentId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code
    finalizeQuestionTime(currentId)
    setCurrentQuestion(newIndex)
    initializeQuestionTime(quizData.questions[newIndex].id || quizData.questions[newIndex].code)
  }

  const nextQuestion = () => {
    if (!quizData || currentQuestion >= quizData.questions.length - 1) return
    const nextIndex = currentQuestion + 1
    if (nextIndex > maxReachedQuestion) setMaxReachedQuestion(nextIndex)
    internalChangeQuestion(nextIndex)
  }

  const handleSkipQuestion = () => nextQuestion()

  // ── Iniciar tiempo al arrancar el examen ──────────────────────────────────

  useEffect(() => {
    if (examState !== 'active' || examStartTime !== 0 || !quizData) return
    setExamStartTime(Date.now())
    setMaxReachedQuestion(0)
    initializeQuestionTime(quizData.questions[0].id || quizData.questions[0].code)
    const groups = detectGroupedQuestions(quizData.questions)
    let found: { start: number; end: number } | null = null
    Object.values(groups).forEach(g => { if (1 >= g.start && 1 <= g.end) found = g })
    setGroupedQuestionMessage(found)
  }, [examState, quizData])

  useEffect(() => {
    if (examState !== 'active' || !quizData) return
    const groups = detectGroupedQuestions(quizData.questions)
    const n = currentQuestion + 1
    let found: { start: number; end: number } | null = null
    Object.values(groups).forEach(g => { if (n >= g.start && n <= g.end) found = g })
    setGroupedQuestionMessage(found)
  }, [currentQuestion, examState, quizData])

  // ── Puntuación ────────────────────────────────────────────────────────────

  const calculateScore = () => {
    if (!quizData) return { correctAnswers: 0, totalAnswered: 0, totalQuestions: 0, percentage: 0, overallPercentage: 0 }
    let correct = 0, answered = 0
    quizData.questions.forEach(q => {
      const qId = q.id || q.code
      if (answers[qId]) {
        answered++
        if (answers[qId] === q.options.find(o => o.isCorrect)?.id) correct++
      }
    })
    return {
      correctAnswers: correct, totalAnswered: answered,
      totalQuestions: quizData.questions.length,
      percentage: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      overallPercentage: Math.round((correct / quizData.questions.length) * 100),
    }
  }

  // ── Guardar en Firebase ───────────────────────────────────────────────────

  const saveToFirebase = async (timeExpired = false, lockedByTabChange = false) => {
    if (!quizData || !userId) return
    setIsSubmitting(true)
    // Limpiar caché del quiz al entregar — fuerza regeneración en próxima visita
    clearQuizCache(buildQuizCacheKey())
    clearValidationCache(buildValidationCacheKey())
    const currentId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code
    finalizeQuestionTime(currentId)
    try {
      const score = calculateScore()
      const examEndTime = Date.now()
      const totalExamTime = Math.floor((examEndTime - examStartTime) / 1000)
      const examResult: ExamResultData = {
        userId, examId: quizData.id, examTitle: quizData.title,
        subject: quizData.subject, phase: quizData.phase,
        answers, score, timeExpired, lockedByTabChange, tabChangeCount,
        startTime: new Date(examStartTime).toISOString(),
        endTime: new Date(examEndTime).toISOString(),
        timeSpent: totalExamTime, completed: true,
        questionTimeTracking: questionTimeData, totalExamTimeSeconds: totalExamTime,
        questionDetails: quizData.questions.map(q => {
          const qId = q.id || q.code
          const correctOpt = q.options.find(o => o.isCorrect)
          return {
            questionId: qId, questionText: q.questionText,
            userAnswer: answers[qId] ?? null, correctAnswer: correctOpt?.id ?? '',
            topic: q.topic, isCorrect: answers[qId] === correctOpt?.id,
            answered: !!answers[qId], timeSpent: questionTimeData[qId]?.timeSpent ?? 0,
          }
        }),
      }
      const result = await saveExamResults(userId, quizData.id, examResult)
      logger.debug('Examen guardado:', result)
      if (result?.success) invalidateStudentEvaluationsAfterExamSave(queryClient, userId)
      if (result.success && quizData.phase) {
        try { await processExamResults(userId, quizData.subject, quizData.phase, examResult) }
        catch (e) { logger.debug('Error procesando resultados:', e) }
      }
      return result
    } catch (error) {
      logger.debug('Error guardando examen:', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const enterFullscreen = async (): Promise<boolean> => {
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void>; msRequestFullscreen?: () => void }
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.msRequestFullscreen) el.msRequestFullscreen()
      return true
    } catch { /* noop */ }
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
  }

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
      else if (document.msExitFullscreen) await document.msExitFullscreen()
    } catch { /* noop */ }
  }

  // ── Antitrampas: cambio de pestaña ────────────────────────────────────────

  useEffect(() => {
    if (examState !== 'active' || examLocked) return
    let processing = false
    const handleTabChange = () => {
      if (processing) return
      processing = true
      setTabChangeCount(prev => {
        const next = prev + 1
        if (next === 2) {
          setShowTabChangeWarning(false)
          setShowFullscreenExit(false)
          setTimeout(() => void handleSubmit(false, true), 50)
        } else {
          setShowTabChangeWarning(true)
        }
        return next
      })
      setTimeout(() => { processing = false }, 500)
    }
    const onVisibilityChange = () => {
      if (!examLocked) {
        if (document.hidden) handleTabChange()
        else setTabChangeCount(c => { if (c === 1) setShowTabChangeWarning(true); return c })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [examState, examLocked])

  // ── Antitrampas: fullscreen ───────────────────────────────────────────────

  useEffect(() => {
    if (examState !== 'active' || examLocked) return
    const onFullscreenChange = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement
      setIsFullscreen(!!el)
      if (!el && !examLocked) {
        if (document.hidden) setFullscreenExitWithTabChange(true)
        else { setFullscreenExitWithTabChange(false); setShowFullscreenExit(true) }
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [examState, examLocked])

  // ── Antitrampas: tecla ESC ────────────────────────────────────────────────

  useEffect(() => {
    if (examState !== 'active' || examLocked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const selectOpen = document.querySelector('[data-radix-select-content]') || document.querySelector('[data-radix-select-trigger][data-state="open"]')
      if (selectOpen) return
      e.preventDefault()
      setTimeout(() => {
        const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
        if (!inFS) {
          setIsFullscreen(false)
          if (!document.hidden) { setFullscreenExitWithTabChange(false); setShowFullscreenExit(true) }
          else setFullscreenExitWithTabChange(true)
        } else {
          setFullscreenExitWithTabChange(false); setShowFullscreenExit(true)
        }
      }, 50)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [examState, examLocked])

  // ── Temporizador ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (examState !== 'active' || timeLeft <= 0 || examLocked) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { void handleSubmit(true, false); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [examState, timeLeft, examLocked])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (timeExpired = false, lockedByTabChange = false) => {
    if (examLocked || examState !== 'active') return
    setExamLocked(true)
    setShowWarning(false); setShowTabChangeWarning(false); setShowFullscreenExit(false)
    try {
      await saveToFirebase(timeExpired, lockedByTabChange)
      setExamState('completed')
      if (isFullscreen) await exitFullscreen()
    } catch {
      setExamLocked(false)
      notifyError({ title: 'No se pudo enviar el examen', message: 'Comprueba tu conexión e inténtalo de nuevo.' })
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) =>
    setAnswers(prev => ({ ...prev, [questionId]: answer }))

  const startExam = async () => {
    setTabChangeCount(0); setShowTabChangeWarning(false)
    const entered = await enterFullscreen()
    setExamState('active')
    if (!entered) setTimeout(() => {
      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
      if (!inFS) { setIsFullscreen(false); setShowFullscreenExit(true) }
    }, 100)
  }

  const handleExitFullscreen = async () => {
    setShowFullscreenExit(false)
    await handleSubmit(false, false)
    await exitFullscreen()
  }

  const returnToExam = async () => {
    setShowFullscreenExit(false); setFullscreenExitWithTabChange(false)
    await enterFullscreen()
    setTimeout(() => {
      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
      if (!inFS && examState === 'active') setShowFullscreenExit(true)
    }, 100)
  }

  const formatTimeLeft = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const formatTime    = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ─── Theme ────────────────────────────────────────────────────────────────

  const theme = getQuizTheme(themeKey)

  // ─── Pantallas estáticas ──────────────────────────────────────────────────

  const LoadingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn('shadow-lg', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn('h-16 w-16 rounded-full flex items-center justify-center animate-pulse', appTheme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
              <Database className={cn('h-8 w-8', appTheme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            </div>
          </div>
          <CardTitle className={cn('text-xl', appTheme === 'dark' ? 'text-white' : '')}>Generando cuestionario…</CardTitle>
          <CardDescription className={cn(appTheme === 'dark' ? 'text-gray-400' : '')}>
            Preparando tu evaluación de {currentSubject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  const AwaitingValidationScreen = () => {
    if (!quizData) return null
    return (
      <div className="max-w-2xl mx-auto">
        <Card className={cn('shadow-lg', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <CardTitle className={cn('text-xl', appTheme === 'dark' ? 'text-white' : '')}>
              Cuestionario listo: {quizData.title}
            </CardTitle>
            <CardDescription className={cn(appTheme === 'dark' ? 'text-gray-400' : '')}>
              Confirma en el servidor si puedes presentar este intento.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button type="button" size="sm" variant="secondary" disabled={validationChecking} onClick={() => void runValidationFromSummary()}>
              {validationChecking ? 'Comprobando…' : 'Comprobar acceso al examen'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const BlockedScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn('shadow-lg', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
              <AlertCircle className={cn('h-8 w-8', appTheme === 'dark' ? 'text-red-400' : 'text-red-600')} />
            </div>
          </div>
          <CardTitle className={cn('text-2xl', appTheme === 'dark' ? 'text-red-400' : 'text-red-800')}>Examen Bloqueado</CardTitle>
          <CardDescription className={cn('text-lg', appTheme === 'dark' ? 'text-gray-400' : '')}>
            Debes completar la fase anterior para acceder.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Button onClick={() => navigate('/dashboard#fases')} className="bg-blue-600 hover:bg-blue-700">
            Ver Estado de Fases
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  const NoQuestionsScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn('shadow-lg', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-amber-800' : 'border-amber-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')}>
              <AlertCircle className={cn('h-8 w-8', appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
            </div>
          </div>
          <CardTitle className={cn('text-2xl', appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>Sin preguntas disponibles</CardTitle>
          <CardDescription className={cn('text-lg', appTheme === 'dark' ? 'text-gray-400' : '')}>
            No hay suficientes preguntas de {currentSubject} para tu grado y nivel.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Button onClick={() => navigate('/dashboard')} className="bg-purple-600 hover:bg-purple-700">Volver al Dashboard</Button>
        </CardFooter>
      </Card>
    </div>
  )

  const AlreadyTakenScreen = () => {
    const data = existingExamData as {
      score?: { correctAnswers: number; totalQuestions: number; overallPercentage: number }
      timeSpent?: number; totalExamTimeSeconds?: number
    } | null
    return (
      <div className="max-w-2xl mx-auto">
        <Card className={cn('shadow-lg', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-amber-800' : 'border-amber-200')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')}>
                <AlertCircle className={cn('h-8 w-8', appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
              </div>
            </div>
            <CardTitle className={cn('text-2xl', appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>Examen Ya Presentado</CardTitle>
            <CardDescription className={cn('text-lg', appTheme === 'dark' ? 'text-gray-400' : '')}>
              Solo se permite una presentación por examen.
            </CardDescription>
          </CardHeader>
          {data && (
            <CardContent>
              <div className={cn('rounded-lg p-4 space-y-3', appTheme === 'dark' ? 'bg-zinc-700/50' : 'bg-gray-50')}>
                <h4 className={cn('font-medium', appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>Tu presentación anterior:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntuación:</span>
                    <div className={cn('font-medium text-lg', appTheme === 'dark' ? 'text-white' : '')}>
                      {data.score?.correctAnswers}/{data.score?.totalQuestions}
                      <span className="text-sm ml-1 text-gray-500">({data.score?.overallPercentage}%)</span>
                    </div>
                  </div>
                  <div>
                    <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo:</span>
                    <div className={cn('font-medium', appTheme === 'dark' ? 'text-white' : '')}>
                      {formatTime(data.timeSpent ?? data.totalExamTimeSeconds ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/dashboard')} className="bg-purple-600 hover:bg-purple-700">Ir a las demás pruebas</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const WelcomeScreen = () => {
    if (!quizData) return null
    return (
      <div className="max-w-4xl mx-auto relative z-10">
        <Card className={cn(`shadow-xl border-0 ${theme.cardBackground} backdrop-blur-sm`, appTheme === 'dark' ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-zinc-700' : '')}>
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <SubjectIcon className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-blue-400 rounded-full flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            <CardTitle className={cn('text-3xl font-bold mb-2', appTheme === 'dark' ? 'text-white' : theme.primaryColor)}>
              ¡Bienvenido al examen de {quizData.title}!
            </CardTitle>
            <CardDescription className={cn('text-lg max-w-2xl mx-auto', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {quizData.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />, label: `${quizData.questions.length * 2} minutos`, sub: 'Tiempo límite' },
                { icon: <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />, label: `${quizData.totalQuestions} preguntas`, sub: 'Total' },
                { icon: <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />, label: 'Opción múltiple', sub: 'Tipo de pregunta' },
              ].map((item, i) => (
                <div key={i} className={cn('rounded-lg p-4 text-center border shadow-sm', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                  {item.icon}
                  <div className={cn('font-semibold', appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.label}</div>
                  <div className={cn('text-sm', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{item.sub}</div>
                </div>
              ))}
            </div>
            <div className={cn('rounded-lg p-6 border shadow-sm', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <AlertCircle className="h-5 w-5 text-amber-500" /> Instrucciones importantes
              </h3>
              <ul className="space-y-3">
                {quizData.instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className={cn(appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Alert className={cn(appTheme === 'dark' ? 'border-orange-800 bg-orange-900/30' : 'border-orange-200 bg-orange-50')}>
              <Shield className="h-4 w-4 text-orange-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>Antitrampa</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-orange-200' : 'text-orange-700')}>
                Responde de manera sincera para obtener una mejora real en tu puntaje.
              </AlertDescription>
            </Alert>
            <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>¡Importante!</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                Una vez que inicies el examen el cronómetro comenzará. Asegúrate de tener conexión estable y un ambiente tranquilo.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center pt-6">
            <Button onClick={startExam} size="lg" className={`${theme.buttonGradient} ${theme.buttonHover} text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300`}>
              <Play className="h-5 w-5 mr-2" /> Iniciar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const CompletedScreen = () => {
    const score = calculateScore()
    return (
      <div className="max-w-4xl mx-auto">
        <Card className={cn('shadow-lg border-0', appTheme === 'dark' ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-blue-50')}>
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className={cn('text-3xl font-bold mb-2', appTheme === 'dark' ? 'text-green-400' : 'text-green-800')}>¡Examen Completado!</CardTitle>
            <CardDescription className={cn('text-lg', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tus respuestas han sido guardadas exitosamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn('rounded-lg p-6 border shadow-sm', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center"><div className="text-3xl font-bold text-green-600">{score.correctAnswers}</div><div className={cn('text-sm', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuestas correctas</div></div>
                <div className="text-center"><div className="text-3xl font-bold text-blue-600">{score.totalAnswered}</div><div className={cn('text-sm', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Preguntas respondidas</div></div>
                <div className="text-center"><div className="text-3xl font-bold text-purple-600">{score.overallPercentage}%</div><div className={cn('text-sm', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Puntuación final</div></div>
              </div>
              <Progress value={score.overallPercentage} className="h-3 mb-2" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pt-6">
            <Button onClick={() => navigate('/dashboard')} size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold">
              <CheckCircle2 className="h-5 w-5 mr-2" /> Volver a las demás pruebas
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ─── Pantalla activa ──────────────────────────────────────────────────────

  const ExamScreen = () => {
    if (!quizData) return null
    const currentQ = quizData.questions[currentQuestion]
    const answeredQuestions = Object.keys(answers).length
    const questionId = currentQ.id || currentQ.code

    const skipButtonClassName = useMemo(() => cn(
      'flex items-center gap-2 !transition-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent hover:border-inherit hover:text-inherit',
      appTheme === 'dark'
        ? 'border-gray-600 text-gray-300 dark:hover:bg-transparent dark:hover:border-gray-600 dark:hover:text-gray-300'
        : 'border-gray-300 text-gray-700 hover:border-gray-300 hover:text-gray-700',
    ), [])

    const allHaveImages = currentQ.options.every(o => o.imageUrl)
    const noText = currentQ.options.every(o => !o.text || stripHtmlTags(o.text).trim().length === 0)
    const imageLayout = allHaveImages && noText

    return (
      <div
        className={cn('flex flex-col lg:flex-row gap-6 min-h-screen pt-2 px-8 pb-4 quiz-gradient-bg relative', appTheme === 'dark' ? 'bg-zinc-900' : '')}
        style={appTheme === 'dark' ? {} : getQuizBackgroundStyle(theme)}
      >
        {/* ── Contenido principal ── */}
        <div className="flex-1 relative z-10">
          {/* Barra superior */}
          <div className={cn(`${theme.cardBackground} border rounded-lg p-2 mb-2 shadow-lg backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <SubjectIcon className={cn('w-8 h-8', appTheme === 'dark' ? 'text-blue-400' : 'text-blue-500')} />
                <div>
                  <h3 className={cn('text-[10px] font-medium', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estás realizando:</h3>
                  <h2 className={cn('text-sm font-normal', appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{quizData.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm',
                  timeLeft > 600
                    ? (appTheme === 'dark' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200')
                    : timeLeft > 300
                    ? (appTheme === 'dark' ? 'bg-orange-900/50 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-200')
                    : (appTheme === 'dark' ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-200'),
                )}>
                  <Clock className={cn('h-4 w-4', timeLeft > 600 ? 'text-green-500' : timeLeft > 300 ? 'text-orange-500' : 'text-red-500')} />
                  <span className={cn(
                    'text-sm font-medium font-mono',
                    timeLeft > 600 ? (appTheme === 'dark' ? 'text-green-300' : 'text-green-700')
                    : timeLeft > 300 ? (appTheme === 'dark' ? 'text-orange-300' : 'text-orange-700')
                    : (appTheme === 'dark' ? 'text-red-300' : 'text-red-700'),
                  )}>
                    {formatTimeLeft(timeLeft)}
                  </span>
                </div>
                {tabChangeCount === 1 && (
                  <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border', appTheme === 'dark' ? 'bg-orange-900/50 border-orange-700' : 'bg-orange-50 border-orange-200')}>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className={cn('text-sm font-medium', appTheme === 'dark' ? 'text-orange-300' : 'text-orange-700')}>1 intento de fraude detectado</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card pregunta */}
          <Card className={cn(`mb-6 ${theme.cardBackground} shadow-xl backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={cn('text-lg font-normal', appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Pregunta {currentQuestion + 1}</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn('px-2 py-1 rounded-full', appTheme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>{currentQ.topic}</span>
                  <span className={cn('px-2 py-1 rounded-full', appTheme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')}>{currentQ.level}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {groupedQuestionMessage && (
                <GroupedQuestionNotice range={groupedQuestionMessage} theme={appTheme === 'dark' ? 'dark' : 'light'} />
              )}
              <div className="prose prose-lg max-w-none">
                {currentQ.informativeText && (
                  <div className={cn('mb-4 p-4 rounded-lg border', appTheme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                    <div className={cn('leading-relaxed', appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(currentQ.informativeText)) }} />
                  </div>
                )}
                {currentQ.informativeImages && currentQ.informativeImages.length > 0 && (
                  <div className="mb-4"><ImageGallery images={currentQ.informativeImages} title="Imágenes informativas" maxImages={5} /></div>
                )}
                {currentQ.questionImages && currentQ.questionImages.length > 0 && (
                  <div className="mb-4"><ImageGallery images={currentQ.questionImages} title="Imágenes de la pregunta" maxImages={3} /></div>
                )}
                {currentQ.questionText && (
                  <div className={cn('leading-relaxed text-lg font-medium', appTheme === 'dark' ? 'text-white' : 'text-gray-900')}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(currentQ.questionText)) }} />
                )}
              </div>

              {/* ── Opciones ── */}
              {imageLayout ? (
                <RadioGroup value={answers[questionId] ?? ''} onValueChange={v => handleAnswerChange(questionId, v)} className="mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    {currentQ.options.map(option => (
                      <div key={option.id} onClick={() => handleAnswerChange(questionId, option.id)}
                        className={cn(
                          'relative rounded-lg p-2 transition-none cursor-pointer border-2',
                          answers[questionId] === option.id
                            ? appTheme === 'dark' ? 'border-purple-500 bg-purple-900/30' : 'border-purple-500 bg-purple-50'
                            : appTheme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700' : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50/50',
                        )}>
                        <RadioGroupItem value={option.id} id={`${questionId}-${option.id}`} className="absolute top-1.5 left-1.5 z-10" />
                        <div className="flex flex-col items-center justify-center pt-5">
                          <span className={cn('font-bold text-sm mb-1.5', appTheme === 'dark' ? 'text-purple-400' : theme.primaryColor)}>{option.id}.</span>
                          {option.imageUrl && (
                            <div className="relative w-full flex justify-center"
                              onClick={e => { e.stopPropagation(); setZoomedImage(option.imageUrl ?? null) }}>
                              <img src={option.imageUrl} alt={`Opción ${option.id}`}
                                className="max-w-[180px] max-h-[120px] w-auto h-auto rounded-md cursor-zoom-in hover:opacity-90 transition-opacity object-contain" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 rounded-md">
                                <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              ) : (
                <RadioGroup value={answers[questionId] ?? ''} onValueChange={v => handleAnswerChange(questionId, v)} className="space-y-0.5 mt-6">
                  {currentQ.options.map(option => (
                    <div key={option.id} onClick={() => handleAnswerChange(questionId, option.id)}
                      className={cn(
                        'flex items-start space-x-3 rounded-lg p-4 transition-none relative cursor-pointer',
                        appTheme === 'dark'
                          ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/90 border'
                          : `${theme.answerBorder} ${theme.answerBackground} hover:bg-opacity-60`,
                      )}
                      style={appTheme === 'dark' ? {} : (theme.pattern ? { backgroundImage: theme.pattern, backgroundSize: '100% 100%' } : {})}>
                      <RadioGroupItem value={option.id} id={`${questionId}-${option.id}`} className="mt-1 relative z-10" />
                      <Label htmlFor={`${questionId}-${option.id}`} className="flex-1 cursor-pointer relative z-10">
                        <div className="flex items-start gap-3">
                          <span className={cn('font-bold mr-2 text-base flex-shrink-0', appTheme === 'dark' ? 'text-purple-400' : theme.primaryColor)}>{option.id}.</span>
                          <div className="flex-1">
                            {option.text && (
                              <div className={cn('text-base leading-relaxed', appTheme === 'dark' ? 'text-gray-300' : theme.answerText)}
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(option.text)) }} />
                            )}
                            {option.imageUrl && (
                              <div className="mt-2 flex justify-center"
                                onClick={e => { e.stopPropagation(); setZoomedImage(option.imageUrl ?? null) }}>
                                <div className="relative">
                                  <img src={option.imageUrl} alt={`Opción ${option.id}`} className="option-image cursor-zoom-in hover:opacity-90 transition-opacity" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 rounded">
                                    <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                onClick={handleSkipQuestion}
                disabled={currentQuestion === quizData.questions.length - 1}
                variant="outline" className={skipButtonClassName} style={{ transition: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.transition = 'background-color 150ms ease-in-out' }}
                onMouseLeave={e => { e.currentTarget.style.transition = 'none' }}>
                <HelpCircle className="h-4 w-4" /> No sé
              </Button>
              <Button
                onClick={() => { currentQuestion === quizData.questions.length - 1 ? setShowWarning(true) : nextQuestion() }}
                disabled={!answers[questionId] || isSubmitting}
                variant="outline" className={cn('flex items-center gap-2', skipButtonClassName)} style={{ transition: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.transition = 'background-color 150ms ease-in-out' }}
                onMouseLeave={e => { e.currentTarget.style.transition = 'none' }}>
                {currentQuestion === quizData.questions.length - 1
                  ? isSubmitting
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Enviando…</>
                    : <>Finalizar examen <ChevronRight className="h-4 w-4" /></>
                  : <>Siguiente <ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* ── Panel lateral ── */}
        <div className="w-full lg:w-56 flex-shrink-0 relative z-10">
          <div className={cn(`${theme.cardBackground} border rounded-lg p-2.5 sticky top-4 shadow-lg backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <h3 className={cn('text-xs font-semibold mb-2 uppercase tracking-wide', appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Navegación</h3>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {quizData.questions.map((q, idx) => {
                const qId = q.id || q.code
                const isAnswered = !!answers[qId]
                const isCurrent = currentQuestion === idx
                return (
                  <button key={qId}
                    onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
                    className={cn(
                      'relative h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-200 cursor-not-allowed',
                      isCurrent
                        ? isAnswered
                          ? 'bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-1 ring-purple-400 scale-110'
                          : 'bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-1 ring-purple-300 scale-110'
                        : isAnswered
                        ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm'
                        : (appTheme === 'dark' ? 'bg-zinc-700 text-gray-300 border border-zinc-600' : 'bg-gray-100 text-gray-600 border border-gray-300'),
                    )}>
                    {idx + 1}
                    {isAnswered && !isCurrent && (
                      <CheckCircle2 className={cn('absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-green-500 rounded-full', appTheme === 'dark' ? 'bg-zinc-800' : 'bg-white')} />
                    )}
                  </button>
                )
              })}
            </div>
            <div className={cn('mt-3 pt-3 border-t', appTheme === 'dark' ? 'border-zinc-700' : '')}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn('text-xs font-semibold', appTheme === 'dark' ? 'text-white' : '')}>{answeredQuestions}/{quizData.questions.length}</span>
                <span className={cn('text-xs', appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{Math.round((answeredQuestions / quizData.questions.length) * 100)}%</span>
              </div>
              <Progress value={(answeredQuestions / quizData.questions.length) * 100} className="h-1.5 mb-3" />
              <Button onClick={() => setShowWarning(true)} disabled={isSubmitting} size="sm"
                className={`w-full ${theme.buttonGradient} ${theme.buttonHover} text-white shadow-lg text-xs py-2`}>
                {isSubmitting
                  ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Enviando…</>
                  : 'Finalizar examen'
                }
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Modales ──────────────────────────────────────────────────────────────

  const SubmitWarningModal = () => {
    const score = calculateScore()
    const unanswered = (quizData?.questions.length ?? 0) - score.totalAnswered
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className={cn('w-full max-w-md mx-4', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', appTheme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
                <Send className={cn('h-8 w-8', appTheme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              </div>
            </div>
            <CardTitle className={cn('text-xl', appTheme === 'dark' ? 'text-blue-400' : 'text-blue-800')}>¿Enviar Examen?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn('rounded-lg p-4', appTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
              <div className="grid grid-cols-2 gap-4 text-sm text-center">
                <div><div className="text-2xl font-bold text-blue-600">{score.totalAnswered}</div><div>Respondidas</div></div>
                <div><div className={cn('text-2xl font-bold', appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{unanswered}</div><div>Sin responder</div></div>
              </div>
            </div>
            {unanswered > 0 && (
              <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                  Tienes {unanswered} pregunta{unanswered > 1 ? 's' : ''} sin responder. Se contarán como incorrectas.
                </AlertDescription>
              </Alert>
            )}
            <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>Una vez enviado, no podrás modificar tus respuestas.</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={() => { setShowWarning(false); void handleSubmit(false, false) }} className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />{isSubmitting ? 'Enviando…' : 'Confirmar y Enviar'}
            </Button>
            <Button onClick={() => setShowWarning(false)} variant="outline"
              className={cn('w-full', appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')} disabled={isSubmitting}>
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const TabChangeWarningModal = () => {
    if (examLocked || tabChangeCount >= 2) return null
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className={cn('w-full max-w-md mx-4', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', appTheme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100')}>
                <AlertCircle className={cn('h-8 w-8', appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
              </div>
            </div>
            <CardTitle className={cn('text-xl', appTheme === 'dark' ? 'text-orange-400' : 'text-orange-800')}>¡Advertencia!</CardTitle>
            <CardDescription className={cn('text-base', appTheme === 'dark' ? 'text-gray-400' : '')}>Cambio de pestaña detectado</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className={cn('rounded-lg p-4 mb-4', appTheme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-50')}>
              <div className={cn('text-sm mb-1', appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>Intento de fraude detectado</div>
              <div className={cn('text-2xl font-bold', appTheme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>{tabChangeCount}</div>
            </div>
            <p className={cn('text-sm font-medium', appTheme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              ⚠️ Primera advertencia. Si cambias de pestaña una vez más, el examen se finalizará automáticamente.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={() => setShowTabChangeWarning(false)} className="w-full bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" /> Continuar Examen
            </Button>
            <Button onClick={() => { setShowTabChangeWarning(false); void handleSubmit(true, true) }}
              variant="outline"
              className={cn('w-full border-red-300 text-red-600 hover:bg-red-50', appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
              <X className="h-4 w-4 mr-2" /> Finalizar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const FullscreenExitModal = () => {
    if (!showFullscreenExit) return null
    const hasTabChange = fullscreenExitWithTabChange
    const isLastWarning = tabChangeCount >= 1
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <Card className={cn('w-full max-w-md mx-4', appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center',
                hasTabChange && isLastWarning
                  ? (appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')
                  : hasTabChange
                  ? (appTheme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100')
                  : (appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100'),
              )}>
                <Maximize className={cn(
                  'h-8 w-8',
                  hasTabChange && isLastWarning
                    ? (appTheme === 'dark' ? 'text-red-400' : 'text-red-600')
                    : hasTabChange
                    ? (appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600')
                    : (appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600'),
                )} />
              </div>
            </div>
            <CardTitle className={cn(
              'text-xl',
              hasTabChange && isLastWarning
                ? (appTheme === 'dark' ? 'text-red-400' : 'text-red-800')
                : hasTabChange
                ? (appTheme === 'dark' ? 'text-orange-400' : 'text-orange-800')
                : (appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800'),
            )}>
              {hasTabChange && isLastWarning ? '¡Advertencia Final!' : hasTabChange ? 'Salida y Cambio de Pestaña' : 'Salida de Pantalla Completa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {hasTabChange ? (
              <Alert className={cn(
                isLastWarning
                  ? (appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')
                  : (appTheme === 'dark' ? 'border-orange-800 bg-orange-900/30' : 'border-orange-200 bg-orange-50'),
              )}>
                <AlertCircle className={cn('h-4 w-4', isLastWarning ? 'text-red-600' : 'text-orange-600')} />
                <AlertDescription className={cn(
                  isLastWarning
                    ? (appTheme === 'dark' ? 'text-red-200' : 'text-red-700')
                    : (appTheme === 'dark' ? 'text-orange-200' : 'text-orange-700'),
                )}>
                  {isLastWarning
                    ? 'Si vuelves a salir de pantalla completa el examen se finalizará automáticamente.'
                    : 'Cambio de pestaña registrado. Será notificado al acudiente. Esta es tu primera advertencia.'}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                  El examen requiere pantalla completa. Si finalizas, se guardarán tus respuestas actuales.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={() => void returnToExam()} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <Maximize className="h-4 w-4 mr-2" /> Volver a Pantalla Completa
            </Button>
            <Button onClick={() => void handleExitFullscreen()} variant="outline"
              className={cn('w-full', appTheme === 'dark' ? 'border-red-700 text-red-400 hover:bg-red-900/30 bg-zinc-700' : 'border-red-300 text-red-600 hover:bg-red-50')}>
              <X className="h-4 w-4 mr-2" /> Finalizar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  return (
    <div
      className={cn('min-h-screen quiz-gradient-bg relative', appTheme === 'dark' ? 'bg-zinc-900' : '')}
      style={appTheme === 'dark' ? {} : getQuizBackgroundStyle(theme)}
    >
      {examState === 'loading'             && <LoadingScreen />}
      {examState === 'awaiting_validation' && <AwaitingValidationScreen />}
      {examState === 'blocked'             && <BlockedScreen />}
      {examState === 'network_error'       && (
        <QuizConnectionErrorScreen
          variant={appTheme === 'dark' ? 'dark' : 'light'}
          onRetry={() => window.location.reload()}
          onGoDashboard={() => navigate('/dashboard')}
        />
      )}
      {examState === 'no_questions'  && <NoQuestionsScreen />}
      {examState === 'welcome'       && <WelcomeScreen />}
      {examState === 'active'        && <ExamScreen />}
      {examState === 'completed'     && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {showWarning          && <SubmitWarningModal />}
      {showFullscreenExit   && <FullscreenExitModal />}
      {showTabChangeWarning && !examLocked && tabChangeCount < 2 && <TabChangeWarningModal />}

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button onClick={() => setZoomedImage(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors">
              <X className="h-8 w-8" />
            </button>
            <img
              src={zoomedImage} alt="Imagen ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default UnifiedExamForm

