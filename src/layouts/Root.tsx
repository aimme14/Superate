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
import { AuthBootScreen } from '@/components/common/AuthBootScreen'
import { useInitialAuthSplash } from '@/hooks/ui/useInitialAuthSplash'
import Footer from '#/layout/Footer'
import Navbar from '#/layout/Navbar'

type SplashPhase = 'splash' | 'fade' | 'app'

const RootLayout = () => {
  const { user, isAuth, loading } = useAuthContext()
  const { showSplash } = useInitialAuthSplash(loading)
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('splash')
  const [bootChunksReady, setBootChunksReady] = useState(false)
  const [dashboardChunkReady, setDashboardChunkReady] = useState(false)
  const location = useLocation()
  const [openSidebar, setOpenSidebar] = useState(true)
  const isExpanded = !isAuth || (user?.displayName === 'aimme')
  
  // Rastrear actividad del usuario para sesiones activas
  useUserActivity()
  
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

  // Precargar chunks principales mientras mostramos la bienvenida.
  // Esto evita que justo al quitar la capa aparezcan placeholders de Suspense (`LazyRouteBoundary`).
  useEffect(() => {
    // Siempre es probable que el start_url sea "/"
    Promise.all([
      import('@/pages/HomePage').catch(() => undefined),
      import('@/pages/LoginPage').catch(() => undefined)
    ])
      .then(() => setBootChunksReady(true))
      .catch(() => setBootChunksReady(true))
  }, [])

  // Si al terminar auth el usuario SÍ está autenticado, precargamos dashboard.
  useEffect(() => {
    if (loading) return
    if (!isAuth) return
    void import('@/pages/dashboard')
      .then(() => setDashboardChunkReady(true))
      .catch(() => setDashboardChunkReady(true))
  }, [loading, isAuth])

  // Al terminar tiempo/auth: fade-out y luego mostrar solo la app (sin parpadeo)
  useEffect(() => {
    if (!showSplash && splashPhase === 'splash') {
      // Espera a que los chunks necesarios ya estén listos para evitar el skeleton de Suspense.
      const needsDashboard = isAuth
      const okDashboard = needsDashboard ? dashboardChunkReady : true
      if (!bootChunksReady || !okDashboard) return
      setSplashPhase('fade')
    }
  }, [showSplash, splashPhase, bootChunksReady, dashboardChunkReady, isAuth])

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