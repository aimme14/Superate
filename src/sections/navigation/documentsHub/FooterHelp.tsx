import { ThemeContextProps } from "@/interfaces/context.interface"
import { ChevronRight, Info } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const FooterHelp = ({ theme }: ThemeContextProps) => {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 1.2, duration: 0.5 }}
      className={cn("rounded-xl overflow-hidden", theme === "dark"
        ? "bg-zinc-900/70 text-gray-300"
        : "bg-white text-gray-600"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className={cn("p-6 flex flex-col justify-center", theme === "dark"
          ? "bg-gradient-to-r from-blue-900/30 to-indigo-900/30"
          : "bg-gradient-to-r from-blue-50 to-indigo-50"
        )}
        >
          <h3 className={cn("text-lg font-semibold mb-2", theme === "dark" ? "text-white" : "text-gray-800")}>
            ¿Necesita ayuda?
          </h3>
          <p className="text-sm mb-4">Acceda a nuestra documentación completa y recursos de soporte</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.03 }}
            className={cn("px-4 py-2 rounded-lg text-white text-sm font-medium inline-flex items-center", theme === "dark"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-blue-500 hover:bg-blue-600"
            )}
          >
            <Info className="h-4 w-4 mr-2" />
            Ver guía de usuario
          </motion.button>
        </div>

        <div className="col-span-2 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className={cn("text-sm font-semibold mb-3", theme === "dark" ? "text-gray-300" : "text-gray-700")}>
                Recursos Populares
              </h4>
              <ul className="space-y-2">
                {[
                  "Guía de mantenimiento preventivo",
                  "Catálogo de equipos médicos",
                  "Normativas y certificaciones",
                  "Preguntas frecuentes",
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.3 + i * 0.05 }}
                    className="text-sm flex items-center"
                  >
                    <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="hover:underline cursor-pointer">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className={cn("text-sm font-semibold mb-3", theme === "dark" ? "text-gray-300" : "text-gray-700")}>
                Contacto Rápido
              </h4>
              <ul className="space-y-2">
                {[
                  "Soporte técnico 24/7",
                  "Solicitar capacitación",
                  "Reportar un problema",
                  "Agendar una demostración",
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    animate={{ opacity: 1, x: 0 }}
                    initial={{ opacity: 0, x: -10 }}
                    transition={{ delay: 1.4 + i * 0.05 }}
                    className="text-sm flex items-center"
                  >
                    <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="hover:underline cursor-pointer">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default FooterHelp