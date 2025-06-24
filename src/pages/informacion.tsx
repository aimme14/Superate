import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {HousePlug, ContactRound, NotepadText, BarChart2 } from "lucide-react"
import { useAuthContext } from "@/context/AuthContext"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "react-router-dom"


export default function InfoTab() {
  const { user } = useAuthContext()

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
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" active/>
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="resultados" />
            <NavItem href="/dashboard" icon={<HousePlug className="w-5 h-5" />} text="Presenta tus evaluaciones" />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Promedio" />
          </nav>
        </div>
      </header>
    <Card>
      <CardHeader>
        <CardTitle>Información Personal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" value={user?.email || ''} readOnly />
          </div>
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={user?.displayName || ''} readOnly />
          </div>
          <div>
            <Label htmlFor="inst">Institución</Label>
            <Input id="inst" value={user?.inst || ''} readOnly />
          </div>
          <div>
            <Label htmlFor="userdoc">Documento</Label>
            <Input id="userdoc" value={user?.userdoc || ''} readOnly />
          </div>
          <div>
            <Label htmlFor="grade">Grado</Label>
            <Input id="grade" value={user?.grade || ''} readOnly />
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