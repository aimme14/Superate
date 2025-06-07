import { ThemeContextProps } from "@/interfaces/context.interface"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderCalendarSectionProps extends ThemeContextProps {
  credentials: any
}

const HeaderCalendarSection = ({ theme, credentials }: HeaderCalendarSectionProps) => {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-2 ml-5">
        <div className={cn('p-2 rounded-lg', theme === 'dark'
          ? 'bg-blue-900/30'
          : 'bg-blue-100'
        )}>
          <CalendarIcon className={cn('h-6 w-6', theme === 'dark'
            ? 'text-blue-400'
            : 'text-blue-600'
          )} />
        </div>
        <h1 className={cn('text-3xl md:text-4xl font-bold', theme === 'dark'
          ? 'text-white'
          : 'text-zinc-800'
        )}>
          Calendario de
          <span className={cn('bg-gradient-to-bl text-transparent bg-clip-text', theme === 'dark'
            ? 'from-blue-400 to-purple-900'
            : 'from-blue-700 to-purple-600'
          )}> Eventos </span>
        </h1>
      </div>

      <p className={cn('text-base mt-2 ml-10', theme === 'dark'
        ? 'text-zinc-300'
        : 'text-zinc-600'
      )}>Gestione su agenda de eventos, mantenimientos y reparaciones de equipos médicos</p>

      {credentials && (
        <div className="flex items-center gap-2 ml-10">
          <span className={cn('text-xl', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            {credentials.username}
          </span>
          <span className={cn('text-sm px-2 py-1 rounded-full', theme === 'dark'
            ? 'bg-green-900/30 text-green-400'
            : 'bg-green-100 text-green-700'
          )}>
            Disponible
          </span>
        </div>
      )}
    </header>
  )
}

export default HeaderCalendarSection