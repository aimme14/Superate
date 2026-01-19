import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2,
  Users, 
  GraduationCap, 
  TrendingUp,
  School,
  CalendarDays,
  Award,
  CheckCircle2,
  Activity,
  BarChart3,
  Sparkles,
  Trophy,
  Bell,
  Loader2,
  Target,
  UserCog,
  Crown,
  Clock,
  Shield,
  Zap,
  PieChart as PieChartIcon,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCoordinatorStats } from '@/hooks/query/useCoordinatorStats'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, Legend } from 'recharts'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getFilteredStudents } from '@/controllers/student.controller'
import { useStudentsByTeacher, useFilteredStudents } from '@/hooks/query/useStudentQuery'
import { useStudentAnalysis } from '@/hooks/query/useAdminAnalysis'
import { StrengthsRadarChart } from '@/components/charts/StrengthsRadarChart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'
import { SubjectsDetailedSummary } from '@/components/charts/SubjectsDetailedSummary'

const db = getFirestore(firebaseApp)

interface PrincipalDashboardProps extends ThemeContextProps {}

export default function PrincipalDashboard({ theme }: PrincipalDashboardProps) {
  const { stats, isLoading, hasError, currentCoordinator, teachers, students } = useCoordinatorStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const [activeTab, setActiveTab] = useState('inicio')
  const [rankingFilters, setRankingFilters] = useState<{
    jornada: 'mañana' | 'tarde' | 'única' | 'todas'
    phase: 'first' | 'second' | 'third'
    year: number
  }>({
    jornada: 'todas',
    phase: 'third',
    year: new Date().getFullYear()
  })

  // Datos estáticos adaptados para coordinador - usando datos reales
  const staticData = useMemo(() => ({
    recentActivities: [
      { id: 1, type: 'teacher', title: `Docentes activos en ${stats.campusName}`, time: 'Reciente', icon: GraduationCap },
      { id: 2, type: 'student', title: `${stats.totalStudents} estudiantes en la sede`, time: 'Actualizado', icon: Users },
      { id: 3, type: 'achievement', title: 'Mejor rendimiento del mes en la sede', time: '5 días atrás', icon: Award },
      { id: 4, type: 'event', title: 'Reunión de coordinación completada', time: '1 semana atrás', icon: CalendarDays },
    ],
    achievements: [
      { id: 1, title: 'Mejor Sede del Mes', status: 'achieved', icon: Award },
      { id: 2, title: 'Tasa de Asistencia > 95%', status: 'achieved', icon: CheckCircle2 },
      { id: 3, title: `${stats.totalTeachers} Docentes Activos`, status: 'achieved', icon: GraduationCap },
      { id: 4, title: 'Promedio General > 85%', status: 'in-progress', icon: TrendingUp },
    ],
    alerts: [
      { id: 1, type: 'info', message: 'Reunión de coordinadores programada para el 20 de enero', priority: 'medium' },
      { id: 2, type: 'success', message: `${stats.totalTeachers} docentes activos en la sede`, priority: 'low' },
      { id: 3, type: 'warning', message: 'Revisión de asistencia mensual pendiente', priority: 'medium' },
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
  }), [stats])

  const COLORS = ['#1e40af', '#2563eb', '#374151', '#4b5563', '#1e3a8a', '#3b82f6']

  // Mostrar loading si los datos están cargando
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-8 w-8 border-b-2 border-primary"
        />
        <span className={cn('ml-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Cargando estadísticas...
        </span>
      </div>
    )
  }

  // Mostrar error si no se encuentra el coordinador
  if (hasError || !currentCoordinator) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {hasError ? 'Error al cargar datos' : 'Coordinador no encontrado'}
        </div>
        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          {hasError 
            ? 'Hubo un problema al cargar tus datos. Por favor, intenta recargar la página.'
            : 'No se encontró información de coordinador asociada a tu cuenta. Contacta al administrador.'}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100')}>
      <div className="flex flex-col gap-0.5">
      {/* Header con logo y gradiente animado */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative overflow-hidden rounded-none px-8 pt-8 pb-3 text-white shadow-2xl",
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img 
                  src={institutionLogo || '/assets/agustina.png'} 
                  alt={`Logo de ${institutionName}`}
                  className="w-32 h-32 object-contain rounded-xl bg-white/20 backdrop-blur-sm p-3 shadow-lg border border-white/30"
                  onError={(e) => {
                    e.currentTarget.src = '/assets/agustina.png'
                  }}
                />
              </div>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-bold mb-2"
                >
                  Bienvenido Coordinador de {stats.campusName || 'la Sede'}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg opacity-90 mb-1"
                >
                  Coordinación - {stats.campusName}
                </motion.p>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm opacity-75"
                >
                  {stats.institutionName} • {stats.coordinatorEmail}
                </motion.p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center border-2 border-white/40 shadow-lg">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 text-white" />
                <div className="text-2xl font-bold text-white">{stats.totalTeachers}</div>
                <div className="text-xs opacity-90 text-white font-medium">Docentes</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center border-2 border-white/40 shadow-lg">
                <Users className="h-8 w-8 mx-auto mb-2 text-white" />
                <div className="text-2xl font-bold text-white">{stats.totalStudents}</div>
                <div className="text-xs opacity-90 text-white font-medium">Estudiantes</div>
              </div>
            </div>
          </div>
        </div>
        {/* Decoración de fondo animada */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 opacity-10"
        >
          <School className="h-64 w-64" />
        </motion.div>
      </motion.div>
      </div>

      {/* Botones de acción animados al principio */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-3 mx-4 md:mx-6 lg:mx-8 mt-2.5"
      >
        {[
          { icon: Sparkles, label: 'Inicio', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'inicio', count: null },
          { icon: GraduationCap, label: 'Docentes', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'administrativos', count: stats?.totalTeachers || 0 },
          { icon: Users, label: 'Análisis por estudiante', color: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700', tab: 'estudiantes', count: null },
        ].map((btn, index) => (
          <motion.div
            key={btn.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
          >
            <Button
              onClick={() => setActiveTab(btn.tab)}
              className={cn(
                "w-full h-18 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br text-white shadow-lg transition-all",
                btn.color
              )}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
              >
                <btn.icon className="h-6 w-6" />
              </motion.div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{btn.label}</span>
                {btn.count !== null && (
                  <span className="text-xs opacity-90 font-medium bg-white/20 px-1.5 py-0.5 rounded-full">
                    {btn.count}
                  </span>
                )}
              </div>
            </Button>
          </motion.div>
        ))}
      </motion.div>

      {/* Contenido dinámico según tab activo */}
      <div className="mx-4 md:mx-6 lg:mx-8 mt-3">
        {/* Tab Inicio */}
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            <WelcomeTab 
              theme={theme} 
              stats={stats} 
              currentCoordinator={currentCoordinator}
              rankingFilters={rankingFilters}
              setRankingFilters={setRankingFilters}
            />
          </div>
        )}

        {/* Tab Administrativos */}
        {activeTab === 'administrativos' && (
          <div className="space-y-6">
            <AdministrativosTab 
              theme={theme} 
              teachers={teachers || []}
            />
          </div>
        )}

        {/* Tab Estudiantes */}
        {activeTab === 'estudiantes' && (
          <div className="space-y-6">
            <StudentsTab 
              theme={theme} 
              students={students || []}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Hook para contador animado
function useCountAnimation(end: number, duration: number = 2) {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    let startTime: number | null = null
    const startValue = 0
    
    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1)
      
      // Easing function para suavizar la animación
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentCount = Math.floor(startValue + (end - startValue) * easeOutQuart)
      
      setCount(currentCount)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }
    
    requestAnimationFrame(animate)
  }, [end, duration])
  
  return count
}

// Componente de contador animado
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const count = useCountAnimation(value, duration)
  return <span>{count.toLocaleString()}</span>
}

// Componente de Promedio de la Sede con filtro por fase
function CampusAverageCard({ theme, currentCoordinator, stats }: any) {
  const [selectedPhase, setSelectedPhase] = useState<'first' | 'second' | 'third'>('third')
  const campusId = currentCoordinator?.campusId
  const institutionId = currentCoordinator?.institutionId

  // Obtener estudiantes de la sede
  const { students: campusStudents } = useFilteredStudents({
    institutionId: institutionId,
    campusId: campusId,
    isActive: true
  })

  // Calcular promedio de puntajes globales (0-500) por fase
  const { data: phaseAverage, isLoading: averageLoading } = useQuery({
    queryKey: ['coordinator-campus-average', campusId, institutionId, selectedPhase],
    queryFn: async () => {
      if (!campusId || !institutionId || !campusStudents || campusStudents.length === 0) {
        return 0
      }

      const studentIds = campusStudents.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
      if (studentIds.length === 0) return 0

      const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
      const POINTS_PER_NATURALES_SUBJECT = 100 / 3
      const POINTS_PER_REGULAR_SUBJECT = 100

      const phaseMap: { [key: string]: string } = {
        'first': 'fase I',
        'second': 'Fase II',
        'third': 'fase III'
      }
      
      const phaseName = phaseMap[selectedPhase]
      
      const normalizeSubjectName = (subject: string): string => {
        const normalized = subject.trim().toLowerCase()
        const subjectMap: Record<string, string> = {
          'biologia': 'Biologia', 'biología': 'Biologia',
          'quimica': 'Quimica', 'química': 'Quimica',
          'fisica': 'Física', 'física': 'Física',
          'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas',
          'lenguaje': 'Lenguaje',
          'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
          'ingles': 'Inglés', 'inglés': 'Inglés'
        }
        return subjectMap[normalized] || subject
      }

      // Array para almacenar los globalScores de cada estudiante
      const studentGlobalScores: number[] = []

      for (const studentId of studentIds) {
        try {
          const phaseRef = collection(db, 'results', studentId, phaseName)
          const phaseSnap = await getDocs(phaseRef)
          
          // Recopilar todos los resultados del estudiante en esta fase
          const studentResults: any[] = []
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            if (examData.completed && examData.score && examData.subject) {
              studentResults.push({
                subject: examData.subject.trim(),
                percentage: examData.score.overallPercentage || 0
              })
            }
          })

          if (studentResults.length === 0) continue

          // Obtener el mejor porcentaje por materia
          const subjectScores: { [subject: string]: number } = {}
          studentResults.forEach(result => {
            const subject = normalizeSubjectName(result.subject || '')
            const percentage = result.percentage
            
            if (!subjectScores[subject] || percentage > subjectScores[subject]) {
              subjectScores[subject] = percentage
            }
          })

          // Verificar que tenga todas las materias requeridas
          const hasAllSubjects = REQUIRED_SUBJECTS.every(subject => 
            subjectScores.hasOwnProperty(subject)
          )

          if (!hasAllSubjects) continue

          // Calcular globalScore del estudiante (0-500)
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

          globalScore = Math.round(globalScore * 100) / 100
          studentGlobalScores.push(globalScore)
        } catch (error) {
          console.error(`Error obteniendo resultados para estudiante ${studentId}:`, error)
        }
      }

      if (studentGlobalScores.length === 0) return 0
      
      // Calcular promedio de los globalScores de los estudiantes
      const average = studentGlobalScores.reduce((sum, score) => sum + score, 0) / studentGlobalScores.length
      return Math.round(average * 100) / 100
    },
    enabled: !!campusId && !!institutionId && !!campusStudents && campusStudents.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}
          >
            {averageLoading ? (
              <Loader2 className={cn("h-5 w-5 animate-spin inline", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            ) : (
              <span>
                <span className={cn('text-lg font-normal mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>~</span>
                {phaseAverage || 0}
              </span>
            )}
          </motion.div>
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
                  Este promedio es una aproximación calculada a partir de los puntajes globales (0-500) de los estudiantes que han completado todas las materias en la fase seleccionada.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Select
          value={selectedPhase}
          onValueChange={(value) => setSelectedPhase(value as 'first' | 'second' | 'third')}
        >
          <SelectTrigger className={cn("h-7 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
  )
}

// Componente de Bienvenida
function WelcomeTab({ theme, stats, currentCoordinator, rankingFilters, setRankingFilters }: any) {
  const [evolutionFilters, setEvolutionFilters] = useState<{
    year: number
    subject: string
    jornada: string
    studentId: string
  }>({
    year: new Date().getFullYear(),
    subject: 'todas',
    jornada: 'todas',
    studentId: 'todos'
  })

  return (
    <div className="space-y-3">
      {/* Estadísticas principales con animaciones */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {[
          { 
            title: 'Total Estudiantes', 
            value: (stats?.totalStudents || 0).toLocaleString(), 
            change: '',
            icon: Users, 
            color: 'blue',
            gradient: theme === 'dark' ? 'from-blue-800 to-blue-900' : 'from-blue-700 to-blue-800',
            isCustom: false
          },
          { 
            title: 'Docentes', 
            value: stats?.totalTeachers || 0, 
            change: '',
            icon: GraduationCap, 
            color: 'slate',
            gradient: theme === 'dark' ? 'from-slate-700 to-slate-800' : 'from-slate-600 to-slate-700',
            isCustom: false
          },
          { 
            title: 'Promedio de la Sede', 
            value: null,
            change: '',
            icon: TrendingUp, 
            color: 'blue',
            gradient: theme === 'dark' ? 'from-blue-800 to-blue-900' : 'from-blue-700 to-blue-800',
            isCustom: true,
            customComponent: <CampusAverageCard theme={theme} currentCoordinator={currentCoordinator} stats={stats} />
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <Card className={cn(
              "relative overflow-hidden border-0 shadow-lg",
              theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-200'
            )}>
              <div className={cn("absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-full -mr-12 -mt-12", stat.gradient)} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 relative z-10">
                <CardTitle className={cn('text-xs font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {stat.title}
                </CardTitle>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                >
                  <stat.icon className={cn("h-4 w-4", `text-${stat.color}-500`)} />
                </motion.div>
              </CardHeader>
              <CardContent className="relative z-10 px-3 pb-3 pt-1">
                {stat.isCustom && stat.customComponent ? (
                  stat.customComponent
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                    >
                      {stat.value}
                    </motion.div>
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
          </motion.div>
        ))}
      </motion.div>

      {/* Ranking de estudiantes y logros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudentRankingCard 
          theme={theme}
          currentCoordinator={currentCoordinator}
          rankingFilters={rankingFilters}
          setRankingFilters={setRankingFilters}
        />

        <EvolutionBySubjectChart 
          theme={theme}
          currentCoordinator={currentCoordinator}
          filters={evolutionFilters}
          setFilters={setEvolutionFilters}
        />
      </div>
    </div>
  )
}

// Componente de Estudiantes
function StudentsTab({ theme, students }: any) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Agrupar estudiantes por grado
  const groupedStudents = students.reduce((acc: any, student: any) => {
    const gradeName = student.gradeName || 'Sin grado'
    
    if (!acc[gradeName]) {
      acc[gradeName] = {
        gradeName,
        students: []
      }
    }
    acc[gradeName].students.push(student)
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
                  <School className={cn("h-4 w-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  <span className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {group.gradeName}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {group.students.map((student: any, index: number) => (
                    <motion.div
                      key={student.id || student.uid}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.01 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => handleStudentClick(student)}
                      className={cn(
                        "p-2 rounded-lg border cursor-pointer transition-all",
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
                    </motion.div>
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

// Componente de Ranking de Estudiantes (adaptado para coordinador - solo su sede)
function StudentRankingCard({ theme, currentCoordinator, rankingFilters, setRankingFilters }: any) {
  const campusId = currentCoordinator?.campusId
  const institutionId = currentCoordinator?.institutionId
  
  const { data: campusStudents, isLoading: studentsLoading, error: rankingError } = useQuery({
    queryKey: ['coordinator-students-ranking', campusId, institutionId, rankingFilters],
    queryFn: async () => {
      try {
        if (!campusId || !institutionId) {
          return []
        }

        const filters: any = {
          institutionId: institutionId,
          campusId: campusId,
          isActive: true,
        }
        
        if (rankingFilters.jornada && rankingFilters.jornada !== 'todas' && rankingFilters.jornada !== '') {
          filters.jornada = rankingFilters.jornada
        }
        
        const studentsResult = await getFilteredStudents(filters)
        if (!studentsResult.success || !studentsResult.data) {
          return []
        }

        let students = studentsResult.data
        
        // Filtrar por año si se especifica
        if (rankingFilters.year) {
          const filteredByYear = students.filter((student: any) => {
            const getStudentYear = (student: any): number | null => {
              if (student.academicYear) return student.academicYear
              if (!student.createdAt) return null
              
              let date: Date
              if (typeof student.createdAt === 'string') {
                date = new Date(student.createdAt)
              } else if (student.createdAt?.toDate) {
                date = student.createdAt.toDate()
              } else if (student.createdAt?.seconds) {
                date = new Date(student.createdAt.seconds * 1000)
              } else {
                return null
              }
              return date.getFullYear()
            }
            const studentYear = getStudentYear(student)
            if (studentYear === null) return true
            return studentYear === rankingFilters.year
          })
          
          if (filteredByYear.length > 0) {
            students = filteredByYear
          }
        }

        const studentIds = students.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
        if (studentIds.length === 0) return []

        const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
        
        const phaseMap: { [key: string]: string } = {
          'first': 'fase I',
          'second': 'Fase II',
          'third': 'fase III',
        }
        
        const selectedPhaseName = phaseMap[rankingFilters.phase] || rankingFilters.phase
        
        const phaseResults: any[] = []

        for (const studentId of studentIds) {
          try {
            const phaseRef = collection(db, 'results', studentId, selectedPhaseName)
            const phaseSnap = await getDocs(phaseRef)
            
            phaseSnap.docs.forEach(doc => {
              const examData = doc.data()
              
              if (examData.completed && examData.score && examData.subject) {
                const subject = examData.subject.trim()
                
                phaseResults.push({
                  userId: studentId,
                  examId: doc.id,
                  phase: rankingFilters.phase,
                  subject: subject,
                  score: {
                    overallPercentage: examData.score.overallPercentage || 0,
                  },
                })
              }
            })
          } catch (error) {
            console.error(`Error obteniendo resultados para estudiante ${studentId}:`, error)
          }
        }

        const resultsByStudent = new Map<string, { scores: number[], subjects: Set<string> }>()
        
        phaseResults.forEach(result => {
          if (!resultsByStudent.has(result.userId)) {
            resultsByStudent.set(result.userId, { scores: [], subjects: new Set() })
          }
          const studentData = resultsByStudent.get(result.userId)!
          studentData.scores.push(result.score.overallPercentage)
          if (result.subject) {
            studentData.subjects.add(result.subject.trim())
          }
        })

        const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
        const POINTS_PER_NATURALES_SUBJECT = 100 / 3
        const POINTS_PER_REGULAR_SUBJECT = 100

        const normalizeSubjectName = (subject: string): string => {
          const normalized = subject.trim().toLowerCase()
          const subjectMap: Record<string, string> = {
            'biologia': 'Biologia', 'biología': 'Biologia',
            'quimica': 'Quimica', 'química': 'Quimica',
            'fisica': 'Física', 'física': 'Física',
            'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas',
            'lenguaje': 'Lenguaje',
            'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
            'ingles': 'Inglés', 'inglés': 'Inglés'
          }
          return subjectMap[normalized] || subject
        }

        const ranking: Array<{ student: any; globalScore: number; totalExams: number; completedSubjects: number }> = []
        
        students.forEach((student: any) => {
          const studentId = student.id || student.uid
          const studentData = resultsByStudent.get(studentId)
          
          if (!studentData || studentData.subjects.size === 0) {
            return
          }
          
          const hasAllSubjects = REQUIRED_SUBJECTS.every(subject => 
            studentData.subjects.has(subject)
          )
          
          if (!hasAllSubjects) {
            return
          }
          
          const studentResults = phaseResults.filter(r => r.userId === studentId)
          
          const subjectScores: { [subject: string]: number } = {}
          
          studentResults.forEach(result => {
            const subject = normalizeSubjectName(result.subject || '')
            const percentage = result.score?.overallPercentage || 0
            
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
          
          globalScore = Math.round(globalScore * 100) / 100
          
          ranking.push({
            student,
            globalScore,
            totalExams: studentData.scores.length,
            completedSubjects: studentData.subjects.size
          })
        })

        ranking.sort((a, b) => {
          if (a.totalExams === 0 && b.totalExams > 0) return 1
          if (a.totalExams > 0 && b.totalExams === 0) return -1
          return b.globalScore - a.globalScore
        })
        
        return ranking
      } catch (error) {
        console.error('Error al obtener ranking de estudiantes:', error)
        return []
      }
    },
    enabled: !!campusId && !!institutionId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Trophy className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Ranking de Mejores Estudiantes
            </CardTitle>
            <CardDescription>Top estudiantes de la sede ordenados por rendimiento</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Jornada
                </label>
                <Select
                  value={rankingFilters.jornada || 'todas'}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, jornada: value === 'todas' ? 'todas' : (value as 'mañana' | 'tarde' | 'única') })}
                >
                  <SelectTrigger className={cn("h-8 w-24 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
              <div className="flex flex-col items-center gap-0.5">
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Fase
                </label>
                <Select
                  value={rankingFilters.phase}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, phase: value as any })}
                >
                  <SelectTrigger className={cn("h-8 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
                <label className={cn("text-[10px] leading-none", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Año
                </label>
                <Select
                  value={rankingFilters.year.toString()}
                  onValueChange={(value) => setRankingFilters({ ...rankingFilters, year: parseInt(value) })}
                >
                  <SelectTrigger className={cn("h-8 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rankingError ? (
          <p className={cn('text-sm text-center py-8 text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
            Error al cargar el ranking. Por favor, intenta nuevamente.
          </p>
        ) : studentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          </div>
        ) : campusStudents && campusStudents.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {campusStudents.map((item: any, index: number) => (
              <motion.div
                key={item.student.id || item.student.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' : 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
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
                  <div>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {item.student.name}
                    </p>
                    {item.student.gradeName && (
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {item.student.gradeName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {item.globalScore.toFixed(1)}
                  </p>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {item.student.jornada ? item.student.jornada.charAt(0).toUpperCase() + item.student.jornada.slice(1) : 'N/A'}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-2">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes con resultados para los filtros seleccionados
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              Fase: {rankingFilters.phase === 'first' ? 'Fase I' : rankingFilters.phase === 'second' ? 'Fase II' : 'Fase III'} | 
              Año: {rankingFilters.year} | 
              Jornada: {rankingFilters.jornada === 'todas' ? 'Todas' : rankingFilters.jornada}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente de Evolución por Materia (adaptado para coordinador - solo su sede)
function EvolutionBySubjectChart({ theme, currentCoordinator, filters, setFilters }: any) {
  const campusId = currentCoordinator?.campusId
  const institutionId = currentCoordinator?.institutionId
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  
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

  const { data: allStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['coordinator-evolution-students', campusId, institutionId],
    queryFn: async () => {
      if (!campusId || !institutionId) return []
      const filters: any = {
        institutionId: institutionId,
        campusId: campusId,
        isActive: true,
      }
      const studentsResult = await getFilteredStudents(filters)
      if (!studentsResult.success || !studentsResult.data) return []
      return studentsResult.data
    },
    enabled: !!campusId && !!institutionId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: evolutionData, isLoading: evolutionLoading } = useQuery({
    queryKey: ['coordinator-evolution-data', campusId, institutionId, filters],
    queryFn: async () => {
      if (!campusId || !institutionId || !allStudents || allStudents.length === 0) return { chartData: [], subjects: [] }

      let filteredStudents = allStudents

      if (filters.year) {
        filteredStudents = filteredStudents.filter((student: any) => {
          const getStudentYear = (student: any): number | null => {
            if (student.academicYear) return student.academicYear
            if (!student.createdAt) return null
            let date: Date
            if (typeof student.createdAt === 'string') {
              date = new Date(student.createdAt)
            } else if (student.createdAt?.toDate) {
              date = student.createdAt.toDate()
            } else if (student.createdAt?.seconds) {
              date = new Date(student.createdAt.seconds * 1000)
            } else {
              return null
            }
            return date.getFullYear()
          }
          const studentYear = getStudentYear(student)
          if (studentYear === null) return true
          return studentYear === filters.year
        })
      }

      if (filters.jornada && filters.jornada !== 'todas') {
        filteredStudents = filteredStudents.filter((student: any) => 
          student.jornada === filters.jornada
        )
      }

      if (filters.studentId && filters.studentId !== 'todos') {
        filteredStudents = filteredStudents.filter((student: any) => 
          (student.id || student.uid) === filters.studentId
        )
      }

      const studentIds = filteredStudents.map((s: any) => s.id || s.uid).filter(Boolean) as string[]
      if (studentIds.length === 0) return { chartData: [], subjects: [] }

      const normalizeSubject = (subject: string): string => {
        const normalized = subject.trim()
        const subjectMap: { [key: string]: string } = {
          'Matemáticas': 'Matemáticas',
          'Matematicas': 'Matemáticas',
          'Lenguaje': 'Lenguaje',
          'Ciencias Sociales': 'Ciencias Sociales',
          'Sociales': 'Ciencias Sociales',
          'Biologia': 'Biologia',
          'Biología': 'Biologia',
          'Quimica': 'Quimica',
          'Química': 'Quimica',
          'Física': 'Física',
          'Fisica': 'Física',
          'Inglés': 'Inglés',
          'Ingles': 'Inglés'
        }
        return subjectMap[normalized] || normalized
      }

      const allPossibleSubjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
      const subjectsToEvaluate = filters.subject === 'todas' 
        ? allPossibleSubjects
        : [normalizeSubject(filters.subject)]

      const phases = [
        { key: 'first', name: 'fase I' },
        { key: 'second', name: 'Fase II' },
        { key: 'third', name: 'fase III' }
      ]

      const resultsByPhaseAndSubject = new Map<string, Map<string, number[]>>()

      for (const studentId of studentIds) {
        for (const phase of phases) {
          try {
            const phaseRef = collection(db, 'results', studentId, phase.name)
            const phaseSnap = await getDocs(phaseRef)
            
            phaseSnap.docs.forEach(doc => {
              const examData = doc.data()
              
              if (examData.completed && examData.score && examData.subject) {
                const subject = normalizeSubject(examData.subject)
                
                if (subjectsToEvaluate.includes(subject)) {
                  const score = examData.score.overallPercentage || 0
                  
                  if (!resultsByPhaseAndSubject.has(phase.key)) {
                    resultsByPhaseAndSubject.set(phase.key, new Map())
                  }
                  
                  const phaseMap = resultsByPhaseAndSubject.get(phase.key)!
                  if (!phaseMap.has(subject)) {
                    phaseMap.set(subject, [])
                  }
                  
                  phaseMap.get(subject)!.push(score)
                }
              }
            })
          } catch (error) {
            console.error(`Error obteniendo resultados para estudiante ${studentId} en ${phase.name}:`, error)
          }
        }
      }

      const allSubjectsSet = new Set<string>()

      resultsByPhaseAndSubject.forEach((phaseMap) => {
        phaseMap.forEach((_, subject) => {
          allSubjectsSet.add(subject)
        })
      })

      let allSubjects = Array.from(allSubjectsSet).sort()
      if (filters.subject !== 'todas' && allSubjects.length > 0) {
        const normalizedFilterSubject = normalizeSubject(filters.subject)
        allSubjects = allSubjects.filter(subject => subject === normalizedFilterSubject)
      }

      const chartData: any[] = []
      
      phases.forEach(phase => {
        const dataPoint: any = { fase: phase.key === 'first' ? 'Fase I' : phase.key === 'second' ? 'Fase II' : 'Fase III' }
        
        allSubjects.forEach(subject => {
          const phaseMap = resultsByPhaseAndSubject.get(phase.key)
          const scores = phaseMap?.get(subject) || []
          
          if (scores.length > 0) {
            const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
            dataPoint[subject] = Math.round(average * 100) / 100
          } else {
            dataPoint[subject] = null
          }
        })
        
        chartData.push(dataPoint)
      })

      return { chartData, subjects: allSubjects }
    },
    enabled: !!campusId && !!institutionId && !!allStudents && allStudents.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              Evolución por Materia
            </CardTitle>
            <CardDescription className="mt-1">
              {evolutionData && 'subjects' in evolutionData && evolutionData.subjects && evolutionData.subjects.length > 0 
                ? `${evolutionData.subjects.length} ${evolutionData.subjects.length === 1 ? 'materia evaluada' : 'materias evaluadas'}`
                : 'Promedio de puntuación por materia en las 3 fases'
              }
            </CardDescription>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Año
              </label>
              <Select
                value={filters.year.toString()}
                onValueChange={(value) => setFilters({ ...filters, year: parseInt(value) })}
              >
                <SelectTrigger className={cn("h-8 w-20 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Materia
              </label>
              <Select
                value={filters.subject}
                onValueChange={(value) => setFilters({ ...filters, subject: value })}
              >
                <SelectTrigger className={cn("h-8 w-28 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
            <div className="flex flex-col gap-1">
              <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Jornada
              </label>
              <Select
                value={filters.jornada}
                onValueChange={(value) => setFilters({ ...filters, jornada: value })}
              >
                <SelectTrigger className={cn("h-8 w-24 text-xs", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300')}>
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {evolutionLoading || studentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          </div>
        ) : evolutionData && 'chartData' in evolutionData && evolutionData.chartData && evolutionData.chartData.length > 0 && 'subjects' in evolutionData && evolutionData.subjects && evolutionData.subjects.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={evolutionData.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#3f3f46' : '#d1d5db'} />
              <XAxis 
                dataKey="fase" 
                stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'}
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                stroke={theme === 'dark' ? '#a1a1aa' : '#6b7280'}
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: 12 }}
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
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {evolutionData.subjects.map((subject: string) => {
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
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 space-y-2">
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para los filtros seleccionados
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
              Año: {filters.year} | Materia: {filters.subject === 'todas' ? 'Todas' : filters.subject} | 
              Jornada: {filters.jornada === 'todas' ? 'Todas' : filters.jornada}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente de Administrativos (docentes de la sede)
function AdministrativosTab({ theme, teachers }: any) {
  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-200 border-gray-300')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <UserCog className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            Estructura Administrativa de la Sede
          </CardTitle>
          <CardDescription>Docentes y sus estudiantes asignados</CardDescription>
        </CardHeader>
        <CardContent>
          <TeachersAccordionWrapper teachers={teachers} theme={theme} />
        </CardContent>
      </Card>
    </div>
  )
}

// Componente wrapper para el accordion de profesores
function TeachersAccordionWrapper({ teachers, theme }: any) {
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  
  if (teachers.length === 0) {
    return (
      <p className={cn('text-sm text-center py-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
        No hay docentes asignados a esta sede
      </p>
    )
  }
  
  return (
    <Accordion 
      type="multiple" 
      className="w-full space-y-3"
      value={expandedItems}
      onValueChange={setExpandedItems}
    >
      {teachers.map((teacher: any) => (
        <TeacherWithStudents
          key={teacher.id}
          teacher={teacher}
          theme={theme}
          isExpanded={expandedItems.includes(`teacher-${teacher.id}`)}
        />
      ))}
    </Accordion>
  )
}

// Componente para mostrar docente con sus estudiantes
function TeacherWithStudents({ teacher, theme, isExpanded }: any) {
  const teacherId = teacher.id || teacher.uid
  
  // Obtener los IDs del profesor (soporta múltiples formatos de campos)
  const institutionId = teacher.institutionId || teacher.inst || teacher.institution
  const campusId = teacher.campusId || teacher.campus
  const gradeId = teacher.gradeId || teacher.grade
  
  // Cargar estudiantes filtrados siempre (para el contador y la lista)
  // Primero intentar con todos los filtros (institución, sede y grado)
  const { students: filteredStudentsByTeacher, isLoading: filteredLoading } = useFilteredStudents({
    institutionId: institutionId,
    campusId: campusId,
    gradeId: gradeId,
    isActive: true
  })
  
  // Fallback: Si no hay estudiantes con gradeId, intentar solo con campusId
  const { students: studentsByCampusOnly } = useFilteredStudents({
    institutionId: institutionId,
    campusId: campusId,
    isActive: true
  })
  
  // Cargar estudiantes por profesor solo cuando está expandido (para mejor rendimiento)
  const { data: teacherStudents, isLoading: studentsLoading } = useStudentsByTeacher(
    teacherId || '',
    isExpanded
  )
  
  // Determinar qué estudiantes mostrar: priorizar hook específico, luego filtrados, luego fallback
  // IMPORTANTE: No depender solo de isExpanded para cargar, usar siempre los datos disponibles
  const displayStudents = useMemo(() => {
    // 1. Si hay estudiantes del hook específico, usarlos (más confiable)
    if (teacherStudents && Array.isArray(teacherStudents) && teacherStudents.length > 0) {
      return teacherStudents
    }
    
    // 2. Si hay estudiantes filtrados con gradeId, usarlos
    if (filteredStudentsByTeacher && Array.isArray(filteredStudentsByTeacher) && filteredStudentsByTeacher.length > 0) {
      return filteredStudentsByTeacher
    }
    
    // 3. Fallback: usar estudiantes solo por campus (sin gradeId)
    if (studentsByCampusOnly && Array.isArray(studentsByCampusOnly) && studentsByCampusOnly.length > 0) {
      return studentsByCampusOnly
    }
    
    return []
  }, [teacherStudents, filteredStudentsByTeacher, studentsByCampusOnly])
  
  // Para el contador, usar el número más preciso disponible
  const studentCount = useMemo(() => {
    // Prioridad: hook específico > filtrados con gradeId > filtrados solo por campus
    if (teacherStudents && teacherStudents.length > 0) {
      return teacherStudents.length
    }
    if (filteredStudentsByTeacher && filteredStudentsByTeacher.length > 0) {
      return filteredStudentsByTeacher.length
    }
    if (studentsByCampusOnly && studentsByCampusOnly.length > 0) {
      return studentsByCampusOnly.length
    }
    return 0
  }, [teacherStudents, filteredStudentsByTeacher, studentsByCampusOnly])
  
  // Debug: Log para verificar datos
  useEffect(() => {
    if (isExpanded) {
      console.log('📚 TeacherWithStudents - Profesor:', teacher.name, 'ID:', teacherId)
      console.log('📚 Datos del profesor:', teacher)
      console.log('📚 Filtros aplicados:', {
        institutionId,
        campusId,
        gradeId
      })
      console.log('📚 Estudiantes filtrados:', filteredStudentsByTeacher?.length || 0, filteredStudentsByTeacher)
      console.log('📚 Estudiantes por profesor hook:', teacherStudents?.length || 0, teacherStudents)
      console.log('📚 Estudiantes a mostrar:', displayStudents.length, displayStudents)
      console.log('📚 Contador de estudiantes:', studentCount)
    }
  }, [isExpanded, teacher, teacherId, institutionId, campusId, gradeId, filteredStudentsByTeacher, teacherStudents, displayStudents, studentCount])

  const itemValue = `teacher-${teacher.id}`
  
  return (
    <AccordionItem
      value={itemValue}
      className={cn("border rounded-lg", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-300 bg-gray-100')}
    >
      <AccordionTrigger 
        className={cn("px-4 py-3 hover:no-underline", theme === 'dark' ? 'text-white' : 'text-gray-900')}
      >
        <div className="flex items-center gap-3 w-full">
          <GraduationCap className={cn("h-5 w-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          <div className="flex-1 text-left">
            <h4 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {teacher.name}
            </h4>
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
            {studentCount} Estudiantes
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        {(filteredLoading || (studentsLoading && isExpanded)) ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className={cn("h-4 w-4 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            <span className={cn('ml-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Cargando estudiantes...
            </span>
          </div>
        ) : displayStudents && Array.isArray(displayStudents) && displayStudents.length > 0 ? (
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {displayStudents.map((student: any, studentIndex: number) => (
              <motion.div
                key={student.id || student.uid || `student-${studentIndex}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: studentIndex * 0.02 }}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md",
                  theme === 'dark' ? 'bg-zinc-700/50 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <Users className={cn("h-3 w-3", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                <span className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  {student.name || student.displayName || 'Sin nombre'}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-4 space-y-2">
            <p className={cn('text-xs text-center', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes asignados
            </p>
            <div className={cn('text-xs text-left p-2 rounded', theme === 'dark' ? 'bg-zinc-800 text-gray-500' : 'bg-gray-100 text-gray-600')}>
              <p className="font-semibold mb-1">Debug Info:</p>
              <p>Filtros: Inst={institutionId || 'N/A'}, Campus={campusId || 'N/A'}, Grado={gradeId || 'N/A'}</p>
              <p>Estudiantes filtrados: {filteredStudentsByTeacher?.length || 0}</p>
              <p>Estudiantes por hook: {teacherStudents?.length || 0}</p>
              <p>Estudiantes por campus: {studentsByCampusOnly?.length || 0}</p>
              <p>Display students: {displayStudents?.length || 0}</p>
              <p>Is Expanded: {isExpanded ? 'Sí' : 'No'}</p>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

// Componente de Resultados
function ResultsTab({ theme, stats, staticData, COLORS }: any) {
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
            Métricas de Rendimiento de la Sede
          </CardTitle>
          <CardDescription>Indicadores clave de desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Promedio General', value: stats.performanceMetrics.overallAverage, color: 'blue' },
              { label: 'Asistencia', value: stats.performanceMetrics.attendanceRate, color: 'blue' },
              { label: 'Docentes', value: stats.totalTeachers, color: 'slate' },
              { label: 'Estudiantes', value: stats.totalStudents, color: 'blue' },
            ].map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {metric.label}
                  </span>
                  <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {metric.value}{metric.label !== 'Docentes' && metric.label !== 'Estudiantes' ? '%' : ''}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(metric.value, 100)}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className={cn("absolute h-full rounded-full", 
                      metric.color === 'blue' 
                        ? (theme === 'dark' ? 'bg-gradient-to-r from-blue-800 to-blue-900' : 'bg-gradient-to-r from-blue-700 to-blue-800')
                        : (theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-800' : 'bg-gradient-to-r from-slate-600 to-slate-700')
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Dialog para mostrar resumen y diagnóstico del estudiante (reutilizado del rector)
function StudentDetailDialog({ student, isOpen, onClose, theme }: any) {
  const studentId = student?.id || student?.uid
  const { data: studentAnalysis, isLoading } = useStudentAnalysis(studentId, isOpen && !!studentId)
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('phase1')
  
  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      'biologia': 'Biologia', 'biología': 'Biologia',
      'quimica': 'Quimica', 'química': 'Quimica',
      'fisica': 'Física', 'física': 'Física',
      'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas',
      'lenguaje': 'Lenguaje',
      'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
      'ingles': 'Inglés', 'inglés': 'Inglés'
    }
    return subjectMap[normalized] || subject
  }

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
    staleTime: 5 * 60 * 1000,
  })

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
    staleTime: 5 * 60 * 1000,
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <StrengthsRadarChart
                        subjects={subjectsData.subjects}
                        theme={theme}
                      />

                      <SubjectsProgressChart
                        phase1Data={phasesData?.phase1 || null}
                        phase2Data={phasesData?.phase2 || null}
                        phase3Data={phasesData?.phase3 || null}
                        theme={theme}
                      />
                    </div>

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

// Componente auxiliar para mostrar rendimiento
function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: any[], theme?: 'light' | 'dark', subjectsWithTopics?: any[] }) {
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject: any) => {
          const hasStrengths = subject.strengths?.length > 0
          const hasNeutrals = subject.neutrals?.length > 0
          const hasWeaknesses = subject.weaknesses?.length > 0
          
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
                  {subject.topics && subject.topics.length > 0 && (
                    <div className="space-y-3">
                      <h4 className={cn("text-xs font-semibold mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Temas
                      </h4>
                      {subject.topics.map((topic: any) => (
                        <div key={topic.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{topic.name}</span>
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
                  
                  {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                    <div className="flex items-center gap-4 flex-wrap">
                      {hasStrengths && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                            Fortalezas ({subject.strengths.length})
                          </span>
                        </div>
                      )}
                      
                      {hasNeutrals && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700')}>
                            Neutro ({subject.neutrals.length})
                          </span>
                        </div>
                      )}
                      
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
