import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

import { Home as NewDasboard } from "@/pages/dashboard/NewDashboard";
import ProtectedRoute from "@/layouts/ProtectedRoute";
import RoleProtectedRoute from "@/layouts/RoleProtectedRoute";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/LoginPage";
import RootLayout from "@/layouts/Root";
import HomePage from "@/pages/HomePage";
import QuizPage from "@/pages/Quiz";
import AboutPage from "@/sections/about/page";
import InformacionPage from "@/pages/informacion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InnovativeHero from "@/pages/inovativeGero";
import Prueba from "@/pages/prueba";
import DemoImageOptionsPage from "@/pages/DemoImageOptions";
import ViewerPdfPage from "@/pages/ViewerPdfPage";
import RutaAcademicaAdaptativaPage from "@/pages/RutaAcademicaAdaptativaPage";
import PlanEstudioIAPage from "@/pages/PlanEstudioIAPage";
import SimulacrosIAPage from "@/pages/SimulacrosIAPage";

// Páginas pesadas: lazy load para reducir el bundle inicial
const ResultadosPage = lazy(() => import("@/pages/resultados"));
const PromedioPage = lazy(() => import("@/pages/promedio"));
const Intento = lazy(() => import("@/pages/Intento"));

// Dashboards específicos por rol (lazy para no cargarlos hasta que se necesiten)
const TeacherDashboard = lazy(() => import("@/pages/dashboard/teacher/TeacherDashboard"));
const PrincipalDashboard = lazy(() => import("@/pages/dashboard/principal/PrincipalDashboard"));
const RectorDashboard = lazy(() => import("@/pages/dashboard/rector/RectorDashboard"));
const AdminDashboard = lazy(() => import("@/pages/dashboard/admin/AdminDashboard"));

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>

        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>}>
          <Routes>
            {/* Visor de PDF en pestaña propia: solo contenido, sin descargar/imprimir */}
            <Route path="/viewer/pdf" element={<ViewerPdfPage />} />
            <Route element={<RootLayout />}>
              {/* home index */}
              <Route path="/" index element={<HomePage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/new-dashboard" element={<NewDasboard />} />
              <Route path="/about" element={<AboutPage />} />

              {/* rutas protegidas */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/quiz/:id" element={<QuizPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                
                {/* Rutas protegidas por rol */}
                <Route path="/dashboard/student" element={
                  <RoleProtectedRoute allowedRoles={['student']}>
                    <DashboardPage />
                  </RoleProtectedRoute>
                } />
                
                <Route path="/dashboard/teacher" element={
                  <RoleProtectedRoute allowedRoles={['teacher']}>
                    <TeacherDashboard theme="light" />
                  </RoleProtectedRoute>
                } />
                
                <Route path="/dashboard/principal" element={
                  <RoleProtectedRoute allowedRoles={['principal']}>
                    <PrincipalDashboard theme="light" />
                  </RoleProtectedRoute>
                } />
                
                <Route path="/dashboard/rector" element={
                  <RoleProtectedRoute allowedRoles={['rector']}>
                    <RectorDashboard theme="light" />
                  </RoleProtectedRoute>
                } />
                
                <Route path="/dashboard/admin" element={
                  <RoleProtectedRoute allowedRoles={['admin']}>
                    <ErrorBoundary>
                      <AdminDashboard theme="light" />
                    </ErrorBoundary>
                  </RoleProtectedRoute>
                } />
              </Route>

              {/* rutas publicas */}
              <Route path="/informacionPage" element={<InformacionPage />} />
              <Route path="/resultados" element={<ResultadosPage />} />
              <Route path="/promedio" element={<ErrorBoundary><PromedioPage /></ErrorBoundary>} />
              <Route path="/ruta-academica-adaptativa" element={<RutaAcademicaAdaptativaPage />} />
              <Route path="/plan-estudio-ia" element={<ErrorBoundary><PlanEstudioIAPage /></ErrorBoundary>} />
              <Route path="/simulacros-ia" element={<ErrorBoundary><SimulacrosIAPage /></ErrorBoundary>} />
              <Route path="/innovative-hero" element={<InnovativeHero />} />
              <Route path="/prueba" element={<Prueba />} />
              <Route path="/Intento" element={<Intento />} />

              {/* rutas publicas */}
              <Route path="/demo-image-options" element={<DemoImageOptionsPage />} />
              
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>

      </AuthProvider>
    </ThemeProvider>
  )
}

export default App