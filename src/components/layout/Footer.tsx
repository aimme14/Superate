import { useThemeContext } from '@/context/ThemeContext'
import { Button } from '#/ui/button'
import { Badge } from '#/ui/badge'
import { cn } from '@/lib/utils'

const FooterSection = () => {
  const { theme } = useThemeContext()
  return (
    <footer
      className={cn(
        'p-6 border-t mt-auto z-10',
        'flex flex-col sm:flex-row',
        'justify-between items-center gap-4',
        theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'
      )}
    >
      <div className="flex flex-col">
        <h3 className={cn(
          'text-lg font-semibold',
          theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
        )}>
          Superate.IA
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
        )}>
          2025. Todos los derechos reservados.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Button variant="link" size="sm" className="h-auto py-0">Términos de Servicio</Button>
        <Button variant="link" size="sm" className="h-auto py-0">Política de Privacidad</Button>
        <Badge variant="outline" className="hidden md:inline-flex">Versión 1.0.0</Badge>
      </div>
    </footer>
  )
}

export default FooterSection