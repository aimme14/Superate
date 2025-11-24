import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
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
  Target,
  Trophy,
  Bell,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTeacherDashboardStats } from '@/hooks/query/useTeacherDashboardStats'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface TeacherDashboardProps extends ThemeContextProps {}

export default function TeacherDashboard({ theme }: TeacherDashboardProps) {
  const { stats, isLoading, students } = useTeacherDashboardStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const [activeTab, setActiveTab] = useState('inicio')

  // Datos estáticos que se mantienen
  const staticData = useMemo(() => ({
    recentActivities: [
      { id: 1, type: 'student', title: `${stats.totalStudents} estudiantes en ${stats.gradeName}`, time: 'Reciente', icon: Users },
      { id: 2, type: 'achievement', title: 'Mejor rendimiento del mes en el grado', time: '5 días atrás', icon: Award },
      { id: 3, type: 'event', title: 'Reunión de docentes completada', time: '1 semana atrás', icon: CalendarDays },
      { id: 4, type: 'exam', title: 'Examen de Matemáticas programado', time: '2 semanas atrás', icon: BookOpen },
    ],
    achievements: [
      { id: 1, title: 'Mejor Docente del Mes', status: 'achieved', icon: Award },
      { id: 2, title: 'Tasa de Asistencia > 95%', status: 'achieved', icon: CheckCircle2 },
      { id: 3, title: `${stats.totalStudents} Estudiantes Activos`, status: 'achieved', icon: Users },
      { id: 4, title: 'Promedio General > 85%', status: 'in-progress', icon: TrendingUp },
    ],
    alerts: [
      { id: 1, type: 'info', message: 'Reunión de docentes programada para el 20 de enero', priority: 'medium' },
      { id: 2, type: 'success', message: `Todos los estudiantes de ${stats.gradeName} están activos`, priority: 'low' },
      { id: 3, type: 'warning', message: 'Revisión de calificaciones mensual pendiente', priority: 'medium' },
    ],
    performanceData: [
      { month: 'Ene', promedio: 78, asistencia: 88 },
      { month: 'Feb', promedio: 80, asistencia: 90 },
      { month: 'Mar', promedio: 82, asistencia: 91 },
      { month: 'Abr', promedio: 83, asistencia: 92 },
      { month: 'May', promedio: 84, asistencia: 93 },
      { month: 'Jun', promedio: 85, asistencia: 94 },
    ],
    radarData: [
      { subject: 'Rendimiento', A: 82, fullMark: 100 },
      { subject: 'Asistencia', A: 91, fullMark: 100 },
      { subject: 'Participación', A: 85, fullMark: 100 },
      { subject: 'Disciplina', A: 88, fullMark: 100 },
      { subject: 'Innovación', A: 80, fullMark: 100 },
      { subject: 'Satisfacción', A: 87, fullMark: 100 },
    ],
  }), [stats])

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']

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

  return (
    <div className="space-y-6">
      {/* Header con logo y gradiente animado */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-none bg-gradient-to-r from-green-600 via-emerald-700 to-teal-800 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/50 via-emerald-500/50 to-teal-800/50 animate-pulse" />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative"
              >
                <img 
                  src={institutionLogo || '/assets/agustina.png'} 
                  alt={`Logo de ${institutionName}`}
                  className="w-20 h-20 object-contain rounded-xl bg-white/10 backdrop-blur-sm p-2 shadow-lg"
                  onError={(e) => {
                    e.currentTarget.src = '/assets/agustina.png'
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full"
                />
              </motion.div>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl font-bold mb-2"
                >
                  Bienvenido, {stats.teacherName}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg opacity-90 mb-1"
                >
                  Docencia - {stats.campusName} • {stats.gradeName}
                </motion.p>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm opacity-75"
                >
                  {institutionName || stats.institutionName} • {stats.teacherEmail}
                </motion.p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20"
              >
                <Users className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
                <div className="text-xs opacity-75">Estudiantes</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20"
              >
                <GraduationCap className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.performanceMetrics.overallAverage}%</div>
                <div className="text-xs opacity-75">Promedio</div>
              </motion.div>
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

      {/* Mensaje de bienvenida destacado */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 p-8 md:p-10 text-white shadow-2xl mx-4 md:mx-6 lg:mx-8"
      >
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <h2 className="text-4xl font-bold mb-4">¡Hola Docente!</h2>
            <p className="text-lg opacity-90 leading-relaxed max-w-3xl">
              Bienvenido a tu panel de control. Aquí tienes toda la información de tus estudiantes de <strong>{stats.gradeName}</strong> en la sede <strong>{stats.campusName}</strong>. Gestiona y supervisa el rendimiento académico con total facilidad.
            </p>
          </motion.div>
          <div className="flex items-center gap-3 mt-4">
            {[
              { 
                icon: Users, 
                text: 'Estudiantes', 
                value: stats?.totalStudents || 0,
                suffix: '',
                iconColor: 'text-cyan-500'
              },
              { 
                icon: GraduationCap, 
                text: 'Grado', 
                value: stats?.gradeName || '',
                suffix: '',
                iconColor: 'text-orange-500'
              },
              { 
                icon: School, 
                text: 'Sede', 
                value: stats?.campusName || '',
                suffix: '',
                iconColor: 'text-sky-500'
              },
            ].map((item, index) => (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer transition-all flex items-center gap-3"
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${item.iconColor}`} />
                <div className="flex flex-col">
                  <div className="text-xl font-bold leading-tight text-gray-900">
                    {typeof item.value === 'number' ? (
                      <AnimatedCounter value={item.value} duration={2} />
                    ) : (
                      <span className="text-sm">{item.value}</span>
                    )}
                    {item.suffix}
                  </div>
                  <div className="text-xs font-medium text-gray-600 leading-tight">{item.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Botones de acción animados */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 mx-4 md:mx-6 lg:mx-8"
      >
        {[
          { icon: Users, label: 'Mis Estudiantes', color: 'from-green-500 to-green-700', tab: 'estudiantes' },
          { icon: BarChart3, label: 'Resultados', color: 'from-emerald-500 to-emerald-700', tab: 'resultados' },
        ].map((btn, index) => (
          <motion.div
            key={btn.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={() => setActiveTab(btn.tab)}
              className={cn(
                "w-full h-24 flex flex-col items-center justify-center gap-2 bg-gradient-to-br text-white shadow-lg hover:shadow-xl transition-all",
                btn.color
              )}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
              >
                <btn.icon className="h-8 w-8" />
              </motion.div>
              <span className="font-semibold">{btn.label}</span>
            </Button>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs con contenido dinámico */}
      <div className="mx-4 md:mx-6 lg:mx-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn(
            "grid w-full grid-cols-3 h-auto p-1 gap-2",
            theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
          )}>
          {[
            { id: 'inicio', label: 'Inicio', icon: Sparkles },
            { id: 'estudiantes', label: 'Estudiantes', icon: Users },
            { id: 'resultados', label: 'Resultados', icon: BarChart3 },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white",
                theme === 'dark' ? 'data-[state=active]:text-white' : ''
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Inicio */}
        <TabsContent value="inicio" className="space-y-6 mt-6">
          <WelcomeTab theme={theme} staticData={staticData} stats={stats} />
        </TabsContent>

        {/* Tab Estudiantes */}
        <TabsContent value="estudiantes" className="space-y-6 mt-6">
          <StudentsTab 
            theme={theme} 
            students={students || []}
            stats={stats}
          />
        </TabsContent>

        {/* Tab Resultados */}
        <TabsContent value="resultados" className="space-y-6 mt-6">
          <ResultsTab 
            theme={theme} 
            stats={stats}
            staticData={staticData}
            COLORS={COLORS}
          />
        </TabsContent>
        </Tabs>
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

// Componente de Bienvenida
function WelcomeTab({ theme, staticData, stats }: any) {
  return (
    <div className="space-y-6">
      {/* Estadísticas principales con animaciones */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { 
            title: 'Total Estudiantes', 
            value: stats.totalStudents.toLocaleString(), 
            change: `En ${stats.gradeName}`,
            icon: Users, 
            color: 'green',
            gradient: 'from-green-500 to-green-600'
          },
          { 
            title: 'Promedio del Grado', 
            value: `${stats.performanceMetrics.overallAverage}%`, 
            change: '+2.3% vs mes anterior',
            icon: TrendingUp, 
            color: 'emerald',
            gradient: 'from-emerald-500 to-emerald-600'
          },
          { 
            title: 'Tasa de Asistencia', 
            value: `${stats.performanceMetrics.attendanceRate}%`, 
            change: 'Excelente nivel',
            icon: CheckCircle2, 
            color: 'teal',
            gradient: 'from-teal-500 to-teal-600'
          },
          { 
            title: 'Estudiantes Activos', 
            value: stats.performanceMetrics.studentsCount, 
            change: `En ${stats.campusName}`,
            icon: Users, 
            color: 'green',
            gradient: 'from-green-500 to-green-600'
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
              theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
            )}>
              <div className={cn("absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full -mr-16 -mt-16", stat.gradient)} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {stat.title}
                </CardTitle>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                >
                  <stat.icon className={cn("h-5 w-5", `text-${stat.color}-500`)} />
                </motion.div>
              </CardHeader>
              <CardContent className="relative z-10">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className={cn('text-3xl font-bold mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                >
                  {stat.value}
                </motion.div>
                <p className={cn('text-xs', 
                  stat.color === 'green' || stat.color === 'emerald' 
                    ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
                    : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                )}>
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Actividades recientes y logros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Activity className="h-5 w-5 text-green-500" />
              Actividades Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staticData.recentActivities.map((activity: any, index: number) => {
              const Icon = activity.icon
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 5 }}
                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    <Icon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {activity.title}
                    </p>
                    <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {activity.time}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Trophy className="h-5 w-5 text-amber-500" />
              Logros del Grado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staticData.achievements.map((achievement: any, index: number) => {
              const Icon = achievement.icon
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                    >
                      <Icon className={cn('h-5 w-5', 
                        achievement.status === 'achieved' ? 'text-green-500' : 'text-amber-500'
                      )} />
                    </motion.div>
                    <span className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {achievement.title}
                    </span>
                  </div>
                  <Badge variant={achievement.status === 'achieved' ? 'default' : 'secondary'}>
                    {achievement.status === 'achieved' ? 'Logrado' : 'En progreso'}
                  </Badge>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Bell className="h-5 w-5 text-amber-500" />
            Notificaciones del Grado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {staticData.alerts.map((alert: any, index: number) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={cn("flex items-center justify-between p-4 rounded-lg border", 
                  theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-200 hover:bg-gray-50'
                )}>
                <div className="flex items-center space-x-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                    className={`w-3 h-3 rounded-full ${
                      alert.type === 'success' ? 'bg-green-500' : 
                      alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                  />
                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {alert.message}
                  </p>
                </div>
                <Badge variant="secondary">
                  {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Estudiantes
function StudentsTab({ theme, students, stats }: any) {
  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Users className="h-5 w-5 text-green-500" />
            Mis Estudiantes ({students.length})
          </CardTitle>
          <CardDescription>
            Estudiantes de {stats.gradeName} en {stats.campusName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
              {students.map((student: any, index: number) => (
                <motion.div
                  key={student.id || student.uid}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={{ scale: 1.05 }}
                  className={cn("p-4 rounded-xl border-2", 
                    theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg">
                      {student.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 
                       student.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'E'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn('font-semibold truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {student.name || student.displayName}
                      </h4>
                      <p className={cn('text-xs truncate', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {student.email}
                      </p>
                    </div>
                  </div>
                  {student.gradeName && (
                    <Badge variant="outline" className="w-full justify-center">
                      Grado: {student.gradeName}
                    </Badge>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Resultados
function ResultsTab({ theme, stats, staticData }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <TrendingUp className="h-5 w-5 text-green-500" />
              Rendimiento Semestral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={staticData.performanceData}>
                <defs>
                  <linearGradient id="colorPromedio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAsistencia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="promedio" stroke="#10b981" fillOpacity={1} fill="url(#colorPromedio)" />
                <Area type="monotone" dataKey="asistencia" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAsistencia)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Target className="h-5 w-5 text-blue-500" />
              Evaluación Integral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={staticData.radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Rendimiento" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Métricas de Rendimiento del Grado
          </CardTitle>
          <CardDescription>Indicadores clave de desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: 'Promedio General', value: stats.performanceMetrics.overallAverage, color: 'green' },
              { label: 'Asistencia', value: stats.performanceMetrics.attendanceRate, color: 'emerald' },
              { label: 'Estudiantes', value: stats.performanceMetrics.studentsCount, color: 'teal' },
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
                    {metric.value}{metric.label !== 'Estudiantes' ? '%' : ''}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className={cn("absolute h-full rounded-full", 
                      metric.color === 'green' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
                      metric.color === 'emerald' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' :
                      'bg-gradient-to-r from-teal-600 to-cyan-600'
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
