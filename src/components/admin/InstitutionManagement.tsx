import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  Globe,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { Institution, Campus } from '@/interfaces/db.interface'
import { useInstitutions, useInstitutionMutations } from '@/hooks/query/useInstitutionQuery'
import ImageUpload from '@/components/common/fields/ImageUpload'
import InstitutionWizard from './InstitutionWizard'
import InstitutionStats from './InstitutionStats'

interface InstitutionManagementProps {
  theme: 'light' | 'dark'
}

export default function InstitutionManagement({ theme }: InstitutionManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { data: institutions = [], isLoading, error } = useInstitutions()
  const { createCampus, createGrade, updateInstitution, deleteInstitution, updateCampus, deleteCampus, updateGrade, deleteGrade } = useInstitutionMutations()
  
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
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<any>(null)
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
    isActive: true,
    campuses: [] as Campus[]
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
    setEditInstitution({
      name: institution.name,
      type: institution.type,
      nit: institution.nit || '',
      address: institution.address,
      phone: institution.phone || '',
      email: institution.email || '',
      website: institution.website || '',
      rector: institution.rector || '',
      logo: institution.logo || '',
      isActive: institution.isActive,
      campuses: institution.campuses ? JSON.parse(JSON.stringify(institution.campuses)) : [] // Deep copy
    })
    setIsEditInstitutionDialogOpen(true)
  }

  const handleUpdateInstitution = async () => {
    if (!selectedInstitution || !editInstitution.name || !editInstitution.address) {
      notifyError({ title: 'Error', message: 'Nombre y dirección son obligatorios' })
      return
    }

    // Validar que todas las sedes tengan nombre y dirección
    for (const campus of editInstitution.campuses) {
      if (!campus.name || !campus.address) {
        notifyError({ title: 'Error', message: `La sede "${campus.name || 'sin nombre'}" debe tener nombre y dirección` })
        return
      }
      // Validar que todos los grados tengan nombre
      if (campus.grades) {
        for (const grade of campus.grades) {
          if (!grade.name) {
            notifyError({ title: 'Error', message: `Todos los grados deben tener un nombre` })
            return
          }
        }
      }
    }

    try {
      // Preparar los datos de actualización incluyendo sedes y grados
      // Preservar campos importantes como IDs, createdAt, teachers, students, etc.
      const updateData = {
        name: editInstitution.name,
        type: editInstitution.type,
        nit: editInstitution.nit || undefined,
        address: editInstitution.address,
        phone: editInstitution.phone || undefined,
        email: editInstitution.email || undefined,
        website: editInstitution.website || undefined,
        rector: editInstitution.rector || undefined,
        logo: editInstitution.logo || undefined,
        isActive: editInstitution.isActive,
        campuses: editInstitution.campuses.map(campus => ({
          ...campus,
          // Preservar campos importantes
          id: campus.id,
          createdAt: campus.createdAt || new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          // Preservar grades con sus campos importantes
          grades: (campus.grades || []).map(grade => ({
            ...grade,
            id: grade.id,
            createdAt: grade.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            // Preservar teachers y students si existen
            teachers: grade.teachers || [],
            students: grade.students || []
          }))
        }))
      }

      console.log('📤 Actualizando institución con sedes y grados:', {
        institutionId: selectedInstitution.id,
        campusesCount: editInstitution.campuses.length,
        totalGrades: editInstitution.campuses.reduce((acc, campus) => acc + (campus.grades?.length || 0), 0)
      })

      await updateInstitution.mutateAsync({
        id: selectedInstitution.id,
        data: updateData
      })
      setIsEditInstitutionDialogOpen(false)
      notifySuccess({ title: 'Éxito', message: 'Institución actualizada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al actualizar la institución' })
    }
  }

  const handleEditCampus = (institution: Institution, campus: Campus) => {
    setSelectedInstitution(institution)
    setSelectedCampus(campus)
    setEditCampus({
      name: campus.name,
      address: campus.address,
      phone: campus.phone || '',
      email: campus.email || '',
      principal: campus.principal || '',
      isActive: campus.isActive
    })
    setIsEditCampusDialogOpen(true)
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

  const handleEditGrade = (institution: Institution, campus: Campus, grade: any) => {
    setSelectedInstitution(institution)
    setSelectedCampus(campus)
    setSelectedGrade(grade)
    setEditGrade({
      name: grade.name,
      level: grade.level,
      isActive: grade.isActive
    })
    setIsEditGradeDialogOpen(true)
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

  // Funciones para añadir/eliminar sedes y grados en el diálogo de edición
  const handleAddCampus = () => {
    if (!selectedInstitution) return
    
    const newCampus: Campus = {
      id: `${selectedInstitution.id}-${Date.now()}`, // Generar ID temporal
      name: '',
      address: '',
      phone: '',
      email: '',
      isActive: true,
      grades: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    }
    
    setEditInstitution(prev => ({
      ...prev,
      campuses: [...prev.campuses, newCampus]
    }))
  }

  const handleRemoveCampus = (campusIndex: number) => {
    const campus = editInstitution.campuses[campusIndex]
    if (campus.grades && campus.grades.length > 0) {
      const hasTeachersOrStudents = campus.grades.some(grade => 
        (grade.teachers && grade.teachers.length > 0) || 
        (grade.students && grade.students.length > 0)
      )
      if (hasTeachersOrStudents) {
        notifyError({ 
          title: 'Error', 
          message: 'No se puede eliminar una sede que contiene grados con docentes o estudiantes asignados' 
        })
        return
      }
    }
    
    setEditInstitution(prev => ({
      ...prev,
      campuses: prev.campuses.filter((_, index) => index !== campusIndex)
    }))
  }

  const handleAddGrade = (campusIndex: number) => {
    const campus = editInstitution.campuses[campusIndex]
    if (!campus.id) {
      notifyError({ title: 'Error', message: 'La sede debe tener un ID válido' })
      return
    }
    
    const newGrade = {
      id: `${campus.id}-${Date.now()}`, // Generar ID temporal
      name: '',
      level: 6,
      isActive: true,
      teachers: [],
      students: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    }
    
    const updatedCampuses = [...editInstitution.campuses]
    updatedCampuses[campusIndex] = {
      ...updatedCampuses[campusIndex],
      grades: [...(updatedCampuses[campusIndex].grades || []), newGrade]
    }
    
    setEditInstitution(prev => ({
      ...prev,
      campuses: updatedCampuses
    }))
  }

  const handleRemoveGrade = (campusIndex: number, gradeIndex: number) => {
    const grade = editInstitution.campuses[campusIndex].grades?.[gradeIndex]
    if (grade && ((grade.teachers && grade.teachers.length > 0) || (grade.students && grade.students.length > 0))) {
      notifyError({ 
        title: 'Error', 
        message: 'No se puede eliminar un grado que tiene docentes o estudiantes asignados' 
      })
      return
    }
    
    const updatedCampuses = [...editInstitution.campuses]
    const updatedGrades = [...(updatedCampuses[campusIndex].grades || [])]
    updatedGrades.splice(gradeIndex, 1)
    updatedCampuses[campusIndex] = {
      ...updatedCampuses[campusIndex],
      grades: updatedGrades
    }
    
    setEditInstitution(prev => ({
      ...prev,
      campuses: updatedCampuses
    }))
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
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Gestión de Instituciones
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Administra la estructura institucional jerárquica
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Proceso Completo
          </Button>
          
          <Dialog open={isCreateCampusDialogOpen} onOpenChange={setIsCreateCampusDialogOpen}>
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
          </Dialog>
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
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
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
                      <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {institution.name}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-1 mb-2">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
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
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewInstitution(institution)}
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditInstitution(institution)}
                      title="Editar institución"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
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
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Crear Nueva Sede</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Agrega una nueva sede a una institución.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campusInstitution" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Institución *</Label>
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
              <Label htmlFor="campusName" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre de la sede *</Label>
              <Input
                id="campusName"
                value={newCampus.name}
                onChange={(e) => setNewCampus(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Sede Principal"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campusAddress" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Dirección *</Label>
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
                <Label htmlFor="campusPhone" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Teléfono</Label>
                <Input
                  id="campusPhone"
                  value={newCampus.phone}
                  onChange={(e) => setNewCampus(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 1 234-5678"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campusEmail" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Email</Label>
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
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Crear Nuevo Grado</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Agrega un nuevo grado a una sede.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gradeInstitution" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Institución *</Label>
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
                <Label htmlFor="gradeCampus" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Sede *</Label>
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
                  <div className={cn("p-3 border border-dashed rounded-md text-center", theme === 'dark' ? 'border-zinc-600 text-gray-400' : 'border-gray-300 text-gray-500')}>
                    <p className="text-sm">Esta institución no tiene sedes.</p>
                    <p className="text-xs">Crea una sede primero para poder agregar grados.</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="gradeName" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre del grado *</Label>
              <Input
                id="gradeName"
                value={newGrade.name}
                onChange={(e) => setNewGrade(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: 6°, 7°, 8°..."
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gradeLevel" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nivel del grado</Label>
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

      {/* Modal para ver detalles de institución */}
      <Dialog open={isViewInstitutionDialogOpen} onOpenChange={setIsViewInstitutionDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de la Institución</DialogTitle>
            <DialogDescription>
              Información completa de {selectedInstitution?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedInstitution && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid gap-4">
                <div className="flex items-center space-x-4">
                  {selectedInstitution.logo ? (
                    <img 
                      src={selectedInstitution.logo} 
                      alt={`Logo de ${selectedInstitution.name}`}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      {getInstitutionTypeIcon(selectedInstitution.type)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold">{selectedInstitution.name}</h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getInstitutionTypeBadgeVariant(selectedInstitution.type)}>
                        {getInstitutionTypeLabel(selectedInstitution.type)}
                      </Badge>
                      <Badge variant={selectedInstitution.isActive ? 'default' : 'secondary'}>
                        {selectedInstitution.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información de contacto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Dirección:</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-6">{selectedInstitution.address}</p>
                  
                  {selectedInstitution.phone && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Teléfono:</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{selectedInstitution.phone}</p>
                    </>
                  )}
                  
                  {selectedInstitution.email && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Email:</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{selectedInstitution.email}</p>
                    </>
                  )}
                </div>
                
                <div className="space-y-3">
                  {selectedInstitution.nit && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">NIT:</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{selectedInstitution.nit}</p>
                    </>
                  )}
                  
                  {selectedInstitution.website && (
                    <>
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Sitio web:</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{selectedInstitution.website}</p>
                    </>
                  )}
                  
                  {selectedInstitution.rector && (
                    <>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Rector:</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">{selectedInstitution.rector}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Sedes */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Sedes ({selectedInstitution.campuses.length})</h4>
                {selectedInstitution.campuses.length > 0 ? (
                  <div className="space-y-3">
                    {selectedInstitution.campuses.map((campus) => (
                      <div key={campus.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{campus.name}</h5>
                          <div className="flex items-center space-x-2">
                            <Badge variant={campus.isActive ? 'default' : 'secondary'}>
                              {campus.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <div className="flex items-center space-x-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditCampus(selectedInstitution, campus)}
                                title="Editar sede"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setCampusToDelete({institution: selectedInstitution, campus})}
                                title="Eliminar sede"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{campus.address}</p>
                        {campus.phone && <p className="text-sm text-gray-500">Tel: {campus.phone}</p>}
                        {campus.email && <p className="text-sm text-gray-500">Email: {campus.email}</p>}
                        {campus.principal && <p className="text-sm text-gray-500">Director: {campus.principal}</p>}
                        
                        {/* Grados */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <h6 className="text-sm font-medium">Grados ({campus.grades.length})</h6>
                          </div>
                          <div className="space-y-2">
                            {campus.grades.map((grade) => (
                              <div key={grade.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {grade.name}
                                  </Badge>
                                  <Badge variant={grade.isActive ? 'default' : 'secondary'} className="text-xs">
                                    {grade.isActive ? 'Activo' : 'Inactivo'}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditGrade(selectedInstitution, campus, grade)}
                                    title="Editar grado"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setGradeToDelete({institution: selectedInstitution, campus, grade})}
                                    title="Eliminar grado"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay sedes registradas</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewInstitutionDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar institución */}
      <Dialog open={isEditInstitutionDialogOpen} onOpenChange={setIsEditInstitutionDialogOpen}>
        <DialogContent className={cn("sm:max-w-[600px] max-h-[80vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Editar Institución</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Modifica la información de {selectedInstitution?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editInstitutionName" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre de la institución *</Label>
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
                <Label htmlFor="editInstitutionType" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Tipo de institución *</Label>
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
                <Label htmlFor="editInstitutionNIT" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>NIT (opcional)</Label>
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
              <Label htmlFor="editInstitutionAddress" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Dirección *</Label>
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
                <Label htmlFor="editInstitutionPhone" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Teléfono</Label>
                <Input
                  id="editInstitutionPhone"
                  value={editInstitution.phone}
                  onChange={(e) => setEditInstitution(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 1 234-5678"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editInstitutionEmail" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Email</Label>
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
                <Label htmlFor="editInstitutionWebsite" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Sitio web</Label>
                <Input
                  id="editInstitutionWebsite"
                  value={editInstitution.website}
                  onChange={(e) => setEditInstitution(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="www.institucion.edu.co"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editInstitutionRector" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Rector</Label>
                <Input
                  id="editInstitutionRector"
                  value={editInstitution.rector}
                  onChange={(e) => setEditInstitution(prev => ({ ...prev, rector: e.target.value }))}
                  placeholder="Dr. María González"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editInstitutionActive"
                checked={editInstitution.isActive}
                onChange={(e) => setEditInstitution(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="editInstitutionActive" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Institución activa</Label>
            </div>

            {/* Sección de Sedes y Grados */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Sedes y Grados
                </h3>
                <Button
                  type="button"
                  onClick={handleAddCampus}
                  variant="outline"
                  size="sm"
                  className={cn("flex items-center gap-2", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                >
                  <Plus className="h-4 w-4" />
                  Agregar Sede
                </Button>
              </div>
              
              {editInstitution.campuses.length > 0 ? (
                <div className="space-y-4">
                  {editInstitution.campuses.map((campus, campusIndex) => (
                    <div key={campus.id || campusIndex} className={cn("border rounded-lg p-4", theme === 'dark' ? 'border-zinc-600 bg-zinc-700' : 'border-gray-200 bg-gray-50')}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Sede: {campus.name || 'Nueva Sede'}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={campus.isActive ? 'default' : 'secondary'}>
                            {campus.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                          <Button
                            type="button"
                            onClick={() => handleRemoveCampus(campusIndex)}
                            variant="ghost"
                            size="sm"
                            className={cn("text-red-600 hover:text-red-700 hover:bg-red-50", theme === 'dark' ? 'hover:bg-red-900/20' : '')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Campos editables de la sede */}
                      <div className="grid gap-3 mb-4">
                        <div className="grid gap-2">
                          <Label className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Nombre de la sede *</Label>
                          <Input
                            value={campus.name}
                            onChange={(e) => {
                              const updatedCampuses = [...editInstitution.campuses]
                              updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], name: e.target.value }
                              setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                            }}
                            className={cn(theme === 'dark' ? 'bg-zinc-600 border-zinc-500 text-white' : '')}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Dirección *</Label>
                          <Textarea
                            value={campus.address}
                            onChange={(e) => {
                              const updatedCampuses = [...editInstitution.campuses]
                              updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], address: e.target.value }
                              setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                            }}
                            rows={2}
                            className={cn(theme === 'dark' ? 'bg-zinc-600 border-zinc-500 text-white' : '')}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Teléfono</Label>
                            <Input
                              value={campus.phone || ''}
                              onChange={(e) => {
                                const updatedCampuses = [...editInstitution.campuses]
                                updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], phone: e.target.value }
                                setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                              }}
                              className={cn(theme === 'dark' ? 'bg-zinc-600 border-zinc-500 text-white' : '')}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Email</Label>
                            <Input
                              type="email"
                              value={campus.email || ''}
                              onChange={(e) => {
                                const updatedCampuses = [...editInstitution.campuses]
                                updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], email: e.target.value }
                                setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                              }}
                              className={cn(theme === 'dark' ? 'bg-zinc-600 border-zinc-500 text-white' : '')}
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={campus.isActive}
                            onChange={(e) => {
                              const updatedCampuses = [...editInstitution.campuses]
                              updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], isActive: e.target.checked }
                              setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                            }}
                            className="rounded"
                          />
                          <Label className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : '')}>Sede activa</Label>
                        </div>
                      </div>

                      {/* Grados de la sede */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : '')}>
                            Grados ({campus.grades?.length || 0})
                          </Label>
                          <Button
                            type="button"
                            onClick={() => handleAddGrade(campusIndex)}
                            variant="outline"
                            size="sm"
                            className={cn("flex items-center gap-1 text-xs", theme === 'dark' ? 'bg-zinc-600 text-white border-zinc-500 hover:bg-zinc-500' : '')}
                          >
                            <Plus className="h-3 w-3" />
                            Agregar Grado
                          </Button>
                        </div>
                        {campus.grades && campus.grades.length > 0 ? (
                          <div className="space-y-2">
                            {campus.grades.map((grade, gradeIndex) => (
                              <div key={grade.id || gradeIndex} className={cn("border rounded p-3", theme === 'dark' ? 'border-zinc-500 bg-zinc-600' : 'border-gray-200 bg-white')}>
                                <div className="flex items-center justify-between mb-2">
                                  <Label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : '')}>
                                    Grado #{gradeIndex + 1}
                                  </Label>
                                  <Button
                                    type="button"
                                    onClick={() => handleRemoveGrade(campusIndex, gradeIndex)}
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50", theme === 'dark' ? 'hover:bg-red-900/20' : '')}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="grid gap-2">
                                    <Label className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : '')}>Nombre del grado *</Label>
                                    <Input
                                      value={grade.name}
                                      onChange={(e) => {
                                        const updatedCampuses = [...editInstitution.campuses]
                                        const updatedGrades = [...(updatedCampuses[campusIndex].grades || [])]
                                        updatedGrades[gradeIndex] = { ...updatedGrades[gradeIndex], name: e.target.value }
                                        updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], grades: updatedGrades }
                                        setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                                      }}
                                      className={cn("h-8 text-sm", theme === 'dark' ? 'bg-zinc-500 border-zinc-400 text-white' : '')}
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : '')}>Nivel</Label>
                                    <Select 
                                      value={grade.level.toString()} 
                                      onValueChange={(value) => {
                                        const updatedCampuses = [...editInstitution.campuses]
                                        const updatedGrades = [...(updatedCampuses[campusIndex].grades || [])]
                                        updatedGrades[gradeIndex] = { ...updatedGrades[gradeIndex], level: parseInt(value) }
                                        updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], grades: updatedGrades }
                                        setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                                      }}
                                    >
                                      <SelectTrigger className={cn("h-8 text-sm", theme === 'dark' ? 'bg-zinc-500 border-zinc-400 text-white' : '')}>
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
                                <div className="flex items-center space-x-2 mt-2">
                                  <input
                                    type="checkbox"
                                    checked={grade.isActive}
                                    onChange={(e) => {
                                      const updatedCampuses = [...editInstitution.campuses]
                                      const updatedGrades = [...(updatedCampuses[campusIndex].grades || [])]
                                      updatedGrades[gradeIndex] = { ...updatedGrades[gradeIndex], isActive: e.target.checked }
                                      updatedCampuses[campusIndex] = { ...updatedCampuses[campusIndex], grades: updatedGrades }
                                      setEditInstitution(prev => ({ ...prev, campuses: updatedCampuses }))
                                    }}
                                    className="rounded"
                                  />
                                  <Label className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : '')}>Grado activo</Label>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={cn("text-sm text-center py-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            No hay grados en esta sede
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={cn("text-sm text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay sedes registradas. Puedes agregar sedes desde el botón "Nueva Sede".
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditInstitutionDialogOpen(false)} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateInstitution} className="bg-black text-white hover:bg-gray-800">
              Actualizar Institución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar sede */}
      <Dialog open={isEditCampusDialogOpen} onOpenChange={setIsEditCampusDialogOpen}>
        <DialogContent className={cn("sm:max-w-[500px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Editar Sede</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Modifica la información de {selectedCampus?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editCampusName" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre de la sede *</Label>
              <Input
                id="editCampusName"
                value={editCampus.name}
                onChange={(e) => setEditCampus(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Sede Principal"
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editCampusAddress" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Dirección *</Label>
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
                <Label htmlFor="editCampusPhone" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Teléfono</Label>
                <Input
                  id="editCampusPhone"
                  value={editCampus.phone}
                  onChange={(e) => setEditCampus(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+57 1 234-5678"
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editCampusEmail" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Email</Label>
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
              <Label htmlFor="editCampusPrincipal" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Director</Label>
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
              <Label htmlFor="editCampusActive" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Sede activa</Label>
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
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Editar Grado</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Modifica la información del grado {selectedGrade?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editGradeName" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nombre del grado *</Label>
              <Input
                id="editGradeName"
                value={editGrade.name}
                onChange={(e) => setEditGrade(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: 6°, 7°, 8°..."
                className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editGradeLevel" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nivel del grado</Label>
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
              <Label htmlFor="editGradeActive" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado activo</Label>
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
