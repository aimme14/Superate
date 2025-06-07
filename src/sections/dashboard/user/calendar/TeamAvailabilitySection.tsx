import { ThemeContextProps } from "@/interfaces/context.interface"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamMember {
  availability: 'available' | 'busy' | 'away'
  avatar: string
  name: string
  role: string
  id: string
}

interface TeamAvailabilitySectionProps extends ThemeContextProps {
  teamMembers: TeamMember[]
}

const TeamAvailabilitySection = ({ theme, teamMembers }: TeamAvailabilitySectionProps) => {
  return (
    <section className={cn('p-4 rounded-lg shadow-sm border', theme === 'dark' ? 'bg-zinc-950 border-zinc-700' : 'bg-white border-gray-100')}>
      <h2 className={cn('text-lg font-medium mb-4 flex items-center', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
        <Users className="h-5 w-5 mr-2" />
        Equipo Técnico
      </h2>

      <div className="space-y-3">
        {teamMembers.length > 0 ? (
          teamMembers.map(member => (
            <TeamMemberCard
              key={member.id}
              member={member}
              theme={theme}
            />
          ))
        ) : (
          <p className={cn('text-sm py-3 text-center', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No hay miembros del equipo disponibles
          </p>
        )}
      </div>
    </section>
  )
}

export default TeamAvailabilitySection
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface TeamMemberCardProps extends ThemeContextProps {
  member: TeamMember
}

function TeamMemberCard({ member, theme }: TeamMemberCardProps) {
  const availabilityStatus = {
    available: {
      label: 'Disponible',
      color: theme === 'dark'
        ? 'bg-green-900/30 text-green-400'
        : 'bg-green-100 text-green-700'
    },
    busy: {
      label: 'Ocupado',
      color: theme === 'dark'
        ? 'bg-red-900/30 text-red-400'
        : 'bg-red-100 text-red-700'
    },
    away: {
      label: 'Ausente',
      color: theme === 'dark'
        ? 'bg-amber-900/30 text-amber-400'
        : 'bg-amber-100 text-amber-700'
    }
  }

  const status = availabilityStatus[member.availability]

  return (
    <div className={cn('p-3 rounded-lg border flex items-center', theme === 'dark'
      ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'
      : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'
    )}>
      <div className="relative">
        <img
          src={member.avatar}
          alt={member.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <span className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2',
          theme === 'dark' ? 'border-zinc-900' : 'border-white',
          member.availability === 'available' ? 'bg-green-500' :
            member.availability === 'busy' ? 'bg-red-500' : 'bg-amber-500'
        )}></span>
      </div>

      <div className="ml-3 flex-1">
        <div className="flex items-center justify-between">
          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {member.name}
          </h3>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', status.color)}>
            {status.label}
          </span>
        </div>
        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {member.role}
        </p>
      </div>
    </div>
  )
}
