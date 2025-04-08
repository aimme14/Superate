import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import Welcome from "./pages/Welcome";
import Mate from "./pages/mate";
import DashboardAdmin from "./pages/DashboardAdminPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route >
            {/* home index */}
            <Route path="/" index element={<HomePage />} />

            {/* auth routes */}
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/dashboard-admin" element={<DashboardAdmin />} />
            <Route path="/mate" element={<Mate />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App