import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import UserMenu from '#/pages/dashboard/UserMenu'
import { SidebarTrigger } from '#/ui/sidebar'
import ThemeToggle from '#/layout/Theme'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { Link, useLocation } from 'react-router-dom'
import { hasStudentNav } from '@/constants/routes'
import logoLight from '/assets/logo_tematica_blanca.png'
import logoDark from '/assets/logo_tematica_negra.png'
import letraModoClaro from '/assets/letra_modo_claro.png'
import letraModoNegro from '/assets/letra_modo_negro.png'
import { cn } from '@/lib/utils'

const Navbar = () => {
  const { user, isAuth } = useAuthContext()
  const { theme } = useThemeContext()
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const showSidebarTrigger = isMobile && !hasStudentNav(pathname)
  return (
    <header className={cn(
      'sticky top-0 z-20 bg-gradient-to-r',
      'backdrop-blur-sm transition-colors duration-500',
      theme === 'dark' ? 'from-zinc-800 to-zinc-800/30 text-zinc-100' : 'from-gray-200 to-gray-200/30 text-gray-900'
    )}>
      <div className="container flex h-14 min-h-[44px] sm:h-16 p-3 sm:p-4 items-center justify-between gap-2">
        <div className="flex items-center min-w-0 flex-1 space-x-2">
          {showSidebarTrigger && <SidebarTrigger className="mr-1 shrink-0 sm:mr-2" />}
          {!isMobile && (
            <div className="animate-in zoom-in-95 duration-300">
              <span className={cn("flex h-12 mr-2 shrink-0 items-center justify-center", isAuth ? 'w-16' : 'w-20')}>
                <img
                  src={theme === 'dark' ? logoDark : logoLight}
                  alt="SUPERATE.IA"
                  className="h-full w-auto max-h-12 object-contain"
                />
              </span>
            </div>
          )}
          {isAuth
            ? (
                <Link to="/" className="flex items-center shrink-0 min-h-[44px] min-w-0">
                  <img
                    src={theme === 'dark' ? letraModoNegro : letraModoClaro}
                    alt="SUPERATE.IA"
                    className="h-7 w-auto max-h-9 sm:h-8 sm:max-h-10 object-contain"
                  />
                </Link>
              )
            : (
                <img
                  src={theme === 'dark' ? letraModoNegro : letraModoClaro}
                  alt="SUPERATE.IA"
                  className="h-7 w-auto max-h-9 sm:h-8 sm:max-h-10 object-contain"
                />
              )}
        </div>

        <div className="flex items-center shrink-0 gap-x-2 md:gap-x-4 [&_button]:min-h-[44px] [&_button]:min-w-[44px]">
          <ThemeToggle />
          {isAuth && user && (
            <>
              <UserMenu theme={theme} />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar