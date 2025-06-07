import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion'
import { Badge } from '#/ui/badge'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export interface Stat {
  color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  value: number | string;
  enabled?: boolean;
  icon: LucideIcon;
  title: string;
  href?: string;
}

interface PageHeaderProps {
  // Contenido principal
  badge?: { text: string; dot?: boolean; variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' }
  icon?: LucideIcon | any
  description?: string
  title: string

  // Estadísticas
  stats?: Stat[]

  // Opciones de estilo
  variant?: 'default' | 'gradient' | 'subtle' | 'transparent'
  size?: 'sm' | 'default' | 'lg'
  className?: string

  // Animaciones
  animate?: boolean
  sparkles?: boolean
  progressBar?: boolean
}

export function PageHeader({
  // Contenido principal
  description,
  icon: Icon,
  title,
  badge,

  // Estadísticas
  stats = [],

  // Opciones de estilo
  variant = 'gradient',
  size = 'default',
  className,

  // Animaciones
  animate = true,
  progressBar = true,
}: PageHeaderProps) {

  // Determinar el layout de las estadísticas
  const statsLayout = useMemo(() => {
    const count = stats.length - stats.filter(s => s.enabled === false).length
    if (count <= 1) return 'grid-cols-1 md:grid-cols-1';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 3) return 'grid-cols-1 md:grid-cols-3';
    if (count <= 4) return 'grid-cols-1 md:grid-cols-4';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }, [stats]);

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden shadow-lg rounded-xl transition-all duration-300",
        headerVariants[variant],
        sizeVariants[size],
        className
      )}
      initial={animate ? { opacity: 0, y: -20 } : false}
      animate={animate ? {
        transition: { duration: 0.4, ease: "easeOut" },
        opacity: 1,
        y: 0,
      } : false}
    >
      {/* Content */}
      <div className="flex flex-col gap-8">
        {/* Title and Description */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {/* Icon */}
            {Icon && (
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                initial={animate ? { rotate: -10, scale: 0.9 } : false}
                animate={animate ? {
                  rotate: [0, -10, 0, 10, 0],
                  scale: [1, 1.10, 1, 1.10, 1],
                  transition: { duration: 5, repeat: Infinity, repeatType: "reverse" }
                } : false}
              >
                <Icon className="h-6 w-6 text-primary" />
              </motion.div>
            )}

            <div className="relative">
              <motion.h1
                className="text-3xl font-bold tracking-tight"
                initial={animate ? { opacity: 0, y: 10 } : false}
                animate={animate ? {
                  transition: { duration: 0.4, delay: 0.2 },
                  opacity: 1,
                  y: 0,
                } : false}
              >
                {title}
              </motion.h1>

              {animate && (
                <motion.div
                  className="absolute -bottom-1 left-0 h-1 rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{
                    width: "40%",
                    transition: { duration: 0.8, delay: 0.4, ease: "easeOut" }
                  }}
                />
              )}
            </div>

            {/* Badge */}
            {badge && (
              <motion.div
                initial={animate ? { opacity: 0, scale: 0.8 } : false}
                animate={animate ? {
                  opacity: 1,
                  scale: 1,
                  transition: { duration: 0.3, delay: 0.5 }
                } : false}
              >
                <Badge
                  className={cn(
                    "ml-2 px-2 py-1 text-xs font-medium",
                    badgeVariants[badge.variant || 'default']
                  )}
                >
                  {badge.dot && (
                    <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
                  )}
                  {badge.text}
                </Badge>
              </motion.div>
            )}
          </div>

          {/* Descripción */}
          {description && (
            <motion.div
              className="mt-4 max-w-2xl"
              initial={animate ? { opacity: 0, y: 10 } : false}
              animate={animate ? { y: 0, opacity: 1, transition: { duration: 0.4, delay: 0.3 } } : false}
            >
              <p className="text-muted-foreground text-md leading-relaxed">
                {description}
              </p>
            </motion.div>
          )}
        </div>

        {/* targets stats */}
        {stats.length > 0 && (
          <motion.div
            className={cn("grid gap-4", statsLayout)}
            initial={animate ? { opacity: 0, x: 20 } : false}
            animate={animate ? { x: 0, opacity: 1, transition: { duration: 0.4, delay: 0.6 } } : false}
          >
            {stats.map((stat, index) => {
              const colors = colorVariants[stat.color || 'default'];
              const enabled = stat.enabled !== false;
              if (!enabled) return null;
              return (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <h3 className={cn("mt-2 text-2xl font-bold", colors.text)}>
                          {stat.value}
                        </h3>
                      </div>
                      <div className={cn("rounded-full p-2", colors.bg)}>
                        <stat.icon className={cn("h-5 w-5", colors.icon)} />
                      </div>
                    </div>

                    {stat.href && (
                      <div className="mt-2">
                        <a
                          href={stat.href}
                          className={cn("inline-flex items-center text-xs font-medium", colors.text)}
                        >
                          Ver detalles
                          <svg
                            className="ml-1 h-3 w-3"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                            />
                          </svg>
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* Barra de progreso */}
      {progressBar && animate && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500/80 via-green-500/80 to-orange-500/80"
          initial={{ width: 0 }}
          animate={{
            width: "100%",
            transition: { duration: 3, ease: "easeOut" }
          }}
        />
      )}
    </motion.div>
  )
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
const colorVariants = {
  default: {
    bg: 'bg-muted/40',
    text: 'text-foreground',
    icon: 'text-muted-foreground',
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: 'text-primary',
  },
  secondary: {
    bg: 'bg-secondary/10',
    text: 'text-secondary',
    icon: 'text-secondary',
  },
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    icon: 'text-green-500',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600 dark:text-yellow-400',
    icon: 'text-yellow-500',
  },
  danger: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500',
  }
}

const badgeVariants = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  success: 'bg-green-500/20 text-green-700 dark:text-green-300',
  warning: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  danger: 'bg-red-500/20 text-red-700 dark:text-red-300',
}

const headerVariants = {
  default: 'bg-card',
  subtle: 'bg-muted/40',
  transparent: 'bg-transparent',
  gradient: 'bg-gradient-to-br from-card/80 via-card to-card/80',
}

const sizeVariants = {
  sm: 'px-4 py-3',
  lg: 'px-8 py-8',
  default: 'px-6 py-6',
}