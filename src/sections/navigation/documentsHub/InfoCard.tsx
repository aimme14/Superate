import { ThemeContextProps } from "@/interfaces/context.interface"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const InfoCard = ({ theme }: ThemeContextProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.8, duration: 0.5 }}
    className={cn("rounded-xl p-6 mb-8", theme === "dark"
      ? "bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-800/50"
      : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100",
    )}
  >
    <div className="flex flex-col md:flex-row items-center justify-between">
      <div className="mb-6 md:mb-0 md:mr-6">
        <h3 className={cn("text-xl font-bold mb-2", theme === "dark" ? "text-white" : "text-gray-800")}>
          Gestión Integral de Equipos Biomédicos
        </h3>
        <p className={cn("max-w-xl", theme === "dark" ? "text-gray-300" : "text-gray-600")}>
          Nuestro sistema le permite mantener un control completo sobre sus equipos, desde su creación hasta la
          gestión de mantenimientos preventivo y correctivo, garantizando el cumplimiento de normativas y la
          disponibilidad óptima de sus recursos.
        </p>

        <div className="flex mt-4 space-x-2">
          <motion.span
            whileHover={{ scale: 1.05 }}
            className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium", theme === "dark" ? "bg-blue-900/50 text-blue-200" : "bg-blue-100 text-blue-800")}
          >
            ISO 13485
          </motion.span>
          <motion.span
            whileHover={{ scale: 1.05 }}
            className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium", theme === "dark" ? "bg-indigo-900/50 text-indigo-200" : "bg-indigo-100 text-indigo-800")}
          >
            Trazabilidad
          </motion.span>
          <motion.span
            whileHover={{ scale: 1.05 }}
            className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium", theme === "dark" ? "bg-purple-900/50 text-purple-200" : "bg-purple-100 text-purple-800")}
          >
            Reportes Avanzados
          </motion.span>
        </div>
      </div>

      {/* Gráfico ilustrativo */}
      <div className={cn("w-full md:w-64 h-32 rounded-lg overflow-hidden relative", theme === "dark" ? "bg-blue-950/50" : "bg-white")}>
        <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
          <motion.div
            initial={{ height: "0%" }}
            animate={{ height: "60%" }}
            className="w-6 bg-blue-500 rounded-t-md"
            transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            initial={{ height: "0%" }}
            animate={{ height: "80%" }}
            className="w-6 bg-indigo-500 rounded-t-md"
            transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            initial={{ height: "0%" }}
            animate={{ height: "40%" }}
            className="w-6 bg-purple-500 rounded-t-md"
            transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            initial={{ height: "0%" }}
            animate={{ height: "70%" }}
            className="w-6 bg-teal-500 rounded-t-md"
            transition={{ delay: 1.3, duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className={cn("absolute bottom-0 left-0 right-0 h-px", theme === "dark" ? "bg-gray-700" : "bg-gray-300")} />
      </div>
    </div>
  </motion.div >
)

export default InfoCard