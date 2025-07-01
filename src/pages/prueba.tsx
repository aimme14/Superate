import { motion } from "framer-motion"
import { Brain, Zap, Award, TrendingUp, Lightbulb } from "lucide-react"

export default function Dashboard() {

  return (
    <div>
      <div className="max-w-6xl mx-auto px-8">
        {/* Sección IA Destacada */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden"
        >
          {/* Efectos de fondo */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.05),transparent_50%)]" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Brain className="w-8 h-8" />
                </motion.div>
                <h3 className="text-2xl font-bold">Inteligencia Artificial Avanzada</h3>
              </div>
              <p className="text-lg mb-6 text-emerald-50">
                Nuestro sistema de IA analiza tus respuestas, identifica patrones de aprendizaje y genera planes de
                estudio personalizados que se adaptan a tu ritmo y estilo de aprendizaje.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">Análisis en tiempo real</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Progreso adaptativo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-sm">Recomendaciones inteligentes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4" />
                  <span className="text-sm">Resultados optimizados</span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-4"
              >
                <Brain className="w-16 h-16 mx-auto mb-4" />
                <div className="text-3xl font-bold mb-2">98.5%</div>
                <div className="text-emerald-100">Precisión de análisis</div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
