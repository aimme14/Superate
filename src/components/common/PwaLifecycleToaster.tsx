import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from '@/hooks/ui/use-toast'
import { ToastAction } from '@/components/ui/toast'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaLifecycleToaster() {
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null)
  const shownUpdateToastRef = useRef(false)
  const shownInstallToastRef = useRef(false)

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onOfflineReady() {
      toast({
        variant: 'info',
        title: 'Modo sin conexión listo',
        description: 'La app puede abrir con recursos en caché cuando no tengas internet.'
      })
    }
  })

  useEffect(() => {
    if (!needRefresh || shownUpdateToastRef.current) return
    shownUpdateToastRef.current = true

    toast({
      variant: 'warning',
      title: 'Nueva versión disponible',
      description: 'Actualiza para usar la versión más reciente.',
      action: (
        <ToastAction
          altText="Actualizar aplicación"
          onClick={() => updateServiceWorker(true)}
        >
          Actualizar
        </ToastAction>
      )
    })
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      installEventRef.current = event as BeforeInstallPromptEvent

      if (shownInstallToastRef.current) return
      shownInstallToastRef.current = true

      toast({
        variant: 'info',
        title: 'Instala Supérate.IA',
        description: 'Accede más rápido desde tu escritorio o pantalla de inicio.',
        action: (
          <ToastAction
            altText="Instalar aplicación"
            onClick={async () => {
              const installEvent = installEventRef.current
              if (!installEvent) return
              await installEvent.prompt()
              const choice = await installEvent.userChoice
              if (choice.outcome === 'accepted') {
                toast({
                  variant: 'success',
                  title: 'Instalación iniciada',
                  description: 'Supérate.IA quedó lista como app.'
                })
              }
              installEventRef.current = null
            }}
          >
            Instalar
          </ToastAction>
        )
      })
    }

    const onAppInstalled = () => {
      toast({
        variant: 'success',
        title: 'App instalada',
        description: 'Supérate.IA se instaló correctamente.'
      })
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  return null
}
