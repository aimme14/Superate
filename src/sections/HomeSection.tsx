import { ThemeContextProps } from '@/interfaces/context.interface'
import CarouselInfo from '#/pages/home/CarouselInfo'
import { WhatsAppFab } from '@/components/WhatsAppFab'
import { BrainCircuit, ChartColumnIncreasing, Layers3 } from 'lucide-react'

const HomeSection = ({ theme }: ThemeContextProps) => {
  return (
    <div className="flex flex-col w-full relative">
      <CarouselInfo
        informations={heroItems}
        isLoading={false}
        theme={theme}
        error={null}
      />
      <section className="w-full px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <article
              className={`rounded-xl border p-3 sm:p-4 ${
                theme === 'dark'
                  ? 'bg-zinc-900/70 border-zinc-700 text-zinc-100'
                  : 'bg-white/90 border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`rounded-lg p-1.5 ${theme === 'dark' ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                  <Layers3 className="h-4 w-4 text-purple-500" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold">Ruta de mejora</h3>
              </div>
              <p className={`text-xs sm:text-sm line-clamp-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>
                Un camino diseñado para avanzar y fortalecer tus conocimientos.
              </p>
            </article>

            <article
              className={`rounded-xl border p-3 sm:p-4 ${
                theme === 'dark'
                  ? 'bg-zinc-900/70 border-zinc-700 text-zinc-100'
                  : 'bg-white/90 border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`rounded-lg p-1.5 ${theme === 'dark' ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                  <BrainCircuit className="h-4 w-4 text-cyan-500" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold">IA para aprender mejor</h3>
              </div>
              <p className={`text-xs sm:text-sm line-clamp-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>
                Tu mejor aliado la inteligencia artificial.
              </p>
            </article>

            <article
              className={`rounded-xl border p-3 sm:p-4 ${
                theme === 'dark'
                  ? 'bg-zinc-900/70 border-zinc-700 text-zinc-100'
                  : 'bg-white/90 border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`rounded-lg p-1.5 ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                  <ChartColumnIncreasing className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold">Resultados y progreso</h3>
              </div>
              <p className={`text-xs sm:text-sm line-clamp-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>
                Visualiza tu meta y enfócate en mejorar continuamente.
              </p>
            </article>
          </div>
        </div>
      </section>
      <WhatsAppFab />
    </div>
  )
}

export default HomeSection
/*---------------------------------------------------------------------------------------------------------*/

export const heroItems = [
  {
    image: 'assets/adds/flexible.jpeg',
    title: 'Bienvenido a Superate.IA',
    description: 'Tu aliado en el camino hacia el éxito académico',
  },
  {
    image: 'assets/adds/gestion.png',
    title: 'Fortalece tus habilidades',
    description: 'Descrubre tus valencias y haste mas fuerte',
  },
  {
    image: 'assets/adds/inteligencia.jpg',
    title: 'IA tegnology',
    description: 'Usando la inteligencia artifical como apoyo',
  }
]