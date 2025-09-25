import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  FileText, 
  Edit,
  Trash2,
  Eye,
  Copy,
  BookOpen,
  Calculator,
  Globe,
  Users,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'

interface Question {
  id: string
  text: string
  subject: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  options: string[]
  correctAnswer: number
  explanation?: string
  image?: string
}

interface Form {
  id: string
  title: string
  description: string
  subject: string
  grade: string
  questions: Question[]
  timeLimit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  attempts: number
  averageScore: number
}

interface FormManagementProps {
  theme: 'light' | 'dark'
}

export default function FormManagement({ theme }: FormManagementProps) {
  const { notifySuccess, notifyError } = useNotification()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [isCreateFormDialogOpen, setIsCreateFormDialogOpen] = useState(false)
  const [isCreateQuestionDialogOpen, setIsCreateQuestionDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('forms')

  const [newForm, setNewForm] = useState({
    title: '',
    description: '',
    subject: '',
    grade: '',
    timeLimit: 60
  })

  const [newQuestion, setNewQuestion] = useState({
    text: '',
    subject: '',
    topic: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: ''
  })

  // Datos de ejemplo
  const [forms, setForms] = useState<Form[]>([
    {
      id: '1',
      title: 'Examen de Matemáticas - Geometría',
      description: 'Evaluación de conceptos básicos de geometría para grado 10',
      subject: 'Matemáticas',
      grade: '10°',
      questions: [],
      timeLimit: 90,
      isActive: true,
      createdAt: '2024-01-15',
      updatedAt: '2024-01-20',
      attempts: 156,
      averageScore: 78.5
    },
    {
      id: '2',
      title: 'Prueba de Lenguaje - Comprensión Lectora',
      description: 'Evaluación de habilidades de comprensión lectora',
      subject: 'Lenguaje',
      grade: '11°',
      questions: [],
      timeLimit: 60,
      isActive: true,
      createdAt: '2024-01-10',
      updatedAt: '2024-01-18',
      attempts: 234,
      averageScore: 82.3
    },
    {
      id: '3',
      title: 'Examen de Ciencias Naturales',
      description: 'Evaluación de conceptos de biología y química',
      subject: 'Ciencias Naturales',
      grade: '10°',
      questions: [],
      timeLimit: 75,
      isActive: false,
      createdAt: '2024-01-08',
      updatedAt: '2024-01-15',
      attempts: 89,
      averageScore: 75.8
    }
  ])

  const subjects = [
    'Matemáticas',
    'Lenguaje',
    'Ciencias Naturales',
    'Ciencias Sociales',
    'Inglés'
  ]

  const grades = ['6°', '7°', '8°', '9°', '10°', '11°']

  const topics = {
    'Matemáticas': ['Álgebra', 'Geometría', 'Trigonometría', 'Cálculo', 'Estadística'],
    'Lenguaje': ['Comprensión Lectora', 'Gramática', 'Literatura', 'Escritura', 'Ortografía'],
    'Ciencias Naturales': ['Biología', 'Química', 'Física', 'Ecología', 'Anatomía'],
    'Ciencias Sociales': ['Historia', 'Geografía', 'Economía', 'Política', 'Sociología'],
    'Inglés': ['Gramática', 'Vocabulario', 'Comprensión', 'Conversación', 'Escritura']
  }

  const handleCreateForm = async () => {
    if (!newForm.title || !newForm.subject || !newForm.grade) {
      notifyError({ title: 'Error', message: 'Todos los campos son obligatorios' })
      return
    }

    try {
      const createdForm: Form = {
        id: Date.now().toString(),
        title: newForm.title,
        description: newForm.description,
        subject: newForm.subject,
        grade: newForm.grade,
        questions: [],
        timeLimit: newForm.timeLimit,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        attempts: 0,
        averageScore: 0
      }

      setForms(prev => [...prev, createdForm])
      setIsCreateFormDialogOpen(false)
      setNewForm({
        title: '',
        description: '',
        subject: '',
        grade: '',
        timeLimit: 60
      })
      notifySuccess({ title: 'Éxito', message: 'Formulario creado correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al crear el formulario' })
    }
  }

  const handleCreateQuestion = async () => {
    if (!newQuestion.text || !newQuestion.subject || newQuestion.options.some(opt => !opt.trim())) {
      notifyError({ title: 'Error', message: 'Todos los campos son obligatorios' })
      return
    }

    try {
      // Aquí se crearía la pregunta en la base de datos
      console.log('Creating question:', newQuestion)

      // Aquí se agregaría la pregunta al formulario seleccionado
      setIsCreateQuestionDialogOpen(false)
      setNewQuestion({
        text: '',
        subject: '',
        topic: '',
        difficulty: 'medium',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: ''
      })
      notifySuccess({ title: 'Éxito', message: 'Pregunta creada correctamente' })
    } catch (error) {
      notifyError({ title: 'Error', message: 'Error al crear la pregunta' })
    }
  }

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSubject = selectedSubject === 'all' || form.subject === selectedSubject
    const matchesGrade = selectedGrade === 'all' || form.grade === selectedGrade
    
    return matchesSearch && matchesSubject && matchesGrade
  })

  const getSubjectIcon = (subject: string) => {
    switch (subject) {
      case 'Matemáticas':
        return <Calculator className="h-4 w-4" />
      case 'Lenguaje':
        return <BookOpen className="h-4 w-4" />
      case 'Ciencias Naturales':
        return <Brain className="h-4 w-4" />
      case 'Ciencias Sociales':
        return <Globe className="h-4 w-4" />
      case 'Inglés':
        return <Users className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Gestión de Formularios
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Crea y administra formularios de evaluación
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isCreateQuestionDialogOpen} onOpenChange={setIsCreateQuestionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Pregunta
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={isCreateFormDialogOpen} onOpenChange={setIsCreateFormDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Formulario
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="forms">Formularios</TabsTrigger>
          <TabsTrigger value="questions">Preguntas</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-4">
          {/* Filtros y búsqueda */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar formularios..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrar por materia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las materias</SelectItem>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrar por grado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grados</SelectItem>
                    {grades.map(grade => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de formularios */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Formularios ({filteredForms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredForms.map((form) => (
                  <div key={form.id} className={cn('p-4 rounded-lg border', theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getSubjectIcon(form.subject)}
                          <h3 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {form.title}
                          </h3>
                        </div>
                        <p className={cn('text-sm mb-3', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {form.description}
                        </p>
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline" className="flex items-center space-x-1">
                            {getSubjectIcon(form.subject)}
                            <span>{form.subject}</span>
                          </Badge>
                          <Badge variant="outline">
                            {form.grade}
                          </Badge>
                          <Badge variant="outline">
                            {form.timeLimit} min
                          </Badge>
                          <Badge variant={form.isActive ? 'default' : 'secondary'}>
                            {form.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span>{form.questions.length} preguntas</span>
                          <span>{form.attempts} intentos</span>
                          <span>Promedio: {form.averageScore}%</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Banco de Preguntas
              </CardTitle>
              <CardDescription>
                Administra el banco de preguntas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Banco de Preguntas
                </h3>
                <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Gestiona todas las preguntas del sistema
                </p>
                <Button onClick={() => setIsCreateQuestionDialogOpen(true)} className="bg-black text-white hover:bg-gray-800">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Pregunta
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para crear formulario */}
      <Dialog open={isCreateFormDialogOpen} onOpenChange={setIsCreateFormDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Formulario</DialogTitle>
            <DialogDescription>
              Crea un nuevo formulario de evaluación para estudiantes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="formTitle">Título del formulario</Label>
              <Input
                id="formTitle"
                value={newForm.title}
                onChange={(e) => setNewForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Examen de Matemáticas - Geometría"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="formDescription">Descripción</Label>
              <Textarea
                id="formDescription"
                value={newForm.description}
                onChange={(e) => setNewForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe el contenido del formulario"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="formSubject">Materia</Label>
                <Select value={newForm.subject} onValueChange={(value) => setNewForm(prev => ({ ...prev, subject: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="formGrade">Grado</Label>
                <Select value={newForm.grade} onValueChange={(value) => setNewForm(prev => ({ ...prev, grade: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map(grade => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeLimit">Tiempo límite (minutos)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={newForm.timeLimit}
                onChange={(e) => setNewForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 60 }))}
                placeholder="60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFormDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateForm} className="bg-black text-white hover:bg-gray-800">
              Crear Formulario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear pregunta */}
      <Dialog open={isCreateQuestionDialogOpen} onOpenChange={setIsCreateQuestionDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Pregunta</DialogTitle>
            <DialogDescription>
              Agrega una nueva pregunta al banco de preguntas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="questionText">Texto de la pregunta</Label>
              <Textarea
                id="questionText"
                value={newQuestion.text}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Escribe la pregunta aquí..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="questionSubject">Materia</Label>
                <Select value={newQuestion.subject} onValueChange={(value) => setNewQuestion(prev => ({ ...prev, subject: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="questionTopic">Tema</Label>
                <Select 
                  value={newQuestion.topic} 
                  onValueChange={(value) => setNewQuestion(prev => ({ ...prev, topic: value }))}
                  disabled={!newQuestion.subject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {newQuestion.subject && topics[newQuestion.subject as keyof typeof topics]?.map(topic => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="questionDifficulty">Dificultad</Label>
              <Select value={newQuestion.difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setNewQuestion(prev => ({ ...prev, difficulty: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar dificultad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Fácil</SelectItem>
                  <SelectItem value="medium">Medio</SelectItem>
                  <SelectItem value="hard">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Opciones de respuesta</Label>
              {newQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="w-6 text-sm font-medium">{String.fromCharCode(65 + index)})</span>
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...newQuestion.options]
                      newOptions[index] = e.target.value
                      setNewQuestion(prev => ({ ...prev, options: newOptions }))
                    }}
                    placeholder={`Opción ${String.fromCharCode(65 + index)}`}
                  />
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={newQuestion.correctAnswer === index}
                    onChange={() => setNewQuestion(prev => ({ ...prev, correctAnswer: index }))}
                    className="w-4 h-4"
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="questionExplanation">Explicación (opcional)</Label>
              <Textarea
                id="questionExplanation"
                value={newQuestion.explanation}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                placeholder="Explicación de la respuesta correcta..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateQuestionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateQuestion} className="bg-black text-white hover:bg-gray-800">
              Crear Pregunta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
