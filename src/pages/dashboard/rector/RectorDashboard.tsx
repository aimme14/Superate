import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2,
  Crown,
  Users, 
  GraduationCap, 
  TrendingUp,
  School,
  CalendarDays,
  Award,
  CheckCircle2,
  Activity,
  Loader2,
  BarChart3,
  Sparkles,
  Target,
  Trophy,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRectorStats } from '@/hooks/query/useRectorStats'
import { useCampusOptions } from '@/hooks/query/useInstitutionQuery'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface RectorDashboardProps extends ThemeContextProps {}

export default function RectorDashboard({ theme }: RectorDashboardProps) {
  const { stats, isLoading, currentRector, coordinators, teachers, students } = useRectorStats()
  const { institutionName, institutionLogo } = useUserInstitution()
  const [activeTab, setActiveTab] = useState('inicio')

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
      { name: 'Primaria', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.4) : 0, color: '#8b5cf6' },
      { name: 'Secundaria', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.35) : 0, color: '#3b82f6' },
      { name: 'Media', estudiantes: stats?.totalStudents ? Math.floor(stats.totalStudents * 0.25) : 0, color: '#10b981' },
    ]
  }

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

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
        className="relative overflow-hidden rounded-none bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/50 via-pink-500/50 to-indigo-800/50 animate-pulse" />
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
                  Bienvenido, {stats.rectorName}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg opacity-90 mb-1"
                >
                  Rectoría - {institutionName || stats.institutionName}
                </motion.p>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm opacity-75"
                >
                  {stats.rectorEmail}
                </motion.p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20"
              >
                <Building2 className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.totalCampuses}</div>
                <div className="text-xs opacity-75">Sedes</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20"
              >
                <Crown className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.totalPrincipals}</div>
                <div className="text-xs opacity-75">Coordinadores</div>
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
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 p-8 md:p-10 text-white shadow-2xl mx-4 md:mx-6 lg:mx-8"
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
            <h2 className="text-4xl font-bold mb-4">¡Hola Rector!</h2>
            <p className="text-lg opacity-90 leading-relaxed max-w-3xl">
              Bienvenido a tu panel de control integral. Aquí tienes toda la información de tu institución educativa de un vistazo. Gestiona tus sedes, docentes, estudiantes y más con total facilidad.
            </p>
          </motion.div>
          <div className="flex items-center gap-3 mt-4">
            {[
              { 
                icon: BarChart3, 
                text: 'Estudiantes', 
                value: stats?.totalStudents || 0,
                suffix: '',
                iconColor: 'text-cyan-500'
              },
              { 
                icon: GraduationCap, 
                text: 'Docentes', 
                value: stats?.totalTeachers || 0,
                suffix: '',
                iconColor: 'text-orange-500'
              },
              { 
                icon: Building2, 
                text: 'Sedes Activas', 
                value: stats?.totalCampuses || 0,
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
                    <AnimatedCounter value={item.value} duration={2} />
                    {item.suffix}
                  </div>
                  <div className="text-xs font-medium text-gray-600 leading-tight">{item.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Botones de acción animados al principio */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mx-4 md:mx-6 lg:mx-8"
      >
        {[
          { icon: Building2, label: 'Ver Sedes', color: 'from-purple-500 to-purple-700', tab: 'sedes' },
          { icon: Crown, label: 'Coordinadores', color: 'from-blue-500 to-blue-700', tab: 'coordinadores' },
          { icon: GraduationCap, label: 'Docentes', color: 'from-green-500 to-green-700', tab: 'docentes' },
          { icon: Users, label: 'Estudiantes', color: 'from-orange-500 to-orange-700', tab: 'estudiantes' },
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
            "grid w-full grid-cols-3 md:grid-cols-6 h-auto p-1 gap-2",
            theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
          )}>
          {[
            { id: 'inicio', label: 'Inicio', icon: Sparkles },
            { id: 'sedes', label: 'Sedes', icon: Building2 },
            { id: 'coordinadores', label: 'Coordinadores', icon: Crown },
            { id: 'docentes', label: 'Docentes', icon: GraduationCap },
            { id: 'estudiantes', label: 'Estudiantes', icon: Users },
            { id: 'resultados', label: 'Resultados', icon: BarChart3 },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white",
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

        {/* Tab Sedes */}
        <TabsContent value="sedes" className="space-y-6 mt-6">
          <CampusesTab 
            theme={theme} 
            stats={stats} 
            currentRector={currentRector}
            coordinators={coordinators || []}
            teachers={teachers || []}
          />
        </TabsContent>

        {/* Tab Coordinadores */}
        <TabsContent value="coordinadores" className="space-y-6 mt-6">
          <CoordinatorsTab 
            theme={theme} 
            coordinators={coordinators || []}
            teachers={teachers || []}
          />
        </TabsContent>

        {/* Tab Docentes */}
        <TabsContent value="docentes" className="space-y-6 mt-6">
          <TeachersTab 
            theme={theme} 
            teachers={teachers || []}
          />
        </TabsContent>

        {/* Tab Estudiantes */}
        <TabsContent value="estudiantes" className="space-y-6 mt-6">
          <StudentsTab 
            theme={theme} 
            students={students || []}
            staticData={staticData}
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
            change: '+185 este año',
            icon: Users, 
            color: 'blue',
            gradient: 'from-blue-500 to-blue-600'
          },
          { 
            title: 'Docentes', 
            value: stats.totalTeachers, 
            change: `En ${stats.totalCampuses} sedes`,
            icon: GraduationCap, 
            color: 'green',
            gradient: 'from-green-500 to-green-600'
          },
          { 
            title: 'Promedio Institucional', 
            value: `${stats.performanceMetrics.overallAverage}%`, 
            change: '+2.3% vs año anterior',
            icon: TrendingUp, 
            color: 'purple',
            gradient: 'from-purple-500 to-purple-600'
          },
          { 
            title: 'Coordinadores', 
            value: stats.performanceMetrics.coordinatorsCount, 
            change: `En ${stats.totalCampuses} sedes`,
            icon: Crown, 
            color: 'amber',
            gradient: 'from-amber-500 to-amber-600'
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
                  stat.color === 'green' || stat.color === 'blue' 
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
              <Activity className="h-5 w-5 text-blue-500" />
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
                    <Icon className="h-5 w-5 text-purple-500" />
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
              Logros Institucionales
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
            Notificaciones Institucionales
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

// Componente de Sedes
function CampusesTab({ theme, stats, currentRector }: any) {
  const { isLoading } = useCampusOptions(currentRector?.institutionId || '')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Building2 className="h-5 w-5 text-purple-500" />
            Sedes Institucionales
          </CardTitle>
          <CardDescription>Rendimiento y estadísticas por sede</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.campusOverview.map((campus: any, index: number) => (
            <motion.div
              key={campus.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className={cn("p-6 rounded-xl border-2 transition-all", 
                theme === 'dark' ? 'border-zinc-700 hover:border-purple-500 bg-zinc-800' : 'border-gray-200 hover:border-purple-500 bg-gray-50'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn('font-bold text-xl', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {campus.name}
                </h3>
                <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
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
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className={cn('text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Docentes</p>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.teachers}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-500/10">
                  <p className={cn('text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Coordinador</p>
                  <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.principal}
                  </p>
                </div>
              </div>
              <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${campus.average}%` }}
                  transition={{ duration: 1, delay: index * 0.2 }}
                  className="absolute h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Coordinadores
function CoordinatorsTab({ theme, coordinators, teachers }: any) {
  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Crown className="h-5 w-5 text-purple-500" />
            Coordinadores ({coordinators.length})
          </CardTitle>
          <CardDescription>Gestión y supervisión de coordinadores por sede</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coordinators.map((coordinator: any, index: number) => {
              const campusTeachers = teachers.filter((t: any) => t.campusId === coordinator.campusId)
              return (
                <motion.div
                  key={coordinator.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className={cn("p-5 rounded-xl border-2", 
                    theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg"
                    >
                      {coordinator.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </motion.div>
                    <div className="flex-1">
                      <h3 className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {coordinator.name}
                      </h3>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {coordinator.email}
                      </p>
                      <p className={cn('text-sm font-medium mt-1', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                        {coordinator.campusName || 'Sede Principal'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Docentes a cargo
                    </span>
                    <Badge className="bg-purple-500 text-white">
                      {campusTeachers.length}
                    </Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Docentes
function TeachersTab({ theme, teachers }: any) {
  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <GraduationCap className="h-5 w-5 text-green-500" />
            Docentes ({teachers.length})
          </CardTitle>
          <CardDescription>Listado completo de docentes de la institución</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((teacher: any, index: number) => (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, rotate: 1 }}
                className={cn("p-4 rounded-xl border-2", 
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn('font-semibold truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {teacher.name}
                    </h4>
                    <p className={cn('text-xs truncate', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {teacher.email}
                    </p>
                  </div>
                </div>
                {teacher.gradeName && (
                  <Badge variant="outline" className="w-full justify-center">
                    Grado: {teacher.gradeName}
                  </Badge>
                )}
                {teacher.campusName && (
                  <p className={cn('text-xs mt-2 text-center', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {teacher.campusName}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de Estudiantes
function StudentsTab({ theme, students, staticData }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Users className="h-5 w-5 text-blue-500" />
              Distribución por Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={staticData.studentsByLevel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { name: string; percent: number }) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="estudiantes"
                >
                  {staticData.studentsByLevel.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className="h-5 w-5 text-green-500" />
              Estudiantes por Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staticData.studentsByLevel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="estudiantes" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Users className="h-5 w-5 text-blue-500" />
            Total Estudiantes: {students.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {students.slice(0, 50).map((student: any, index: number) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.05 }}
                className={cn("p-3 rounded-lg border", 
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                    {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium text-sm truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {student.name}
                    </p>
                    {student.gradeName && (
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {student.gradeName}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Rendimiento Semestral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={staticData.performanceData}>
                <defs>
                  <linearGradient id="colorPromedio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                <Area type="monotone" dataKey="promedio" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorPromedio)" />
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
                <Radar name="Rendimiento" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Métricas de Rendimiento Institucional
          </CardTitle>
          <CardDescription>Indicadores clave de desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Promedio General', value: stats.performanceMetrics.overallAverage, color: 'purple' },
              { label: 'Asistencia', value: stats.performanceMetrics.attendanceRate, color: 'blue' },
              { label: 'Coordinadores', value: stats.performanceMetrics.coordinatorsCount, color: 'purple' },
              { label: 'Retención Docente', value: stats.performanceMetrics.teacherRetention, color: 'amber' },
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
                    {metric.value}{metric.label !== 'Coordinadores' ? '%' : ''}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className={cn("absolute h-full rounded-full", 
                      metric.color === 'purple' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' :
                      metric.color === 'blue' ? 'bg-gradient-to-r from-blue-600 to-cyan-600' :
                      'bg-gradient-to-r from-amber-600 to-orange-600'
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

// Componentes auxiliares (mantener los existentes)
