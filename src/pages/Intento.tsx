import { useState } from "react"
import { motion } from "framer-motion"
import { Target, BookOpen, Calculator, Play, RotateCcw, Sparkles, BookMarked, Leaf, BookCheck } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

// Componente de tarjeta giratoria
function FlipCard({
  title,
  link,
  subtitle,
  icon,
  description,
  color,
  isFlipped,
  onFlip,
  isAI = false,
}: {
  title: string
  link: string
  subtitle: string
  icon: React.ReactNode
  description: string
  color: string
  isFlipped: boolean
  onFlip: () => void
  isAI?: boolean
}) {
  const colorClasses: { [key: string]: string } = {
    orange: "from-orange-500 to-red-500 bg-orange-500",
    purple: "from-purple-500 to-pink-500 bg-purple-500",
    blue: "from-blue-500 to-cyan-500 bg-blue-500",
    emerald: "from-emerald-500 to-teal-500 bg-emerald-500",
    green: "from-green-500 to-teal-500 bg-green-500",
    pink: "from-pink-500 to-red-500 bg-pink-500",
  };

  return (
    <motion.div className="h-64 perspective-1000" whileHover={{ scale: 1.02 }}>
      <motion.div
        className="relative w-full h-full transition-transform duration-700 transform-style-preserve-3d cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onClick={onFlip}
      >
        {/* Frente de la tarjeta */}
        <div
          className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl ${colorClasses[color].split(" ")[1]} border border-white/50 shadow-lg p-6 flex flex-col items-center justify-center text-center`}
        >
          {isAI && (
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute top-4 right-4"
            >
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </motion.div>
          )}

          <div
            className={`w-12 h-12 rounded-xl ${colorClasses[color].split(" ")[0].replace("from-", "bg-")} flex items-center justify-center text-white mb-4 shadow-lg`}
          >
            {icon}
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600 mb-4">{subtitle}</p>

          <div className="text-xs text-gray-500 flex items-center">
            <RotateCcw className="w-3 h-3 mr-1" />
            Clic para ver más
          </div>
        </div>

        {/* Reverso de la tarjeta */}
        <div
          className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-white border border-gray-200 shadow-lg p-6 flex flex-col justify-between transform rotateY-180`}
        >
          <div>
            <h4 className="font-bold text-gray-900 mb-3">
              {title} {subtitle}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{description}</p>
          </div>
          <Link to={link}>
          <Button
            className={`w-full bg-gradient-to-r ${colorClasses[color].split(" ")[0]} text-white py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-300`}
            onClick={(e) => {
              e.stopPropagation()
              // Aquí iría la lógica para iniciar la prueba
              console.log(`Iniciando prueba: ${title}`)
            }}
          >
            <Play className="w-4 h-4 mr-2" />
            {isAI ? "Generar Plan" : "Presentar Prueba"}
          </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Componente principal que usa las tarjetas
export default function InteractiveCards() {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({})

  const toggleCard = (cardId: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-8">
      {/* Objetivos de la prueba */}
      <FlipCard
        title="Objetivos"
        subtitle="de la prueba"
        icon={<Target className="w-6 h-6" />}
        description="Conoce los objetivos específicos y competencias evaluadas en el examen Saber 11°."
        color="orange"
        isFlipped={flippedCards.objectives}
        onFlip={() => toggleCard("objectives")}
        link="/objetivos"
      />

      {/* Lectura Crítica */}
      <FlipCard
        title="Lectura"
        subtitle="Crítica"
        icon={<BookOpen className="w-6 h-6" />}
        description="Desarrolla tu capacidad de análisis y comprensión textual con ejercicios especializados."
        color="purple"
        isFlipped={flippedCards.reading}
        onFlip={() => toggleCard("reading")}
        link="/quiz/lectura"
      />

      {/* Matemáticas */}
      <FlipCard
        title="Matemáticas"
        subtitle="y razonamiento"
        icon={<Calculator className="w-6 h-6" />}
        description="Fortalece tu razonamiento lógico y habilidades numéricas con problemas adaptativos."
        color="blue"
        isFlipped={flippedCards.math}
        onFlip={() => toggleCard("math")}
        link="/quiz/quiz"
      />

      {/* Ciencias Sociales */}
      <FlipCard
        title="Ciencias Sociales"
        subtitle="y ciudadana"
        icon={<BookMarked className="w-6 h-6" />}
        description="Fortalece tu razonamiento lógico y habilidades numéricas con problemas adaptativos."
        color="green"
        isFlipped={flippedCards.social}
        onFlip={() => toggleCard("social")}
        link="/quiz/sociales"
      />

      {/* Ciencias Naturales */}
      <FlipCard
        title="Ciencias Naturales"
        subtitle="y ambientales"
        icon={<Leaf className="w-6 h-6" />}
        description="Fortalece tu razonamiento lógico y habilidades numéricas con problemas adaptativos."
        color="pink"
        isFlipped={flippedCards.natural}
        onFlip={() => toggleCard("natural")}
        link="/quiz/naturales"
      />

      {/* Inglés */}
      <FlipCard
        title="Inglés"
        subtitle=" "
        icon={<BookCheck className="w-6 h-6" />}
        description="Fortalece tu razonamiento lógico y habilidades numéricas con problemas adaptativos."
        color="emerald"
        isFlipped={flippedCards.english}
        onFlip={() => toggleCard("english")}
        link="/quiz/ingles"
      />
    </div>
  )
}