import CalendarSection from "#/pages/dashboard/user/Calendar"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

import HeaderCalendarSection from "@/sections/dashboard/user/calendar/HeaderCalendarSection"
import UpcomingEventsSection from "@/sections/dashboard/user/calendar/UpcomingEventsSection"
import TeamAvailabilitySection from "@/sections/dashboard/user/calendar/TeamAvailabilitySection"

const CalendarPage = () => {
  const { theme } = useThemeContext()
  const { user: credentials } = useAuthContext()
  return (
    <main className={cn('mx-auto px-2 lg:px-4 py-4')}>
      <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <HeaderCalendarSection theme={theme} credentials={credentials} />{/* Encabezado del Calendario */}
        <UpcomingEventsSection theme={theme} upcomingEvents={[]} />{/* Sección de Próximos Eventos */}
        <CalendarSection theme={theme} />{/* Sección Principal del Calendario; Componente externo */}
        <TeamAvailabilitySection theme={theme} teamMembers={[]} />{/* Sección de users */}
      </motion.div>
    </main>
  )
}

export default CalendarPage