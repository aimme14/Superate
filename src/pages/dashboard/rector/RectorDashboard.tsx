import { useState, useEffect, useMemo } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Building2,
  Crown,
  Users, 
  GraduationCap, 
  School,
  CalendarDays,
  CheckCircle2,
  Loader2,
  BarChart3,
  Sparkles,
  Target,
  Trophy,
  UserCog
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRectorStats } from '@/hooks/query/useRectorStats'
import { useCampusOptions, useAllGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useStudentsByTeacher, useFilteredStudents } from '@/hooks/query/useStudentQuery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronsUpDown, Award, TrendingUp, Clock, Shield, Zap, PieChart as PieChartIcon, Info, Wrench, ChevronDown, ChevronUp, RotateCw } from 'lucide-react'
import { getWhatsAppUrl } from '@/components/WhatsAppFab'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStudentAnalysis } from '@/hooks/query/useAdminAnalysis'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { DASHBOARD_RECTOR_CACHE } from '@/config/dashboardRectorCache'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getOrBuildRectorEvolutionSnapshot, getOrBuildRectorInstitutionAverageSnapshot } from '@/services/firebase/analyticsSnapshots.service'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, Legend } from 'recharts'
import { StrengthsRadarChart } from '@/components/charts/StrengthsRadarChart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'
import { SubjectsDetailedSummary } from '@/components/charts/SubjectsDetailedSummary'
import { DashboardRoleSkeleton } from '@/components/common/skeletons/DashboardRoleSkeleton'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/ui/use-mobile'

const db = getFirestore(firebaseApp)

/** Cantidad de estudiantes mostrados inicialmente en el ranking; "Ver más" muestra el resto. */
const RANKING_INITIAL_VISIBLE = 10

interface RectorDashboardProps extends ThemeContextProps {}

export default function RectorDashboard({ theme }: RectorDashboardProps) {
  const { stats, isLoading, currentRector, coordinators, teachers, students } = useRectorStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('inicio')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(() => new Set(['inicio']))
  const [rankingFilters, setRankingFilters] = useState<{
    jornada: 'mañana' | 'tarde' | 'única' | 'todas'
    phase: 'first' | 'second' | 'third'
    year: number
    gradeId: string
  }>({
    jornada: 'todas',
    phase: 'first',
    year: new Date().getFullYear(),
    gradeId: 'todos'
  })

  // Datos estáticos que se mantienen
  const staticData = {
    recentActivities: [
      { id: 1, type: 'campus', title: 'Nueva sede inaugurada: Sede Occidente', time: '2 días atrás', icon: Building2 },
      { id: 2, type: 'principal', title: 'Nuevo coordinador asignado en Sede Norte', time: '3 días atrás', icon: Crown },
      { id: 3, type: 'achievement', title: 'Reconocimiento nacional por excelencia educativa', time: '5 días atrás', icon: Award },
      { id: 4, type: 'event', title: 'Reunión mensual de coordinadores completada', time: '1 semana atrás', icon: CalendarDays },
    ],
    achievements: [
      { id: 1, title: 'Mejor Institución del Distrito', status: 'achieved', icon: Award },
      { id: 2, title: 'Tasa de Graduación > 95%', status: 'achieved', icon: CheckCircle2 },
      { id: 3, title: 'Expansión a 5 Sedes', status: 'achieved', icon: Building2 },
      { id: 4, title: 'Promedio General > 85%', status: 'in-progress', icon: TrendingUp },
    ],
    alerts: [
      { id: 1, type: 'info', message: 'Reunión de rectores programada para el 20 de enero', priority: 'medium' },
      { id: 2, type: 'success', message: 'Todas las sedes cumplieron objetivos mensuales', priority: 'low' },
      { id: 3, type: 'warning', message: 'Revisión de presupuesto anual pendiente', priority: 'medium' },
    ],
    performanceData: [
      { month: 'Ene', promedio: 82, asistencia: 91 },
      { month: 'Feb', promedio: 84, asistencia: 93 },
      { month: 'Mar', promedio: 83, asistencia: 92 },
      { month: 'Abr', promedio: 85, asistencia: 94 },
      { month: 'May', promedio: 86, asistencia: 95 },
      { month: 'Jun', promedio: 85, asistencia: 94 },
    ],
    radarData: [
      { subject: 'Rendimiento', A: 85, fullMark: 100 },
      { subject: 'Asistencia', A: 94, fullMark: 100 },
      { subject: 'Disciplina', A: 88, fullMark: 100 },
      { subject: 'Participación', A: 82, fullMark: 100 },
      { subject: 'Innovación', A: 90, fullMark: 100 },
      { subject: 'Satisfacción', A: 87, fullMark: 100 },
    ],
    studentsByLevel: [
      { name: 'Primaria', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.4) : 0, color: '#1e40af' },
      { name: 'Secundaria', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.35) : 0, color: '#2563eb' },
      { name: 'Media', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.25) : 0, color: '#374151' },
    ]
  }

  const COLORS = ['#1e40af', '#2563eb', '#374151', '#4b5563', '#1e3a8a', '#3b82f6']
  const dashboardButtons = [
    { icon: Sparkles, label: 'Inicio', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'inicio' },
    { icon: UserCog, label: 'Administrativos', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'administrativos' },
    { icon: Users, label: 'Análisis por estudiante', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'estudiantes' },
  ] as const

  // Mantener en memoria las pestañas visitadas para evitar recargas al volver.
  useEffect(() => {
    setLoadedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  useEffect(() => {
    if (!isMobile) return
    const openMenu = () => setMobileMenuOpen(true)
    window.addEventListener('rector-mobile-menu-toggle', openMenu)
    return () => window.removeEventListener('rector-mobile-menu-toggle', openMenu)
  }, [isMobile])

  // Mostrar loading si los datos están cargando
  if (isLoading) {
    return <DashboardRoleSkeleton theme={theme} />
  }

  // Verificar que stats existe antes de renderizar
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className={cn('text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          No se pudieron cargar las estadísticas
        </span>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen overflow-x-hidden", theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100')}>
      <div className="flex flex-col gap-0.5">
      {/* Header con logo y gradiente */}
      <div
        className={cn(
          'fade-in duration-200',
          isMobile
            ? "relative overflow-hidden rounded-none px-4 pt-3 pb-2 text-white shadow-2xl"
            : "relative overflow-hidden rounded-none px-5 pt-5 pb-2 text-white shadow-2xl",
          theme === 'dark' 
            ? "bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900" 
            : ""
        )}
        style={theme === 'dark' ? {} : { backgroundColor: 'var(--dashboard-header, #1e3a8a)' }}
      >
        {theme === 'dark' && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/90 to-blue-900/80" />
        )}
        <div className="relative z-10">
          <div className={cn("flex items-center justify-between flex-wrap", isMobile ? "gap-2" : "gap-3")}>
            <div className={cn("flex items-center", isMobile ? "gap-2" : "gap-3")}>
              <div className="relative">
                <img 
                  src={institutionLogo || '/assets/agustina.png'} 
                  alt={`Logo de ${institutionName}`}
                  className={cn(
                    "object-contain rounded-lg bg-white/15 shadow-sm border border-white/30",
                    isMobile ? "w-14 h-14 p-1.5" : "w-20 h-20 p-2"
                  )}
                  onError={(e) => {
                    e.currentTarget.src = '/assets/agustina.png'
                  }}
                />
              </div>
              <div className="min-w-0">
                <h1 className={cn("font-bold mb-0.5 leading-tight", isMobile ? "text-base" : "text-xl")}>
                  Bienvenido Rector de {institutionName || stats.institutionName || 'la Institución'}
                </h1>
                <p className={cn("opacity-90 mb-0.5", isMobile ? "text-xs" : "text-sm")}>
                  Rectoría - {institutionName || stats.institutionName}
                </p>
                <p className={cn("opacity-75 truncate", isMobile ? "text-[11px] max-w-[180px]" : "text-xs")}>
                  {stats.rectorEmail}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="bg-white/15 rounded-lg p-3 text-center border-2 border-white/40 shadow-sm">
                <Building2 className="h-6 w-6 mx-auto mb-1 text-white" />
                <div className="text-lg font-bold text-white">{stats.totalCampuses}</div>
                <div className="text-[10px] opacity-90 text-white font-medium">Sedes</div>
              </div>
              <div className="bg-white/15 rounded-lg p-3 text-center border-2 border-white/40 shadow-sm">
                <Crown className="h-6 w-6 mx-auto mb-1 text-white" />
                <div className="text-lg font-bold text-white">{stats.totalPrincipals}</div>
                <div className="text-[10px] opacity-90 text-white font-medium">Coordinadores</div>
              </div>
            </div>
          </div>
        </div>
        <School className={cn("absolute top-0 right-0 opacity-10", isMobile ? "h-28 w-28" : "h-40 w-40")} aria-hidden />
      </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className={cn(
            "w-[min(100vw-2rem,320px)]",
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white text-gray-900'
          )}
        >
          <SheetHeader>
            <SheetTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Menú del rector
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-2">
            {dashboardButtons.map((btn) => (
              <Button
                key={btn.label}
                onClick={() => {
                  setActiveTab(btn.tab)
                  setMobileMenuOpen(false)
                }}
                className={cn(
                  "w-full h-12 flex flex-row items-center justify-start gap-2 bg-gradient-to-br text-white shadow-md transition-colors duration-150",
                  btn.color
                )}
              >
                <btn.icon className="h-5 w-5 shrink-0" />
                <span className="font-semibold text-sm truncate">{btn.label}</span>
              </Button>
            ))}
            <Button
              asChild
              className={cn(
                "w-full h-12 flex flex-row items-center justify-start gap-2 bg-gradient-to-br text-white shadow-md transition-colors duration-150",
                theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700'
              )}
            >
              <a
                href={getWhatsAppUrl('Hola, soy el rector de la institución, necesito soporte técnico, tengo algunos problemas con el sistema.')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row items-center justify-start gap-2 w-full h-full"
              >
                <Wrench className="h-5 w-5 shrink-0" />
                <span className="font-semibold text-sm truncate">Soporte técnico</span>
              </a>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Botones de acción */}
      <div className="hidden md:grid md:grid-cols-4 gap-3 mx-4 md:mx-6 lg:mx-8 mt-2.5 fade-in duration-200">
        {dashboardButtons.map((btn) => (
          <div key={btn.label}>
            <Button
              onClick={() => setActiveTab(btn.tab)}
              className={cn(
                "w-full h-18 flex flex-row items-center justify-center gap-2 bg-gradient-to-br text-white shadow-md transition-colors duration-150",
                btn.color
              )}
            >
              <btn.icon className="h-6 w-6 shrink-0" />
              <span className="font-semibold text-sm truncate">{btn.label}</span>
            </Button>
          </div>
        ))}
        <div>
          <Button
            asChild
            className={cn(
              "w-full h-18 flex flex-row items-center justify-center gap-2 bg-gradient-to-br text-white shadow-md transition-colors duration-150",
              theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700'
            )}
          >
            <a
              href={getWhatsAppUrl('Hola, soy el rector de la institución, necesito soporte técnico, tengo algunos problemas con el sistema.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-row items-center justify-center gap-2 w-full h-full"
            >
              <Wrench className="h-6 w-6 shrink-0" />
              <span className="font-semibold text-sm truncate">Soporte técnico</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Contenido dinámico según tab activo */}
      <div className="mx-4 md:mx-6 lg:mx-8 mt-3 pb-20 md:pb-0">
        {/* Tab Inicio */}
        {loadedTabs.has('inicio') && (
          <div className={cn('space-y-6', activeTab !== 'inicio' && 'hidden')}>
            <WelcomeTab
              theme={theme}
              stats={stats}
              currentRector={currentRector}
              rankingFilters={rankingFilters}
              setRankingFilters={setRankingFilters}
              institutionStudents={students ?? []}
            />
          </div>
        )}

        {/* Tab Sedes */}
        {loadedTabs.has('sedes') && (
          <div className={cn('space-y-6', activeTab !== 'sedes' && 'hidden')}>
            <CampusesTab
              theme={theme}
              stats={stats}
              currentRector={currentRector}
              coordinators={coordinators || []}
              teachers={teachers || []}
            />
          </div>
        )}

        {/* Tab Administrativos */}
        {loadedTabs.has('administrativos') && (
          <div className={cn('space-y-6', activeTab !== 'administrativos' && 'hidden')}>
            <AdministrativosTab
              theme={theme}
              coordinators={coordinators || []}
              teachers={teachers || []}
            />
          </div>
        )}

        {/* Tab Estudiantes */}
        {loadedTabs.has('estudiantes') && (
          <div className={cn('space-y-6', activeTab !== 'estudiantes' && 'hidden')}>
            <StudentsTab
              theme={theme}
              students={students || []}
            />
          </div>
        )}

        {/* Tab Resultados */}
        {loadedTabs.has('resultados') && (
          <div className={cn('space-y-6', activeTab !== 'resultados' && 'hidden')}>
            <ResultsTab
              theme={theme}
              stats={stats}
              staticData={staticData}
              COLORS={COLORS}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2">
          <div className={cn(
            "flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-md",
            theme === 'dark' ? 'border-zinc-700 bg-zinc-900/90' : 'border-gray-300 bg-white/90'
          )}>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Inicio"
              title="Inicio"
              onClick={() => setActiveTab('inicio')}
              className={cn(
                "h-9 w-9 rounded-lg",
                activeTab === 'inicio'
                  ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                  : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100')
              )}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Administrativos"
              title="Administrativos"
              onClick={() => setActiveTab('administrativos')}
              className={cn(
                "h-9 w-9 rounded-lg",
                activeTab === 'administrativos'
                  ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                  : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100')
              )}
            >
              <UserCog className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Análisis por estudiante"
              title="Análisis por estudiante"
              onClick={() => setActiveTab('estudiantes')}
              className={cn(
                "h-9 w-9 rounded-lg",
                activeTab === 'estudiantes'
                  ? (theme === 'dark' ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                  : (theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100')
              )}
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label="Soporte técnico"
              title="Soporte técnico"
              className={cn(
                "h-9 w-9 rounded-lg",
                theme === 'dark' ? 'text-zinc-200 hover:bg-zinc-800' : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <a
                href={getWhatsAppUrl('Hola, soy el rector de la institución, necesito soporte técnico, tengo algunos problemas con el sistema.')}
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


// Componente de Promedio Institucional con filtro por fase (usa institutionStudents de la única fuente)
function InstitutionAverageCard({ theme, currentRector, institutionStudents: institutionStudentsProp = [], compactMobile = false }: any) {
  const isMobile = useIsMobile()
  const isCompactMobile = isMobile && compactMobile
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<'first' | 'second' | 'third'>('first')
  const [selectedGrade, setSelectedGrade] = useState<string>('todos')
  const [selectedJornada, setSelectedJornada] = useState<'mañana' | 'tarde' | 'única' | 'todas'>('todas')
  const institutionId = currentRector?.institutionId
  const queryClient = useQueryClient()

  const { options: gradeOptions } = useAllGradeOptions()
  const institutionGrades = gradeOptions.filter((grade: any) => grade.institutionId === institutionId)

  // Filtrar en memoria la única fuente de estudiantes (grado y jornada)
  const institutionStudents = useMemo(() => {
    let list = institutionStudentsProp || []
    if (selectedGrade !== 'todos') {
      list = list.filter((s: any) => (s.gradeId || s.grade) === selectedGrade)
    }
    if (selectedJornada !== 'todas') {
      list = list.filter((s: any) => s.jornada === selectedJornada)
    }
    return list
  }, [institutionStudentsProp, selectedGrade, selectedJornada])

  const averageQueryKey = ['rector-institution-average', institutionId, selectedPhase, selectedGrade, selectedJornada] as const

  // Calcular promedio de puntajes globales (0-500) por fase
  const { data: phaseAverage, isLoading: averageLoading, error: averageError, refetch: refetchAverage } = useQuery({
    queryKey: averageQueryKey,
    queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const phase = queryKey[2] as 'first' | 'second' | 'third'
      if (!institutionId || !institutionStudents || institutionStudents.length === 0) {
        return 0
      }
      return getOrBuildRectorInstitutionAverageSnapshot({
        institutionId,
        phase,
        gradeId: selectedGrade,
        jornada: selectedJornada,
        students: institutionStudents,
      })
    },
    enabled: !!institutionId && !!institutionStudents && institutionStudents.length > 0,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })

  // Prefetch otras fases para filtros actuales (cambio de fase instantáneo)
  useEffect(() => {
    if (!institutionId || !institutionStudents?.length) return
    const otherPhases: ('second' | 'third')[] = ['second', 'third']
    otherPhases.forEach((phase) => {
      const key = ['rector-institution-average', institutionId, phase, selectedGrade, selectedJornada] as const
      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
          const p = queryKey[2] as 'first' | 'second' | 'third'
          return getOrBuildRectorInstitutionAverageSnapshot({
            institutionId,
            phase: p,
            gradeId: selectedGrade,
            jornada: selectedJornada,
            students: institutionStudents,
          })
        },
        staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
        gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
      })
    })
  }, [institutionId, institutionStudents, selectedGrade, selectedJornada, queryClient])

  return (
    <div className={cn("space-y-1", isCompactMobile ? "overflow-hidden" : isMobile ? "" : "flex-1 flex flex-col justify-between")}>
      <div className={cn("flex gap-1.5", isCompactMobile ? "items-start justify-between" : isMobile ? "flex-col" : "items-center justify-between")}>
        <div className="flex items-center gap-1.5">
            {averageError ? (
              <div className="flex items-center gap-2">
                <span className={cn('text-sm', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Error</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={() => refetchAverage()}
                >
                  <RotateCw className="h-3 w-3 mr-1" />
                  Reintentar
                </Button>
              </div>
            ) : averageLoading ? (
              <div className={cn('h-8 w-16 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} aria-busy="true" aria-label="Cargando promedio" />
            ) : (
              <div className={cn(isCompactMobile ? 'text-2xl font-bold leading-none tracking-tight' : isMobile ? 'text-[2rem] font-bold leading-none' : 'text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <span className={cn(isCompactMobile ? 'text-xs font-normal mr-1' : isMobile ? 'text-base font-normal mr-1' : 'text-lg font-normal mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>~</span>
                {phaseAverage ?? 0}
              </div>
            )}
            {!averageError && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-center w-4 h-4 rounded-full hover:bg-opacity-80 transition-colors",
                      theme === 'dark' ? "bg-blue-500/20 hover:bg-blue-500/30" : "bg-blue-500/10 hover:bg-blue-500/20"
                    )}
                  >
                    <Info className={cn("h-3 w-3", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-64 p-3 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
                  <div className="space-y-1">
                    <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Valor Aproximado
                    </p>
                    <p className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                      Este promedio es una aproximación calculada a partir de los puntajes globales (0-500) de todos los estudiantes de la institución que han completado todas las materias en la fase seleccionada.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
        </div>
        {isCompactMobile ? (
          <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-7 px-2 text-[11px] shrink-0",
                  theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                )}
              >
                Filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className={cn("w-56 p-2", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}
            >
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={selectedGrade}
                  onValueChange={setSelectedGrade}
                >
                  <SelectTrigger className={cn("h-7 w-full text-[11px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                    <SelectValue placeholder="Grado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (grado)</SelectItem>
                    {institutionGrades.map((grade: any) => (
                      <SelectItem key={grade.value} value={grade.value}>
                        {grade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedJornada}
                  onValueChange={(value) => setSelectedJornada(value as 'mañana' | 'tarde' | 'única' | 'todas')}
                >
                  <SelectTrigger className={cn("h-7 w-full text-[11px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                    <SelectValue placeholder="Jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas (jornada)</SelectItem>
                    <SelectItem value="mañana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="única">Única</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedPhase}
                  onValueChange={(value) => setSelectedPhase(value as 'first' | 'second' | 'third')}
                >
                  <SelectTrigger className={cn("h-7 w-full text-[11px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">Fase I</SelectItem>
                    <SelectItem value="second">Fase II</SelectItem>
                    <SelectItem value="third">Fase III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
        <div className={cn("gap-1.5", isMobile ? "grid grid-cols-3 w-full" : "flex items-end flex-wrap justify-end")}>
          <div className={cn("flex flex-col gap-0.5", isMobile ? "min-w-0" : "min-w-[4.5rem]")}>
            <label className={cn("text-[10px] font-medium", isMobile && "sr-only", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Grado
            </label>
            <Select
              value={selectedGrade}
              onValueChange={setSelectedGrade}
            >
              <SelectTrigger className={cn(isMobile ? "h-7 w-full text-[11px]" : "h-6 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                <SelectValue placeholder="Grado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {institutionGrades.map((grade: any) => (
                  <SelectItem key={grade.value} value={grade.value}>
                    {grade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={cn("flex flex-col gap-0.5", isMobile ? "min-w-0" : "min-w-[4.5rem]")}>
            <label className={cn("text-[10px] font-medium", isMobile && "sr-only", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Jornada
            </label>
            <Select
              value={selectedJornada}
              onValueChange={(value) => setSelectedJornada(value as 'mañana' | 'tarde' | 'única' | 'todas')}
            >
              <SelectTrigger className={cn(isMobile ? "h-7 w-full text-[11px]" : "h-6 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                <SelectValue placeholder="Jornada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="mañana">Mañana</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="única">Única</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={cn("flex flex-col gap-0.5", isMobile ? "min-w-0" : "min-w-[4.5rem]")}>
            <label className={cn("text-[10px] font-medium", isMobile && "sr-only", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Fase
            </label>
            <Select
              value={selectedPhase}
              onValueChange={(value) => setSelectedPhase(value as 'first' | 'second' | 'third')}
            >
              <SelectTrigger className={cn(isMobile ? "h-7 w-full text-[11px]" : "h-6 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
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
  )
}

// Componente de Bienvenida (institutionStudents = única fuente de estudiantes para el tab)
function WelcomeTab({ theme, stats, currentRector, rankingFilters, setRankingFilters, institutionStudents = [] }: any) {
  const isMobile = useIsMobile()
  const [evolutionFilters, setEvolutionFilters] = useState<{
    year: number
    subject: string
    jornada: string
    studentId: string
    gradeId: string
  }>({
    year: new Date().getFullYear(),
    subject: 'todas',
    jornada: 'todas',
    studentId: 'todos',
    gradeId: 'todos'
  })

  return (
    <div className="space-y-3">
      {/* Estadísticas principales con animaciones */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 items-start">
        {[
          { 
            title: 'Total Estudiantes', 
            value: (stats?.totalStudents || 0).toLocaleString(), 
            change: '',
            icon: Users, 
            color: 'blue',
            gradient: theme === 'dark' ? 'from-blue-800 to-blue-900' : 'from-blue-700 to-blue-800'
          },
          { 
            title: isMobile ? 'Promedio Inst.' : 'Promedio Institucional',
            value: null,
            change: '',
            icon: TrendingUp, 
            color: 'blue',
            gradient: theme === 'dark' ? 'from-blue-800 to-blue-900' : 'from-blue-700 to-blue-800',
            isCustom: true,
            customComponent: <InstitutionAverageCard theme={theme} currentRector={currentRector} institutionStudents={institutionStudents} compactMobile={isMobile} />
          },
        ].map((stat) => (
          <div key={stat.title}>
            <Card className={cn(
              "relative overflow-hidden shadow-lg",
              theme === 'dark' 
                ? 'bg-zinc-900 border-0' 
              : 'bg-gray-200 border-2 border-gray-300'
            )}>
              <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-full -mr-12 -mt-12", stat.gradient)} />
              <CardHeader className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-0.5 relative z-10",
                isMobile ? "pt-1.5 px-2" : "pt-2 px-3"
              )}>
                <CardTitle className={cn(
                  'font-medium',
                  isMobile ? 'text-[11px]' : 'text-xs',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                )}>
                  {stat.title}
                </CardTitle>
                <div>
                  <stat.icon className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", `text-${stat.color}-500`)} />
                </div>
              </CardHeader>
              <CardContent className={cn(
                "relative z-10 pt-0.5",
                isMobile ? "px-2 pb-1.5" : "px-3 pb-2"
              )}>
                {stat.isCustom && stat.customComponent ? (
                  stat.customComponent
                ) : (
                  <>
                    <div
                      className={cn(
                        isMobile ? 'text-xl font-bold' : 'text-2xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}
                    >
                      {stat.value}
                    </div>
                    {stat.change && (
                      <p className={cn('text-xs mt-1', 
                        stat.color === 'blue' 
                          ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600')
                          : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                      )}>
                        {stat.change}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Evolución académica y ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EvolutionBySubjectChart 
          theme={theme}
          currentRector={currentRector}
          filters={evolutionFilters}
          setFilters={setEvolutionFilters}
          institutionStudents={institutionStudents}
        />

        <StudentRankingCard 
          theme={theme}
          currentRector={currentRector}
          rankingFilters={rankingFilters}
          setRankingFilters={setRankingFilters}
          institutionStudents={institutionStudents}
        />
      </div>
    </div>
  )
}

// Componente de Evolución por Materia (usa institutionStudents de la única fuente)
function EvolutionBySubjectChart({ theme, currentRector, filters, setFilters, institutionStudents: allStudentsProp = [] }: any) {
  const isMobile = useIsMobile()
  const institutionId = currentRector?.institutionId
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const allStudents = allStudentsProp ?? []

  const subjects = [
    'todas',
    'Matemáticas',
    'Lenguaje',
    'Ciencias Sociales',
    'Biologia',
    'Quimica',
    'Física',
    'Inglés'
  ]

  const jornadas = ['todas', 'mañana', 'tarde', 'única']
  const { options: gradeOptions } = useAllGradeOptions()
  const institutionGrades = useMemo(
    () => (gradeOptions || []).filter((g: any) => g.institutionId === institutionId),
    [gradeOptions, institutionId]
  )
  const gradeLabel = filters.gradeId === 'todos' || !filters.gradeId
    ? 'Todos'
    : (institutionGrades.find((g: any) => g.value === filters.gradeId)?.label ?? 'Todos')

  // Clave estable sin materia: una sola carga por año/jornada/estudiante/grado; el filtro de materia se aplica en cliente
  const evolutionDataKey = {
    year: filters.year,
    jornada: filters.jornada,
    studentId: filters.studentId || 'todos',
    gradeId: filters.gradeId || 'todos',
  }

  // Obtener datos de evolución (allStudents = única fuente desde props)
  const { data: evolutionData, isLoading: evolutionLoading, error: evolutionError, refetch: refetchEvolution } = useQuery({
    queryKey: ['rector-evolution-data', institutionId, evolutionDataKey, allStudents?.length ?? 0],
    queryFn: async ({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[2] as { year: number; jornada: string; studentId: string; gradeId: string }
      if (!institutionId || !allStudents || allStudents.length === 0) return { chartData: [], subjects: [] }
      return getOrBuildRectorEvolutionSnapshot({
        institutionId,
        filters: {
          year: key.year,
          jornada: key.jornada,
          gradeId: key.gradeId,
          studentId: key.studentId,
        },
        students: allStudents,
      })
    },
    enabled: !!institutionId && !!allStudents && allStudents.length > 0,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Filtro por materia en cliente (datos ya traídos; sin nueva petición)
  const displaySubjects: string[] =
    evolutionData && 'subjects' in evolutionData && evolutionData.subjects && evolutionData.subjects.length > 0
      ? filters.subject === 'todas'
        ? evolutionData.subjects
        : evolutionData.subjects.includes(filters.subject)
          ? [filters.subject]
          : []
      : []

  const hasChartData = evolutionData && 'chartData' in evolutionData && evolutionData.chartData && evolutionData.chartData.length > 0

  const selectedStudentLabel =
    filters.studentId === 'todos' || !filters.studentId
      ? 'Todos'
      : (() => {
          const s = allStudents?.find((st: any) => (st.id || st.uid) === filters.studentId)
          return (s as any)?.name || (s as any)?.displayName || 'Seleccionar...'
        })()

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
      <CardHeader className={cn(isMobile ? 'pb-1.5 pt-3 px-3' : 'pb-2')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-xl' : '', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className={cn(isMobile ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Evolución académica
            </CardTitle>
            {!isMobile && (
              <CardDescription className="mt-0.5">
              {evolutionData && 'subjects' in evolutionData && evolutionData.subjects && evolutionData.subjects.length > 0
                ? filters.subject === 'todas'
                  ? `${evolutionData.subjects.length} ${evolutionData.subjects.length === 1 ? 'materia evaluada' : 'materias evaluadas'}`
                  : displaySubjects.length === 1
                    ? '1 materia evaluada'
                    : 'Promedio de puntuación por materia en las 3 fases'
                : 'Promedio de puntuación por materia en las 3 fases'
              }
              </CardDescription>
            )}
            <p className={cn('text-[10px] mt-0.5', isMobile && 'truncate pr-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')} aria-live="polite">
              {filters.year} · {filters.subject === 'todas' ? 'Todas' : filters.subject} · {filters.jornada === 'todas' ? 'Todas' : filters.jornada} · {gradeLabel} · {filters.studentId === 'todos' || !filters.studentId ? 'Todos' : 'Estudiante'}
            </p>
          </div>
          {/* Filtros */}
          <div className="flex items-end gap-2 flex-wrap">
            {isMobile && (
              <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-7 px-2.5 text-[11px]",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    Filtros
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  className={cn("w-64 p-2", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}
                >
                  <div className="grid grid-cols-1 gap-2">
                    <Select
                      value={filters.year.toString()}
                      onValueChange={(value) => setFilters({ ...filters, year: parseInt(value) })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.subject}
                      onValueChange={(value) => setFilters({ ...filters, subject: value })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por materia">
                        <SelectValue placeholder="Materia" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(subject => (
                          <SelectItem key={subject} value={subject}>
                            {subject === 'todas' ? 'Todas las materias' : subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.jornada}
                      onValueChange={(value) => setFilters({ ...filters, jornada: value })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                        <SelectValue placeholder="Jornada" />
                      </SelectTrigger>
                      <SelectContent>
                        {jornadas.map(jornada => (
                          <SelectItem key={jornada} value={jornada}>
                            {jornada === 'todas' ? 'Todas las jornadas' : jornada.charAt(0).toUpperCase() + jornada.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.gradeId || 'todos'}
                      onValueChange={(value) => setFilters({ ...filters, gradeId: value })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                        <SelectValue placeholder="Grado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los grados</SelectItem>
                        {institutionGrades.map((g: any) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {!isMobile && (
            <>
            <div className="flex flex-col gap-0.5">
              <label className={cn("text-[10px] font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Año
              </label>
              <Select
                value={filters.year.toString()}
                onValueChange={(value) => setFilters({ ...filters, year: parseInt(value) })}
              >
                <SelectTrigger className={cn("h-7 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={cn("text-[10px] font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Materia
              </label>
              <Select
                value={filters.subject}
                onValueChange={(value) => setFilters({ ...filters, subject: value })}
              >
                <SelectTrigger className={cn("h-7 w-28 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por materia">
                  <SelectValue placeholder="Materia" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject === 'todas' ? 'Todas' : subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={cn("text-[10px] font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Jornada
              </label>
              <Select
                value={filters.jornada}
                onValueChange={(value) => setFilters({ ...filters, jornada: value })}
              >
                <SelectTrigger className={cn("h-7 w-24 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                  <SelectValue placeholder="Jornada" />
                </SelectTrigger>
                <SelectContent>
                  {jornadas.map(jornada => (
                    <SelectItem key={jornada} value={jornada}>
                      {jornada === 'todas' ? 'Todas' : jornada.charAt(0).toUpperCase() + jornada.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={cn("text-[10px] font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Grado
              </label>
              <Select
                value={filters.gradeId || 'todos'}
                onValueChange={(value) => setFilters({ ...filters, gradeId: value })}
              >
                <SelectTrigger className={cn("h-7 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                  <SelectValue placeholder="Grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {institutionGrades.map((g: any) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className={cn("text-[10px] font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Estudiante
              </label>
              <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={studentPopoverOpen}
                    aria-label="Filtrar por estudiante"
                    title={selectedStudentLabel !== 'Todos' ? selectedStudentLabel : undefined}
                    className={cn(
                      "h-7 min-w-[5rem] max-w-32 justify-between gap-1.5 text-xs overflow-hidden",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-white border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <span className="truncate min-w-0 text-left">
                      {selectedStudentLabel}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-80 p-0", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')} align="end">
                  <Command className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>
                    <CommandInput 
                      placeholder="Buscar estudiante..." 
                      className={cn("h-9", theme === 'dark' ? 'text-white' : 'text-gray-900')}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron estudiantes.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="todos"
                          onSelect={() => {
                            setFilters({ ...filters, studentId: 'todos' })
                            setStudentPopoverOpen(false)
                          }}
                          className={cn("cursor-pointer", theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100')}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.studentId === 'todos' || !filters.studentId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Todos
                        </CommandItem>
                        {allStudents?.map((student: any) => {
                          const studentName = student.name || student.displayName || 'Sin nombre'
                          return (
                            <CommandItem
                              key={student.id || student.uid}
                              value={studentName}
                              onSelect={() => {
                                setFilters({ ...filters, studentId: student.id || student.uid })
                                setStudentPopoverOpen(false)
                              }}
                              className={cn("cursor-pointer", theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100')}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.studentId === (student.id || student.uid) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {studentName}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isMobile ? "pt-0 px-3 pb-3" : "pt-0")}>
        {evolutionError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className={cn('text-sm text-center', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar la evolución. Por favor, intenta nuevamente.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchEvolution()}
              className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        ) : evolutionLoading ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Cargando evolución por materia">
            <div className={cn('h-48 rounded-md animate-pulse', theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200')} />
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={cn('h-4 w-20 rounded animate-pulse', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300')} />
              ))}
            </div>
          </div>
        ) : hasChartData && displaySubjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 190 : 240}>
            <LineChart data={evolutionData!.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#3f3f46' : '#d1d5db'} />
              <XAxis 
                dataKey="fase" 
                stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'}
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }}
              />
              <YAxis 
                domain={[0, 100]}
                stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'}
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: isMobile ? 10 : 11 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                  border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: isMobile ? '4px' : '8px' }}
                iconType="line"
                iconSize={isMobile ? 6 : 8}
                formatter={(value) => <span style={{ fontSize: isMobile ? 10 : 11 }}>{value}</span>}
              />
              {displaySubjects.map((subject: string) => {
                const colors: { [key: string]: string } = {
                  'Matemáticas': '#3b82f6',
                  'Lenguaje': '#a855f7',
                  'Ciencias Sociales': '#10b981',
                  'Biologia': '#f59e0b',
                  'Quimica': '#ef4444',
                  'Física': '#f97316',
                  'Inglés': '#06b6d4'
                }
                return (
                  <Line 
                    key={subject}
                    type="monotone" 
                    dataKey={subject} 
                    name={subject} 
                    stroke={colors[subject] || '#6b7280'} 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : hasChartData && filters.subject !== 'todas' && displaySubjects.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos para {filters.subject} con los filtros seleccionados
            </p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              {filters.year} · {filters.jornada === 'todas' ? 'Todas' : filters.jornada} · {gradeLabel} · {filters.studentId === 'todos' ? 'Todos' : 'Estudiante'}
            </p>
          </div>
        ) : (
          <div className="text-center py-8 space-y-1">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para los filtros seleccionados
            </p>
            <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              {filters.year} · {filters.subject === 'todas' ? 'Todas' : filters.subject} · {filters.jornada === 'todas' ? 'Todas' : filters.jornada} · {gradeLabel} · {filters.studentId === 'todos' ? 'Todos' : 'Estudiante'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Tipo de filtros para el ranking de estudiantes (reutilizado en query y prefetch). */
type RankingFilters = {
  jornada: 'mañana' | 'tarde' | 'única' | 'todas'
  phase: 'first' | 'second' | 'third'
  year: number
  gradeId: string
}

function getStudentYear(student: any): number | null {
  if (student.academicYear) return student.academicYear
  if (!student.createdAt) return null
  let date: Date
  if (typeof student.createdAt === 'string') date = new Date(student.createdAt)
  else if (student.createdAt?.toDate) date = student.createdAt.toDate()
  else if (student.createdAt?.seconds) date = new Date(student.createdAt.seconds * 1000)
  else return null
  return date.getFullYear()
}

/** Ranking usando lista de estudiantes ya cargada (sin nueva lectura a Firestore para la lista). */
async function fetchStudentsRankingWithStudents(
  students: any[],
  filters: RankingFilters
): Promise<Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }>> {
  try {
    if (!students?.length) return []
    let list = [...students]
    if (filters.jornada && filters.jornada !== 'todas') {
      list = list.filter((s: any) => s.jornada === filters.jornada)
    }
    if (filters.gradeId && filters.gradeId !== 'todos') {
      list = list.filter((s: any) => (s.gradeId || s.grade) === filters.gradeId)
    }
    if (filters.year) {
      list = list.filter((s: any) => getStudentYear(s) === filters.year)
    }
    return buildRankingFromStudents(list, filters)
  } catch (error) {
    console.error('Error en fetchStudentsRankingWithStudents:', error)
    return []
  }
}

/** Construye el ranking a partir de una lista de estudiantes y lee solo results en Firestore. */
async function buildRankingFromStudents(
  students: any[],
  filters: RankingFilters
): Promise<Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }>> {
  const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
  if (studentIds.length === 0) return []
  const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
  const phaseMap: { [key: string]: string } = {
    'first': 'fase I', 'second': 'Fase II', 'third': 'fase III',
    'Fase I': 'fase I', 'Fase II': 'Fase II', 'Fase III': 'fase III'
  }
  const selectedPhaseName = phaseMap[filters.phase] || filters.phase
  const phaseResults: any[] = []
  for (const studentId of studentIds) {
    try {
      const phaseRef = collection(db, 'results', studentId, selectedPhaseName)
      const phaseSnap = await getDocs(phaseRef)
      phaseSnap.docs.forEach(doc => {
        const examData = doc.data()
        if (examData.completed && examData.score && examData.subject) {
          phaseResults.push({
            userId: studentId,
            examId: doc.id,
            phase: filters.phase,
            subject: examData.subject.trim(),
            score: { overallPercentage: examData.score.overallPercentage || 0 },
          })
        }
      })
    } catch (error) {
      console.error(`Error obteniendo resultados para estudiante ${studentId}:`, error)
    }
  }
  const resultsByStudent = new Map<string, { scores: number[]; subjects: Set<string> }>()
  phaseResults.forEach(result => {
    if (!resultsByStudent.has(result.userId)) resultsByStudent.set(result.userId, { scores: [], subjects: new Set() })
    const studentData = resultsByStudent.get(result.userId)!
    studentData.scores.push(result.score.overallPercentage)
    if (result.subject) studentData.subjects.add(result.subject.trim())
  })
  const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
  const POINTS_PER_NATURALES_SUBJECT = 100 / 3
  const POINTS_PER_REGULAR_SUBJECT = 100
  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      'biologia': 'Biologia', 'biología': 'Biologia', 'quimica': 'Quimica', 'química': 'Quimica',
      'fisica': 'Física', 'física': 'Física', 'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas',
      'lenguaje': 'Lenguaje', 'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
      'ingles': 'Inglés', 'inglés': 'Inglés'
    }
    return subjectMap[normalized] || subject
  }
  const ranking: Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }> = []
  students.forEach((student: any) => {
    const studentId = student.id || student.uid
    const studentData = resultsByStudent.get(studentId)
    if (!studentData || studentData.subjects.size === 0) return
    if (!REQUIRED_SUBJECTS.every(s => studentData.subjects.has(s))) return
    const studentResults = phaseResults.filter(r => r.userId === studentId)
    const subjectScores: { [subject: string]: number } = {}
    studentResults.forEach(result => {
      const subject = normalizeSubjectName(result.subject || '')
      const pct = result.score?.overallPercentage || 0
      if (!subjectScores[subject] || pct > subjectScores[subject]) subjectScores[subject] = pct
    })
    let globalScore = 0
    Object.entries(subjectScores).forEach(([subject, percentage]) => {
      globalScore += NATURALES_SUBJECTS.includes(subject)
        ? (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
        : (percentage / 100) * POINTS_PER_REGULAR_SUBJECT
    })
    globalScore = Math.round(globalScore * 100) / 100
    ranking.push({ student, globalScore, totalExams: studentData.scores.length, completedSubjects: studentData.subjects.size })
  })
  ranking.sort((a, b) => {
    if (a.totalExams === 0 && b.totalExams > 0) return 1
    if (a.totalExams > 0 && b.totalExams === 0) return -1
    return b.globalScore - a.globalScore
  })
  return ranking
}

// Componente de Ranking de Estudiantes (usa institutionStudents de la única fuente)
function StudentRankingCard({ theme, currentRector, rankingFilters, setRankingFilters, institutionStudents = [] }: any) {
  const isMobile = useIsMobile()
  const institutionId = currentRector?.institutionId
  const queryClient = useQueryClient()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const { options: gradeOptions } = useAllGradeOptions()
  const institutionGrades = useMemo(
    () => (gradeOptions || []).filter((g: any) => g.institutionId === institutionId),
    [gradeOptions, institutionId]
  )
  const gradeLabel = rankingFilters.gradeId === 'todos' || !rankingFilters.gradeId
    ? 'Todos'
    : (institutionGrades.find((g: any) => g.value === rankingFilters.gradeId)?.label ?? 'Todos')

  const { data: rankingData, isLoading: studentsLoading, error: rankingError, refetch: refetchRanking } = useQuery({
    queryKey: ['rector-students-ranking', institutionId, rankingFilters, institutionStudents?.length ?? 0],
    queryFn: () => fetchStudentsRankingWithStudents(institutionStudents, rankingFilters),
    enabled: !!institutionId && (institutionStudents?.length ?? 0) > 0,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })
  const institutionStudentsRanking = rankingData ?? []

  const [showAllRanking, setShowAllRanking] = useState(false)
  useEffect(() => {
    setShowAllRanking(false)
  }, [rankingFilters])

  // Prefetch con la misma lista de estudiantes (sin nuevas lecturas de lista)
  useEffect(() => {
    if (!institutionId || (institutionStudents?.length ?? 0) === 0) return
    const currentYear = new Date().getFullYear()
    const gradeId = rankingFilters.gradeId || 'todos'
    const baseFilters: RankingFilters = { jornada: 'todas', phase: 'first', year: currentYear, gradeId }
    const prefetches: RankingFilters[] = [
      { ...baseFilters, phase: 'second' },
      { ...baseFilters, phase: 'third' },
      { ...baseFilters, jornada: 'mañana' },
      { ...baseFilters, jornada: 'tarde' },
      { ...baseFilters, jornada: 'única' },
    ]
    prefetches.forEach((filters) => {
      queryClient.prefetchQuery({
        queryKey: ['rector-students-ranking', institutionId, filters, institutionStudents.length],
        queryFn: () => fetchStudentsRankingWithStudents(institutionStudents, filters),
        staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
        gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
      })
    })
  }, [institutionId, rankingFilters.gradeId, queryClient, institutionStudents])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
      <CardHeader className={cn(isMobile ? 'pb-1.5 pt-3 px-3' : '')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <CardTitle className={cn('flex items-center gap-2', isMobile ? 'text-xl' : '', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Trophy className={cn(isMobile ? "h-4 w-4" : "h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Ranking de Mejores Estudiantes
            </CardTitle>
            {!isMobile && <CardDescription>Top estudiantes ordenados por rendimiento</CardDescription>}
            <p className={cn('text-xs mt-1', isMobile && 'truncate pr-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')} aria-live="polite">
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'} · {rankingFilters.year} · {gradeLabel} · {rankingFilters.jornada === 'todas' ? 'Todas las jornadas' : rankingFilters.jornada}
            </p>
          </div>
          {/* Filtros en la parte superior derecha */}
          <div className="flex flex-col items-start md:items-end gap-1 w-full md:w-auto">
            {isMobile && (
              <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-7 px-2.5 text-[11px]",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    Filtros
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  className={cn("w-60 p-2", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300')}
                >
                  <div className="grid grid-cols-1 gap-2">
                    <Select
                      value={rankingFilters.gradeId || 'todos'}
                      onValueChange={(value) => setRankingFilters({ ...rankingFilters, gradeId: value })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                        <SelectValue placeholder="Grado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los grados</SelectItem>
                        {institutionGrades.map((g: any) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={rankingFilters.jornada || 'todas'}
                      onValueChange={(value) => setRankingFilters({ ...rankingFilters, jornada: value === 'todas' ? 'todas' : (value as 'mañana' | 'tarde' | 'única') })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                        <SelectValue placeholder="Jornada" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las jornadas</SelectItem>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="única">Única</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={rankingFilters.phase}
                      onValueChange={(value) => setRankingFilters({ ...rankingFilters, phase: value as any })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">Fase I</SelectItem>
                        <SelectItem value="second">Fase II</SelectItem>
                        <SelectItem value="third">Fase III</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={rankingFilters.year.toString()}
                      onValueChange={(value) => setRankingFilters({ ...rankingFilters, year: parseInt(value) })}
                    >
                      <SelectTrigger className={cn("h-8 w-full text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año académico">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {!isMobile && (
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2 w-full md:w-auto">
              <div className="flex flex-col gap-0.5 min-w-0">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} id="ranking-grade-label">
                  Grado
                </label>
                <Select
                  value={rankingFilters.gradeId || 'todos'}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, gradeId: value })}
                >
                  <SelectTrigger className={cn("h-8 w-full md:w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por grado">
                    <SelectValue placeholder="Grado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {institutionGrades.map((g: any) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} id="ranking-jornada-label">
                  Jornada
                </label>
                <Select
                  value={rankingFilters.jornada || 'todas'}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, jornada: value === 'todas' ? 'todas' : (value as 'mañana' | 'tarde' | 'única') })}
                >
                  <SelectTrigger className={cn("h-8 w-full md:w-24 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por jornada">
                    <SelectValue placeholder="Jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="mañana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="única">Única</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} id="ranking-phase-label">
                  Fase
                </label>
                <Select
                  value={rankingFilters.phase}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, phase: value as any })}
                >
                  <SelectTrigger className={cn("h-8 w-full md:w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por fase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">Fase I</SelectItem>
                    <SelectItem value="second">Fase II</SelectItem>
                    <SelectItem value="third">Fase III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} id="ranking-year-label">
                  Año
                </label>
                <Select
                  value={rankingFilters.year.toString()}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, year: parseInt(value) })}
                >
                  <SelectTrigger className={cn("h-8 w-full md:w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')} aria-label="Filtrar por año académico">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isMobile ? "pt-0 px-3 pb-3" : "")}>

        {/* Ranking */}
        {rankingError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className={cn('text-sm text-center text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar el ranking. Por favor, intenta nuevamente.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRanking()}
              className={cn(theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100')}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        ) : studentsLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando ranking">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 rounded-md border',
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-300 bg-gray-100'
                )}
              >
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
        ) : institutionStudentsRanking && institutionStudentsRanking.length > 0 ? (
          <>
            <TooltipProvider>
              <div className={cn("space-y-1 overflow-y-auto", isMobile ? "max-h-80" : "max-h-96")} role="list" aria-label="Ranking de estudiantes">
                {(showAllRanking ? institutionStudentsRanking : institutionStudentsRanking.slice(0, RANKING_INITIAL_VISIBLE)).map((item: any, index: number) => (
                  <div
                    key={item.student.id || item.student.uid}
                    role="listitem"
                    className={cn(
                      isMobile ? 'flex items-center justify-between py-1.5 px-1.5 rounded-md border' : 'flex items-center justify-between py-1.5 px-2 rounded-md border',
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                        index === 0
                          ? (theme === 'dark' ? 'bg-yellow-600 text-white' : 'bg-yellow-500 text-white')
                          : index === 1
                            ? (theme === 'dark' ? 'bg-gray-400 text-white' : 'bg-gray-300 text-gray-900')
                            : index === 2
                              ? (theme === 'dark' ? 'bg-orange-700 text-white' : 'bg-orange-500 text-white')
                              : (theme === 'dark' ? 'bg-zinc-700 text-gray-300' : 'bg-gray-200 text-gray-600')
                      )}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(isMobile ? 'font-medium text-[13px] truncate' : 'font-medium text-sm truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {item.student.name}
                        </p>
                        {item.student.gradeName && (
                          <p className={cn(isMobile ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {item.student.gradeName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-end gap-0 cursor-help">
                            <p className={cn(isMobile ? 'font-bold text-[15px] leading-tight' : 'font-bold text-base leading-tight', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {item.globalScore.toFixed(1)}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p>Puntaje global de la fase (escala 0-500). Solo incluye estudiantes que completaron las 7 materias.</p>
                        </TooltipContent>
                      </UITooltip>
                      <p className={cn(isMobile ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {item.student.campusName || 'N/A'} • {item.student.jornada ? item.student.jornada.charAt(0).toUpperCase() + item.student.jornada.slice(1) : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
            {institutionStudentsRanking.length > RANKING_INITIAL_VISIBLE && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRanking((v) => !v)}
                  className={cn('text-xs', theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}
                >
                  {showAllRanking ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver más ({institutionStudentsRanking.length - RANKING_INITIAL_VISIBLE} más)
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 space-y-2">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes con resultados para los filtros seleccionados
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'} · {rankingFilters.year} · {gradeLabel} · {rankingFilters.jornada === 'todas' ? 'Todas las jornadas' : rankingFilters.jornada}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente de Sedes
function CampusesTab({ theme, stats, currentRector }: any) {
  const { isLoading } = useCampusOptions(currentRector?.institutionId || '')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Building2 className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Sedes Institucionales
          </CardTitle>
          <CardDescription>Rendimiento y estadísticas por sede</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.campusOverview.map((campus: any) => (
            <div
              key={campus.id}
              className={cn("p-6 rounded-xl border-2 transition-colors duration-150", 
                theme === 'dark' 
                  ? 'border-zinc-700 hover:border-blue-600 bg-zinc-800' 
                  : 'border-gray-300 hover:border-blue-600 bg-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn('font-bold text-xl', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {campus.name}
                </h3>
                <Badge className={cn(
                  "text-white",
                  theme === 'dark'
                    ? "bg-gradient-to-r from-blue-800 to-slate-800"
                    : "bg-gradient-to-r from-blue-700 to-slate-700"
                )}>
                  {campus.average}% promedio
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <p className={cn('text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Estudiantes</p>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.students}
                  </p>
                </div>
                <div className={cn("text-center p-3 rounded-lg", theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100')}>
                  <p className={cn('text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Docentes</p>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.teachers}
                  </p>
                </div>
                <div className={cn("text-center p-3 rounded-lg", theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-100')}>
                  <p className={cn('text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Coordinador</p>
                  <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.principal}
                  </p>
                </div>
              </div>
              <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                <div
                  style={{ width: `${campus.average}%` }}
                  className={cn(
                    "absolute h-full rounded-full transition-[width] duration-500",
                    theme === 'dark'
                      ? "bg-gradient-to-r from-blue-800 to-slate-800"
                      : "bg-gradient-to-r from-blue-700 to-slate-700"
                  )}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Administrativos (unifica Coordinadores y Docentes con jerarquía)
function AdministrativosTab({ theme, coordinators, teachers }: any) {
  const isCoordinatorRole = (role: unknown): boolean => {
    const normalizedRole = String(role || '').toLowerCase().trim()
    return normalizedRole === '' || normalizedRole === 'principal' || normalizedRole === 'coordinator'
  }

  const safeCoordinators = (coordinators || []).filter((coordinator: any) => isCoordinatorRole(coordinator?.role))

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <UserCog className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Estructura Administrativa
          </CardTitle>
          <CardDescription>Organización jerárquica: Coordinadores → Docentes → Estudiantes</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-3">
            {/* Coordinadores */}
            {safeCoordinators.map((coordinator: any) => {
              const campusTeachers = teachers.filter((t: any) => t.campusId === coordinator.campusId)
              return (
                <AccordionItem
                  key={coordinator.id}
                  value={`coordinator-${coordinator.id}`}
                  className={cn("border rounded-lg", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-300 bg-gray-100')}
                >
                  <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <div className="flex items-center gap-3 w-full">
                      <Crown className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                      <div className="flex-1 text-left">
                        <h4 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <span className={cn('text-xs font-normal mr-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {coordinator.campusName || 'Sede Principal'} - 
                          </span>
                          {coordinator.name}
                        </h4>
                      </div>
                      <Badge className={cn(
                        "text-white text-xs",
                        theme === 'dark' ? "bg-blue-800" : "bg-blue-700"
                      )}>
                        {campusTeachers.length} Docentes
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    {/* Docentes */}
                    {campusTeachers.length > 0 ? (
                      <TeachersAccordion 
                        teachers={campusTeachers}
                        theme={theme}
                      />
                    ) : (
                      <p className={cn('text-sm text-center py-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        No hay docentes asignados a esta sede
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
            {safeCoordinators.length === 0 && (
              <p className={cn('text-sm text-center py-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                No hay coordinadores asignados
              </p>
            )}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente Accordion para docentes con estado controlado
function TeachersAccordion({ teachers, theme }: any) {
  const [expandedTeachers, setExpandedTeachers] = useState<string[]>([])

  return (
    <Accordion 
      type="multiple" 
      className="w-full mt-3 space-y-2"
      value={expandedTeachers}
      onValueChange={setExpandedTeachers}
    >
      {teachers.map((teacher: any) => (
        <TeacherWithStudents
          key={teacher.id}
          teacher={teacher}
          theme={theme}
          isExpanded={expandedTeachers.includes(`teacher-${teacher.id}`)}
        />
      ))}
    </Accordion>
  )
}

// Componente para mostrar docente con sus estudiantes
function TeacherWithStudents({ teacher, theme, isExpanded }: any) {
  const teacherId = teacher.id || teacher.uid
  
  // Obtener estudiantes usando el hook específico del docente
  const { data: teacherStudents, isLoading: studentsLoading } = useStudentsByTeacher(
    teacherId || '',
    isExpanded // Solo cargar cuando esté expandido
  )
  
  // También obtener estudiantes usando filtros como fallback (igual que en admin)
  const { students: filteredStudentsByTeacher } = useFilteredStudents({
    institutionId: teacher.institutionId || teacher.inst,
    campusId: teacher.campusId || teacher.campus,
    gradeId: teacher.gradeId || teacher.grade,
    isActive: true
  })
  
  // Usar los estudiantes del hook o los filtrados directamente como fallback
  const displayStudents = isExpanded 
    ? (teacherStudents && teacherStudents.length > 0 ? teacherStudents : filteredStudentsByTeacher)
    : []

  return (
    <AccordionItem
      value={`teacher-${teacher.id}`}
      className={cn("border rounded-lg", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/30' : 'border-gray-200 bg-gray-50')}
    >
      <AccordionTrigger 
        className={cn("px-3 py-2 hover:no-underline", theme === 'dark' ? 'text-white' : 'text-gray-900')}
      >
        <div className="flex items-center gap-3 w-full">
          <GraduationCap className={cn("h-4 w-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          <div className="flex-1 text-left">
            <h5 className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {teacher.name}
            </h5>
            {teacher.gradeName && (
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Grado: {teacher.gradeName}
              </p>
            )}
          </div>
          <Badge className={cn(
            "text-white text-xs",
            theme === 'dark' ? "bg-slate-700" : "bg-slate-600"
          )}>
            {displayStudents.length || filteredStudentsByTeacher?.length || 0} Estudiantes
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3">
        {/* Nivel 4: Estudiantes */}
        {studentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className={cn("h-4 w-4 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          </div>
        ) : displayStudents && displayStudents.length > 0 ? (
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {displayStudents.map((student: any) => (
              <div
                key={student.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md",
                  theme === 'dark' ? 'bg-zinc-700/50 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <Users className={cn("h-3 w-3", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                <span className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  {student.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn('text-xs text-center py-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No hay estudiantes asignados
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

// Componente de Estudiantes
function StudentsTab({ theme, students }: any) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Agrupar estudiantes por sede y grado
  const groupedStudents = students.reduce((acc: any, student: any) => {
    const campusName = student.campusName || 'Sin sede'
    const gradeName = student.gradeName || 'Sin grado'
    const key = `${campusName}|||${gradeName}`
    
    if (!acc[key]) {
      acc[key] = {
        campusName,
        gradeName,
        students: []
      }
    }
    acc[key].students.push(student)
    return acc
  }, {})

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Users className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Total Estudiantes: {students.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 max-h-[600px] overflow-y-auto">
            {Object.values(groupedStudents).map((group: any, groupIndex: number) => (
              <div key={groupIndex} className="space-y-2">
                <div className={cn("flex items-center gap-2 pb-2 border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
                  <Building2 className={cn("h-4 w-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  <span className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {group.campusName}
                  </span>
                  <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    • {group.gradeName}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {group.students.map((student: any) => (
                    <div
                      key={student.id || student.uid}
                      onClick={() => handleStudentClick(student)}
                      className={cn(
                        "p-2 rounded-lg border cursor-pointer transition-colors duration-150",
                        theme === 'dark' 
                          ? 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-600' 
                          : 'border-gray-300 bg-gray-200 hover:bg-gray-300 hover:border-gray-400'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0",
                          theme === 'dark'
                            ? "bg-gradient-to-br from-blue-800 to-slate-800"
                            : "bg-gradient-to-br from-blue-700 to-slate-700"
                        )}>
                          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-medium text-xs truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {student.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para mostrar resumen y diagnóstico */}
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

// Componentes auxiliares para mostrar rendimiento y fortalezas/debilidades
// Función helper para mapear nombres de pruebas a nombres descriptivos (solo para visualización)
function getTestDisplayName(testName: string): string {
  const testNameMap: Record<string, string> = {
    'Prueba 1': 'Comprensión de avisos públicos',
    'Prueba 2': 'Vocabulario, Asociación semántica',
    'Prueba 3': 'Competencia comunicativa',
    'Prueba 4': 'Comprensión lectora',
    'Prueba 5': 'Comprensión global del texto',
    'Prueba 6': 'Comprensión lectora avanzada',
    'Prueba 7': 'Preposiciones y conectores',
  };
  
  // Retornar el nombre mapeado si existe, de lo contrario retornar el nombre original
  return testNameMap[testName] || testName;
}

function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: any[], theme?: 'light' | 'dark', subjectsWithTopics?: any[] }) {
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject: any) => {
          const hasStrengths = subject.strengths?.length > 0
          const hasNeutrals = subject.neutrals?.length > 0
          const hasWeaknesses = subject.weaknesses?.length > 0
          const isEnglish = subject.name === 'Inglés' || subject.name?.toLowerCase() === 'inglés'
          
          // Determinar color según el porcentaje
          const getPercentageColor = (percentage: number) => {
            if (percentage >= 65) return theme === 'dark' ? 'text-green-400' : 'text-green-600'
            if (percentage >= 50) return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            return theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }
          
          return (
            <AccordionItem key={subject.name} value={subject.name} className={cn("border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
              <AccordionTrigger className={cn("hover:no-underline", theme === 'dark' ? 'text-white' : '')}>
                <div className="flex items-center justify-between w-full pr-4">
                  <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-sm font-semibold", getPercentageColor(subject.percentage))}>
                      {subject.percentage}%
                    </span>
                    {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                      <div className="flex items-center gap-1.5">
                        {hasStrengths && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-green-900/50 text-green-300 border-green-700" : "bg-green-100 text-green-700 border-green-300")}>
                            {subject.strengths.length}
                          </Badge>
                        )}
                        {hasNeutrals && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-yellow-900/50 text-yellow-300 border-yellow-700" : "bg-yellow-100 text-yellow-700 border-yellow-300")}>
                            {subject.neutrals.length}
                          </Badge>
                        )}
                        {hasWeaknesses && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-red-900/50 text-red-300 border-red-700" : "bg-red-100 text-red-700 border-red-300")}>
                            {subject.weaknesses.length}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className={cn("space-y-4 pt-2", theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border border-gray-200')}>
                  {/* Temas */}
                  {subject.topics && subject.topics.length > 0 && (
                    <div className="space-y-3">
                      <h4 className={cn("text-xs font-semibold mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Temas
                      </h4>
                      {subject.topics.map((topic: any) => (
                        <div key={topic.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                              {isEnglish ? getTestDisplayName(topic.name) : topic.name}
                            </span>
                            <span className={cn("text-xs font-semibold", getPercentageColor(topic.percentage))}>
                              {topic.percentage}%
                            </span>
                          </div>
                          <Progress 
                            value={topic.percentage} 
                            className={cn(
                              "h-2",
                              topic.percentage >= 65 ? 'bg-green-500' :
                              topic.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Fortalezas, Neutros y Debilidades en horizontal */}
                  {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Fortalezas */}
                      {hasStrengths && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                            Fortalezas ({subject.strengths.length})
                          </span>
                        </div>
                      )}
                      
                      {/* Neutros */}
                      {hasNeutrals && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700')}>
                            Neutro ({subject.neutrals.length})
                          </span>
                        </div>
                      )}
                      
                      {/* Debilidades */}
                      {hasWeaknesses && (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-red-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-red-400' : 'text-red-700')}>
                            Debilidades ({subject.weaknesses.length})
                          </span>
                        </div>
                      )}
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
        const percentage = subject.percentage || subject.score
        const getColor = (pct: number) => {
          if (pct >= 65) return theme === 'dark' ? 'text-green-400' : 'text-green-600'
          if (pct >= 50) return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
          return theme === 'dark' ? 'text-red-400' : 'text-red-600'
        }
        
        return (
          <div key={subject.name} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
              <span className={cn("text-sm font-semibold", getColor(percentage))}>
                {percentage}%
              </span>
            </div>
            <Progress 
              value={percentage} 
              className={cn(
                "h-2",
                percentage >= 65 ? 'bg-green-500' :
                percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

// Componente de Dialog para mostrar resumen y diagnóstico del estudiante
function StudentDetailDialog({ student, isOpen, onClose, theme }: any) {
  const studentId = student?.id || student?.uid
  const { data: studentAnalysis, isLoading } = useStudentAnalysis(studentId, isOpen && !!studentId)
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('phase1')
  
  // Función para normalizar nombres de materias
  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      'biologia': 'Biologia', 'biología': 'Biologia', 'biology': 'Biologia',
      'quimica': 'Quimica', 'química': 'Quimica', 'chemistry': 'Quimica',
      'fisica': 'Física', 'física': 'Física', 'physics': 'Física',
      'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas', 'math': 'Matemáticas',
      'lenguaje': 'Lenguaje', 'language': 'Lenguaje',
      'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
      'ingles': 'Inglés', 'inglés': 'Inglés', 'english': 'Inglés'
    }
    return subjectMap[normalized] || subject
  }

  // Obtener datos de materias con temas para la fase seleccionada (para Resumen)
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['student-subjects-data', studentId, selectedPhase],
    queryFn: async () => {
      if (!studentId) return { subjects: [], subjectsWithTopics: [] }
      
      const phases = [
        { key: 'first', name: 'fase I' },
        { key: 'second', name: 'Fase II' },
        { key: 'third', name: 'fase III' }
      ]
      
      const selectedPhases = selectedPhase === 'all' 
        ? phases 
        : selectedPhase === 'phase1' 
          ? [phases[0]]
          : selectedPhase === 'phase2'
          ? [phases[1]]
          : [phases[2]]
      
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
              const subject = normalizeSubjectName(examData.subject)
              const percentage = examData.score.overallPercentage || 0
              
              if (!subjectScores[subject] || percentage > subjectScores[subject]) {
                subjectScores[subject] = percentage
              }
              
              if (!subjectTotals[subject]) {
                subjectTotals[subject] = { correct: 0, total: 0 }
              }
              subjectTotals[subject].correct += examData.score.correctAnswers || 0
              subjectTotals[subject].total += examData.score.totalQuestions || 0
              
              if (examData.questionDetails && Array.isArray(examData.questionDetails)) {
                examData.questionDetails.forEach((question: any) => {
                  const topic = question.topic || 'General'
                  if (!subjectTopicGroups[subject]) {
                    subjectTopicGroups[subject] = {}
                  }
                  if (!subjectTopicGroups[subject][topic]) {
                    subjectTopicGroups[subject][topic] = []
                  }
                  subjectTopicGroups[subject][topic].push(question)
                })
              }
            }
          })
        } catch (error) {
          console.error(`Error obteniendo datos para fase ${phase.name}:`, error)
        }
      }
      
      const subjectsWithTopics: any[] = []
      Object.entries(subjectTopicGroups).forEach(([subject, topics]) => {
        const topicData = Object.entries(topics).map(([topicName, questions]) => {
          const correct = questions.filter((q: any) => q.isCorrect).length
          const total = questions.length
          const percentage = total > 0 ? Math.round((correct / total) * 100) : 0
          return { name: topicName, percentage, correct, total }
        })
        
        const strengths = topicData.filter(t => t.percentage >= 65).map(t => t.name)
        const weaknesses = topicData.filter(t => t.percentage < 50).map(t => t.name)
        const neutrals = topicData.filter(t => t.percentage >= 50 && t.percentage < 65).map(t => t.name)
        
        subjectsWithTopics.push({
          name: subject,
          percentage: Math.round(subjectScores[subject] || 0),
          topics: topicData,
          strengths,
          weaknesses,
          neutrals
        })
      })
      
      const subjects = Object.entries(subjectScores).map(([name, percentage]) => {
        const totals = subjectTotals[name] || { correct: 0, total: 0 }
        return {
          name,
          percentage: Math.round(percentage),
          score: Math.round(percentage),
          maxScore: 100,
          correct: totals.correct,
          total: totals.total,
          strengths: subjectsWithTopics.find(s => s.name === name)?.strengths || [],
          weaknesses: subjectsWithTopics.find(s => s.name === name)?.weaknesses || [],
          improvement: ''
        }
      })
      
      return { subjects, subjectsWithTopics }
    },
    enabled: isOpen && !!studentId,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Obtener datos de las 3 fases para el gráfico de evolución (para Diagnóstico)
  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ['student-phases-data', studentId],
    queryFn: async () => {
      if (!studentId) return { phase1: null, phase2: null, phase3: null }
      
      const phases = [
        { key: 'phase1', name: 'fase I' },
        { key: 'phase2', name: 'Fase II' },
        { key: 'phase3', name: 'fase III' }
      ]
      
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
        } catch (error) {
          console.error(`Error obteniendo datos para fase ${phase.name}:`, error)
        }
      }
      
      // Procesar datos por fase
      const processPhaseData = (results: any[]) => {
        const subjectScores: { [subject: string]: number } = {}
        results.forEach(result => {
          const subject = result.subject
          if (!subjectScores[subject] || result.percentage > subjectScores[subject]) {
            subjectScores[subject] = result.percentage
          }
        })
        
        return Object.entries(subjectScores).map(([name, percentage]) => ({
          name,
          percentage: Math.round(percentage)
        }))
      }
      
      return {
        phase1: phaseResults.phase1.length > 0 ? { phase: 'phase1' as const, subjects: processPhaseData(phaseResults.phase1) } : null,
        phase2: phaseResults.phase2.length > 0 ? { phase: 'phase2' as const, subjects: processPhaseData(phaseResults.phase2) } : null,
        phase3: phaseResults.phase3.length > 0 ? { phase: 'phase3' as const, subjects: processPhaseData(phaseResults.phase3) } : null
      }
    },
    enabled: isOpen && !!studentId,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
      <DialogContent className={cn(
        "max-w-6xl max-h-[90vh] overflow-y-auto",
        theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300'
      )}>
        <DialogHeader>
          <DialogTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {(student as any).name || (student as any).displayName || 'Estudiante'} - Resumen y Diagnóstico
          </DialogTitle>
          <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.campusName && `${student.campusName} • `}{student.gradeName || ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          </div>
        ) : studentAnalysis && phaseMetrics ? (
          <div className="space-y-6">
            {/* Selector de Fase */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setSelectedPhase('phase1')}
                variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase1'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : ''
                )}
              >
                Fase I
                {studentAnalysis.phaseMetrics?.phase1 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase1.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('phase2')}
                variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase2'
                    ? 'bg-green-600 hover:bg-green-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : ''
                )}
              >
                Fase II
                {studentAnalysis.phaseMetrics?.phase2 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase2.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('phase3')}
                variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase3'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : ''
                )}
              >
                Fase III
                {studentAnalysis.phaseMetrics?.phase3 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase3.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('all')}
                variant={selectedPhase === 'all' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'all'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : ''
                )}
              >
                Todas las Fases
              </Button>
            </div>

            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Puntaje Global */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {phaseMetrics.globalScore}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntaje Global</p>
                    </div>
                    <Award className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Porcentaje de Fase */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                        {phaseMetrics.phasePercentage}%
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Porcentaje de Fase {selectedPhase === 'phase1' ? 'I' : selectedPhase === 'phase2' ? 'II' : selectedPhase === 'phase3' ? 'III' : ''}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Progress value={phaseMetrics.phasePercentage} className="h-2" />
                    <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {phaseMetrics.completedSubjects} de 7 materias completadas
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Tiempo Promedio */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {phaseMetrics.averageTimePerQuestion.toFixed(1)}m
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Tiempo Promedio por Pregunta
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Intento de Fraude */}
              <Card className={cn(
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 
                phaseMetrics.fraudAttempts === 0 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200'
                  : phaseMetrics.fraudAttempts <= 2
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-gray-200'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        phaseMetrics.fraudAttempts === 0 
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : phaseMetrics.fraudAttempts <= 2
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-red-400' : 'text-red-700'
                      )}>
                        {phaseMetrics.fraudAttempts}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Intento de fraude</p>
                    </div>
                    <Shield className={cn(
                      "h-8 w-8",
                      phaseMetrics.fraudAttempts === 0 
                        ? 'text-green-500'
                        : phaseMetrics.fraudAttempts <= 2
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Porcentaje de Suerte */}
              <Card className={cn(
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 
                phaseMetrics.luckPercentage < 20 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200'
                  : phaseMetrics.luckPercentage <= 40
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200'
                  : 'bg-gradient-to-br from-orange-50 to-red-50 border-gray-200'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        phaseMetrics.luckPercentage < 20
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : phaseMetrics.luckPercentage <= 40
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-orange-400' : 'text-orange-700'
                      )}>
                        {phaseMetrics.luckPercentage}%
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Suerte</p>
                    </div>
                    <Zap className={cn(
                      "h-8 w-8",
                      phaseMetrics.luckPercentage < 20
                        ? 'text-green-500'
                        : phaseMetrics.luckPercentage <= 40
                        ? 'text-yellow-500'
                        : 'text-orange-500'
                    )} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs para Resumen y Diagnóstico */}
            <Tabs defaultValue="resumen" className="space-y-4">
              <TabsList className={cn("grid w-full grid-cols-2", theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100')}>
                <TabsTrigger value="resumen" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="diagnostico" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>
                  Diagnóstico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200')}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <PieChartIcon className="h-5 w-5" />
                      Rendimiento académico por materia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                      </div>
                    ) : subjectsData && subjectsData.subjectsWithTopics && subjectsData.subjectsWithTopics.length > 0 ? (
                      <PerformanceChart 
                        data={subjectsData.subjects} 
                        subjectsWithTopics={subjectsData.subjectsWithTopics}
                        theme={theme} 
                      />
                    ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                      <PerformanceChart 
                        data={subjectsData.subjects} 
                        theme={theme} 
                      />
                    ) : (
                      <p className={cn("text-sm text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        No hay datos de materias disponibles para esta fase
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostico" className="space-y-6">
                {subjectsLoading || phasesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  </div>
                ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                  <>
                    {/* Primera Fila: Radar Chart y Evolución por Materia */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Radar Chart de Fortalezas/Debilidades */}
                      <StrengthsRadarChart
                        subjects={subjectsData.subjects}
                        theme={theme}
                      />

                      {/* Gráfico de Evolución por Materia */}
                      <SubjectsProgressChart
                        phase1Data={phasesData?.phase1 || null}
                        phase2Data={phasesData?.phase2 || null}
                        phase3Data={phasesData?.phase3 || null}
                        theme={theme}
                      />
                    </div>

                    {/* Resumen General de Desempeño */}
                    <SubjectsDetailedSummary
                      subjects={subjectsData.subjects}
                      subjectsWithTopics={subjectsData.subjectsWithTopics}
                      theme={theme}
                    />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      No hay datos de diagnóstico disponibles para esta fase
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para este estudiante
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Componente de Resultados
function ResultsTab({ theme, stats, staticData }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <TrendingUp className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Rendimiento Semestral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={staticData.performanceData}>
                <defs>
                  <linearGradient id="colorPromedio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#1e40af' : '#2563eb'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#1e40af' : '#2563eb'} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAsistencia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#374151' : '#4b5563'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#374151' : '#4b5563'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="promedio" stroke={theme === 'dark' ? '#1e40af' : '#2563eb'} fillOpacity={1} fill="url(#colorPromedio)" />
                <Area type="monotone" dataKey="asistencia" stroke={theme === 'dark' ? '#374151' : '#4b5563'} fillOpacity={1} fill="url(#colorAsistencia)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Target className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Evaluación Integral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={staticData.radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Rendimiento" dataKey="A" stroke={theme === 'dark' ? '#1e40af' : '#2563eb'} fill={theme === 'dark' ? '#1e40af' : '#2563eb'} fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Métricas de Rendimiento Institucional
          </CardTitle>
          <CardDescription>Indicadores clave de desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Promedio General', value: stats.performanceMetrics.overallAverage, color: 'blue' },
              { label: 'Asistencia', value: stats.performanceMetrics.attendanceRate, color: 'blue' },
              { label: 'Coordinadores', value: stats.performanceMetrics.coordinatorsCount, color: 'slate' },
              { label: 'Retención Docente', value: stats.performanceMetrics.teacherRetention, color: 'blue' },
            ].map((metric) => (
              <div
                key={metric.label}
                className="space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {metric.label}
                  </span>
                  <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {metric.value}{metric.label !== 'Coordinadores' ? '%' : ''}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                  <div
                    style={{ width: `${metric.value}%` }}
                    className={cn("absolute h-full rounded-full transition-[width] duration-500", 
                      metric.color === 'blue' 
                        ? (theme === 'dark' ? 'bg-gradient-to-r from-blue-800 to-blue-900' : 'bg-gradient-to-r from-blue-700 to-blue-800')
                        : (theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-800' : 'bg-gradient-to-r from-slate-600 to-slate-700')
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componentes auxiliares (mantener los existentes)
