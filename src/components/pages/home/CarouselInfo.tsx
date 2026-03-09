import { ThemeContextProps } from '@/interfaces/context.interface'
import Carousel from '#/common/elements/Carousel'
import { cn } from '@/lib/utils'

interface Info {
  image: string
  title: string
  description: string
}

interface CarouselInfoProps extends ThemeContextProps {
  informations?: Info[]
  isLoading: boolean
  error: Error | null
}

const CarouselInfo = ({ informations, isLoading, error, theme }: CarouselInfoProps) => {
  if (isLoading) return <div>Cargando...</div>
  if (error) return <div className="text-center text-red-500">Error al cargar el carousel</div>
  if (!informations?.length || informations.length === 0) return <div>No hay información</div>

  return (
    <div className="flex justify-center w-full px-2 sm:px-4 py-4 touch-pan-y">
      <div className="w-full max-w-6xl overflow-hidden">
        <Carousel
          autoplay
          items={informations}
          className_Item="flex-shrink-0 w-full"
          render={(item) => ItemInfo({ theme, ...item })}
        />
      </div>
    </div>
  )
}

export default CarouselInfo
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface ItemInfoProps extends ThemeContextProps {
  image: string
  title: string
  description: string
}

const ItemInfo = ({ image, title, description, theme }: ItemInfoProps) => {
  return (
    <div className="relative w-full min-h-[240px] h-[38vh] max-h-[320px] sm:h-[350px] md:h-[450px] lg:h-[500px]">
      <img src={image} alt={title} className="w-full h-full object-cover" />
      <div
        className={cn(
          'p-4 sm:p-6 md:p-8 absolute inset-0 text-white bg-black',
          'flex flex-col justify-center items-center text-center',
          theme === 'dark'
            ? 'bg-opacity-50'
            : 'bg-opacity-25'
        )}
      >
        <h1 className={cn(
          'text-2xl sm:text-4xl md:text-6xl font-bold mb-2 sm:mb-4 px-1',
          theme === 'dark'
            ? 'text-gray-200'
            : 'text-white'
        )}>{title}</h1>

        <p className={cn(
          'text-sm sm:text-lg md:text-xl max-w-2xl mx-auto px-1 line-clamp-2 sm:line-clamp-none',
          theme === 'dark'
            ? 'text-gray-200'
            : 'text-white'
        )}>{description}</p>
      </div>
    </div >
  )
}