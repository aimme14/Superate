import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  Building, 
  Edit,
  Eye,
  MapPin,
  GraduationCap,
  ChevronRight,
  MoreVertical,
  Trash2,
  Phone,
  Mail,
  Building2,
  Crown,
  Users,
  Loader2,
  X,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { Institution, Campus } from '@/interfaces/db.interface'
import { useInstitutions, useInstitutionMutations, useCampusOptions } from '@/hooks/query/useInstitutionQuery'
import { useFilteredPrincipals } from '@/hooks/query/usePrincipalQuery'
import { useFilteredTeachers } from '@/hooks/query/useTeacherQuery'
import { useFilteredStudents, useStudentsByTeacher } from '@/hooks/query/useStudentQuery'
import { useRectors } from '@/hooks/query/useRectorQuery'
import ImageUpload from '@/components/common/fields/ImageUpload'
import InstitutionWizard from './InstitutionWizard'
import InstitutionStats from './InstitutionStats'

// Funciones auxiliares para tipos de institución
const institutionTypes = [
  { value: 'public', label: 'Pública' },
  { value: 'private', label: 'Privada' }
]

const getInstitutionTypeIcon = (type: string) => {
  switch (type) {
    case 'public':
      return <Building className="h-4 w-4" />
    case 'private':
      return <GraduationCap className="h-4 w-4" />
    default:
      return <Building className="h-4 w-4" />
  }
}

const getInstitutionTypeLabel = (type: string) => {
  const typeObj = institutionTypes.find(t => t.value === type)
  return typeObj ? typeObj.label : type
}

const getInstitutionTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'public':
      return 'default' as const
    case 'private':
      return 'secondary' as const
    default:
      return 'default' as const
  }
}

// Componente para vista detallada e interactiva de institución
interface InstitutionDetailViewProps {
  institution: Institution
  theme: 'light' | 'dark'
  onClose: () => void
}

function InstitutionDetailView({ institution, theme, onClose }: InstitutionDetailViewProps) {
  const [showCampuses, setShowCampuses] = useState(false)
  
  // Obtener datos de usuarios de la institución
  const { principals: coordinators } = useFilteredPrincipals({
    institutionId: institution.id,
    isActive: true
  })
  
  const { teachers } = useFilteredTeachers({
    institutionId: institution.id,
    isActive: true
  })
  
  const { students } = useFilteredStudents({
    institutionId: institution.id,
    isActive: true
  })
  
  const { options: campusOptions } = useCampusOptions(institution.id)

  return (
    <div className="space-y-6">
      {/* Información básica de la institución */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {institution.logo ? (
                <img 
                  src={institution.logo} 
                  alt={`Logo de ${institution.name}`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ) : (
                <div className={cn("w-20 h-20 rounded-lg flex items-center justify-center", theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')}>
                  {getInstitutionTypeIcon(institution.type)}
                </div>
              )}
              <div>
                <CardTitle className={cn('text-2xl mb-2 font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
                  {institution.name}
                </CardTitle>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant={getInstitutionTypeBadgeVariant(institution.type)}>
                    {getInstitutionTypeLabel(institution.type)}
                  </Badge>
                  <Badge variant={institution.isActive ? 'default' : 'secondary'}>
                    {institution.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {institution.address && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                        {institution.address}
                      </span>
                    </div>
                  )}
                  {institution.phone && (
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                        {institution.phone}
                      </span>
                    </div>
                  )}
                  {institution.email && (
                    <div className="flex items-center space-x-1">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                        {institution.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estadísticas generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className={cn("p-4 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white')}>
              <Building2 className={cn("h-6 w-6 mx-auto mb-2", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-black')}>
                {campusOptions?.length || 0}
              </div>
              <p className={cn("text-sm font-semibold", theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                Sedes
              </p>
            </div>
            <div className={cn("p-4 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white')}>
              <Crown className={cn("h-6 w-6 mx-auto mb-2", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-black')}>
                {coordinators?.length || 0}
              </div>
              <p className={cn("text-sm font-semibold", theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                Coordinadores
              </p>
            </div>
            <div className={cn("p-4 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white')}>
              <GraduationCap className={cn("h-6 w-6 mx-auto mb-2", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-black')}>
                {teachers?.length || 0}
              </div>
              <p className={cn("text-sm font-semibold", theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                Docentes
              </p>
            </div>
            <div className={cn("p-4 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-700 bg-zinc-900' : 'border-gray-200 bg-white')}>
              <Users className={cn("h-6 w-6 mx-auto mb-2", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
              <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-black')}>
                {students?.length || 0}
              </div>
              <p className={cn("text-sm font-semibold", theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                Estudiantes
              </p>
            </div>
          </div>

          {/* Botón para ver sedes */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowCampuses(!showCampuses)}
              className={cn(
                "border-purple-500",
                theme === 'dark' 
                  ? 'text-purple-400 hover:bg-purple-900/20' 
                  : 'text-purple-600 hover:bg-purple-50'
              )}
            >
              <Building2 className="h-5 w-5 mr-2" />
              {showCampuses ? 'Ocultar' : 'Ver'} Sedes y Usuarios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sección expandible de sedes y usuarios */}
      {showCampuses && (
        <InstitutionCampusList
          theme={theme}
          institutionId={institution.id}
          coordinators={coordinators || []}
          teachers={teachers || []}
          students={students || []}
        />
      )}
    </div>
  )
}

// Componente para lista de sedes de la institución
interface InstitutionCampusListProps {
  theme: 'light' | 'dark'
  institutionId: string
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function InstitutionCampusList({ theme, institutionId, coordinators, teachers, students }: InstitutionCampusListProps) {
  const { options: campusOptions, isLoading } = useCampusOptions(institutionId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className={cn('ml-2 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
          Cargando sedes...
        </span>
      </div>
    )
  }

  if (!campusOptions || campusOptions.length === 0) {
    return (
      <div className={cn('text-center py-8 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
        No hay sedes registradas
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {campusOptions.map((campus) => {
        const campusCoordinators = coordinators.filter((c: any) => c.campusId === campus.value)
        return (
          <InstitutionCampusCard
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

// Componente para tarjeta de sede
interface InstitutionCampusCardProps {
  theme: 'light' | 'dark'
  campus: any
  coordinators: any[]
  teachers: any[]
  students: any[]
}

function InstitutionCampusCard({ theme, campus, coordinators, teachers, students }: InstitutionCampusCardProps) {
  const [showCoordinators, setShowCoordinators] = useState(false)

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-purple-500" />
            <div>
              <CardTitle className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
                {campus.label}
              </CardTitle>
              <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
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
      </CardHeader>
      {showCoordinators && (
        <CardContent>
          <div className="space-y-3">
            {coordinators.length > 0 ? (
              coordinators.map((coordinator: any) => (
                <InstitutionCoordinatorCard
                  key={coordinator.id}
                  theme={theme}
                  coordinator={coordinator}
                  teachers={teachers}
                  students={students}
                />
              ))
            ) : (
              <div className={cn('text-center py-4 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                No hay coordinadores asignados a esta sede
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Componente para tarjeta de coordinador
interface InstitutionCoordinatorCardProps {
  theme: 'light' | 'dark'
  coordinator: any
  teachers: any[]
  students: any[]
}

function InstitutionCoordinatorCard({ theme, coordinator, teachers, students }: InstitutionCoordinatorCardProps) {
  const [showTeachers, setShowTeachers] = useState(false)
  const campusTeachers = teachers.filter((t: any) => t.campusId === coordinator.campusId)

  return (
    <div className={cn('p-3 rounded-md border', theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
            {coordinator.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
              {coordinator.name}
            </p>
            <p className={cn('text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              {coordinator.email}
            </p>
            <p className={cn('text-xs mt-1 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
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
              <InstitutionTeacherCard
                key={teacher.id}
                theme={theme}
                teacher={teacher}
                students={students}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-sm font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              No hay docentes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de docente
interface InstitutionTeacherCardProps {
  theme: 'light' | 'dark'
  teacher: any
  students?: any[]
}

function InstitutionTeacherCard({ theme, teacher }: InstitutionTeacherCardProps) {
  const [showStudents, setShowStudents] = useState(false)
  const teacherId = teacher.id || teacher.uid
  
  const { students: filteredStudentsByTeacher } = useFilteredStudents({
    institutionId: teacher.institutionId || teacher.inst,
    campusId: teacher.campusId || teacher.campus,
    gradeId: teacher.gradeId || teacher.grade,
    isActive: true
  })
  
  const { data: teacherStudents, isLoading: studentsLoading, error: studentsError } = useStudentsByTeacher(teacherId || '', showStudents)
  const displayStudents = showStudents ? (teacherStudents && teacherStudents.length > 0 ? teacherStudents : filteredStudentsByTeacher) : []

  return (
    <div className={cn('p-3 rounded-md border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-900' : 'border-gray-200 bg-white')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
            {teacher.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <p className={cn('font-bold text-sm', theme === 'dark' ? 'text-white' : 'text-black')}>
              {teacher.name}
            </p>
            <p className={cn('text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              {teacher.email}
            </p>
            {teacher.gradeName && (
              <p className={cn('text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
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
          {studentsLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className={cn('ml-2 text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                Cargando...
              </span>
            </div>
          ) : studentsError ? (
            <div className={cn('text-center py-2 text-xs text-red-500', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              Error al cargar estudiantes
            </div>
          ) : displayStudents && displayStudents.length > 0 ? (
            displayStudents.map((student: any) => (
              <InstitutionStudentCard
                key={student.id || student.uid}
                theme={theme}
                student={student}
              />
            ))
          ) : (
            <div className={cn('text-center py-2 text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              No hay estudiantes asignados
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Componente para tarjeta de estudiante
interface InstitutionStudentCardProps {
  theme: 'light' | 'dark'
  student: any
}

function InstitutionStudentCard({ theme, student }: InstitutionStudentCardProps) {
  return (
    <div className={cn('p-2 rounded border ml-4', theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-medium">
          {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <p className={cn('font-bold text-xs', theme === 'dark' ? 'text-white' : 'text-black')}>
            {student.name}
          </p>
          <p className={cn('text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
            {student.email}
          </p>
          {student.gradeName && (
            <p className={cn('text-xs font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Grado: {student.gradeName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente para editar sede en el modal de edición
interface CampusEditCardProps {
  campus: Campus
  theme: 'light' | 'dark'
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (data: any) => void
  onDelete: () => void
  onAddGrade: (campusId: string) => void
  newGrade: { campusId: string; name: string; level: number } | null
  onNewGradeChange: (data: { campusId: string; name: string; level: number } | null) => void
  onSaveGrade: () => void
  onUpdateGrade: (gradeId: string, data: any) => void
  onDeleteGrade: (gradeId: string) => void
  gradeLevels: number[]
  principalOptions: Array<{ id: string; name: string; email: string }>
}

function CampusEditCard({
  campus,
  theme,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onAddGrade,
  newGrade,
  onNewGradeChange,
  onSaveGrade,
  onUpdateGrade,
  onDeleteGrade,
  gradeLevels,
  principalOptions
}: CampusEditCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({
    name: campus.name,
    address: campus.address,
    phone: campus.phone || '',
    email: campus.email || '',
    principal: campus.principal || 'none',
    isActive: campus.isActive
  })
  const [editingGrades, setEditingGrades] = useState<Map<string, { name: string; level: number }>>(new Map())

  // Cuando se activa el modo edición, expandir automáticamente
  const handleStartEdit = () => {
    setEditMode(true)
    if (!isExpanded) {
      onToggle()
    }
  }

  const handleSave = () => {
    // Convertir 'none' a string vacío antes de guardar
    const dataToSave = {
      ...editData,
      principal: editData.principal === 'none' ? '' : editData.principal
    }
    onUpdate(dataToSave)
    setEditMode(false)
  }

  const handleCancel = () => {
    setEditData({
      name: campus.name,
      address: campus.address,
      phone: campus.phone || '',
      email: campus.email || '',
      principal: campus.principal || 'none',
      isActive: campus.isActive
    })
    setEditMode(false)
  }

  const startEditGrade = (grade: any) => {
    setEditingGrades(prev => new Map(prev).set(grade.id, { name: grade.name, level: grade.level }))
  }

  const cancelEditGrade = (gradeId: string) => {
    setEditingGrades(prev => {
      const newMap = new Map(prev)
      newMap.delete(gradeId)
      return newMap
    })
  }

  const saveEditGrade = (gradeId: string) => {
    const gradeData = editingGrades.get(gradeId)
    if (gradeData) {
      onUpdateGrade(gradeId, gradeData)
      cancelEditGrade(gradeId)
    }
  }

  // Mostrar contenido si está expandido O en modo edición
  const shouldShowContent = isExpanded || editMode

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {!editMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="p-0 h-auto"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
              </Button>
            )}
            <div className="flex-1">
              {editMode ? (
                <div className="grid gap-2">
                  <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre de la sede *</Label>
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
              ) : (
                <>
                  <CardTitle className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
                    {campus.name}
                  </CardTitle>
                  <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                    {campus.address}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={handleCancel} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={handleStartEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      {shouldShowContent && (
        <CardContent className="space-y-4">
          {editMode ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Dirección *</Label>
                <Textarea
                  value={editData.address}
                  onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Teléfono</Label>
                  <Input
                    value={editData.phone}
                    onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Email</Label>
                  <Input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Director</Label>
                <Select
                  value={editData.principal || 'none'}
                  onValueChange={(value) => {
                    setEditData(prev => ({ ...prev, principal: value === 'none' ? '' : value }))
                  }}
                >
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar coordinador" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectItem value="none">Sin director asignado</SelectItem>
                    {principalOptions.map(principal => (
                      <SelectItem key={principal.id} value={principal.id}>
                        {principal.name} ({principal.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editData.isActive}
                  onChange={(e) => setEditData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Sede activa</Label>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {campus.phone && (
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                  <strong>Teléfono:</strong> {campus.phone}
                </p>
              )}
              {campus.email && (
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                  <strong>Email:</strong> {campus.email}
                </p>
              )}
              {campus.principal && (() => {
                const principal = principalOptions.find(p => p.id === campus.principal)
                return principal ? (
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                    <strong>Director:</strong> {principal.name} ({principal.email})
                  </p>
                ) : (
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                    <strong>Director:</strong> {campus.principal}
                  </p>
                )
              })()}
            </div>
          )}

          {/* Gestión de Grados */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-black')}>
                Grados ({campus.grades?.length || 0})
              </h4>
              {!newGrade && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddGrade(campus.id)}
                  className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Grado
                </Button>
              )}
            </div>

            {/* Formulario para nuevo grado */}
            {newGrade && newGrade.campusId === campus.id && (
              <Card className={cn("p-3", theme === 'dark' ? 'bg-zinc-800 border-zinc-600' : 'bg-gray-50 border-gray-200')}>
                <div className="flex items-center justify-between mb-3">
                  <h5 className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-black')}>Nuevo Grado</h5>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onNewGradeChange(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className={cn('text-xs font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre *</Label>
                    <Input
                      value={newGrade.name}
                      onChange={(e) => onNewGradeChange({ ...newGrade, name: e.target.value })}
                      placeholder="Ej: 6°, 7°..."
                      className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className={cn('text-xs font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nivel</Label>
                    <Select
                      value={newGrade.level.toString()}
                      onValueChange={(value) => onNewGradeChange({ ...newGrade, level: parseInt(value) })}
                    >
                      <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeLevels.map(level => (
                          <SelectItem key={level} value={level.toString()}>
                            {level}°
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={onSaveGrade} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white w-full">
                  Guardar Grado
                </Button>
              </Card>
            )}

            {/* Lista de grados */}
            <div className="space-y-2">
              {campus.grades && campus.grades.length > 0 ? (
                campus.grades.map((grade) => {
                  const isEditing = editingGrades.has(grade.id)
                  const editData = editingGrades.get(grade.id) || { name: grade.name, level: grade.level }
                  
                  return (
                    <div
                      key={grade.id}
                      className={cn("flex items-center justify-between p-2 rounded border", theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50')}
                    >
                      {isEditing ? (
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={editData.name}
                            onChange={(e) => setEditingGrades(prev => new Map(prev).set(grade.id, { ...editData, name: e.target.value }))}
                            className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                          />
                          <Select
                            value={editData.level.toString()}
                            onValueChange={(value) => setEditingGrades(prev => new Map(prev).set(grade.id, { ...editData, level: parseInt(value) }))}
                          >
                            <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeLevels.map(level => (
                                <SelectItem key={level} value={level.toString()}>
                                  {level}°
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-black')}>
                            {grade.name} ({grade.level}°)
                          </p>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => cancelEditGrade(grade.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => saveEditGrade(grade.id)}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => startEditGrade(grade)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onDeleteGrade(grade.id)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className={cn("text-center py-4 text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay grados registrados
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface InstitutionManagementProps {
  theme: 'light' | 'dark'
}

export default function InstitutionManagement({ theme }: InstitutionManagementProps) {
  const { notifySuccess, notifyError, notifyInfo } = useNotification()
  const { data: institutions = [], isLoading, error } = useInstitutions()
  const { createCampus, createGrade, updateInstitution, deleteInstitution, updateCampus, deleteCampus, updateGrade, deleteGrade } = useInstitutionMutations()
  
  // Estado local para controlar el loading del botón de actualizar
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Obtener rectores y coordinadores para los selects
  const { data: allRectors = [] } = useRectors()
  const { principals: allPrincipals = [] } = useFilteredPrincipals({ 
    isActive: true 
  })
  
  // Estados para gestión de sedes y grados en el modal de edición
  const [editingCampuses, setEditingCampuses] = useState<Campus[]>([])
  const [expandedCampusSections, setExpandedCampusSections] = useState<Set<string>>(new Set())
  const [newCampusInEdit, setNewCampusInEdit] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    principal: ''
  })
  const [newGradeInEdit, setNewGradeInEdit] = useState<{campusId: string, name: string, level: number} | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isCreateCampusDialogOpen, setIsCreateCampusDialogOpen] = useState(false)
  const [isCreateGradeDialogOpen, setIsCreateGradeDialogOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isViewInstitutionDialogOpen, setIsViewInstitutionDialogOpen] = useState(false)
  const [isEditInstitutionDialogOpen, setIsEditInstitutionDialogOpen] = useState(false)
  const [isEditCampusDialogOpen, setIsEditCampusDialogOpen] = useState(false)
  const [isEditGradeDialogOpen, setIsEditGradeDialogOpen] = useState(false)
  // const [activeTab, setActiveTab] = useState('institutions')
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  
  // Obtener rectores filtrados por institución seleccionada (después de declarar selectedInstitution)
  const rectorsForInstitution = selectedInstitution && allRectors
    ? allRectors.filter(rector => rector?.institutionId === selectedInstitution.id)
    : (allRectors || [])
  
  // Obtener coordinadores filtrados por institución seleccionada (después de declarar selectedInstitution)
  const principalsForInstitution = selectedInstitution && allPrincipals
    ? allPrincipals.filter(principal => principal?.institutionId === selectedInstitution.id)
    : (allPrincipals || [])
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null)
  const [selectedGrade, _setSelectedGrade] = useState<any>(null)
  const [institutionToDelete, setInstitutionToDelete] = useState<Institution | null>(null)
  const [campusToDelete, setCampusToDelete] = useState<{institution: Institution, campus: Campus} | null>(null)
  const [gradeToDelete, setGradeToDelete] = useState<{institution: Institution, campus: Campus, grade: any} | null>(null)


  const [newCampus, setNewCampus] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    principal: ''
  })

  const [newGrade, setNewGrade] = useState({
    name: '',
    level: 6
  })

  const [editInstitution, setEditInstitution] = useState({
    name: '',
    type: 'public' as 'public' | 'private',
    nit: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    rector: '',
    logo: '',
    isActive: true
  })

  const [editCampus, setEditCampus] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    principal: '',
    isActive: true
  })

  const [editGrade, setEditGrade] = useState({
    name: '',
    level: 6,
    isActive: true
  })


  const institutionTypes = [
    { value: 'public', label: 'Pública' },
    { value: 'private', label: 'Privada' }
  ]

  const gradeLevels = [6, 7, 8, 9, 10, 11]

  // Efecto para sincronizar el estado de sedes cuando se actualizan los datos de la institución
  useEffect(() => {
    if (isEditInstitutionDialogOpen && selectedInstitution) {
      const updatedInstitution = institutions.find(inst => inst.id === selectedInstitution.id)
      if (updatedInstitution) {
        setEditingCampuses(updatedInstitution.campuses || [])
      }
    }
  }, [institutions, isEditInstitutionDialogOpen, selectedInstitution?.id])

  // Función para limpiar formularios
  const clearForms = () => {
    setNewCampus({
      name: '',
      address: '',
      phone: '',
      email: '',
      principal: ''
    })
    setNewGrade({
      name: '',
      level: 6
    })
  }


  const handleCreateCampus = async () => {
    if (!newCampus.name || !newCampus.address) {
      notifyError({ title: 'Error', message: 'Nombre y dirección de la sede son obligatorios' })
      return
    }
    
    if (!selectedInstitution) {
      notifyError({ title: 'Error', message: 'Debes seleccionar una institución' })
      return
    }

    try {
      await createCampus.mutateAsync({
        institutionId: selectedInstitution.id,
        ...newCampus
      })
      setIsCreateCampusDialogOpen(false)
      setNewCampus({
        name: '',
        address: '',
        phone: '',
        email: '',
        principal: ''
      })
      notifySuccess({ title: 'Éxito', message: 'Sede creada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al crear la sede' })
    }
  }

  const handleCreateGrade = async () => {
    if (!newGrade.name) {
      notifyError({ title: 'Error', message: 'Nombre del grado es obligatorio' })
      return
    }
    
    if (!selectedInstitution) {
      notifyError({ title: 'Error', message: 'Debes seleccionar una institución' })
      return
    }
    
    if (!selectedCampus) {
      notifyError({ title: 'Error', message: 'Debes seleccionar una sede' })
      return
    }

    try {
      await createGrade.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId: selectedCampus.id,
        ...newGrade
      })
      setIsCreateGradeDialogOpen(false)
      setNewGrade({
        name: '',
        level: 6
      })
      notifySuccess({ title: 'Éxito', message: 'Grado creado correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al crear el grado' })
    }
  }

  // Funciones para ver detalles
  const handleViewInstitution = (institution: Institution) => {
    setSelectedInstitution(institution)
    setIsViewInstitutionDialogOpen(true)
  }

  // Funciones para editar
  const handleEditInstitution = (institution: Institution) => {
    setSelectedInstitution(institution)
    // Obtener el ID del rector si es un objeto, o usar el valor directamente si es un string
    let rectorId = ''
    if (institution.rector) {
      if (typeof institution.rector === 'object' && institution.rector !== null) {
        rectorId = (institution.rector as any).id || (institution.rector as any).uid || ''
      } else if (typeof institution.rector === 'string') {
        rectorId = institution.rector
      }
    }
    
    setEditInstitution({
      name: institution.name,
      type: institution.type,
      nit: institution.nit || '',
      address: institution.address,
      phone: institution.phone || '',
      email: institution.email || '',
      website: institution.website || '',
      rector: rectorId || 'none',
      logo: institution.logo || '',
      isActive: institution.isActive
    })
    // Cargar sedes existentes
    setEditingCampuses(institution.campuses || [])
    setExpandedCampusSections(new Set())
    setNewCampusInEdit({
      name: '',
      address: '',
      phone: '',
      email: '',
      principal: ''
    })
    setNewGradeInEdit(null)
    setIsEditInstitutionDialogOpen(true)
  }
  
  // Función para agregar nueva sede en el modal de edición
  const handleAddCampusInEdit = async () => {
    if (!selectedInstitution || !newCampusInEdit.name || !newCampusInEdit.address) {
      notifyError({ title: 'Error', message: 'Nombre y dirección de la sede son obligatorios' })
      return
    }

    try {
      await createCampus.mutateAsync({
        institutionId: selectedInstitution.id,
        ...newCampusInEdit
      })
      setNewCampusInEdit({
        name: '',
        address: '',
        phone: '',
        email: '',
        principal: ''
      })
      notifySuccess({ title: 'Éxito', message: 'Sede agregada correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al agregar la sede' })
    }
  }
  
  // Función para actualizar sede en el modal de edición
  const handleUpdateCampusInEdit = async (campusId: string, data: any) => {
    if (!selectedInstitution) return

    try {
      await updateCampus.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId,
        data
      })
      notifySuccess({ title: 'Éxito', message: 'Sede actualizada correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar la sede' })
    }
  }
  
  // Función para eliminar sede en el modal de edición
  const handleDeleteCampusInEdit = async (campusId: string) => {
    if (!selectedInstitution) return

    try {
      await deleteCampus.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId
      })
      notifySuccess({ title: 'Éxito', message: 'Sede eliminada correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar la sede' })
    }
  }
  
  // Función para agregar nuevo grado en el modal de edición
  const handleAddGradeInEdit = async (campusId: string) => {
    if (!selectedInstitution || !newGradeInEdit || !newGradeInEdit.name) {
      notifyError({ title: 'Error', message: 'Nombre del grado es obligatorio' })
      return
    }

    try {
      await createGrade.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId,
        name: newGradeInEdit.name,
        level: newGradeInEdit.level
      })
      setNewGradeInEdit(null)
      notifySuccess({ title: 'Éxito', message: 'Grado agregado correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al agregar el grado' })
    }
  }
  
  // Función para actualizar grado en el modal de edición
  const handleUpdateGradeInEdit = async (campusId: string, gradeId: string, data: any) => {
    if (!selectedInstitution) return

    try {
      await updateGrade.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId,
        gradeId,
        data
      })
      notifySuccess({ title: 'Éxito', message: 'Grado actualizado correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el grado' })
    }
  }
  
  // Función para eliminar grado en el modal de edición
  const handleDeleteGradeInEdit = async (campusId: string, gradeId: string) => {
    if (!selectedInstitution) return

    try {
      await deleteGrade.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId,
        gradeId
      })
      notifySuccess({ title: 'Éxito', message: 'Grado eliminado correctamente' })
      // El efecto sincronizará el estado automáticamente
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el grado' })
    }
  }
  
  // Función para toggle de sección expandible de sede
  const toggleCampusSection = (campusId: string) => {
    setExpandedCampusSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(campusId)) {
        newSet.delete(campusId)
      } else {
        newSet.add(campusId)
      }
      return newSet
    })
  }

  const handleUpdateInstitution = async () => {
    if (!selectedInstitution || !editInstitution.name || !editInstitution.address) {
      notifyError({ title: 'Error', message: 'Nombre y dirección son obligatorios' })
      return
    }

    if (isUpdating) return // Prevenir múltiples clics

    setIsUpdating(true)
    
    try {
      // Convertir 'none' a string vacío antes de guardar
      const dataToSave = {
        ...editInstitution,
        rector: editInstitution.rector === 'none' ? '' : editInstitution.rector
      }
      
      // Mostrar notificación de proceso
      const isActivationChange = editInstitution.isActive !== selectedInstitution.isActive
      if (isActivationChange) {
        notifyInfo({ 
          title: 'Procesando...', 
          message: editInstitution.isActive 
            ? 'Activando institución y actualizando componentes...' 
            : 'Desactivando institución y actualizando componentes...'
        })
      }
      
      const result = await updateInstitution.mutateAsync({
        id: selectedInstitution.id,
        data: dataToSave
      })
      
      // Verificar que la actualización fue exitosa
      if (!result.success) {
        throw new Error(result.error?.message || 'Error al actualizar la institución')
      }
      
      setIsEditInstitutionDialogOpen(false)
      setIsUpdating(false)
      
      // El efecto sincronizará el estado automáticamente
      notifySuccess({ 
        title: 'Éxito', 
        message: isActivationChange 
          ? `Institución ${editInstitution.isActive ? 'activada' : 'desactivada'} correctamente. Los usuarios se están actualizando en segundo plano.`
          : 'Institución actualizada correctamente'
      })
    } catch (error: any) {
      console.error('Error al actualizar institución:', error)
      setIsUpdating(false)
      notifyError({ 
        title: 'Error', 
        message: error?.message || 'Error al actualizar la institución. Por favor, intenta nuevamente.' 
      })
    }
  }

  const handleUpdateCampus = async () => {
    if (!selectedInstitution || !selectedCampus || !editCampus.name || !editCampus.address) {
      notifyError({ title: 'Error', message: 'Nombre y dirección son obligatorios' })
      return
    }

    try {
      await updateCampus.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId: selectedCampus.id,
        data: editCampus
      })
      setIsEditCampusDialogOpen(false)
      notifySuccess({ title: 'Éxito', message: 'Sede actualizada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar la sede' })
    }
  }

  const handleUpdateGrade = async () => {
    if (!selectedInstitution || !selectedCampus || !selectedGrade || !editGrade.name) {
      notifyError({ title: 'Error', message: 'Nombre del grado es obligatorio' })
      return
    }

    try {
      await updateGrade.mutateAsync({
        institutionId: selectedInstitution.id,
        campusId: selectedCampus.id,
        gradeId: selectedGrade.id,
        data: editGrade
      })
      setIsEditGradeDialogOpen(false)
      notifySuccess({ title: 'Éxito', message: 'Grado actualizado correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar el grado' })
    }
  }

  // Funciones para eliminar
  const handleDeleteInstitution = async () => {
    if (!institutionToDelete) return

    try {
      await deleteInstitution.mutateAsync(institutionToDelete.id)
      setInstitutionToDelete(null)
      notifySuccess({ title: 'Éxito', message: 'Institución eliminada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar la institución' })
    }
  }

  const handleDeleteCampus = async () => {
    if (!campusToDelete) return

    try {
      await deleteCampus.mutateAsync({
        institutionId: campusToDelete.institution.id,
        campusId: campusToDelete.campus.id
      })
      setCampusToDelete(null)
      notifySuccess({ title: 'Éxito', message: 'Sede eliminada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar la sede' })
    }
  }

  const handleDeleteGrade = async () => {
    if (!gradeToDelete) return

    try {
      await deleteGrade.mutateAsync({
        institutionId: gradeToDelete.institution.id,
        campusId: gradeToDelete.campus.id,
        gradeId: gradeToDelete.grade.id
      })
      setGradeToDelete(null)
      notifySuccess({ title: 'Éxito', message: 'Grado eliminado correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al eliminar el grado' })
    }
  }

  const filteredInstitutions = institutions.filter(institution => {
    const matchesSearch = institution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         institution.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'all' || institution.type === selectedType
    const matchesStatus = selectedStatus === 'all' || 
                         (selectedStatus === 'active' && institution.isActive) ||
                         (selectedStatus === 'inactive' && !institution.isActive)
    
    return matchesSearch && matchesType && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando instituciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-4">Error al cargar las instituciones</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const getInstitutionTypeIcon = (type: string) => {
    switch (type) {
      case 'public':
        return <Building className="h-4 w-4" />
      case 'private':
        return <GraduationCap className="h-4 w-4" />
      default:
        return <Building className="h-4 w-4" />
    }
  }

  const getInstitutionTypeLabel = (type: string) => {
    const typeObj = institutionTypes.find(t => t.value === type)
    return typeObj ? typeObj.label : type
  }

  const getInstitutionTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'public':
        return 'default'
      case 'private':
        return 'secondary'
      default:
        return 'default'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
            Gestión de Instituciones
          </h2>
          <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
            Administra la estructura institucional jerárquica
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-4" />
            Crear Institución
          </Button>
          
          {/* Botones ocultos temporalmente */}
          {/* <Dialog open={isCreateCampusDialogOpen} onOpenChange={setIsCreateCampusDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                onClick={() => {
                  // Si no hay instituciones, mostrar error
                  if (institutions.length === 0) {
                    notifyError({ title: 'Error', message: 'No hay instituciones disponibles. Crea una institución primero.' })
                    return
                  }
                  // Si no hay institución seleccionada, seleccionar la primera
                  if (!selectedInstitution && institutions.length > 0) {
                    setSelectedInstitution(institutions[0])
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Sede
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={isCreateGradeDialogOpen} onOpenChange={setIsCreateGradeDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                onClick={() => {
                  // Si no hay instituciones, mostrar error
                  if (institutions.length === 0) {
                    notifyError({ title: 'Error', message: 'No hay instituciones disponibles. Crea una institución primero.' })
                    return
                  }
                  // Si no hay institución seleccionada, seleccionar la primera
                  if (!selectedInstitution && institutions.length > 0) {
                    setSelectedInstitution(institutions[0])
                  }
                  // Verificar si la institución seleccionada tiene sedes
                  if (selectedInstitution && selectedInstitution.campuses.length === 0) {
                    notifyError({ title: 'Error', message: 'Esta institución no tiene sedes. Crea una sede primero.' })
                    return
                  }
                  // Si no hay sede seleccionada pero hay institución con sedes, seleccionar la primera sede
                  if (selectedInstitution && selectedInstitution.campuses.length > 0 && !selectedCampus) {
                    setSelectedCampus(selectedInstitution.campuses[0])
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Grado
              </Button>
            </DialogTrigger>
          </Dialog> */}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar instituciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {institutionTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de instituciones */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
            Instituciones ({filteredInstitutions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInstitutions.map((institution) => (
              <div key={institution.id} className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                      {institution.logo ? (
                        <img 
                          src={institution.logo} 
                          alt={`Logo de ${institution.name}`}
                          className="w-6 h-6 object-cover rounded"
                        />
                      ) : (
                        getInstitutionTypeIcon(institution.type)
                      )}
                      <h3 className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
                        {institution.name}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-1 mb-2">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
                        {institution.address}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <InstitutionStats 
                        institutionId={institution.id}
                        theme={theme}
                      />
                      <Badge variant={getInstitutionTypeBadgeVariant(institution.type)}>
                        {getInstitutionTypeLabel(institution.type)}
                      </Badge>
                      <Badge variant={institution.isActive ? 'default' : 'secondary'}>
                        {institution.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewInstitution(institution)}
                      className="border-purple-500 text-purple-600 hover:bg-purple-50"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalles
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditInstitution(institution)}
                      title="Editar institución"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" title="Más opciones">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => setInstitutionToDelete(institution)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar institución
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


      {/* Dialog para crear sede */}
      <Dialog open={isCreateCampusDialogOpen} onOpenChange={(open) => {
        setIsCreateCampusDialogOpen(open)
        if (!open) {
          clearForms()
          setSelectedInstitution(null)
        }
      }}>
        <DialogContent className={cn("sm:max-w-[500px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>Crear Nueva Sede</DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Agrega una nueva sede a una institución.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campusInstitution" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Institución *</Label>
              <Select 
                value={selectedInstitution?.id || ''} 
                onValueChange={(value) => {
                  const institution = institutions.find(inst => inst.id === value)
                  setSelectedInstitution(institution || null)
                }}
              >
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                  <SelectValue placeholder="Seleccionar institución" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map(institution => (
                    <SelectItem key={institution.id} value={institution.id}>
                      {institution.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campusName" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre de la sede *</Label>
              <Input
                id="campusName"
                value={newCampus.name}
                onChange={(e) => setNewCampus(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Sede Principal"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campusAddress" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Dirección *</Label>
              <Textarea
                id="campusAddress"
                value={newCampus.address}
                onChange={(e) => setNewCampus(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección completa de la sede"
                rows={2}
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campusPhone" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Teléfono</Label>
                <Input
                  id="campusPhone"
                  value={newCampus.phone}
                  onChange={(e) => setNewCampus(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 1 234-5678"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campusEmail" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Email</Label>
                <Input
                  id="campusEmail"
                  type="email"
                  value={newCampus.email}
                  onChange={(e) => setNewCampus(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="sede@institucion.edu.co"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCampusDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCampus} className="bg-black text-white hover:bg-gray-800">
              Crear Sede
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear grado */}
      <Dialog open={isCreateGradeDialogOpen} onOpenChange={(open) => {
        setIsCreateGradeDialogOpen(open)
        if (!open) {
          clearForms()
          setSelectedInstitution(null)
          setSelectedCampus(null)
        }
      }}>
        <DialogContent className={cn("sm:max-w-[500px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>Crear Nuevo Grado</DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Agrega un nuevo grado a una sede.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gradeInstitution" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Institución *</Label>
              <Select 
                value={selectedInstitution?.id || ''} 
                onValueChange={(value) => {
                  const institution = institutions.find(inst => inst.id === value)
                  setSelectedInstitution(institution || null)
                  setSelectedCampus(null) // Reset campus when institution changes
                }}
              >
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                  <SelectValue placeholder="Seleccionar institución" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map(institution => (
                    <SelectItem key={institution.id} value={institution.id}>
                      {institution.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedInstitution && (
              <div className="grid gap-2">
                <Label htmlFor="gradeCampus" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Sede *</Label>
                {selectedInstitution.campuses.length > 0 ? (
                  <Select 
                    value={selectedCampus?.id || ''} 
                    onValueChange={(value) => {
                      const campus = selectedInstitution.campuses.find(c => c.id === value)
                      setSelectedCampus(campus || null)
                    }}
                  >
                    <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                      <SelectValue placeholder="Seleccionar sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedInstitution.campuses.map(campus => (
                        <SelectItem key={campus.id} value={campus.id}>
                          {campus.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className={cn("p-3 border border-dashed rounded-md text-center", theme === 'dark' ? 'border-zinc-600 text-gray-400' : 'border-gray-300 text-black')}>
                    <p className="text-sm font-semibold">Esta institución no tiene sedes.</p>
                    <p className="text-xs font-semibold">Crea una sede primero para poder agregar grados.</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="gradeName" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre del grado *</Label>
              <Input
                id="gradeName"
                value={newGrade.name}
                onChange={(e) => setNewGrade(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: 6°, 7°, 8°..."
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gradeLevel" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nivel del grado</Label>
              <Select value={newGrade.level.toString()} onValueChange={(value) => setNewGrade(prev => ({ ...prev, level: parseInt(value) }))}>
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map(level => (
                    <SelectItem key={level} value={level.toString()}>
                      {level}°
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGradeDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button onClick={handleCreateGrade} className="bg-black text-white hover:bg-gray-800">
              Crear Grado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para ver detalles de institución - Versión Interactiva */}
      <Dialog open={isViewInstitutionDialogOpen} onOpenChange={setIsViewInstitutionDialogOpen}>
        <DialogContent className={cn("sm:max-w-[900px] max-h-[90vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
              Detalles de la Institución
            </DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Información completa e interactiva de {selectedInstitution?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedInstitution && (
            <InstitutionDetailView 
              institution={selectedInstitution} 
              theme={theme}
              onClose={() => setIsViewInstitutionDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para editar institución */}
      <Dialog open={isEditInstitutionDialogOpen} onOpenChange={setIsEditInstitutionDialogOpen}>
        <DialogContent className={cn("sm:max-w-[900px] max-h-[90vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>Editar Institución</DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Modifica la información de {selectedInstitution?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Información básica de la institución */}
            <div className="space-y-4">
              <h3 className={cn('text-lg font-bold border-b pb-2', theme === 'dark' ? 'text-white border-zinc-700' : 'text-black border-gray-200')}>
                Información Básica
              </h3>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editInstitutionName" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre de la institución *</Label>
                  <Input
                    id="editInstitutionName"
                    value={editInstitution.name}
                    onChange={(e) => setEditInstitution(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Colegio San José"
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionType" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Tipo de institución *</Label>
                    <Select value={editInstitution.type} onValueChange={(value: 'public' | 'private') => setEditInstitution(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                        {institutionTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionNIT" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>NIT (opcional)</Label>
                    <Input
                      id="editInstitutionNIT"
                      value={editInstitution.nit}
                      onChange={(e) => setEditInstitution(prev => ({ ...prev, nit: e.target.value }))}
                      placeholder="900123456-1"
                      className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editInstitutionAddress" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Dirección *</Label>
                  <Textarea
                    id="editInstitutionAddress"
                    value={editInstitution.address}
                    onChange={(e) => setEditInstitution(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Dirección completa de la institución"
                    rows={2}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionPhone" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Teléfono</Label>
                    <Input
                      id="editInstitutionPhone"
                      value={editInstitution.phone}
                      onChange={(e) => setEditInstitution(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+57 1 234-5678"
                      className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionEmail" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Email</Label>
                    <Input
                      id="editInstitutionEmail"
                      type="email"
                      value={editInstitution.email}
                      onChange={(e) => setEditInstitution(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@institucion.edu.co"
                      className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionWebsite" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Sitio web</Label>
                    <Input
                      id="editInstitutionWebsite"
                      value={editInstitution.website}
                      onChange={(e) => setEditInstitution(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="www.institucion.edu.co"
                      className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editInstitutionRector" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Rector</Label>
                    <Select
                      value={editInstitution.rector || 'none'}
                      onValueChange={(value) => {
                        setEditInstitution(prev => ({ ...prev, rector: value === 'none' ? '' : value }))
                      }}
                    >
                      <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                        <SelectValue placeholder="Seleccionar rector" />
                      </SelectTrigger>
                      <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                        <SelectItem value="none">Sin rector asignado</SelectItem>
                        {rectorsForInstitution.length > 0 ? (
                          rectorsForInstitution.map(rector => (
                            <SelectItem key={rector.id} value={rector.id}>
                              {rector.name} ({rector.email})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-rectors" disabled>No hay rectores disponibles</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <ImageUpload
                    value={editInstitution.logo}
                    onChange={(value) => setEditInstitution(prev => ({ ...prev, logo: value }))}
                    label="Logo de la institución"
                    placeholder="Arrastra y suelta el logo aquí o haz clic para seleccionar"
                    theme={theme}
                    maxSize={2}
                  />
                </div>

                <div className={cn("flex items-center justify-between p-4 rounded-lg border", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="editInstitutionActive"
                      checked={editInstitution.isActive}
                      onChange={(e) => setEditInstitution(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 rounded cursor-pointer"
                    />
                    <Label htmlFor="editInstitutionActive" className={cn('font-bold cursor-pointer', theme === 'dark' ? 'text-gray-300' : 'text-black')}>
                      Institución activa
                    </Label>
                  </div>
                  <Badge variant={editInstitution.isActive ? 'default' : 'secondary'} className="ml-2">
                    {editInstitution.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                {!editInstitution.isActive && (
                  <div className={cn("p-3 rounded-lg border", theme === 'dark' ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800')}>
                    <p className="text-sm font-semibold">
                      ⚠️ Al desactivar esta institución, también se desactivarán automáticamente todos sus campus, grados y usuarios asociados.
                    </p>
                  </div>
                )}
                {editInstitution.isActive && selectedInstitution && !selectedInstitution.isActive && (
                  <div className={cn("p-3 rounded-lg border", theme === 'dark' ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-800')}>
                    <p className="text-sm font-semibold">
                      ✅ Al reactivar esta institución, también se reactivarán automáticamente todos sus campus, grados y usuarios asociados.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Gestión de Sedes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white border-zinc-700' : 'text-black border-gray-200')}>
                  Sedes ({editingCampuses.length})
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddCampusInEdit}
                  className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Sede
                </Button>
              </div>

              {/* Formulario para nueva sede */}
              {(newCampusInEdit.name || newCampusInEdit.address) && (
                <Card className={cn("p-4", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-black')}>Nueva Sede</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNewCampusInEdit({ name: '', address: '', phone: '', email: '', principal: '' })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre de la sede *</Label>
                      <Input
                        value={newCampusInEdit.name}
                        onChange={(e) => setNewCampusInEdit(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej: Sede Principal"
                        className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Dirección *</Label>
                      <Textarea
                        value={newCampusInEdit.address}
                        onChange={(e) => setNewCampusInEdit(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Dirección completa de la sede"
                        rows={2}
                        className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Teléfono</Label>
                        <Input
                          value={newCampusInEdit.phone}
                          onChange={(e) => setNewCampusInEdit(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+57 1 234-5678"
                          className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Email</Label>
                        <Input
                          type="email"
                          value={newCampusInEdit.email}
                          onChange={(e) => setNewCampusInEdit(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="sede@institucion.edu.co"
                          className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Director</Label>
                      <Select
                        value={newCampusInEdit.principal || 'none'}
                        onValueChange={(value) => setNewCampusInEdit(prev => ({ ...prev, principal: value === 'none' ? '' : value }))}
                      >
                        <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                          <SelectValue placeholder="Seleccionar coordinador" />
                        </SelectTrigger>
                        <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                          <SelectItem value="none">Sin director asignado</SelectItem>
                          {principalsForInstitution.length > 0 ? (
                            principalsForInstitution.map(principal => (
                              <SelectItem key={principal.id} value={principal.id}>
                                {principal.name} ({principal.email})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-principals" disabled>No hay coordinadores disponibles</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddCampusInEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
                      Guardar Sede
                    </Button>
                  </div>
                </Card>
              )}

              {/* Lista de sedes existentes */}
              <div className="space-y-3">
                {editingCampuses.map((campus) => (
                  <CampusEditCard
                    key={campus.id}
                    campus={campus}
                    theme={theme}
                    isExpanded={expandedCampusSections.has(campus.id)}
                    onToggle={() => toggleCampusSection(campus.id)}
                    onUpdate={(data) => handleUpdateCampusInEdit(campus.id, data)}
                    onDelete={() => handleDeleteCampusInEdit(campus.id)}
                    onAddGrade={(campusId) => setNewGradeInEdit({ campusId, name: '', level: 6 })}
                    newGrade={newGradeInEdit?.campusId === campus.id ? newGradeInEdit : null}
                    onNewGradeChange={(data) => setNewGradeInEdit(data)}
                    onSaveGrade={() => newGradeInEdit && handleAddGradeInEdit(newGradeInEdit.campusId)}
                    onUpdateGrade={(gradeId, data) => handleUpdateGradeInEdit(campus.id, gradeId, data)}
                    onDeleteGrade={(gradeId) => handleDeleteGradeInEdit(campus.id, gradeId)}
                    gradeLevels={gradeLevels}
                    principalOptions={principalsForInstitution.map(p => ({ id: p.id, name: p.name, email: p.email }))}
                  />
                ))}
                {editingCampuses.length === 0 && (
                  <div className={cn("text-center py-8 border border-dashed rounded-lg", theme === 'dark' ? 'border-zinc-700 text-gray-400' : 'border-gray-300 text-gray-500')}>
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No hay sedes registradas</p>
                    <p className="text-xs">Haz clic en "Agregar Sede" para crear una nueva</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditInstitutionDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateInstitution} 
              disabled={isUpdating || updateInstitution.isPending}
              className="bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating || updateInstitution.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar Institución'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar sede */}
      <Dialog open={isEditCampusDialogOpen} onOpenChange={setIsEditCampusDialogOpen}>
        <DialogContent className={cn("sm:max-w-[500px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>Editar Sede</DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Modifica la información de {selectedCampus?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editCampusName" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre de la sede *</Label>
              <Input
                id="editCampusName"
                value={editCampus.name}
                onChange={(e) => setEditCampus(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Sede Principal"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editCampusAddress" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Dirección *</Label>
              <Textarea
                id="editCampusAddress"
                value={editCampus.address}
                onChange={(e) => setEditCampus(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Dirección completa de la sede"
                rows={2}
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editCampusPhone" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Teléfono</Label>
                <Input
                  id="editCampusPhone"
                  value={editCampus.phone}
                  onChange={(e) => setEditCampus(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 1 234-5678"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editCampusEmail" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Email</Label>
                <Input
                  id="editCampusEmail"
                  type="email"
                  value={editCampus.email}
                  onChange={(e) => setEditCampus(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="sede@institucion.edu.co"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editCampusPrincipal" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Director</Label>
              <Input
                id="editCampusPrincipal"
                value={editCampus.principal}
                onChange={(e) => setEditCampus(prev => ({ ...prev, principal: e.target.value }))}
                placeholder="Lic. Carlos Mendoza"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editCampusActive"
                checked={editCampus.isActive}
                onChange={(e) => setEditCampus(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="editCampusActive" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Sede activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCampusDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCampus} className="bg-black text-white hover:bg-gray-800">
              Actualizar Sede
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar grado */}
      <Dialog open={isEditGradeDialogOpen} onOpenChange={setIsEditGradeDialogOpen}>
        <DialogContent className={cn("sm:max-w-[500px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>Editar Grado</DialogTitle>
            <DialogDescription className={cn('font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-black')}>
              Modifica la información del grado {selectedGrade?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editGradeName" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nombre del grado *</Label>
              <Input
                id="editGradeName"
                value={editGrade.name}
                onChange={(e) => setEditGrade(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: 6°, 7°, 8°..."
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editGradeLevel" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Nivel del grado</Label>
              <Select value={editGrade.level.toString()} onValueChange={(value) => setEditGrade(prev => ({ ...prev, level: parseInt(value) }))}>
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  {gradeLevels.map(level => (
                    <SelectItem key={level} value={level.toString()}>
                      {level}°
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editGradeActive"
                checked={editGrade.isActive}
                onChange={(e) => setEditGrade(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="editGradeActive" className={cn('font-bold', theme === 'dark' ? 'text-gray-300' : 'text-black')}>Grado activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditGradeDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateGrade} className="bg-black text-white hover:bg-gray-800">
              Actualizar Grado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog para eliminar institución */}
      <AlertDialog open={!!institutionToDelete} onOpenChange={() => setInstitutionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la institución 
              "{institutionToDelete?.name}" y todos sus datos asociados (sedes, grados, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInstitutionToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteInstitution}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog para eliminar sede */}
      <AlertDialog open={!!campusToDelete} onOpenChange={() => setCampusToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la sede 
              "{campusToDelete?.campus.name}" y todos sus grados asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCampusToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCampus}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog para eliminar grado */}
      <AlertDialog open={!!gradeToDelete} onOpenChange={() => setGradeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el grado 
              "{gradeToDelete?.grade.name}" de la sede "{gradeToDelete?.campus.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGradeToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteGrade}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wizard para proceso completo */}
      <InstitutionWizard 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        theme={theme}
      />
    </div>
  )
}
