import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

import NewDasboard from "@/pages/dashboard/NewDashboard";
import ProtectedRoute from "@/layouts/ProtectedRoute";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/LoginPage";
import RootLayout from "@/layouts/Root";
import HomePage from "@/pages/HomePage";
import QuizPage from "@/pages/Quiz";

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

              {/* protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/quiz/:id" element={<QuizPage />} />

              </Route>

            </Route>
          </Routes>
        </BrowserRouter>

      </AuthProvider>
    </ThemeProvider>
  )
}

export default App