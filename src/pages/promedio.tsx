import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContactRound, NotepadText, HousePlug, BarChart2 } from "lucide-react"
import { Link } from "react-router-dom"

export default function PromedioPage() {
  return (
    <div>
      {/* Sección 1: Encabezado y Navegación */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/assets/agustina.png" width="80" height="80" alt="ICFES Logo" className="mr-2" />
            <span className="text-red-600 font-bold text-2xl">I.E. Colegio Agustina Ferro</span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="resultados" />
            <NavItem href="/dashboard" icon={<HousePlug className="w-5 h-5" />} text="Presenta tus evaluaciones" />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Promedio" active />
          </nav>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Promedio</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Promedio General</h3>
            <div className="bg-purple-100 p-4 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">85%</div>
              <p className="text-gray-600">Excelente desempeño académico</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Áreas de Fortaleza</h3>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Comprensión Lectora (92%)</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Matemáticas Básicas (85%)</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Áreas de Mejora</h3>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Ciencias Naturales (78%)</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>  
  )
  interface NavItemProps {
    icon: React.ReactNode;
    active?: boolean;
    href: string;
    text: string;
  }
  
  // Componentes auxiliares
  function NavItem({ href, icon, text, active = false }: NavItemProps) {
    return (
      <Link
        to={href}
        className={`flex items-center ${active ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}
      >
        <span className="mr-2">{icon}</span>
        <span>{text}</span>
      </Link>
    );
  }
}
