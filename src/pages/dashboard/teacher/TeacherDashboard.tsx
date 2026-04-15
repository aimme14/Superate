import { useState, useEffect, useMemo } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  TrendingUp,
  School,
  BarChart3,
  Sparkles,
  Target,
  Trophy,
  Loader2,
  Award,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  Wrench,
  PieChart as PieChartIcon,
  RotateCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTeacherDashboardStats } from '@/hooks/query/useTeacherDashboardStats'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useToast } from '@/hooks/ui/use-toast'
import { requestRebuildGradeSummary } from '@/services/teacher/rebuildGradeSummaryCallable'
import { DASHBOARD_TEACHER_CACHE } from '@/config/dashboardTeacherCache'
import { collection, getDocs, getFirestore, query as fsQuery, where } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { StrengthsRadarChart } from '@/components/charts/StrengthsRadarChart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'
import { SubjectsDetailedSummary } from '@/components/charts/SubjectsDetailedSummary'
import { SubjectTopicsAccordion } from '@/components/charts/SubjectTopicsAccordion'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { DashboardRoleSkeleton } from '@/components/common/skeletons/DashboardRoleSkeleton'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { getWhatsAppUrl } from '@/components/WhatsAppFab'
import { displayNameFromSubjectSlug, fetchGradeSummaryByContext, type GradeSummaryDoc } from '@/services/teacher/gradeSummary.service'
import { examResultsFromSummaryData, type StudentProgressSummaryDoc } from '@/services/studentProgressSummary/fetchEvaluationsFromSummary'
import { canonicalizeTopicName } from '@/utils/topicCanonicalization'
import { AcademicReportSection, type AcademicPhaseKey } from '@/components/teacher/AcademicReportSection'

const db = getFirestore(firebaseApp)
const RANKING_INITIAL_VISIBLE = 10

/** Evita mostrar IDs de Firestore u otras claves técnicas como si fueran nombre de grado/sede. */
function looksLikeTechnicalId(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  if (v.includes('/')) return true
  if (v.length >= 24 && !v.includes(' ')) return true
  return false
}

function isDisplayableCampusName(value: string | undefined): boolean {
  const v = value?.trim() ?? ''
  if (!v) return false
  if (/^sede$/i.test(v)) return false
  if (looksLikeTechnicalId(v)) return false
  return true
}

function isDisplayableGradeName(value: string | undefined): boolean {
  const v = value?.trim() ?? ''
  if (!v) return false
  if (/^grado$/i.test(v)) return false
  if (looksLikeTechnicalId(v)) return false
  return true
}

function buildTeacherDocenciaLine(campusName: string | undefined, gradeName: string | undefined): string {
  const parts: string[] = []
  if (isDisplayableCampusName(campusName)) parts.push(String(campusName).trim())
  if (isDisplayableGradeName(gradeName)) parts.push(String(gradeName).trim())
  return parts.length ? `Docencia - ${parts.join(' • ')}` : 'Docencia'
}

function buildStudentsAssignedDescription(stats: { gradeName?: string; campusName?: string } | null | undefined): string {
  const g = stats?.gradeName && isDisplayableGradeName(stats.gradeName) ? stats.gradeName.trim() : null
  const c = stats?.campusName && isDisplayableCampusName(stats.campusName) ? stats.campusName.trim() : null
  const suffix = 'Haz clic en un estudiante para ver su resumen y diagnóstico.'
  if (g && c) return `Estudiantes de ${g} en ${c}. ${suffix}`
  if (g) return `Estudiantes de ${g}. ${suffix}`
  if (c) return `Estudiantes en ${c}. ${suffix}`
  return `Estudiantes asignados. ${suffix}`
}

interface TeacherDashboardProps extends ThemeContextProps {}

export default function TeacherDashboard({ theme }: TeacherDashboardProps) {
  const queryClient = useQueryClient()
  const { stats, isLoading } = useTeacherDashboardStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [rebuildGradeBusy, setRebuildGradeBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('inicio')
  const [rankingFilters, setRankingFilters] = useState<{
    jornada: 'mañana' | 'tarde' | 'única' | 'todas'
    phase: 'first' | 'second' | 'third'
  }>({
    jornada: 'todas',
    phase: 'first',
  })
  const [evolutionFilters, setEvolutionFilters] = useState<{
    subject: string
    jornada: string
  }>({
    subject: 'todas',
    jornada: 'todas'
  })

  const summaryContext = useMemo(
    () => ({
      institutionId: stats.institutionId || '',
      gradeId: stats.gradeId || '',
    }),
    [stats.institutionId, stats.gradeId]
  )

  const currentAcademicYear = new Date().getFullYear()
  const {
    data: gradeSummary,
    isLoading: gradeSummaryLoading,
    error: gradeSummaryError,
    refetch: refetchGradeSummary,
  } = useQuery({
    queryKey: ['teacher-grade-summary-shared', summaryContext.institutionId, summaryContext.gradeId, currentAcademicYear],
    queryFn: () =>
      fetchGradeSummaryByContext({
        ...summaryContext,
        academicYear: currentAcademicYear,
      }),
    enabled: !!summaryContext.institutionId && !!summaryContext.gradeId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  const normalizedTeacherJornada =
    stats.jornada === 'mañana' || stats.jornada === 'tarde' ? stats.jornada : null
  const hasValidTeacherJornada = normalizedTeacherJornada !== null

  const handleRebuildGradeSummary = async () => {
    if (!summaryContext.institutionId || !summaryContext.gradeId) return
    setRebuildGradeBusy(true)
    try {
      await requestRebuildGradeSummary({
        institutionId: summaryContext.institutionId,
        gradeId: summaryContext.gradeId,
        academicYear: currentAcademicYear,
      })
      await refetchGradeSummary()
      await queryClient.invalidateQueries({ queryKey: ['teacher-student-summaries'] })
      toast({
        title: 'Estísticas del grado actualizadas',
        description:
          'Grado y lista de Mis Estudiantes actualizados con los últimos datos.',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo actualizar. Intenta de nuevo.'
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: msg,
      })
    } finally {
      setRebuildGradeBusy(false)
    }
  }

  const { data: studentSummaries = [] } = useQuery({
    queryKey: [
      'teacher-student-summaries',
      summaryContext.institutionId,
      summaryContext.gradeId,
      stats.campusId,
      normalizedTeacherJornada,
      currentAcademicYear,
    ],
    queryFn: async () => {
      if (!summaryContext.institutionId || !summaryContext.gradeId) return []
      if (!hasValidTeacherJornada) return []
      const baseRef = collection(
        db,
        'superate',
        'auth',
        'institutions',
        summaryContext.institutionId,
        'studentSummaries'
      )
      const constraints: any[] = [
        where('gradeId', '==', summaryContext.gradeId),
        where('academicYear', '==', currentAcademicYear),
        where('jornada', '==', normalizedTeacherJornada),
      ]
      if (stats.campusId) constraints.push(where('sedeId', '==', stats.campusId))

      const snap = await getDocs(fsQuery(baseRef, ...constraints))
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StudentProgressSummaryDoc) }))
    },
    enabled: !!summaryContext.institutionId && !!summaryContext.gradeId && hasValidTeacherJornada,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  /** Mismo criterio que la lista Mis Estudiantes (summaries); si no hay jornada válida, fallback a stats/grado. */
  const totalStudents = useMemo(() => {
    if (hasValidTeacherJornada) return studentSummaries.length
    return gradeSummary?.totalStudents ?? stats.totalStudents
  }, [hasValidTeacherJornada, studentSummaries.length, gradeSummary?.totalStudents, stats.totalStudents])

  if (isLoading) {
    return <DashboardRoleSkeleton theme={theme} />
  }

  return (
    <div className={cn('min-h-screen overflow-x-hidden', theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100')}>
      <div className="flex flex-col gap-0.5">
        {/* Header con logo y gradiente */}
        <div
          className={cn(
            'fade-in duration-200',
            isMobile ? 'relative overflow-hidden rounded-none px-4 pt-3 pb-2 text-white shadow-2xl' : 'relative overflow-hidden rounded-none px-5 pt-5 pb-2 text-white shadow-2xl',
            theme === 'dark'
              ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900'
              : ''
          )}
          style={theme === 'dark' ? {} : { backgroundColor: 'var(--dashboard-header, #1e3a8a)' }}
        >
          {theme === 'dark' && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/90 to-blue-900/80" />
          )}
          <div className="relative z-10">
            <div className={cn('flex items-center justify-between flex-wrap', isMobile ? 'gap-2' : 'gap-3')}>
              <div className={cn('flex items-center', isMobile ? 'gap-2' : 'gap-3')}>
                <div className="relative">
                  <img
                    src={institutionLogo || '/assets/agustina.png'}
                    alt={`Logo de ${institutionName}`}
                    className={cn(
                      'object-contain rounded-lg bg-white/15 shadow-sm border border-white/30',
                      isMobile ? 'w-14 h-14 p-1.5' : 'w-20 h-20 p-2'
                    )}
                    onError={(e) => {
                      e.currentTarget.src = '/assets/agustina.png'
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h1 className={cn('font-bold mb-0.5 leading-tight', isMobile ? 'text-base' : 'text-xl')}>
                    Bienvenido, {stats.teacherName}
                  </h1>
                  <p className={cn('opacity-90 mb-0.5', isMobile ? 'text-xs' : 'text-sm')}>
                    {buildTeacherDocenciaLine(stats.campusName, stats.gradeName)}
                  </p>
                  <p className={cn('opacity-75 truncate', isMobile ? 'text-[11px] max-w-[180px]' : 'text-xs')}>
                    {institutionName || stats.institutionName} • {stats.teacherEmail}
                  </p>
                </div>
              </div>
              {!!summaryContext.institutionId && !!summaryContext.gradeId && (
                <div className="flex items-center shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rebuildGradeBusy || gradeSummaryLoading}
                    onClick={() => void handleRebuildGradeSummary()}
                    title="Actualizar resumen del grado"
                    aria-label="Actualizar resumen del grado"
                    aria-busy={rebuildGradeBusy}
                    className={cn(
                      'h-10 w-10 rounded-lg border-2 border-white/40 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white',
                      isMobile ? 'shrink-0' : 'h-11 w-11'
                    )}
                  >
                    {rebuildGradeBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <RotateCw className="h-5 w-5" aria-hidden />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <School className={cn('absolute top-0 right-0 opacity-10', isMobile ? 'h-28 w-28' : 'h-40 w-40')} aria-hidden />
        </div>
      </div>

      {/* Botones de acción */}
      <div className="hidden md:grid md:grid-cols-3 gap-3 mx-4 md:mx-6 lg:mx-8 mt-2.5 fade-in duration-200">
        {[
          { icon: Sparkles, label: 'Inicio', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'inicio' },
          { icon: Users, label: 'Mis Estudiantes', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'estudiantes', count: totalStudents ?? null },
          { icon: BarChart3, label: 'Análisis del curso', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'analisis-curso' },
        ].map((btn) => (
          <div key={btn.label}>
            <Button
              onClick={() => setActiveTab(btn.tab)}
              className={cn(
                'w-full h-18 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br text-white shadow-md transition-colors duration-150',
                btn.color
              )}
            >
              <btn.icon className="h-6 w-6" />
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{btn.label}</span>
                {'count' in btn && btn.count != null && (
                  <span className="text-xs opacity-90 font-medium bg-white/20 px-1.5 py-0.5 rounded-full">
                    {btn.count}
                  </span>
                )}
              </div>
            </Button>
          </div>
        ))}
      </div>

      {/* Contenido dinámico según tab activo - mismo patrón que Principal/Rector */}
      <div className="mx-4 md:mx-6 lg:mx-8 mt-3 pb-20 md:pb-0">
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            <WelcomeTab
              theme={theme}
              stats={stats}
              summaryContext={summaryContext}
              totalStudents={totalStudents}
              gradeSummary={gradeSummary}
              gradeSummaryLoading={gradeSummaryLoading}
              gradeSummaryError={gradeSummaryError}
              refetchGradeSummary={refetchGradeSummary}
              rankingFilters={rankingFilters}
              setRankingFilters={setRankingFilters}
              studentSummaries={studentSummaries}
              evolutionFilters={evolutionFilters}
              setEvolutionFilters={setEvolutionFilters}
            />
          </div>
        )}
        {activeTab === 'estudiantes' && (
          <div className="space-y-6">
            <StudentsTab theme={theme} studentSummaries={studentSummaries} stats={stats} />
          </div>
        )}
        {activeTab === 'analisis-curso' && (
          <div className="space-y-6">
            <CourseAnalysisTab
              theme={theme}
              gradeSummary={gradeSummary}
              gradeSummaryLoading={gradeSummaryLoading}
              gradeSummaryError={gradeSummaryError}
              refetchGradeSummary={refetchGradeSummary}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
          <div className={cn(
            'flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-md',
            theme === 'dark' ? 'border-zinc-700 bg-zinc-900/90' : 'border-gray-300 bg-white/90'
          )}>
            <Button type="button" size="icon" variant="ghost" aria-label="Inicio" title="Inicio" onClick={() => setActiveTab('inicio')}
              className={cn('h-9 w-9 rounded-lg', activeTab === 'inicio' ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700') : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'))}>
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Mis Estudiantes" title="Mis Estudiantes" onClick={() => setActiveTab('estudiantes')}
              className={cn('h-9 w-9 rounded-lg', activeTab === 'estudiantes' ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700') : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'))}>
              <Users className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Análisis del curso" title="Análisis del curso" onClick={() => setActiveTab('analisis-curso')}
              className={cn('h-9 w-9 rounded-lg', activeTab === 'analisis-curso' ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700') : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'))}>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button asChild size="icon" variant="ghost" aria-label="Soporte técnico" title="Soporte técnico"
              className={cn('h-9 w-9 rounded-lg', theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100')}>
              <a
                href={getWhatsAppUrl('Hola, soy docente y necesito soporte técnico con el sistema.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Wrench className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

type TeacherRankingFilters = { jornada: string; phase: string }

async function fetchTeacherRanking(
  studentSummaries: StudentProgressSummaryDoc[],
  filters: TeacherRankingFilters
): Promise<Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }>> {
  if (!studentSummaries?.length) return []
  let filtered = [...studentSummaries]
  if (filters.jornada && filters.jornada !== 'todas') {
    filtered = filtered.filter((s: any) => (s.jornada || '').toLowerCase() === filters.jornada.toLowerCase())
  }

  const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']

  const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
  const POINTS_NAT = 100 / 3
  const POINTS_REG = 100
  const normalizeSubject = (sub: string): string => {
    const n = sub.trim().toLowerCase()
    const map: Record<string, string> = {
      biologia: 'Biologia', quimica: 'Quimica', fisica: 'Física', matematicas: 'Matemáticas',
      lenguaje: 'Lenguaje', 'ciencias sociales': 'Ciencias Sociales', ingles: 'Inglés'
    }
    return map[n] || sub
  }

  const ranking: Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }> = []
  filtered.forEach((summary: any) => {
    const sid = summary.studentId || summary.id
    if (!sid) return
    const phaseBlock = summary?.phases?.[filters.phase]
    if (!phaseBlock?.subjects || typeof phaseBlock.subjects !== 'object') return

    const subjectScores: Record<string, number> = {}
    const completedSubjectsSet = new Set<string>()

    Object.entries(phaseBlock.subjects).forEach(([subjectSlug, cell]: [string, any]) => {
      const displaySubject = normalizeSubject(displayNameFromSubjectSlug(subjectSlug))
      const pctFromSnapshot = cell?.examSnapshot?.score?.overallPercentage
      const pctFromCell = cell?.score
      const pct =
        typeof pctFromSnapshot === 'number'
          ? pctFromSnapshot
          : typeof pctFromCell === 'number'
            ? pctFromCell
            : 0
      if (pct > 0 || typeof pctFromSnapshot === 'number' || typeof pctFromCell === 'number') {
        completedSubjectsSet.add(displaySubject)
      }
      if (!subjectScores[displaySubject] || pct > subjectScores[displaySubject]) {
        subjectScores[displaySubject] = pct
      }
    })

    if (!REQUIRED_SUBJECTS.every((sub) => completedSubjectsSet.has(sub))) return

    let globalScore = 0
    Object.entries(subjectScores).forEach(([sub, pct]) => {
      globalScore += NATURALES_SUBJECTS.includes(sub) ? (pct / 100) * POINTS_NAT : (pct / 100) * POINTS_REG
    })
    ranking.push({
      student: {
        id: sid,
        uid: sid,
        name: summary.studentName || 'Estudiante',
        displayName: summary.studentName || 'Estudiante',
        gradeName: summary.gradeName || '',
        jornada: summary.jornada || '',
      },
      globalScore: Math.round(globalScore * 100) / 100,
      totalExams: Object.keys(phaseBlock.subjects || {}).length,
      completedSubjects: completedSubjectsSet.size,
    })
  })
  ranking.sort((a, b) => (a.totalExams === 0 && b.totalExams > 0 ? 1 : a.totalExams > 0 && b.totalExams === 0 ? -1 : b.globalScore - a.globalScore))
  return ranking
}

// Ranking de mejores estudiantes del docente (solo sus estudiantes, con filtro por fase)
function TeacherRankingCard({ theme, studentSummaries, rankingFilters, setRankingFilters }: {
  theme: 'light' | 'dark'
  studentSummaries: StudentProgressSummaryDoc[]
  rankingFilters: TeacherRankingFilters
  setRankingFilters: (f: any) => void
}) {
  const isMobile = useIsMobile()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const summariesKey = studentSummaries.map((s: any) => s.studentId || s.id).filter(Boolean).join(',')

  const { data: rankingData, isLoading: rankingLoading, error: rankingError, refetch: refetchRanking } = useQuery({
    queryKey: ['teacher-students-ranking', summariesKey, rankingFilters],
    queryFn: () => fetchTeacherRanking(studentSummaries, rankingFilters),
    enabled: !!studentSummaries?.length,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  const [showAllRanking, setShowAllRanking] = useState(false)
  useEffect(() => setShowAllRanking(false), [rankingFilters])

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader className={cn(isMobile ? 'pb-1.5 pt-3 px-3' : 'pb-2')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-xl' : '', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Trophy className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Ranking de Mejores Estudiantes
            </CardTitle>
            {!isMobile && <CardDescription>Solo estudiantes de tu grado, ordenados por rendimiento</CardDescription>}
            <p className={cn('text-xs mt-1', isMobile && 'truncate pr-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')} aria-live="polite">
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {isMobile && (
              <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className={cn('h-7 px-2.5 text-[11px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900')}>
                    Filtros
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className={cn('w-56 p-2', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}>
                  <div className="grid grid-cols-1 gap-2">
                    <Select value={rankingFilters.phase} onValueChange={(v) => setRankingFilters({ ...rankingFilters, phase: v })}>
                      <SelectTrigger className={cn('h-8 w-full text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="first">Fase I</SelectItem><SelectItem value="second">Fase II</SelectItem><SelectItem value="third">Fase III</SelectItem></SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {!isMobile && (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <label className={cn('text-[10px] leading-none', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fase</label>
                <Select value={rankingFilters.phase} onValueChange={(v) => setRankingFilters({ ...rankingFilters, phase: v })}>
                  <SelectTrigger className={cn('h-8 w-20 text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">Fase I</SelectItem>
                    <SelectItem value="second">Fase II</SelectItem>
                    <SelectItem value="third">Fase III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isMobile ? 'pt-0 px-3 pb-3' : '')}>
        {rankingError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className={cn('text-sm text-center', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar el ranking. Intenta de nuevo.</p>
            <Button variant="outline" size="sm" onClick={() => refetchRanking()} className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}>
              <RotateCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        ) : rankingLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando ranking">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('flex items-center justify-between py-1.5 px-2 rounded-md border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-300 bg-gray-100')}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-6 h-6 rounded-full animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />
                  <div className="space-y-0.5">
                    <div className={cn('h-3 w-20 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />
                    <div className={cn('h-2.5 w-14 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />
                  </div>
                </div>
                <div className={cn('h-5 w-10 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />
              </div>
            ))}
          </div>
        ) : rankingData && rankingData.length > 0 ? (
          <>
            <TooltipProvider>
              <div className={cn('space-y-1 overflow-y-auto', isMobile ? 'max-h-80' : 'max-h-96')} role="list" aria-label="Ranking de estudiantes">
                {(showAllRanking ? rankingData : rankingData.slice(0, RANKING_INITIAL_VISIBLE)).map((item: any, index: number) => (
                  <div key={item.student.id || item.student.uid} role="listitem" className={cn(isMobile ? 'flex items-center justify-between py-1.5 px-1.5 rounded-md border' : 'flex items-center justify-between py-1.5 px-2 rounded-md border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' : 'border-gray-300 bg-gray-100 hover:bg-gray-200')}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0', index === 0 ? (theme === 'dark' ? 'bg-yellow-600 text-white' : 'bg-yellow-500 text-white') : index === 1 ? (theme === 'dark' ? 'bg-gray-400 text-white' : 'bg-gray-300 text-gray-900') : index === 2 ? (theme === 'dark' ? 'bg-orange-700 text-white' : 'bg-orange-500 text-white') : (theme === 'dark' ? 'bg-zinc-700 text-gray-300' : 'bg-gray-200 text-gray-600'))}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(isMobile ? 'font-medium text-[13px] truncate' : 'font-medium text-sm truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.student.name || item.student.displayName || 'Estudiante'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-end gap-0 cursor-help">
                            <p className={cn(isMobile ? 'font-bold text-[15px] leading-tight' : 'font-bold text-base leading-tight', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.globalScore.toFixed(1)}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p>Puntaje global de la fase (escala 0-500). Solo incluye estudiantes que completaron las 7 materias.</p>
                        </TooltipContent>
                      </UITooltip>
                      <p className={cn(isMobile ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{item.student.jornada ? item.student.jornada.charAt(0).toUpperCase() + item.student.jornada.slice(1) : 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
            {rankingData.length > RANKING_INITIAL_VISIBLE && (
              <div className="flex justify-center pt-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAllRanking((v) => !v)} className={cn('text-xs', theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}>
                  {showAllRanking ? <><ChevronUp className="h-4 w-4 mr-1" /> Ver menos</> : <><ChevronDown className="h-4 w-4 mr-1" /> Ver más ({rankingData.length - RANKING_INITIAL_VISIBLE} más)</>}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 space-y-2">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay estudiantes con resultados para los filtros seleccionados</p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Evolución por Materia (solo estudiantes del docente; clave sin materia, filtro materia en cliente)
function TeacherEvolutionBySubjectChart({
  theme,
  filters,
  setFilters,
  gradeSummary,
  gradeSummaryLoading,
  gradeSummaryError,
  refetchGradeSummary,
}: {
  theme: 'light' | 'dark'
  filters: { subject: string; jornada: string }
  setFilters: (f: any) => void
  gradeSummary: GradeSummaryDoc | null | undefined
  gradeSummaryLoading: boolean
  gradeSummaryError: unknown
  refetchGradeSummary: () => void
}) {
  const isMobile = useIsMobile()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const fixedYear = new Date().getFullYear()
  const subjects = ['todas', 'Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
  const evolutionData = useMemo(() => {
    if (!gradeSummary?.phases) return { chartData: [], subjects: [] as string[] }
    const phaseKeys: Array<'first' | 'second' | 'third'> = ['first', 'second', 'third']
    const allSubjectsSet = new Set<string>()
    for (const phaseKey of phaseKeys) {
      const phaseSubjects = gradeSummary.phases[phaseKey]?.subjects || {}
      Object.keys(phaseSubjects).forEach((subjectSlug) => {
        allSubjectsSet.add(displayNameFromSubjectSlug(subjectSlug))
      })
    }
    const allSubjects = Array.from(allSubjectsSet).sort()
    const chartData: any[] = phaseKeys.map((phaseKey) => {
      const point: any = {
        fase: phaseKey === 'first' ? 'Fase I' : phaseKey === 'second' ? 'Fase II' : 'Fase III'
      }
      const phaseSubjects = gradeSummary.phases[phaseKey]?.subjects || {}
      for (const subjectName of allSubjects) {
        const subjectSlug = Object.keys(phaseSubjects).find(
          (slug) => displayNameFromSubjectSlug(slug) === subjectName
        )
        point[subjectName] = subjectSlug ? (phaseSubjects[subjectSlug]?.avgPct ?? null) : null
      }
      return point
    })
    return { chartData, subjects: allSubjects }
  }, [gradeSummary])

  const displaySubjects = evolutionData?.subjects?.length
    ? filters.subject === 'todas'
      ? evolutionData.subjects
      : evolutionData.subjects.includes(filters.subject)
        ? [filters.subject]
        : []
    : []
  const hasChartData = (evolutionData?.chartData?.length ?? 0) > 0

  const SUBJECT_COLORS: Record<string, string> = {
    'Matemáticas': '#3b82f6', 'Lenguaje': '#a855f7', 'Ciencias Sociales': '#10b981',
    'Biologia': '#f59e0b', 'Quimica': '#ef4444', 'Física': '#f97316', 'Inglés': '#06b6d4'
  }

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader className={cn(isMobile ? 'pb-1.5 pt-3 px-3' : 'pb-2')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-xl' : '', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className={cn(isMobile ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Evolución académica
            </CardTitle>
            {!isMobile && (
            <CardDescription className="mt-0.5">
              {evolutionData?.subjects?.length ? (filters.subject === 'todas' ? `${evolutionData.subjects.length} materias evaluadas` : displaySubjects.length === 1 ? '1 materia evaluada' : 'Promedio por materia') : 'Promedio de puntuación por materia en las 3 fases'}
            </CardDescription>
            )}
            <p className={cn('text-[10px] mt-0.5', isMobile && 'truncate pr-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')} aria-live="polite">
              {fixedYear} · {filters.subject === 'todas' ? 'Todas' : filters.subject}
            </p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            {isMobile && (
              <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className={cn('h-7 px-2.5 text-[11px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900')}>
                    Filtros
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className={cn('w-60 p-2', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}>
                  <div className="grid grid-cols-1 gap-2">
                    <Select value={filters.subject} onValueChange={(v) => setFilters({ ...filters, subject: v })}>
                      <SelectTrigger className={cn('h-8 w-full text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por materia"><SelectValue placeholder="Materia" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => (<SelectItem key={s} value={s}>{s === 'todas' ? 'Todas las materias' : s}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {!isMobile && (
            <>
            <div className="flex flex-col gap-0.5">
              <label className={cn('text-[10px] font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Materia</label>
              <Select value={filters.subject} onValueChange={(v) => setFilters({ ...filters, subject: v })}>
                <SelectTrigger className={cn('h-7 w-28 text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por materia">
                  <SelectValue placeholder="Materia" />
                </SelectTrigger>
                <SelectContent>{subjects.map(s => (<SelectItem key={s} value={s}>{s === 'todas' ? 'Todas' : s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isMobile ? 'pt-0 px-3 pb-3' : 'pt-0')}>
        {gradeSummaryError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className={cn('text-sm text-center', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar la evolución. Por favor, intenta nuevamente.</p>
            <Button variant="outline" size="sm" onClick={() => refetchGradeSummary()} className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}>
              <RotateCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        ) : gradeSummaryLoading ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Cargando evolución por materia">
            <div className={cn('h-48 rounded-md animate-pulse', theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200')} />
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: 7 }).map((_, i) => (<div key={i} className={cn('h-4 w-20 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />))}
            </div>
          </div>
        ) : hasChartData && displaySubjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 190 : 240}>
            <BarChart data={evolutionData!.chartData} barCategoryGap={displaySubjects.length > 1 ? '18%' : '35%'} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#3f3f46' : '#d1d5db'} />
              <XAxis dataKey="fase" stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'} tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }} />
              <YAxis domain={[0, 100]} stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'} tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }} />
              <Tooltip
                shared={false}
                cursor={{ fill: 'transparent' }}
                contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb', borderRadius: '8px' }}
                labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}
                formatter={(value, name) => {
                  const rawValue = Array.isArray(value) ? value[0] : value
                  return typeof rawValue === 'number'
                    ? [`${rawValue.toFixed(1)}%`, String(name)]
                    : ['Sin dato', String(name)]
                }}
              />
              <Legend wrapperStyle={{ paddingTop: isMobile ? '4px' : '8px' }} iconType="rect" iconSize={isMobile ? 8 : 10} formatter={(value) => <span style={{ fontSize: isMobile ? 10 : 11 }}>{value}</span>} />
              {displaySubjects.map((subject: string) => (
                <Bar
                  key={subject}
                  dataKey={subject}
                  name={subject}
                  fill={SUBJECT_COLORS[subject] || '#6b7280'}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : hasChartData && filters.subject !== 'todas' && displaySubjects.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos para {filters.subject} con los filtros seleccionados</p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{fixedYear}</p>
          </div>
        ) : (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos disponibles para los filtros seleccionados</p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{fixedYear} · {filters.subject === 'todas' ? 'Todas' : filters.subject}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Promedio del grado por fase (tarjeta con filtro de fase)
function GradeAverageCard({
  theme,
  gradeSummary,
  gradeSummaryLoading,
  gradeSummaryError,
  refetchGradeSummary,
}: {
  theme: 'light' | 'dark'
  gradeSummary: GradeSummaryDoc | null | undefined
  gradeSummaryLoading: boolean
  gradeSummaryError: unknown
  refetchGradeSummary: () => void
}) {
  const isMobile = useIsMobile()
  const [mobilePhaseOpen, setMobilePhaseOpen] = useState(false)
  const [phase, setPhase] = useState<'first' | 'second' | 'third'>('first')
  const average = useMemo(() => {
    if (!gradeSummary?.phases?.[phase]) return null
    const NATURALES = ['Biologia', 'Quimica', 'Física']
    const POINTS_NAT = 100 / 3
    const POINTS_REG = 100
    const subjects = gradeSummary.phases[phase].subjects || {}
    const entries = Object.entries(subjects).filter(([, value]) => typeof value.avgPct === 'number')
    if (!entries.length) return null

    let globalScore = 0
    entries.forEach(([subjectSlug, value]) => {
      const name = displayNameFromSubjectSlug(subjectSlug)
      const pct = value.avgPct as number
      globalScore += NATURALES.includes(name) ? (pct / 100) * POINTS_NAT : (pct / 100) * POINTS_REG
    })
    return Math.round(globalScore * 100) / 100
  }, [gradeSummary, phase])

  return (
    <div className="fade-in duration-200">
      <Card className={cn('relative overflow-hidden border-0 shadow-lg', theme === 'dark' ? 'bg-zinc-900' : 'bg-white')}>
        <div className={cn('absolute top-0 right-0 w-14 h-14 bg-gradient-to-br opacity-10 rounded-full -mr-7 -mt-7', 'from-emerald-500 to-emerald-600')} />
        <CardHeader className={cn(
          'flex flex-row items-center justify-between space-y-0 relative z-10',
          isMobile ? 'py-0.5 px-2 pb-0' : 'py-1 px-3 pb-0'
        )}>
          <CardTitle className={cn(isMobile ? 'text-[10px] font-medium leading-none' : 'text-xs font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            {isMobile ? 'Promedio Grado' : 'Promedio del Grado'}
          </CardTitle>
          <div className="flex items-center gap-1">
            {isMobile ? (
              <Popover open={mobilePhaseOpen} onOpenChange={setMobilePhaseOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-5 px-2 text-[10px]',
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    Fase
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  className={cn('w-40 p-2', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}
                >
                  <Select value={phase} onValueChange={(v) => setPhase(v as 'first' | 'second' | 'third')}>
                    <SelectTrigger className={cn('h-8 w-full text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">Fase I</SelectItem>
                      <SelectItem value="second">Fase II</SelectItem>
                      <SelectItem value="third">Fase III</SelectItem>
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
            ) : (
              <Select value={phase} onValueChange={(v) => setPhase(v as 'first' | 'second' | 'third')}>
                <SelectTrigger className={cn('h-4 min-h-4 w-[68px] text-[10px] py-0 leading-tight', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200')} aria-label="Filtrar por fase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Fase I</SelectItem>
                  <SelectItem value="second">Fase II</SelectItem>
                  <SelectItem value="third">Fase III</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn('relative z-10 pt-0.5 leading-none', isMobile ? 'px-2 pb-1' : 'px-3 pb-2.5')}>
          {gradeSummaryError ? (
            <div className="flex flex-col gap-1.5">
              <span className={cn('text-xs', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => refetchGradeSummary()}>
                <RotateCw className="h-3 w-3 mr-1" /> Reintentar
              </Button>
            </div>
          ) : gradeSummaryLoading ? (
            <div className={cn('h-7 w-14 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} aria-busy="true" aria-label="Cargando promedio" />
          ) : average != null ? (
            <span className={cn(isMobile ? 'text-lg font-bold' : 'text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{average.toFixed(1)}</span>
          ) : (
            <span className={cn(isMobile ? 'text-lg' : 'text-lg', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>—</span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Bienvenida
function WelcomeTab({
  theme,
  stats,
  rankingFilters,
  setRankingFilters,
  studentSummaries,
  evolutionFilters,
  setEvolutionFilters,
  totalStudents,
  gradeSummary,
  gradeSummaryLoading,
  gradeSummaryError,
  refetchGradeSummary,
}: any) {
  const isMobile = useIsMobile()
  return (
    <div>
      {/* Estadísticas principales */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-4 fade-in duration-200 items-start">
        {/* Total Estudiantes */}
        <div className="fade-in duration-200">
          <Card className={cn('relative overflow-hidden border-0 shadow-lg', theme === 'dark' ? 'bg-zinc-900' : 'bg-white')}>
            <div className={cn('absolute top-0 right-0 w-14 h-14 bg-gradient-to-br opacity-10 rounded-full -mr-7 -mt-7', 'from-green-500 to-green-600')} />
            <CardHeader className={cn('flex flex-row items-center justify-between space-y-0 relative z-10', isMobile ? 'py-1 px-2 pb-0' : 'py-1 px-3 pb-0')}>
              <CardTitle className={cn(isMobile ? 'text-[11px] font-medium' : 'text-xs font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Total Estudiantes</CardTitle>
              <Users className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-green-500 shrink-0')} />
            </CardHeader>
            <CardContent className={cn('relative z-10 pt-0.5', isMobile ? 'px-2 pb-1.5' : 'px-3 pb-2.5')}>
              <span className={cn(isMobile ? 'text-xl font-bold' : 'text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{(totalStudents ?? stats.totalStudents).toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>

        {/* Promedio del Grado (con filtro de fase) */}
        <GradeAverageCard
          theme={theme}
          gradeSummary={gradeSummary}
          gradeSummaryLoading={gradeSummaryLoading}
          gradeSummaryError={gradeSummaryError}
          refetchGradeSummary={refetchGradeSummary}
        />
      </div>

      {/* Ranking de mejores estudiantes y logros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
        <TeacherEvolutionBySubjectChart
          theme={theme}
          filters={evolutionFilters}
          setFilters={setEvolutionFilters}
          gradeSummary={gradeSummary}
          gradeSummaryLoading={gradeSummaryLoading}
          gradeSummaryError={gradeSummaryError}
          refetchGradeSummary={refetchGradeSummary}
        />

        <TeacherRankingCard
          theme={theme}
          studentSummaries={studentSummaries || []}
          rankingFilters={rankingFilters}
          setRankingFilters={setRankingFilters}
        />
      </div>
    </div>
  )
}

// Componente de Estudiantes (Análisis por estudiante - igual que coordinador)
function StudentsTab({ theme, studentSummaries, stats }: any) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [selectedSummary, setSelectedSummary] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const safeGradeName = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!trimmed) return null
    return looksLikeTechnicalId(trimmed) ? null : trimmed
  }

  const studentRows = (studentSummaries || []).map((s: any) => ({
    id: s.studentId || s.id,
    name: s.studentName || 'Estudiante',
    gradeName: safeGradeName(s.gradeName) || safeGradeName(stats?.gradeName) || 'Sin grado',
    campusName: s.campusName || stats?.campusName || '',
    jornada: s.jornada || '',
    summary: s,
  }))

  const groupedStudents = (studentRows || []).reduce((acc: any, student: any) => {
    const gradeName = student.gradeName || 'Sin grado'
    if (!acc[gradeName]) acc[gradeName] = { gradeName, students: [] }
    acc[gradeName].students.push(student)
    return acc
  }, {})

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student)
    setSelectedSummary(student.summary || null)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6" role="region" aria-label="Listado de estudiantes por grado">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="pb-2">
          <CardTitle className={cn('flex items-center gap-2 text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')} aria-label={`Total estudiantes: ${studentRows?.length ?? 0}`}>
            <Users className={cn('h-4 w-4', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Total Estudiantes: {studentRows?.length ?? 0}
          </CardTitle>
          <CardDescription className="text-xs">
            {buildStudentsAssignedDescription(stats)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!studentRows?.length ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                No hay estudiantes asignados
              </h3>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                No tienes estudiantes asignados en tu grado actual.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto">
              {Object.values(groupedStudents).map((group: any, groupIndex: number) => (
                <div key={groupIndex} className="space-y-2">
                  <div className={cn('flex items-center gap-2 pb-2 border-b', theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
                    <School className={cn('h-4 w-4', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                    <span className={cn('font-semibold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {group.gradeName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {group.students.map((student: any) => (
                      <div
                        key={student.id}
                        onClick={() => handleStudentClick(student)}
                        className={cn(
                          'p-2 rounded-lg border cursor-pointer transition-transform duration-200 hover:scale-[1.02]',
                          theme === 'dark'
                            ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-600'
                            : 'border-gray-300 bg-gray-200 hover:bg-gray-300 hover:border-gray-400'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0',
                            theme === 'dark' ? 'bg-gradient-to-br from-blue-800 to-slate-800' : 'bg-gradient-to-br from-blue-700 to-slate-700'
                          )}>
                            {(student.name || 'E').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-medium text-xs truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {student.name || 'Estudiante'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDetailDialog
          student={selectedStudent}
          studentSummary={selectedSummary}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedStudent(null)
            setSelectedSummary(null)
          }}
          theme={theme}
        />
      )}
    </div>
  )
}

// Diálogo Resumen y Diagnóstico del estudiante (misma funcionalidad que coordinador)
function StudentDetailDialog({
  student,
  studentSummary,
  isOpen,
  onClose,
  theme,
}: {
  student: any
  studentSummary: StudentProgressSummaryDoc | null
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark'
}) {
  const studentId = student?.id || student?.uid || studentSummary?.studentId
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('phase1')

  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      biologia: 'Biologia', quimica: 'Quimica', fisica: 'Física', matematicas: 'Matemáticas',
      lenguaje: 'Lenguaje', 'ciencias sociales': 'Ciencias Sociales', ingles: 'Inglés'
    }
    return subjectMap[normalized] || subject
  }

  const evaluations = useMemo(() => {
    if (!studentSummary || !studentId) return []
    return examResultsFromSummaryData(studentSummary, studentId)
  }, [studentSummary, studentId])

  const phasesData = useMemo(() => {
    const phaseResults: { [key: string]: any[] } = { phase1: [], phase2: [], phase3: [] }
    evaluations.forEach((exam: any) => {
      if (!exam?.completed || !exam?.score || !exam?.subject) return
      const subject = normalizeSubjectName(exam.subject)
      const percentage = exam.score?.overallPercentage || 0
      const key =
        exam.phase === 'first' || exam.phase === 'Fase I'
          ? 'phase1'
          : exam.phase === 'second' || exam.phase === 'Fase II'
            ? 'phase2'
            : exam.phase === 'third' || exam.phase === 'Fase III'
              ? 'phase3'
              : null
      if (!key) return
      phaseResults[key].push({ subject, percentage })
    })
    const processPhaseData = (results: any[]) => {
      const subjectScores: { [subject: string]: number } = {}
      results.forEach((r) => {
        if (!subjectScores[r.subject] || r.percentage > subjectScores[r.subject]) {
          subjectScores[r.subject] = r.percentage
        }
      })
      return Object.entries(subjectScores).map(([name, percentage]) => ({
        name,
        percentage: Math.round(percentage),
      }))
    }
    return {
      phase1: phaseResults.phase1.length > 0 ? { phase: 'phase1' as const, subjects: processPhaseData(phaseResults.phase1) } : null,
      phase2: phaseResults.phase2.length > 0 ? { phase: 'phase2' as const, subjects: processPhaseData(phaseResults.phase2) } : null,
      phase3: phaseResults.phase3.length > 0 ? { phase: 'phase3' as const, subjects: processPhaseData(phaseResults.phase3) } : null,
    }
  }, [evaluations])

  const subjectsData = useMemo(() => {
    const selectedPhaseKeys =
      selectedPhase === 'all'
        ? ['first', 'second', 'third']
        : selectedPhase === 'phase1'
          ? ['first']
          : selectedPhase === 'phase2'
            ? ['second']
            : ['third']
    const subjectTopicGroups: { [subject: string]: { [topic: string]: any[] } } = {}
    const subjectScores: { [subject: string]: number } = {}
    const subjectTotals: { [subject: string]: { correct: number; total: number } } = {}

    evaluations.forEach((exam: any) => {
      if (!exam?.completed || !exam?.score || !exam?.subject) return
      if (!selectedPhaseKeys.includes(exam.phase)) return
      const sub = normalizeSubjectName(exam.subject)
      const pct = exam.score?.overallPercentage || 0
      if (!subjectScores[sub] || pct > subjectScores[sub]) subjectScores[sub] = pct
      if (!subjectTotals[sub]) subjectTotals[sub] = { correct: 0, total: 0 }
      subjectTotals[sub].correct += exam.score?.correctAnswers || 0
      subjectTotals[sub].total += exam.score?.totalQuestions || 0
      const details = Array.isArray(exam.questionDetails) ? exam.questionDetails : []
      details.forEach((q: any) => {
        const topic = q.topic || 'General'
        if (!subjectTopicGroups[sub]) subjectTopicGroups[sub] = {}
        if (!subjectTopicGroups[sub][topic]) subjectTopicGroups[sub][topic] = []
        subjectTopicGroups[sub][topic].push(q)
      })
    })

    const subjectsWithTopics: any[] = []
    Object.entries(subjectTopicGroups).forEach(([sub, topics]) => {
      const topicData = Object.entries(topics).map(([topicName, questions]) => {
        const correct = questions.filter((q: any) => q.isCorrect).length
        const total = questions.length
        return { name: topicName, percentage: total > 0 ? Math.round((correct / total) * 100) : 0, correct, total }
      })
      subjectsWithTopics.push({
        name: sub,
        percentage: Math.round(subjectScores[sub] || 0),
        topics: topicData,
        strengths: topicData.filter((t) => t.percentage >= 65).map((t) => t.name),
        weaknesses: topicData.filter((t) => t.percentage < 50).map((t) => t.name),
        neutrals: topicData.filter((t) => t.percentage >= 50 && t.percentage < 65).map((t) => t.name),
      })
    })
    const subjects = Object.entries(subjectScores).map(([name, percentage]) => ({
      name,
      percentage: Math.round(percentage),
      score: Math.round(percentage),
      maxScore: 100,
      correct: subjectTotals[name]?.correct ?? 0,
      total: subjectTotals[name]?.total ?? 0,
      strengths: subjectsWithTopics.find((s) => s.name === name)?.strengths ?? [],
      weaknesses: subjectsWithTopics.find((s) => s.name === name)?.weaknesses ?? [],
      improvement: '',
    }))
    return { subjects, subjectsWithTopics }
  }, [evaluations, selectedPhase])

  const studentAnalysis = useMemo(() => {
    const bySubjectBest: Record<string, number> = {}
    const phaseSubjects = {
      phase1: new Set<string>(),
      phase2: new Set<string>(),
      phase3: new Set<string>(),
    }
    let fraudAttempts = 0
    let totalTime = 0
    let totalQuestions = 0
    let fastAnswers = 0
    let answeredWithTime = 0

    evaluations.forEach((exam: any) => {
      if (!exam?.completed || !exam?.score || !exam?.subject) return
      const subject = normalizeSubjectName(exam.subject)
      const pct = exam.score?.overallPercentage || 0
      if (!bySubjectBest[subject] || pct > bySubjectBest[subject]) bySubjectBest[subject] = pct

      if (exam.phase === 'first') phaseSubjects.phase1.add(subject)
      if (exam.phase === 'second') phaseSubjects.phase2.add(subject)
      if (exam.phase === 'third') phaseSubjects.phase3.add(subject)

      if ((exam.tabChangeCount ?? 0) > 0 || exam.lockedByTabChange === true) fraudAttempts += 1
      const details = Array.isArray(exam.questionDetails) ? exam.questionDetails : []
      details.forEach((q: any) => {
        const t = q.timeSpent || 0
        if (t > 0) {
          totalTime += t
          totalQuestions += 1
          if (q.answered && subject !== 'Inglés') {
            answeredWithTime += 1
            if (t < 10) fastAnswers += 1
          }
        }
      })
    })

    const NATURALES = ['Biologia', 'Quimica', 'Física']
    let globalScore = 0
    Object.entries(bySubjectBest).forEach(([subject, pct]) => {
      globalScore += NATURALES.includes(subject) ? (pct / 100) * (100 / 3) : (pct / 100) * 100
    })
    const avgTime = totalQuestions > 0 ? totalTime / totalQuestions / 60 : 0
    const luckPercentage = answeredWithTime > 0 ? Math.round((fastAnswers / answeredWithTime) * 100) : 0
    const metricsByPhase = (phase: 'phase1' | 'phase2' | 'phase3') => ({
      globalScore: Math.round(globalScore),
      phasePercentage: Math.round((phaseSubjects[phase].size / 7) * 100),
      averageTimePerQuestion: avgTime,
      fraudAttempts,
      luckPercentage,
      completedSubjects: phaseSubjects[phase].size,
    })
    return {
      globalScore: Math.round(globalScore),
      phase3Percentage: Math.round((phaseSubjects.phase3.size / 7) * 100),
      averageTimePerQuestion: avgTime,
      fraudAttempts,
      luckPercentage,
      phaseMetrics: {
        phase1: metricsByPhase('phase1'),
        phase2: metricsByPhase('phase2'),
        phase3: metricsByPhase('phase3'),
      },
    }
  }, [evaluations])

  const isLoading = false
  const subjectsLoading = false
  const phasesLoading = false
  const analysisError = null
  const subjectsError = null
  const phasesError = null
  const refetchAnalysis = () => {}
  const refetchSubjects = () => {}
  const refetchPhases = () => {}

  if (!student) return null

  const getPhaseMetrics = () => {
    if (!studentAnalysis) return null
    if (selectedPhase === 'all') {
      return {
        globalScore: studentAnalysis.globalScore || 0,
        phasePercentage: studentAnalysis.phase3Percentage || 0,
        averageTimePerQuestion: studentAnalysis.averageTimePerQuestion || 0,
        fraudAttempts: studentAnalysis.fraudAttempts || 0,
        luckPercentage: studentAnalysis.luckPercentage || 0,
        completedSubjects: 7,
      }
    }
    const phase = selectedPhase === 'phase1' ? 'phase1' : selectedPhase === 'phase2' ? 'phase2' : 'phase3'
    return studentAnalysis.phaseMetrics?.[phase] || {
      globalScore: 0,
      phasePercentage: 0,
      averageTimePerQuestion: 0,
      fraudAttempts: 0,
      luckPercentage: 0,
      completedSubjects: 0,
    }
  }

  const phaseMetrics = getPhaseMetrics()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('max-w-6xl max-h-[90vh] overflow-y-auto', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}>
        <DialogHeader>
          <DialogTitle className={cn('text-xl', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {student.name || student.displayName || 'Estudiante'} - Resumen y Diagnóstico
          </DialogTitle>
          <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.campusName && `${student.campusName} • `}{student.gradeName || ''}
          </DialogDescription>
        </DialogHeader>

        {analysisError ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className={cn('text-sm', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar el análisis</p>
            <Button variant="outline" size="sm" onClick={() => refetchAnalysis()}>
              <RotateCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4 py-4" aria-busy="true" aria-label="Cargando análisis del estudiante">
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={cn('h-16 w-24 rounded-lg animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
              ))}
            </div>
            <div className={cn('h-32 rounded-lg animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
          </div>
        ) : studentAnalysis && phaseMetrics ? (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Seleccionar fase">
              {(['phase1', 'phase2', 'phase3', 'all'] as const).map((phase) => (
                <Button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  variant={selectedPhase === phase ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedPhase === phase}
                  aria-label={phase === 'phase1' ? 'Fase I' : phase === 'phase2' ? 'Fase II' : phase === 'phase3' ? 'Fase III' : 'Todas las fases'}
                  className={cn(
                    selectedPhase === phase ? (phase === 'phase1' ? 'bg-blue-600 hover:bg-blue-700' : phase === 'phase2' ? 'bg-green-600 hover:bg-green-700' : phase === 'phase3' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700') : theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : '')}
                >
                  {phase === 'phase1' ? 'Fase I' : phase === 'phase2' ? 'Fase II' : phase === 'phase3' ? 'Fase III' : 'Todas las Fases'}
                  {phase !== 'all' && studentAnalysis.phaseMetrics?.[phase] && (
                    <Badge className="ml-2">{studentAnalysis.phaseMetrics[phase].completedSubjects} materias</Badge>
                  )}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{phaseMetrics.globalScore}</p>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntaje Global</p>
                    </div>
                    <Award className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-green-400' : 'text-green-700')}>{phaseMetrics.phasePercentage}%</p>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Fase {selectedPhase === 'phase1' ? 'I' : selectedPhase === 'phase2' ? 'II' : selectedPhase === 'phase3' ? 'III' : ''}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Progress value={phaseMetrics.phasePercentage} className="h-2" />
                    <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{phaseMetrics.completedSubjects} de 7 materias completadas</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{phaseMetrics.averageTimePerQuestion.toFixed(1)}m</p>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo Promedio por Pregunta</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : phaseMetrics.fraudAttempts === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200' : phaseMetrics.fraudAttempts <= 2 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200' : 'bg-gradient-to-br from-red-50 to-rose-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold', phaseMetrics.fraudAttempts === 0 ? (theme === 'dark' ? 'text-green-400' : 'text-green-700') : phaseMetrics.fraudAttempts <= 2 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700') : (theme === 'dark' ? 'text-red-400' : 'text-red-700'))}>{phaseMetrics.fraudAttempts}</p>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Intento de fraude</p>
                    </div>
                    <Shield className={cn('h-8 w-8', phaseMetrics.fraudAttempts === 0 ? 'text-green-500' : phaseMetrics.fraudAttempts <= 2 ? 'text-yellow-500' : 'text-red-500')} />
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : phaseMetrics.luckPercentage < 20 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200' : phaseMetrics.luckPercentage <= 40 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200' : 'bg-gradient-to-br from-orange-50 to-red-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('text-2xl font-bold', phaseMetrics.luckPercentage < 20 ? (theme === 'dark' ? 'text-green-400' : 'text-green-700') : phaseMetrics.luckPercentage <= 40 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700') : (theme === 'dark' ? 'text-orange-400' : 'text-orange-700'))}>{phaseMetrics.luckPercentage}%</p>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Suerte</p>
                    </div>
                    <Zap className={cn('h-8 w-8', phaseMetrics.luckPercentage < 20 ? 'text-green-500' : phaseMetrics.luckPercentage <= 40 ? 'text-yellow-500' : 'text-orange-500')} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="resumen" className="space-y-4">
              <TabsList className={cn('grid w-full grid-cols-3', theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100')}>
                <TabsTrigger value="resumen" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>Resumen</TabsTrigger>
                <TabsTrigger value="diagnostico" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>Diagnóstico</TabsTrigger>
                <TabsTrigger value="reporteAcademico" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>
                  Reporte académico
                </TabsTrigger>
              </TabsList>
              <TabsContent value="resumen" className="space-y-4">
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200')}>
                  <CardHeader>
                    <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <PieChartIcon className="h-5 w-5" />
                      Rendimiento académico por materia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectsError ? (
                      <div className="flex flex-col items-center gap-2 py-6">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar materias</p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetchSubjects()}>
                          <RotateCw className="h-3 w-3 mr-1" /> Reintentar
                        </Button>
                      </div>
                    ) : subjectsLoading ? (
                      <div className="space-y-3 py-4" aria-busy="true" aria-label="Cargando rendimiento por materia">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={cn('h-10 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                        ))}
                      </div>
                    ) : subjectsData && subjectsData.subjectsWithTopics && subjectsData.subjectsWithTopics.length > 0 ? (
                      <PerformanceChart data={subjectsData.subjects} subjectsWithTopics={subjectsData.subjectsWithTopics} theme={theme} />
                    ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                      <PerformanceChart data={subjectsData.subjects} theme={theme} />
                    ) : (
                      <p className={cn('text-sm text-center py-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de materias disponibles para esta fase</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="reporteAcademico" className="space-y-4">
                {selectedPhase === 'all' ? (
                  <p className={cn('text-sm text-center py-6', theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                    Selecciona Fase I, II o III (arriba) para ver o generar el reporte académico con IA.
                  </p>
                ) : studentId ? (
                  <AcademicReportSection
                    studentId={studentId}
                    phase={
                      (selectedPhase === 'phase1'
                        ? 'first'
                        : selectedPhase === 'phase2'
                          ? 'second'
                          : 'third') as AcademicPhaseKey
                    }
                    studentSummary={studentSummary}
                    theme={theme}
                  />
                ) : null}
              </TabsContent>
              <TabsContent value="diagnostico" className="space-y-6">
                {subjectsError || phasesError ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className={cn('text-sm', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar diagnóstico</p>
                    <Button variant="outline" size="sm" onClick={() => { refetchSubjects(); refetchPhases(); }}>
                      <RotateCw className="h-4 w-4 mr-2" /> Reintentar
                    </Button>
                  </div>
                ) : subjectsLoading || phasesLoading ? (
                  <div className="space-y-4 py-4" aria-busy="true" aria-label="Cargando diagnóstico">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className={cn('h-48 rounded-lg animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                      <div className={cn('h-48 rounded-lg animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                    </div>
                    <div className={cn('h-24 rounded-lg animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                  </div>
                ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <StrengthsRadarChart subjects={subjectsData.subjects} theme={theme} />
                      <SubjectsProgressChart phase1Data={phasesData?.phase1 ?? null} phase2Data={phasesData?.phase2 ?? null} phase3Data={phasesData?.phase3 ?? null} theme={theme} />
                    </div>
                    <SubjectsDetailedSummary subjects={subjectsData.subjects} subjectsWithTopics={subjectsData.subjectsWithTopics ?? []} theme={theme} />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de diagnóstico disponibles para esta fase</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos disponibles para este estudiante</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function getTestDisplayName(testName: string): string {
  const map: Record<string, string> = {
    'Prueba 1': 'Comprensión de avisos públicos',
    'Prueba 2': 'Vocabulario, Asociación semántica',
    'Prueba 3': 'Competencia comunicativa',
    'Prueba 4': 'Comprensión lectora',
    'Prueba 5': 'Comprensión global del texto',
    'Prueba 6': 'Comprensión lectora avanzada',
    'Prueba 7': 'Preposiciones y conectores'
  }
  return map[testName] || testName
}

function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: any[]; theme?: 'light' | 'dark'; subjectsWithTopics?: any[] }) {
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject: any) => {
          const hasStrengths = subject.strengths?.length > 0
          const hasNeutrals = subject.neutrals?.length > 0
          const hasWeaknesses = subject.weaknesses?.length > 0
          const isEnglish = subject.name === 'Inglés' || subject.name?.toLowerCase() === 'inglés'
          const getPercentageColor = (pct: number) => {
            if (pct >= 65) return theme === 'dark' ? 'text-green-400' : 'text-green-600'
            if (pct >= 50) return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            return theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }
          return (
            <AccordionItem key={subject.name} value={subject.name} className={cn('border-b', theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
              <AccordionTrigger className={cn('hover:no-underline', theme === 'dark' ? 'text-white' : '')}>
                <div className="flex items-center justify-between w-full pr-4">
                  <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-sm font-semibold', getPercentageColor(subject.percentage))}>{subject.percentage}%</span>
                    {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                      <div className="flex items-center gap-1.5">
                        {hasStrengths && <Badge className={cn('text-[10px] px-1.5 py-0', theme === 'dark' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-300')}>{subject.strengths.length}</Badge>}
                        {hasNeutrals && <Badge className={cn('text-[10px] px-1.5 py-0', theme === 'dark' ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-700 border-yellow-300')}>{subject.neutrals.length}</Badge>}
                        {hasWeaknesses && <Badge className={cn('text-[10px] px-1.5 py-0', theme === 'dark' ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-300')}>{subject.weaknesses.length}</Badge>}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className={cn('space-y-4 pt-2', theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border border-gray-200')}>
                  {subject.topics?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className={cn('text-xs font-semibold mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Temas</h4>
                      {subject.topics.map((topic: any) => (
                        <div key={topic.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={cn('text-xs font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{isEnglish ? getTestDisplayName(topic.name) : topic.name}</span>
                            <span className={cn('text-xs font-semibold', getPercentageColor(topic.percentage))}>{topic.percentage}%</span>
                          </div>
                          <Progress value={topic.percentage} className={cn('h-2', topic.percentage >= 65 ? 'bg-green-500' : topic.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500')} />
                        </div>
                      ))}
                    </div>
                  )}
                  {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                    <div className="flex items-center gap-4 flex-wrap">
                      {hasStrengths && <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className={cn('text-xs font-semibold', theme === 'dark' ? 'text-green-400' : 'text-green-700')}>Fortalezas ({subject.strengths.length})</span></div>}
                      {hasNeutrals && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-500" /><span className={cn('text-xs font-semibold', theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700')}>Neutro ({subject.neutrals.length})</span></div>}
                      {hasWeaknesses && <div className="flex items-center gap-2"><Target className="h-4 w-4 text-red-500" /><span className={cn('text-xs font-semibold', theme === 'dark' ? 'text-red-400' : 'text-red-700')}>Debilidades ({subject.weaknesses.length})</span></div>}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    )
  }
  return (
    <div className="space-y-4">
      {data.map((subject: any) => {
        const percentage = subject.percentage ?? subject.score
        const getColor = (pct: number) => (pct >= 65 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : pct >= 50 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600') : theme === 'dark' ? 'text-red-400' : 'text-red-600')
        return (
          <div key={subject.name} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
              <span className={cn('text-sm font-semibold', getColor(percentage))}>{percentage}%</span>
            </div>
            <Progress value={percentage} className={cn('h-2', percentage >= 65 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500')} />
          </div>
        )
      })}
    </div>
  )
}

// Preparar datos de materias y temas por fase (promedio del salón)
function prepareSubjectTopicsData(
  phase1Data: { subjectsWithTopics: { name: string; percentage: number; topics: { name: string; percentage: number }[] }[] } | null,
  phase2Data: { subjectsWithTopics: { name: string; percentage: number; topics: { name: string; percentage: number }[] }[] } | null,
  phase3Data: { subjectsWithTopics: { name: string; percentage: number; topics: { name: string; percentage: number }[] }[] } | null
): { subjectName: string; topics: { topic: string; phase1: number | null; phase2: number | null; phase3: number | null }[]; averagePerformance: number; trend: 'up' | 'down' | 'stable' }[] {
  const allSubjects = new Set<string>()
  phase1Data?.subjectsWithTopics?.forEach(s => allSubjects.add(s.name))
  phase2Data?.subjectsWithTopics?.forEach(s => allSubjects.add(s.name))
  phase3Data?.subjectsWithTopics?.forEach(s => allSubjects.add(s.name))
  const subjectOrder: Record<string, number> = {
    Matemáticas: 1, Lenguaje: 2, 'Ciencias Sociales': 3, Biologia: 4, Quimica: 5, Física: 6, Inglés: 7
  }
  const result = Array.from(allSubjects).map(subjectName => {
    const phase1Subject = phase1Data?.subjectsWithTopics?.find(s => s.name === subjectName)
    const phase2Subject = phase2Data?.subjectsWithTopics?.find(s => s.name === subjectName)
    const phase3Subject = phase3Data?.subjectsWithTopics?.find(s => s.name === subjectName)
    const buildPhaseMap = (
      subjectData?: { name: string; percentage: number; topics: { name: string; percentage: number }[] }
    ): Map<string, number> => {
      const map = new Map<string, { sum: number; count: number }>()
      subjectData?.topics.forEach((topic) => {
        const canonicalTopic = canonicalizeTopicName(subjectName, topic.name)
        const current = map.get(canonicalTopic) || { sum: 0, count: 0 }
        map.set(canonicalTopic, {
          sum: current.sum + topic.percentage,
          count: current.count + 1,
        })
      })

      const averaged = new Map<string, number>()
      map.forEach((value, key) => averaged.set(key, Math.round(value.sum / value.count)))
      return averaged
    }

    const phase1Map = buildPhaseMap(phase1Subject)
    const phase2Map = buildPhaseMap(phase2Subject)
    const phase3Map = buildPhaseMap(phase3Subject)
    const allTopics = new Set<string>([
      ...Array.from(phase1Map.keys()),
      ...Array.from(phase2Map.keys()),
      ...Array.from(phase3Map.keys()),
    ])

    const topics = Array.from(allTopics).map(topicName => {
      return {
        topic: topicName,
        phase1: phase1Map.get(topicName) ?? null,
        phase2: phase2Map.get(topicName) ?? null,
        phase3: phase3Map.get(topicName) ?? null
      }
    })
    const p1 = phase1Subject?.percentage ?? null
    const p2 = phase2Subject?.percentage ?? null
    const p3 = phase3Subject?.percentage ?? null
    const valid = [p1, p2, p3].filter((p): p is number => p !== null)
    const averagePerformance = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0
    let trend: 'up' | 'down' | 'stable' = 'stable'
    const firstPhase = p1 ?? p2 ?? p3
    const lastPhase = p3 ?? p2 ?? p1
    if (firstPhase != null && lastPhase != null && firstPhase !== lastPhase) {
      const change = (lastPhase - firstPhase) / firstPhase * 100
      if (Math.abs(change) >= 2) trend = change > 0 ? 'up' : 'down'
    }
    return { subjectName, topics, averagePerformance, trend }
  })
  result.sort((a, b) => (subjectOrder[a.subjectName] ?? 999) - (subjectOrder[b.subjectName] ?? 999))
  return result
}

// Análisis del curso: rendimiento por materia y por ejes/temas (promedio del salón)
function CourseAnalysisTab({
  theme,
  gradeSummary,
  gradeSummaryLoading,
  gradeSummaryError,
  refetchGradeSummary,
}: {
  theme: 'light' | 'dark'
  gradeSummary: GradeSummaryDoc | null | undefined
  gradeSummaryLoading: boolean
  gradeSummaryError: unknown
  refetchGradeSummary: () => void
}) {
  const normalizeSubject = (s: string): string => {
    const n = s.trim()
    const map: Record<string, string> = {
      Matemáticas: 'Matemáticas', Matematicas: 'Matemáticas', Lenguaje: 'Lenguaje',
      'Ciencias Sociales': 'Ciencias Sociales', Sociales: 'Ciencias Sociales',
      Biologia: 'Biologia', Biología: 'Biologia', Quimica: 'Quimica', Química: 'Quimica',
      Física: 'Física', Fisica: 'Física', Inglés: 'Inglés', Ingles: 'Inglés'
    }
    return map[n] || n
  }

  const phasesData = useMemo(() => {
    if (!gradeSummary?.phases) return { phase1: null, phase2: null, phase3: null }
    const buildPhaseSubjectsWithTopics = (phaseKey: 'first' | 'second' | 'third') => {
      const bySubject = gradeSummary.phases[phaseKey]?.subjects || {}
      return Object.entries(bySubject).map(([subjectSlug, subjectData]) => {
        const topics = Object.entries(subjectData.topics || {}).map(([topicName, topicData]) => ({
          name: topicName,
          percentage: Math.round(topicData.pct ?? 0)
        }))
        return {
          name: normalizeSubject(displayNameFromSubjectSlug(subjectSlug)),
          percentage: Math.round(subjectData.avgPct ?? 0),
          topics
        }
      })
    }
    return {
      phase1: { subjectsWithTopics: buildPhaseSubjectsWithTopics('first') },
      phase2: { subjectsWithTopics: buildPhaseSubjectsWithTopics('second') },
      phase3: { subjectsWithTopics: buildPhaseSubjectsWithTopics('third') }
    }
  }, [gradeSummary])

  const phase1 = phasesData?.phase1 ?? null
  const phase2 = phasesData?.phase2 ?? null
  const phase3 = phasesData?.phase3 ?? null
  const subjectTopicsData = phase1 && (phase2 || phase3)
    ? prepareSubjectTopicsData(phase1, phase2, phase3)
    : []
  const rawValid = subjectTopicsData.filter(
    s => s.topics.length > 0 && s.topics.some(t => t.phase1 !== null || t.phase2 !== null || t.phase3 !== null)
  )
  // Para Inglés, mostrar nombres de temas del frontend (ej. "Comprensión de avisos públicos") en lugar de "Prueba 1", "Prueba 2", etc.
  const subjectsWithValidData = rawValid.map(subject =>
    (subject.subjectName === 'Inglés' || subject.subjectName?.toLowerCase() === 'inglés')
      ? { ...subject, topics: subject.topics.map(t => ({ ...t, topic: getTestDisplayName(t.topic) })) }
      : subject
  )

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <TrendingUp className={cn('h-5 w-5', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
            Rendimiento por Materia
          </CardTitle>
          <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Por cada eje, tres barras (Fase I, II y III) para comparar el promedio del salón entre fases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gradeSummaryError ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className={cn('text-sm text-center', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar el análisis del curso.</p>
              <Button variant="outline" size="sm" onClick={() => refetchGradeSummary()} className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}>
                <RotateCw className="h-4 w-4 mr-2" /> Reintentar
              </Button>
            </div>
          ) : gradeSummaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={cn('h-6 w-6 animate-spin', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            </div>
          ) : subjectsWithValidData.length > 0 ? (
            <SubjectTopicsAccordion subjects={subjectsWithValidData} theme={theme} />
          ) : (
            <div className={cn('text-center py-12', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              <BarChart3 className={cn('h-12 w-12 mx-auto mb-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
              <p>No hay datos de temas por fase para mostrar</p>
              <p className="text-sm mt-2">Se necesitan resultados de tus estudiantes en al menos 2 fases para ver el análisis por ejes del curso</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
