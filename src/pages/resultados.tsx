import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HousePlug, ContactRound,NotepadText, BarChart2, Apple } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

const evaluations = [
  { id: 1, name: "Lectura Critica", score: 85, date: "2024-01-15" },
  { id: 2, name: "Matematicas", score: 92, date: "2024-01-20" },
  { id: 3, name: "Ciencias Sociales", score: 78, date: "2024-01-25" },
  { id: 4, name: "Ciencias Naturales", score: 78, date: "2024-01-25" },
  { id: 5, name: "Inglés", score: 78, date: "2024-01-25" },
]

export default function EvaluationsTab() {
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
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" active/>
            <NavItem href="" icon={<HousePlug className="w-5 h-5" />} text="Mi progreso"/>
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
            <NavItem href="/dashboard" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
          </nav>
        </div>
      </header>
    <Card>
      <CardHeader>
        <CardTitle>Mis Evaluaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {evaluations.map((evaluation) => (
            <div key={evaluation.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-semibold">{evaluation.name}</h3>
                <p className="text-sm text-gray-600">Fecha: {evaluation.date}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">{evaluation.score}%</div>
                <Button variant="outline" size="sm">Ver Detalles</Button>
              </div>
            </div>
          ))}
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
    )
  }
}
