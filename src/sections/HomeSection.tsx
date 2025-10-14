import { ThemeContextProps } from '@/interfaces/context.interface'
import CarouselInfo from '#/pages/home/CarouselInfo'

const HomeSection = ({ theme }: ThemeContextProps) => {
  return (
    <>
      <CarouselInfo
        informations={heroItems}
        isLoading={false}
        theme={theme}
        error={null}
      />

    </>
  )
}

export default HomeSection
/*---------------------------------------------------------------------------------------------------------*/

export const heroItems = [
  {
    image: 'assets/adds/flexible.jpeg',
    title: 'Bienvenido a Superate.IA',
    description: 'Donde avaluaremos el rendimiento academico de cada estudiante',
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