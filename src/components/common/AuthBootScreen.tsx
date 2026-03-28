import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const FADE_MS = 300

type AuthBootScreenProps = {
  className?: string
  /** Si true, anima opacidad a 0 y llama onFadeComplete al terminar */
  exiting?: boolean
  onFadeComplete?: () => void
}

/** Bienvenida inicial (~3s), solo presentación; sin validación ni lecturas en esta capa. */
export function AuthBootScreen({
  className,
  exiting = false,
  onFadeComplete
}: AuthBootScreenProps) {
  const completedRef = useRef(false)

  useEffect(() => {
    if (!exiting) return
    const id = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onFadeComplete?.()
    }, FADE_MS + 100)
    return () => window.clearTimeout(id)
  }, [exiting, onFadeComplete])

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'opacity' || !exiting || completedRef.current) return
    completedRef.current = true
    onFadeComplete?.()
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden',
        'bg-[#05070d]',
        'transition-opacity duration-300 ease-out motion-reduce:transition-none',
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      onTransitionEnd={handleTransitionEnd}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 18%, rgba(37, 99, 235, 0.28), transparent 55%), radial-gradient(ellipse 55% 35% at 85% 75%, rgba(6, 182, 212, 0.14), transparent 50%)'
        }}
      />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-4 px-6 text-center sm:gap-6">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-cyan-500/20 blur-xl" />
          <img
            src="/pwa-192x192.png"
            alt=""
            width={112}
            height={112}
            className="relative h-24 w-24 rounded-2xl object-contain shadow-lg ring-1 ring-white/10 sm:h-28 sm:w-28"
            decoding="async"
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            <span className="text-white">Bienvenido a </span>
            <span className="text-cyan-400">Supérate.IA</span>
          </h1>
          <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
            Aplicación oficial de la Secretaría De Educación para el mejoramiento académico.
          </p>
          <p className="text-xs text-zinc-500 sm:text-sm">Preparando la experiencia…</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
        </div>
      </div>
    </div>
  )
}
