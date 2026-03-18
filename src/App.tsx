import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

import ProtectedRoute from "@/layouts/ProtectedRoute";
import { useAuthContext } from "@/context/AuthContext";
import { STUDENT_HOME } from "@/constants/routes";
import RoleProtectedRoute from "@/layouts/RoleProtectedRoute";
import RootLayout from "@/layouts/Root";
import StudentLayout from "@/layouts/StudentLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PrefetchInstitutions } from "@/components/common/PrefetchInstitutions";
import { LazyRouteBoundary } from "@/components/common/RouteLoadingFallback";

// Bundle inicial reducido: páginas por ruta
const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const QuizPage = lazy(() => import("@/pages/Quiz"));
const AboutPage = lazy(() => import("@/sections/about/page"));
const InformacionPage = lazy(() => import("@/pages/informacion"));

const ResultadosPage = lazy(() => import("@/pages/resultados"));
const PromedioPage = lazy(() => import("@/pages/promedio"));
const Intento = lazy(() => import("@/pages/Intento"));
const InnovativeHero = lazy(() => import("@/pages/inovativeGero"));
const Prueba = lazy(() => import("@/pages/prueba"));
const DemoImageOptionsPage = lazy(() => import("@/pages/DemoImageOptions"));
const ViewerPdfPage = lazy(() => import("@/pages/ViewerPdfPage"));
const RutaAcademicaAdaptativaPage = lazy(() => import("@/pages/RutaAcademicaAdaptativaPage"));
const PlanEstudioIAPage = lazy(() => import("@/pages/PlanEstudioIAPage"));
const SimulacrosIAPage = lazy(() => import("@/pages/SimulacrosIAPage"));
const SimulacrosICFESPage = lazy(() => import("@/pages/SimulacrosICFESPage"));

const TeacherDashboard = lazy(() => import("@/pages/dashboard/teacher/TeacherDashboard"));
const PrincipalDashboard = lazy(() => import("@/pages/dashboard/principal/PrincipalDashboard"));
const RectorDashboard = lazy(() => import("@/pages/dashboard/rector/RectorDashboard"));
const AdminDashboard = lazy(() => import("@/pages/dashboard/admin/AdminDashboard"));
const NewDashboard = lazy(() =>
  import("@/pages/dashboard/NewDashboard").then((m) => ({ default: m.Home }))
);

function NewDashboardOrRedirect() {
  const { user } = useAuthContext();
  if (user) return <Navigate to={STUDENT_HOME} replace />;
  return (
    <LazyRouteBoundary variant="page">
      <NewDashboard />
    </LazyRouteBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PrefetchInstitutions />
        <BrowserRouter>
          <Routes>
            <Route
              path="/viewer/pdf"
              element={
                <LazyRouteBoundary variant="minimal">
                  <ViewerPdfPage />
                </LazyRouteBoundary>
              }
            />
            <Route element={<RootLayout />}>
              <Route
                path="/"
                index
                element={
                  <LazyRouteBoundary variant="page">
                    <HomePage />
                  </LazyRouteBoundary>
                }
              />
              <Route
                path="/auth/login"
                element={
                  <LazyRouteBoundary variant="page">
                    <LoginPage />
                  </LazyRouteBoundary>
                }
              />
              <Route
                path="/auth/register"
                element={
                  <LazyRouteBoundary variant="page">
                    <RegisterPage />
                  </LazyRouteBoundary>
                }
              />
              <Route path="/new-dashboard" element={<NewDashboardOrRedirect />} />
              <Route
                path="/about"
                element={
                  <LazyRouteBoundary variant="page">
                    <AboutPage />
                  </LazyRouteBoundary>
                }
              />

              <Route element={<ProtectedRoute />}>
                <Route
                  path="/dashboard"
                  element={
                    <LazyRouteBoundary variant="page">
                      <DashboardPage />
                    </LazyRouteBoundary>
                  }
                />
                <Route
                  path="/quiz/:id"
                  element={
                    <LazyRouteBoundary variant="page">
                      <QuizPage />
                    </LazyRouteBoundary>
                  }
                />
                <Route
                  path="/quiz"
                  element={
                    <LazyRouteBoundary variant="page">
                      <QuizPage />
                    </LazyRouteBoundary>
                  }
                />

                <Route
                  path="/dashboard/student"
                  element={
                    <RoleProtectedRoute allowedRoles={["student"]}>
                      <LazyRouteBoundary variant="page">
                        <DashboardPage />
                      </LazyRouteBoundary>
                    </RoleProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/teacher"
                  element={
                    <RoleProtectedRoute allowedRoles={["teacher"]}>
                      <LazyRouteBoundary variant="page">
                        <TeacherDashboard theme="light" />
                      </LazyRouteBoundary>
                    </RoleProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/principal"
                  element={
                    <RoleProtectedRoute allowedRoles={["principal"]}>
                      <LazyRouteBoundary variant="page">
                        <PrincipalDashboard theme="light" />
                      </LazyRouteBoundary>
                    </RoleProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/rector"
                  element={
                    <RoleProtectedRoute allowedRoles={["rector"]}>
                      <LazyRouteBoundary variant="page">
                        <RectorDashboard theme="light" />
                      </LazyRouteBoundary>
                    </RoleProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/admin"
                  element={
                    <RoleProtectedRoute allowedRoles={["admin"]}>
                      <ErrorBoundary>
                        <LazyRouteBoundary variant="page">
                          <AdminDashboard theme="light" />
                        </LazyRouteBoundary>
                      </ErrorBoundary>
                    </RoleProtectedRoute>
                  }
                />
              </Route>

              <Route element={<StudentLayout />}>
                <Route
                  path="/informacionPage"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <InformacionPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/resultados"
                  element={
                    <LazyRouteBoundary variant="student">
                      <ResultadosPage />
                    </LazyRouteBoundary>
                  }
                />
                <Route
                  path="/promedio"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <PromedioPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/ruta-academica-adaptativa"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <RutaAcademicaAdaptativaPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/plan-estudio-ia"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <PlanEstudioIAPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/simulacros-ia"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <SimulacrosIAPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/simulacros-icfes"
                  element={
                    <ErrorBoundary>
                      <LazyRouteBoundary variant="student">
                        <SimulacrosICFESPage />
                      </LazyRouteBoundary>
                    </ErrorBoundary>
                  }
                />
              </Route>

              <Route
                path="/innovative-hero"
                element={
                  <LazyRouteBoundary variant="page">
                    <InnovativeHero />
                  </LazyRouteBoundary>
                }
              />
              <Route
                path="/prueba"
                element={
                  <LazyRouteBoundary variant="page">
                    <Prueba />
                  </LazyRouteBoundary>
                }
              />
              <Route
                path="/Intento"
                element={
                  <LazyRouteBoundary variant="page">
                    <Intento />
                  </LazyRouteBoundary>
                }
              />

              <Route
                path="/demo-image-options"
                element={
                  <LazyRouteBoundary variant="page">
                    <DemoImageOptionsPage />
                  </LazyRouteBoundary>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
