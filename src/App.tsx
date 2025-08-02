import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

import { Home as NewDasboard } from "@/pages/dashboard/NewDashboard";
import ProtectedRoute from "@/layouts/ProtectedRoute";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/LoginPage";
import RootLayout from "@/layouts/Root";
import HomePage from "@/pages/HomePage";
import QuizPage from "@/pages/Quiz";
import AboutPage from "@/sections/about/page";
import InformacionPage from "@/pages/informacion";
import ResultadosPage from "@/pages/resultados";
import PromedioPage from "@/pages/promedio";
import InnovativeHero from "@/pages/inovativeGero";
import Prueba from "@/pages/prueba";
import Intento from "@/pages/Intento";
import ExamAnalyzer from "@/pages/ExamAnalyzer";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>

        <BrowserRouter>
          <Routes>
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
              </Route>

              {/* rutas publicas */}
              <Route path="/informacionPage" element={<InformacionPage />} />
              <Route path="/resultados" element={<ResultadosPage />} />
              <Route path="/promedio" element={<PromedioPage />} />
              <Route path="/innovative-hero" element={<InnovativeHero />} />
              <Route path="/prueba" element={<Prueba />} />
              <Route path="/Intento" element={<Intento />} />

              {/* rutas publicas */}
              <Route path="/exam-analyzer" element={<ExamAnalyzer />} />
              
            </Route>
          </Routes>
        </BrowserRouter>

      </AuthProvider>
    </ThemeProvider>
  )
}

export default App