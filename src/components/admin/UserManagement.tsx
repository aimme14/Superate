import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  UserPlus, 
  Search, 
  Building, 
  GraduationCap, 
  Crown,
  MoreVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { createUserByAdmin } from '@/controllers/admin.controller'

interface User {
  id: string
  name: string
  email: string
  role: 'teacher' | 'principal' | 'admin'
  institution?: string
  subjects?: string[]
  studentsCount?: number
  status: 'active' | 'inactive'
  createdAt: string
  lastLogin?: string
}

interface UserManagementProps {
  theme: 'light' | 'dark'
}

export default function UserManagement({ theme }: UserManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'teacher' as 'teacher' | 'principal',
    institution: '',
    password: '',
    confirmPassword: ''
  })

  // Datos de ejemplo - en producción vendrían de la API
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Prof. María Rodríguez',
      email: 'maria.rodriguez@colegio.edu',
      role: 'teacher',
      institution: 'Colegio San José',
      subjects: ['Matemáticas', 'Física'],
      studentsCount: 45,
      status: 'active',
      createdAt: '2024-01-15',
      lastLogin: '2024-01-20'
    },
    {
      id: '2',
      name: 'Dr. Carlos Silva',
      email: 'carlos.silva@instituto.edu',
      role: 'principal',
      institution: 'Instituto Nacional',
      status: 'active',
      createdAt: '2024-01-10',
      lastLogin: '2024-01-20'
    },
    {
      id: '3',
      name: 'Prof. Ana Martínez',
      email: 'ana.martinez@liceo.edu',
      role: 'teacher',
      institution: 'Liceo Moderno',
      subjects: ['Lenguaje', 'Literatura'],
      studentsCount: 38,
      status: 'active',
      createdAt: '2024-01-12',
      lastLogin: '2024-01-19'
    }
  ])

  const institutions = [
    'Colegio San José',
    'Instituto Nacional',
    'Liceo Moderno',
    'Escuela Primaria ABC'
  ]

  const handleCreateUser = async () => {
    if (newUser.password !== newUser.confirmPassword) {
      notifyError({ title: 'Error', message: 'Las contraseñas no coinciden' })
      return
    }

    if (!newUser.name || !newUser.email || !newUser.institution) {
      notifyError({ title: 'Error', message: 'Todos los campos son obligatorios' })
      return
    }

    if (newUser.password.length < 6) {
      notifyError({ title: 'Error', message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    try {
      const userData = {
        username: newUser.name,
        email: newUser.email,
        role: newUser.role,
        institution: newUser.institution,
        password: newUser.password
      }

      const result = await createUserByAdmin(userData)
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Error al crear el usuario')
      }

      // Simular creación exitosa para la UI
      const createdUser: User = {
        id: Date.now().toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        institution: newUser.institution,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        studentsCount: newUser.role === 'teacher' ? 0 : undefined
      }

      setUsers(prev => [...prev, createdUser])
      setIsCreateDialogOpen(false)
      setNewUser({
        name: '',
        email: '',
        role: 'teacher',
        institution: '',
        password: '',
        confirmPassword: ''
      })
      notifySuccess({ 
        title: 'Éxito', 
        message: `${newUser.role === 'teacher' ? 'Docente' : 'Rector'} creado correctamente` 
      })
    } catch (error) {
      console.error('Error creating user:', error)
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al crear el usuario' 
      })
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.role === selectedRole
    const matchesInstitution = selectedInstitution === 'all' || user.institution === selectedInstitution
    
    return matchesSearch && matchesRole && matchesInstitution
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'teacher':
        return <GraduationCap className="h-4 w-4" />
      case 'principal':
        return <Crown className="h-4 w-4" />
      case 'admin':
        return <Building className="h-4 w-4" />
      default:
        return <GraduationCap className="h-4 w-4" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'teacher':
        return 'Docente'
      case 'principal':
        return 'Rector'
      case 'admin':
        return 'Administrador'
      default:
        return 'Usuario'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Gestión de Usuarios
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Administra rectores y docentes del sistema
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black text-white hover:bg-gray-800">
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>
                Crea una nueva cuenta de rector o docente en el sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre completo del usuario"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="correo@institucion.edu"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={newUser.role} onValueChange={(value: 'teacher' | 'principal') => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Docente</SelectItem>
                    <SelectItem value="principal">Rector</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="institution">Institución</Label>
                <Select value={newUser.institution} onValueChange={(value) => setNewUser(prev => ({ ...prev, institution: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar institución" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(institution => (
                      <SelectItem key={institution} value={institution}>
                        {institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña temporal</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Contraseña temporal"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirmar contraseña"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} className="bg-black text-white hover:bg-gray-800">
                Crear Usuario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros y búsqueda */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="teacher">Docentes</SelectItem>
                <SelectItem value="principal">Rectores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por institución" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las instituciones</SelectItem>
                {institutions.map(institution => (
                  <SelectItem key={institution} value={institution}>
                    {institution}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Usuarios ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className={cn('flex items-center justify-between p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                <div className="flex items-center space-x-4">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-medium', 
                    user.role === 'teacher' ? 'bg-blue-500' : 'bg-purple-500')}>
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {user.name}
                    </h3>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {user.email}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        {getRoleIcon(user.role)}
                        <span>{getRoleLabel(user.role)}</span>
                      </Badge>
                      <Badge variant="outline">
                        {user.institution}
                      </Badge>
                      {user.studentsCount && (
                        <Badge variant="outline">
                          {user.studentsCount} estudiantes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
