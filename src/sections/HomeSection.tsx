import { FileText, Calendar, FileSpreadsheet, ShoppingBag } from 'lucide-react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import CarouselInfo from '#/pages/home/CarouselInfo'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const HomeSection = ({ theme }: ThemeContextProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
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

/*--------------------------------------------------tools--------------------------------------------------*/
interface Feature {
  title: string,
  description: string,
  icon: React.ForwardRefExoticComponent<any>
}

const features: Feature[] = [
  { icon: ShoppingBag, title: 'Almacenamiento', description: 'Almacena formatos de manera segura' },
  { icon: FileSpreadsheet, title: 'Presentaciones', description: 'Accede a hojas de vida y entregables para auditorias' },
  { icon: Calendar, title: 'Administración', description: 'Gestiona equipos biomédicos con nuestro sistema de calendarios' },
  { icon: FileText, title: 'Documentación', description: 'Genera informes y accede a ellos de manera flexible' },
]

export const heroItems = [
  {
    image: 'assets/adds/flexible.jpeg',
    title: 'Bienvenido a Superate',
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