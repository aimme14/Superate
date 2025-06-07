// import { CalendarEvent } from "@/hooks/format/engineer/useEngineerCalendar"
import { Calendar, Clock, MapPin, AlertCircle } from "lucide-react"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

// Definimos los tipos para los datos que devuelve el hook
export interface CalendarEvent {
  type: 'maintenance' | 'inspection' | 'repair' | 'installation' | 'meeting' | 'training'
  priority: 'high' | 'medium' | 'low'
  equipmentName?: string
  clientName?: string
  startDate: string
  location?: string
  endDate: string
  title: string
  id: string
}

interface UpcomingEventsSectionProps extends ThemeContextProps {
  upcomingEvents: CalendarEvent[]
}

const UpcomingEventsSection = ({ theme, upcomingEvents }: UpcomingEventsSectionProps) => {
  return (
    <section className={cn('p-4 rounded-lg shadow-sm border', theme === 'dark'
      ? 'bg-zinc-950 border-zinc-700'
      : 'bg-white border-gray-100'
    )}>
      <h2 className={cn('text-lg font-medium mb-4 flex items-center', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
        <Clock className="h-5 w-5 mr-2" />
        Próximos Eventos
      </h2>

      <div className="space-y-3">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              theme={theme}
            />
          ))
        ) : (
          <p className={cn('text-sm py-3 text-center', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No hay eventos próximos programados
          </p>
        )}
      </div>

      <div className="mt-4 text-center">
        <button className={cn('text-sm font-medium', theme === 'dark'
          ? 'text-blue-400 hover:text-blue-300'
          : 'text-blue-600 hover:text-blue-700'
        )}>
          Ver todos los eventos
        </button>
      </div>
    </section>
  )
}

export default UpcomingEventsSection
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface EventCardProps extends ThemeContextProps {
  event: CalendarEvent
}

function EventCard({ event, theme }: EventCardProps) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const typeIcons = {
    maintenance: <Maintenance className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />,
    repair: <Repair className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />,
    inspection: <Inspection className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />,
    installation: <Installation className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />,
    meeting: <Meeting className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />,
    training: <Training className="h-10 w-10" style={{ color: getEventTypeColor(event.type) }} />
  }

  const formattedDate = format(parseISO(event.startDate), 'EEEE d', { locale: es })
  const formattedTime = format(parseISO(event.startDate), 'p', { locale: es })

  return (
    <div className={cn('p-3 rounded-lg border flex items-start', theme === 'dark'
      ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'
      : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'
    )}>
      <div className="mr-3">
        {typeIcons[event.type as keyof typeof typeIcons] ||
          <AlertCircle className="h-10 w-10 text-gray-400" />}
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {event.title}
            </h3>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {event.clientName}
              {event.equipmentName && ` - ${event.equipmentName}`}
            </p>
          </div>

          <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
            priorityColors[event.priority as keyof typeof priorityColors]
          )}>
            {event.priority === 'high' ? 'Alta' :
              event.priority === 'medium' ? 'Media' : 'Baja'}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1">
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

        <div className="mt-1 flex items-center">
          <MapPin className="h-4 w-4 mr-1 text-gray-500" />
          <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {event.location}
          </span>
        </div>
      </div>
    </div>
  )
}

// Función para obtener el color según el tipo de evento
function getEventTypeColor(type: string): string {
  switch (type) {
    case 'maintenance':
      return '#3b82f6' // blue-500
    case 'repair':
      return '#ef4444' // red-500
    case 'inspection':
      return '#f59e0b' // amber-500
    case 'installation':
      return '#10b981' // green-500
    case 'meeting':
      return '#8b5cf6' // purple-500
    case 'training':
      return '#6366f1' // indigo-500
    default:
      return '#6b7280' // gray-500
  }
}

// Iconos personalizados para cada tipo de evento
function Maintenance(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function Repair(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

function Inspection(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Installation(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function Meeting(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function Training(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
      <path d="M8 15h6" />
    </svg>
  )
}
