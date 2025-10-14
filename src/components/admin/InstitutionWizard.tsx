import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Minus,
  Building, 
  MapPin,
  GraduationCap,
  Check,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { Institution, Campus } from '@/interfaces/db.interface'
import { useInstitutionMutations } from '@/hooks/query/useInstitutionQuery'
import ImageUpload from '@/components/common/fields/ImageUpload'

interface InstitutionWizardProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark'
}

interface WizardData {
  institution: {
    name: string
    type: 'public' | 'private'
    nit: string
    address: string
    phone: string
    email: string
    website: string
    coordinator: string
    logo: string
  }
  campuses: Array<{
    name: string
    address: string
    phone: string
    email: string
    principal: string
  }>
  grades: Array<{
    campusIndex: number
    name: string
    level: number
  }>
}

export default function InstitutionWizard({ isOpen, onClose }: InstitutionWizardProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { createInstitution, createCampus, createGrade } = useInstitutionMutations()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [createdInstitution, setCreatedInstitution] = useState<Institution | null>(null)
  
  const [wizardData, setWizardData] = useState<WizardData>({
    institution: {
      name: '',
      type: 'public',
      nit: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      coordinator: '',
      logo: ''
    },
    campuses: [
      {
        name: '',
        address: '',
        phone: '',
        email: '',
        principal: ''
      }
    ],
    grades: []
  })

  const institutionTypes = [
    { value: 'public', label: 'Pública' },
    { value: 'private', label: 'Privada' }
  ]

  const gradeLevels = [6, 7, 8, 9, 10, 11]

  const steps = [
    { number: 1, title: 'Institución', icon: Building, description: 'Datos básicos de la institución' },
    { number: 2, title: 'Sedes', icon: MapPin, description: 'Configurar sedes de la institución' },
    { number: 3, title: 'Grados', icon: GraduationCap, description: 'Definir grados por sede' },
    { number: 4, title: 'Resumen', icon: Check, description: 'Revisar y confirmar' }
  ]

  const resetWizard = () => {
    setCurrentStep(1)
    setIsLoading(false)
    setCreatedInstitution(null)
    setWizardData({
      institution: {
        name: '',
        type: 'public',
        nit: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        coordinator: '',
        logo: ''
      },
      campuses: [
        {
          name: '',
          address: '',
          phone: '',
          email: '',
          principal: ''
        }
      ],
      grades: []
    })
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const addCampus = () => {
    setWizardData(prev => ({
      ...prev,
      campuses: [
        ...prev.campuses,
        {
          name: '',
          address: '',
          phone: '',
          email: '',
          principal: ''
        }
      ]
    }))
  }

  const removeCampus = (index: number) => {
    if (wizardData.campuses.length > 1) {
      setWizardData(prev => ({
        ...prev,
        campuses: prev.campuses.filter((_, i) => i !== index),
        grades: prev.grades.filter(grade => grade.campusIndex !== index)
      }))
    }
  }

  const updateCampus = (index: number, field: string, value: string) => {
    setWizardData(prev => ({
      ...prev,
      campuses: prev.campuses.map((campus, i) => 
        i === index ? { ...campus, [field]: value } : campus
      )
    }))
  }

  const addGrade = (campusIndex: number) => {
    setWizardData(prev => ({
      ...prev,
      grades: [
        ...prev.grades,
        {
          campusIndex,
          name: '',
          level: 6
        }
      ]
    }))
  }

  const removeGrade = (gradeIndex: number) => {
    setWizardData(prev => ({
      ...prev,
      grades: prev.grades.filter((_, i) => i !== gradeIndex)
    }))
  }

  const updateGrade = (gradeIndex: number, field: string, value: string | number) => {
    setWizardData(prev => ({
      ...prev,
      grades: prev.grades.map((grade, i) => 
        i === gradeIndex ? { ...grade, [field]: value } : grade
      )
    }))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!wizardData.institution.name || !wizardData.institution.address) {
          notifyError({ title: 'Error', message: 'Nombre y dirección de la institución son obligatorios' })
          return false
        }
        return true
      case 2:
        for (let i = 0; i < wizardData.campuses.length; i++) {
          const campus = wizardData.campuses[i]
          if (!campus.name || !campus.address) {
            notifyError({ title: 'Error', message: `Sede ${i + 1}: Nombre y dirección son obligatorios` })
            return false
          }
        }
        return true
      case 3:
        // Los grados son opcionales, no hay validación estricta
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleComplete = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      return
    }

    setIsLoading(true)
    try {
      // Paso 1: Crear institución
      const institutionResult = await createInstitution.mutateAsync(wizardData.institution)
      if (!institutionResult.success) {
        throw new Error(institutionResult.error?.message || 'Error al crear institución')
      }
      
      const institution = institutionResult.data
      setCreatedInstitution(institution)

      // Paso 2: Crear sedes
      const createdCampuses: Campus[] = []
      for (const campusData of wizardData.campuses) {
        const campusResult = await createCampus.mutateAsync({
          institutionId: institution.id,
          ...campusData
        })
        if (campusResult.success) {
          createdCampuses.push(campusResult.data)
        }
      }

      // Paso 3: Crear grados
      for (const gradeData of wizardData.grades) {
        if (gradeData.name && createdCampuses[gradeData.campusIndex]) {
          await createGrade.mutateAsync({
            institutionId: institution.id,
            campusId: createdCampuses[gradeData.campusIndex].id,
            name: gradeData.name,
            level: gradeData.level
          })
        }
      }

      notifySuccess({ 
        title: '¡Éxito!', 
        message: `Institución "${institution.name}" creada exitosamente con ${createdCampuses.length} sede(s) y ${wizardData.grades.length} grado(s).` 
      })
      
      // Cerrar wizard después de un breve delay
      setTimeout(() => {
        handleClose()
      }, 2000)

    } catch (error) {
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al completar el proceso' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="institutionName">Nombre de la institución *</Label>
              <Input
                id="institutionName"
                value={wizardData.institution.name}
                onChange={(e) => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, name: e.target.value }
                }))}
                placeholder="Ej: Colegio San José"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="institutionType">Tipo de institución *</Label>
              <Select 
                value={wizardData.institution.type} 
                onValueChange={(value: 'public' | 'private') => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, type: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {institutionTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="institutionNit">NIT (opcional)</Label>
              <Input
                id="institutionNit"
                value={wizardData.institution.nit}
                onChange={(e) => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, nit: e.target.value }
                }))}
                placeholder="900123456-1"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="institutionAddress">Dirección *</Label>
              <Textarea
                id="institutionAddress"
                value={wizardData.institution.address}
                onChange={(e) => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, address: e.target.value }
                }))}
                placeholder="Dirección completa de la institución"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="institutionPhone">Teléfono</Label>
                <Input
                  id="institutionPhone"
                  value={wizardData.institution.phone}
                  onChange={(e) => setWizardData(prev => ({
                    ...prev,
                    institution: { ...prev.institution, phone: e.target.value }
                  }))}
                  placeholder="+57 1 234-5678"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="institutionEmail">Email</Label>
                <Input
                  id="institutionEmail"
                  type="email"
                  value={wizardData.institution.email}
                  onChange={(e) => setWizardData(prev => ({
                    ...prev,
                    institution: { ...prev.institution, email: e.target.value }
                  }))}
                  placeholder="info@institucion.edu.co"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="institutionWebsite">Sitio web</Label>
              <Input
                id="institutionWebsite"
                value={wizardData.institution.website}
                onChange={(e) => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, website: e.target.value }
                }))}
                placeholder="www.institucion.edu.co"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="institutionLogo">Logo de la institución</Label>
              <ImageUpload
                value={wizardData.institution.logo}
                onChange={(logo) => setWizardData(prev => ({
                  ...prev,
                  institution: { ...prev.institution, logo }
                }))}
                placeholder="Subir logo de la institución"
                theme="light"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Configurar Sedes</h3>
              <Button onClick={addCampus} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Sede
              </Button>
            </div>

            {wizardData.campuses.map((campus, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Sede {index + 1}</h4>
                  {wizardData.campuses.length > 1 && (
                    <Button 
                      onClick={() => removeCampus(index)} 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`campusName-${index}`}>Nombre de la sede *</Label>
                    <Input
                      id={`campusName-${index}`}
                      value={campus.name}
                      onChange={(e) => updateCampus(index, 'name', e.target.value)}
                      placeholder="Ej: Sede Principal"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`campusAddress-${index}`}>Dirección *</Label>
                    <Textarea
                      id={`campusAddress-${index}`}
                      value={campus.address}
                      onChange={(e) => updateCampus(index, 'address', e.target.value)}
                      placeholder="Dirección completa de la sede"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`campusPhone-${index}`}>Teléfono</Label>
                      <Input
                        id={`campusPhone-${index}`}
                        value={campus.phone}
                        onChange={(e) => updateCampus(index, 'phone', e.target.value)}
                        placeholder="+57 1 234-5678"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`campusEmail-${index}`}>Email</Label>
                      <Input
                        id={`campusEmail-${index}`}
                        type="email"
                        value={campus.email}
                        onChange={(e) => updateCampus(index, 'email', e.target.value)}
                        placeholder="sede@institucion.edu.co"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Configurar Grados</h3>
              <p className="text-sm text-gray-600">Los grados son opcionales y se pueden agregar después</p>
            </div>

            {wizardData.campuses.map((campus, campusIndex) => (
              <Card key={campusIndex} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{campus.name || `Sede ${campusIndex + 1}`}</h4>
                  <Button 
                    onClick={() => addGrade(campusIndex)} 
                    size="sm" 
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Grado
                  </Button>
                </div>

                {wizardData.grades
                  .filter(grade => grade.campusIndex === campusIndex)
                  .map((grade) => {
                    const globalGradeIndex = wizardData.grades.findIndex(g => g === grade)
                    return (
                      <div key={globalGradeIndex} className="flex items-center gap-4 mb-2 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="grid gap-1">
                            <Label htmlFor={`gradeName-${globalGradeIndex}`}>Nombre del grado</Label>
                            <Input
                              id={`gradeName-${globalGradeIndex}`}
                              value={grade.name}
                              onChange={(e) => updateGrade(globalGradeIndex, 'name', e.target.value)}
                              placeholder="Ej: 6°, 7°, 8°..."
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label htmlFor={`gradeLevel-${globalGradeIndex}`}>Nivel</Label>
                            <Select 
                              value={grade.level.toString()} 
                              onValueChange={(value) => updateGrade(globalGradeIndex, 'level', parseInt(value))}
                            >
                              <SelectTrigger>
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
                        <Button 
                          onClick={() => removeGrade(globalGradeIndex)} 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}

                {wizardData.grades.filter(grade => grade.campusIndex === campusIndex).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay grados configurados para esta sede</p>
                    <p className="text-xs">Puedes agregarlos ahora o después</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-semibold mb-2">Resumen de la Institución</h3>
              <p className="text-sm text-gray-600">Revisa los datos antes de crear la institución</p>
            </div>

            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Institución
              </h4>
              <div className="grid gap-2 text-sm">
                <div><strong>Nombre:</strong> {wizardData.institution.name}</div>
                <div><strong>Tipo:</strong> {institutionTypes.find(t => t.value === wizardData.institution.type)?.label}</div>
                {wizardData.institution.nit && <div><strong>NIT:</strong> {wizardData.institution.nit}</div>}
                <div><strong>Dirección:</strong> {wizardData.institution.address}</div>
                {wizardData.institution.phone && <div><strong>Teléfono:</strong> {wizardData.institution.phone}</div>}
                {wizardData.institution.email && <div><strong>Email:</strong> {wizardData.institution.email}</div>}
                {wizardData.institution.website && <div><strong>Sitio web:</strong> {wizardData.institution.website}</div>}
                {wizardData.institution.coordinator && <div><strong>Coordinador:</strong> {wizardData.institution.coordinator}</div>}
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Sedes ({wizardData.campuses.length})
              </h4>
              <div className="space-y-3">
                {wizardData.campuses.map((campus, index) => (
                  <div key={index} className="border-l-2 border-blue-200 pl-3">
                    <div className="font-medium">{campus.name}</div>
                    <div className="text-sm text-gray-600">{campus.address}</div>
                    {campus.principal && <div className="text-sm text-gray-600">Coordinador: {campus.principal}</div>}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Grados ({wizardData.grades.length})
              </h4>
              {wizardData.grades.length > 0 ? (
                <div className="space-y-2">
                  {wizardData.grades.map((grade, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline">
                        {wizardData.campuses[grade.campusIndex]?.name || `Sede ${grade.campusIndex + 1}`}
                      </Badge>
                      <span className="text-sm">{grade.name} ({grade.level}°)</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No se configuraron grados</p>
              )}
            </Card>

            {createdInstitution && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">¡Institución creada exitosamente!</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  La institución "{createdInstitution.name}" ha sido registrada en el sistema.
                </p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proceso Completo de Inscripción</DialogTitle>
          <DialogDescription>
            Crea una institución completa con sus sedes y grados en un solo proceso
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.number
            const isCompleted = currentStep > step.number
            
            return (
              <div key={step.number} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  isActive && "border-blue-600 bg-blue-600 text-white",
                  isCompleted && "border-green-600 bg-green-600 text-white",
                  !isActive && !isCompleted && "border-gray-300 text-gray-400"
                )}>
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="ml-3 hidden sm:block">
                  <div className={cn(
                    "text-sm font-medium",
                    isActive && "text-blue-600",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-gray-400"
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-4",
                    isCompleted ? "bg-green-600" : "bg-gray-300"
                  )} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <DialogFooter className="flex justify-between">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={prevStep} disabled={isLoading}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            
            {currentStep < 4 ? (
              <Button onClick={nextStep} disabled={isLoading}>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Completar Proceso
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
