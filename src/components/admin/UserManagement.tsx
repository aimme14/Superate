import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { UserPlus, Loader2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { useInstitutionOptions, useCampusOptions, useGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useTeacherMutations } from '@/hooks/query/useTeacherQuery'
import { usePrincipalMutations } from '@/hooks/query/usePrincipalQuery'
import { useRectorMutations } from '@/hooks/query/useRectorQuery'
import { useStudentMutations } from '@/hooks/query/useStudentQuery'
import { debugFormData } from '@/utils/debugFormData'
import { useAuthContext } from '@/context/AuthContext'

interface UserManagementProps {
  theme: 'light' | 'dark'
}

export default function UserManagement({ theme }: UserManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { user: currentUser } = useAuthContext()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student' as 'student' | 'teacher' | 'principal' | 'rector',
    institution: '',
    campus: '',
    grade: '',
    password: '',
    confirmPassword: '',
    representativePhone: '',
    academicYear: new Date().getFullYear() as number,
    jornada: '' as 'mañana' | 'tarde' | 'única' | '',
  })
  const [createdUserSummary, setCreatedUserSummary] = useState<{
    name: string
    email: string
    password: string
  } | null>(null)

  const { createTeacher } = useTeacherMutations()
  const { createPrincipal } = usePrincipalMutations()
  const { createRector } = useRectorMutations()
  const { createStudent } = useStudentMutations()

  // Solo consultar Firestore al abrir el diálogo (evita lecturas y toasts globales en el dashboard admin)
  const listsEnabled = isCreateDialogOpen
  const { options: institutionOptions, isLoading: institutionsLoading } = useInstitutionOptions(true, listsEnabled)
  const { options: campusOptions, isLoading: campusLoading } = useCampusOptions(
    newUser.institution || '',
    listsEnabled && Boolean(newUser.institution) && newUser.role !== 'rector'
  )
  const { options: gradeOptions, isLoading: gradeLoading } = useGradeOptions(
    newUser.institution || '',
    newUser.campus || '',
    listsEnabled &&
      Boolean(newUser.institution) &&
      Boolean(newUser.campus) &&
      (newUser.role === 'student' || newUser.role === 'teacher')
  )

  const handleCopyCreatedUserSummary = async () => {
    if (!createdUserSummary) return
    const text = `Usuario: ${createdUserSummary.name}\nCorreo: ${createdUserSummary.email}\nContraseña: ${createdUserSummary.password}\n\nYa se encuentra registrado en Superate.IA.`
    try {
      await navigator.clipboard.writeText(text)
      notifySuccess({ title: 'Copiado', message: 'Los datos se copiaron al portapapeles.' })
    } catch {
      notifyError({ title: 'Error', message: 'No se pudo copiar al portapapeles.' })
    }
  }

  const handleCreateUser = async () => {
    if (newUser.password !== newUser.confirmPassword) {
      notifyError({ title: 'Error', message: 'Las contraseñas no coinciden' })
      return
    }

    if (!currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener el correo del administrador.' })
      return
    }

    if (!newUser.name || !newUser.email || !newUser.institution) {
      notifyError({ title: 'Error', message: 'Todos los campos son obligatorios' })
      return
    }

    if (newUser.role === 'student' && !newUser.grade) {
      notifyError({ title: 'Error', message: 'El grado es obligatorio para estudiantes' })
      return
    }

    if (newUser.role === 'teacher' && !newUser.grade) {
      notifyError({ title: 'Error', message: 'El grado es obligatorio para docentes' })
      return
    }

    if (newUser.password.length < 6) {
      notifyError({ title: 'Error', message: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    try {
      let result: { success: boolean; data?: unknown }

      if (newUser.role === 'student') {
        if (!newUser.campus || !newUser.grade) {
          notifyError({ title: 'Error', message: 'Sede y grado son obligatorios para estudiantes' })
          return
        }

        if (!newUser.academicYear || newUser.academicYear.toString().length !== 4) {
          notifyError({ title: 'Error', message: 'El año académico es obligatorio y debe tener 4 dígitos (ej: 2026)' })
          return
        }

        const studentData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          campusId: newUser.campus,
          gradeId: newUser.grade,
          userdoc: newUser.password,
          password: newUser.password,
          representativePhone: newUser.representativePhone || undefined,
          academicYear: newUser.academicYear,
          jornada: newUser.jornada || undefined,
        }

        const studentResult = await createStudent.mutateAsync(studentData)
        result = { success: true, data: studentResult }
      } else if (newUser.role === 'teacher') {
        if (!newUser.campus || !newUser.grade) {
          notifyError({ title: 'Error', message: 'Sede y grado son obligatorios para docentes' })
          return
        }

        const teacherData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          campusId: newUser.campus,
          gradeId: newUser.grade,
          phone: undefined,
          password: newUser.password,
          jornada: newUser.jornada || undefined,
        }

        const diagnosticResult = await debugFormData({
          institutionId: teacherData.institutionId,
          campusId: teacherData.campusId,
          gradeId: teacherData.gradeId,
        })

        if (!diagnosticResult?.isValid) {
          throw new Error('Los datos del formulario no son válidos. Revisa la consola para más detalles.')
        }

        const teacherResult = await createTeacher.mutateAsync(teacherData)
        result = { success: true, data: teacherResult }
      } else if (newUser.role === 'principal') {
        if (!newUser.campus) {
          notifyError({ title: 'Error', message: 'Sede es obligatoria para coordinadores' })
          return
        }

        const principalData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          campusId: newUser.campus,
          phone: undefined,
          password: newUser.password,
        }

        const principalResult = await createPrincipal.mutateAsync(principalData)
        result = { success: true, data: principalResult }
      } else {
        const rectorData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          phone: undefined,
          password: newUser.password,
        }

        if (!rectorData.name || !rectorData.email || !rectorData.institutionId) {
          throw new Error('Datos incompletos para crear el rector. Verifica que nombre, email e institución estén completos.')
        }

        const rectorResult = await createRector.mutateAsync(rectorData)
        result = { success: true, data: rectorResult }
      }

      if (!result.success) {
        throw new Error('Error al crear el usuario')
      }

      const effectivePasswordForUser =
        newUser.role === 'student'
          ? newUser.password
          : newUser.password || `${newUser.name.toLowerCase().replace(/\s+/g, '')}123`

      setCreatedUserSummary({
        name: newUser.name,
        email: newUser.email,
        password: effectivePasswordForUser,
      })
      setIsCreateDialogOpen(false)
      setNewUser({
        name: '',
        email: '',
        role: 'student',
        institution: '',
        campus: '',
        grade: '',
        password: '',
        confirmPassword: '',
        representativePhone: '',
        academicYear: new Date().getFullYear(),
        jornada: '' as 'mañana' | 'tarde' | 'única' | '',
      })

    } catch (error) {
      console.error('Error creating user:', error)
      notifyError({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al crear el usuario',
      })
    }
  }

  const isCreating =
    createStudent.isPending ||
    createTeacher.isPending ||
    createPrincipal.isPending ||
    createRector.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Gestión de Usuarios
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Alta de usuarios: solo creación. No se listan ni editan desde aquí.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black text-white hover:bg-gray-800 shrink-0">
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent
            className={cn(
              'max-w-[750px] max-h-[95vh] flex flex-col p-0 overflow-hidden',
              theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : ''
            )}
          >
            <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-gray-200 dark:border-zinc-700">
              <DialogTitle className={cn('text-lg', theme === 'dark' ? 'text-white' : '')}>
                Crear Nuevo Usuario
              </DialogTitle>
              <DialogDescription className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : '')}>
                Crea una nueva cuenta de estudiante, docente, coordinador o rector.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 px-6 py-4 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(95vh - 160px)' }}>
              <div className="grid gap-2.5 pb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="name" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Nombre completo
                    </Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre completo del usuario"
                      className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="email" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Correo electrónico
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="correo@institucion.edu"
                      className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="role" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Rol
                    </Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: 'student' | 'teacher' | 'principal' | 'rector') =>
                        setNewUser((prev) => ({
                          ...prev,
                          role: value,
                          grade: value === 'principal' || value === 'rector' ? '' : prev.grade,
                          campus: value === 'rector' ? '' : prev.campus,
                        }))
                      }
                    >
                      <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Estudiante</SelectItem>
                        <SelectItem value="teacher">Docente</SelectItem>
                        <SelectItem value="principal">Coordinador</SelectItem>
                        <SelectItem value="rector">Rector</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="institution" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Institución
                    </Label>
                    <Select
                      value={newUser.institution}
                      onValueChange={(value) => setNewUser((prev) => ({ ...prev, institution: value, campus: '', grade: '' }))}
                    >
                      <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder={institutionsLoading ? 'Cargando instituciones...' : 'Seleccionar institución'} />
                      </SelectTrigger>
                      <SelectContent>
                        {institutionOptions.map((institution) => (
                          <SelectItem key={institution.value} value={institution.value}>
                            {institution.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newUser.institution && newUser.role !== 'rector' && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="campus" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Sede
                    </Label>
                    <Select
                      value={newUser.campus}
                      onValueChange={(value) => setNewUser((prev) => ({ ...prev, campus: value, grade: '' }))}
                    >
                      <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder={campusLoading ? 'Cargando sedes...' : 'Seleccionar sede'} />
                      </SelectTrigger>
                      <SelectContent>
                        {campusOptions.map((campus) => (
                          <SelectItem key={campus.value} value={campus.value}>
                            {campus.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUser.campus && (newUser.role === 'student' || newUser.role === 'teacher') && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="grade" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Grado
                    </Label>
                    <Select value={newUser.grade} onValueChange={(value) => setNewUser((prev) => ({ ...prev, grade: value }))}>
                      <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder={gradeLoading ? 'Cargando grados...' : 'Seleccionar grado'} />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map((grade) => (
                          <SelectItem key={grade.value} value={grade.value}>
                            {grade.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUser.role === 'teacher' && newUser.grade && (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="teacher-jornada" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                        Jornada
                      </Label>
                      <Select
                        value={newUser.jornada}
                        onValueChange={(value) => setNewUser((prev) => ({ ...prev, jornada: value as 'mañana' | 'tarde' | 'única' }))}
                      >
                        <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                          <SelectValue placeholder="Seleccionar jornada" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mañana">Mañana</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="única">Única</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div
                      className={cn(
                        'p-2 border rounded-md text-xs',
                        theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50/50 border-blue-200'
                      )}
                    >
                      <div className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                        <strong className="text-xs">Docente:</strong> Se asignará al grado seleccionado.
                      </div>
                    </div>
                  </>
                )}

                {newUser.role === 'principal' && newUser.campus && (
                  <div
                    className={cn(
                      'p-2 border rounded-md text-xs',
                      theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50/50 border-blue-200'
                    )}
                  >
                    <div className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                      <strong className="text-xs">Coordinador:</strong> Se asignará a la sede seleccionada.
                    </div>
                  </div>
                )}

                {newUser.role === 'rector' && newUser.institution && (
                  <div
                    className={cn(
                      'p-2 border rounded-md text-xs',
                      theme === 'dark' ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50/50 border-purple-200'
                    )}
                  >
                    <div className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-800')}>
                      <strong className="text-xs">Rector:</strong> Se asignará a toda la institución.
                    </div>
                  </div>
                )}

                {newUser.role === 'student' && newUser.grade && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="jornada" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Jornada
                    </Label>
                    <Select
                      value={newUser.jornada}
                      onValueChange={(value) => setNewUser((prev) => ({ ...prev, jornada: value as 'mañana' | 'tarde' | 'única' }))}
                    >
                      <SelectTrigger className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder="Seleccionar jornada" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="única">Única</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUser.role === 'student' && (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="representativePhone" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                        Teléfono del representante
                      </Label>
                      <Input
                        id="representativePhone"
                        type="tel"
                        value={newUser.representativePhone}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, representativePhone: e.target.value }))}
                        placeholder="Ej: +57 300 1234567"
                        className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="academicYear" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                        Año académico (cohorte) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="academicYear"
                        type="number"
                        value={newUser.academicYear || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || (value.length <= 4 && /^\d+$/.test(value))) {
                            setNewUser((prev) => ({
                              ...prev,
                              academicYear: value ? parseInt(value, 10) : new Date().getFullYear(),
                            }))
                          }
                        }}
                        placeholder="Ej: 2026"
                        min={2020}
                        max={2100}
                        required
                        className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Año de matrícula (4 dígitos). Obligatorio para estudiantes.
                      </p>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="grid gap-1.5">
                    <Label htmlFor="password" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Contraseña temporal
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Contraseña temporal"
                      className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirmPassword" className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : '')}>
                      Confirmar contraseña
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirmar contraseña"
                      className={cn('h-9', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 pb-4 pt-3 border-t border-gray-200 dark:border-zinc-700 shrink-0 bg-inherit">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleCreateUser()} disabled={isCreating} className="bg-black text-white hover:bg-gray-800">
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Usuario'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!createdUserSummary} onOpenChange={(open) => !open && setCreatedUserSummary(null)}>
        <DialogContent className={cn('max-w-md', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Registro completado</DialogTitle>
            <DialogDescription className="sr-only">Datos del usuario registrado</DialogDescription>
          </DialogHeader>
          {createdUserSummary && (
            <p className={cn('text-sm leading-relaxed px-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-800')}>
              El usuario <strong>{createdUserSummary.name}</strong>, correo <strong>{createdUserSummary.email}</strong> y contraseña{' '}
              <strong>{createdUserSummary.password}</strong> ya se encuentra registrado en Superate.IA.
            </p>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" type="button" onClick={() => setCreatedUserSummary(null)} className={cn(theme === 'dark' ? 'border-zinc-600' : '')}>
              Cerrar
            </Button>
            <Button type="button" className="bg-black text-white hover:bg-gray-800" onClick={() => void handleCopyCreatedUserSummary()}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
