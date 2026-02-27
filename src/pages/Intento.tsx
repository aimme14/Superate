import { useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, Calculator, Play, RotateCcw, Sparkles, BookMarked, Leaf, BookCheck, Atom, Microscope, FlaskConical, Trophy } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Link, useNavigate } from "react-router-dom"
import { useRole } from "@/hooks/core/useRole"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import SubjectPhaseStatus from "@/components/quiz/SubjectPhaseStatus"
import { PhaseType } from "@/interfaces/phase.interface"
import { useAuthContext } from "@/context/AuthContext"
import { usePhaseStatusForSubjects } from "@/hooks/query/usePhaseStatusForSubjects"

// Componente de tarjeta giratoria mejorado
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
  theme = 'light',
  subject,
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
  theme?: 'light' | 'dark'
  subject?: string
}) {
  const navigate = useNavigate()

  const handlePhaseSelect = (phase: PhaseType) => {
    if (subject) {
      const newLink = `/quiz?subject=${encodeURIComponent(subject)}&phase=${phase}`
      navigate(newLink)
    } else {
      // Fallback al link original si no hay subject
      navigate(link)
    }
  }
  
  const colorClasses: { [key: string]: { gradient: string; bg: string; hover: string; border: string } } = {
    orange: {
      gradient: "from-orange-500 to-red-500",
      bg: "bg-orange-500",
      hover: "hover:from-orange-600 hover:to-red-600",
      border: "border-orange-200 dark:border-orange-800"
    },
    purple: {
      gradient: "from-purple-500 to-pink-500",
      bg: "bg-purple-500",
      hover: "hover:from-purple-600 hover:to-pink-600",
      border: "border-purple-200 dark:border-purple-800"
    },
    blue: {
      gradient: "from-blue-500 to-cyan-500",
      bg: "bg-blue-500",
      hover: "hover:from-blue-600 hover:to-cyan-600",
      border: "border-blue-200 dark:border-blue-800"
    },
    emerald: {
      gradient: "from-emerald-500 to-teal-500",
      bg: "bg-emerald-500",
      hover: "hover:from-emerald-600 hover:to-teal-600",
      border: "border-emerald-200 dark:border-emerald-800"
    },
    green: {
      gradient: "from-green-500 to-teal-500",
      bg: "bg-green-500",
      hover: "hover:from-green-600 hover:to-teal-600",
      border: "border-green-200 dark:border-green-800"
    },
    pink: {
      gradient: "from-pink-500 to-red-500",
      bg: "bg-pink-500",
      hover: "hover:from-pink-600 hover:to-red-600",
      border: "border-pink-200 dark:border-pink-800"
    },
  };

  const colorConfig = colorClasses[color] || colorClasses.blue;

  return (
    <div className="min-h-[320px] sm:min-h-[340px] perspective-1000">
      <motion.div
        className="relative w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onClick={onFlip}
      >
        {/* Frente de la tarjeta - Mejorado */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rounded-2xl border-2 shadow-lg p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors duration-200",
            theme === 'dark' 
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700 hover:border-zinc-600' 
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-gray-300',
            colorConfig.border
          )}
        >
          {isAI && (
            <div className="absolute top-4 left-4">
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </div>
          )}

          {/* Icono mejorado */}
          <div
            className={cn(
              "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-md",
              colorConfig.gradient
            )}
          >
            <div className="w-7 h-7">
              {icon}
            </div>
          </div>

          <h3 className={cn("text-base sm:text-lg font-bold mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {title}
          </h3>
          <p className={cn("text-xs sm:text-sm mb-4", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            {subtitle}
          </p>

          {/* Indicador de interacción simplificado */}
          <div 
            className={cn(
              "text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors",
              theme === 'dark' 
                ? 'bg-zinc-700/50 text-gray-300 hover:bg-zinc-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="font-medium">Ver más</span>
          </div>
        </div>

        {/* Reverso de la tarjeta - Mejorado */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rounded-2xl border-2 shadow-lg p-6 sm:p-8 flex flex-col justify-between transform rotateY-180 overflow-y-auto",
            theme === 'dark' 
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700' 
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200',
            colorConfig.border
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {title} {subtitle}
              </h4>
              <button
                onClick={onFlip}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'dark' 
                    ? 'hover:bg-zinc-700 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                )}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <p className={cn("text-sm sm:text-base leading-relaxed mb-4", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              {description}
            </p>
          </div>
          
          {subject ? (
            <div onClick={(e) => e.stopPropagation()} className="mt-auto">
              <SubjectPhaseStatus 
                subject={subject} 
                theme={theme}
                onPhaseSelect={handlePhaseSelect}
              />
            </div>
          ) : (
            <Link to={link} onClick={(e) => e.stopPropagation()} className="mt-auto">
              <Button
                className={cn(
                  "w-full bg-gradient-to-r text-white py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-shadow duration-200 text-sm",
                  colorConfig.gradient
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  console.log(`Iniciando prueba: ${title}`)
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                {isAI ? "Generar Plan" : "Presentar Prueba"}
              </Button>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// Componente especial para Ciencias Naturales con 3 botones - Mejorado
function NaturalSciencesCard({
  isFlipped,
  onFlip,
  theme = 'light',
}: {
  isFlipped: boolean
  onFlip: () => void
  theme?: 'light' | 'dark'
}) {
  const navigate = useNavigate()
  
  const subjects = [
    {
      name: "Prueba de Biología",
      subject: "Biologia",
      icon: <Microscope className="w-5 h-5" />,
      link: "/quiz?subject=Biologia&phase=first",
      gradient: "from-green-500 to-emerald-600"
    },
    {
      name: "Prueba de Física",
      subject: "Física", 
      icon: <Atom className="w-5 h-5" />,
      link: "/quiz?subject=Física&phase=first",
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      name: "Prueba de Química",
      subject: "Quimica",
      icon: <FlaskConical className="w-5 h-5" />,
      link: "/quiz?subject=Quimica&phase=first", 
      gradient: "from-pink-500 to-rose-600"
    }
  ]

  const handlePhaseSelect = (subjectName: string, phase: PhaseType) => {
    const newLink = `/quiz?subject=${encodeURIComponent(subjectName)}&phase=${phase}`
    navigate(newLink)
  }

  return (
    <div className="min-h-[320px] sm:min-h-[340px] perspective-1000">
      <motion.div
        className="relative w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        onClick={onFlip}
      >
        {/* Frente de la tarjeta - Mejorado */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rounded-2xl border-2 shadow-lg p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-colors duration-200",
            theme === 'dark' 
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700 hover:border-zinc-600' 
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-gray-300'
          )}
        >
          {/* Icono mejorado */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white mb-4 shadow-md">
            <Leaf className="w-7 h-7" />
          </div>

          <h3 className={cn("text-base sm:text-lg font-bold mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Ciencias Naturales
          </h3>
          <p className={cn("text-xs sm:text-sm mb-4", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            y ambientales
          </p>

          {/* Indicador de interacción simplificado */}
          <div 
            className={cn(
              "text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors",
              theme === 'dark' 
                ? 'bg-zinc-700/50 text-gray-300 hover:bg-zinc-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="font-medium">Ver más</span>
          </div>
        </div>

        {/* Reverso de la tarjeta - Mejorado */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full backface-hidden rounded-2xl border-2 shadow-lg p-4 sm:p-6 flex flex-col transform rotateY-180 overflow-y-auto",
            theme === 'dark' 
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700' 
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
          )}
        >
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className={cn("font-bold text-base sm:text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Ciencias Naturales y ambientales
              </h4>
              <button
                onClick={onFlip}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'dark' 
                    ? 'hover:bg-zinc-700 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                )}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 flex-1 justify-center">
              {subjects.map((subjectItem, index) => (
                <div 
                  key={index} 
                  onClick={(e) => e.stopPropagation()} 
                  className="space-y-2"
                >
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    theme === 'dark' ? 'bg-zinc-700/50' : 'bg-gray-100'
                  )}>
                    <div className={cn(
                      "p-2 rounded-lg bg-gradient-to-br text-white",
                      subjectItem.gradient
                    )}>
                      {subjectItem.icon}
                    </div>
                    <span className={cn("text-sm sm:text-base font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {subjectItem.name}
                    </span>
                  </div>
                  <SubjectPhaseStatus 
                    subject={subjectItem.subject} 
                    theme={theme}
                    onPhaseSelect={(phase) => handlePhaseSelect(subjectItem.subject, phase)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Componente principal que usa las tarjetas
export default function InteractiveCards() {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({})
  const { isStudent } = useRole()
  const { theme } = useThemeContext()
  const { user } = useAuthContext()

  const { isPhase3Complete, isLoading: isChecking } = usePhaseStatusForSubjects(
    isStudent ? user?.uid : undefined
  )

  const toggleCard = (cardId: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }))
  }

  // Grid responsive mejorado: 1 columna móvil, 2 tablet, 3 desktop, 5 pantallas grandes
  const gridClasses = isStudent 
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8"

  // Si está cargando, mostrar un estado de carga
  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className={cn(
          "text-center",
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Verificando progreso...</p>
        </div>
      </div>
    )
  }

  // Si fase 3 está completa, mostrar mensaje de felicitaciones
  if (isPhase3Complete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={cn(
            "max-w-4xl w-full text-center p-8 sm:p-12 rounded-3xl shadow-2xl",
            theme === 'dark' 
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-emerald-500/50' 
              : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200'
          )}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            className="mb-6"
          >
            <Trophy className={cn(
              "w-20 h-20 mx-auto",
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            )} />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "text-3xl sm:text-4xl md:text-5xl font-bold mb-6",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}
          >
            FELICITACIONES
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              "text-xl sm:text-2xl md:text-3xl font-semibold",
              theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'
            )}
          >
            EL FUTURO ESTÁ EN TUS MANOS
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <p className={cn(
              "text-base sm:text-lg",
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            )}>
              Has completado exitosamente todas las fases evaluativas.
            </p>
            <p className={cn(
              "text-base sm:text-lg mt-2",
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            )}>
              ¡Sigue adelante, esfuerzate y alcanza tus metas!
            </p>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={gridClasses}>
      {/* Lectura Crítica */}
      <FlipCard
        title="Lectura"
        subtitle="Crítica"
        icon={<BookOpen className="w-7 h-7" />}
        description="" //aquí va lo que va en la reversa de la tarjeta de lectura crítica
        color="purple"
        isFlipped={flippedCards.reading}
        onFlip={() => toggleCard("reading")}
        link="/quiz?subject=Lenguaje&phase=first"
        theme={theme}
        subject="Lenguaje"
      />

      {/* Matemáticas */}
      <FlipCard
        title="Matemáticas"
        subtitle="y razonamiento"
        icon={<Calculator className="w-4 h-4" />}
        description="" //aquí va lo que va en la reversa de la tarjeta de matemáticas
        color="blue"
        isFlipped={flippedCards.math}
        onFlip={() => toggleCard("math")}
        link="/quiz/quiz"
        theme={theme}
        subject="Matemáticas"
      />

      {/* Ciencias Sociales */}
      <FlipCard
        title="Ciencias Sociales"
        subtitle="y ciudadana"
        icon={<BookMarked className="w-7 h-7" />}
        description="" //aquí va lo que va en la reversa de la tarjeta de ciencias sociales
        color="green"
        isFlipped={flippedCards.social}
        onFlip={() => toggleCard("social")}
        link="/quiz?subject=Ciencias Sociales&phase=first"
        theme={theme}
        subject="Ciencias Sociales"
      />

      {/* Ciencias Naturales - Componente especial */}
      <NaturalSciencesCard
        isFlipped={flippedCards.natural}
        onFlip={() => toggleCard("natural")}
        theme={theme}
      />

      {/* Inglés */}
      <FlipCard
        title="Inglés"
        subtitle="e idiomas "
        icon={<BookCheck className="w-7 h-7" />}
        description="" //aquí va lo que va en la reversa de la tarjeta de inglés
        color="emerald"
        isFlipped={flippedCards.english}
        onFlip={() => toggleCard("english")}
        link="/quiz?subject=Inglés&phase=first"
        theme={theme}
        subject="Inglés"
      />
    </div>
  )
}