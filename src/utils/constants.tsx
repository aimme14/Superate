import { TerminalSquare, LogIn, Info, Home, UserPlus } from 'lucide-react'
import { NavItemProps } from '@/interfaces/props.interface'
import { useAuthContext } from '@/context/AuthContext'
import { PermMedia } from '@mui/icons-material'

export const links = (registrationEnabled: boolean = true) => {
  const { isAuth } = useAuthContext()
  /*--------------------------------------------------guest--------------------------------------------------*/
  const navGuestItems: NavItemProps[] = [
    {/** home **/
      href: '/',
      label: 'Home',
      icon: Home
    },
    {/** login **/
      href: '/auth/login',
      label: 'Iniciar sesión',
      icon: LogIn
    },
    // Solo mostrar el botón de registrarse si está habilitado
    ...(registrationEnabled ? [{
      href: '/auth/register',
      label: 'Registrarse',
      icon: UserPlus
    } as NavItemProps] : []),
    {/** about **/
      href: '/about',
      label: 'Acerca de nosotros',
      icon: Info
    }
  ]
  /*--------------------------------------------------student--------------------------------------------------*/
  const navStudentItems: NavItemProps[] = [
    {/** dashboard **/
      label: 'Panel',
      href: '/dashboard',
      icon: TerminalSquare
    },
    {// tests
      href: '/form',
      icon: PermMedia,
      label: 'Documentación'
    }
  ]

  return !isAuth ? navGuestItems : navStudentItems
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------default style values--------------------------------------------------*/
export const defaultStyles = 'px-8 flex items-center gap-2 hover:bg-accent/50 transition-all duration-200 relative group'
export const activeStyles = 'bg-white text-black shadow-sm after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary'
export const tableTranslations = {// to spanish
  and: 'y',
  edit: 'Editar',
  save: 'Guardar',
  search: 'Buscar',
  expand: 'Expandir',
  cancel: 'Cancelar',
  actions: 'Acciones',
  hideAll: 'Ocultar todo',
  showAll: 'Mostrar todo',
  groupedBy: 'Agrupado por ',
  expandAll: 'Expandir todo',
  clearFilter: 'Limpiar filtro',
  rowActions: 'Acciones de fila',
  clearSearch: 'Limpiar búsqueda',
  clearSort: 'Limpiar ordenamiento',
  toggleDensity: 'Alternar densidad',
  columnActions: 'Acciones de columna',
  groupByColumn: 'Agrupar por {column}',
  filterByColumn: 'Filtrar por {column}',
  hideColumn: 'Ocultar columna {column}',
  ungroupByColumn: 'Desagrupar por {column}',
  showHideFilters: 'Mostrar/Ocultar filtros',
  showHideColumns: 'Mostrar/Ocultar columnas',
  toggleSelectRow: 'Alternar selección de fila',
  toggleSelectAll: 'Alternar selección de todo',
  toggleFullScreen: 'Alternar pantalla completa',
  selectedCountOfRowCountRowsSelected: '{selectedCount} de {rowCount} fila(s) seleccionada(s)',
}