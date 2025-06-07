import { UserDashboardData } from "@/hooks/format/user/useUserDashboard"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { Calendar, Clock, MapPin, Activity } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface TasksSectionProps extends ThemeContextProps {
  data: UserDashboardData
}

const TasksSection = ({ theme, data }: TasksSectionProps) => {
  return (
    <section className={cn('grid md:grid-cols-2 gap-6')}>
      {/* Próximos mantenimientos */}
      <div className={cn('p-6 rounded-lg shadow-sm border', theme === 'dark'
        ? 'bg-zinc-950 border-zinc-700'
        : 'bg-white border-gray-100'
      )}>
        <h2 className={cn('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Próximos Mantenimientos
        </h2>
        <div className="space-y-4">
          {data.upcomingMaintenances.map((maintenance) => (
            <UpcomingMaintenanceCard
              key={maintenance.id}
              maintenance={maintenance}
              theme={theme}
            />
          ))}
          {data.upcomingMaintenances.length === 0 && (
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay mantenimientos programados próximamente.
            </p>
          )}
        </div>
      </div>

      {/* Actividades recientes */}
      <div className={cn('p-6 rounded-lg shadow-sm border', theme === 'dark'
        ? 'bg-zinc-950 border-zinc-700'
        : 'bg-white border-gray-100'
      )}>
        <h2 className={cn('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Actividades Recientes
        </h2>
        <div className="space-y-4">
          {data.recentActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              theme={theme}
            />
          ))}
          {data.recentActivities.length === 0 && (
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay actividades recientes para mostrar.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default TasksSection
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface UpcomingMaintenanceCardProps extends ThemeContextProps {
  maintenance: UserDashboardData['upcomingMaintenances'][0]
}

function UpcomingMaintenanceCard({ maintenance, theme }: UpcomingMaintenanceCardProps) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const formattedDate = format(parseISO(maintenance.date), 'PPP', { locale: es })
  const formattedTime = format(parseISO(maintenance.date), 'p', { locale: es })

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark'
      ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'
      : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {maintenance.equipmentName}
          </h3>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {maintenance.clientName}
          </p>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', priorityColors[maintenance.priority])}>
          {maintenance.priority === 'high' ? 'Alta' : maintenance.priority === 'medium' ? 'Media' : 'Baja'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center">
          <Calendar className="h-4 w-4 mr-1 text-gray-500" />
          <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {formattedDate}
          </span>
        </div>
        <div className="flex items-center">
          <Clock className="h-4 w-4 mr-1 text-gray-500" />
          <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {formattedTime}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-start">
        <MapPin className="h-4 w-4 mr-1 text-gray-500 mt-0.5" />
        <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {maintenance.location}
        </span>
      </div>
    </div>
  )
}

interface ActivityCardProps extends ThemeContextProps {
  activity: UserDashboardData['recentActivities'][0]
}

function ActivityCard({ activity, theme }: ActivityCardProps) {
  const statusColors = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inProgress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  }

  const typeIcons = {
    maintenance: <Tool className="h-8 w-8 text-blue-500" />,
    inspection: <Search className="h-8 w-8 text-amber-500" />,
    repair: <Wrench className="h-8 w-8 text-purple-500" />,
    installation: <Download className="h-8 w-8 text-green-500" />,
    default: <Activity className="h-8 w-8 text-gray-500" />
  }

  const formattedDate = format(parseISO(activity.date), 'PPP', { locale: es })
  const formattedTime = format(parseISO(activity.date), 'p', { locale: es })

  // Función para obtener el icono según el tipo
  const getIcon = (type: string) => {
    return typeIcons[type as keyof typeof typeIcons] || typeIcons.default
  }

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark'
      ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'
      : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'
    )}>
      <div className="flex">
        <div className="mr-3">
          {getIcon(activity.type)}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {activity.title}
            </h3>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
              statusColors[activity.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
            )}>
              {activity.status === 'completed' ? 'Completado' :
                activity.status === 'inProgress' ? 'En progreso' :
                  activity.status === 'pending' ? 'Pendiente' :
                    activity.status === 'cancelled' ? 'Cancelado' : activity.status}
            </span>
          </div>
          <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {activity.description}
          </p>
          <div className="mt-2 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-500" />
            <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {formattedDate} - {formattedTime}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Iconos adicionales para los tipos de actividades
function Tool(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      stroke="currentColor"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function Search(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function Wrench(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function Download(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}