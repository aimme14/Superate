import { useNavigate, useLocation } from "react-router-dom"
import { toPlural } from '@/utils/format'
import { useState } from "react"
import { cn } from '@/lib/utils'

/*--------------------------------------------------use tab local--------------------------------------------------*/
interface UseTabsProps { id?: string; to: string, startOn?: string }

/**
 * Hook para manejar las secciones "tabs"
 * @param {string} useTabsProps.to - Ruta base, corresponde al contexto de la solicitud
 * @param {string} useTabsProps.id - ID para construir la ruta del elemento a actualizar o parámetros de consulta codificados
 * @param {string} useTabsProps.startOn - Valor inicial para el tab
 * @example
 * if(value === 'table') '/location/countries';
 * if(value === 'form' && !id) '/location/country';
 * if(value === 'form' && id) '/location/country/123';
 * if(value === 'form' && id is query) '/location/country/%7B%22param%22%3A%22value%22%7D';
 */
export const useTabs = ({ id, to, startOn }: UseTabsProps) => {
  const isQuery = id ? id.startsWith('%7B') || id.startsWith('{') : false
  const [tab, setTab] = useState(id && !isQuery ? 'form' : startOn || 'table')
  const navigate = useNavigate()
  const plural = toPlural(to)

  const handle = (value: string) => {
    const filter = isQuery ? `?filter=${id}` : ''
    if (value === 'table') navigate(`${plural}${filter}`)
    if (value === 'form') navigate(`${to}${id ? `/${id}` : ''}`)
    setTab(value)
  }
  return { tab, isQuery, handle }
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------use tab navigator--------------------------------------------------*/
interface UseTabNavigatorProps {
  defaultStyles?: string
  activeStyles?: string
}

/**
 * Hook personalizado para manejar la navegación y estilos de tabs basados en rutas
 * @param defaultStyles - Estilos base para los tabs
 * @param activeStyles - Estilos aplicados cuando el tab está activo
 * @returns Objeto con funciones para manejar los tabs
 * 
 * @example
 * ```tsx
 * const { getTabClassName, handleTabClick, isTabActive } = useTabRoutes({
 *   defaultStyles: 'px-4',
 *   activeStyles: 'bg-white'
 * })
 * ```
 */
export const useTabNavigator = ({
  defaultStyles = 'px-8 hover:bg-accent/50 transition-colors duration-200',
  activeStyles = 'bg-white text-black shadow-sm'
}: UseTabNavigatorProps) => {
  const location = useLocation()
  const navigate = useNavigate()

  /** Verifica si alguna de las rutas coincide con la ubicación actual */
  const isActive = (paths: string[]) => paths.some(path => location.pathname.startsWith(path))

  /** Genera las clases CSS para el tab basado en su estado activo */
  const getStateTab = (paths: string[]) => cn(defaultStyles, isActive(paths) && activeStyles)

  /** Maneja la navegación al hacer click en un tab */
  const handleTab = (path: string) => navigate(path)

  return { isActive, handleTab, getStateTab }
}