import { useAnimatedBackground } from '@/hooks/ui/useAnimatedBackground'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { useThemeContext } from '@/context/ThemeContext'
import { Props } from '@/interfaces/props.interface'
import { animated } from '@react-spring/web'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export const AnimatedBackground = ({ children }: Props) => {
  const { theme } = useThemeContext()
  const { springProps, gradientColors } = useAnimatedBackground({ theme })

  return (
    <animated.div
      style={springProps}
      className={cn(
        'relative min-h-screen flex flex-col',
        'bg-gradient-to-br transition-colors duration-1000',
        'bg-[length:200%_200%]',
        gradientColors.join(' ')
      )}
    >
      {/* Capa de overlay sutil para mayor profundidad */}
      <div className={cn(
        'absolute inset-0 pointer-events-none',
        theme === 'dark' 
          ? 'bg-gradient-to-br from-purple-950/20 via-transparent to-indigo-950/20' 
          : 'bg-gradient-to-br from-purple-100/30 via-transparent to-pink-100/30'
      )} />
      <AnimatedParticles theme={theme} />
      {children}
    </animated.div>
  )
}

// Función para generar posiciones determinísticas basadas en el índice
const getParticlePosition = (index: number, total: number) => {
  const angle = (index / total) * Math.PI * 2
  const radius = 30 + (index % 3) * 20
  const x = 50 + Math.cos(angle) * radius
  const y = 50 + Math.sin(angle) * radius
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
}

const AnimatedParticles = ({ theme }: ThemeContextProps) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Partículas grandes con movimiento suave */}
      {[...Array(30)].map((_, i) => {
        const pos = getParticlePosition(i, 30)
        return (
          <motion.div
            key={`large-${i}`}
            custom={i}
            className={cn(
              'absolute rounded-full blur-sm',
              theme === 'dark' 
                ? 'bg-purple-500/20 w-32 h-32' 
                : 'bg-purple-300/30 w-24 h-24'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
            variants={largeParticleVariants}
            initial="hidden"
            animate="visible"
          />
        )
      })}
      {/* Partículas medianas */}
      {[...Array(40)].map((_, i) => {
        const pos = getParticlePosition(i + 30, 40)
        return (
          <motion.div
            key={`medium-${i}`}
            custom={i}
            className={cn(
              'absolute rounded-full',
              theme === 'dark' 
                ? 'bg-purple-400/30 w-3 h-3' 
                : 'bg-purple-400/40 w-2.5 h-2.5'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
            variants={particleVariants}
            initial="hidden"
            animate="visible"
          />
        )
      })}
      {/* Partículas pequeñas brillantes */}
      {[...Array(60)].map((_, i) => {
        const pos = getParticlePosition(i + 70, 60)
        return (
          <motion.div
            key={`small-${i}`}
            custom={i}
            className={cn(
              'absolute rounded-full',
              theme === 'dark' 
                ? 'bg-indigo-300/40 w-1.5 h-1.5' 
                : 'bg-indigo-400/50 w-1 h-1'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
            variants={smallParticleVariants}
            initial="hidden"
            animate="visible"
          />
        )
      })}
    </div>
  )
}

// Variants for the particles - mejorados con movimientos más sofisticados
const largeParticleVariants = {
  hidden: { opacity: 0, scale: 0, x: 0, y: 0 },
  visible: (i: number) => ({
    opacity: [0.2, 0.4, 0.2],
    scale: [1, 1.2, 1],
    x: [0, Math.sin(i) * 50, 0],
    y: [0, Math.cos(i) * 50, 0],
    transition: {
      delay: i * 0.15,
      duration: 8 + (i % 3) * 2,
      repeat: Infinity,
      ease: "easeInOut",
    }
  })
}

const particleVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i: number) => ({
    opacity: [0, 1, 0.5, 1, 0],
    scale: [0, 1, 1.1, 1, 0],
    transition: {
      delay: i * 0.08,
      duration: 4 + (i % 2),
      repeat: Infinity,
      ease: "easeInOut",
    }
  })
}

const smallParticleVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i: number) => ({
    opacity: [0, 0.8, 0.4, 0.8, 0],
    scale: [0, 1, 1.2, 1, 0],
    transition: {
      delay: i * 0.05,
      duration: 3 + (i % 2) * 0.5,
      repeat: Infinity,
      ease: "easeInOut",
    }
  })
}