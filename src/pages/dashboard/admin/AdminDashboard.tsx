import { useState, useMemo } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  Building,
  Activity,
  Server,
  Lock,
  BarChart3,
  Home,
  BookOpen,
  Brain,
  ClipboardCheck,
  Loader2,
  DollarSign,
  FileText,
  FolderOpen,
  ChevronDown,
  Settings,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import UserManagement from '@/components/admin/UserManagement'
import InstitutionManagement from '@/components/admin/InstitutionManagement'
import QuestionBank from '@/components/admin/QuestionBank'
import PhaseAuthorizationManagement from '@/components/admin/PhaseAuthorizationManagement'
import StudyPlanAuthorizationManagement from '@/components/admin/StudyPlanAuthorizationManagement'
import { useAdminStats } from '@/hooks/query/useAdminStats'
import DailyUsageChart from '@/components/admin/DailyUsageChart'
import MonthlyRevenueChart from '@/components/admin/MonthlyRevenueChart'
import { useInstitutionUserCounts } from '@/hooks/query/useInstitutionUserCounts'
import AdminAnalysis from '@/components/admin/AdminAnalysis'
import { useAdminAnalysis } from '@/hooks/query/useAdminAnalysis'
import { useGradeAnalysis } from '@/hooks/query/useGradeAnalysis'
import { useAllGradeOptions } from '@/hooks/query/useInstitutionQuery'
import RegistrationSettings from '@/components/admin/RegistrationSettings'
import StudentPhaseReports from '@/components/admin/StudentPhaseReports'
import AdminRecursos from '@/components/admin/AdminRecursos'
import AdminHerramientasIA from '@/components/admin/AdminHerramientasIA'

interface AdminDashboardProps extends ThemeContextProps {}

export default function AdminDashboard({ theme }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const currentYear = new Date().getFullYear()
  const [filterYear, setFilterYear] = useState<number>(currentYear)
  const [filterBudgetYear, setFilterBudgetYear] = useState<string | number>(currentYear)
  
  const { totalUsers, totalInstitutions, activeSessions, systemUptimeDays, totalCompletedExams, isLoading } = useAdminStats()
  const { data: institutionUserCounts, isLoading: isLoadingInstitutions } = useInstitutionUserCounts(filterYear)
  const { data: budgetInstitutionUserCounts, isLoading: isLoadingBudgetInstitutions } = useInstitutionUserCounts(
    filterBudgetYear === 'total' ? undefined : (typeof filterBudgetYear === 'number' ? filterBudgetYear : parseInt(filterBudgetYear.toString()))
  )

  // Estados para filtros del ranking
  const [filterRankingGrade, setFilterRankingGrade] = useState<string>('all')
  const [filterRankingJornada, setFilterRankingJornada] = useState<string>('all')
  const [filterRankingYear, setFilterRankingYear] = useState<number>(currentYear)

  // Obtener datos para el ranking
  const { data: rankingAnalysis } = useAdminAnalysis(
    filterRankingJornada !== 'all' ? filterRankingJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterRankingYear
  )
  
  const { data: rankingGradeAnalysis, isLoading: isLoadingRankingGradeAnalysis } = useGradeAnalysis(
    filterRankingGrade !== 'all' ? filterRankingGrade : '',
    filterRankingGrade !== 'all',
    filterRankingJornada !== 'all' ? filterRankingJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterRankingYear
  )

  const { options: gradeOptions } = useAllGradeOptions()

  // Obtener todos los grados únicos disponibles
  const uniqueGrades = useMemo(() => {
    const gradeSet = new Set<string>()
    gradeOptions.forEach(grade => {
      if (grade.label) {
        gradeSet.add(grade.label)
      }
    })
    return Array.from(gradeSet).sort()
  }, [gradeOptions])

  // Datos para el ranking: usar datos filtrados según filtros del ranking
  const rankingData = useMemo(() => {
    // Si hay un filtro de grado activo en el ranking, usar los datos del análisis por grado
    if (filterRankingGrade !== 'all' && rankingGradeAnalysis) {
      return rankingGradeAnalysis
    }
    
    // Si no hay filtro de grado, usar datos generales
    return rankingAnalysis || []
  }, [rankingAnalysis, filterRankingGrade, rankingGradeAnalysis])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Dashboard Administrador
          </h1>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Panel de control del sistema educativo
          </p>
        </div>
        <Badge variant="secondary" className={cn("text-sm", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
          Rol: Administrador
        </Badge>
      </div>

      {/* Tabs Navigation - Barra con menús desplegables horizontales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <nav
          className={cn(
            "flex w-full items-center justify-evenly gap-2 rounded-lg border p-1 text-sm font-medium",
            theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-muted border-border/30 shadow-sm'
          )}
        >
          {/* Inicio - sin desplegable */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === 'overview'
                ? theme === 'dark'
                  ? 'bg-teal-600/80 text-white'
                  : 'bg-primary text-primary-foreground'
                : theme === 'dark'
                  ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                  : 'text-black hover:bg-gray-100'
            )}
          >
            <Home className="h-4 w-4" />
            <span>Inicio</span>
          </button>

          {/* Nos conforman: Usuarios, Instituciones, Registro */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['users', 'institutions', 'settings'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <Users className="h-4 w-4" />
                <span>Nos conforman</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('users')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'users' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Users className="mr-2 h-4 w-4" />
                Usuarios
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('institutions')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'institutions' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Building className="mr-2 h-4 w-4" />
                Instituciones
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'settings' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Settings className="mr-2 h-4 w-4" />
                Registro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Estudio: Preguntas, Fases, Planes de Estudio, Recursos */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['questions', 'phases', 'study-plans', 'recursos', 'herramientas-ia'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <BookOpen className="h-4 w-4" />
                <span>Estudio</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('questions')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'questions' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Preguntas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('phases')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'phases' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Lock className="mr-2 h-4 w-4" />
                Fases
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('study-plans')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'study-plans' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Brain className="mr-2 h-4 w-4" />
                Planes de Estudio
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('recursos')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'recursos' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Recursos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('herramientas-ia')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'herramientas-ia' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Centro de Herramientas IA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resultados: Análisis, Resúmenes PDF */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['analytics', 'reports'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Resultados</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'analytics' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Análisis
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('reports')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'reports' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <FileText className="mr-2 h-4 w-4" />
                Resúmenes PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <TabsContent value="overview" className="space-y-6">

      {/* Estadísticas principales del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Total Usuarios
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {totalUsers.toLocaleString()}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Todos los roles
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Instituciones
            </CardTitle>
            <Building className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {totalInstitutions}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Total registradas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Sesiones Activas
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {activeSessions.toLocaleString()}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                  Actualizado cada 5 min
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Tiempo de Actividad
            </CardTitle>
            <Server className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {systemUptimeDays}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                  {systemUptimeDays === 1 ? 'día en operación' : 'días en operación'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Pruebas Presentadas
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {totalCompletedExams.toLocaleString()}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Exámenes completados
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex-1">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Presupuesto Total
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select 
                value={filterBudgetYear.toString()} 
                onValueChange={(value) => setFilterBudgetYear(value === 'total' ? 'total' : parseInt(value))}
              >
                <SelectTrigger className={cn("w-[110px] h-7 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingBudgetInstitutions ? (
              <div className={cn('text-2xl font-bold animate-pulse', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Cargando...
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  ${(() => {
                    const totalStudents = budgetInstitutionUserCounts.reduce((sum, inst) => sum + inst.students, 0)
                    const totalBudget = totalStudents * 120000
                    return totalBudget.toLocaleString('es-CO')
                  })()}
                </div>
                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Ingresos esperados ({(() => {
                    const totalStudents = budgetInstitutionUserCounts.reduce((sum, inst) => sum + inst.students, 0)
                    return totalStudents.toLocaleString('es-CO')
                  })()} estudiantes × $120.000)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfica de uso diario */}
      <DailyUsageChart theme={theme} />

      {/* Gráfica de ingresos mensuales */}
      <MonthlyRevenueChart theme={theme} />

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Instituciones */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Ranking de Instituciones
                </CardTitle>
                <CardDescription>
                  Ordenadas por puntaje de Fase III
                </CardDescription>
              </div>
              <div className="ml-4 flex gap-2">
                <Select value={filterRankingGrade} onValueChange={setFilterRankingGrade}>
                  <SelectTrigger className={cn("w-[180px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Todos los grados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grados</SelectItem>
                    {uniqueGrades.map((gradeName) => (
                      <SelectItem key={gradeName} value={gradeName}>
                        {gradeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRankingJornada} onValueChange={setFilterRankingJornada}>
                  <SelectTrigger className={cn("w-[150px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Todas las jornadas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las jornadas</SelectItem>
                    <SelectItem value="mañana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="única">Única</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRankingYear.toString()} onValueChange={(value) => setFilterRankingYear(parseInt(value))}>
                  <SelectTrigger className={cn("w-[140px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {isLoadingRankingGradeAnalysis && filterRankingGrade !== 'all' ? (
                <div className={cn("flex items-center justify-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                    <p>Cargando datos del ranking...</p>
                  </div>
                </div>
              ) : rankingData.length === 0 ? (
                <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay datos disponibles para el ranking
                </p>
              ) : (
                rankingData
                  .sort((a, b) => {
                    const phase3A = a.phaseStats?.phase3?.average || 0
                    const phase3B = b.phaseStats?.phase3?.average || 0
                    return phase3B - phase3A
                  })
                  .map((inst, index) => {
                    const phase3Score = inst.phaseStats?.phase3?.average || 0
                    const phase3Exams = inst.phaseStats?.phase3?.count || 0
                    return (
                      <div
                        key={inst.institutionId}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn(
                            theme === 'dark' ? 'border-zinc-600' : ''
                          )}>
                            #{index + 1}
                          </Badge>
                          <div>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {inst.institutionName}
                            </p>
                            <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {inst.totalStudents} estudiantes · {phase3Exams} exámenes
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {Math.round(phase3Score)}
                          </p>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usuarios por institución */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Usuarios por Institución
                </CardTitle>
                <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Cantidad de usuarios activos por institución
                </CardDescription>
              </div>
              <div className="ml-4">
                <Select 
                  value={filterYear.toString()} 
                  onValueChange={(value) => setFilterYear(parseInt(value))}
                >
                  <SelectTrigger className={cn("w-[140px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingInstitutions ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={cn("p-3 rounded-lg border animate-pulse", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
                    <div className={cn("h-4 w-3/4 rounded mb-2", theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                    <div className={cn("h-3 w-1/2 rounded", theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                  </div>
                ))}
              </div>
            ) : institutionUserCounts.length === 0 ? (
              <div className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay instituciones registradas</p>
              </div>
            ) : (
              institutionUserCounts.map((institution) => (
                <div 
                  key={institution.institutionId} 
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200',
                    !institution.isActive && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium truncate mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.institutionName}
                      </p>
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        {institution.userCount.toLocaleString()} {institution.userCount === 1 ? 'usuario' : 'usuarios'}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <Badge 
                        variant={institution.isActive ? 'default' : 'secondary'} 
                        className={cn(
                          theme === 'dark' && institution.isActive 
                            ? 'bg-blue-600 text-white' 
                            : theme === 'dark' 
                              ? 'bg-zinc-700 text-white border-zinc-600' 
                              : ''
                        )}
                      >
                        {institution.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Desglose por rol */}
                  <div className={cn(
                    "grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t",
                    theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                  )}>
                    <div className="text-center">
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Rectores
                      </p>
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.rectors}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Coordinadores
                      </p>
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.coordinators}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Docentes
                      </p>
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.teachers}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Estudiantes
                      </p>
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.students}
                      </p>
                    </div>
                  </div>
                  
                  {/* Desglose por jornada (solo si hay estudiantes) */}
                  {institution.students > 0 && (
                    <div className={cn(
                      "grid grid-cols-3 gap-2 pt-3 border-t",
                      theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                    )}>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Mañana
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.jornadaManana || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Tarde
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.jornadaTarde || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Única
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.jornadaUnica || 0}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

        </TabsContent>

        <TabsContent value="users">
          <UserManagement theme={theme} />
        </TabsContent>

        <TabsContent value="institutions">
          <InstitutionManagement theme={theme} />
        </TabsContent>

        <TabsContent value="questions">
          <QuestionBank theme={theme} />
        </TabsContent>

        <TabsContent value="phases">
          <PhaseAuthorizationManagement theme={theme} />
        </TabsContent>

        <TabsContent value="study-plans">
          <StudyPlanAuthorizationManagement theme={theme} />
        </TabsContent>

        <TabsContent value="recursos" className="space-y-6">
          <AdminRecursos theme={theme} />
        </TabsContent>

        <TabsContent value="herramientas-ia" className="space-y-6">
          <AdminHerramientasIA theme={theme} />
        </TabsContent>

        <TabsContent value="analytics">
          <AdminAnalysis theme={theme} />
        </TabsContent>

        <TabsContent value="reports">
          <StudentPhaseReports theme={theme} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <RegistrationSettings theme={theme} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

