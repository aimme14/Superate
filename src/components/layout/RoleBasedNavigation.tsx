import { useRole } from '@/hooks/core/useRole'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Home, 
  BookOpen, 
  Users, 
  BarChart3, 
  TrendingUp,
  Building,
  FileText,
  Settings,
  UserCheck,
  Shield,
  Database,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link, useLocation } from 'react-router-dom'

interface RoleBasedNavigationProps extends ThemeContextProps {}

export default function RoleBasedNavigation({ theme }: RoleBasedNavigationProps) {
  const { userRole, getNavigationConfig, isStudent, isTeacher, isPrincipal, isAdmin } = useRole()
  const location = useLocation()
  
  const navigationConfig = getNavigationConfig()

  // Iconos para cada tipo de navegación
  const iconMap = {
    Home: Home,
    BookOpen: BookOpen,
    Users: Users,
    BarChart3: BarChart3,
    TrendingUp: TrendingUp,
    Building: Building,
    FileText: FileText,
    Settings: Settings,
    UserCheck: UserCheck,
    Shield: Shield,
    Database: Database,
    Activity: Activity,
  }

  // Colores de badge por rol
  const roleColors = {
    student: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    teacher: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    principal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    rector: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  // Títulos por rol
  const roleTitles = {
    student: 'Estudiante',
    teacher: 'Docente',
    principal: 'Coordinador',
    rector: 'Rector',
    admin: 'Administrador',
  }

  return (
    <div className="space-y-4">
      {/* Header del rol */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Navegación
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Panel de {userRole ? roleTitles[userRole] : 'Usuario'}
          </p>
        </div>
        <Badge className={userRole ? roleColors[userRole] : 'bg-gray-100 text-gray-800'}>
          {userRole ? roleTitles[userRole] : 'Usuario'}
        </Badge>
      </div>

      {/* Navegación principal */}
      <nav className="space-y-2">
        {navigationConfig.sidebarItems.map((item) => {
          const IconComponent = iconMap[item.icon as keyof typeof iconMap]
          const isActive = location.pathname === item.href || 
                          (item.href === '/dashboard' && location.pathname.startsWith('/dashboard'))
          
          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : theme === 'dark' 
                      ? 'text-gray-300 hover:bg-zinc-800 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <IconComponent className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Información específica del rol */}
      <div className={cn('p-4 rounded-lg border', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
        <h3 className={cn('text-sm font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Accesos Disponibles
        </h3>
        <div className="space-y-1">
          {isStudent && (
            <>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Tomar exámenes
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Ver resultados
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Consultar promedios
              </p>
            </>
          )}
          {isTeacher && (
            <>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Gestionar exámenes
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Ver analíticas
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Revisar estudiantes
              </p>
            </>
          )}
          {isPrincipal && (
            <>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Gestionar institución
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Supervisar personal
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Generar reportes
              </p>
            </>
          )}
          {isAdmin && (
            <>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Administrar sistema
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Gestionar usuarios
              </p>
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                • Configurar sistema
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

