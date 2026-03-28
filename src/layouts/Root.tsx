import { DialogConfirmProvider as ConfirmProvider } from '@/context/DialogConfirmContext'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { useAuthContext } from '@/context/AuthContext'
import ScrollToTop from '@/hooks/ui/useScrollTop'
import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useUserActivity } from '@/hooks/useUserActivity'

import { AnimatedBackground as AnimatedBG } from '#/layout/AnimatedBackground'
import { SidebarInset, SidebarProvider } from '#/ui/sidebar'
import { LoadingScreen } from "#/ui/loading-screen"
import { Sidebar } from '#/layout/Sidebar'
import { Toaster } from '#/ui/toaster'
import { GlobalQueryErrorToaster } from '@/components/common/GlobalQueryErrorToaster'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { PwaLifecycleToaster } from '@/components/common/PwaLifecycleToaster'
import { PrefetchInstitutions } from '@/components/common/PrefetchInstitutions'
import { AuthBootScreen } from '@/components/common/AuthBootScreen'
import { useInitialAuthSplash } from '@/hooks/ui/useInitialAuthSplash'
import Footer from '#/layout/Footer'
import Navbar from '#/layout/Navbar'

type SplashPhase = 'splash' | 'fade' | 'app'

const RootLayout = () => {
  const { user, isAuth } = useAuthContext()
  const { showSplash } = useInitialAuthSplash()
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('splash')
  const location = useLocation()
  const [openSidebar, setOpenSidebar] = useState(true)
  const isExpanded = !isAuth || (user?.displayName === 'aimme')
  
  // Actividad en Firestore solo cuando la portada terminó (evita escrituras durante la bienvenida)
  useUserActivity({ enabled: splashPhase === 'app' })
  
  // Detectar si estamos en la ruta de quiz
  const isQuizRoute = location.pathname.startsWith('/quiz')
  /** En el home del estudiante el contenido es corto: no estirar el Outlet en móvil para evitar hueco sobre el footer */
  const tightOutletMobile =
    location.pathname === '/dashboard' || location.pathname === '/dashboard/student'
  
  // Ocultar sidebar cuando estamos en quiz
  useEffect(() => {
    if (isQuizRoute) {
      setOpenSidebar(false)
    } else {
      setOpenSidebar(isExpanded)
    }
  }, [isQuizRoute, isExpanded])

  // Portada: solo temporizador; sin precargar JS ni esperar chunks (la precarga va después).
  useEffect(() => {
    if (!showSplash && splashPhase === 'splash') {
      setSplashPhase('fade')
    }
  }, [showSplash, splashPhase])

  // Tras cerrar la portada: precargar rutas frecuentes para suavizar Suspense (ya no bloquea el splash).
  useEffect(() => {
    if (splashPhase !== 'app') return
    void Promise.all([
      import('@/pages/HomePage').catch(() => undefined),
      import('@/pages/LoginPage').catch(() => undefined),
      isAuth ? import('@/pages/dashboard').catch(() => undefined) : Promise.resolve(undefined),
    ])
  }, [splashPhase, isAuth])

  const onSplashFadeComplete = useCallback(() => {
    setSplashPhase('app')
  }, [])

  const mainShell = (
    <>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ConfirmProvider>
          <SidebarProvider open={openSidebar} onOpenChange={setOpenSidebar}>
            {/* Sidebar - oculto cuando estamos en quiz */}
            {!isQuizRoute && <Sidebar />}

            {/* Main content */}
            <SidebarInset>
              <AnimatedBG>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[10000] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
                >
                  Saltar al contenido principal
                </a>
                <Navbar />
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="z-10 flex flex-col min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100vh-64px)]"
                >
                  <div
                    className={
                      tightOutletMobile
                        ? 'flex flex-col min-h-0 max-md:flex-none md:flex-1'
                        : 'flex-1 flex flex-col min-h-0'
                    }
                  >
                    <Outlet />
                  </div>
                  <Footer />
                </main>
              </AnimatedBG>
            </SidebarInset>

          </SidebarProvider>
        </ConfirmProvider>
      </LocalizationProvider>

      {/* Componentes UI globales */}
      <OfflineBanner />
      <PwaLifecycleToaster />
      <Toaster />
      <GlobalQueryErrorToaster />
      <ScrollToTop />
      <LoadingScreen />
    </>
  )

  return (
    <>
      {splashPhase === 'app' && <PrefetchInstitutions />}
      {splashPhase !== 'app' && (
        <AuthBootScreen
          exiting={splashPhase === 'fade'}
          onFadeComplete={onSplashFadeComplete}
        />
      )}
      {splashPhase !== 'splash' && mainShell}
    </>
  )
}

export default RootLayout