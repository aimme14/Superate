import { useThemeContext } from '@/context/ThemeContext'
import { useLocation } from 'react-router-dom'
import { Button } from '#/ui/button'
import { Badge } from '#/ui/badge'
import { cn } from '@/lib/utils'
import { hasStudentNav } from '@/constants/routes'

const FooterSection = () => {
  const { theme } = useThemeContext()
  const { pathname } = useLocation()
  const studentBottomNav = hasStudentNav(pathname)

  return (
    <footer
      className={cn(
        'px-4 py-5 sm:px-6 sm:py-6 border-t z-10',
        /* mt-auto solo en md+: en móvil evita la franja vacía entre contenido y pie */
        'md:mt-auto',
        'flex flex-col sm:flex-row',
        'justify-between items-center gap-4 sm:gap-6',
        studentBottomNav
          ? 'max-md:pb-[max(calc(5.5rem+env(safe-area-inset-bottom,0px)),1.25rem)]'
          : 'max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]',
        theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'
      )}
    >
      <div className="flex flex-col text-center sm:text-left order-2 sm:order-1">
        <h3 className={cn(
          'text-base sm:text-lg font-semibold',
          theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
        )}>
          Superate.IA
        </h3>
        <p className={cn(
          'text-xs sm:text-sm',
          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
        )}>
          2025. Todos los derechos reservados.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 order-1 sm:order-2 [&_a]:min-h-[44px] [&_a]:min-w-[44px] [&_a]:flex [&_a]:items-center [&_a]:justify-center">
        <Button variant="link" size="sm" className="h-auto py-2 sm:py-0">Términos de Servicio</Button>
        <Button variant="link" size="sm" className="h-auto py-2 sm:py-0">Política de Privacidad</Button>
        <Badge variant="outline" className="hidden md:inline-flex">Versión 1.0.0</Badge>
      </div>
    </footer>
  )
}

export default FooterSection