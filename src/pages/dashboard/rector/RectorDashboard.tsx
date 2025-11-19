import { useState } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Activity,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRectorStats } from '@/hooks/query/useRectorStats'
import { useCampusOptions } from '@/hooks/query/useInstitutionQuery'
import { useFilteredPrincipals } from '@/hooks/query/usePrincipalQuery'
import { useTeachersByCampus } from '@/hooks/query/useTeacherQuery'
import { useStudentsByTeacher } from '@/hooks/query/useStudentQuery'

interface RectorDashboardProps extends ThemeContextProps {}

export default function RectorDashboard({ theme }: RectorDashboardProps) {
  const { stats, isLoading, currentRector, coordinators, teachers, students } = useRectorStats()
  const [showCampuses, setShowCampuses] = useState(false)

  // Datos estáticos que se mantienen (actividades recientes, logros, alertas)
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
    ]
  }

  // Mostrar loading si los datos están cargando
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className={cn('ml-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Cargando estadísticas...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 p-8 text-white">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Bienvenido, {stats.rectorName}
              </h1>
              <p className="text-lg opacity-90 mb-1">
                Rectoría - Institución Educativa
              </p>
              <p className="text-sm opacity-75">
                {stats.rectorEmail} • {stats.institutionName}
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <Building2 className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.totalCampuses}</div>
                <div className="text-xs opacity-75">Sedes</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <Crown className="h-8 w-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.totalPrincipals}</div>
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
              {stats.totalStudents.toLocaleString()}
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
              {stats.totalTeachers}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              En {stats.totalCampuses} sedes
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
              {stats.performanceMetrics.overallAverage}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +2.3% vs año anterior
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Coordinadores
            </CardTitle>
            <Crown className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {stats.performanceMetrics.coordinatorsCount}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              En {stats.totalCampuses} sedes
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
            {staticData.alerts.map((alert) => (
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
            {stats.campusOverview.map((campus: any) => (
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
              {staticData.recentActivities.map((activity) => {
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
              {staticData.achievements.map((achievement) => {
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

      {/* Sección de usuarios en cadena */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Building2 className="h-5 w-5 text-purple-500" />
                Usuarios de la Institución
              </CardTitle>
              <CardDescription>
                Visualización jerárquica de sedes, coordinadores, docentes y estudiantes
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCampuses(!showCampuses)}
              className={cn(
                "border-purple-500",
                theme === 'dark' 
                  ? 'text-purple-400 hover:bg-purple-900/20' 
                  : 'text-purple-600 hover:bg-purple-50'
              )}
            >
              <Building2 className="h-4 w-4 mr-2" />
              {showCampuses ? 'Ocultar' : 'Ver'} Sedes
            </Button>
          </div>
        </CardHeader>
        {showCampuses && (
          <CardContent>
            <CampusList 
              theme={theme} 
              institutionId={currentRector?.institutionId || ''} 
              coordinators={coordinators || []}
              teachers={teachers || []}
              students={students || []}
            />
          </CardContent>
        )}
      </Card>

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
                  {stats.performanceMetrics.overallAverage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-purple-600 h-3 rounded-full" 
                  style={{ width: `${stats.performanceMetrics.overallAverage}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Asistencia
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {stats.performanceMetrics.attendanceRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full" 
                  style={{ width: `${stats.performanceMetrics.attendanceRate}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Coordinadores
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {stats.performanceMetrics.coordinatorsCount}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-purple-600 h-3 rounded-full" 
                  style={{ width: `${Math.min((stats.performanceMetrics.coordinatorsCount / Math.max(stats.totalCampuses, 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Retención Docente
                </span>
                <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {stats.performanceMetrics.teacherRetention}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-amber-600 h-3 rounded-full" 
                  style={{ width: `${stats.performanceMetrics.teacherRetention}%` }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente para lista de sedes
interface CampusListProps {
  theme: 'light' | 'dark'
  institutionId: string
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function CampusList({ theme, institutionId, coordinators, teachers, students }: CampusListProps) {
  const { options: campusOptions, isLoading } = useCampusOptions(institutionId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className={cn('ml-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Cargando sedes...
        </span>
      </div>
    )
  }

  if (!campusOptions || campusOptions.length === 0) {
    return (
      <div className={cn('text-center py-8', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
        No hay sedes registradas
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {campusOptions.map((campus) => {
        const campusCoordinators = coordinators.filter((c: any) => c.campusId === campus.value)
        return (
          <CampusCard
            key={campus.value}
            theme={theme}
            campus={campus}
            coordinators={campusCoordinators}
            teachers={teachers}
            students={students}
          />
        )
      })}
    </div>
  )
}

// Componente para tarjeta de sede
interface CampusCardProps {
  theme: 'light' | 'dark'
  campus: any
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function CampusCard({ theme, campus, coordinators, teachers, students }: CampusCardProps) {
  const [showCoordinators, setShowCoordinators] = useState(false)

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-purple-500" />
          <div>
            <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {campus.label}
            </h3>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {coordinators.length} coordinador(es)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCoordinators(!showCoordinators)}
          className={cn(
            "border-purple-500",
            theme === 'dark' 
              ? 'text-purple-400 hover:bg-purple-900/20' 
              : 'text-purple-600 hover:bg-purple-50'
          )}
        >
          <Crown className="h-4 w-4 mr-2" />
          {showCoordinators ? 'Ocultar' : 'Ver'} Coordinadores
        </Button>
      </div>

      {showCoordinators && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600 space-y-3">
          {coordinators.length > 0 ? (
            coordinators.map((coordinator: any) => (
              <CoordinatorCard
                key={coordinator.id}
                theme={theme}
                coordinator={coordinator}
                teachers={teachers}
                students={students}
              />
            ))
          ) : (
            <div className={cn('text-center py-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay coordinadores asignados a esta sede
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de coordinador
interface CoordinatorCardProps {
  theme: 'light' | 'dark'
  coordinator: any
  teachers: any[]
  students: any[]
}

function CoordinatorCard({ theme, coordinator, teachers, students }: CoordinatorCardProps) {
  const [showTeachers, setShowTeachers] = useState(false)
  const campusTeachers = teachers.filter((t: any) => t.campusId === coordinator.campusId)

  return (
    <div className={cn('p-3 rounded-md border', theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-white')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
            {coordinator.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {coordinator.name}
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {coordinator.email}
            </p>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {campusTeachers.length} docente(s)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTeachers(!showTeachers)}
          className={cn(
            "border-purple-500",
            theme === 'dark' 
              ? 'text-purple-400 hover:bg-purple-900/20' 
              : 'text-purple-600 hover:bg-purple-50'
          )}
        >
          <GraduationCap className="h-4 w-4 mr-2" />
          {showTeachers ? 'Ocultar' : 'Ver'} Docentes
        </Button>
      </div>

      {showTeachers && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {campusTeachers.length > 0 ? (
            campusTeachers.map((teacher: any) => (
              <TeacherCard
                key={teacher.id}
                theme={theme}
                teacher={teacher}
                students={students}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay docentes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de docente
interface TeacherCardProps {
  theme: 'light' | 'dark'
  teacher: any
  students: any[]
}

function TeacherCard({ theme, teacher, students }: TeacherCardProps) {
  const [showStudents, setShowStudents] = useState(false)
  const { data: teacherStudents, isLoading: studentsLoading } = useStudentsByTeacher(teacher.id, showStudents)

  return (
    <div className={cn('p-3 rounded-md border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
            {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {teacher.name}
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {teacher.email}
            </p>
            {teacher.gradeName && (
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Grado: {teacher.gradeName}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStudents(!showStudents)}
          className={cn(
            "border-blue-500",
            theme === 'dark' 
              ? 'text-blue-400 hover:bg-blue-900/20' 
              : 'text-blue-600 hover:bg-blue-50'
          )}
        >
          <Users className="h-4 w-4 mr-2" />
          {showStudents ? 'Ocultar' : 'Ver'} Estudiantes
        </Button>
      </div>

      {showStudents && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {studentsLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={cn('ml-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Cargando...
              </span>
            </div>
          ) : teacherStudents && teacherStudents.length > 0 ? (
            teacherStudents.map((student: any) => (
              <StudentCard
                key={student.id}
                theme={theme}
                student={student}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de estudiante
interface StudentCardProps {
  theme: 'light' | 'dark'
  student: any
}

function StudentCard({ theme, student }: StudentCardProps) {
  return (
    <div className={cn('p-2 rounded border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-900' : 'border-gray-200 bg-white')}>
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-medium">
          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <p className={cn('font-medium text-xs', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {student.name}
          </p>
          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.email}
          </p>
          {student.gradeName && (
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Grado: {student.gradeName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


