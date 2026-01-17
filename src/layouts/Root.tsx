import { DialogConfirmProvider as ConfirmProvider } from '@/context/DialogConfirmContext'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { useAuthContext } from '@/context/AuthContext'
import ScrollToTop from '@/hooks/ui/useScrollTop'
import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useUserActivity } from '@/hooks/useUserActivity'

import { AnimatedBackground as AnimatedBG } from '#/layout/AnimatedBackground'
import { SidebarInset, SidebarProvider } from '#/ui/sidebar'
import { LoadingScreen } from "#/ui/loading-screen"
import { Sidebar } from '#/layout/Sidebar'
import { Toaster } from '#/ui/toaster'
import Footer from '#/layout/Footer'
import Navbar from '#/layout/Navbar'

const RootLayout = () => {
  const { user, isAuth, loading } = useAuthContext()
  const location = useLocation()
  const [openSidebar, setOpenSidebar] = useState(true)
  const isExpanded = !isAuth || (user?.displayName === 'aimme')
  
  // Rastrear actividad del usuario para sesiones activas
  useUserActivity()
  
  // Detectar si estamos en la ruta de quiz
  const isQuizRoute = location.pathname.startsWith('/quiz')
  
  // Ocultar sidebar cuando estamos en quiz
  useEffect(() => {
    if (isQuizRoute) {
      setOpenSidebar(false)
    } else {
      setOpenSidebar(isExpanded)
    }
  }, [isQuizRoute, isExpanded])
  
  // Mostrar loader mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Verificando sesión...
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ConfirmProvider>
          <SidebarProvider open={openSidebar} onOpenChange={setOpenSidebar}>
            {/* Sidebar - oculto cuando estamos en quiz */}
            {!isQuizRoute && <Sidebar />}

            {/* Main content */}
            <SidebarInset>
              <AnimatedBG>
                <Navbar />
                <main className="z-10 flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
                  <div className="flex-1 flex flex-col">
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
      <Toaster />
      <ScrollToTop />
      <LoadingScreen />
    </>
  )
}

export default RootLayout