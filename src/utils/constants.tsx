import { TerminalSquare, LogIn, Info, Home, UserPlus } from 'lucide-react'
import { NavItemProps } from '@/interfaces/props.interface'
import { PermMedia } from '@mui/icons-material'

export const links = (registrationEnabled: boolean = true, isAuth: boolean = false) => {
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

interface GuestLinksOptions {
  isMobile: boolean
}

export const getGuestLinksForViewport = (
  guestItems: NavItemProps[],
  { isMobile }: GuestLinksOptions
): NavItemProps[] => {
  if (!isMobile) {
    return guestItems
  }

  return guestItems.filter((item) => item.href === '/auth/login')
}