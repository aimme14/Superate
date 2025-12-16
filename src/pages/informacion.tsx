import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {HousePlug, ContactRound, NotepadText, BarChart2, Apple } from "lucide-react"
import { useAuthContext } from "@/context/AuthContext"
import { useQueryUser } from "@/hooks/query/useAuthQuery"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link } from "react-router-dom"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import React from "react"

interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
  theme?: 'light' | 'dark';
}

// Componente auxiliar
function NavItem({ href, icon, text, active = false, theme = 'light' }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center",
        active 
          ? theme === 'dark' ? "text-red-400 font-medium" : "text-red-600 font-medium"
          : theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}

export default function InfoTab() {
  const { user } = useAuthContext()
  const { theme } = useThemeContext()
  const userId = user?.uid
  const queryUser = useQueryUser()
  const { data: userData } = queryUser.fetchUserById<any>(userId as string, !!userId)
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution()

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      {/* Sección 1: Encabezado y Navegación */}
      <header className={cn("shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-b border-zinc-700' : 'bg-white')}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={institutionLogo} 
              width="80" 
              height="80" 
              alt={`Logo de ${institutionName}`} 
              className="mr-2"
              onError={(e) => {
                e.currentTarget.src = '/assets/agustina.png'
              }}
            />
            <span className={cn("font-bold text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" active theme={theme}/>
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" theme={theme} />
            <NavItem href="/exam-analyzer" icon={<HousePlug className="w-5 h-5" />} text="Mi progreso" theme={theme}/>
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Desempeño" theme={theme} />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
          </nav>
        </div>
      </header>
    <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
      <CardHeader>
        <CardTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Información Personal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Correo Electrónico</Label>
            <Input id="email" value={user?.email || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="name" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre</Label>
            <Input id="name" value={user?.displayName || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="inst" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Institució educativa</Label>
            <Input id="inst" value={userData?.institutionName || userData?.inst || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="campus" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Sede</Label>
            <Input id="campus" value={userData?.campusName || userData?.campus || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="grade" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
            <Input id="grade" value={userData?.gradeName || userData?.grade || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="role" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>tipo de documento</Label>
            <Input id="role" value={userData?.role || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="doc" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Documento</Label>
            <Input id="doc" value={(userData?.userdoc || '').replace(/0$/, '')} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}