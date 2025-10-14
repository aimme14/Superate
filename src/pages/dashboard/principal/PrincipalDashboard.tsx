import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  GraduationCap, 
  TrendingUp,
  FileText,
  Calendar,
  UserCheck,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/context/AuthContext'

interface PrincipalDashboardProps extends ThemeContextProps {}

export default function PrincipalDashboard({ theme }: PrincipalDashboardProps) {
  const { user } = useAuthContext()

  console.log('👔 Usuario coordinador en dashboard:', user)
  console.log('🎯 Rol del usuario:', user?.role)

  // Datos de ejemplo para el dashboard del coordinador
  const dashboardData = {
    institutionStats: {
      totalStudents: 1250,
      totalTeachers: 45,
      totalGrades: 12,
      activeExams: 8
    },
    performanceMetrics: {
      overallAverage: 82.3,
      attendanceRate: 94.2,
      graduationRate: 96.8,
      teacherSatisfaction: 4.2
    },
    recentActivities: [
      { id: 1, type: 'new_teacher', title: 'Nuevo docente contratado: Prof. Rodríguez', time: '1 hora atrás' },
      { id: 2, type: 'exam_scheduled', title: 'Examen final programado para 11°', time: '3 horas atrás' },
      { id: 3, type: 'meeting_scheduled', title: 'Reunión de coordinación programada', time: '1 día atrás' },
    ],
    upcomingEvents: [
      { id: 1, title: 'Reunión de coordinación', date: '2024-01-15', type: 'meeting' },
      { id: 2, title: 'Examen final 11°', date: '2024-01-18', type: 'exam' },
      { id: 3, title: 'Ceremonia de graduación', date: '2024-01-25', type: 'ceremony' },
    ],
    gradePerformance: [
      { grade: '6°', students: 98, average: 78.5, teachers: 4 },
      { grade: '7°', students: 105, average: 81.2, teachers: 4 },
      { grade: '8°', students: 112, average: 79.8, teachers: 4 },
      { grade: '9°', students: 108, average: 83.1, teachers: 4 },
      { grade: '10°', students: 95, average: 85.3, teachers: 4 },
      { grade: '11°', students: 88, average: 87.2, teachers: 4 },
    ],
    alerts: [
      { id: 1, type: 'warning', message: 'Baja asistencia en 8°A', priority: 'medium' },
      { id: 2, type: 'info', message: 'Nuevo docente necesita capacitación', priority: 'low' },
      { id: 3, type: 'success', message: 'Exámenes de 11° completados', priority: 'low' },
    ]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Bienvenido, {user?.displayName || 'Coordinador'}
          </h1>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Gestión integral de la institución educativa
          </p>
          <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
            {user?.email} • Institución: {user?.institution || 'N/A'}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          Rol: Coordinador
        </Badge>
      </div>

      {/* Estadísticas principales de la institución */}
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
              +25 este mes
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
              Activos
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Promedio General
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.overallAverage}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +1.2% vs trimestre anterior
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Tasa de Asistencia
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.attendanceRate}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Excelente nivel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas y notificaciones */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alertas y Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    alert.priority === 'high' ? 'bg-red-500' : 
                    alert.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {alert.message}
                  </p>
                </div>
                <Badge variant={alert.priority === 'high' ? 'destructive' : 'secondary'}>
                  {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividades recientes */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Actividades Recientes
            </CardTitle>
            <CardDescription>
              Últimas acciones en la institución
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {activity.type === 'new_teacher' && <UserCheck className="h-5 w-5 text-green-500" />}
                  {activity.type === 'exam_scheduled' && <Calendar className="h-5 w-5 text-blue-500" />}
                  {activity.type === 'meeting_scheduled' && <FileText className="h-5 w-5 text-purple-500" />}
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
            ))}
          </CardContent>
        </Card>

        {/* Próximos eventos */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Próximos Eventos
            </CardTitle>
            <CardDescription>
              Eventos y actividades programadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {event.title}
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {event.date}
                  </p>
                </div>
                <Badge variant="outline">
                  {event.type === 'meeting' ? 'Reunión' : 
                   event.type === 'exam' ? 'Examen' : 'Ceremonia'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Rendimiento por grado */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Rendimiento por Grado
          </CardTitle>
          <CardDescription>
            Estadísticas detalladas por grado académico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.gradePerformance.map((grade, index) => (
              <div key={index} className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {grade.grade}
                  </h3>
                  <Badge variant="secondary">
                    {grade.teachers} docentes
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Estudiantes:
                    </span>
                    <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {grade.students}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Promedio:
                    </span>
                    <span className="font-medium text-green-600">
                      {grade.average}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${grade.average}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

