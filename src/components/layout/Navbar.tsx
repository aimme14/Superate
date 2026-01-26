import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import UserMenu from '#/pages/dashboard/UserMenu'
import { SidebarTrigger } from '#/ui/sidebar'
import ThemeToggle from '#/layout/Theme'
import { motion } from "framer-motion"

import { useIsMobile } from '@/hooks/ui/use-mobile'
import { Link } from 'react-router-dom'
import logoLight from '/assets/logo_tematica_blanca.png'
import logoDark from '/assets/logo_tematica_negra.png'
import letraModoClaro from '/assets/letra_modo_claro.png'
import letraModoNegro from '/assets/letra_modo_negro.png'
import { cn } from '@/lib/utils'

const Navbar = () => {
  const { user, isAuth } = useAuthContext()
  const { theme } = useThemeContext()
  const isMobile = useIsMobile()
  return (
    <header className={cn(
      'sticky top-0 z-20 bg-gradient-to-r',
      'backdrop-blur-sm transition-colors duration-500',
      theme === 'dark' ? 'from-zinc-800 to-zinc-800/30 text-zinc-100' : 'from-gray-200 to-gray-200/30 text-gray-900'
    )}>
      <div className="container flex h-16 p-4 items-center justify-between">
        <div className="flex items-center space-x-2">
          {isMobile && <SidebarTrigger className='mr-2' />}
          {!isMobile && (
            <motion.div initial={{ rotate: -10, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ duration: 0.5 }}>
              <span className={cn("flex h-12 mr-2 shrink-0 items-center justify-center", isAuth ? 'w-16' : 'w-20')}>
                <img
                  src={theme === 'dark' ? logoDark : logoLight}
                  alt="SUPERATE.IA"
                  className="h-full w-auto max-h-12 object-contain"
                />
              </span>
            </motion.div>
          )}
          {isAuth
            ? (
                <Link to="/" className="flex items-center shrink-0">
                  <img
                    src={theme === 'dark' ? letraModoNegro : letraModoClaro}
                    alt="SUPERATE.IA"
                    className="h-8 w-auto max-h-10 object-contain"
                  />
                </Link>
              )
            : (
                <img
                  src={theme === 'dark' ? letraModoNegro : letraModoClaro}
                  alt="SUPERATE.IA"
                  className="h-8 w-auto max-h-10 object-contain"
                />
              )}
        </div>

        <div className="flex items-center gap-x-2 md:gap-x-4">
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