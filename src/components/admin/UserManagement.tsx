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
  RefreshCw,
  Building2,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
// import { createUserByAdmin } from '@/controllers/admin.controller' // No se usa actualmente
import { useInstitutionOptions, useCampusOptions, useGradeOptions, useAllGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useTeacherMutations, useFilteredTeachers, useTeachersByCampus } from '@/hooks/query/useTeacherQuery'
import { usePrincipalMutations, useFilteredPrincipals } from '@/hooks/query/usePrincipalQuery'
import { useRectorMutations, useFilteredRectors } from '@/hooks/query/useRectorQuery'
import { useFilteredStudents, useStudentMutations, useStudentsByTeacher } from '@/hooks/query/useStudentQuery'
import { useAdminMutations } from '@/hooks/query/useAdminMutations'
import { debugFormData } from '@/utils/debugFormData'
import { useAuthContext } from '@/context/AuthContext'

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
                  <CoordinatorTeacherCard
                    key={teacher.id}
                    theme={theme}
                    teacher={teacher}
                  />
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

// Componente para tarjeta de docente dentro del coordinador
interface CoordinatorTeacherCardProps {
  theme: 'light' | 'dark'
  teacher: any
}

function CoordinatorTeacherCard({ theme, teacher }: CoordinatorTeacherCardProps) {
  const [showStudents, setShowStudents] = useState(false)
  const teacherId = teacher.id || teacher.uid
  
  // Obtener estudiantes del docente
  const { students: filteredStudentsByTeacher } = useFilteredStudents({
    institutionId: teacher.institutionId || teacher.inst,
    campusId: teacher.campusId || teacher.campus,
    gradeId: teacher.gradeId || teacher.grade,
    isActive: true
  })
  
  const { data: teacherStudents, isLoading: studentsLoading, error: studentsError } = useStudentsByTeacher(teacherId || '', showStudents)
  const displayStudents = showStudents ? (teacherStudents && teacherStudents.length > 0 ? teacherStudents : filteredStudentsByTeacher) : []

  return (
    <div className={cn(
      'p-3 rounded-md border',
      theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-center justify-between">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStudents(!showStudents)}
          className={cn(
            "border-blue-500",
            theme === 'dark' 
              ? 'text-blue-400 hover:bg-blue-900/20' 
              : 'text-blue-600 hover:bg-blue-50'
          )}
        >
          <Users className="h-4 w-4 mr-2" />
          {showStudents ? 'Ocultar' : 'Ver'} Estudiantes
        </Button>
      </div>

      {showStudents && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {studentsLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={cn('ml-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Cargando...
              </span>
            </div>
          ) : studentsError ? (
            <div className={cn('text-center py-2 text-xs text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar estudiantes
            </div>
          ) : displayStudents && displayStudents.length > 0 ? (
            displayStudents.map((student: any) => (
              <CoordinatorStudentCard
                key={student.id || student.uid}
                theme={theme}
                student={student}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de estudiante dentro del coordinador
interface CoordinatorStudentCardProps {
  theme: 'light' | 'dark'
  student: any
}

function CoordinatorStudentCard({ theme, student }: CoordinatorStudentCardProps) {
  return (
    <div className={cn('p-2 rounded border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-medium">
          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <p className={cn('font-medium text-xs', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {student.name}
          </p>
          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.email}
          </p>
          {student.gradeName && (
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Grado: {student.gradeName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente para tarjeta de docente en la pestaña de Docentes
interface TeacherCardProps {
  teacher: any
  theme: 'light' | 'dark'
  onEdit: (teacher: any) => void
  onDelete: (teacher: any) => void
}

function TeacherCard({ teacher, theme, onEdit, onDelete }: TeacherCardProps) {
  const [showStudents, setShowStudents] = useState(false)
  const teacherId = teacher.id || teacher.uid
  
  // Obtener estudiantes del docente
  const { students: filteredStudentsByTeacher } = useFilteredStudents({
    institutionId: teacher.institutionId || teacher.inst,
    campusId: teacher.campusId || teacher.campus,
    gradeId: teacher.gradeId || teacher.grade,
    isActive: true
  })
  
  const { data: teacherStudents, isLoading: studentsLoading, error: studentsError } = useStudentsByTeacher(teacherId || '', showStudents)
  const displayStudents = showStudents ? (teacherStudents && teacherStudents.length > 0 ? teacherStudents : filteredStudentsByTeacher) : []

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-medium">
            {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
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
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStudents(!showStudents)}
            className={cn(
              "border-blue-500",
              theme === 'dark' 
                ? 'text-blue-400 hover:bg-blue-900/20' 
                : 'text-blue-600 hover:bg-blue-50'
            )}
          >
            <Users className="h-4 w-4 mr-2" />
            {showStudents ? 'Ocultar' : 'Ver'} Estudiantes
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(teacher)}>
                <Edit className="h-4 w-4 mr-2" />
                Actualizar datos
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(teacher)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showStudents && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {studentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className={cn('ml-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Cargando estudiantes...
              </span>
            </div>
          ) : studentsError ? (
            <div className={cn('text-center py-4 text-sm text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar estudiantes: {studentsError instanceof Error ? studentsError.message : 'Error desconocido'}
            </div>
          ) : displayStudents && displayStudents.length > 0 ? (
            displayStudents.map((student: any) => (
              <TeacherStudentCard
                key={student.id || student.uid}
                theme={theme}
                student={student}
              />
            ))
          ) : (
            <div className={cn('text-center py-4 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes asignados a este docente
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de estudiante dentro del docente
interface TeacherStudentCardProps {
  theme: 'light' | 'dark'
  student: any
}

function TeacherStudentCard({ theme, student }: TeacherStudentCardProps) {
  return (
    <div className={cn('p-3 rounded-md border', theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-white')}>
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {student.name}
          </p>
          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.email}
          </p>
          {student.gradeName && (
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Grado: {student.gradeName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente para mostrar la información del rector con estructura en cadena
interface RectorCardProps {
  rector: any
  theme: 'light' | 'dark'
  onEdit: (rector: any) => void
  onDelete: (rector: any) => void
}

function RectorCard({ rector, theme, onEdit, onDelete }: RectorCardProps) {
  const [showCampuses, setShowCampuses] = useState(false)
  
  // Obtener coordinadores, docentes y estudiantes de la institución del rector
  const { principals: coordinators } = useFilteredPrincipals({
    institutionId: rector.institutionId,
    isActive: true
  })
  
  const { teachers } = useFilteredTeachers({
    institutionId: rector.institutionId,
    isActive: true
  })
  
  const { students } = useFilteredStudents({
    institutionId: rector.institutionId,
    isActive: true
  })

  return (
    <div className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
            {rector.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h3 className={cn('font-medium text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
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
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCampuses(!showCampuses)}
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            <Building2 className="h-4 w-4 mr-2" />
            {showCampuses ? 'Ocultar' : 'Ver'} Sedes
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(rector)}>
                <Edit className="h-4 w-4 mr-2" />
                Actualizar datos
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(rector)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sección expandible para mostrar sedes */}
      {showCampuses && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-600">
          <RectorCampusList
            theme={theme}
            institutionId={rector.institutionId}
            coordinators={coordinators || []}
            teachers={teachers || []}
            students={students || []}
          />
        </div>
      )}
    </div>
  )
}

// Componente para lista de sedes del rector
interface RectorCampusListProps {
  theme: 'light' | 'dark'
  institutionId: string
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function RectorCampusList({ theme, institutionId, coordinators, teachers, students }: RectorCampusListProps) {
  const { options: campusOptions, isLoading } = useCampusOptions(institutionId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        <span className={cn('ml-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          Cargando sedes...
        </span>
      </div>
    )
  }

  if (!campusOptions || campusOptions.length === 0) {
    return (
      <div className={cn('text-center py-4 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
        No hay sedes registradas
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {campusOptions.map((campus) => {
        const campusCoordinators = coordinators.filter((c: any) => c.campusId === campus.value)
        return (
          <RectorCampusCard
            key={campus.value}
            theme={theme}
            campus={campus}
            coordinators={campusCoordinators}
            teachers={teachers}
            students={students}
          />
        )
      })}
    </div>
  )
}

// Componente para tarjeta de sede del rector
interface RectorCampusCardProps {
  theme: 'light' | 'dark'
  campus: any
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function RectorCampusCard({ theme, campus, coordinators, teachers, students }: RectorCampusCardProps) {
  const [showCoordinators, setShowCoordinators] = useState(false)

  return (
    <div className={cn('p-3 rounded-md border', theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-white')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="h-4 w-4 text-purple-500" />
          <div>
            <h4 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {campus.label}
            </h4>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {coordinators.length} coordinador(es)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCoordinators(!showCoordinators)}
          className={cn(
            "border-purple-500",
            theme === 'dark' 
              ? 'text-purple-400 hover:bg-purple-900/20' 
              : 'text-purple-600 hover:bg-purple-50'
          )}
        >
          <Crown className="h-4 w-4 mr-2" />
          {showCoordinators ? 'Ocultar' : 'Ver'} Coordinadores
        </Button>
      </div>

      {showCoordinators && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {coordinators.length > 0 ? (
            coordinators.map((coordinator: any) => (
              <RectorCoordinatorCard
                key={coordinator.id}
                theme={theme}
                coordinator={coordinator}
                teachers={teachers}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay coordinadores asignados a esta sede
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de coordinador del rector
interface RectorCoordinatorCardProps {
  theme: 'light' | 'dark'
  coordinator: any
  teachers: any[]
}

function RectorCoordinatorCard({ theme, coordinator, teachers }: RectorCoordinatorCardProps) {
  const [showTeachers, setShowTeachers] = useState(false)
  const campusTeachers = teachers.filter((t: any) => t.campusId === coordinator.campusId)

  return (
    <div className={cn('p-3 rounded-md border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium">
            {coordinator.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {coordinator.name}
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {coordinator.email}
            </p>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {campusTeachers.length} docente(s)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTeachers(!showTeachers)}
          className={cn(
            "border-purple-500",
            theme === 'dark' 
              ? 'text-purple-400 hover:bg-purple-900/20' 
              : 'text-purple-600 hover:bg-purple-50'
          )}
        >
          <GraduationCap className="h-4 w-4 mr-2" />
          {showTeachers ? 'Ocultar' : 'Ver'} Docentes
        </Button>
      </div>

      {showTeachers && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {campusTeachers.length > 0 ? (
            campusTeachers.map((teacher: any) => (
              <RectorTeacherCard
                key={teacher.id}
                theme={theme}
                teacher={teacher}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay docentes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de docente del rector
interface RectorTeacherCardProps {
  theme: 'light' | 'dark'
  teacher: any
}

function RectorTeacherCard({ theme, teacher }: RectorTeacherCardProps) {
  const [showStudents, setShowStudents] = useState(false)
  // Usar teacher.id o teacher.uid como fallback
  const teacherId = teacher.id || teacher.uid
  
  // También intentar obtener estudiantes directamente usando los filtros del docente
  const { students: filteredStudentsByTeacher } = useFilteredStudents({
    institutionId: teacher.institutionId || teacher.inst,
    campusId: teacher.campusId || teacher.campus,
    gradeId: teacher.gradeId || teacher.grade,
    isActive: true
  })
  
  const { data: teacherStudents, isLoading: studentsLoading, error: studentsError } = useStudentsByTeacher(teacherId || '', showStudents)

  // Usar los estudiantes del hook o los filtrados directamente
  const displayStudents = showStudents ? (teacherStudents && teacherStudents.length > 0 ? teacherStudents : filteredStudentsByTeacher) : []

  // Debug: Log para verificar los datos
  if (showStudents) {
    console.log('🔍 RectorTeacherCard - Teacher ID:', teacherId)
    console.log('🔍 RectorTeacherCard - Teacher object:', teacher)
    console.log('🔍 RectorTeacherCard - Teacher IDs:', {
      institutionId: teacher.institutionId || teacher.inst,
      campusId: teacher.campusId || teacher.campus,
      gradeId: teacher.gradeId || teacher.grade
    })
    console.log('🔍 RectorTeacherCard - Students from hook:', teacherStudents)
    console.log('🔍 RectorTeacherCard - Students from filter:', filteredStudentsByTeacher)
    console.log('🔍 RectorTeacherCard - Display students:', displayStudents)
    console.log('🔍 RectorTeacherCard - Students loading:', studentsLoading)
    console.log('🔍 RectorTeacherCard - Students error:', studentsError)
  }

  return (
    <div className={cn('p-3 rounded-md border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-900' : 'border-gray-200 bg-white')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
            {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {teacher.name}
            </p>
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {teacher.email}
            </p>
            {teacher.gradeName && (
              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Grado: {teacher.gradeName}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStudents(!showStudents)}
          className={cn(
            "border-blue-500",
            theme === 'dark' 
              ? 'text-blue-400 hover:bg-blue-900/20' 
              : 'text-blue-600 hover:bg-blue-50'
          )}
        >
          <Users className="h-4 w-4 mr-2" />
          {showStudents ? 'Ocultar' : 'Ver'} Estudiantes
        </Button>
      </div>

      {showStudents && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-600 space-y-2">
          {!teacherId ? (
            <div className={cn('text-center py-2 text-xs text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error: No se pudo obtener el ID del docente
            </div>
          ) : studentsLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={cn('ml-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Cargando...
              </span>
            </div>
          ) : studentsError ? (
            <div className={cn('text-center py-2 text-xs text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar estudiantes: {studentsError instanceof Error ? studentsError.message : 'Error desconocido'}
            </div>
          ) : displayStudents && displayStudents.length > 0 ? (
            displayStudents.map((student: any) => (
              <RectorStudentCard
                key={student.id || student.uid}
                theme={theme}
                student={student}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay estudiantes asignados a este docente
              <br />
              <span className="text-xs opacity-75">
                (Institución: {teacher.institutionId || teacher.inst || 'N/A'}, 
                Sede: {teacher.campusId || teacher.campus || 'N/A'}, 
                Grado: {teacher.gradeId || teacher.grade || 'N/A'})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de estudiante del rector
interface RectorStudentCardProps {
  theme: 'light' | 'dark'
  student: any
}

function RectorStudentCard({ theme, student }: RectorStudentCardProps) {
  return (
    <div className={cn('p-2 rounded border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-900' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-medium">
          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <p className={cn('font-medium text-xs', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {student.name}
          </p>
          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.email}
          </p>
          {student.gradeName && (
            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Grado: {student.gradeName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface UserManagementProps {
  theme: 'light' | 'dark'
}

export default function UserManagement({ theme }: UserManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { user: currentUser } = useAuthContext()
  const [activeTab, setActiveTab] = useState('students')
  const [adminPassword, setAdminPassword] = useState('')

  // Helper function para obtener la contraseña del admin (del estado o sessionStorage)
  // IMPORTANTE: sessionStorage se limpia automáticamente al cerrar la pestaña/ventana
  // No persiste entre dispositivos ni después de cerrar el navegador
  const getAdminPassword = (): string | undefined => {
    // Prioridad 1: Contraseña en el estado actual (si el usuario la acaba de ingresar)
    if (adminPassword) return adminPassword
    
    // Prioridad 2: Contraseña en sessionStorage (solo durante la sesión actual del navegador)
    // sessionStorage SE LIMPIA al cerrar la pestaña/ventana del navegador
    // NO se sincroniza entre dispositivos
    // NO persiste después de cerrar el navegador
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('admin_password_temp')
        if (stored) {
          const decoded = atob(stored)
          // Actualizar el estado para que el campo no aparezca
          if (decoded) {
            setAdminPassword(decoded)
          }
          return decoded
        }
      } catch {
        return undefined
      }
    }
    return undefined
  }
  
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
    currentPassword: '', // Contraseña actual del docente (solo para cambiar contraseña)
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: '',
    institution: '',
    campus: '',
    grade: ''
  })
  const [editPrincipalData, setEditPrincipalData] = useState({
    currentPassword: '', // Contraseña actual del coordinador (solo para cambiar contraseña)
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: '',
    institution: '',
    campus: ''
  })
  const [editRectorData, setEditRectorData] = useState({
    currentPassword: '', // Contraseña actual del rector (solo para cambiar contraseña)
    name: '',
    email: '',
    phone: '',
    isActive: true,
    password: '',
    institution: ''
  })
  const [editStudentData, setEditStudentData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    userdoc: '',
    password: '',
    institution: '',
    campus: '',
    grade: ''
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

  // Obtener opciones de sedes para el formulario de edición de estudiantes
  const { options: editCampusOptions, isLoading: editCampusLoading } = useCampusOptions(editStudentData.institution || '')
  
  // Obtener opciones de grados para el formulario de edición de estudiantes
  const { options: editGradeOptions, isLoading: editGradeLoading } = useGradeOptions(
    editStudentData.institution || '', 
    editStudentData.campus || ''
  )

  // Obtener opciones de sedes para el formulario de edición de docentes
  const { options: editTeacherCampusOptions, isLoading: editTeacherCampusLoading } = useCampusOptions(editTeacherData.institution || '')
  
  // Obtener opciones de grados para el formulario de edición de docentes
  const { options: editTeacherGradeOptions, isLoading: editTeacherGradeLoading } = useGradeOptions(
    editTeacherData.institution || '', 
    editTeacherData.campus || ''
  )

  // Obtener opciones de sedes para el formulario de edición de coordinadores
  const { options: editPrincipalCampusOptions, isLoading: editPrincipalCampusLoading } = useCampusOptions(editPrincipalData.institution || '')

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
    // Limpiar otros estados de selección
    setSelectedStudent(null)
    setSelectedPrincipal(null)
    setSelectedRector(null)
    // Establecer el docente seleccionado
    setSelectedTeacher(teacher)
    setEditTeacherData({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      isActive: teacher.isActive,
      password: '',
      currentPassword: '', // Limpiar contraseña actual al abrir el diálogo
      institution: teacher.institutionId || '',
      campus: teacher.campusId || '',
      grade: teacher.gradeId || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateTeacher = async () => {
    if (!selectedTeacher || !editTeacherData.name || !editTeacherData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    // Validar que se hayan seleccionado institución, sede y grado
    if (!editTeacherData.institution || !editTeacherData.campus || !editTeacherData.grade) {
      notifyError({ title: 'Error', message: 'Institución, sede y grado son obligatorios' })
      return
    }

    // Si se están actualizando credenciales (email, nombre o contraseña), requerir contraseña del admin
    const isUpdatingEmail = editTeacherData.email && editTeacherData.email !== selectedTeacher.email
    const isUpdatingName = editTeacherData.name && editTeacherData.name !== selectedTeacher.name
    const isUpdatingPassword = editTeacherData.password && editTeacherData.password.trim() !== ''
    const isUpdatingCredentials = isUpdatingEmail || isUpdatingName || isUpdatingPassword

    // Verificar si se están cambiando institución, sede o grado
    const isChangingInstitution = editTeacherData.institution !== selectedTeacher.institutionId
    const isChangingCampus = editTeacherData.campus !== selectedTeacher.campusId
    const isChangingGrade = editTeacherData.grade !== selectedTeacher.gradeId
    const isChangingLocation = isChangingInstitution || isChangingCampus || isChangingGrade

    // Si se está cambiando la contraseña, requerir la contraseña actual del docente
    if (isUpdatingPassword && !editTeacherData.currentPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar la contraseña actual del docente para cambiar la contraseña' })
      return
    }

    if (isUpdatingCredentials && !adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para actualizar credenciales' })
      return
    }

    if (isUpdatingCredentials && !currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      const updateData = {
        name: editTeacherData.name,
        email: editTeacherData.email,
        phone: editTeacherData.phone || undefined,
        isActive: editTeacherData.isActive,
        password: editTeacherData.password || undefined,
        currentPassword: isUpdatingPassword ? editTeacherData.currentPassword : undefined, // Solo enviar si se está cambiando la contraseña
        adminEmail: isUpdatingCredentials && currentUser?.email ? currentUser.email : undefined,
        adminPassword: isUpdatingCredentials ? adminPassword : undefined,
        // Incluir los nuevos valores de institución, sede y grado si están cambiando
        ...(isChangingLocation && {
          institutionId: editTeacherData.institution,
          campusId: editTeacherData.campus,
          gradeId: editTeacherData.grade
        })
      }
      
      console.log('📤 Enviando datos de actualización:', {
        hasPassword: !!updateData.password,
        passwordLength: updateData.password?.length || 0,
        hasAdminEmail: !!updateData.adminEmail,
        hasAdminPassword: !!updateData.adminPassword,
        isUpdatingCredentials,
        isChangingLocation,
        oldInstitution: selectedTeacher.institutionId,
        newInstitution: editTeacherData.institution,
        oldCampus: selectedTeacher.campusId,
        newCampus: editTeacherData.campus,
        oldGrade: selectedTeacher.gradeId,
        newGrade: editTeacherData.grade
      })
      
      await updateTeacherInGrade.mutateAsync({
        institutionId: isChangingLocation ? editTeacherData.institution : selectedTeacher.institutionId,
        campusId: isChangingLocation ? editTeacherData.campus : selectedTeacher.campusId,
        gradeId: isChangingLocation ? editTeacherData.grade : selectedTeacher.gradeId,
        teacherId: selectedTeacher.id,
        data: updateData,
        // Pasar los IDs originales si se está moviendo el docente
        ...(isChangingLocation && {
          oldInstitutionId: selectedTeacher.institutionId,
          oldCampusId: selectedTeacher.campusId,
          oldGradeId: selectedTeacher.gradeId
        })
      })
      
      notifySuccess({ title: 'Éxito', message: 'Docente actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedTeacher(null)
      setEditTeacherData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: '',
        currentPassword: '',
        institution: '',
        campus: '',
        grade: ''
      })
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el docente' })
      setAdminPassword('')
    }
  }

  const handleDeleteTeacher = (teacher: any) => {
    setSelectedTeacher(teacher)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteTeacher = async () => {
    if (!selectedTeacher) return

    if (!adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para eliminar usuarios' })
      return
    }

    if (!currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      await deleteTeacherFromGrade.mutateAsync({
        institutionId: selectedTeacher.institutionId,
        campusId: selectedTeacher.campusId,
        gradeId: selectedTeacher.gradeId,
        teacherId: selectedTeacher.id,
        adminEmail: currentUser.email,
        adminPassword: adminPassword
      })
      
      notifySuccess({ title: 'Éxito', message: 'Docente eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedTeacher(null)
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el docente' })
      setAdminPassword('')
    }
  }

  // Funciones para coordinadores
  const handleEditPrincipal = (principal: any) => {
    // Limpiar otros estados de selección
    setSelectedStudent(null)
    setSelectedTeacher(null)
    setSelectedRector(null)
    // Establecer el coordinador seleccionado
    setSelectedPrincipal(principal)
    setEditPrincipalData({
      name: principal.name,
      email: principal.email,
      phone: principal.phone || '',
      isActive: principal.isActive,
      password: '',
      currentPassword: '', // Limpiar contraseña actual al abrir el diálogo
      institution: principal.institutionId || '',
      campus: principal.campusId || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePrincipal = async () => {
    if (!selectedPrincipal || !editPrincipalData.name || !editPrincipalData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    // Validar que se hayan seleccionado institución y sede
    if (!editPrincipalData.institution || !editPrincipalData.campus) {
      notifyError({ title: 'Error', message: 'Institución y sede son obligatorios' })
      return
    }

    // Si se están actualizando credenciales (email, nombre o contraseña), requerir contraseña del admin
    const isUpdatingEmail = editPrincipalData.email && editPrincipalData.email !== selectedPrincipal.email
    const isUpdatingName = editPrincipalData.name && editPrincipalData.name !== selectedPrincipal.name
    const isUpdatingPassword = editPrincipalData.password && editPrincipalData.password.trim() !== ''
    const isUpdatingCredentials = isUpdatingEmail || isUpdatingName || isUpdatingPassword

    // Verificar si se están cambiando institución o sede
    const isChangingInstitution = editPrincipalData.institution !== selectedPrincipal.institutionId
    const isChangingCampus = editPrincipalData.campus !== selectedPrincipal.campusId
    const isChangingLocation = isChangingInstitution || isChangingCampus

    // Si se está cambiando la contraseña, requerir la contraseña actual del coordinador
    if (isUpdatingPassword && !editPrincipalData.currentPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar la contraseña actual del coordinador para cambiar la contraseña' })
      return
    }

    if (isUpdatingCredentials && !adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para actualizar credenciales' })
      return
    }

    if (isUpdatingCredentials && !currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      const updateData = {
        name: editPrincipalData.name,
        email: editPrincipalData.email,
        phone: editPrincipalData.phone || undefined,
        isActive: editPrincipalData.isActive,
        password: editPrincipalData.password || undefined,
        currentPassword: isUpdatingPassword ? editPrincipalData.currentPassword : undefined, // Solo enviar si se está cambiando la contraseña
        adminEmail: isUpdatingCredentials && currentUser?.email ? currentUser.email : undefined,
        adminPassword: isUpdatingCredentials ? adminPassword : undefined,
        // Incluir los nuevos valores de institución y sede si están cambiando
        ...(isChangingLocation && {
          institutionId: editPrincipalData.institution,
          campusId: editPrincipalData.campus
        })
      }
      
      console.log('📤 Enviando datos de actualización del coordinador:', {
        hasPassword: !!updateData.password,
        passwordLength: updateData.password?.length || 0,
        hasAdminEmail: !!updateData.adminEmail,
        hasAdminPassword: !!updateData.adminPassword,
        isUpdatingCredentials,
        isChangingLocation,
        oldInstitution: selectedPrincipal.institutionId,
        newInstitution: editPrincipalData.institution,
        oldCampus: selectedPrincipal.campusId,
        newCampus: editPrincipalData.campus
      })
      
      await updatePrincipal.mutateAsync({
        institutionId: isChangingLocation ? editPrincipalData.institution : selectedPrincipal.institutionId,
        campusId: isChangingLocation ? editPrincipalData.campus : selectedPrincipal.campusId,
        principalId: selectedPrincipal.id,
        data: updateData,
        // Pasar los IDs originales si se está moviendo el coordinador
        ...(isChangingLocation && {
          oldInstitutionId: selectedPrincipal.institutionId,
          oldCampusId: selectedPrincipal.campusId
        })
      })
      
      notifySuccess({ title: 'Éxito', message: 'Coordinador actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedPrincipal(null)
      setEditPrincipalData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: '',
        currentPassword: '',
        institution: '',
        campus: ''
      })
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el coordinador' })
      setAdminPassword('')
    }
  }

  const handleDeletePrincipal = (principal: any) => {
    setSelectedPrincipal(principal)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeletePrincipal = async () => {
    if (!selectedPrincipal) return

    if (!adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para eliminar usuarios' })
      return
    }

    if (!currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      await deletePrincipal.mutateAsync({
        institutionId: selectedPrincipal.institutionId,
        campusId: selectedPrincipal.campusId,
        principalId: selectedPrincipal.id,
        adminEmail: currentUser.email,
        adminPassword: adminPassword
      })
      
      notifySuccess({ title: 'Éxito', message: 'Coordinador eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedPrincipal(null)
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el coordinador' })
      setAdminPassword('')
    }
  }

  // Funciones para rectores
  const handleEditRector = (rector: any) => {
    // Limpiar otros estados de selección
    setSelectedStudent(null)
    setSelectedTeacher(null)
    setSelectedPrincipal(null)
    // Establecer el rector seleccionado
    setSelectedRector(rector)
    setEditRectorData({
      name: rector.name,
      email: rector.email,
      phone: rector.phone || '',
      isActive: rector.isActive,
      password: '',
      currentPassword: '', // Limpiar contraseña actual al abrir el diálogo
      institution: rector.institutionId || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateRector = async () => {
    if (!selectedRector || !editRectorData.name || !editRectorData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    // Validar que se haya seleccionado institución
    if (!editRectorData.institution) {
      notifyError({ title: 'Error', message: 'Institución es obligatoria' })
      return
    }

    // Si se están actualizando credenciales (email, nombre o contraseña), requerir contraseña del admin
    const isUpdatingEmail = editRectorData.email && editRectorData.email !== selectedRector.email
    const isUpdatingName = editRectorData.name && editRectorData.name !== selectedRector.name
    const isUpdatingPassword = editRectorData.password && editRectorData.password.trim() !== ''
    const isUpdatingCredentials = isUpdatingEmail || isUpdatingName || isUpdatingPassword

    // Verificar si se está cambiando institución
    const isChangingInstitution = editRectorData.institution !== selectedRector.institutionId

    // Si se está cambiando la contraseña, requerir la contraseña actual del rector
    if (isUpdatingPassword && !editRectorData.currentPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar la contraseña actual del rector para cambiar la contraseña' })
      return
    }

    if (isUpdatingCredentials && !adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para actualizar credenciales' })
      return
    }

    if (isUpdatingCredentials && !currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      const updateData = {
        name: editRectorData.name,
        email: editRectorData.email,
        phone: editRectorData.phone || undefined,
        isActive: editRectorData.isActive,
        password: editRectorData.password || undefined,
        currentPassword: isUpdatingPassword ? editRectorData.currentPassword : undefined, // Solo enviar si se está cambiando la contraseña
        adminEmail: isUpdatingCredentials && currentUser?.email ? currentUser.email : undefined,
        adminPassword: isUpdatingCredentials ? adminPassword : undefined,
        // Incluir el nuevo valor de institución si está cambiando
        ...(isChangingInstitution && {
          institutionId: editRectorData.institution
        })
      }
      
      console.log('📤 Enviando datos de actualización del rector:', {
        hasPassword: !!updateData.password,
        passwordLength: updateData.password?.length || 0,
        hasAdminEmail: !!updateData.adminEmail,
        hasAdminPassword: !!updateData.adminPassword,
        isUpdatingCredentials,
        isChangingInstitution,
        oldInstitution: selectedRector.institutionId,
        newInstitution: editRectorData.institution
      })
      
      await updateRector.mutateAsync({
        institutionId: isChangingInstitution ? editRectorData.institution : selectedRector.institutionId,
        rectorId: selectedRector.id,
        data: updateData,
        // Pasar el ID original si se está moviendo el rector
        ...(isChangingInstitution && {
          oldInstitutionId: selectedRector.institutionId
        })
      })
      
      notifySuccess({ title: 'Éxito', message: 'Rector actualizado correctamente' })
      setIsEditDialogOpen(false)
      setSelectedRector(null)
      setEditRectorData({
        name: '',
        email: '',
        phone: '',
        isActive: true,
        password: '',
        currentPassword: '',
        institution: ''
      })
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el rector' })
      setAdminPassword('')
    }
  }

  const handleDeleteRector = (rector: any) => {
    setSelectedRector(rector)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteRector = async () => {
    if (!selectedRector) return

    if (!adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para eliminar usuarios' })
      return
    }

    if (!currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      await deleteRector.mutateAsync({
        institutionId: selectedRector.institutionId,
        rectorId: selectedRector.id,
        adminEmail: currentUser.email,
        adminPassword: adminPassword
      })
      
      notifySuccess({ title: 'Éxito', message: 'Rector eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedRector(null)
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el rector' })
      setAdminPassword('')
    }
  }

  // Funciones para estudiantes
  const handleEditStudent = (student: any) => {
    // Limpiar otros estados de selección
    setSelectedTeacher(null)
    setSelectedPrincipal(null)
    setSelectedRector(null)
    // Establecer el estudiante seleccionado
    setSelectedStudent(student)
    setEditStudentData({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      isActive: student.isActive,
      userdoc: student.userdoc || '',
      password: '',
      institution: student.inst || student.institutionId || '',
      campus: student.campus || student.campusId || '',
      grade: student.grade || student.gradeId || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateStudent = async () => {
    if (!selectedStudent || !editStudentData.name || !editStudentData.email) {
      notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
      return
    }

    // Validar que se hayan seleccionado institución, sede y grado
    if (!editStudentData.institution || !editStudentData.campus || !editStudentData.grade) {
      notifyError({ title: 'Error', message: 'Institución, sede y grado son obligatorios' })
      return
    }

    try {
      await updateStudent.mutateAsync({
        studentId: selectedStudent.id,
        studentData: {
          name: editStudentData.name,
          email: editStudentData.email,
          phone: editStudentData.phone || undefined,
          isActive: editStudentData.isActive,
          userdoc: editStudentData.userdoc || undefined,
          // No se envía password para estudiantes
          institutionId: editStudentData.institution,
          campusId: editStudentData.campus,
          gradeId: editStudentData.grade
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
        password: '',
        institution: '',
        campus: '',
        grade: ''
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

    if (!adminPassword) {
      notifyError({ title: 'Error', message: 'Debes ingresar tu contraseña de administrador para eliminar usuarios' })
      return
    }

    if (!currentUser?.email) {
      notifyError({ title: 'Error', message: 'No se pudo obtener la información del administrador' })
      return
    }

    try {
      await deleteStudent.mutateAsync({
        studentId: selectedStudent.id,
        adminEmail: currentUser.email,
        adminPassword: adminPassword
      })
      
      notifySuccess({ title: 'Éxito', message: 'Estudiante eliminado correctamente' })
      setIsDeleteDialogOpen(false)
      setSelectedStudent(null)
      setAdminPassword('')
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el estudiante' })
      setAdminPassword('')
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
          password: newUser.password,
          adminEmail: currentUser?.email,
          adminPassword: getAdminPassword()
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
          password: newUser.password, // Pasar la contraseña al controlador
          adminEmail: currentUser?.email,
          adminPassword: getAdminPassword()
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
          password: newUser.password, // Pasar la contraseña al controlador
          adminEmail: currentUser?.email,
          adminPassword: getAdminPassword()
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
          password: newUser.password, // Pasar la contraseña al controlador
          adminEmail: currentUser?.email,
          adminPassword: getAdminPassword()
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
        message: `${newUser.role === 'student' ? 'Estudiante' : newUser.role === 'teacher' ? 'Docente' : newUser.role === 'principal' ? 'Coordinador' : 'Rector'} creado correctamente.` 
      })
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
            <DialogContent className={cn("max-w-[750px] max-h-[95vh] flex flex-col p-0 overflow-hidden", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
              <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-gray-200 dark:border-zinc-700">
                <DialogTitle className={cn("text-lg", theme === 'dark' ? 'text-white' : '')}>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : '')}>
                  Crea una nueva cuenta de estudiante, docente o coordinador en el sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 px-6 py-4 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(95vh - 160px)' }}>
                <div className="grid gap-2.5 pb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label htmlFor="name" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Nombre completo</Label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nombre completo del usuario"
                        className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="email" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="correo@institucion.edu"
                        className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="grid gap-1.5">
                      <Label htmlFor="role" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Rol</Label>
                      <Select value={newUser.role} onValueChange={(value: 'student' | 'teacher' | 'principal' | 'rector') => setNewUser(prev => ({ ...prev, role: value, grade: (value === 'principal' || value === 'rector') ? '' : prev.grade, campus: value === 'rector' ? '' : prev.campus }))}>
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                      <Label htmlFor="institution" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Institución</Label>
                      <Select 
                        value={newUser.institution} 
                        onValueChange={(value) => setNewUser(prev => ({ ...prev, institution: value, campus: '', grade: '' }))}
                      >
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                  </div>

                  {newUser.institution && newUser.role !== 'rector' && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="campus" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Sede</Label>
                      <Select 
                        value={newUser.campus} 
                        onValueChange={(value) => setNewUser(prev => ({ ...prev, campus: value, grade: '' }))}
                      >
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                    <div className="grid gap-1.5">
                      <Label htmlFor="grade" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
                      <Select value={newUser.grade} onValueChange={(value) => setNewUser(prev => ({ ...prev, grade: value }))}>
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                    <div className={cn("p-2 border rounded-md text-xs", theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50/50 border-blue-200')}>
                      <div className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                        <strong className="text-xs">ℹ️ Docente:</strong> Se asignará al grado seleccionado. Los estudiantes se asignarán automáticamente.
                      </div>
                    </div>
                  )}

                  {newUser.role === 'principal' && newUser.campus && (
                    <div className={cn("p-2 border rounded-md text-xs", theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50/50 border-blue-200')}>
                      <div className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                        <strong className="text-xs">ℹ️ Coordinador:</strong> Se asignará a toda la sede. Acceso a todos los grados de la sede.
                      </div>
                    </div>
                  )}

                  {newUser.role === 'rector' && newUser.institution && (
                    <div className={cn("p-2 border rounded-md text-xs", theme === 'dark' ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50/50 border-purple-200')}>
                      <div className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-800')}>
                        <strong className="text-xs">ℹ️ Rector:</strong> Se asignará a toda la institución. Acceso completo a todas las sedes.
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="grid gap-1.5">
                      <Label htmlFor="password" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Contraseña temporal</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Contraseña temporal"
                        className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="confirmPassword" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Confirmar contraseña</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={newUser.confirmPassword}
                        onChange={(e) => setNewUser(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirmar contraseña"
                        className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="px-6 pb-4 pt-3 border-t border-gray-200 dark:border-zinc-700 shrink-0 bg-inherit">
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false)
                  setAdminPassword('')
                }}>
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
                    <TeacherCard
                      key={teacher.id}
                      teacher={teacher}
                      theme={theme}
                      onEdit={handleEditTeacher}
                      onDelete={handleDeleteTeacher}
                    />
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
                    <RectorCard
                      key={rector.id}
                      rector={rector}
                      theme={theme}
                      onEdit={handleEditRector}
                      onDelete={handleDeleteRector}
                    />
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
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          setAdminPassword('') // Limpiar la contraseña al cerrar el diálogo
        }
      }}>
        <DialogContent className={cn("max-w-[750px] max-h-[95vh] flex flex-col p-0 overflow-hidden", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b border-gray-200 dark:border-zinc-700">
            <DialogTitle className={cn("text-lg", theme === 'dark' ? 'text-white' : '')}>
              {selectedTeacher ? 'Actualizar Docente' : 
               selectedPrincipal ? 'Actualizar Coordinador' : 
               selectedRector ? 'Actualizar Rector' : 
               selectedStudent ? 'Actualizar Estudiante' : 
               'Actualizar Usuario'}
            </DialogTitle>
            <DialogDescription className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : '')}>
              Modifica los datos del {selectedTeacher ? 'docente' : 
                                   selectedPrincipal ? 'coordinador' : 
                                   selectedRector ? 'rector' : 
                                   selectedStudent ? 'estudiante' : 
                                   'usuario'} seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-6 py-4 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(95vh - 160px)' }}>
            <div className="grid gap-2.5 pb-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-name" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Nombre completo</Label>
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
                    className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-email" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Correo electrónico</Label>
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
                    className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
              </div>
              {/* Campos específicos para estudiantes */}
              {selectedStudent ? (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-phone" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Número de teléfono</Label>
                    <Input
                      id="edit-phone"
                      value={editStudentData.phone}
                      onChange={(e) => {
                        setEditStudentData(prev => ({ ...prev, phone: e.target.value }))
                      }}
                      placeholder="Número de teléfono"
                      className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-userdoc" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Documento de identidad</Label>
                    <Input
                      id="edit-userdoc"
                      value={editStudentData.userdoc}
                      onChange={(e) => {
                        setEditStudentData(prev => ({ ...prev, userdoc: e.target.value }))
                      }}
                      placeholder="Número de documento"
                      className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-institution" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Institución</Label>
                    <Select 
                      value={editStudentData.institution} 
                      onValueChange={(value) => setEditStudentData(prev => ({ ...prev, institution: value, campus: '', grade: '' }))}
                    >
                      <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                  {editStudentData.institution && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-campus" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Sede</Label>
                      <Select 
                        value={editStudentData.campus} 
                        onValueChange={(value) => setEditStudentData(prev => ({ ...prev, campus: value, grade: '' }))}
                      >
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                          <SelectValue placeholder={editCampusLoading ? 'Cargando sedes...' : 'Seleccionar sede'} />
                        </SelectTrigger>
                        <SelectContent>
                          {editCampusOptions.map(campus => (
                            <SelectItem key={campus.value} value={campus.value}>
                              {campus.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {editStudentData.campus && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-grade" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
                      <Select 
                        value={editStudentData.grade} 
                        onValueChange={(value) => setEditStudentData(prev => ({ ...prev, grade: value }))}
                      >
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                          <SelectValue placeholder={editGradeLoading ? 'Cargando grados...' : 'Seleccionar grado'} />
                        </SelectTrigger>
                        <SelectContent>
                          {editGradeOptions.map(grade => (
                            <SelectItem key={grade.value} value={grade.value}>
                              {grade.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                /* Campos para docentes, coordinadores y rectores */
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-phone" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Teléfono (opcional)</Label>
                    <Input
                      id="edit-phone"
                      value={selectedTeacher ? editTeacherData.phone : selectedPrincipal ? editPrincipalData.phone : editRectorData.phone}
                      onChange={(e) => {
                        if (selectedTeacher) {
                          setEditTeacherData(prev => ({ ...prev, phone: e.target.value }))
                        } else if (selectedPrincipal) {
                          setEditPrincipalData(prev => ({ ...prev, phone: e.target.value }))
                        } else if (selectedRector) {
                          setEditRectorData(prev => ({ ...prev, phone: e.target.value }))
                        }
                      }}
                      placeholder="Número de teléfono"
                      className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  {/* Campos específicos para docentes: Institución, Sede y Grado */}
                  {selectedTeacher && (
                    <>
                      <div className="grid gap-1.5">
                        <Label htmlFor="edit-teacher-institution" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Institución</Label>
                        <Select 
                          value={editTeacherData.institution} 
                          onValueChange={(value) => setEditTeacherData(prev => ({ ...prev, institution: value, campus: '', grade: '' }))}
                        >
                          <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                      {editTeacherData.institution && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="edit-teacher-campus" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Sede</Label>
                          <Select 
                            value={editTeacherData.campus} 
                            onValueChange={(value) => setEditTeacherData(prev => ({ ...prev, campus: value, grade: '' }))}
                          >
                            <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                              <SelectValue placeholder={editTeacherCampusLoading ? 'Cargando sedes...' : 'Seleccionar sede'} />
                            </SelectTrigger>
                            <SelectContent>
                              {editTeacherCampusOptions.map(campus => (
                                <SelectItem key={campus.value} value={campus.value}>
                                  {campus.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {editTeacherData.campus && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="edit-teacher-grade" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
                          <Select 
                            value={editTeacherData.grade} 
                            onValueChange={(value) => setEditTeacherData(prev => ({ ...prev, grade: value }))}
                          >
                            <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                              <SelectValue placeholder={editTeacherGradeLoading ? 'Cargando grados...' : 'Seleccionar grado'} />
                            </SelectTrigger>
                            <SelectContent>
                              {editTeacherGradeOptions.map(grade => (
                                <SelectItem key={grade.value} value={grade.value}>
                                  {grade.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                  {/* Campos específicos para coordinadores: Institución y Sede */}
                  {selectedPrincipal && (
                    <>
                      <div className="grid gap-1.5">
                        <Label htmlFor="edit-principal-institution" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Institución</Label>
                        <Select 
                          value={editPrincipalData.institution} 
                          onValueChange={(value) => setEditPrincipalData(prev => ({ ...prev, institution: value, campus: '' }))}
                        >
                          <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                      {editPrincipalData.institution && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="edit-principal-campus" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Sede</Label>
                          <Select 
                            value={editPrincipalData.campus} 
                            onValueChange={(value) => setEditPrincipalData(prev => ({ ...prev, campus: value }))}
                          >
                            <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                              <SelectValue placeholder={editPrincipalCampusLoading ? 'Cargando sedes...' : 'Seleccionar sede'} />
                            </SelectTrigger>
                            <SelectContent>
                              {editPrincipalCampusOptions.map(campus => (
                                <SelectItem key={campus.value} value={campus.value}>
                                  {campus.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                  {/* Campo específico para rectores: Institución */}
                  {selectedRector && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-rector-institution" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Institución</Label>
                      <Select 
                        value={editRectorData.institution} 
                        onValueChange={(value) => setEditRectorData(prev => ({ ...prev, institution: value }))}
                      >
                        <SelectTrigger className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
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
                  )}
                </>
              )}
              {/* Campo de contraseña actual (para docentes, coordinadores y rectores) */}
              {(selectedTeacher || selectedPrincipal || selectedRector) && (
                <div className="grid gap-1.5 pt-1">
                  <Label htmlFor="edit-current-password" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>
                    Contraseña actual del {selectedTeacher ? 'docente' : selectedPrincipal ? 'coordinador' : 'rector'}
                  </Label>
                  <Input
                    id="edit-current-password"
                    type="password"
                    value={selectedTeacher ? editTeacherData.currentPassword : selectedPrincipal ? editPrincipalData.currentPassword : editRectorData.currentPassword}
                    onChange={(e) => {
                      if (selectedTeacher) {
                        setEditTeacherData(prev => ({ ...prev, currentPassword: e.target.value }))
                      } else if (selectedPrincipal) {
                        setEditPrincipalData(prev => ({ ...prev, currentPassword: e.target.value }))
                      } else if (selectedRector) {
                        setEditRectorData(prev => ({ ...prev, currentPassword: e.target.value }))
                      }
                    }}
                    placeholder="Solo necesaria si vas a cambiar la contraseña"
                    className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                  <p className={cn("text-xs mt-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Requerida para cambiar la contraseña del {selectedTeacher ? 'docente' : selectedPrincipal ? 'coordinador' : 'rector'}
                  </p>
                </div>
              )}
              {/* Campo de contraseña solo para docentes, coordinadores y rectores (no para estudiantes) */}
              {(selectedTeacher || selectedPrincipal || selectedRector) && (
                <div className="grid gap-1.5 pt-1">
                  <Label htmlFor="edit-password" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Nueva contraseña (opcional)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={selectedTeacher ? editTeacherData.password : selectedPrincipal ? editPrincipalData.password : editRectorData.password}
                    onChange={(e) => {
                      if (selectedTeacher) {
                        setEditTeacherData(prev => ({ ...prev, password: e.target.value }))
                      } else if (selectedPrincipal) {
                        setEditPrincipalData(prev => ({ ...prev, password: e.target.value }))
                      } else if (selectedRector) {
                        setEditRectorData(prev => ({ ...prev, password: e.target.value }))
                      }
                    }}
                    placeholder="Dejar vacío para mantener la contraseña actual"
                    className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                  <p className={cn("text-xs mt-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Si cambias el email, nombre o contraseña, el usuario deberá hacer login con las nuevas credenciales
                  </p>
                </div>
              )}
              {/* Campo de contraseña del admin solo para docentes, coordinadores y rectores cuando se actualizan credenciales */}
              {(selectedTeacher || selectedPrincipal || selectedRector) && (
                <div className="grid gap-1.5 pt-2 border-t border-gray-200 dark:border-zinc-700">
                  <Label htmlFor="edit-admin-password" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>
                    Tu contraseña de administrador
                  </Label>
                  <Input
                    id="edit-admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Requerida para actualizar credenciales en Firebase Auth"
                    className={cn("h-9", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                  <p className={cn("text-xs mt-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Solo necesaria si cambias el email, nombre o contraseña del usuario
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2 pt-1">
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
                <Label htmlFor="edit-active" className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>
                  {selectedTeacher ? 'Docente' : selectedPrincipal ? 'Coordinador' : selectedRector ? 'Rector' : selectedStudent ? 'Estudiante' : 'Usuario'} activo
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-4 pt-3 border-t border-gray-200 dark:border-zinc-700 shrink-0 bg-inherit">
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false)
              setSelectedTeacher(null)
              setSelectedPrincipal(null)
              setSelectedRector(null)
              setSelectedStudent(null)
            }} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open)
        if (!open) {
          setAdminPassword('')
        }
      }}>
        <AlertDialogContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Esta acción no se puede deshacer. Se eliminará permanentemente el{' '}
              {selectedTeacher ? 'docente' : 
               selectedPrincipal ? 'coordinador' : 
               selectedRector ? 'rector' : 
               selectedStudent ? 'estudiante' : 
               'usuario'}{' '}
              <strong className={cn(theme === 'dark' ? 'text-white' : '')}>{selectedTeacher?.name || selectedPrincipal?.name || selectedRector?.name || selectedStudent?.name}</strong> del sistema.
              <br /><br />
              <strong className={cn(theme === 'dark' ? 'text-white' : '')}>Para confirmar, ingresa tu contraseña de administrador:</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-password" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                Contraseña de administrador
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (selectedTeacher) confirmDeleteTeacher()
                    else if (selectedPrincipal) confirmDeletePrincipal()
                    else if (selectedRector) confirmDeleteRector()
                    else if (selectedStudent) confirmDeleteStudent()
                  }
                }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setAdminPassword('')}
              className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
            >
              Cancelar
            </AlertDialogCancel>
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
