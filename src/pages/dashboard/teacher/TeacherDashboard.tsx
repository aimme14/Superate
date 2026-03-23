import { useState, useEffect } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  GraduationCap, 
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
import { DASHBOARD_TEACHER_CACHE } from '@/config/dashboardTeacherCache'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { useStudentAnalysis } from '@/hooks/query/useAdminAnalysis'
import { StrengthsRadarChart } from '@/components/charts/StrengthsRadarChart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'
import { SubjectsDetailedSummary } from '@/components/charts/SubjectsDetailedSummary'
import { SubjectTopicsAccordion } from '@/components/charts/SubjectTopicsAccordion'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { DashboardRoleSkeleton } from '@/components/common/skeletons/DashboardRoleSkeleton'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { getWhatsAppUrl } from '@/components/WhatsAppFab'

const db = getFirestore(firebaseApp)
const RANKING_INITIAL_VISIBLE = 10

interface TeacherDashboardProps extends ThemeContextProps {}

export default function TeacherDashboard({ theme }: TeacherDashboardProps) {
  const { stats, isLoading, students } = useTeacherDashboardStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('inicio')
  const [rankingFilters, setRankingFilters] = useState<{
    jornada: 'mañana' | 'tarde' | 'única' | 'todas'
    phase: 'first' | 'second' | 'third'
    year: number
  }>({
    jornada: 'todas',
    phase: 'first',
    year: new Date().getFullYear()
  })
  const [evolutionFilters, setEvolutionFilters] = useState<{
    year: number
    subject: string
    jornada: string
  }>({
    year: new Date().getFullYear(),
    subject: 'todas',
    jornada: 'todas'
  })

  if (isLoading) {
    return <DashboardRoleSkeleton theme={theme} />
  }

  return (
    <div className={cn('min-h-screen overflow-x-hidden', theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100')}>
      <div className="flex flex-col gap-0.5">
        {/* Header con logo y gradiente */}
        <div
          className={cn(
            'animate-in fade-in slide-in-from-top-2 duration-300',
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
                      'object-contain rounded-lg bg-white/20 backdrop-blur-sm shadow border border-white/30',
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
                    Docencia - {stats.campusName} • {stats.gradeName}
                  </p>
                  <p className={cn('opacity-75 truncate', isMobile ? 'text-[11px] max-w-[180px]' : 'text-xs')}>
                    {institutionName || stats.institutionName} • {stats.teacherEmail}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center border-2 border-white/40 shadow">
                  <GraduationCap className="h-6 w-6 mx-auto text-white" aria-label="Docente" />
                </div>
              </div>
            </div>
          </div>
          <School className={cn('absolute top-0 right-0 opacity-10', isMobile ? 'h-28 w-28' : 'h-40 w-40')} aria-hidden />
        </div>
      </div>

      {/* Botones de acción */}
      <div className="hidden md:grid md:grid-cols-3 gap-3 mx-4 md:mx-6 lg:mx-8 mt-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {[
          { icon: Sparkles, label: 'Inicio', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'inicio' },
          { icon: Users, label: 'Mis Estudiantes', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'estudiantes', count: stats?.totalStudents ?? null },
          { icon: BarChart3, label: 'Análisis del curso', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'analisis-curso' },
        ].map((btn) => (
          <div key={btn.label}>
            <Button
              onClick={() => setActiveTab(btn.tab)}
              className={cn(
                'w-full h-18 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br text-white shadow-lg transition-all',
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
              students={students || []}
              rankingFilters={rankingFilters}
              setRankingFilters={setRankingFilters}
              evolutionFilters={evolutionFilters}
              setEvolutionFilters={setEvolutionFilters}
            />
          </div>
        )}
        {activeTab === 'estudiantes' && (
          <div className="space-y-6">
            <StudentsTab theme={theme} students={students || []} stats={stats} />
          </div>
        )}
        {activeTab === 'analisis-curso' && (
          <div className="space-y-6">
            <CourseAnalysisTab theme={theme} students={students || []} />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
          <div className={cn(
            'flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-xl backdrop-blur',
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

type TeacherRankingFilters = { jornada: string; phase: string; year: number }

async function fetchTeacherRanking(
  students: any[],
  filters: TeacherRankingFilters
): Promise<Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }>> {
  if (!students?.length) return []
  let filtered = [...students]
  if (filters.jornada && filters.jornada !== 'todas') {
    filtered = filtered.filter((s: any) => (s.jornada || '').toLowerCase() === filters.jornada.toLowerCase())
  }
  if (filters.year) {
    const getYear = (s: any): number | null =>
      s.academicYear ?? (s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).getFullYear() : s.createdAt?.toDate ? s.createdAt.toDate().getFullYear() : s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000).getFullYear() : null) : null)
    filtered = filtered.filter((s: any) => {
      const y = getYear(s)
      return y !== null && y === filters.year
    })
  }
  const studentIds = filtered.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
  if (studentIds.length === 0) return []

  const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
  const phaseMap: Record<string, string> = { first: 'fase I', second: 'Fase II', third: 'fase III' }
  const phaseName = phaseMap[filters.phase] || 'fase I'
  const phaseResults: { userId: string; subject: string; score: { overallPercentage: number } }[] = []

  for (const studentId of studentIds) {
    try {
      const phaseRef = collection(db, 'results', studentId, phaseName)
      const phaseSnap = await getDocs(phaseRef)
      phaseSnap.docs.forEach(doc => {
        const examData = doc.data()
        if (examData.completed && examData.score && examData.subject) {
          phaseResults.push({
            userId: studentId,
            subject: examData.subject.trim(),
            score: { overallPercentage: examData.score.overallPercentage || 0 }
          })
        }
      })
    } catch (err) {
      console.error(`Error resultados estudiante ${studentId}:`, err)
    }
  }

  const resultsByStudent = new Map<string, { scores: number[]; subjects: Set<string> }>()
  phaseResults.forEach(r => {
    if (!resultsByStudent.has(r.userId)) resultsByStudent.set(r.userId, { scores: [], subjects: new Set() })
    const data = resultsByStudent.get(r.userId)!
    data.scores.push(r.score.overallPercentage)
    data.subjects.add(r.subject.trim())
  })

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
  filtered.forEach((student: any) => {
    const sid = student.id || student.uid
    const data = resultsByStudent.get(sid)
    if (!data || data.subjects.size === 0) return
    if (!REQUIRED_SUBJECTS.every(sub => data.subjects.has(sub))) return
    const subjectScores: Record<string, number> = {}
    phaseResults.filter(r => r.userId === sid).forEach(r => {
      const sub = normalizeSubject(r.subject || '')
      const pct = r.score?.overallPercentage || 0
      if (!subjectScores[sub] || pct > subjectScores[sub]) subjectScores[sub] = pct
    })
    let globalScore = 0
    Object.entries(subjectScores).forEach(([sub, pct]) => {
      globalScore += NATURALES_SUBJECTS.includes(sub) ? (pct / 100) * POINTS_NAT : (pct / 100) * POINTS_REG
    })
    ranking.push({ student, globalScore: Math.round(globalScore * 100) / 100, totalExams: data.scores.length, completedSubjects: data.subjects.size })
  })
  ranking.sort((a, b) => (a.totalExams === 0 && b.totalExams > 0 ? 1 : a.totalExams > 0 && b.totalExams === 0 ? -1 : b.globalScore - a.globalScore))
  return ranking
}

// Ranking de mejores estudiantes del docente (solo sus estudiantes, con filtros jornada/fase/año)
function TeacherRankingCard({ theme, students, rankingFilters, setRankingFilters }: {
  theme: 'light' | 'dark'
  students: any[]
  rankingFilters: TeacherRankingFilters
  setRankingFilters: (f: any) => void
}) {
  const isMobile = useIsMobile()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const queryClient = useQueryClient()
  const studentsKey = students.map((s: any) => s.id || s.uid).join(',')

  const { data: rankingData, isLoading: rankingLoading, error: rankingError, refetch: refetchRanking } = useQuery({
    queryKey: ['teacher-students-ranking', studentsKey, rankingFilters],
    queryFn: () => fetchTeacherRanking(students, rankingFilters),
    enabled: !!students?.length,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  const [showAllRanking, setShowAllRanking] = useState(false)
  useEffect(() => setShowAllRanking(false), [rankingFilters])

  useEffect(() => {
    if (!students?.length) return
    const currentYear = new Date().getFullYear()
    const base: TeacherRankingFilters = { jornada: 'todas', phase: 'first', year: currentYear }
    ;[
      { ...base, phase: 'second' },
      { ...base, phase: 'third' },
      { ...base, jornada: 'mañana' },
      { ...base, jornada: 'tarde' },
      { ...base, jornada: 'única' },
    ].forEach((f) => {
      queryClient.prefetchQuery({
        queryKey: ['teacher-students-ranking', studentsKey, f],
        queryFn: () => fetchTeacherRanking(students, f),
        staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
        gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
      })
    })
  }, [studentsKey, queryClient])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

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
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'} · {rankingFilters.year}
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
                    <Select value={rankingFilters.year.toString()} onValueChange={(v) => setRankingFilters({ ...rankingFilters, year: parseInt(v) })}>
                      <SelectTrigger className={cn('h-8 w-full text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año académico"><SelectValue /></SelectTrigger>
                      <SelectContent>{years.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
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
              <div className="flex flex-col items-center gap-0.5">
                <label className={cn('text-[10px] leading-none', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Año</label>
                <Select value={rankingFilters.year.toString()} onValueChange={(v) => setRankingFilters({ ...rankingFilters, year: parseInt(v) })}>
                  <SelectTrigger className={cn('h-8 w-20 text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año académico">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
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
                        {item.student.gradeName && <p className={cn(isMobile ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{item.student.gradeName}</p>}
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
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'} · {rankingFilters.year}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Evolución por Materia (solo estudiantes del docente; clave sin materia, filtro materia en cliente)
function TeacherEvolutionBySubjectChart({ theme, students, filters, setFilters }: {
  theme: 'light' | 'dark'
  students: any[]
  filters: { year: number; subject: string; jornada: string }
  setFilters: (f: any) => void
}) {
  const isMobile = useIsMobile()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const subjects = ['todas', 'Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
  const studentsKey = students.map((s: any) => s.id || s.uid).join(',')
  const evolutionDataKey = { year: filters.year, jornada: filters.jornada }

  const { data: evolutionData, isLoading: evolutionLoading, error: evolutionError, refetch: refetchEvolution } = useQuery({
    queryKey: ['teacher-evolution-data', studentsKey, evolutionDataKey],
    queryFn: async ({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[2] as { year: number; jornada: string }
      if (!students?.length) return { chartData: [], subjects: [] }
      let filtered = [...students]
      if (key.year) {
        const getYear = (s: any) => s.academicYear ?? (s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).getFullYear() : s.createdAt?.toDate ? s.createdAt.toDate().getFullYear() : s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000).getFullYear() : null) : null)
        filtered = filtered.filter((s: any) => { const y = getYear(s); return y !== null && y === key.year })
      }
      if (key.jornada && key.jornada !== 'todas') filtered = filtered.filter((s: any) => (s.jornada || '').toLowerCase() === key.jornada.toLowerCase())
      const studentIds = filtered.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
      if (studentIds.length === 0) return { chartData: [], subjects: [] }

      const normalize = (sub: string) => ({ 'Matematicas': 'Matemáticas', 'Sociales': 'Ciencias Sociales', 'Biología': 'Biologia', 'Química': 'Quimica', 'Fisica': 'Física', 'Ingles': 'Inglés' }[sub.trim()] || sub.trim())
      const allPossible = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      const phases = [{ key: 'first', name: 'fase I' }, { key: 'second', name: 'Fase II' }, { key: 'third', name: 'fase III' }]
      const resultsByPhase = new Map<string, Map<string, number[]>>()

      for (const sid of studentIds) {
        for (const phase of phases) {
          try {
            const snap = await getDocs(collection(db, 'results', sid, phase.name))
            snap.docs.forEach(doc => {
              const d = doc.data()
              if (d.completed && d.score && d.subject && allPossible.includes(normalize(d.subject))) {
                const sub = normalize(d.subject)
                if (!resultsByPhase.has(phase.key)) resultsByPhase.set(phase.key, new Map())
                const m = resultsByPhase.get(phase.key)!
                if (!m.has(sub)) m.set(sub, [])
                m.get(sub)!.push(d.score.overallPercentage || 0)
              }
            })
          } catch (_) {}
        }
      }
      const allSubjectsSet = new Set<string>()
      resultsByPhase.forEach(m => m.forEach((_, sub) => allSubjectsSet.add(sub)))
      const allSubjects = Array.from(allSubjectsSet).sort()
      const chartData: any[] = []
      phases.forEach(phase => {
        const point: any = { fase: phase.key === 'first' ? 'Fase I' : phase.key === 'second' ? 'Fase II' : 'Fase III' }
        allSubjects.forEach(sub => {
          const scores = resultsByPhase.get(phase.key)?.get(sub) || []
          point[sub] = scores.length ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 100) / 100 : null
        })
        chartData.push(point)
      })
      return { chartData, subjects: allSubjects }
    },
    enabled: !!students?.length,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

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
              {filters.year} · {filters.subject === 'todas' ? 'Todas' : filters.subject}
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
                    <Select value={filters.year.toString()} onValueChange={(v) => setFilters({ ...filters, year: parseInt(v) })}>
                      <SelectTrigger className={cn('h-8 w-full text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año"><SelectValue placeholder="Año" /></SelectTrigger>
                      <SelectContent>{years.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                    </Select>
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
              <label className={cn('text-[10px] font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Año</label>
              <Select value={filters.year.toString()} onValueChange={(v) => setFilters({ ...filters, year: parseInt(v) })}>
                <SelectTrigger className={cn('h-7 w-20 text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{years.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
              </Select>
            </div>
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
        {evolutionError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className={cn('text-sm text-center', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error al cargar la evolución. Por favor, intenta nuevamente.</p>
            <Button variant="outline" size="sm" onClick={() => refetchEvolution()} className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}>
              <RotateCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        ) : evolutionLoading ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Cargando evolución por materia">
            <div className={cn('h-48 rounded-md animate-pulse', theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200')} />
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: 7 }).map((_, i) => (<div key={i} className={cn('h-4 w-20 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />))}
            </div>
          </div>
        ) : hasChartData && displaySubjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 190 : 240}>
            <LineChart data={evolutionData!.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#3f3f46' : '#d1d5db'} />
              <XAxis dataKey="fase" stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'} tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }} />
              <YAxis domain={[0, 100]} stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'} tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }} />
              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb', borderRadius: '8px' }} labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#111827' }} />
              <Legend wrapperStyle={{ paddingTop: isMobile ? '4px' : '8px' }} iconType="line" iconSize={isMobile ? 6 : 8} formatter={(value) => <span style={{ fontSize: isMobile ? 10 : 11 }}>{value}</span>} />
              {displaySubjects.map((subject: string) => (
                <Line key={subject} type="monotone" dataKey={subject} name={subject} stroke={SUBJECT_COLORS[subject] || '#6b7280'} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : hasChartData && filters.subject !== 'todas' && displaySubjects.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos para {filters.subject} con los filtros seleccionados</p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{filters.year}</p>
          </div>
        ) : (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos disponibles para los filtros seleccionados</p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{filters.year} · {filters.subject === 'todas' ? 'Todas' : filters.subject}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Promedio del grado por fase (tarjeta con filtro de fase)
function GradeAverageCard({ theme, students }: { theme: 'light' | 'dark'; students: any[] }) {
  const isMobile = useIsMobile()
  const [mobilePhaseOpen, setMobilePhaseOpen] = useState(false)
  const [phase, setPhase] = useState<'first' | 'second' | 'third'>('first')
  const phaseMap: Record<string, string> = { first: 'fase I', second: 'Fase II', third: 'fase III' }
  const phaseName = phaseMap[phase]

  const { data: average, isLoading, error: averageError, refetch: refetchAverage } = useQuery({
    queryKey: ['teacher-grade-average', students.map((s: any) => s.id || s.uid).join(','), phase],
    queryFn: async () => {
      if (!students?.length) return null
      const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
      const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      const NATURALES = ['Biologia', 'Quimica', 'Física']
      const POINTS_NAT = 100 / 3
      const POINTS_REG = 100
      const normalizeSubject = (s: string): string => {
        const n = s.trim().toLowerCase()
        const map: Record<string, string> = {
          biologia: 'Biologia', quimica: 'Quimica', fisica: 'Física', matematicas: 'Matemáticas',
          lenguaje: 'Lenguaje', 'ciencias sociales': 'Ciencias Sociales', ingles: 'Inglés'
        }
        return map[n] || s
      }

      const phaseResults: { userId: string; subject: string; overallPercentage: number }[] = []
      for (const studentId of studentIds) {
        try {
          const ref = collection(db, 'results', studentId, phaseName)
          const snap = await getDocs(ref)
          snap.docs.forEach(doc => {
            const d = doc.data()
            if (d.completed && d.score && d.subject) {
              phaseResults.push({
                userId: studentId,
                subject: normalizeSubject(d.subject),
                overallPercentage: d.score.overallPercentage ?? 0
              })
            }
          })
        } catch (err) {
          console.error(`Error grade average ${studentId}:`, err)
        }
      }

      const byStudent = new Map<string, Map<string, number>>()
      phaseResults.forEach(r => {
        if (!byStudent.has(r.userId)) byStudent.set(r.userId, new Map())
        const subMap = byStudent.get(r.userId)!
        if (!subMap.has(r.subject) || r.overallPercentage > (subMap.get(r.subject) ?? 0)) {
          subMap.set(r.subject, r.overallPercentage)
        }
      })

      const globalScores: number[] = []
      byStudent.forEach((subMap) => {
        if (!REQUIRED_SUBJECTS.every(sub => subMap.has(sub))) return
        let globalScore = 0
        subMap.forEach((pct, sub) => {
          globalScore += NATURALES.includes(sub) ? (pct / 100) * POINTS_NAT : (pct / 100) * POINTS_REG
        })
        globalScores.push(Math.round(globalScore * 100) / 100)
      })

      if (globalScores.length === 0) return null
      const avg = globalScores.reduce((a, b) => a + b, 0) / globalScores.length
      return Math.round(avg * 100) / 100
    },
    enabled: !!students?.length,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
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
          {averageError ? (
            <div className="flex flex-col gap-1.5">
              <span className={cn('text-xs', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => refetchAverage()}>
                <RotateCw className="h-3 w-3 mr-1" /> Reintentar
              </Button>
            </div>
          ) : isLoading ? (
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
function WelcomeTab({ theme, stats, students, rankingFilters, setRankingFilters, evolutionFilters, setEvolutionFilters }: any) {
  const isMobile = useIsMobile()
  return (
    <div>
      {/* Estadísticas principales */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-4 animate-in fade-in duration-300 items-start">
        {/* Total Estudiantes */}
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <Card className={cn('relative overflow-hidden border-0 shadow-lg', theme === 'dark' ? 'bg-zinc-900' : 'bg-white')}>
            <div className={cn('absolute top-0 right-0 w-14 h-14 bg-gradient-to-br opacity-10 rounded-full -mr-7 -mt-7', 'from-green-500 to-green-600')} />
            <CardHeader className={cn('flex flex-row items-center justify-between space-y-0 relative z-10', isMobile ? 'py-1 px-2 pb-0' : 'py-1 px-3 pb-0')}>
              <CardTitle className={cn(isMobile ? 'text-[11px] font-medium' : 'text-xs font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Total Estudiantes</CardTitle>
              <Users className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', 'text-green-500 shrink-0')} />
            </CardHeader>
            <CardContent className={cn('relative z-10 pt-0.5', isMobile ? 'px-2 pb-1.5' : 'px-3 pb-2.5')}>
              <span className={cn(isMobile ? 'text-xl font-bold' : 'text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalStudents.toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>

        {/* Promedio del Grado (con filtro de fase) */}
        <GradeAverageCard theme={theme} students={students} />
      </div>

      {/* Ranking de mejores estudiantes y logros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
        <TeacherEvolutionBySubjectChart
          theme={theme}
          students={students}
          filters={evolutionFilters}
          setFilters={setEvolutionFilters}
        />

        <TeacherRankingCard
          theme={theme}
          students={students}
          rankingFilters={rankingFilters}
          setRankingFilters={setRankingFilters}
        />
      </div>
    </div>
  )
}

// Componente de Estudiantes (Análisis por estudiante - igual que coordinador)
function StudentsTab({ theme, students, stats }: any) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const groupedStudents = (students || []).reduce((acc: any, student: any) => {
    const gradeName = student.gradeName || 'Sin grado'
    if (!acc[gradeName]) acc[gradeName] = { gradeName, students: [] }
    acc[gradeName].students.push(student)
    return acc
  }, {})

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6" role="region" aria-label="Listado de estudiantes por grado">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="pb-2">
          <CardTitle className={cn('flex items-center gap-2 text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')} aria-label={`Total estudiantes: ${students?.length ?? 0}`}>
            <Users className={cn('h-4 w-4', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Total Estudiantes: {students?.length ?? 0}
          </CardTitle>
          <CardDescription className="text-xs">
            Estudiantes de {stats?.gradeName} en {stats?.campusName}. Haz clic en un estudiante para ver su resumen y diagnóstico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!students?.length ? (
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
                        key={student.id || student.uid}
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
                            {(student.name || student.displayName || 'E').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-medium text-xs truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {student.name || student.displayName || 'Estudiante'}
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
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedStudent(null)
          }}
          theme={theme}
        />
      )}
    </div>
  )
}

// Diálogo Resumen y Diagnóstico del estudiante (misma funcionalidad que coordinador)
function StudentDetailDialog({ student, isOpen, onClose, theme }: { student: any; isOpen: boolean; onClose: () => void; theme: 'light' | 'dark' }) {
  const studentId = student?.id || student?.uid
  const { data: studentAnalysis, isLoading, error: analysisError, refetch: refetchAnalysis } = useStudentAnalysis(studentId, isOpen && !!studentId)
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('phase1')

  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      biologia: 'Biologia', quimica: 'Quimica', fisica: 'Física', matematicas: 'Matemáticas',
      lenguaje: 'Lenguaje', 'ciencias sociales': 'Ciencias Sociales', ingles: 'Inglés'
    }
    return subjectMap[normalized] || subject
  }

  const { data: subjectsData, isLoading: subjectsLoading, error: subjectsError, refetch: refetchSubjects } = useQuery({
    queryKey: ['student-subjects-data', studentId, selectedPhase],
    queryFn: async () => {
      if (!studentId) return { subjects: [], subjectsWithTopics: [] }
      const phases = [{ key: 'first', name: 'fase I' }, { key: 'second', name: 'Fase II' }, { key: 'third', name: 'fase III' }]
      const selectedPhases = selectedPhase === 'all' ? phases : selectedPhase === 'phase1' ? [phases[0]] : selectedPhase === 'phase2' ? [phases[1]] : [phases[2]]
      const subjectTopicGroups: { [subject: string]: { [topic: string]: any[] } } = {}
      const subjectScores: { [subject: string]: number } = {}
      const subjectTotals: { [subject: string]: { correct: number; total: number } } = {}
      for (const phase of selectedPhases) {
        try {
          const phaseRef = collection(db, 'results', studentId, phase.name)
          const phaseSnap = await getDocs(phaseRef)
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            if (examData.completed && examData.score && examData.subject) {
              const sub = normalizeSubjectName(examData.subject)
              const pct = examData.score.overallPercentage || 0
              if (!subjectScores[sub] || pct > subjectScores[sub]) subjectScores[sub] = pct
              if (!subjectTotals[sub]) subjectTotals[sub] = { correct: 0, total: 0 }
              subjectTotals[sub].correct += examData.score.correctAnswers || 0
              subjectTotals[sub].total += examData.score.totalQuestions || 0
              if (examData.questionDetails && Array.isArray(examData.questionDetails)) {
                examData.questionDetails.forEach((q: any) => {
                  const topic = q.topic || 'General'
                  if (!subjectTopicGroups[sub]) subjectTopicGroups[sub] = {}
                  if (!subjectTopicGroups[sub][topic]) subjectTopicGroups[sub][topic] = []
                  subjectTopicGroups[sub][topic].push(q)
                })
              }
            }
          })
        } catch (err) {
          console.error(`Error datos fase ${phase.name}:`, err)
        }
      }
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
          strengths: topicData.filter(t => t.percentage >= 65).map(t => t.name),
          weaknesses: topicData.filter(t => t.percentage < 50).map(t => t.name),
          neutrals: topicData.filter(t => t.percentage >= 50 && t.percentage < 65).map(t => t.name)
        })
      })
      const subjects = Object.entries(subjectScores).map(([name, percentage]) => ({
        name,
        percentage: Math.round(percentage),
        score: Math.round(percentage),
        maxScore: 100,
        correct: subjectTotals[name]?.correct ?? 0,
        total: subjectTotals[name]?.total ?? 0,
        strengths: subjectsWithTopics.find(s => s.name === name)?.strengths ?? [],
        weaknesses: subjectsWithTopics.find(s => s.name === name)?.weaknesses ?? [],
        improvement: ''
      }))
      return { subjects, subjectsWithTopics }
    },
    enabled: isOpen && !!studentId,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  const { data: phasesData, isLoading: phasesLoading, error: phasesError, refetch: refetchPhases } = useQuery({
    queryKey: ['student-phases-data', studentId],
    queryFn: async () => {
      if (!studentId) return { phase1: null, phase2: null, phase3: null }
      const phases = [{ key: 'phase1', name: 'fase I' }, { key: 'phase2', name: 'Fase II' }, { key: 'phase3', name: 'fase III' }]
      const phaseResults: { [key: string]: any[] } = { phase1: [], phase2: [], phase3: [] }
      for (const phase of phases) {
        try {
          const phaseRef = collection(db, 'results', studentId, phase.name)
          const phaseSnap = await getDocs(phaseRef)
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            if (examData.completed && examData.score && examData.subject) {
              phaseResults[phase.key].push({
                subject: normalizeSubjectName(examData.subject),
                percentage: examData.score.overallPercentage || 0
              })
            }
          })
        } catch (err) {
          console.error(`Error fase ${phase.name}:`, err)
        }
      }
      const processPhaseData = (results: any[]) => {
        const subjectScores: { [subject: string]: number } = {}
        results.forEach(r => {
          if (!subjectScores[r.subject] || r.percentage > subjectScores[r.subject]) subjectScores[r.subject] = r.percentage
        })
        return Object.entries(subjectScores).map(([name, percentage]) => ({ name, percentage: Math.round(percentage) }))
      }
      return {
        phase1: phaseResults.phase1.length > 0 ? { phase: 'phase1' as const, subjects: processPhaseData(phaseResults.phase1) } : null,
        phase2: phaseResults.phase2.length > 0 ? { phase: 'phase2' as const, subjects: processPhaseData(phaseResults.phase2) } : null,
        phase3: phaseResults.phase3.length > 0 ? { phase: 'phase3' as const, subjects: processPhaseData(phaseResults.phase3) } : null
      }
    },
    enabled: isOpen && !!studentId,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

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
        completedSubjects: 7
      }
    }
    const phase = selectedPhase === 'phase1' ? 'phase1' : selectedPhase === 'phase2' ? 'phase2' : 'phase3'
    return studentAnalysis.phaseMetrics?.[phase] || {
      globalScore: 0,
      phasePercentage: 0,
      averageTimePerQuestion: 0,
      fraudAttempts: 0,
      luckPercentage: 0,
      completedSubjects: 0
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
              <TabsList className={cn('grid w-full grid-cols-2', theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100')}>
                <TabsTrigger value="resumen" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>Resumen</TabsTrigger>
                <TabsTrigger value="diagnostico" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>Diagnóstico</TabsTrigger>
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
    const allTopics = new Set<string>()
    phase1Subject?.topics.forEach(t => allTopics.add(t.name))
    phase2Subject?.topics.forEach(t => allTopics.add(t.name))
    phase3Subject?.topics.forEach(t => allTopics.add(t.name))
    const topics = Array.from(allTopics).map(topicName => {
      const p1 = phase1Subject?.topics.find(t => t.name === topicName)
      const p2 = phase2Subject?.topics.find(t => t.name === topicName)
      const p3 = phase3Subject?.topics.find(t => t.name === topicName)
      return {
        topic: topicName,
        phase1: p1 ? p1.percentage : null,
        phase2: p2 ? p2.percentage : null,
        phase3: p3 ? p3.percentage : null
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
function CourseAnalysisTab({ theme, students }: { theme: 'light' | 'dark'; students: any[] }) {
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

  const { data: phasesData, isLoading } = useQuery({
    queryKey: ['teacher-course-analysis', students.map((s: any) => s.id || s.uid).join(','), students?.length],
    queryFn: async () => {
      if (!students?.length) return { phase1: null, phase2: null, phase3: null }
      const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
      const phases = [
        { key: 'phase1', name: 'fase I' },
        { key: 'phase2', name: 'Fase II' },
        { key: 'phase3', name: 'fase III' }
      ]
      type SubjectTopicAcc = { correct: number; total: number }
      type SubjectScores = { subjectPcts: number[]; byTopic: Record<string, SubjectTopicAcc> }
      const phaseData: Record<string, Record<string, SubjectScores>> = { phase1: {}, phase2: {}, phase3: {} }

      for (const studentId of studentIds) {
        for (const phase of phases) {
          try {
            const ref = collection(db, 'results', studentId, phase.name)
            const snap = await getDocs(ref)
            snap.docs.forEach(doc => {
              const d = doc.data()
              if (!d.completed || !d.score || !d.subject) return
              const sub = normalizeSubject(d.subject)
              if (!phaseData[phase.key][sub]) {
                phaseData[phase.key][sub] = { subjectPcts: [], byTopic: {} }
              }
              phaseData[phase.key][sub].subjectPcts.push(d.score.overallPercentage ?? 0)
              if (Array.isArray(d.questionDetails)) {
                d.questionDetails.forEach((q: any) => {
                  const topic = (q.topic || 'General').trim()
                  if (!phaseData[phase.key][sub].byTopic[topic]) phaseData[phase.key][sub].byTopic[topic] = { correct: 0, total: 0 }
                  phaseData[phase.key][sub].byTopic[topic].correct += q.isCorrect ? 1 : 0
                  phaseData[phase.key][sub].byTopic[topic].total += 1
                })
              }
            })
          } catch (err) {
            console.error(`Error course analysis ${studentId} ${phase.name}:`, err)
          }
        }
      }

      const buildPhaseSubjectsWithTopics = (phaseKey: string) => {
        const bySubject = phaseData[phaseKey] || {}
        return Object.entries(bySubject).map(([name, data]) => {
          const subjectPct = data.subjectPcts.length > 0
            ? Math.round(data.subjectPcts.reduce((a, b) => a + b, 0) / data.subjectPcts.length)
            : 0
          const topics = Object.entries(data.byTopic).map(([topicName, acc]) => ({
            name: topicName,
            percentage: acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0
          }))
          return { name, percentage: subjectPct, topics }
        })
      }

      return {
        phase1: { subjectsWithTopics: buildPhaseSubjectsWithTopics('phase1') },
        phase2: { subjectsWithTopics: buildPhaseSubjectsWithTopics('phase2') },
        phase3: { subjectsWithTopics: buildPhaseSubjectsWithTopics('phase3') }
      }
    },
    enabled: !!students?.length,
    staleTime: DASHBOARD_TEACHER_CACHE.staleTimeMs,
    gcTime: DASHBOARD_TEACHER_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

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
            Evolución de temas a través de las 3 fases evaluativas (promedio del salón)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
