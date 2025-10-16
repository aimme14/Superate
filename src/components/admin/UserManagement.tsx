import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  UserPlus, 
  Search, 
  GraduationCap, 
  Crown,
  MoreVertical,
  Users,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
// import { createUserByAdmin } from '@/controllers/admin.controller' // No se usa actualmente
import { useInstitutionOptions, useCampusOptions, useGradeOptions, useAllGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useTeacherMutations, useFilteredTeachers, useTeachersByCampus } from '@/hooks/query/useTeacherQuery'
import { usePrincipalMutations, useFilteredPrincipals } from '@/hooks/query/usePrincipalQuery'
import { useRectorMutations, useFilteredRectors } from '@/hooks/query/useRectorQuery'
import { useFilteredStudents, useStudentMutations } from '@/hooks/query/useStudentQuery'
import { useAdminMutations } from '@/hooks/query/useAdminMutations'
import { debugFormData } from '@/utils/debugFormData'

// Componente para mostrar la información del coordinador con sus docentes
interface CoordinatorCardProps {
  principal: any
  theme: 'light' | 'dark'
  onEdit: (principal: any) => void
  onDelete: (principal: any) => void
}

function CoordinatorCard({ principal, theme, onEdit, onDelete }: CoordinatorCardProps) {
  const [showTeachers, setShowTeachers] = useState(false)
  
  // Obtener docentes de la sede del coordinador (siempre cargar para mostrar contador)
  const { data: teachers, isLoading: teachersLoading } = useTeachersByCampus(
    principal.campusId, 
    true // Siempre cargar para mostrar el contador de docentes
  )

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-medium">
            {principal.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h3 className={cn('font-medium text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {principal.name}
            </h3>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {principal.email}
            </p>
            <div className="flex items-center space-x-4 mt-2">
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Institución:</span>
                <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{principal.institutionName || 'N/A'}</span>
              </div>
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sede:</span>
                <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{principal.campusName || 'N/A'}</span>
              </div>
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Docentes:</span>
                <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {teachers ? teachers.length : 0} docentes
                </span>
              </div>
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estudiantes:</span>
                <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{principal.studentCount || 0} estudiantes</span>
              </div>
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado:</span>
                <Badge className="ml-1 bg-black text-white">{principal.isActive ? 'Activo' : 'Inactivo'}</Badge>
              </div>
              <div className="text-sm">
                <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Creado:</span>
                <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {principal.createdAt ? new Date(principal.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeachers(!showTeachers)}
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            {showTeachers ? 'Ocultar' : 'Ver'} Docentes
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(principal)}>
                <Edit className="h-4 w-4 mr-2" />
                Actualizar datos
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(principal)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sección expandible para mostrar docentes */}
      {showTeachers && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600">
          <h4 className={cn('font-medium mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Docentes asignados a esta sede
          </h4>
          
          {teachersLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className={cn('ml-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Cargando docentes...
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {teachers && teachers.length > 0 ? (
                teachers.map((teacher: any) => (
                  <div key={teacher.id} className={cn(
                    'flex items-center justify-between p-3 rounded-md border',
                    theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-white'
                  )}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                        {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {teacher.name}
                        </p>
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {teacher.email}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Grado: {teacher.gradeName || 'N/A'}
                          </span>
                          <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            • {teacher.studentCount || 0} estudiantes
                          </span>
                          <Badge 
                            className="text-xs px-1 py-0"
                            variant={teacher.isActive ? "default" : "secondary"}
                          >
                            {teacher.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={cn('text-center py-6', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay docentes asignados a esta sede</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface UserManagementProps {
  theme: 'light' | 'dark'
}

export default function UserManagement({ theme }: UserManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const [activeTab, setActiveTab] = useState('students')
  
  // Hook para mutaciones administrativas
  const { recalculateCounts, isRecalculating } = useAdminMutations()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null)
  const [selectedRector, setSelectedRector] = useState<any>(null)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [editTeacherData, setEditTeacherData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: ''
  })
  const [editPrincipalData, setEditPrincipalData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: ''
  })
  const [editRectorData, setEditRectorData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: ''
  })
  const [editStudentData, setEditStudentData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    userdoc: '',
    password: ''
  })
  
  // Hooks para docentes
  const { createTeacher, deleteTeacherFromGrade, updateTeacherInGrade } = useTeacherMutations()
  
  // Hooks para coordinadores
  const { createPrincipal, updatePrincipal, deletePrincipal } = usePrincipalMutations()
  
  // Hooks para rectores
  const { createRector, updateRector, deleteRector } = useRectorMutations()
  
  // Hooks para estudiantes
  const { createStudent, updateStudent, deleteStudent } = useStudentMutations()
  
  // Filtros para docentes
  const { teachers: filteredTeachers, isLoading: filteredTeachersLoading } = useFilteredTeachers({
    searchTerm: searchTerm || undefined,
    institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
    isActive: true
  })

  // Filtros para coordinadores
  const { principals: filteredPrincipals, isLoading: filteredPrincipalsLoading } = useFilteredPrincipals({
    searchTerm: searchTerm || undefined,
    institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
    isActive: true
  })

  // Filtros para rectores
  const { rectors: filteredRectors, isLoading: filteredRectorsLoading } = useFilteredRectors({
    searchTerm: searchTerm || undefined,
    institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
    isActive: true
  })

  // Filtros para estudiantes
  const { students: filteredStudents, isLoading: filteredStudentsLoading } = useFilteredStudents({
    searchTerm: searchTerm || undefined,
    institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
    gradeId: selectedGrade !== 'all' ? selectedGrade : undefined,
    isActive: true
  })
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student' as 'student' | 'teacher' | 'principal' | 'rector',
    institution: '',
    campus: '',
    grade: '',
    password: '',
    confirmPassword: ''
  })


  // Obtener opciones dinámicas de instituciones
  const { options: institutionOptions, isLoading: institutionsLoading } = useInstitutionOptions()
  
  // Obtener opciones de sedes basadas en la institución seleccionada
  const { options: campusOptions, isLoading: campusLoading } = useCampusOptions(newUser.institution || '')
  
  // Obtener opciones de grados basadas en la sede seleccionada
  const { options: gradeOptions, isLoading: gradeLoading } = useGradeOptions(
    newUser.institution || '', 
    newUser.campus || ''
  )

  // Obtener todas las opciones de grados para los filtros
  const { options: allGradeOptions } = useAllGradeOptions()




  // Función para obtener grados filtrados por institución seleccionada
  const getFilteredGrades = () => {
    if (selectedInstitution === 'all') {
      return allGradeOptions
    }
    return allGradeOptions.filter(grade => grade.institutionId === selectedInstitution)
  }

  // Efecto para resetear el filtro de grados cuando cambie la institución
  useEffect(() => {
    if (selectedInstitution !== 'all') {
      // Verificar si el grado seleccionado pertenece a la nueva institución
      const filteredGrades = getFilteredGrades()
      const currentGradeExists = filteredGrades.some(grade => grade.value === selectedGrade)
      
      if (!currentGradeExists && selectedGrade !== 'all') {
        setSelectedGrade('all')
      }
    }
  }, [selectedInstitution, allGradeOptions])


  const handleEditTeacher = (teacher: any) => {
    setSelectedTeacher(teacher)
    setEditTeacherData({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      isActive: teacher.isActive,
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateTeacher = async () => {
    if (!selectedTeacher || !editTeacherData.name || !editTeacherData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    try {
      await updateTeacherInGrade.mutateAsync({
        institutionId: selectedTeacher.institutionId,
        campusId: selectedTeacher.campusId,
        gradeId: selectedTeacher.gradeId,
        teacherId: selectedTeacher.id,
        data: editTeacherData
      })
      
      notifySuccess({ title: 'Éxito', message: 'Docente actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedTeacher(null)
      setEditTeacherData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: ''
      })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el docente' })
    }
  }

  const handleDeleteTeacher = (teacher: any) => {
    setSelectedTeacher(teacher)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteTeacher = async () => {
    if (!selectedTeacher) return

    try {
      await deleteTeacherFromGrade.mutateAsync({
        institutionId: selectedTeacher.institutionId,
        campusId: selectedTeacher.campusId,
        gradeId: selectedTeacher.gradeId,
        teacherId: selectedTeacher.id
      })
      
      notifySuccess({ title: 'Éxito', message: 'Docente eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedTeacher(null)
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el docente' })
    }
  }

  // Funciones para coordinadores
  const handleEditPrincipal = (principal: any) => {
    setSelectedPrincipal(principal)
    setEditPrincipalData({
      name: principal.name,
      email: principal.email,
      phone: principal.phone || '',
      isActive: principal.isActive,
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePrincipal = async () => {
    if (!selectedPrincipal || !editPrincipalData.name || !editPrincipalData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    try {
      await updatePrincipal.mutateAsync({
        institutionId: selectedPrincipal.institutionId,
        campusId: selectedPrincipal.campusId,
        principalId: selectedPrincipal.id,
        data: {
          ...editPrincipalData,
          password: editPrincipalData.password || undefined
        }
      })
      
      notifySuccess({ title: 'Éxito', message: 'Coordinador actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedPrincipal(null)
      setEditPrincipalData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: ''
      })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el coordinador' })
    }
  }

  const handleDeletePrincipal = (principal: any) => {
    setSelectedPrincipal(principal)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeletePrincipal = async () => {
    if (!selectedPrincipal) return

    try {
      await deletePrincipal.mutateAsync({
        institutionId: selectedPrincipal.institutionId,
        campusId: selectedPrincipal.campusId,
        principalId: selectedPrincipal.id
      })
      
      notifySuccess({ title: 'Éxito', message: 'Coordinador eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedPrincipal(null)
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el coordinador' })
    }
  }

  // Funciones para rectores
  const handleEditRector = (rector: any) => {
    setSelectedRector(rector)
    setEditRectorData({
      name: rector.name,
      email: rector.email,
      phone: rector.phone || '',
      isActive: rector.isActive,
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateRector = async () => {
    if (!selectedRector || !editRectorData.name || !editRectorData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    try {
      await updateRector.mutateAsync({
        institutionId: selectedRector.institutionId,
        rectorId: selectedRector.id,
        data: editRectorData
      })
      
      notifySuccess({ title: 'Éxito', message: 'Rector actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedRector(null)
      setEditRectorData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: ''
      })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el rector' })
    }
  }

  const handleDeleteRector = (rector: any) => {
    setSelectedRector(rector)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteRector = async () => {
    if (!selectedRector) return

    try {
      await deleteRector.mutateAsync({
        institutionId: selectedRector.institutionId,
        rectorId: selectedRector.id
      })
      
      notifySuccess({ title: 'Éxito', message: 'Rector eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedRector(null)
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el rector' })
    }
  }

  // Funciones para estudiantes
  const handleEditStudent = (student: any) => {
    setSelectedStudent(student)
    setEditStudentData({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      isActive: student.isActive,
      userdoc: student.userdoc || '',
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateStudent = async () => {
    if (!selectedStudent || !editStudentData.name || !editStudentData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    try {
      await updateStudent.mutateAsync({
        studentId: selectedStudent.id,
        studentData: {
          ...editStudentData,
          password: editStudentData.password || undefined
        }
      })
      
      notifySuccess({ title: 'Éxito', message: 'Estudiante actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedStudent(null)
      setEditStudentData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        userdoc: '',
        password: ''
      })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el estudiante' })
    }
  }

  const handleDeleteStudent = (student: any) => {
    setSelectedStudent(student)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteStudent = async () => {
    if (!selectedStudent) return

    try {
      await deleteStudent.mutateAsync(selectedStudent.id)
      
      notifySuccess({ title: 'Éxito', message: 'Estudiante eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedStudent(null)
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el estudiante' })
    }
  }

  const handleCreateUser = async () => {
    if (newUser.password !== newUser.confirmPassword) {
      notifyError({ title: 'Error', message: 'Las contraseñas no coinciden' })
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
      let result
      
      if (newUser.role === 'student') {
        // Para estudiantes, usar el nuevo controlador
        if (!newUser.campus || !newUser.grade) {
          notifyError({ title: 'Error', message: 'Sede y grado son obligatorios para estudiantes' })
          return
        }
        
        const studentData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          campusId: newUser.campus,
          gradeId: newUser.grade,
          userdoc: newUser.password, // Usar la contraseña como documento temporal
          password: newUser.password
        }
        
        console.log('🔍 Datos del estudiante desde el formulario:', studentData)
        
        try {
          const studentResult = await createStudent.mutateAsync(studentData)
          console.log('✅ Estudiante creado desde formulario:', studentResult)
          
          result = { success: true, data: studentResult }
        } catch (studentError) {
          console.error('❌ Error al crear estudiante desde formulario:', studentError)
          throw new Error('Error al crear el estudiante: ' + (studentError instanceof Error ? studentError.message : 'Error desconocido'))
        }
      } else if (newUser.role === 'teacher') {
        // Para docentes, usar la nueva lógica que almacena en el grado específico
        if (!newUser.campus || !newUser.grade) {
          notifyError({ title: 'Error', message: 'Sede y grado son obligatorios para docentes' })
          return
        }
        
        // Los docentes no necesitan materias específicas asignadas
        const teacherData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          campusId: newUser.campus,
          gradeId: newUser.grade,
          phone: undefined,
          password: newUser.password // Pasar la contraseña al controlador
        }
        
        console.log('🔍 Datos del docente desde el formulario:', teacherData)
        
        // Diagnosticar los datos antes de crear el docente
        console.log('🔍 Iniciando diagnóstico de datos...')
        const diagnosticResult = await debugFormData({
          institutionId: teacherData.institutionId,
          campusId: teacherData.campusId,
          gradeId: teacherData.gradeId
        })
        
        if (!diagnosticResult?.isValid) {
          throw new Error('Los datos del formulario no son válidos. Revisa la consola para más detalles.')
        }
        
        try {
          const teacherResult = await createTeacher.mutateAsync(teacherData)
          console.log('✅ Docente creado desde formulario:', teacherResult)
          
          // Verificar que se almacenó correctamente
          console.log('🔍 Verificando almacenamiento...')
          const verificationResult = await debugFormData({
            institutionId: teacherData.institutionId,
            campusId: teacherData.campusId,
            gradeId: teacherData.gradeId
          })
          
          if (verificationResult?.isValid && verificationResult.grade.teachers) {
            console.log('✅ Docente almacenado correctamente en el grado!')
            console.log('👨‍🏫 Total de docentes en el grado:', verificationResult.grade.teachers.length)
            console.log('📋 Lista de docentes:', verificationResult.grade.teachers.map((t: any) => t.name))
          }
          
          result = { success: true, data: teacherResult }
        } catch (teacherError) {
          console.error('❌ Error al crear docente desde formulario:', teacherError)
          throw new Error('Error al crear el docente: ' + (teacherError instanceof Error ? teacherError.message : 'Error desconocido'))
        }
      } else if (newUser.role === 'principal') {
        // Para coordinadores, usar la nueva lógica que almacena en la sede
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
          password: newUser.password // Pasar la contraseña al controlador
        }
        
        console.log('🔍 Datos del coordinador desde el formulario:', principalData)
        
        try {
          const principalResult = await createPrincipal.mutateAsync(principalData)
          console.log('✅ Coordinador creado desde formulario:', principalResult)
          
          result = { success: true, data: principalResult }
        } catch (principalError) {
          console.error('❌ Error al crear coordinador desde formulario:', principalError)
          throw new Error('Error al crear el coordinador: ' + (principalError instanceof Error ? principalError.message : 'Error desconocido'))
        }
      } else {
        // Para rectores, usar la nueva lógica que almacena en la institución
        const rectorData = {
          name: newUser.name,
          email: newUser.email,
          institutionId: newUser.institution,
          phone: undefined,
          password: newUser.password // Pasar la contraseña al controlador
        }
        
        console.log('🔍 Datos del rector desde el formulario:', rectorData)
        
        // Validar datos antes de enviar
        if (!rectorData.name || !rectorData.email || !rectorData.institutionId) {
          throw new Error('Datos incompletos para crear el rector. Verifica que nombre, email e institución estén completos.')
        }
        
        try {
          console.log('📤 Enviando solicitud de creación de rector...')
          const rectorResult = await createRector.mutateAsync(rectorData)
          console.log('✅ Rector creado desde formulario:', rectorResult)
          
          result = { success: true, data: rectorResult }
        } catch (rectorError) {
          console.error('❌ Error al crear rector desde formulario:', rectorError)
          
          // Proporcionar mensajes de error más específicos
          let errorMessage = 'Error al crear el rector'
          if (rectorError instanceof Error) {
            if (rectorError.message.includes('email-already-in-use')) {
              errorMessage = 'El email ya está en uso. Por favor, usa un email diferente.'
            } else if (rectorError.message.includes('weak-password')) {
              errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.'
            } else if (rectorError.message.includes('invalid-email')) {
              errorMessage = 'El formato del email no es válido.'
            } else {
              errorMessage = `Error al crear el rector: ${rectorError.message}`
            }
          }
          
          throw new Error(errorMessage)
        }
      }
      
      if (!result.success) {
        throw new Error((result as any).error?.message || 'Error al crear el usuario')
      }

      setIsCreateDialogOpen(false)
      setNewUser({
        name: '',
        email: '',
        role: 'student',
        institution: '',
        campus: '',
        grade: '',
        password: '',
        confirmPassword: ''
      })
      notifySuccess({ 
        title: 'Éxito', 
        message: `${newUser.role === 'student' ? 'Estudiante' : newUser.role === 'teacher' ? 'Docente' : newUser.role === 'principal' ? 'Coordinador' : 'Rector'} creado correctamente. Tu sesión se cerrará automáticamente, deberás volver a iniciar sesión.` 
      })
      
      // Esperar un momento para que el usuario vea el mensaje y luego cerrar sesión
      setTimeout(() => {
        window.location.href = '/login'
      }, 3000)
    } catch (error) {
      console.error('Error creating user:', error)
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al crear el usuario' 
      })
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
            Administra estudiantes y docentes del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => recalculateCounts()}
            disabled={isRecalculating}
            variant="outline"
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRecalculating && "animate-spin")} />
            {isRecalculating ? 'Recalculando...' : 'Recalcular Contadores'}
          </Button>
          
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
                  Crea una nueva cuenta de estudiante, docente o coordinador en el sistema.
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
                  <Select value={newUser.role} onValueChange={(value: 'student' | 'teacher' | 'principal' | 'rector') => setNewUser(prev => ({ ...prev, role: value, grade: (value === 'principal' || value === 'rector') ? '' : prev.grade, campus: value === 'rector' ? '' : prev.campus }))}>
                    <SelectTrigger>
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
                <div className="grid gap-2">
                  <Label htmlFor="institution">Institución</Label>
                  <Select 
                    value={newUser.institution} 
                    onValueChange={(value) => setNewUser(prev => ({ ...prev, institution: value, campus: '', grade: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={institutionsLoading ? 'Cargando instituciones...' : 'Seleccionar institución'} />
                    </SelectTrigger>
                    <SelectContent>
                      {institutionOptions.map(institution => (
                        <SelectItem key={institution.value} value={institution.value}>
                          {institution.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newUser.institution && newUser.role !== 'rector' && (
                  <div className="grid gap-2">
                    <Label htmlFor="campus">Sede</Label>
                    <Select 
                      value={newUser.campus} 
                      onValueChange={(value) => setNewUser(prev => ({ ...prev, campus: value, grade: '' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={campusLoading ? 'Cargando sedes...' : 'Seleccionar sede'} />
                      </SelectTrigger>
                      <SelectContent>
                        {campusOptions.map(campus => (
                          <SelectItem key={campus.value} value={campus.value}>
                            {campus.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUser.campus && (newUser.role === 'student' || newUser.role === 'teacher') && (
                  <div className="grid gap-2">
                    <Label htmlFor="grade">Grado</Label>
                    <Select value={newUser.grade} onValueChange={(value) => setNewUser(prev => ({ ...prev, grade: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder={gradeLoading ? 'Cargando grados...' : 'Seleccionar grado'} />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map(grade => (
                          <SelectItem key={grade.value} value={grade.value}>
                            {grade.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newUser.role === 'teacher' && newUser.grade && (
                  <div className="grid gap-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm text-blue-800">
                        <strong>Información del Docente:</strong>
                        <br />
                        • Se asignará como docente del grado seleccionado
                        <br />
                        • Los estudiantes del grado se le asignarán automáticamente
                        <br />
                        • No se requiere selección de materias específicas
                      </div>
                    </div>
                  </div>
                )}

                {newUser.role === 'principal' && newUser.campus && (
                  <div className="grid gap-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm text-blue-800">
                        <strong>Información del Coordinador:</strong>
                        <br />
                        • Se asignará como coordinador general de toda la sede
                        <br />
                        • Tendrá acceso a todos los grados de la sede seleccionada
                        <br />
                        • No se requiere selección de grado específico
                      </div>
                    </div>
                  </div>
                )}

                {newUser.role === 'rector' && newUser.institution && (
                  <div className="grid gap-2">
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                      <div className="text-sm text-purple-800">
                        <strong>Información del Rector:</strong>
                        <br />
                        • Se asignará como rector de toda la institución
                        <br />
                        • Tendrá acceso a todas las sedes de la institución
                        <br />
                        • Podrá ver todos los coordinadores, docentes y estudiantes
                        <br />
                        • No se requiere selección de sede o grado específico
                      </div>
                    </div>
                  </div>
                )}
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
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="students" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Estudiantes</span>
          </TabsTrigger>
          <TabsTrigger value="teachers" className="flex items-center space-x-2">
            <GraduationCap className="h-4 w-4" />
            <span>Docentes</span>
          </TabsTrigger>
          <TabsTrigger value="principals" className="flex items-center space-x-2">
            <Crown className="h-4 w-4" />
            <span>Coordinador</span>
          </TabsTrigger>
          <TabsTrigger value="rectors" className="flex items-center space-x-2">
            <Crown className="h-4 w-4" />
            <span>Rectores</span>
          </TabsTrigger>
        </TabsList>

        {/* Filtros y búsqueda */}
        <div className="mt-6">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={
                        activeTab === 'students' ? 'Buscar estudiantes...' :
                        activeTab === 'teachers' ? 'Buscar docentes...' :
                        activeTab === 'principals' ? 'Buscar coordinadores...' :
                        'Buscar rectores...'
                      }
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Institución" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las instituciones</SelectItem>
                    {institutionOptions.map(institution => (
                      <SelectItem key={institution.value} value={institution.value}>
                        {institution.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeTab === 'students' && (
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Grado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los grados</SelectItem>
                      {getFilteredGrades().map(grade => (
                        <SelectItem key={grade.value} value={grade.value}>
                          {grade.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Content */}
        <TabsContent value="students" className="space-y-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Estudiantes ({filteredStudents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredStudentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredStudents.map((student: any) => (
                    <div key={student.id} className={cn('flex items-center justify-between p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-medium">
                          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {student.name}
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {student.email}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Institución:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{student.institutionName || student.inst || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sede:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{student.campusName || student.campus || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Grado:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{student.gradeName || student.grade || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Documento:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{student.userdoc || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado:</span>
                              <Badge className="ml-1 bg-black text-white">{student.isActive ? 'Activo' : 'Inactivo'}</Badge>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Creado:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Actualizar datos
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteStudent(student)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <div className="text-center py-8">
                      <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        No se encontraron estudiantes con los filtros aplicados
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Docentes ({filteredTeachers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTeachersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTeachers.map((teacher) => (
                    <div key={teacher.id} className={cn('flex items-center justify-between p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-medium">
                          {teacher.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {teacher.name}
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {teacher.email}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Institución:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{teacher.institutionName || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sede:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{teacher.campusName || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Grado:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{teacher.gradeName || teacher.gradeId || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estudiantes:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{teacher.studentCount || 0} estudiantes</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado:</span>
                              <Badge className="ml-1 bg-black text-white">{teacher.isActive ? 'Activo' : 'Inactivo'}</Badge>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Creado:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditTeacher(teacher)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Actualizar datos
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTeacher(teacher)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="principals" className="space-y-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Coordinadores ({filteredPrincipals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPrincipalsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPrincipals.map((principal) => (
                    <CoordinatorCard 
                      key={principal.id} 
                      principal={principal} 
                      theme={theme}
                      onEdit={handleEditPrincipal}
                      onDelete={handleDeletePrincipal}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rectors" className="space-y-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Rectores ({filteredRectors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRectorsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRectors.map((rector) => (
                    <div key={rector.id} className={cn('flex items-center justify-between p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                          {rector.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {rector.name}
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {rector.email}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Institución:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{rector.institutionName || 'N/A'}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sedes:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{rector.campusCount || 0} sedes</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Coordinadores:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{rector.principalCount || 0}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Docentes:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{rector.teacherCount || 0}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estudiantes:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{rector.studentCount || 0}</span>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado:</span>
                              <Badge className="ml-1 bg-purple-600 text-white">{rector.isActive ? 'Activo' : 'Inactivo'}</Badge>
                            </div>
                            <div className="text-sm">
                              <span className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Creado:</span>
                              <span className={cn('ml-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {rector.createdAt ? new Date(rector.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRector(rector)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Actualizar datos
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRector(rector)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {filteredRectors.length === 0 && (
                    <div className="text-center py-8">
                      <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        No se encontraron rectores con los filtros aplicados
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar docente/coordinador */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedTeacher ? 'Actualizar Docente' : 
               selectedPrincipal ? 'Actualizar Coordinador' : 
               selectedRector ? 'Actualizar Rector' : 
               selectedStudent ? 'Actualizar Estudiante' : 
               'Actualizar Usuario'}
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del {selectedTeacher ? 'docente' : 
                                   selectedPrincipal ? 'coordinador' : 
                                   selectedRector ? 'rector' : 
                                   selectedStudent ? 'estudiante' : 
                                   'usuario'} seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre completo</Label>
              <Input
                id="edit-name"
                value={selectedTeacher ? editTeacherData.name : selectedPrincipal ? editPrincipalData.name : selectedRector ? editRectorData.name : editStudentData.name}
                onChange={(e) => {
                  if (selectedTeacher) {
                    setEditTeacherData(prev => ({ ...prev, name: e.target.value }))
                  } else if (selectedPrincipal) {
                    setEditPrincipalData(prev => ({ ...prev, name: e.target.value }))
                  } else if (selectedRector) {
                    setEditRectorData(prev => ({ ...prev, name: e.target.value }))
                  } else {
                    setEditStudentData(prev => ({ ...prev, name: e.target.value }))
                  }
                }}
                placeholder={`Nombre completo del ${selectedTeacher ? 'docente' : selectedPrincipal ? 'coordinador' : selectedRector ? 'rector' : selectedStudent ? 'estudiante' : 'usuario'}`}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Correo electrónico</Label>
              <Input
                id="edit-email"
                type="email"
                value={selectedTeacher ? editTeacherData.email : selectedPrincipal ? editPrincipalData.email : selectedRector ? editRectorData.email : editStudentData.email}
                onChange={(e) => {
                  if (selectedTeacher) {
                    setEditTeacherData(prev => ({ ...prev, email: e.target.value }))
                  } else if (selectedPrincipal) {
                    setEditPrincipalData(prev => ({ ...prev, email: e.target.value }))
                  } else if (selectedRector) {
                    setEditRectorData(prev => ({ ...prev, email: e.target.value }))
                  } else {
                    setEditStudentData(prev => ({ ...prev, email: e.target.value }))
                  }
                }}
                placeholder="correo@institucion.edu"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Teléfono (opcional)</Label>
              <Input
                id="edit-phone"
                value={selectedTeacher ? editTeacherData.phone : selectedPrincipal ? editPrincipalData.phone : selectedRector ? editRectorData.phone : editStudentData.phone}
                onChange={(e) => {
                  if (selectedTeacher) {
                    setEditTeacherData(prev => ({ ...prev, phone: e.target.value }))
                  } else if (selectedPrincipal) {
                    setEditPrincipalData(prev => ({ ...prev, phone: e.target.value }))
                  } else if (selectedRector) {
                    setEditRectorData(prev => ({ ...prev, phone: e.target.value }))
                  } else {
                    setEditStudentData(prev => ({ ...prev, phone: e.target.value }))
                  }
                }}
                placeholder="Número de teléfono"
              />
            </div>
            {selectedStudent && (
              <div className="grid gap-2">
                <Label htmlFor="edit-userdoc">Documento de identidad</Label>
                <Input
                  id="edit-userdoc"
                  value={editStudentData.userdoc}
                  onChange={(e) => {
                    setEditStudentData(prev => ({ ...prev, userdoc: e.target.value }))
                  }}
                  placeholder="Número de documento"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={selectedTeacher ? editTeacherData.password : selectedPrincipal ? editPrincipalData.password : selectedRector ? editRectorData.password : editStudentData.password}
                onChange={(e) => {
                  if (selectedTeacher) {
                    setEditTeacherData(prev => ({ ...prev, password: e.target.value }))
                  } else if (selectedPrincipal) {
                    setEditPrincipalData(prev => ({ ...prev, password: e.target.value }))
                  } else if (selectedRector) {
                    setEditRectorData(prev => ({ ...prev, password: e.target.value }))
                  } else {
                    setEditStudentData(prev => ({ ...prev, password: e.target.value }))
                  }
                }}
                placeholder="Dejar vacío para mantener la contraseña actual"
              />
              <p className="text-xs text-gray-500">
                Si cambias el email, el usuario deberá hacer login con las nuevas credenciales
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={selectedTeacher ? editTeacherData.isActive : selectedPrincipal ? editPrincipalData.isActive : selectedRector ? editRectorData.isActive : editStudentData.isActive}
                onChange={(e) => {
                  if (selectedTeacher) {
                    setEditTeacherData(prev => ({ ...prev, isActive: e.target.checked }))
                  } else if (selectedPrincipal) {
                    setEditPrincipalData(prev => ({ ...prev, isActive: e.target.checked }))
                  } else if (selectedRector) {
                    setEditRectorData(prev => ({ ...prev, isActive: e.target.checked }))
                  } else {
                    setEditStudentData(prev => ({ ...prev, isActive: e.target.checked }))
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="edit-active">
                {selectedTeacher ? 'Docente' : selectedPrincipal ? 'Coordinador' : selectedRector ? 'Rector' : selectedStudent ? 'Estudiante' : 'Usuario'} activo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false)
              setSelectedTeacher(null)
              setSelectedPrincipal(null)
              setSelectedRector(null)
              setSelectedStudent(null)
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={selectedTeacher ? handleUpdateTeacher : 
                      selectedPrincipal ? handleUpdatePrincipal : 
                      selectedRector ? handleUpdateRector : 
                      handleUpdateStudent} 
              className="bg-black text-white hover:bg-gray-800"
            >
              Actualizar {selectedTeacher ? 'Docente' : 
                        selectedPrincipal ? 'Coordinador' : 
                        selectedRector ? 'Rector' : 
                        selectedStudent ? 'Estudiante' : 
                        'Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el{' '}
              {selectedTeacher ? 'docente' : 
               selectedPrincipal ? 'coordinador' : 
               selectedRector ? 'rector' : 
               selectedStudent ? 'estudiante' : 
               'usuario'}{' '}
              <strong>{selectedTeacher?.name || selectedPrincipal?.name || selectedRector?.name || selectedStudent?.name}</strong> del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={selectedTeacher ? confirmDeleteTeacher : selectedPrincipal ? confirmDeletePrincipal : selectedRector ? confirmDeleteRector : confirmDeleteStudent}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
