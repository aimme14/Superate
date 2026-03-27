import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useThemeContext } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import {
  getDeferredInstallPrompt,
  isStandalonePwa,
  promptInstall,
  subscribePwaInstall,
} from '@/lib/pwaInstall'
import { toast } from '@/hooks/ui/use-toast'
import { useIsMobile } from '@/hooks/ui/use-mobile'

/**
 * Botón para instalar la PWA o ver cómo hacerlo (solo en móvil; en escritorio no se muestra).
 */
export function PwaInstallButton() {
  const isMobile = useIsMobile()
  const { theme } = useThemeContext()
  const [open, setOpen] = useState(false)
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' ? isStandalonePwa() : false
  )
  const [, bump] = useState(0)

  useEffect(() => {
    setStandalone(isStandalonePwa())
    const onInstalled = () => setStandalone(true)
    window.addEventListener('appinstalled', onInstalled)
    const unsub = subscribePwaInstall(() => bump((n) => n + 1))
    return () => {
      window.removeEventListener('appinstalled', onInstalled)
      unsub()
    }
  }, [])

  const canPrompt = getDeferredInstallPrompt() != null

  const handleInstallNow = useCallback(async () => {
    const outcome = await promptInstall()
    if (outcome === 'accepted') {
      setOpen(false)
      toast({
        variant: 'success',
        title: 'Instalación iniciada',
        description: 'Supérate.IA quedará en tu pantalla de inicio.',
      })
    }
  }, [])

  if (standalone || !isMobile) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'gap-2 min-h-[44px]',
          theme === 'dark'
            ? 'border-zinc-600 text-zinc-100 hover:bg-zinc-800'
            : 'border-gray-300 text-gray-900 hover:bg-gray-100'
        )}
        onClick={() => setOpen(true)}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        Instalar app
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Instala Supérate.IA</DialogTitle>
            <DialogDescription className="text-pretty text-foreground/85 dark:text-zinc-300">
              <span className="block">Descarga Supérate.IA en tu móvil.</span>
              <span className="mt-1.5 block">
                Métodos para instalar la app según tu dispositivo:
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground/80 dark:text-zinc-300">
            <div>
              <p className="font-medium text-foreground">Android (Chrome)</p>
              {canPrompt ? (
                <p className="mt-1.5">
                  Pulsa <strong className="text-foreground">Instalar ahora</strong> (abajo) o{' '}
                  <strong className="text-foreground">Instalar</strong> en el aviso que aparezca; el
                  navegador te pedirá confirmar y la app quedará en tu pantalla de inicio. También
                  puedes usar el menú (⋮) y elegir <strong className="text-foreground">Instalar aplicación</strong> o{' '}
                  <strong className="text-foreground">Añadir a la pantalla de inicio</strong>.
                </p>
              ) : (
                <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                  <li>Toca el menú (tres puntos) del navegador.</li>
                  <li>
                    Elige Instalar aplicación o Añadir a la pantalla de inicio, según lo que muestre
                    tu versión.
                  </li>
                </ol>
              )}
            </div>

            <div>
              <p className="font-medium text-foreground">iPhone o iPad (Safari)</p>
              <p className="mt-1.5 text-foreground/80 dark:text-zinc-300">
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                <li>Toca el botón Compartir (cuadrado con flecha hacia arriba).</li>
                <li>Desplázate y elige Añadir a pantalla de inicio.</li>
                <li>Confirma con Añadir.</li>
              </ol>
            </div>
          </div>

          {canPrompt && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="default" className="w-full sm:w-auto" onClick={handleInstallNow}>
                Instalar ahora
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
