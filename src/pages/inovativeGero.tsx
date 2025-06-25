import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Target, Zap, TrendingUp, Star, Lightbulb, Rocket, Award, Sparkles } from "lucide-react"

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

  useEffect(() => {
    setIsVisible(true)
    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % motivationalPhrases.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-[80vh] bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 overflow-hidden">
      {/* Fondo animado con partículas */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.1),transparent_50%)]" />
      </div>

      {/* Iconos flotantes animados */}
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 flex items-center min-h-[80vh]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          {/* Contenido principal */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Título principal con efecto gradiente */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center space-x-2 text-emerald-600 font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                <span>Potenciado por Inteligencia Artificial</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-6xl lg:text-7xl font-bold leading-tight"
              >
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Desafía
                </span>
                <br />
                <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
                  tus límites
                </span>
              </motion.h1>

              {/* Frase motivacional rotativa */}
              <div className="h-8 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentPhrase}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-xl text-gray-600 font-medium"
                  >
                    {motivationalPhrases[currentPhrase]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Descripción mejorada */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="space-y-4"
            >
              <p className="text-lg text-gray-700 leading-relaxed">
                Nuestra <span className="font-semibold text-emerald-600">inteligencia artificial avanzada</span> analiza
                tu rendimiento en tiempo real, identifica patrones únicos de aprendizaje y crea un
                <span className="font-semibold text-purple-600"> plan personalizado</span> que se adapta a ti.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Análisis en tiempo real</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Retroalimentación inteligente</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Rutas de aprendizaje adaptativas</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Progreso medible</span>
                </div>
              </div>
            </motion.div>

            {/* Botones de acción */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
            </motion.div>
          </motion.div>

          {/* Visualización interactiva */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="relative w-full max-w-lg mx-auto">
              {/* Círculo principal animado */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="relative w-80 h-80 mx-auto"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 opacity-20"></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 opacity-20"></div>
                <div className="absolute inset-8 rounded-full bg-white shadow-2xl flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    className="text-center"
                  >
                    <Brain className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-gray-800">IA</div>
                    <div className="text-sm text-gray-600">Personalizada</div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Elementos orbitales */}
              {[
                { icon: Target, label: "Objetivos", angle: 0, color: "bg-blue-500" },
                { icon: TrendingUp, label: "Progreso", angle: 72, color: "bg-green-500" },
                { icon: Award, label: "Logros", angle: 144, color: "bg-yellow-500" },
                { icon: Zap, label: "Fortalezas", angle: 216, color: "bg-purple-500" },
                { icon: Lightbulb, label: "Insights", angle: 288, color: "bg-pink-500" },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  className="absolute w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center"
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
                  <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Estadísticas flotantes */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 1 }}
              className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-4 border border-emerald-100"
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">98%</div>
                <div className="text-xs text-gray-600">Precisión IA</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isVisible ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 border border-purple-100"
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">+45%</div>
                <div className="text-xs text-gray-600">Mejora promedio</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Indicador de scroll */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className="w-6 h-10 border-2 border-emerald-400 rounded-full flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="w-1 h-3 bg-emerald-400 rounded-full mt-2"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}
