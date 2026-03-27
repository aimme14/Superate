import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Target, Zap, TrendingUp, Star, Lightbulb, Rocket, Award, Sparkles } from "lucide-react"
import { useThemeContext } from "@/context/ThemeContext"
import { useIsMobile } from "@/hooks/ui/use-mobile"
import { cn } from "@/lib/utils"

const motivationalPhrases = [
  "Tu potencial es ilimitado",
  "Cada error es un paso hacia el éxito",
  "La IA te guía, tú conquistas",
  "Transforma tus debilidades en fortalezas",
  "El futuro se construye hoy",
]

const floatingIcons = [
  { icon: Brain, color: "text-purple-400", delay: 0 },
  { icon: Lightbulb, color: "text-yellow-400", delay: 0.5 },
  { icon: Target, color: "text-blue-400", delay: 1 },
  { icon: Star, color: "text-pink-400", delay: 1.5 },
  { icon: Rocket, color: "text-green-400", delay: 2 },
]

export default function InnovativeHero() {
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const { theme } = useThemeContext()
  const isMobile = useIsMobile()
  const displayedPhrase = motivationalPhrases[currentPhrase]

  useEffect(() => {
    setIsVisible(true)

    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % motivationalPhrases.length)
    }, isMobile ? 5000 : 3000)

    return () => clearInterval(interval)
  }, [isMobile])

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        isMobile ? "min-h-0" : "min-h-[70vh] sm:min-h-[80vh]",
        theme === "dark" ? "bg-zinc-900" : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50"
      )}
    >
      {/* Fondo animado con partículas */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.1),transparent_50%)]" />
      </div>

      {/* Iconos flotantes: solo en md+ para no cargar el hilo en móvil */}
      {!isMobile && (
        <div className="absolute inset-0 pointer-events-none">
          {floatingIcons.map((item, index) => (
            <motion.div
              key={index}
              className={`absolute ${item.color}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: [0, Math.random() * 100 - 50],
                y: [0, Math.random() * 100 - 50],
              }}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                delay: item.delay,
                ease: "easeInOut",
              }}
              style={{
                left: `${Math.random() * 80 + 10}%`,
                top: `${Math.random() * 80 + 10}%`,
              }}
            >
              <item.icon className="w-8 h-8" />
            </motion.div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative z-10 max-w-7xl mx-auto px-4 sm:px-6 sm:py-16 flex",
          isMobile ? "min-h-0 items-start py-6" : "items-center min-h-[70vh] py-10"
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 sm:gap-12 items-center w-full">
          {/* Contenido principal */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-5 sm:space-y-8"
          >
            {/* Título principal con efecto gradiente */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={cn("flex items-center space-x-2 font-semibold", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}
              >
                <Sparkles className="w-5 h-5" />
                <span>Potenciado por Inteligencia Artificial</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={cn(
                  "font-bold leading-tight",
                  /* Vista móvil (max-md): una sola fila; tamaño fluido para el ancho */
                  "max-md:whitespace-nowrap max-md:text-[clamp(1.6875rem,6.15vw,2.475rem)]",
                  "md:text-6xl lg:text-7xl"
                )}
              >
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Desafía
                </span>
                {/* Espacio solo en móvil (misma línea); en md+ salto de línea sin sangría */}
                <span className="max-md:inline md:hidden"> </span>
                <br className="hidden md:block" aria-hidden="true" />
                <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
                  tus límites
                </span>
              </motion.h1>

              {/* Frase motivacional rotativa */}
              <div className="h-6 sm:h-8 flex items-center">
                {isMobile ? (
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentPhrase}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        "text-[0.68rem] leading-snug sm:text-xl font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      )}
                    >
                      {displayedPhrase}
                    </motion.p>
                  </AnimatePresence>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentPhrase}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className={cn(
                        "text-[0.68rem] leading-snug sm:text-xl font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      )}
                    >
                      {displayedPhrase}
                    </motion.p>
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Descripción mejorada */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="space-y-3 sm:space-y-4"
            >
              <p className={cn("text-base sm:text-lg leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Nuestra <span className={cn("font-semibold", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>inteligencia artificial avanzada</span> analiza
                cuales son tus fortalezas y debilidades con el objetico de crear un <span className={cn("font-semibold", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>plan personalizado</span> potenciando tus conocimientos al maximo.
              </p>

              <div className="hidden md:grid grid-cols-2 gap-3 pt-3 sm:gap-4 sm:pt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Análisis de tus conocimientos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Retroalimentación inteligente</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Rutas de aprendizaje basadas en tus necesidades</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Progreso garantizado</span>
                </div>
              </div>
            </motion.div>

            {/* Botones de acción */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-3 pt-3 sm:gap-4 sm:pt-4"
            >
            </motion.div>
          </motion.div>

          {/* Visualización interactiva */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative max-md:-mt-4"
          >
            <div className="relative w-full max-w-lg mx-auto">
              {isMobile && (
                <>
                  <div
                    className={cn(
                      "absolute left-2 top-1 z-10 max-w-[110px] rounded-lg px-2 py-1.5 text-[10px] leading-tight",
                      theme === "dark" ? "bg-zinc-900/70 text-zinc-200" : "bg-white/90 text-gray-700 border border-gray-200"
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      Análisis de tus conocimientos
                    </span>
                  </div>
                  <div
                    className={cn(
                      "absolute right-2 top-1 z-10 max-w-[110px] rounded-lg px-2 py-1.5 text-[10px] leading-tight text-right",
                      theme === "dark" ? "bg-zinc-900/70 text-zinc-200" : "bg-white/90 text-gray-700 border border-gray-200"
                    )}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                      Retroalimentación inteligente
                    </span>
                  </div>
                  <div
                    className={cn(
                      "absolute bottom-1 left-2 z-10 max-w-[110px] rounded-lg px-2 py-1.5 text-[10px] leading-tight",
                      theme === "dark" ? "bg-zinc-900/70 text-zinc-200" : "bg-white/90 text-gray-700 border border-gray-200"
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      Rutas de aprendizaje
                    </span>
                  </div>
                  <div
                    className={cn(
                      "absolute bottom-1 right-2 z-10 max-w-[110px] rounded-lg px-2 py-1.5 text-[10px] leading-tight text-right",
                      theme === "dark" ? "bg-zinc-900/70 text-zinc-200" : "bg-white/90 text-gray-700 border border-gray-200"
                    )}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-pink-500 shrink-0" />
                      Progreso garantizado
                    </span>
                  </div>
                </>
              )}

              {/* Círculo principal: en móvil sin rotación para reducir lag */}
              <motion.div
                animate={isMobile ? { rotate: 0 } : { rotate: 360 }}
                transition={
                  isMobile
                    ? { duration: 0 }
                    : { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }
                }
                className="relative w-44 h-44 sm:w-80 sm:h-80 mx-auto"
              >
                <div className={cn("absolute inset-0 rounded-full", isMobile ? "bg-gradient-to-r from-emerald-400/25 via-teal-400/25 to-cyan-400/25" : "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-20")}></div>
                <div className={cn("absolute rounded-full", isMobile ? "inset-2.5 bg-gradient-to-r from-purple-400/20 via-pink-400/20 to-red-400/20" : "inset-4 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 opacity-20")}></div>
                <div className={cn("absolute shadow-2xl flex items-center justify-center", isMobile ? "inset-7 rounded-[999px] border" : "inset-8 rounded-full", theme === 'dark' ? 'bg-zinc-800 border-zinc-700/70' : 'bg-white border-gray-200')}>
                  {isMobile ? (
                    <div className="text-center">
                      <Brain className={cn("w-10 h-10 mx-auto mb-2", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
                      <div className={cn("text-[1.35rem] leading-none font-extrabold tracking-tight", theme === 'dark' ? 'text-white' : 'text-gray-800')}>IA</div>
                      <div className={cn("text-[10px] mt-1 font-semibold tracking-wide uppercase", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Potenciada</div>
                    </div>
                  ) : (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      className="text-center"
                    >
                      <Brain className={cn("w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')} />
                      <div className={cn("text-xl sm:text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-800')}>IA</div>
                      <div className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Potenciada</div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Elementos orbitales */}
              {!isMobile && (
                <>
                  {[
                    { icon: Target, label: "Objetivos", angle: 0, color: "bg-blue-500" },
                    { icon: TrendingUp, label: "Progreso", angle: 72, color: "bg-green-500" },
                    { icon: Award, label: "Logros", angle: 144, color: "bg-yellow-500" },
                    { icon: Zap, label: "Fortalezas", angle: 216, color: "bg-purple-500" },
                    { icon: Lightbulb, label: "Insights", angle: 288, color: "bg-pink-500" },
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      className={cn("absolute w-12 h-12 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center", theme === 'dark' ? 'bg-zinc-800' : 'bg-white')}
                      style={{
                        top: "50%",
                        left: "50%",
                        transformOrigin: "0 0",
                      }}
                      animate={{
                        rotate: [item.angle, item.angle + 360],
                        x: [
                          120 * Math.cos((item.angle * Math.PI) / 180) - 32,
                          120 * Math.cos(((item.angle + 360) * Math.PI) / 180) - 32,
                        ],
                        y: [
                          120 * Math.sin((item.angle * Math.PI) / 180) - 32,
                          120 * Math.sin(((item.angle + 360) * Math.PI) / 180) - 32,
                        ],
                      }}
                      transition={{
                        duration: 15,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                        delay: index * 0.5,
                      }}
                    >
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${item.color} flex items-center justify-center`}>
                        <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </div>

            <div className={cn("space-y-3", isMobile ? "mt-3" : "mt-6")}>
              <div className="flex items-center justify-center gap-2.5 md:gap-3">
                <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:px-4 md:py-2 md:text-sm", theme === 'dark' ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-gray-700 border border-gray-200')}>
                  <Target className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Objetivos
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:px-4 md:py-2 md:text-sm", theme === 'dark' ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-gray-700 border border-gray-200')}>
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Progreso
                </div>
                <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:px-4 md:py-2 md:text-sm", theme === 'dark' ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-gray-700 border border-gray-200')}>
                  <Zap className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  Fortalezas
                </div>
              </div>
              <p className={cn("text-center text-[11px] leading-relaxed md:text-sm", theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                Proyecto impulsado por la Secretaría de Educación.
              </p>
            </div>

            {/* Estadísticas flotantes */}
            {!isMobile && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.6, delay: 1 }}
                  className={cn("absolute -top-3 -right-3 rounded-2xl shadow-xl p-3 border sm:-top-4 sm:-right-4 sm:p-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-emerald-100')}
                >
                  <div className="text-center">
                    <div className={cn("text-xl sm:text-2xl font-bold", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>98%</div>
                    <div className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Precisión IA</div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.6, delay: 1.2 }}
                  className={cn("absolute -left-4 top-[62%] rounded-2xl shadow-xl p-3 border sm:-left-6 sm:p-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-purple-100')}
                >
                  <div className="text-center">
                    <div className={cn("text-1xl font-bold", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>SOLO TU PUEDES</div>
                    <div className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Cambiar tu futuro</div>
                  </div>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
