import { ThemeContextProps } from '@/interfaces/context.interface'
import { useThemeContext } from '@/context/ThemeContext'
import { Props } from '@/interfaces/props.interface'
import { cn } from '@/lib/utils'

export const AnimatedBackground = ({ children }: Props) => {
  const { theme } = useThemeContext()
  const gradientColors = theme === 'dark'
    ? ['from-slate-950', 'via-purple-950/80', 'via-indigo-950/80', 'to-slate-950']
    : ['from-slate-50', 'via-purple-50/90', 'via-indigo-50/90', 'to-pink-50']

  return (
    <div
      className={cn(
        'relative min-h-screen flex flex-col',
        'bg-gradient-to-br transition-colors duration-1000',
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
      <StaticParticles theme={theme} />
      {children}
    </div>
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

const StaticParticles = ({ theme }: ThemeContextProps) => {
  const counts = { large: 8, medium: 10, small: 14 }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Partículas estáticas ligeras para mantener estética sin costo de animación. */}
      {[...Array(counts.large)].map((_, i) => {
        const pos = getParticlePosition(i, counts.large)
        return (
          <div
            key={`large-${i}`}
            className={cn(
              'absolute rounded-full',
              theme === 'dark' 
                ? 'bg-purple-500/12 w-28 h-28'
                : 'bg-purple-300/20 w-20 h-20'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          />
        )
      })}
      {[...Array(counts.medium)].map((_, i) => {
        const pos = getParticlePosition(i + counts.large, counts.medium)
        return (
          <div
            key={`medium-${i}`}
            className={cn(
              'absolute rounded-full',
              theme === 'dark' 
                ? 'bg-purple-400/20 w-3 h-3'
                : 'bg-purple-400/25 w-2.5 h-2.5'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          />
        )
      })}
      {[...Array(counts.small)].map((_, i) => {
        const pos = getParticlePosition(i + counts.large + counts.medium, counts.small)
        return (
          <div
            key={`small-${i}`}
            className={cn(
              'absolute rounded-full',
              theme === 'dark' 
                ? 'bg-indigo-300/30 w-1.5 h-1.5'
                : 'bg-indigo-400/35 w-1 h-1'
            )}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          />
        )
      })}
    </div>
  )
}