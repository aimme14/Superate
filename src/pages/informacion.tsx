import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthContext } from "@/context/AuthContext"
import { useQueryUser } from "@/hooks/query/useAuthQuery"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"

export default function InfoTab() {
  const { user } = useAuthContext()
  const { theme } = useThemeContext()
  const userId = user?.uid
  const queryUser = useQueryUser()
  const { data: userData } = queryUser.fetchUserById<any>(userId as string, !!userId)

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      <div className="container mx-auto px-4 py-5 md:py-8">
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
            <Label htmlFor="doc" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Documento</Label>
            <Input id="doc" value={(userData?.userdoc || '').replace(/0$/, '')} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="academicYear" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Año académico (Cohorte)</Label>
            <Input id="academicYear" value={userData?.academicYear || ''} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
          <div>
            <Label htmlFor="representativePhone" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Número de teléfono del representante</Label>
            <Input id="representativePhone" value={userData?.representativePhone || 'No registrado'} readOnly className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')} />
          </div>
        </div>
      </CardContent>
    </Card>
      </div>
    </div>
  )
}