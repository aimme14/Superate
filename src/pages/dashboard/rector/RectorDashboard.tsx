import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Building2,
  Crown,
  Users, 
  GraduationCap, 
  TrendingUp,
  School,
  CalendarDays,
  Award,
  AlertCircle,
  CheckCircle2,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/context/AuthContext'

interface RectorDashboardProps extends ThemeContextProps {}

export default function RectorDashboard({ theme }: RectorDashboardProps) {
  const { user } = useAuthContext()

  // Datos de ejemplo para el dashboard del rector
  const dashboardData = {
    institutionStats: {
      totalCampuses: 5,
      totalPrincipals: 5,
      totalTeachers: 125,
      totalStudents: 3420,
      activeExams: 18
    },
    performanceMetrics: {
      overallAverage: 84.7,
      attendanceRate: 93.8,
      graduationRate: 97.2,
      teacherRetention: 95.5
    },
    campusOverview: [
      { id: 1, name: 'Sede Principal', students: 980, teachers: 35, average: 86.2, principal: 'María González' },
      { id: 2, name: 'Sede Norte', students: 720, teachers: 28, average: 83.5, principal: 'Carlos Ramírez' },
      { id: 3, name: 'Sede Sur', students: 650, teachers: 25, average: 85.1, principal: 'Ana Martínez' },
      { id: 4, name: 'Sede Oriente', students: 580, teachers: 22, average: 84.3, principal: 'Luis Pérez' },
      { id: 5, name: 'Sede Occidente', students: 490, teachers: 15, average: 82.8, principal: 'Diana López' },
    ],
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
    ]
  }

  return (
    <div className="space-y-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 p-8 text-white">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Bienvenido, {user?.displayName || 'Dr. Juan Carlos Pérez'}
              </h1>
              <p className="text-lg opacity-90 mb-1">
                Rectoría - Institución Educativa
              </p>
              <p className="text-sm opacity-75">
                {user?.email || 'rector@institucion.edu'} • {user?.institution || 'I.E. Colegio Agustina Ferro'}
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <Building2 className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{dashboardData.institutionStats.totalCampuses}</div>
                <div className="text-xs opacity-75">Sedes</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <Crown className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{dashboardData.institutionStats.totalPrincipals}</div>
                <div className="text-xs opacity-75">Coordinadores</div>
              </div>
            </div>
          </div>
        </div>
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 opacity-10">
          <School className="h-64 w-64" />
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Total Estudiantes
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.institutionStats.totalStudents.toLocaleString()}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +185 este año
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Docentes
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.institutionStats.totalTeachers}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              En {dashboardData.institutionStats.totalCampuses} sedes
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Promedio Institucional
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.overallAverage}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +2.3% vs año anterior
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Tasa de Graduación
            </CardTitle>
            <Award className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.graduationRate}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Excelencia educativa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas institucionales */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Notificaciones Institucionales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.alerts.map((alert) => (
              <div key={alert.id} className={cn("flex items-center justify-between p-3 rounded-lg border", 
                theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    alert.type === 'success' ? 'bg-green-500' : 
                    alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {alert.message}
                  </p>
                </div>
                <Badge variant="secondary">
                  {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumen de sedes */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Building2 className="h-5 w-5 text-purple-500" />
              Sedes Institucionales
            </CardTitle>
            <CardDescription>
              Rendimiento y estadísticas por sede
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.campusOverview.map((campus) => (
              <div key={campus.id} className={cn("p-4 rounded-lg border", 
                theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-200 hover:bg-gray-50')} 
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {campus.name}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {campus.average}% promedio
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estudiantes</p>
                    <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campus.students}
                    </p>
                  </div>
                  <div>
                    <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Docentes</p>
                    <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campus.teachers}
                    </p>
                  </div>
                  <div>
                    <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Coordinador</p>
                    <p className={cn('font-semibold text-xs', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campus.principal}
                    </p>
                  </div>
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${campus.average}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actividades recientes y logros */}
        <div className="space-y-6">
          {/* Actividades recientes */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Activity className="h-5 w-5 text-blue-500" />
                Actividades Recientes
              </CardTitle>
              <CardDescription>
                Últimos eventos institucionales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData.recentActivities.map((activity) => {
                const Icon = activity.icon
                return (
                  <div key={activity.id} className="flex items-start space-x-3">
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
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Logros institucionales */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Award className="h-5 w-5 text-amber-500" />
                Logros Institucionales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardData.achievements.map((achievement) => {
                const Icon = achievement.icon
                return (
                  <div key={achievement.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className={cn('h-5 w-5', 
                        achievement.status === 'achieved' ? 'text-green-500' : 'text-amber-500'
                      )} />
                      <span className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {achievement.title}
                      </span>
                    </div>
                    <Badge variant={achievement.status === 'achieved' ? 'default' : 'secondary'}>
                      {achievement.status === 'achieved' ? 'Logrado' : 'En progreso'}
                    </Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Métricas de rendimiento */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Métricas de Rendimiento Institucional
          </CardTitle>
          <CardDescription>
            Indicadores clave de desempeño
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Promedio General
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {dashboardData.performanceMetrics.overallAverage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-purple-600 h-3 rounded-full" 
                  style={{ width: `${dashboardData.performanceMetrics.overallAverage}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Asistencia
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {dashboardData.performanceMetrics.attendanceRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full" 
                  style={{ width: `${dashboardData.performanceMetrics.attendanceRate}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Graduación
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {dashboardData.performanceMetrics.graduationRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full" 
                  style={{ width: `${dashboardData.performanceMetrics.graduationRate}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Retención Docente
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {dashboardData.performanceMetrics.teacherRetention}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-amber-600 h-3 rounded-full" 
                  style={{ width: `${dashboardData.performanceMetrics.teacherRetention}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

