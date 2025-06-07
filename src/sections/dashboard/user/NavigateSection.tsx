import { ThemeContextProps } from "@/interfaces/context.interface"
import { Calendar, FileText, Settings, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

interface NavigateSectionProps extends ThemeContextProps { }

const NavigateSection = ({ theme }: NavigateSectionProps) => {
  return (
    <section className={cn('p-6 rounded-lg shadow-sm border', theme === 'dark' ? 'bg-zinc-950 border-zinc-700' : 'bg-white border-gray-100')}>
      <h2 className={cn('text-lg font-medium mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
        Acceso Rápido
      </h2>

      <div className="grid sm:grid-cols-4 gap-4">
        <NavigationCard
          color="blue"
          theme={theme}
          href="/calendar"
          title="Calendario"
          description="Ver agenda"
          icon={<Calendar className="h-6 w-6" />}
        />
        <NavigationCard
          theme={theme}
          color="purple"
          title="Informes"
          href="/dashboard/reports"
          description="Ver reportes"
          icon={<FileText className="h-6 w-6" />}
        />
        <NavigationCard
          color="amber"
          theme={theme}
          title="Clientes"
          href="/dashboard/clients"
          description="Ver clientes"
          icon={<Users className="h-6 w-6" />}
        />
        <NavigationCard
          color="gray"
          theme={theme}
          title="Ajustes"
          description="Configuración"
          href="/dashboard/settings"
          icon={<Settings className="h-6 w-6" />}
        />
      </div>
    </section>
  )
}

export default NavigateSection
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface NavigationCardProps extends ThemeContextProps {
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'gray'
  icon: React.ReactNode
  description: string
  title: string
  href: string
}

function NavigationCard({ href, icon, title, description, theme, color }: NavigationCardProps) {
  const colorStyles = {
    blue: {
      light: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600',
      dark: 'bg-blue-900/20 border-blue-800 hover:bg-blue-900/30 text-blue-400'
    },
    green: {
      light: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-600',
      dark: 'bg-green-900/20 border-green-800 hover:bg-green-900/30 text-green-400'
    },
    purple: {
      light: 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-600',
      dark: 'bg-purple-900/20 border-purple-800 hover:bg-purple-900/30 text-purple-400'
    },
    amber: {
      light: 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-600',
      dark: 'bg-amber-900/20 border-amber-800 hover:bg-amber-900/30 text-amber-400'
    },
    red: {
      light: 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600',
      dark: 'bg-red-900/20 border-red-800 hover:bg-red-900/30 text-red-400'
    },
    gray: {
      light: 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600',
      dark: 'bg-gray-800/40 border-gray-700 hover:bg-gray-800/60 text-gray-400'
    }
  }

  const currentColorStyle = theme === 'dark' ? colorStyles[color].dark : colorStyles[color].light

  return (
    <Link to={href}>
      <div className={cn('p-4 rounded-lg border flex flex-col items-center text-center transition-colors', currentColorStyle)}>
        <div className="mb-2">
          {icon}
        </div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {description}
        </p>
      </div>
    </Link>
  )
}
