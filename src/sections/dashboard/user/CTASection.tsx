import { FileText, ClipboardList, FileSpreadsheet, ArrowRight } from "lucide-react"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CTASectionProps extends ThemeContextProps { }

const CTASection = ({ theme }: CTASectionProps) => {
  return (
    <section className="rounded-lg overflow-hidden">
      <div className={cn('relative py-12 px-6 md:px-10 overflow-hidden', theme === 'dark'
        ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900'
        : 'bg-gradient-to-r from-blue-50 via-indigo-100 to-purple-100'
      )}>
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-purple-400 blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-blue-400 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-indigo-400 blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left max-w-3xl">
              <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={cn('text-2xl md:text-3xl font-bold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}
              >
                Gestión de Documentación Técnica
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={cn('text-lg mb-6', theme === 'dark' ? 'text-white/90' : 'text-gray-700')}
              >
                Acceda a todos los documentos técnicos, informes de mantenimiento y registros de equipos en un solo lugar.
              </motion.p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className={cn('flex items-start p-4 rounded-lg', theme === 'dark'
                    ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm shadow-sm'
                  )}
                >
                  <FileText className={cn('h-8 w-8 mr-3 flex-shrink-0', theme === 'dark' ? 'text-blue-300' : 'text-blue-600')} />
                  <div>
                    <h3 className={cn('font-semibold text-base', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Currículum Técnico
                    </h3>
                    <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-blue-200/80' : 'text-gray-600')}>
                      Registros detallados de habilidades y certificaciones técnicas
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className={cn('flex items-start p-4 rounded-lg', theme === 'dark'
                    ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm shadow-sm'
                  )}
                >
                  <ClipboardList className={cn('h-8 w-8 mr-3 flex-shrink-0', theme === 'dark' ? 'text-purple-300' : 'text-purple-600')} />
                  <div>
                    <h3 className={cn('font-semibold text-base', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Informes de Mantenimiento
                    </h3>
                    <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-purple-200/80' : 'text-gray-600')}>
                      Documentación completa de servicios y reparaciones
                    </p>
                  </div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap justify-center md:justify-start gap-4"
              >
                <Link
                  to="/form/curriculum"
                  className={cn('group flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300', theme === 'dark'
                    ? 'bg-white text-blue-900 hover:bg-blue-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  <span>Ver Documentos</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>

                <Link
                  to="/form"
                  className={cn('group flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300', theme === 'dark'
                    ? 'bg-transparent border-2 border-white text-white hover:bg-white/10'
                    : 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                  )}
                >
                  <span>Explorar Formularios</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="hidden lg:block relative"
            >
              <div className={cn('absolute inset-0 rounded-xl blur-sm -m-2', theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200/50')}></div>
              <img
                src="https://cdn3d.iconscout.com/3d/premium/thumb/report-5391551-4741092.png"
                className="relative h-64 w-64 object-contain"
                alt="Documentación Técnica"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTASection