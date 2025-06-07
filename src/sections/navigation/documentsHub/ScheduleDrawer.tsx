import { ArrowRight, BookOpen, Calendar, Users, Clock } from "lucide-react"
import { CronogramaOption, CustomDrawer } from "#/common/elements/Drawer"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useState } from "react"
import { cn } from "@/lib/utils"

/** Interfaz para las propiedades del componente ScheduleDrawer */
interface CronogramasDrawerProps extends ThemeContextProps {
  onClose: () => void
  isOpen: boolean
}

/**
 * Componente específico para mostrar opciones de cronogramas
 * Utiliza el CustomDrawer como base
 */
const ScheduleDrawer = ({ theme, isOpen, onClose }: CronogramasDrawerProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleOptionClick = (option: CronogramaOption) => {
    setSelectedOption(option.id)
    navigate(option.path)
    onClose()
  }

  return (
    <CustomDrawer
      size="full"
      open={isOpen}
      theme={theme}
      position="bottom"
      title="Seleccionar Tipo de Cronograma"
      onOpenChange={(open) => !open && onClose()}
      description="Elija el tipo de cronograma que desea consultar"
      footer={
        <div className={cn("flex items-center justify-between w-full")}>
          <div className="flex items-center">
            <Clock className={cn("h-4 w-4 mr-2", theme === "dark" ? "text-gray-400" : "text-gray-500")} />
            <span className={cn("text-xs", theme === "dark" ? "text-gray-400" : "text-gray-500")}>
              Última actualización: hace 2 días
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            className={cn("text-xs px-3 py-1 rounded-full", theme === "dark"
              ? "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            )}
          >
            Ver todos los cronogramas
          </motion.button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options({ theme }).map((option, index) => (
          <ScheduleOptionCard
            theme={theme}
            index={index}
            key={option.id}
            option={option}
            onClick={() => handleOptionClick(option)}
            isSelected={selectedOption === option.id}
          />
        ))}
      </div>
    </CustomDrawer>
  )
}

/** Interfaz para las propiedades del componente ScheduleOptionCard */
interface ScheduleOptionCardProps extends ThemeContextProps {
  option: CronogramaOption
  isSelected?: boolean
  onClick: () => void
  index: number
}

/** Componente para mostrar una tarjeta de opción de cronograma */
const ScheduleOptionCard = ({ option, index, theme, isSelected = false, onClick }: ScheduleOptionCardProps) => (
  <motion.div
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    whileHover={{ scale: 1.03 }}
    animate={{ opacity: 1, y: 0 }}
    initial={{ opacity: 0, y: 20 }}
    transition={{ delay: index * 0.1, duration: 0.3, }}
    className={cn("relative overflow-hidden rounded-xl cursor-pointer h-44 group", theme === "dark"
      ? "bg-zinc-950 border border-zinc-800" : "bg-white border border-gray-100",
      isSelected && "ring-2 ring-offset-2",
      isSelected && theme === "dark"
        ? "ring-offset-zinc-950 ring-teal-500"
        : isSelected
          ? "ring-offset-white ring-teal-500"
          : ""
    )}
  >
    {/* Fondo con gradiente */}
    <div className={cn("absolute inset-0 opacity-90 group-hover:opacity-100 transition-opacity bg-gradient-to-br", option.gradient)} />

    {/* Contenido */}
    <div className="absolute inset-0 p-4 flex flex-col justify-between text-white z-10">
      <div className="flex items-center">
        <option.icon className="h-6 w-6 mr-2" />
        <h4 className="text-lg font-semibold">{option.title}</h4>
      </div>
      <div>
        <p className="text-sm opacity-90 mb-2">{option.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center group-hover:translate-x-1 transition-transform">
            <span className="text-xs mr-1">Ver detalles</span>
            <ArrowRight className="h-3 w-3" />
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs">
            {option.stats}
          </div>
        </div>
      </div>
    </div>
  </motion.div>
)

export default ScheduleDrawer
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
// Opciones de cronogramas
const options = ({ theme }: ThemeContextProps): CronogramaOption[] => [{
  id: "mantenimiento",
  title: "Mantenimiento",
  description: "Cronogramas de mantenimiento preventivo y correctivo para equipos",
  icon: Calendar,
  path: "/form/schedule/maintenance",
  gradient: theme === "dark" ? "from-teal-600 to-emerald-700" : "from-teal-500 to-emerald-600",
  stats: "12 programados",
}, {
  id: "capacitaciones",
  title: "Capacitaciones",
  description: "Planificación de capacitaciones técnicas y formaciones",
  icon: BookOpen,
  path: "/form/schedule/training",
  gradient: theme === "dark" ? "from-blue-600 to-indigo-700" : "from-blue-500 to-indigo-600",
  stats: "4 pendientes",
}, {
  id: "asistencia",
  title: "Asistencia",
  description: "Registro y control de asistencia a mantenimientos y capacitaciones",
  icon: Users,
  path: "/form/schedule/assistance",
  gradient: theme === "dark" ? "from-purple-600 to-violet-700" : "from-purple-500 to-violet-600",
  stats: "8 registros",
}]