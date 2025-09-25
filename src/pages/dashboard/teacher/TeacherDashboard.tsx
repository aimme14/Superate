import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  BookOpen, 
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeacherDashboardProps extends ThemeContextProps {}

export default function TeacherDashboard({ theme }: TeacherDashboardProps) {
  // const { userRole, permissions } = useRole()

  // Datos de ejemplo para el dashboard del docente
  const dashboardData = {
    totalStudents: 45,
    activeExams: 3,
    pendingReviews: 12,
    averageScore: 78.5,
    recentActivities: [
      { id: 1, type: 'exam_created', title: 'Examen de Matemáticas', time: '2 horas atrás' },
      { id: 2, type: 'review_completed', title: 'Revisión de Inglés completada', time: '4 horas atrás' },
      { id: 3, type: 'student_joined', title: 'Nuevo estudiante: María García', time: '1 día atrás' },
    ],
    upcomingExams: [
      { id: 1, subject: 'Ciencias Naturales', date: '2024-01-15', students: 45 },
      { id: 2, subject: 'Historia', date: '2024-01-18', students: 42 },
    ],
    studentPerformance: [
      { grade: '9°', average: 85.2, students: 15 },
      { grade: '10°', average: 78.9, students: 18 },
      { grade: '11°', average: 82.1, students: 12 },
    ]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Dashboard Docente
          </h1>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Gestiona tus clases y estudiantes
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          Rol: Docente
        </Badge>
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
              {dashboardData.totalStudents}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +3 desde la semana pasada
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Exámenes Activos
            </CardTitle>
            <BookOpen className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.activeExams}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              En progreso
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Revisiones Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.pendingReviews}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
              Requieren atención
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
              {dashboardData.averageScore}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +2.1% vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividades recientes */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Actividades Recientes
            </CardTitle>
            <CardDescription>
              Últimas acciones en tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {activity.type === 'exam_created' && <BookOpen className="h-5 w-5 text-blue-500" />}
                  {activity.type === 'review_completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {activity.type === 'student_joined' && <Users className="h-5 w-5 text-purple-500" />}
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

        {/* Próximos exámenes */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Próximos Exámenes
            </CardTitle>
            <CardDescription>
              Exámenes programados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.upcomingExams.map((exam) => (
              <div key={exam.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {exam.subject}
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {exam.students} estudiantes
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {exam.date}
                  </p>
                  <Button size="sm" variant="outline">
                    Ver detalles
                  </Button>
                </div>
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
            Promedios y estadísticas por grado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboardData.studentPerformance.map((performance, index) => (
              <div key={index} className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {performance.grade}
                  </h3>
                  <Badge variant="secondary">
                    {performance.students} estudiantes
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {performance.average}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${performance.average}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

