import { useState } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Users, 
  Building, 
  Shield,
  Database,
  Activity,
  AlertCircle,
  TrendingUp,
  Server,
  Lock,
  UserPlus,
  BarChart3,
  Home,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import UserManagement from '@/components/admin/UserManagement'
import InstitutionManagement from '@/components/admin/InstitutionManagement'
import QuestionBank from '@/components/admin/QuestionBank'

interface AdminDashboardProps extends ThemeContextProps {}

export default function AdminDashboard({ theme }: AdminDashboardProps) {
  // const { userRole, permissions } = useRole()
  const [activeTab, setActiveTab] = useState('overview')

  // Datos de ejemplo para el dashboard del administrador
  const dashboardData = {
    systemStats: {
      totalUsers: 15420,
      totalInstitutions: 125,
      activeSessions: 2847,
      systemUptime: 99.9
    },
    performanceMetrics: {
      responseTime: 145,
      errorRate: 0.02,
      cpuUsage: 45.2,
      memoryUsage: 67.8
    },
    recentActivities: [
      { id: 1, type: 'user_created', title: 'Nuevo usuario registrado: Institución XYZ', time: '5 minutos atrás' },
      { id: 2, type: 'system_update', title: 'Actualización del sistema completada', time: '1 hora atrás' },
      { id: 3, type: 'backup_completed', title: 'Respaldo de base de datos completado', time: '2 horas atrás' },
      { id: 4, type: 'security_alert', title: 'Intento de acceso no autorizado bloqueado', time: '3 horas atrás' },
    ],
    systemAlerts: [
      { id: 1, type: 'warning', message: 'Uso de CPU elevado en servidor principal', priority: 'medium' },
      { id: 2, type: 'info', message: 'Actualización de seguridad disponible', priority: 'low' },
      { id: 3, type: 'success', message: 'Todos los sistemas funcionando correctamente', priority: 'low' },
    ],
    userActivity: [
      { institution: 'Colegio San José', users: 450, lastActivity: '2 minutos atrás', status: 'active' },
      { institution: 'Instituto Nacional', users: 320, lastActivity: '5 minutos atrás', status: 'active' },
      { institution: 'Escuela Primaria ABC', users: 180, lastActivity: '10 minutos atrás', status: 'active' },
      { institution: 'Liceo Moderno', users: 280, lastActivity: '15 minutos atrás', status: 'active' },
    ],
    securityMetrics: {
      blockedAttempts: 23,
      successfulLogins: 15420,
      failedLogins: 45,
      securityScore: 98.5
    }
  }

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

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full grid-cols-5", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <TabsTrigger value="overview" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
            <Home className="h-4 w-4" />
            <span>Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="users" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="institutions" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
            <Building className="h-4 w-4" />
            <span>Instituciones</span>
          </TabsTrigger>
          <TabsTrigger value="questions" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
            <BookOpen className="h-4 w-4" />
            <span>Preguntas</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
            <BarChart3 className="h-4 w-4" />
            <span>Analíticas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {/* Estadísticas principales del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Total Usuarios
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.systemStats.totalUsers.toLocaleString()}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              +125 esta semana
            </p>
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
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.systemStats.totalInstitutions}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Activas
            </p>
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
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.systemStats.activeSessions.toLocaleString()}
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              En tiempo real
            </p>
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
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.systemStats.systemUptime}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Excelente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de rendimiento del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Tiempo de Respuesta
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.responseTime}ms
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Óptimo
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Tasa de Error
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.errorRate}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Muy bajo
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Uso de CPU
            </CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.cpuUsage}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
              Normal
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Uso de Memoria
            </CardTitle>
            <Server className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {dashboardData.performanceMetrics.memoryUsage}%
            </div>
            <p className={cn('text-xs', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
              Moderado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas del sistema */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Shield className="h-5 w-5 text-blue-500" />
            Alertas del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dashboardData.systemAlerts.map((alert) => (
              <div key={alert.id} className={cn("flex items-center justify-between p-3 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    alert.priority === 'high' ? 'bg-red-500' : 
                    alert.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {alert.message}
                  </p>
                </div>
                <Badge variant={alert.priority === 'high' ? 'destructive' : 'secondary'} className={cn(theme === 'dark' && alert.priority !== 'high' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
                  {alert.priority === 'high' ? 'Crítico' : alert.priority === 'medium' ? 'Medio' : 'Bajo'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividades recientes del sistema */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Actividades del Sistema
            </CardTitle>
            <CardDescription>
              Últimas acciones y eventos del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {activity.type === 'user_created' && <UserPlus className="h-5 w-5 text-green-500" />}
                  {activity.type === 'system_update' && <Settings className="h-5 w-5 text-blue-500" />}
                  {activity.type === 'backup_completed' && <Database className="h-5 w-5 text-purple-500" />}
                  {activity.type === 'security_alert' && <Lock className="h-5 w-5 text-red-500" />}
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

        {/* Actividad de instituciones */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Actividad por Institución
            </CardTitle>
            <CardDescription>
              Usuarios activos por institución
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.userActivity.map((institution, index) => (
              <div key={index} className={cn("flex items-center justify-between p-3 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
                <div>
                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {institution.institution}
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {institution.users} usuarios activos
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={institution.status === 'active' ? 'default' : 'secondary'} className={cn(theme === 'dark' && institution.status === 'active' ? 'bg-blue-600 text-white' : theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
                    {institution.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {institution.lastActivity}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Métricas de seguridad */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Métricas de Seguridad
          </CardTitle>
          <CardDescription>
            Estadísticas de seguridad y acceso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cn("text-center p-4 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                {dashboardData.securityMetrics.blockedAttempts}
              </div>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Intentos Bloqueados
              </p>
            </div>
            <div className={cn("text-center p-4 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                {dashboardData.securityMetrics.successfulLogins.toLocaleString()}
              </div>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Accesos Exitosos
              </p>
            </div>
            <div className={cn("text-center p-4 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                {dashboardData.securityMetrics.failedLogins}
              </div>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Accesos Fallidos
              </p>
            </div>
            <div className={cn("text-center p-4 rounded-lg border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200')}>
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                {dashboardData.securityMetrics.securityScore}%
              </div>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Puntuación de Seguridad
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
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

        <TabsContent value="analytics">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Analíticas del Sistema
              </CardTitle>
              <CardDescription>
                Métricas y estadísticas del sistema educativo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Analíticas Avanzadas
                </h3>
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Próximamente: gráficos detallados, reportes de rendimiento y métricas avanzadas
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

