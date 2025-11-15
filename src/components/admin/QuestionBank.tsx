import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  Plus, 
  Search, 
  FileText, 
  Edit,
  Trash2,
  Eye,
  Image as ImageIcon,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  BarChart3,
  Filter,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  List,
  FolderTree,
  FolderOpen,
  GraduationCap,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
// import { useAutoResizeTextarea } from '@/hooks/ui/useAutoResizeTextarea'
import RichTextEditor, { RichTextEditorRef } from '@/components/common/RichTextEditor'
import { questionService, Question, QuestionOption } from '@/services/firebase/question.service'
import ImageGallery from '@/components/common/ImageGallery'
import { 
  SUBJECTS_CONFIG, 
  DIFFICULTY_LEVELS, 
  GRADE_CODE_TO_NAME,
  getSubjectByCode
} from '@/utils/subjects.config'
import { useAuthContext } from '@/context/AuthContext'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface QuestionBankProps {
  theme: 'light' | 'dark'
}

// Función helper para extraer solo el texto sin tags HTML
const stripHtmlTags = (html: string): string => {
  if (!html) return ''
  // Crear un elemento temporal para extraer el texto
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  return tempDiv.textContent || tempDiv.innerText || ''
}

// Función para sanitizar HTML de forma segura
const sanitizeHtml = (html: string) => {
  if (!html) return ''
  return DOMPurify.sanitize(html, { 
    USE_PROFILES: { html: true },
    // Permitir elementos y atributos de KaTeX, incluyendo SVG
    ADD_TAGS: [
      'math', 'annotation', 'semantics', 'mtext', 'mn', 'mo', 'mi', 'mspace', 'mover', 'munder', 'munderover',
      'msup', 'msub', 'msubsup', 'mfrac', 'mroot', 'msqrt', 'mtable', 'mtr', 'mtd', 'mlabeledtr', 'mrow',
      'menclose', 'mstyle', 'mpadded', 'mphantom', 'mfenced', 'maction', 'mmultiscripts',
      'svg', 'path', 'g', 'line', 'rect', 'circle', 'use'
    ],
    ADD_ATTR: [
      'data-latex', 'class', 'style', 'aria-label', 'role', 'tabindex',
      'xmlns', 'width', 'height', 'viewBox', 'focusable', 'aria-hidden', 'stroke', 'fill', 'stroke-width',
      'x', 'y', 'x1', 'x2', 'y1', 'y2', 'd', 'transform'
    ]
  })
}

// Función para renderizar fórmulas matemáticas en el HTML
const renderMathInHtml = (html: string): string => {
  if (!html) return ''
  
  // Crear un elemento temporal para procesar el HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Conversión defensiva: detectar \sqrt{...} o √x en texto plano fuera de fórmulas
  try {
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null)
    const targets: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = (node as Text).textContent || ''
        if ((t.includes('\\sqrt') || t.includes('√')) && !(node.parentElement?.closest('[data-latex], .katex'))) {
          targets.push(node as Text)
        }
      }
    }
    targets.forEach(textNode => {
      const text = textNode.textContent || ''
      // Reemplazar \sqrt{expr}
      let replaced = text.replace(/\\sqrt\s*\{([^}]+)\}/g, (_m, inner) => {
        const safe = String(inner)
        return `<span class="katex-formula" data-latex="\\sqrt{${safe}}"></span>`
      })
      // Reemplazar \sqrt x (un solo token)
      replaced = replaced.replace(/\\sqrt\s*([A-Za-z0-9_]+)/g, (_m, tok) => {
        const safe = String(tok)
        return `<span class="katex-formula" data-latex="\\sqrt{${safe}}"></span>`
      })
      // Reemplazar √x
      replaced = replaced.replace(/√\s*([A-Za-z0-9_]+)/g, (_m, tok) => {
        const safe = String(tok)
        return `<span class="katex-formula" data-latex="\\sqrt{${safe}}"></span>`
      })
      if (replaced !== text) {
        const wrapper = document.createElement('span')
        wrapper.innerHTML = replaced
        textNode.parentNode?.replaceChild(wrapper, textNode)
      }
    })
  } catch {}
  
  // Buscar todos los elementos con data-latex que necesitan renderizado
  const mathElements = tempDiv.querySelectorAll('[data-latex]')
  
  mathElements.forEach((el) => {
    const latex = el.getAttribute('data-latex')
    if (latex) {
      // Verificar si ya está renderizado
      const hasKaTeX = el.querySelector('.katex') !== null
      
      // Si no está renderizado, renderizarlo
      if (!hasKaTeX) {
        try {
          const isDisplay = el.classList.contains('katex-display') || el.tagName === 'DIV'
          const rendered = katex.renderToString(latex, {
            throwOnError: false,
            displayMode: isDisplay,
            strict: false,
          })
          
          if (rendered && rendered.trim() !== '' && rendered.includes('katex')) {
            el.innerHTML = rendered
            el.classList.add('katex-formula')
            if (isDisplay) {
              el.classList.add('katex-display')
            }
          }
        } catch (error) {
          console.error('Error renderizando fórmula:', error)
        }
      }
    }
  })
  
  return tempDiv.innerHTML
}

export default function QuestionBank({ theme }: QuestionBankProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { user: currentUser } = useAuthContext()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [relatedQuestions, setRelatedQuestions] = useState<Question[]>([]) // Para agrupar preguntas de comprensión de lectura
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)

  // Filtros
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [filterTopic, setFilterTopic] = useState<string>('all')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Vista de organización
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Estado del formulario
  const [formData, setFormData] = useState({
    subject: '',
    subjectCode: '',
    topic: '',
    topicCode: '',
    grade: '6' as '6' | '7' | '8' | '9' | '0' | '1',
    level: 'Fácil' as 'Fácil' | 'Medio' | 'Difícil',
    levelCode: 'F' as 'F' | 'M' | 'D',
    informativeText: '',
    questionText: '',
  })

  const [informativeImages, setInformativeImages] = useState<File[]>([])
  const [informativeImagePreviews, setInformativeImagePreviews] = useState<string[]>([])
  const [questionImages, setQuestionImages] = useState<File[]>([])
  const [questionImagePreviews, setQuestionImagePreviews] = useState<string[]>([])
  
  // Estados para edición de imágenes
  const [editInformativeImages, setEditInformativeImages] = useState<File[]>([])
  const [editQuestionImages, setEditQuestionImages] = useState<File[]>([])
  
  // Referencias para los editores de texto
  const informativeTextEditorRef = useRef<RichTextEditorRef>(null)
  const questionTextEditorRef = useRef<RichTextEditorRef>(null)
  const editInformativeTextEditorRef = useRef<RichTextEditorRef>(null)
  const editQuestionTextEditorRef = useRef<RichTextEditorRef>(null)
  
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: 'A', text: '', imageUrl: null, isCorrect: false },
    { id: 'B', text: '', imageUrl: null, isCorrect: false },
    { id: 'C', text: '', imageUrl: null, isCorrect: false },
    { id: 'D', text: '', imageUrl: null, isCorrect: false },
  ])

  const [optionFiles, setOptionFiles] = useState<{ [key: string]: File | null }>({
    A: null,
    B: null,
    C: null,
    D: null,
  })

  // Textareas reemplazados por editor enriquecido

  const [optionImagePreviews, setOptionImagePreviews] = useState<{ [key: string]: string | null }>({
    A: null,
    B: null,
    C: null,
    D: null,
  })

  // Estados para modalidades de Inglés
  const [inglesModality, setInglesModality] = useState<'standard_mc' | 'matching_columns' | 'cloze_test' | 'reading_comprehension'>('standard_mc')
  
  // Estados para Matching / Columnas (nueva estructura por bloques)
  const [matchingQuestions, setMatchingQuestions] = useState<Array<{
    id: string
    questionText: string // Texto de la pregunta
    options: QuestionOption[] // Opciones de respuesta (A-H, máximo 6 opciones)
  }>>([])
  const [expandedViewOptions, setExpandedViewOptions] = useState<Set<string>>(new Set()) // Controlar qué preguntas tienen opciones expandidas en visualización
  const [selectedMatchingAnswers, setSelectedMatchingAnswers] = useState<{ [key: string]: string }>({}) // Rastrear respuestas seleccionadas: questionId -> optionId
  const matchingDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({}) // Refs para detectar clics fuera
  const [selectedClozeAnswers, setSelectedClozeAnswers] = useState<{ [key: number]: string }>({}) // Rastrear respuestas seleccionadas por hueco
  
  // Estados para Cloze Test
  const [clozeText, setClozeText] = useState<string>('') // Texto con marcadores [1], [2], etc.
  const [clozeGaps, setClozeGaps] = useState<{ [key: number]: { options: string[], correctAnswer: string } }>({}) // Opciones por hueco (3 opciones: A, B, C)
  
  // Estados para edición de Cloze Test
  const [isEditingClozeTest, setIsEditingClozeTest] = useState(false) // Indica si estamos editando un cloze test
  const [editClozeText, setEditClozeText] = useState<string>('') // Texto con marcadores para edición
  const [editClozeGaps, setEditClozeGaps] = useState<{ [key: number]: { options: string[], correctAnswer: string } }>({}) // Opciones por hueco para edición
  const [editClozeRelatedQuestions, setEditClozeRelatedQuestions] = useState<Question[]>([]) // Preguntas relacionadas del cloze test
  
  // Estados para Comprensión de Lectura
  const [readingText, setReadingText] = useState<string>('')
  const [readingImage, setReadingImage] = useState<File | null>(null)
  const [readingImagePreview, setReadingImagePreview] = useState<string | null>(null)
  const [readingQuestions, setReadingQuestions] = useState<Array<{
    id: string
    questionText: string
    questionImage: File | null
    questionImagePreview: string | null
    options: QuestionOption[]
  }>>([])

  // Estados para rastrear errores de validación
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: boolean }>({})

  // Debug: Verificar estado de autenticación
  useEffect(() => {
    console.log('🔍 Estado de autenticación en QuestionBank:', {
      currentUser,
      hasUser: !!currentUser,
      userRole: currentUser?.role,
      userEmail: currentUser?.email
    })
  }, [currentUser])

  // Cargar preguntas al montar
  useEffect(() => {
    loadQuestions()
    loadStats()
  }, [])

  // Aplicar filtros
  useEffect(() => {
    applyFilters()
  }, [questions, filterSubject, filterTopic, filterGrade, filterLevel, searchTerm])

  // Cerrar dropdowns de matching al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(matchingDropdownRefs.current).forEach((questionKey) => {
        const ref = matchingDropdownRefs.current[questionKey]
        if (ref && !ref.contains(event.target as Node)) {
          if (expandedViewOptions.has(questionKey)) {
            setExpandedViewOptions(prev => {
              const newSet = new Set(prev)
              newSet.delete(questionKey)
              return newSet
            })
          }
        }
      })
    }

    if (expandedViewOptions.size > 0) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [expandedViewOptions])

  const loadQuestions = async () => {
    setIsLoading(true)
    try {
      const result = await questionService.getFilteredQuestions({})
      if (result.success) {
        setQuestions(result.data)
      } else {
        notifyError({ 
          title: 'Error', 
          message: 'No se pudieron cargar las preguntas' 
        })
      }
    } catch (error) {
      console.error('Error cargando preguntas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await questionService.getQuestionStats()
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const applyFilters = () => {
    let filtered = [...questions]

    // Filtro por materia
    if (filterSubject !== 'all') {
      filtered = filtered.filter(q => q.subjectCode === filterSubject)
    }

    // Filtro por tema
    if (filterTopic !== 'all') {
      filtered = filtered.filter(q => q.topicCode === filterTopic)
    }

    // Filtro por grado
    if (filterGrade !== 'all') {
      filtered = filtered.filter(q => q.grade === filterGrade)
    }

    // Filtro por nivel
    if (filterLevel !== 'all') {
      filtered = filtered.filter(q => q.levelCode === filterLevel)
    }

    // Filtro por búsqueda de texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(q => 
        q.questionText.toLowerCase().includes(term) ||
        q.code.toLowerCase().includes(term) ||
        q.subject.toLowerCase().includes(term) ||
        q.topic.toLowerCase().includes(term)
      )
    }

    setFilteredQuestions(filtered)
  }

  const handleSubjectChange = (subjectCode: string) => {
    const subject = getSubjectByCode(subjectCode)
    if (subject) {
      // Si cambia a una materia que no es Inglés, resetear modalidad
      if (subjectCode !== 'IN') {
        setInglesModality('standard_mc')
        // Limpiar datos de modalidades específicas
        setMatchingQuestions([])
        setClozeText('')
        setClozeGaps({})
        setReadingText('')
        setReadingImage(null)
        setReadingImagePreview(null)
        setReadingQuestions([])
      }
      setFormData({
        ...formData,
        subject: subject.name,
        subjectCode: subject.code,
        topic: '',
        topicCode: '',
      })
    }
  }

  const handleTopicChange = (topicCode: string) => {
    const subject = getSubjectByCode(formData.subjectCode)
    const topic = subject?.topics.find(t => t.code === topicCode)
    if (topic) {
      setFormData({
        ...formData,
        topic: topic.name,
        topicCode: topic.code,
      })
    }
  }

  const handleLevelChange = (level: 'Fácil' | 'Medio' | 'Difícil') => {
    const levelObj = DIFFICULTY_LEVELS.find(l => l.name === level)
    if (levelObj) {
      setFormData({
        ...formData,
        level,
        levelCode: levelObj.code,
      })
    }
  }

  const handleInformativeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + informativeImages.length > 5) {
      notifyError({ 
        title: 'Error', 
        message: 'Máximo 5 imágenes informativas' 
      })
      return
    }

    setInformativeImages([...informativeImages, ...files])
    
    // Crear previsualizaciones
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setInformativeImagePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeInformativeImage = (index: number) => {
    setInformativeImages(informativeImages.filter((_, i) => i !== index))
    setInformativeImagePreviews(informativeImagePreviews.filter((_, i) => i !== index))
  }

  const handleQuestionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + questionImages.length > 3) {
      notifyError({ 
        title: 'Error', 
        message: 'Máximo 3 imágenes por pregunta' 
      })
      return
    }

    setQuestionImages([...questionImages, ...files])
    
    // Crear previsualizaciones
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setQuestionImagePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeQuestionImage = (index: number) => {
    setQuestionImages(questionImages.filter((_, i) => i !== index))
    setQuestionImagePreviews(questionImagePreviews.filter((_, i) => i !== index))
  }

  // Funciones para edición de imágenes informativas
  const handleEditInformativeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + editInformativeImages.length > 5) {
      notifyError({ 
        title: 'Error', 
        message: 'Máximo 5 imágenes informativas' 
      })
      return
    }

    setEditInformativeImages([...editInformativeImages, ...files])
    
    // Crear previsualizaciones
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setInformativeImagePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeEditInformativeImage = (index: number) => {
    setEditInformativeImages(editInformativeImages.filter((_, i) => i !== index))
    setInformativeImagePreviews(informativeImagePreviews.filter((_, i) => i !== index))
  }

  // Funciones para edición de imágenes de pregunta
  const handleEditQuestionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + editQuestionImages.length > 3) {
      notifyError({ 
        title: 'Error', 
        message: 'Máximo 3 imágenes por pregunta' 
      })
      return
    }

    setEditQuestionImages([...editQuestionImages, ...files])
    
    // Crear previsualizaciones
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setQuestionImagePreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeEditQuestionImage = (index: number) => {
    setEditQuestionImages(editQuestionImages.filter((_, i) => i !== index))
    setQuestionImagePreviews(questionImagePreviews.filter((_, i) => i !== index))
  }

  const handleOptionImageUpload = (optionId: string, file: File) => {
    setOptionFiles({ ...optionFiles, [optionId]: file })
    
    // Crear previsualización
    const reader = new FileReader()
    reader.onloadend = () => {
      setOptionImagePreviews({
        ...optionImagePreviews,
        [optionId]: reader.result as string
      })
    }
    reader.readAsDataURL(file)
  }

  const removeOptionImage = (optionId: string) => {
    setOptionFiles({ ...optionFiles, [optionId]: null })
    setOptionImagePreviews({ ...optionImagePreviews, [optionId]: null })
    setOptions(options.map(opt => 
      opt.id === optionId ? { ...opt, imageUrl: null } : opt
    ))
  }

  const handleOptionTextChange = (optionId: string, text: string) => {
    setOptions(options.map(opt => 
      opt.id === optionId ? { ...opt, text } : opt
    ))
  }

  const handleCorrectAnswerChange = (optionId: string) => {
    setOptions(options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId
    })))
  }

  const resetForm = () => {
    setFormData({
      subject: '',
      subjectCode: '',
      topic: '',
      topicCode: '',
      grade: '6',
      level: 'Fácil',
      levelCode: 'F',
      informativeText: '',
      questionText: '',
    })
    setInformativeImages([])
    setInformativeImagePreviews([])
    setQuestionImages([])
    setQuestionImagePreviews([])
    setEditInformativeImages([])
    setEditQuestionImages([])
    setOptions([
      { id: 'A', text: '', imageUrl: null, isCorrect: false },
      { id: 'B', text: '', imageUrl: null, isCorrect: false },
      { id: 'C', text: '', imageUrl: null, isCorrect: false },
      { id: 'D', text: '', imageUrl: null, isCorrect: false },
    ])
    setOptionFiles({ A: null, B: null, C: null, D: null })
    setOptionImagePreviews({ A: null, B: null, C: null, D: null })
    // Limpiar estados de modalidades de Inglés
    setInglesModality('standard_mc')
    setMatchingQuestions([])
    setExpandedViewOptions(new Set())
    setClozeText('')
    setClozeGaps({})
    setReadingText('')
    setReadingImage(null)
    setReadingImagePreview(null)
    setReadingQuestions([])
    // Limpiar estados de edición de cloze test
    setIsEditingClozeTest(false)
    setEditClozeText('')
    setEditClozeGaps({})
    setEditClozeRelatedQuestions([])
    // Limpiar errores de validación
    setFieldErrors({})
  }

  // Función para comprimir imagen
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calcular nuevas dimensiones
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        // Dibujar imagen redimensionada
        ctx?.drawImage(img, 0, 0, width, height)
        
        // Convertir a blob
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, { 
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('Error comprimiendo imagen'))
          }
        }, 'image/jpeg', quality)
      }
      
      img.onerror = () => reject(new Error('Error cargando imagen'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Función para convertir archivos a base64 (optimizada y con límite de tamaño)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Si el archivo es muy grande (>2MB), usar una versión muy comprimida
        if (file.size > 2 * 1024 * 1024) {
          console.log('⚠️ Archivo muy grande, comprimiendo agresivamente...')
          const compressedFile = await compressImage(file, 400, 0.5) // Más compresión
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(compressedFile)
        } else {
          // Comprimir normalmente
          const compressedFile = await compressImage(file, 600, 0.7)
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(compressedFile)
        }
      } catch (error) {
        // Si falla la compresión, usar el archivo original pero con timeout
        console.log('⚠️ Usando archivo original como fallback')
        const reader = new FileReader()
        
        // Timeout para evitar que se quede colgado
        const timeout = setTimeout(() => {
          reject(new Error('Timeout convirtiendo imagen a Base64'))
        }, 15000) // 15 segundos
        
        reader.onloadend = () => {
          clearTimeout(timeout)
          resolve(reader.result as string)
        }
        reader.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('Error leyendo archivo'))
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleCreateQuestion = async () => {
    try {
      // Limpiar errores previos
      setFieldErrors({})
      const errors: { [key: string]: boolean } = {}

      // Validaciones básicas comunes
      if (!formData.subject || !formData.subjectCode) {
        errors['subject'] = true
      }
      if (!formData.topic || !formData.topicCode) {
        errors['topic'] = true
      }

      // Validaciones específicas según modalidad de Inglés
      if (formData.subjectCode === 'IN') {
        if (inglesModality === 'matching_columns') {
          // Validar Matching / Columnas (nueva estructura por bloques)
          if (matchingQuestions.length === 0) {
            errors['matchingQuestions'] = true
          }
          // Validar cada pregunta de matching
          matchingQuestions.forEach((mq, mqIndex) => {
            if (!mq.questionText || !mq.questionText.trim()) {
              errors[`matchingQuestionText_${mqIndex}`] = true
          }
            // Validar que tenga al menos 2 opciones y máximo 6 (A-H)
            const validOptions = mq.options.filter(opt => opt.text && opt.text.trim())
            if (validOptions.length < 2) {
              errors[`matchingQuestionOptions_${mqIndex}`] = true
            }
            // Validar que tenga una respuesta correcta
            const hasCorrectAnswer = mq.options.some(opt => opt.isCorrect)
            if (!hasCorrectAnswer) {
              errors[`matchingQuestionAnswer_${mqIndex}`] = true
            }
          })
        } else if (inglesModality === 'cloze_test') {
          // Validar Cloze Test
          if (!clozeText.trim()) {
            errors['clozeText'] = true
          }
          // Validar que todos los huecos tengan opciones y respuesta correcta
          // Extraer texto plano para detectar marcadores
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = clozeText
          const text = tempDiv.textContent || tempDiv.innerText || ''
          const gapMatches = text.match(/\[(\d+)\]/g) || []
          const gaps = new Set<number>()
          gapMatches.forEach(match => {
            const num = parseInt(match.replace(/[\[\]]/g, ''))
            gaps.add(num)
          })
          gaps.forEach(gapNum => {
            const gapData = clozeGaps[gapNum]
            if (!gapData) {
              errors[`clozeGap_${gapNum}`] = true
            } else {
              // Validar que todas las 3 opciones tengan texto
              if (gapData.options.length !== 3) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              const emptyOptions = gapData.options.filter(opt => !opt.trim())
              if (emptyOptions.length > 0) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              // Validar que haya una respuesta correcta (A, B o C)
              if (!gapData.correctAnswer || !['A', 'B', 'C'].includes(gapData.correctAnswer)) {
                errors[`clozeGapAnswer_${gapNum}`] = true
              }
            }
          })
        } else if (inglesModality === 'reading_comprehension') {
          // Validar Comprensión de Lectura
          if (!readingText.trim()) {
            errors['readingText'] = true
          }
          if (readingQuestions.length === 0) {
            errors['readingQuestions'] = true
          } else {
            // Validar cada pregunta de lectura
            readingQuestions.forEach((rq, rqIndex) => {
              // El texto de la pregunta es opcional, no se valida
              // Validar opciones de cada pregunta
              const emptyOptions = rq.options.filter(opt => !opt.text || !opt.text.trim())
              if (emptyOptions.length > 0) {
                errors[`readingQuestionOptions_${rqIndex}`] = true
              }
              // Validar que haya una respuesta correcta
              const correctOptions = rq.options.filter(opt => opt.isCorrect)
              if (correctOptions.length !== 1) {
                errors[`readingQuestionAnswer_${rqIndex}`] = true
              }
            })
          }
        } else {
          // Modalidad estándar (standard_mc)
          if (!formData.questionText.trim()) {
            errors['questionText'] = true
          }
          // Validar que todas las opciones tengan contenido
          const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id])
          if (emptyOptions.length > 0) {
            errors['options'] = true
          }
          // Validar que haya exactamente una respuesta correcta
          const correctOptions = options.filter(opt => opt.isCorrect)
          if (correctOptions.length !== 1) {
            errors['correctAnswer'] = true
          }
        }
      } else {
        // Materia no es Inglés - validación estándar
        if (!formData.questionText.trim()) {
          errors['questionText'] = true
        }
        // Validar que todas las opciones tengan contenido
        const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id])
        if (emptyOptions.length > 0) {
          errors['options'] = true
        }
        // Validar que haya exactamente una respuesta correcta
        const correctOptions = options.filter(opt => opt.isCorrect)
        if (correctOptions.length !== 1) {
          errors['correctAnswer'] = true
        }
      }

      // Si hay errores, mostrarlos y resaltar campos
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        const errorMessages: string[] = []
        
        if (errors['subject']) errorMessages.push('Materia')
        if (errors['topic']) errorMessages.push('Tema')
        if (errors['questionText']) errorMessages.push('Texto de la Pregunta')
        if (errors['matchingQuestions']) errorMessages.push('Preguntas de Matching (debe agregar al menos una)')
        
        // Mensajes específicos para preguntas de matching
        matchingQuestions.forEach((_, mqIndex) => {
          if (errors[`matchingQuestionText_${mqIndex}`]) {
            errorMessages.push(`Texto de Pregunta ${mqIndex + 1} de Matching`)
          }
          if (errors[`matchingQuestionOptions_${mqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${mqIndex + 1} de Matching (mínimo 2 opciones)`)
          }
          if (errors[`matchingQuestionAnswer_${mqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${mqIndex + 1} de Matching`)
          }
        })
        
        if (errors['clozeText']) errorMessages.push('Texto a Completar (Cloze)')
        if (errors['readingText']) errorMessages.push('Texto de Lectura')
        if (errors['readingQuestions']) errorMessages.push('Preguntas de Lectura (debe agregar al menos una)')
        if (errors['options']) errorMessages.push('Opciones de Respuesta')
        if (errors['correctAnswer']) errorMessages.push('Respuesta Correcta')

        // Mensajes específicos para preguntas de lectura
        readingQuestions.forEach((_, rqIndex) => {
          // El texto de la pregunta es opcional, no se incluye en mensajes de error
          if (errors[`readingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`readingQuestionAnswer_${rqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${rqIndex + 1} de Lectura`)
          }
        })

        notifyError({ 
          title: 'Error', 
          message: `Complete los siguientes campos obligatorios: ${errorMessages.join(', ')}` 
        })
        return
      }

      if (!currentUser) {
        notifyError({ 
          title: 'Error', 
          message: 'Usuario no autenticado' 
        })
        return
      }

      // Verificar que el usuario tenga rol de administrador
      if (currentUser.role !== 'admin') {
        notifyError({ 
          title: 'Error', 
          message: 'No tienes permisos para crear preguntas. Solo los administradores pueden realizar esta acción.' 
        })
        return
      }

      console.log('🔍 Usuario autenticado:', {
        uid: currentUser.uid,
        email: currentUser.email,
        role: currentUser.role,
        displayName: currentUser.displayName
      })

      setIsLoading(true)
      console.log('🚀 Iniciando proceso de creación de pregunta...')

      // Mostrar mensaje de progreso
      notifySuccess({ 
        title: 'Procesando', 
        message: 'Convirtiendo imágenes y creando pregunta...' 
      })

      // Procesar imágenes informativas (optimizado)
      console.log('📤 Procesando imágenes informativas...', informativeImages.length)
      const informativeImageUrls: string[] = []
      
      if (informativeImages.length > 0) {
        notifySuccess({ 
          title: 'Procesando', 
          message: `Convirtiendo ${informativeImages.length} imagen(es) informativa(s)...` 
        })
        
        // Procesar imágenes en paralelo para mayor eficiencia
        const imagePromises = informativeImages.map(async (file, index) => {
          console.log(`📤 Procesando imagen informativa ${index + 1}/${informativeImages.length}:`, file.name)
          try {
            // Intentar Firebase Storage primero con timeout
            const storagePromise = questionService.uploadImage(
              file, 
              `questions/informative/${Date.now()}_${index}_${file.name}`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000) // 10 segundos
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              console.log('✅ Imagen informativa subida a Firebase:', result.data)
              return result.data
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen informativa')
            try {
              const base64Url = await fileToBase64(file)
              console.log('✅ Imagen informativa convertida a Base64')
              return base64Url
            } catch (base64Error) {
              console.error('❌ Error procesando imagen informativa:', base64Error)
              return null
            }
          }
        })
        
        const results = await Promise.allSettled(imagePromises)
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            informativeImageUrls.push(result.value)
          } else {
            notifyError({ 
              title: 'Error', 
              message: `Error procesando imagen informativa ${index + 1}` 
            })
          }
        })
      }

      // Procesar imágenes de la pregunta (optimizado)
      console.log('📤 Procesando imágenes de pregunta...', questionImages.length)
      const questionImageUrls: string[] = []
      
      if (questionImages.length > 0) {
        notifySuccess({ 
          title: 'Procesando', 
          message: `Convirtiendo ${questionImages.length} imagen(es) de pregunta...` 
        })
        
        // Procesar imágenes en paralelo
        const imagePromises = questionImages.map(async (file, index) => {
          console.log(`📤 Procesando imagen de pregunta ${index + 1}/${questionImages.length}:`, file.name)
          try {
            // Intentar Firebase Storage primero con timeout
            const storagePromise = questionService.uploadImage(
              file, 
              `questions/question/${Date.now()}_${index}_${file.name}`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000) // 10 segundos
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              console.log('✅ Imagen de pregunta subida a Firebase:', result.data)
              return result.data
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen de pregunta')
            try {
              const base64Url = await fileToBase64(file)
              console.log('✅ Imagen de pregunta convertida a Base64')
              return base64Url
            } catch (base64Error) {
              console.error('❌ Error procesando imagen de pregunta:', base64Error)
              return null
            }
          }
        })
        
        const results = await Promise.allSettled(imagePromises)
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            questionImageUrls.push(result.value)
          } else {
            notifyError({ 
              title: 'Error', 
              message: `Error procesando imagen de pregunta ${index + 1}` 
            })
          }
        })
      }

      // Procesar imágenes de opciones (optimizado)
      console.log('📤 Procesando opciones...')
      const finalOptions: QuestionOption[] = []
      
      // Procesar todas las opciones en paralelo
      const optionPromises = options.map(async (option) => {
        let imageUrl = null
        
        if (optionFiles[option.id]) {
          console.log('📤 Procesando imagen de opción:', option.id)
          try {
            // Intentar Firebase Storage primero con timeout
            const storagePromise = questionService.uploadImage(
              optionFiles[option.id]!, 
              `questions/options/${Date.now()}_${option.id}.jpg`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000) // 10 segundos
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              imageUrl = result.data
              console.log('✅ Imagen de opción subida a Firebase:', result.data)
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen de opción')
            try {
              imageUrl = await fileToBase64(optionFiles[option.id]!)
              console.log('✅ Imagen de opción convertida a Base64')
            } catch (base64Error) {
              console.error('❌ Error procesando imagen de opción:', base64Error)
              notifyError({ 
                title: 'Error', 
                message: `Error procesando imagen de opción ${option.id}` 
              })
            }
          }
        }

        return {
          ...option,
          imageUrl,
        }
      })
      
      const optionResults = await Promise.allSettled(optionPromises)
      optionResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          finalOptions.push(result.value)
        } else {
          console.error('❌ Error procesando opción:', result.reason)
        }
      })

      // Manejar Matching / Columnas: crear múltiples preguntas
      if (formData.subjectCode === 'IN' && inglesModality === 'matching_columns') {
        console.log('🔗 Modo Matching / Columnas: Creando múltiples preguntas...')
        
        // Crear una pregunta por cada pregunta de matching
        const createdQuestions: string[] = []
        let successCount = 0
        let errorCount = 0

        notifySuccess({ 
          title: 'Creando preguntas', 
          message: `Guardando ${matchingQuestions.length} pregunta(s) en la base de datos...` 
        })

        for (let i = 0; i < matchingQuestions.length; i++) {
          const mq = matchingQuestions[i]
          
          try {
            const questionData: any = {
              ...formData,
              questionText: mq.questionText,
              answerType: 'MCQ' as const,
              options: mq.options,
            }

            // Solo agregar campos de imágenes si tienen contenido
            if (informativeImageUrls.length > 0) {
              questionData.informativeImages = informativeImageUrls
            }

            const result = await questionService.createQuestion(questionData, currentUser.uid)
            
            if (result.success) {
              createdQuestions.push(result.data.code)
              successCount++
              console.log(`✅ Pregunta ${i + 1} creada: ${result.data.code}`)
            } else {
              errorCount++
              console.error(`❌ Error creando pregunta ${i + 1}:`, result.error)
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error creando pregunta ${i + 1}:`, error)
          }
        }

        // Mostrar resultado final
        if (successCount === matchingQuestions.length) {
          notifySuccess({ 
            title: 'Éxito', 
            message: `${successCount} pregunta(s) creada(s) exitosamente. Códigos: ${createdQuestions.join(', ')}` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({ 
            title: 'Advertencia', 
            message: `Se crearon ${successCount} pregunta(s) de ${matchingQuestions.length}. ${errorCount} fallaron.` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else {
          notifyError({ 
            title: 'Error', 
            message: `No se pudo crear ninguna pregunta. Verifique los datos e intente nuevamente.` 
          })
        }
      } else if (formData.subjectCode === 'IN' && inglesModality === 'cloze_test') {
        // Manejar Cloze Test: crear múltiples preguntas agrupadas (una por cada hueco)
        console.log('📝 Modo Cloze Test: Creando múltiples preguntas agrupadas...')
        
        // Extraer texto plano para detectar marcadores
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = clozeText
        const text = tempDiv.textContent || tempDiv.innerText || ''
        const gapMatches = text.match(/\[(\d+)\]/g) || []
        const gaps = new Set<number>()
        gapMatches.forEach(match => {
          const num = parseInt(match.replace(/[\[\]]/g, ''))
          gaps.add(num)
        })
        
        if (gaps.size === 0) {
          notifyError({ 
            title: 'Error', 
            message: 'No se encontraron huecos en el texto. Usa [1], [2], etc. para marcar los huecos.' 
          })
          return
        }

        // Crear una pregunta por cada hueco
        const createdQuestions: string[] = []
        let successCount = 0
        let errorCount = 0

        notifySuccess({ 
          title: 'Creando preguntas', 
          message: `Guardando ${gaps.size} pregunta(s) agrupada(s) en la base de datos...` 
        })

        // Ordenar los huecos numéricamente
        const sortedGaps = Array.from(gaps).sort((a, b) => a - b)

        for (let i = 0; i < sortedGaps.length; i++) {
          const gapNum = sortedGaps[i]
          const gapData = clozeGaps[gapNum]
          
          if (!gapData) {
            console.error(`❌ No hay datos para el hueco ${gapNum}`)
            errorCount++
            continue
          }

          // Crear opciones para esta pregunta (A, B, C)
          const gapOptions: QuestionOption[] = ['A', 'B', 'C'].map((letter, optIndex) => ({
            id: letter as 'A' | 'B' | 'C',
            text: gapData.options[optIndex] || '',
            imageUrl: null,
            isCorrect: gapData.correctAnswer === letter
          }))

          // El texto de la pregunta será específico para este hueco
          const questionText = `Selecciona la palabra correcta para completar el hueco [${gapNum}]:`

          const questionData: any = {
            ...formData,
            answerType: 'MCQ' as const,
            informativeText: clozeText, // El texto completo va en informativeText para que se muestre agrupado
            questionText: questionText, // Texto específico del hueco
            options: gapOptions,
          }

          // Agregar imágenes informativas si existen
          if (informativeImageUrls.length > 0) {
            questionData.informativeImages = informativeImageUrls
          }

          try {
            console.log(`📝 Creando pregunta de cloze ${i + 1}/${sortedGaps.length} (Hueco ${gapNum})...`)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 20000)
            })
            
            const createPromise = questionService.createQuestion(questionData, currentUser.uid)
            const result = await Promise.race([createPromise, timeoutPromise]) as any
            
            if (result.success) {
              createdQuestions.push(result.data.code)
              successCount++
              console.log(`✅ Pregunta de cloze ${i + 1} creada: ${result.data.code} (Hueco ${gapNum})`)
            } else {
              errorCount++
              console.error(`❌ Error creando pregunta de cloze ${i + 1} (Hueco ${gapNum}):`, result.error)
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error creando pregunta de cloze ${i + 1} (Hueco ${gapNum}):`, error)
          }
        }

        // Mostrar resultado final
        if (successCount === sortedGaps.length) {
          notifySuccess({ 
            title: 'Éxito', 
            message: `${successCount} pregunta(s) agrupada(s) creada(s) exitosamente. Códigos: ${createdQuestions.join(', ')}` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({ 
            title: 'Advertencia', 
            message: `Se crearon ${successCount} pregunta(s) de ${sortedGaps.length}. ${errorCount} fallaron.` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else {
          notifyError({ 
            title: 'Error', 
            message: `No se pudo crear ninguna pregunta. Verifique los datos e intente nuevamente.` 
          })
        }
      } else if (formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') {
      // Manejar Comprensión de Lectura: crear múltiples preguntas
        console.log('📚 Modo Comprensión de Lectura: Creando múltiples preguntas...')
        
        // Procesar imagen de lectura si existe
        let readingImageUrl: string | null = null
        if (readingImage) {
          try {
            notifySuccess({ 
              title: 'Procesando', 
              message: 'Subiendo imagen de lectura...' 
            })
            const storagePromise = questionService.uploadImage(
              readingImage, 
              `questions/reading/${Date.now()}_reading.jpg`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            if (result.success) {
              readingImageUrl = result.data
            } else {
              const base64Url = await fileToBase64(readingImage)
              readingImageUrl = base64Url
            }
          } catch (error) {
            console.error('Error procesando imagen de lectura:', error)
            const base64Url = await fileToBase64(readingImage)
            readingImageUrl = base64Url
          }
        }

        // Combinar imágenes informativas con la imagen de lectura
        const allInformativeImages = [...informativeImageUrls]
        if (readingImageUrl) {
          allInformativeImages.push(readingImageUrl)
        }

        // Crear una pregunta por cada pregunta de lectura
        const createdQuestions: string[] = []
        let successCount = 0
        let errorCount = 0

        notifySuccess({ 
          title: 'Creando preguntas', 
          message: `Guardando ${readingQuestions.length} pregunta(s) en la base de datos...` 
        })

        for (let i = 0; i < readingQuestions.length; i++) {
          const rq = readingQuestions[i]
          
          // Procesar imagen de pregunta individual si existe
          let questionImageUrl: string | null = null
          if (rq.questionImage) {
            try {
              const storagePromise = questionService.uploadImage(
                rq.questionImage, 
                `questions/reading/${Date.now()}_q${i + 1}.jpg`
              )
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
              )
              const result = await Promise.race([storagePromise, timeoutPromise]) as any
              if (result.success) {
                questionImageUrl = result.data
              } else {
                const base64Url = await fileToBase64(rq.questionImage)
                questionImageUrl = base64Url
              }
            } catch (error) {
              console.error(`Error procesando imagen de pregunta ${i + 1}:`, error)
              const base64Url = await fileToBase64(rq.questionImage)
              questionImageUrl = base64Url
            }
          }
          
          // Procesar opciones de esta pregunta
          const rqOptions: QuestionOption[] = rq.options.map(opt => ({
            id: opt.id,
            text: opt.text || '',
            imageUrl: null, // Las opciones de lectura no tienen imágenes por ahora
            isCorrect: opt.isCorrect
          }))

          const questionData: any = {
            ...formData,
            answerType: 'MCQ' as const,
            informativeText: readingText, // El texto base va en informativeText
            questionText: rq.questionText, // La pregunta específica va en questionText
            options: rqOptions,
          }

          // Agregar imágenes informativas (incluyendo la de lectura)
          if (allInformativeImages.length > 0) {
            questionData.informativeImages = allInformativeImages
          }
          
          // Agregar imagen de pregunta individual si existe
          if (questionImageUrl) {
            questionData.questionImages = [questionImageUrl]
          }

          try {
            console.log(`📝 Creando pregunta ${i + 1}/${readingQuestions.length}...`)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 20000)
            })
            
            const createPromise = questionService.createQuestion(questionData, currentUser.uid)
            const result = await Promise.race([createPromise, timeoutPromise]) as any
            
            if (result.success) {
              createdQuestions.push(result.data.code)
              successCount++
              console.log(`✅ Pregunta ${i + 1} creada: ${result.data.code}`)
            } else {
              errorCount++
              console.error(`❌ Error creando pregunta ${i + 1}:`, result.error)
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error creando pregunta ${i + 1}:`, error)
          }
        }

        // Mostrar resultado final
        if (successCount === readingQuestions.length) {
          notifySuccess({ 
            title: 'Éxito', 
            message: `${successCount} pregunta(s) creada(s) exitosamente. Códigos: ${createdQuestions.join(', ')}` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({ 
            title: 'Advertencia', 
            message: `Se crearon ${successCount} pregunta(s) de ${readingQuestions.length}. ${errorCount} fallaron.` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else {
          notifyError({ 
            title: 'Error', 
            message: `No se pudo crear ninguna pregunta. Verifique los datos e intente nuevamente.` 
          })
        }
      } else {
        // Crear pregunta estándar (modalidad normal o no es Inglés)
        console.log('📝 Preparando datos de la pregunta...')
        const questionData: any = {
          ...formData,
          answerType: 'MCQ' as const,
          options: finalOptions,
        }

        // Solo agregar campos de imágenes si tienen contenido (evitar undefined)
        if (informativeImageUrls.length > 0) {
          questionData.informativeImages = informativeImageUrls
        }
        if (questionImageUrls.length > 0) {
          questionData.questionImages = questionImageUrls
        }

        console.log('📝 Datos de la pregunta preparados:', questionData)
        console.log('🚀 Llamando a questionService.createQuestion...')
        
        // Mostrar progreso
        notifySuccess({ 
          title: 'Creando pregunta', 
          message: 'Guardando en la base de datos...' 
        })
        
        // Agregar timeout para evitar que se cuelgue
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: La operación tardó demasiado (20 segundos)')), 20000)
        })
        
        const createPromise = questionService.createQuestion(questionData, currentUser.uid)
        
        const result = await Promise.race([createPromise, timeoutPromise]) as any
        
        console.log('📝 Resultado de createQuestion:', result)

        if (result.success) {
          notifySuccess({ 
            title: 'Éxito', 
            message: `Pregunta creada con código: ${result.data.code}` 
          })
          resetForm()
          setIsCreateDialogOpen(false)
          loadQuestions()
          loadStats()
        } else {
          notifyError({ 
            title: 'Error', 
            message: result.error || 'No se pudo crear la pregunta' 
          })
        }
      }
    } catch (error) {
      console.error('❌ Error al crear pregunta:', error)
      
      let errorMessage = 'Error al crear la pregunta'
      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          errorMessage = 'La operación tardó demasiado. Verifique su conexión y la configuración de Firebase.'
        } else if (error.message.includes('Permission')) {
          errorMessage = 'No tiene permisos para crear preguntas. Verifique su rol de administrador.'
        } else if (error.message.includes('Storage')) {
          errorMessage = 'Error con el almacenamiento de imágenes. Verifique la configuración de Firebase Storage.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      
      notifyError({ 
        title: 'Error al crear pregunta', 
        message: errorMessage 
      })
    } finally {
      setIsLoading(false)
      console.log('🏁 Proceso de creación finalizado')
    }
  }

  const handleViewQuestion = (question: Question) => {
    setSelectedQuestion(question)
    
    // Si es una pregunta de Inglés con texto informativo, buscar preguntas relacionadas
    // (preguntas de comprensión de lectura que comparten el mismo texto base e imágenes)
    if (question.subjectCode === 'IN' && question.informativeText) {
      const related = questions.filter(q => 
        q.subjectCode === 'IN' &&
        q.id !== question.id &&
        q.informativeText === question.informativeText &&
        JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
        q.topicCode === question.topicCode &&
        q.grade === question.grade &&
        q.levelCode === question.levelCode
      )
      setRelatedQuestions([question, ...related])
    } else {
      setRelatedQuestions([question])
    }
    
    setIsViewDialogOpen(true)
  }

  const handleEditQuestion = (question: Question) => {
    console.log('📝 Cargando pregunta para edición:', {
      id: question.id,
      code: question.code,
      subjectCode: question.subjectCode,
      topicCode: question.topicCode,
      grade: question.grade,
      levelCode: question.levelCode,
      gradeType: typeof question.grade,
    })
    
    setSelectedQuestion(question)
    
    // Verificar si es una pregunta de cloze test
    const isClozeTest = question.subjectCode === 'IN' && 
                        question.informativeText && 
                        question.questionText?.includes('completar el hueco')
    
    if (isClozeTest) {
      // Buscar todas las preguntas relacionadas del cloze test
      const related = questions.filter(q => 
        q.subjectCode === 'IN' &&
        q.informativeText === question.informativeText &&
        JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
        q.topicCode === question.topicCode &&
        q.grade === question.grade &&
        q.levelCode === question.levelCode &&
        q.questionText?.includes('completar el hueco')
      )
      
      setEditClozeRelatedQuestions(related)
      setIsEditingClozeTest(true)
      
      // Cargar el texto completo del cloze test
      setEditClozeText(question.informativeText || '')
      
      // Extraer los datos de cada hueco de las preguntas relacionadas
      const gapsData: { [key: number]: { options: string[], correctAnswer: string } } = {}
      
      related.forEach(q => {
        const match = q.questionText?.match(/hueco \[(\d+)\]/)
        if (match) {
          const gapNum = parseInt(match[1])
          // Extraer opciones A, B, C
          const options = ['A', 'B', 'C'].map(letter => {
            const option = q.options.find(opt => opt.id === letter)
            return option?.text || ''
          })
          // Encontrar la respuesta correcta
          const correctOption = q.options.find(opt => opt.isCorrect)
          const correctAnswer = correctOption?.id || 'A'
          
          gapsData[gapNum] = {
            options,
            correctAnswer
          }
        }
      })
      
      setEditClozeGaps(gapsData)
      
      // Cargar datos básicos del formulario
      const gradeValue = String(question.grade || '').trim() as '6' | '7' | '8' | '9' | '0' | '1'
      setFormData({
        subject: question.subject,
        subjectCode: question.subjectCode,
        topic: question.topic,
        topicCode: question.topicCode,
        grade: gradeValue,
        level: question.level as any,
        levelCode: question.levelCode as any,
        informativeText: question.informativeText || '',
        questionText: question.questionText,
      })
      
      // Cargar imágenes informativas
      setInformativeImagePreviews(question.informativeImages || [])
    } else {
      // Modo de edición normal (no cloze test)
      setIsEditingClozeTest(false)
      
      // Cargar los datos de la pregunta en el formulario
      // Asegurar que el grado sea string para consistencia
      const gradeValue = String(question.grade || '').trim() as '6' | '7' | '8' | '9' | '0' | '1'
      
      setFormData({
        subject: question.subject,
        subjectCode: question.subjectCode,
        topic: question.topic,
        topicCode: question.topicCode,
        grade: gradeValue,
        level: question.level as any,
        levelCode: question.levelCode as any,
        informativeText: question.informativeText || '',
        questionText: question.questionText,
      })
      
      console.log('📋 Formulario cargado con valores:', {
        grade: gradeValue,
        subjectCode: question.subjectCode,
        topicCode: question.topicCode,
        levelCode: question.levelCode,
      })
      // Cargar opciones
      setOptions(question.options)
      // Cargar imágenes existentes para mostrar
      setInformativeImagePreviews(question.informativeImages || [])
      setQuestionImagePreviews(question.questionImages || [])
      setOptionImagePreviews({
        A: question.options.find(o => o.id === 'A')?.imageUrl || null,
        B: question.options.find(o => o.id === 'B')?.imageUrl || null,
        C: question.options.find(o => o.id === 'C')?.imageUrl || null,
        D: question.options.find(o => o.id === 'D')?.imageUrl || null,
      })
    }
    
    // Limpiar estados de edición de imágenes
    setEditInformativeImages([])
    setEditQuestionImages([])
    setIsEditDialogOpen(true)
  }

  const handleDeleteQuestion = async (question: Question) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la pregunta ${question.code}? Esta acción no se puede deshacer.`)) {
      return
    }

    if (!currentUser || currentUser.role !== 'admin') {
      notifyError({
        title: 'Error',
        message: 'No tienes permisos para eliminar preguntas'
      })
      return
    }

    // Validar que la pregunta tenga un ID
    if (!question.id) {
      console.error('❌ Error: La pregunta no tiene ID:', question)
      notifyError({
        title: 'Error',
        message: 'La pregunta no tiene un ID válido para eliminar'
      })
      return
    }

    console.log('🗑️ Intentando eliminar pregunta:', {
      id: question.id,
      code: question.code,
      subject: question.subject,
      userId: currentUser.uid,
      userRole: currentUser.role
    })

    // Guardar el estado original para poder restaurarlo si falla
    const originalQuestions = [...questions]
    const originalFilteredQuestions = [...filteredQuestions]
    
    // Actualización optimista: eliminar del estado local inmediatamente
    const updatedQuestions = questions.filter(q => q.id !== question.id)
    setQuestions(updatedQuestions)
    
    // Actualizar también las preguntas filtradas
    const updatedFilteredQuestions = filteredQuestions.filter(q => q.id !== question.id)
    setFilteredQuestions(updatedFilteredQuestions)

    setIsLoading(true)
    try {
      console.log('🔄 Llamando a questionService.deleteQuestion con ID:', question.id)
      const result = await questionService.deleteQuestion(question.id)
      
      if (result.success) {
        console.log('✅ Eliminación exitosa en la base de datos')
        
        // Recargar las preguntas desde la base de datos para asegurar consistencia
        await loadQuestions()
        await loadStats()
        
        notifySuccess({
          title: 'Éxito',
          message: `Pregunta ${question.code} eliminada correctamente de la base de datos. Nota: La consola de Firebase puede mostrar datos en caché - refresca la página de la consola (F5) si aún ves la pregunta.`
        })
      } else {
        console.error('❌ Error al eliminar pregunta de la base de datos:', result.error)
        console.error('❌ Detalles del error:', {
          message: result.error?.message,
          statusCode: result.error?.statusCode,
          code: result.error?.code
        })
        
        // Restaurar el estado original si falló la eliminación
        setQuestions(originalQuestions)
        setFilteredQuestions(originalFilteredQuestions)
        
        notifyError({
          title: 'Error al eliminar',
          message: result.error?.message || 'No se pudo eliminar la pregunta de la base de datos. Verifica las reglas de seguridad de Firestore.'
        })
      }
    } catch (error: any) {
      console.error('❌ Excepción al eliminar pregunta:', error)
      console.error('❌ Detalles de la excepción:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      })
      
      // Restaurar el estado original si falló la eliminación
      setQuestions(originalQuestions)
      setFilteredQuestions(originalFilteredQuestions)
      
      notifyError({
        title: 'Error',
        message: `Error al eliminar la pregunta: ${error?.message || 'Error desconocido'}. La pregunta no se eliminó de la base de datos.`
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateQuestion = async () => {
    try {
      if (!selectedQuestion?.id) {
        notifyError({
          title: 'Error',
          message: 'No se ha seleccionado una pregunta'
        })
        return
      }

      // Limpiar errores previos
      setFieldErrors({})
      const errors: { [key: string]: boolean } = {}

      // Validaciones básicas comunes
      if (!formData.subject || !formData.subjectCode) {
        errors['subject'] = true
      }
      if (!formData.topic || !formData.topicCode) {
        errors['topic'] = true
      }

      // Validaciones específicas según modalidad de Inglés
      if (formData.subjectCode === 'IN') {
        if (inglesModality === 'matching_columns') {
          // Validar Matching / Columnas
          if (matchingQuestions.length === 0) {
            errors['matchingQuestions'] = true
          }
          // Validar cada pregunta de matching
          matchingQuestions.forEach((mq, mqIndex) => {
            if (!mq.questionText || !mq.questionText.trim()) {
              errors[`matchingQuestionText_${mqIndex}`] = true
            }
            // Validar que tenga al menos 2 opciones
            const validOptions = mq.options.filter(opt => opt.text && opt.text.trim())
            if (validOptions.length < 2) {
              errors[`matchingQuestionOptions_${mqIndex}`] = true
            }
            // Validar que tenga una respuesta correcta
            const hasCorrectAnswer = mq.options.some(opt => opt.isCorrect)
            if (!hasCorrectAnswer) {
              errors[`matchingQuestionAnswer_${mqIndex}`] = true
            }
          })
        } else if (inglesModality === 'cloze_test') {
          // Validar Cloze Test
          if (!clozeText.trim()) {
            errors['clozeText'] = true
          }
          // Validar que todos los huecos tengan opciones y respuesta correcta
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = clozeText
          const text = tempDiv.textContent || tempDiv.innerText || ''
          const gapMatches = text.match(/\[(\d+)\]/g) || []
          const gaps = new Set<number>()
          gapMatches.forEach(match => {
            const num = parseInt(match.replace(/[\[\]]/g, ''))
            gaps.add(num)
          })
          gaps.forEach(gapNum => {
            const gapData = clozeGaps[gapNum]
            if (!gapData) {
              errors[`clozeGap_${gapNum}`] = true
            } else {
              // Validar que todas las 3 opciones tengan texto
              if (gapData.options.length !== 3) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              const emptyOptions = gapData.options.filter(opt => !opt.trim())
              if (emptyOptions.length > 0) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              // Validar que haya una respuesta correcta (A, B o C)
              if (!gapData.correctAnswer || !['A', 'B', 'C'].includes(gapData.correctAnswer)) {
                errors[`clozeGapAnswer_${gapNum}`] = true
              }
            }
          })
        } else if (inglesModality === 'reading_comprehension') {
          // Validar Comprensión de Lectura
          if (!readingText.trim()) {
            errors['readingText'] = true
          }
          if (readingQuestions.length === 0) {
            errors['readingQuestions'] = true
          } else {
            // Validar cada pregunta de lectura
            readingQuestions.forEach((rq, rqIndex) => {
              // Validar opciones de cada pregunta
              const emptyOptions = rq.options.filter(opt => !opt.text || !opt.text.trim())
              if (emptyOptions.length > 0) {
                errors[`readingQuestionOptions_${rqIndex}`] = true
              }
              // Validar que haya una respuesta correcta
              const correctOptions = rq.options.filter(opt => opt.isCorrect)
              if (correctOptions.length !== 1) {
                errors[`readingQuestionAnswer_${rqIndex}`] = true
              }
            })
          }
        } else {
          // Modalidad estándar (standard_mc)
          if (!formData.questionText.trim()) {
            errors['questionText'] = true
          }
          // Validar que todas las opciones tengan contenido
          const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id] && !opt.imageUrl)
          if (emptyOptions.length > 0) {
            errors['options'] = true
          }
          // Validar que haya exactamente una respuesta correcta
          const correctOptions = options.filter(opt => opt.isCorrect)
          if (correctOptions.length !== 1) {
            errors['correctAnswer'] = true
          }
        }
      } else {
        // Materia no es Inglés - validación estándar
        if (!formData.questionText.trim()) {
          errors['questionText'] = true
        }
        // Validar que todas las opciones tengan contenido
        const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id] && !opt.imageUrl)
        if (emptyOptions.length > 0) {
          errors['options'] = true
        }
        // Validar que haya exactamente una respuesta correcta
        const correctOptions = options.filter(opt => opt.isCorrect)
        if (correctOptions.length !== 1) {
          errors['correctAnswer'] = true
        }
      }

      // Si hay errores, mostrarlos y resaltar campos
      // Si es cloze test en edición, NO mostrar errores aquí (se validan más adelante)
      if (isEditingClozeTest) {
        // Solo validar materia y tema, los demás errores se validan en la sección específica
        if (Object.keys(errors).length > 0 && (errors['subject'] || errors['topic'])) {
          setFieldErrors(errors)
          const errorMessages: string[] = []
          if (errors['subject']) errorMessages.push('Materia')
          if (errors['topic']) errorMessages.push('Tema')
          
          notifyError({ 
            title: 'Campos Obligatorios Faltantes', 
            message: errorMessages.map(msg => `• ${msg}`).join('\n')
          })
          return
        }
        // Si no hay errores de materia/tema, continuar a la validación específica de cloze test
      } else if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        const errorMessages: string[] = []
        
        if (errors['subject']) errorMessages.push('Materia')
        if (errors['topic']) errorMessages.push('Tema')
        if (errors['questionText']) errorMessages.push('Texto de la Pregunta')
        if (errors['matchingQuestions']) errorMessages.push('Preguntas de Matching (debe agregar al menos una)')
        
        // Mensajes específicos para preguntas de matching
        matchingQuestions.forEach((_, mqIndex) => {
          if (errors[`matchingQuestionText_${mqIndex}`]) {
            errorMessages.push(`Texto de Pregunta ${mqIndex + 1} de Matching`)
          }
          if (errors[`matchingQuestionOptions_${mqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${mqIndex + 1} de Matching (mínimo 2 opciones)`)
          }
          if (errors[`matchingQuestionAnswer_${mqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${mqIndex + 1} de Matching`)
          }
        })
        
        if (errors['clozeText']) errorMessages.push('Texto a Completar (Cloze)')
        // Mensajes específicos para huecos de cloze (usar editClozeGaps si es edición)
        const gapsToCheck = isEditingClozeTest ? editClozeGaps : clozeGaps
        Object.keys(gapsToCheck).forEach(gapNum => {
          if (errors[`clozeGap_${gapNum}`]) {
            errorMessages.push(`Pregunta ${gapNum} (no se detectaron opciones)`)
          }
          if (errors[`clozeGapOptions_${gapNum}`]) {
            errorMessages.push(`Opciones de la Pregunta ${gapNum} (deben completarse las 3 opciones)`)
          }
          if (errors[`clozeGapAnswer_${gapNum}`]) {
            errorMessages.push(`Respuesta Correcta de la Pregunta ${gapNum}`)
          }
        })
        
        if (errors['readingText']) errorMessages.push('Texto de Lectura')
        if (errors['readingQuestions']) errorMessages.push('Preguntas de Lectura (debe agregar al menos una)')
        // Solo mostrar errores de opciones normales si NO es cloze test
        if (!isEditingClozeTest) {
          if (errors['options']) errorMessages.push('Opciones de Respuesta')
          if (errors['correctAnswer']) errorMessages.push('Respuesta Correcta')
        }

        // Mensajes específicos para preguntas de lectura
        readingQuestions.forEach((_, rqIndex) => {
          if (errors[`readingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`readingQuestionAnswer_${rqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${rqIndex + 1} de Lectura`)
          }
        })

        // Mostrar error con lista detallada
        const errorList = errorMessages.length > 0 
          ? errorMessages.map(msg => `• ${msg}`).join('\n')
          : 'Por favor complete todos los campos obligatorios'
        
        notifyError({ 
          title: 'Campos Obligatorios Faltantes', 
          message: errorList
        })
        
        // Hacer scroll al primer campo con error
        setTimeout(() => {
          const firstErrorField = document.querySelector('[class*="border-red-500"]')
          if (firstErrorField) {
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        
        return
      }

      if (!currentUser) {
        notifyError({
          title: 'Error',
          message: 'Usuario no autenticado'
        })
        return
      }

      if (currentUser.role !== 'admin') {
        notifyError({
          title: 'Error',
          message: 'No tienes permisos para editar preguntas'
        })
        return
      }

      setIsLoading(true)
      notifySuccess({
        title: 'Actualizando',
        message: 'Guardando cambios...'
      })

      // Procesar nuevas imágenes informativas si las hay
      let newInformativeImageUrls: string[] = []
      if (editInformativeImages.length > 0) {
        notifySuccess({ 
          title: 'Procesando', 
          message: `Convirtiendo ${editInformativeImages.length} imagen(es) informativa(s) nueva(s)...` 
        })
        
        const imagePromises = editInformativeImages.map(async (file, index) => {
          try {
            const storagePromise = questionService.uploadImage(
              file, 
              `questions/informative/${Date.now()}_${index}_${file.name}`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              return result.data
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen informativa')
            return await fileToBase64(file)
          }
        })
        
        newInformativeImageUrls = await Promise.all(imagePromises)
      }

      // Procesar nuevas imágenes de pregunta si las hay
      let newQuestionImageUrls: string[] = []
      if (editQuestionImages.length > 0) {
        notifySuccess({ 
          title: 'Procesando', 
          message: `Convirtiendo ${editQuestionImages.length} imagen(es) de pregunta nueva(s)...` 
        })
        
        const imagePromises = editQuestionImages.map(async (file, index) => {
          try {
            const storagePromise = questionService.uploadImage(
              file, 
              `questions/question/${Date.now()}_${index}_${file.name}`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              return result.data
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen de pregunta')
            return await fileToBase64(file)
          }
        })
        
        newQuestionImageUrls = await Promise.all(imagePromises)
      }

      // Procesar nuevas imágenes de opciones
      const finalOptions: QuestionOption[] = []
      const optionPromises = options.map(async (option) => {
        let imageUrl = option.imageUrl // Mantener imagen existente por defecto
        
        if (optionFiles[option.id]) {
          try {
            const storagePromise = questionService.uploadImage(
              optionFiles[option.id]!, 
              `questions/options/${Date.now()}_${option.id}_${optionFiles[option.id]!.name}`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            
            if (result.success) {
              imageUrl = result.data
            } else {
              throw new Error('Storage failed')
            }
          } catch (error) {
            console.log('⚠️ Fallback a Base64 para imagen de opción')
            imageUrl = await fileToBase64(optionFiles[option.id]!)
          }
        }
        
        return {
          ...option,
          imageUrl,
        }
      })
      
      const optionResults = await Promise.allSettled(optionPromises)
      optionResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          finalOptions.push(result.value)
        }
      })

      // Verificar si cambiaron los parámetros que afectan el código
      // Convertir a string para evitar problemas de tipos
      const oldSubjectCode = String(selectedQuestion.subjectCode || '').trim()
      const newSubjectCode = String(formData.subjectCode || '').trim()
      const oldTopicCode = String(selectedQuestion.topicCode || '').trim()
      const newTopicCode = String(formData.topicCode || '').trim()
      const oldGrade = String(selectedQuestion.grade || '').trim()
      const newGrade = String(formData.grade || '').trim()
      const oldLevelCode = String(selectedQuestion.levelCode || '').trim()
      const newLevelCode = String(formData.levelCode || '').trim()

      const codeParamsChanged = 
        oldSubjectCode !== newSubjectCode ||
        oldTopicCode !== newTopicCode ||
        oldGrade !== newGrade ||
        oldLevelCode !== newLevelCode

      // Log detallado para depuración
      console.log('🔍 Verificando cambios en parámetros del código:')
      console.log('  Materia:', { old: oldSubjectCode, new: newSubjectCode, changed: oldSubjectCode !== newSubjectCode })
      console.log('  Tema:', { old: oldTopicCode, new: newTopicCode, changed: oldTopicCode !== newTopicCode })
      console.log('  Grado:', { old: oldGrade, new: newGrade, changed: oldGrade !== newGrade })
      console.log('  Nivel:', { old: oldLevelCode, new: newLevelCode, changed: oldLevelCode !== newLevelCode })
      console.log('  ¿Cambió algún parámetro?', codeParamsChanged)

      // Si cambiaron los parámetros, generar un nuevo código
      let newCode: string | undefined = undefined
      if (codeParamsChanged) {
        console.log('🔄 Detectado cambio en parámetros del código:')
        console.log('  Materia:', oldSubjectCode, '→', newSubjectCode)
        console.log('  Tema:', oldTopicCode, '→', newTopicCode)
        console.log('  Grado:', oldGrade, '→', newGrade)
        console.log('  Nivel:', oldLevelCode, '→', newLevelCode)
        console.log('  Código actual:', selectedQuestion.code)
        
        notifySuccess({
          title: 'Generando código',
          message: 'Generando nuevo código para la pregunta...'
        })

        const codeResult = await questionService.generateQuestionCode(
          newSubjectCode,
          newTopicCode,
          newGrade,
          newLevelCode
        )

        if (!codeResult.success) {
          console.error('❌ Error al generar código:', codeResult.error)
          notifyError({
            title: 'Error',
            message: codeResult.error?.message || 'No se pudo generar el nuevo código'
          })
          setIsLoading(false)
          return
        }

        newCode = codeResult.data
        console.log(`✅ Nuevo código generado: ${selectedQuestion.code} → ${newCode}`)
      } else {
        console.log('ℹ️ No se detectaron cambios en los parámetros del código')
      }

      // Manejar actualización de Cloze Test
      if (isEditingClozeTest) {
        // Validar que todos los huecos tengan opciones y respuesta correcta
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = editClozeText
        const text = tempDiv.textContent || tempDiv.innerText || ''
        const gapMatches = text.match(/\[(\d+)\]/g) || []
        const gaps = new Set<number>()
        gapMatches.forEach(match => {
          const num = parseInt(match.replace(/[\[\]]/g, ''))
          gaps.add(num)
        })
        
        if (gaps.size === 0) {
          notifyError({ 
            title: 'Error', 
            message: 'No se encontraron huecos en el texto. Usa [1], [2], etc. para marcar los huecos.' 
          })
          setIsLoading(false)
          return
        }
        
        // Validar que todos los huecos tengan datos
        const clozeErrors: { [key: string]: boolean } = {}
        
        // Validar texto del cloze test
        if (!editClozeText.trim()) {
          clozeErrors['clozeText'] = true
        }
        
        gaps.forEach(gapNum => {
          const gapData = editClozeGaps[gapNum]
          if (!gapData) {
            clozeErrors[`clozeGap_${gapNum}`] = true
          } else {
            // Validar que tenga exactamente 3 opciones
            if (!gapData.options || !Array.isArray(gapData.options) || gapData.options.length !== 3) {
              clozeErrors[`clozeGapOptions_${gapNum}`] = true
            } else {
              // Validar que todas las opciones tengan texto (verificar que no sean null, undefined o string vacío)
              const emptyOptions = gapData.options.filter(opt => {
                if (opt === null || opt === undefined) return true
                if (typeof opt === 'string' && !opt.trim()) return true
                return false
              })
              if (emptyOptions.length > 0) {
                clozeErrors[`clozeGapOptions_${gapNum}`] = true
              }
            }
            // Validar que haya una respuesta correcta (A, B o C)
            if (!gapData.correctAnswer || typeof gapData.correctAnswer !== 'string' || !['A', 'B', 'C'].includes(gapData.correctAnswer)) {
              clozeErrors[`clozeGapAnswer_${gapNum}`] = true
            }
          }
        })
        
        console.log('🔍 Validación de Cloze Test:', {
          gaps: Array.from(gaps),
          editClozeGaps,
          clozeErrors,
          hasErrors: Object.keys(clozeErrors).length > 0
        })
        
        if (Object.keys(clozeErrors).length > 0) {
          setFieldErrors(clozeErrors)
          
          // Crear mensaje de error detallado
          const errorMessages: string[] = []
          if (clozeErrors['clozeText']) {
            errorMessages.push('Texto a Completar')
          }
          
          gaps.forEach(gapNum => {
            if (clozeErrors[`clozeGap_${gapNum}`]) {
              errorMessages.push(`Pregunta ${gapNum} (no se detectaron opciones)`)
            } else {
              if (clozeErrors[`clozeGapOptions_${gapNum}`]) {
                errorMessages.push(`Pregunta ${gapNum} - Complete las 3 opciones (A, B, C)`)
              }
              if (clozeErrors[`clozeGapAnswer_${gapNum}`]) {
                errorMessages.push(`Pregunta ${gapNum} - Seleccione la respuesta correcta`)
              }
            }
          })
          
          const errorList = errorMessages.length > 0 
            ? errorMessages.map(msg => `• ${msg}`).join('\n')
            : 'Por favor complete todos los campos requeridos para cada pregunta.'
          
          notifyError({
            title: 'Campos Obligatorios Faltantes',
            message: errorList
          })
          
          // Hacer scroll al primer campo con error
          setTimeout(() => {
            const firstErrorField = document.querySelector('[class*="border-red-500"]')
            if (firstErrorField) {
              firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 100)
          
          setIsLoading(false)
          return
        }
        
        // Procesar nuevas imágenes informativas
        let finalInformativeImages = [...(selectedQuestion.informativeImages || [])]
        if (newInformativeImageUrls.length > 0) {
          finalInformativeImages = [...finalInformativeImages, ...newInformativeImageUrls]
        }
        
        // Actualizar todas las preguntas relacionadas del cloze test
        const sortedGaps = Array.from(gaps).sort((a, b) => a - b)
        let successCount = 0
        let errorCount = 0
        const updatedCodes: string[] = []
        
        notifySuccess({
          title: 'Actualizando',
          message: `Actualizando ${sortedGaps.length} pregunta(s) del cloze test...`
        })
        
        for (let i = 0; i < sortedGaps.length; i++) {
          const gapNum = sortedGaps[i]
          const gapData = editClozeGaps[gapNum]
          
          // Buscar la pregunta correspondiente a este hueco
          const relatedQuestion = editClozeRelatedQuestions.find(q => {
            const match = q.questionText?.match(/hueco \[(\d+)\]/)
            return match && parseInt(match[1]) === gapNum
          })
          
          if (!relatedQuestion) {
            console.error(`❌ No se encontró pregunta para el hueco ${gapNum}`)
            errorCount++
            continue
          }
          
          // Crear opciones para esta pregunta (A, B, C)
          const gapOptions: QuestionOption[] = ['A', 'B', 'C'].map((letter, optIndex) => ({
            id: letter as 'A' | 'B' | 'C',
            text: gapData.options[optIndex] || '',
            imageUrl: null,
            isCorrect: gapData.correctAnswer === letter
          }))
          
          // El texto de la pregunta será específico para este hueco
          const questionText = `Selecciona la palabra correcta para completar el hueco [${gapNum}]:`
          
          // Verificar si cambiaron los parámetros que afectan el código
          const oldSubjectCode = String(relatedQuestion.subjectCode || '').trim()
          const newSubjectCode = String(formData.subjectCode || '').trim()
          const oldTopicCode = String(relatedQuestion.topicCode || '').trim()
          const newTopicCode = String(formData.topicCode || '').trim()
          const oldGrade = String(relatedQuestion.grade || '').trim()
          const newGrade = String(formData.grade || '').trim()
          const oldLevelCode = String(relatedQuestion.levelCode || '').trim()
          const newLevelCode = String(formData.levelCode || '').trim()
          
          const codeParamsChanged = 
            oldSubjectCode !== newSubjectCode ||
            oldTopicCode !== newTopicCode ||
            oldGrade !== newGrade ||
            oldLevelCode !== newLevelCode
          
          // Generar nuevo código si es necesario
          let questionNewCode: string | undefined = undefined
          if (codeParamsChanged) {
            const codeResult = await questionService.generateQuestionCode(
              newSubjectCode,
              newTopicCode,
              newGrade,
              newLevelCode
            )
            if (codeResult.success) {
              questionNewCode = codeResult.data
            }
          }
          
          // Preparar datos de actualización
          const updates: any = {
            subject: formData.subject,
            subjectCode: formData.subjectCode,
            topic: formData.topic,
            topicCode: formData.topicCode,
            grade: formData.grade,
            level: formData.level,
            levelCode: formData.levelCode,
            informativeText: editClozeText, // El texto completo del cloze test
            questionText: questionText,
            options: gapOptions,
            informativeImages: finalInformativeImages
          }
          
          if (questionNewCode) {
            updates.code = questionNewCode
          }
          
          if (!relatedQuestion.id) {
            console.error(`❌ La pregunta del hueco ${gapNum} no tiene ID válido`)
            errorCount++
            continue
          }
          
          const questionId = relatedQuestion.id // Guardar en variable para TypeScript
          
          try {
            const result = await questionService.updateQuestion(questionId, updates)
            if (result.success) {
              successCount++
              updatedCodes.push(questionNewCode || relatedQuestion.code)
            } else {
              errorCount++
              console.error(`❌ Error actualizando pregunta del hueco ${gapNum}:`, result.error)
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error actualizando pregunta del hueco ${gapNum}:`, error)
          }
        }
        
        if (successCount === sortedGaps.length) {
          notifySuccess({
            title: 'Éxito',
            message: `${successCount} pregunta(s) del cloze test actualizada(s) correctamente.`
          })
          resetForm()
          setIsEditDialogOpen(false)
          setSelectedQuestion(null)
          setIsEditingClozeTest(false)
          setEditClozeText('')
          setEditClozeGaps({})
          setEditClozeRelatedQuestions([])
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({
            title: 'Advertencia',
            message: `Se actualizaron ${successCount} pregunta(s) de ${sortedGaps.length}. ${errorCount} fallaron.`
          })
          loadQuestions()
          loadStats()
        } else {
          notifyError({
            title: 'Error',
            message: 'No se pudo actualizar ninguna pregunta del cloze test.'
          })
        }
      } else {
        // Actualización normal (no cloze test)
        // Preparar datos de actualización
        const updates: any = {
          subject: formData.subject,
          subjectCode: formData.subjectCode,
          topic: formData.topic,
          topicCode: formData.topicCode,
          grade: formData.grade,
          level: formData.level,
          levelCode: formData.levelCode,
          informativeText: formData.informativeText || '',
          questionText: formData.questionText,
          options: finalOptions
        }

        // Si se generó un nuevo código, agregarlo a las actualizaciones
        if (newCode) {
          updates.code = newCode
        }

        // Agregar nuevas imágenes si las hay
        if (newInformativeImageUrls.length > 0) {
          updates.informativeImages = [...(selectedQuestion.informativeImages || []), ...newInformativeImageUrls]
        }
        if (newQuestionImageUrls.length > 0) {
          updates.questionImages = [...(selectedQuestion.questionImages || []), ...newQuestionImageUrls]
        }

        // Actualizar la pregunta
        const result = await questionService.updateQuestion(selectedQuestion.id, updates)

        if (result.success) {
          const successMessage = newCode 
            ? `Pregunta actualizada correctamente. Código cambiado: ${selectedQuestion.code} → ${newCode}`
            : `Pregunta ${selectedQuestion.code} actualizada correctamente`
          
          notifySuccess({
            title: 'Éxito',
            message: successMessage
          })
          resetForm()
          setIsEditDialogOpen(false)
          setSelectedQuestion(null)
          loadQuestions()
          loadStats()
        } else {
          notifyError({
            title: 'Error',
            message: result.error?.message || 'No se pudo actualizar la pregunta'
          })
        }
      }
    } catch (error) {
      console.error('Error actualizando pregunta:', error)
      notifyError({
        title: 'Error',
        message: 'Error al actualizar la pregunta'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateQuestionTextOnly = async () => {
    try {
      // Validaciones básicas
      if (!formData.subject || !formData.topic || !formData.questionText) {
        notifyError({ 
          title: 'Error', 
          message: 'Complete todos los campos obligatorios' 
        })
        return
      }

      // Validar que todas las opciones tengan contenido
      const emptyOptions = options.filter(opt => !opt.text)
      if (emptyOptions.length > 0) {
        notifyError({ 
          title: 'Error', 
          message: 'Todas las opciones deben tener texto' 
        })
        return
      }

      // Validar que haya exactamente una respuesta correcta
      const correctOptions = options.filter(opt => opt.isCorrect)
      if (correctOptions.length !== 1) {
        notifyError({ 
          title: 'Error', 
          message: 'Debe marcar exactamente una opción como correcta' 
        })
        return
      }

      if (!currentUser || currentUser.role !== 'admin') {
        notifyError({ 
          title: 'Error', 
          message: 'No tiene permisos para crear preguntas' 
        })
        return
      }

      setIsLoading(true)
      console.log('📝 Creando pregunta solo con texto...')

      notifySuccess({ 
        title: 'Creando', 
        message: 'Creando pregunta solo con texto...' 
      })

      // Datos de la pregunta sin imágenes
      const questionData = {
        ...formData,
        answerType: 'MCQ' as const,
        options: options.map(opt => ({
          ...opt,
          imageUrl: null // Sin imágenes
        }))
      }

      console.log('📝 Datos de la pregunta (solo texto):', questionData)
      
      // Crear la pregunta con timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La operación tardó demasiado')), 10000) // 10 segundos
      })
      
      const createPromise = questionService.createQuestion(questionData, currentUser.uid)
      
      const result = await Promise.race([createPromise, timeoutPromise]) as any
      
      console.log('📝 Resultado:', result)

      if (result.success) {
        notifySuccess({ 
          title: '✅ Éxito', 
          message: `Pregunta creada con código: ${result.data.code}` 
        })
        resetForm()
        setIsCreateDialogOpen(false)
        loadQuestions()
        loadStats()
      } else {
        notifyError({ 
          title: '❌ Error', 
          message: `Error: ${result.error?.message || 'Error desconocido'}` 
        })
      }
    } catch (error) {
      console.error('❌ Error creando pregunta:', error)
      let errorMessage = 'Error creando pregunta'
      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          errorMessage = 'La operación tardó demasiado. Verifique su conexión.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      notifyError({ 
        title: '❌ Error', 
        message: errorMessage 
      })
    } finally {
      setIsLoading(false)
      console.log('🏁 Proceso finalizado')
    }
  }

  const handleCreateTestQuestion = async () => {
    try {
      if (!currentUser) {
        notifyError({ 
          title: 'Error', 
          message: 'Usuario no autenticado' 
        })
        return
      }

      if (currentUser.role !== 'admin') {
        notifyError({ 
          title: 'Error', 
          message: 'No tienes permisos para crear preguntas' 
        })
        return
      }

      setIsLoading(true)
      console.log('🧪 Creando pregunta de prueba...')

      notifySuccess({ 
        title: 'Prueba', 
        message: 'Creando pregunta de prueba sin imágenes...' 
      })

      // Datos de prueba simples
      const testQuestionData = {
        subject: 'Matemáticas',
        subjectCode: 'MA',
        topic: 'Álgebra',
        topicCode: 'AL',
        grade: '6' as const,
        level: 'Fácil' as const,
        levelCode: 'F' as const,
        informativeText: 'Esta es una pregunta de prueba para verificar que el sistema funciona correctamente.',
        questionText: '¿Cuál es el resultado de 2 + 2? (Pregunta de prueba)',
        answerType: 'MCQ' as const,
        options: [
          { id: 'A' as const, text: '3', imageUrl: null, isCorrect: false },
          { id: 'B' as const, text: '4', imageUrl: null, isCorrect: true },
          { id: 'C' as const, text: '5', imageUrl: null, isCorrect: false },
          { id: 'D' as const, text: '6', imageUrl: null, isCorrect: false },
        ]
      }

      console.log('🧪 Datos de prueba:', testQuestionData)
      
      // Agregar timeout para evitar que se cuelgue
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La operación tardó demasiado')), 15000) // 15 segundos
      })
      
      const createPromise = questionService.createQuestion(testQuestionData, currentUser.uid)
      
      const result = await Promise.race([createPromise, timeoutPromise]) as any
      
      console.log('🧪 Resultado:', result)

      if (result.success) {
        notifySuccess({ 
          title: '✅ Éxito', 
          message: `Pregunta de prueba creada con código: ${result.data.code}` 
        })
        loadQuestions()
        loadStats()
      } else {
        notifyError({ 
          title: '❌ Error en prueba', 
          message: `Error: ${result.error?.message || 'Error desconocido'}` 
        })
      }
    } catch (error) {
      console.error('❌ Error en prueba:', error)
      let errorMessage = 'Error en prueba'
      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          errorMessage = 'La prueba tardó demasiado. Verifique la conexión.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      notifyError({ 
        title: '❌ Error en prueba', 
        message: errorMessage 
      })
    } finally {
      setIsLoading(false)
      console.log('🏁 Prueba finalizada')
    }
  }

  const availableTopics = formData.subjectCode 
    ? getSubjectByCode(formData.subjectCode)?.topics || []
    : []

  const filterAvailableTopics = filterSubject !== 'all'
    ? getSubjectByCode(filterSubject)?.topics || []
    : []

  // Función para organizar preguntas en jerarquía
  const organizeQuestionsHierarchy = (questions: Question[]) => {
    const hierarchy: Record<string, Record<string, Record<string, Record<string, Question[]>>>> = {}
    
    questions.forEach(question => {
      const subjectCode = question.subjectCode
      const topicCode = question.topicCode
      const grade = question.grade
      const level = question.level
      
      if (!hierarchy[subjectCode]) {
        hierarchy[subjectCode] = {}
      }
      if (!hierarchy[subjectCode][topicCode]) {
        hierarchy[subjectCode][topicCode] = {}
      }
      if (!hierarchy[subjectCode][topicCode][grade]) {
        hierarchy[subjectCode][topicCode][grade] = {}
      }
      if (!hierarchy[subjectCode][topicCode][grade][level]) {
        hierarchy[subjectCode][topicCode][grade][level] = []
      }
      
      hierarchy[subjectCode][topicCode][grade][level].push(question)
    })
    
    return hierarchy
  }

  const toggleNode = (nodeId: string, open?: boolean) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev)
      if (open !== undefined) {
        if (open) {
          newExpanded.add(nodeId)
        } else {
          newExpanded.delete(nodeId)
        }
      } else {
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId)
        } else {
          newExpanded.add(nodeId)
        }
      }
      return newExpanded
    })
  }

  const toggleAllNodes = (expand: boolean) => {
    if (expand) {
      const allNodes = new Set<string>()
      filteredQuestions.forEach(q => {
        allNodes.add(`subject-${q.subjectCode}`)
        allNodes.add(`subject-${q.subjectCode}-topic-${q.topicCode}`)
        allNodes.add(`subject-${q.subjectCode}-topic-${q.topicCode}-grade-${q.grade}`)
        allNodes.add(`subject-${q.subjectCode}-topic-${q.topicCode}-grade-${q.grade}-level-${q.level}`)
      })
      setExpandedNodes(allNodes)
    } else {
      setExpandedNodes(new Set())
    }
  }

  const hierarchy = organizeQuestionsHierarchy(filteredQuestions)

  // Componente para renderizar una pregunta
  const renderQuestion = (question: Question) => (
    <div 
      key={question.id} 
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-colors ml-8',
        theme === 'dark' 
          ? 'border-zinc-700 hover:bg-zinc-800' 
          : 'border-gray-200 hover:bg-gray-50'
      )}
      onClick={() => handleViewQuestion(question)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono text-xs">
              {question.code}
            </Badge>
          </div>
          <p className={cn('text-sm mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {stripHtmlTags(question.questionText).substring(0, 100)}
            {stripHtmlTags(question.questionText).length > 100 && '...'}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditQuestion(question); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(question); }}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Componente para renderizar el árbol jerárquico
  const renderTreeView = () => {
    if (filteredQuestions.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            No se encontraron preguntas
          </h3>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {Object.entries(hierarchy).map(([subjectCode, topics]) => {
          const subject = getSubjectByCode(subjectCode)
          const subjectNodeId = `subject-${subjectCode}`
          const isSubjectExpanded = expandedNodes.has(subjectNodeId)
          
          return (
            <Collapsible
              key={subjectCode}
              open={isSubjectExpanded}
              onOpenChange={(open) => toggleNode(subjectNodeId, open)}
            >
              <div className={cn(
                'border rounded-lg',
                theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
              )}>
                <CollapsibleTrigger className={cn(
                  'w-full flex items-center gap-2 p-3 hover:bg-opacity-50 transition-colors',
                  theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                )}>
                  {isSubjectExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    {subject?.name}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {Object.values(topics).flatMap(t => 
                      Object.values(t).flatMap(g => 
                        Object.values(g).flat().length
                      )
                    ).reduce((a, b) => a + b, 0)} preguntas
                  </Badge>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="pl-4 space-y-2">
                    {Object.entries(topics).map(([topicCode, grades]) => {
                      const topic = subject?.topics.find(t => t.code === topicCode)
                      const topicNodeId = `${subjectNodeId}-topic-${topicCode}`
                      const isTopicExpanded = expandedNodes.has(topicNodeId)
                      
                      return (
                        <Collapsible
                          key={topicCode}
                          open={isTopicExpanded}
                          onOpenChange={(open) => toggleNode(topicNodeId, open)}
                        >
                          <div className={cn(
                            'border rounded-lg ml-4',
                            theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                          )}>
                            <CollapsibleTrigger className={cn(
                              'w-full flex items-center gap-2 p-2 hover:bg-opacity-50 transition-colors',
                              theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                            )}>
                              {isTopicExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium flex items-center gap-2">
                                <FolderOpen className="h-4 w-4 text-orange-500" />
                                {topic?.name}
                              </span>
                              <Badge variant="secondary" className="ml-auto">
                                {Object.values(grades).flatMap(g => 
                                  Object.values(g).flat().length
                                ).reduce((a, b) => a + b, 0)} preguntas
                              </Badge>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="pl-4 space-y-2">
                                {Object.entries(grades).map(([grade, levels]) => {
                                  const gradeName = GRADE_CODE_TO_NAME[grade]
                                  const gradeNodeId = `${topicNodeId}-grade-${grade}`
                                  const isGradeExpanded = expandedNodes.has(gradeNodeId)
                                  
                                  return (
                                    <Collapsible
                                      key={grade}
                                      open={isGradeExpanded}
                                      onOpenChange={(open) => toggleNode(gradeNodeId, open)}
                                    >
                                      <div className={cn(
                                        'border rounded-lg ml-4',
                                        theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                                      )}>
                                        <CollapsibleTrigger className={cn(
                                          'w-full flex items-center gap-2 p-2 hover:bg-opacity-50 transition-colors',
                                          theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                                        )}>
                                          {isGradeExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                          <span className="text-sm flex items-center gap-2">
                                            <GraduationCap className="h-4 w-4 text-purple-500" />
                                            {gradeName}
                                          </span>
                                          <Badge variant="secondary" className="ml-auto">
                                            {Object.values(levels).flat().length} preguntas
                                          </Badge>
                                        </CollapsibleTrigger>
                                        
                                        <CollapsibleContent>
                                          <div className="pl-4 space-y-2">
                                            {Object.entries(levels).map(([level, questions]) => {
                                              const levelNodeId = `${gradeNodeId}-level-${level}`
                                              const isLevelExpanded = expandedNodes.has(levelNodeId)
                                              
                                              return (
                                                <Collapsible
                                                  key={level}
                                                  open={isLevelExpanded}
                                                  onOpenChange={(open) => toggleNode(levelNodeId, open)}
                                                >
                                                  <div className={cn(
                                                    'border rounded-lg ml-4',
                                                    theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                                                  )}>
                                                    <CollapsibleTrigger className={cn(
                                                      'w-full flex items-center gap-2 p-2 hover:bg-opacity-50 transition-colors',
                                                      theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                                                    )}>
                                                      {isLevelExpanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                      ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                      )}
                                                      <TrendingUp className={cn(
                                                        "h-4 w-4",
                                                        level === 'Fácil' ? 'text-green-500' : 
                                                        level === 'Medio' ? 'text-yellow-500' : 
                                                        'text-red-500'
                                                      )} />
                                                      <Badge 
                                                        variant={
                                                          level === 'Fácil' ? 'default' : 
                                                          level === 'Medio' ? 'secondary' : 
                                                          'destructive'
                                                        }
                                                        className="text-xs"
                                                      >
                                                        {level}
                                                      </Badge>
                                                      <Badge variant="secondary" className="ml-auto">
                                                        {questions.length} preguntas
                                                      </Badge>
                                                    </CollapsibleTrigger>
                                                    
                                                    <CollapsibleContent>
                                                      <div className="pl-4 space-y-2 pb-2">
                                                        {questions.map(renderQuestion)}
                                                      </div>
                                                    </CollapsibleContent>
                                                  </div>
                                                </Collapsible>
                                              )
                                            })}
                                          </div>
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  )
                                })}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <BookOpen className="h-6 w-6" />
            Banco de Preguntas
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Gestiona el banco de preguntas del sistema educativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Debug info */}
          <div className={cn('text-xs p-2 rounded', theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700')}>
            {currentUser ? (
              <div>
                <div>Usuario: {currentUser.email}</div>
                <div>Rol: {currentUser.role || 'Sin rol'}</div>
                <div>UID: {currentUser.uid}</div>
              </div>
            ) : (
              <div>No autenticado</div>
            )}
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-black text-white hover:bg-gray-800"
                disabled={!currentUser || currentUser.role !== 'admin'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Pregunta
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Total Preguntas
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {stats.total}
              </div>
            </CardContent>
          </Card>

          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Por Materia
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.bySubject).slice(0, 3).map(([subject, count]) => (
                  <div key={subject} className="flex justify-between text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>{subject}</span>
                    <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Por Nivel
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.byLevel).map(([level, count]) => (
                  <div key={level} className="flex justify-between text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>{level}</span>
                    <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Por Grado
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.byGrade).slice(0, 3).map(([grade, count]) => (
                  <div key={grade} className="flex justify-between text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {GRADE_CODE_TO_NAME[grade] || grade}
                    </span>
                    <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar preguntas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn("pl-10", theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
              />
            </div>

            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                <SelectValue placeholder="Todas las materias" />
              </SelectTrigger>
              <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <SelectItem value="all">Todas las materias</SelectItem>
                {SUBJECTS_CONFIG.map(subject => (
                  <SelectItem key={subject.code} value={subject.code}>
                    {subject.icon} {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTopic} onValueChange={setFilterTopic} disabled={filterSubject === 'all'}>
              <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                <SelectValue placeholder="Todos los temas" />
              </SelectTrigger>
              <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <SelectItem value="all">Todos los temas</SelectItem>
                {filterAvailableTopics.map(topic => (
                  <SelectItem key={topic.code} value={topic.code}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                <SelectValue placeholder="Todos los grados" />
              </SelectTrigger>
              <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <SelectItem value="all">Todos los grados</SelectItem>
                {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                <SelectValue placeholder="Todos los niveles" />
              </SelectTrigger>
              <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <SelectItem value="all">Todos los niveles</SelectItem>
                {DIFFICULTY_LEVELS.map(level => (
                  <SelectItem key={level.code} value={level.code}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterSubject('all')
                setFilterTopic('all')
                setFilterGrade('all')
                setFilterLevel('all')
                setSearchTerm('')
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadQuestions}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Actualizar
            </Button>
            <span className={cn('text-sm ml-auto', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {filteredQuestions.length} pregunta{filteredQuestions.length !== 1 ? 's' : ''} encontrada{filteredQuestions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de preguntas */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Preguntas ({filteredQuestions.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                Lista
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tree')}
              >
                <FolderTree className="h-4 w-4 mr-2" />
                Árbol
              </Button>
              {viewMode === 'tree' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllNodes(true)}
                  >
                    Expandir Todo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAllNodes(false)}
                  >
                    Colapsar Todo
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {viewMode === 'tree' ? (
              renderTreeView()
            ) : (
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    No se encontraron preguntas
                  </h3>
                  <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {questions.length === 0 
                      ? 'Comienza creando tu primera pregunta' 
                      : 'Intenta cambiar los filtros de búsqueda'}
                  </p>
                  {questions.length === 0 && (
                    <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-black text-white hover:bg-gray-800">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Primera Pregunta
                    </Button>
                  )}
                </div>
              ) : (() => {
                // Agrupar preguntas relacionadas (Cloze Test y Comprensión de Lectura)
                const groupedQuestions: { [key: string]: Question[] } = {}
                const ungroupedQuestions: Question[] = []
                const processedIds = new Set<string>()
                
                filteredQuestions.forEach(question => {
                  // Verificar si ya fue procesada en un grupo
                  if (processedIds.has(question.id || '')) return
                  
                  // Para preguntas de Inglés con informativeText, buscar preguntas relacionadas
                  if (question.subjectCode === 'IN' && question.informativeText && 
                      (question.questionText?.includes('completar el hueco') || 
                       questions.some(q => q.informativeText === question.informativeText && q.id !== question.id))) {
                    const groupKey = `${question.informativeText}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`
                    
                    if (!groupedQuestions[groupKey]) {
                      groupedQuestions[groupKey] = []
                    }
                    
                    // Buscar todas las preguntas relacionadas
                    const related = filteredQuestions.filter(q => 
                      q.subjectCode === 'IN' &&
                      q.informativeText === question.informativeText &&
                      JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
                      q.topicCode === question.topicCode &&
                      q.grade === question.grade &&
                      q.levelCode === question.levelCode &&
                      !processedIds.has(q.id || '')
                    )
                    
                    related.forEach(q => {
                      groupedQuestions[groupKey].push(q)
                      processedIds.add(q.id || '')
                    })
                  } else {
                    ungroupedQuestions.push(question)
                    processedIds.add(question.id || '')
                  }
                })
                
                // Renderizar grupos y preguntas individuales
                return (
                  <>
                    {/* Grupos de preguntas */}
                    {Object.entries(groupedQuestions).map(([groupKey, groupQuestions]) => {
                      const isClozeTest = groupQuestions.some(q => q.questionText?.includes('completar el hueco'))
                      const firstQuestion = groupQuestions[0]
                      
                      return (
                        <div 
                          key={groupKey}
                          className={cn(
                            'rounded-lg border-2 overflow-hidden',
                            theme === 'dark'
                              ? 'border-purple-700 bg-purple-950/30'
                              : 'border-purple-300 bg-purple-50/50'
                          )}
                        >
                          {/* Header del grupo */}
                          <div className={cn(
                            'px-4 py-2 flex items-center justify-between',
                            theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
                          )}>
                            <div className="flex items-center gap-2">
                              <BookOpen className={cn('h-4 w-4', theme === 'dark' ? 'text-purple-300' : 'text-purple-600')} />
                              <span className={cn('font-semibold text-sm', theme === 'dark' ? 'text-purple-200' : 'text-purple-700')}>
                                {isClozeTest ? 'Cloze Test / Rellenar Huecos' : 'Comprensión de Lectura'} - {groupQuestions.length} pregunta{groupQuestions.length > 1 ? 's' : ''} agrupada{groupQuestions.length > 1 ? 's' : ''}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {firstQuestion.topic} • {GRADE_CODE_TO_NAME[firstQuestion.grade]} • {firstQuestion.level}
                              </Badge>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewQuestion(firstQuestion)}
                              className="text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver todas
                            </Button>
                          </div>
                          
                          {/* Preguntas del grupo */}
                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {groupQuestions.sort((a, b) => {
                              // Ordenar por código o por número de hueco si es cloze test
                              const aMatch = a.questionText?.match(/hueco \[(\d+)\]/)
                              const bMatch = b.questionText?.match(/hueco \[(\d+)\]/)
                              if (aMatch && bMatch) {
                                return parseInt(aMatch[1]) - parseInt(bMatch[1])
                              }
                              return a.code.localeCompare(b.code)
                            }).map((question) => (
                              <div
                                key={question.id}
                                className={cn(
                                  'p-4 cursor-pointer transition-colors',
                                  theme === 'dark'
                                    ? 'hover:bg-zinc-800'
                                    : 'hover:bg-gray-50'
                                )}
                                onClick={() => handleViewQuestion(question)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {question.code}
                                      </Badge>
                                      {isClozeTest && question.questionText?.match(/hueco \[(\d+)\]/) && (
                                        <Badge variant="secondary" className="text-xs">
                                          Pregunta {question.questionText.match(/hueco \[(\d+)\]/)?.[1]}
                                        </Badge>
                                      )}
                                      <Badge variant="secondary">
                                        {question.options.length} opciones
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {new Date(question.createdAt).toLocaleDateString('es-ES')}
                                      </span>
                                    </div>
                                    <p className={cn('text-sm mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                      {stripHtmlTags(question.questionText || '').substring(0, 100)}
                                      {stripHtmlTags(question.questionText || '').length > 100 && '...'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditQuestion(question); }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(question); }}>
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Preguntas individuales */}
                    {ungroupedQuestions.map((question) => (
                      <div 
                        key={question.id} 
                        className={cn(
                          'p-4 rounded-lg border cursor-pointer transition-colors',
                          theme === 'dark' 
                            ? 'border-zinc-700 hover:bg-zinc-800' 
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                        onClick={() => handleViewQuestion(question)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {question.code}
                              </Badge>
                              <Badge variant="secondary">
                                {question.subject}
                              </Badge>
                              <Badge variant="secondary">
                                {question.topic}
                              </Badge>
                              <Badge variant="secondary">
                                {GRADE_CODE_TO_NAME[question.grade]}
                              </Badge>
                              <Badge 
                                variant={
                                  question.level === 'Fácil' ? 'default' : 
                                  question.level === 'Medio' ? 'secondary' : 
                                  'destructive'
                                }
                              >
                                {question.level}
                              </Badge>
                            </div>
                            <p className={cn('font-medium mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {stripHtmlTags(question.questionText).substring(0, 120)}
                              {stripHtmlTags(question.questionText).length > 120 && '...'}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>{question.options.length} opciones</span>
                              {(question.questionImages && question.questionImages.length > 0) && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  {question.questionImages.length} imagen{question.questionImages.length > 1 ? 'es' : ''}
                                </span>
                              )}
                              {(question.informativeImages && question.informativeImages.length > 0) && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  {question.informativeImages.length} info
                                </span>
                              )}
                              {question.options.some(opt => opt.imageUrl) && (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  opciones con imagen
                                </span>
                              )}
                              <span>
                                {new Date(question.createdAt).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditQuestion(question); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(question); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )
              })()}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog para crear pregunta - continuará en la siguiente parte... */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Crear Nueva Pregunta</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Complete todos los campos para crear una nueva pregunta en el banco
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject" className={cn(fieldErrors['subject'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['subject'] ? 'text-gray-300' : '')}>
                  Materia *
                  {fieldErrors['subject'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                </Label>
                <Select 
                  value={formData.subjectCode} 
                  onValueChange={(value) => {
                    handleSubjectChange(value)
                    if (fieldErrors['subject']) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors['subject']
                        return newErrors
                      })
                    }
                  }}
                >
                  <SelectTrigger className={cn(fieldErrors['subject'] ? 'border-red-500 border-2' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {SUBJECTS_CONFIG.map(subject => (
                      <SelectItem key={subject.code} value={subject.code}>
                        {subject.icon} {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic" className={cn(fieldErrors['topic'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['topic'] ? 'text-gray-300' : '')}>
                  Tema *
                  {fieldErrors['topic'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                </Label>
                <Select 
                  value={formData.topicCode} 
                  onValueChange={(value) => {
                    handleTopicChange(value)
                    if (fieldErrors['topic']) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors['topic']
                        return newErrors
                      })
                    }
                  }}
                  disabled={!formData.subjectCode}
                >
                  <SelectTrigger className={cn(fieldErrors['topic'] ? 'border-red-500 border-2' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {availableTopics.map(topic => (
                      <SelectItem key={topic.code} value={topic.code}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado *</Label>
                <Select value={formData.grade} onValueChange={(value: any) => setFormData({...formData, grade: value})}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nivel de Dificultad *</Label>
                <Select value={formData.level} onValueChange={(value: any) => handleLevelChange(value)}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {DIFFICULTY_LEVELS.map(level => (
                      <SelectItem key={level.code} value={level.name}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campo de Modalidad de Inglés - Solo visible cuando materia es Inglés */}
            {formData.subjectCode === 'IN' && (
              <div className="space-y-2">
                <Label htmlFor="modalidad_ingles" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Modalidad de Pregunta Específica *</Label>
                <Select value={inglesModality} onValueChange={(value: any) => setInglesModality(value)}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar modalidad" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectItem value="standard_mc">Opción Múltiple Estándar</SelectItem>
                    <SelectItem value="matching_columns">Matching / Columnas</SelectItem>
                    <SelectItem value="cloze_test">Cloze Test / Rellenar Huecos</SelectItem>
                    <SelectItem value="reading_comprehension">Comprensión de Lectura Corta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Texto informativo (opcional) - Oculto para Inglés modalidad Comprensión de Lectura */}
            {!(formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') && (
              <div className="space-y-2">
                <Label htmlFor="informativeText" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Texto Informativo (opcional)</Label>
                <RichTextEditor
                  ref={informativeTextEditorRef}
                  value={formData.informativeText}
                  onChange={(html) => setFormData({ ...formData, informativeText: html })}
                  placeholder="Información adicional o contexto para la pregunta..."
                  theme={theme}
                />
              </div>
            )}

            {/* Imágenes informativas - Oculto para Inglés modalidad Comprensión de Lectura */}
            {!(formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') && (
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imágenes Informativas (opcional, máx. 5)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleInformativeImageUpload}
                    className="hidden"
                    id="informative-images"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('informative-images')?.click()}
                    disabled={informativeImages.length >= 5}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Imágenes
                  </Button>
                </div>
                {informativeImagePreviews.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {informativeImagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img src={preview} alt={`Preview ${index}`} className="w-full h-20 object-cover rounded" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0 h-6 w-6 p-0"
                          onClick={() => removeInformativeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pregunta - Lógica condicional según modalidad de Inglés */}
            {formData.subjectCode === 'IN' && inglesModality === 'matching_columns' ? (
              /* Modalidad: Matching / Columnas (nueva estructura por bloques) */
              <>
                  <div className="space-y-2">
                  <Label className={cn(fieldErrors['matchingQuestions'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['matchingQuestions'] ? 'text-gray-300' : '')}>
                    Preguntas de Matching / Columnas *
                    {fieldErrors['matchingQuestions'] && <span className="ml-2 text-red-600">⚠️ Debe agregar al menos una pregunta</span>}
                    </Label>
                  {matchingQuestions.map((mq, mqIndex) => {
                    const hasTextError = fieldErrors[`matchingQuestionText_${mqIndex}`]
                    const hasOptionsError = fieldErrors[`matchingQuestionOptions_${mqIndex}`]
                    const hasAnswerError = fieldErrors[`matchingQuestionAnswer_${mqIndex}`]
                    const hasAnyError = hasTextError || hasOptionsError || hasAnswerError
                    
                    return (
                      <div key={mq.id} className={cn(`border-2 rounded-lg p-4 space-y-3`, hasAnyError ? 'border-red-500 bg-red-50' : theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-200')}>
                        <div className="flex items-center justify-between">
                          <Label className={cn(hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                            Pregunta {mqIndex + 1}
                            {hasAnyError && <span className="ml-2 text-red-600 text-xs">⚠️ Campos incompletos</span>}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setMatchingQuestions(matchingQuestions.filter((_, i) => i !== mqIndex))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <RichTextEditor
                            value={mq.questionText}
                            onChange={(html) => {
                              const updated = [...matchingQuestions]
                              updated[mqIndex].questionText = html
                              setMatchingQuestions(updated)
                              // Limpiar error cuando el usuario empiece a escribir
                              if (fieldErrors[`matchingQuestionText_${mqIndex}`]) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                                  delete newErrors[`matchingQuestionText_${mqIndex}`]
                            return newErrors
                          })
                        }
                      }}
                            placeholder="Escribe la pregunta aquí..."
                            theme={theme}
                    />
                  </div>
                  <div className="space-y-2">
                          <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                            Opciones de Respuesta (A-H, máximo 6 opciones) *
                            {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                    </Label>
                          {mq.options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`matching-q-${mq.id}`}
                                checked={opt.isCorrect}
                                onChange={() => {
                                  const updated = [...matchingQuestions]
                                  updated[mqIndex].options = updated[mqIndex].options.map(o => ({
                                    ...o,
                                    isCorrect: o.id === opt.id
                                  }))
                                  setMatchingQuestions(updated)
                                  // Limpiar error cuando se selecciona una respuesta
                                  if (fieldErrors[`matchingQuestionAnswer_${mqIndex}`]) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`matchingQuestionAnswer_${mqIndex}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{opt.id}:</Label>
                              <Input
                                value={opt.text || ''}
                      onChange={(e) => {
                                  const updated = [...matchingQuestions]
                                  updated[mqIndex].options = updated[mqIndex].options.map(o =>
                                    o.id === opt.id ? { ...o, text: e.target.value } : o
                                  )
                                  setMatchingQuestions(updated)
                                  // Limpiar error cuando el usuario empiece a escribir
                                  if (fieldErrors[`matchingQuestionOptions_${mqIndex}`]) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                                      delete newErrors[`matchingQuestionOptions_${mqIndex}`]
                            return newErrors
                          })
                        }
                      }}
                                placeholder={`Opción ${opt.id}`}
                                className={cn(`flex-1`, hasOptionsError && !opt.text?.trim() ? 'border-red-500' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                    />
                  </div>
                          ))}
                </div>
                        {hasAnswerError && (
                          <p className="text-xs text-red-600">⚠️ Debe marcar exactamente una opción como correcta</p>
                        )}
                          </div>
                        )
                      })}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => {
                      const newId = `mq${matchingQuestions.length + 1}`
                      // Crear opciones A-H (máximo 6 opciones)
                      const optionLetters: ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H')[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, 6) as ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H')[]
                      setMatchingQuestions([
                        ...matchingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          options: optionLetters.map((letter): QuestionOption => ({
                            id: letter as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H',
                            text: '',
                            imageUrl: null,
                            isCorrect: false
                          }))
                        }
                      ])
                      // Limpiar error cuando se agrega una pregunta
                      if (fieldErrors['matchingQuestions']) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors['matchingQuestions']
                          return newErrors
                        })
                      }
                      // Hacer scroll al nuevo botón después de un pequeño delay para que se renderice
                      setTimeout(() => {
                        const button = document.getElementById('add-matching-question-btn')
                        if (button) {
                          button.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        }
                      }, 100)
                    }}
                    id="add-matching-question-btn"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Pregunta de Matching
                  </Button>
                    </div>
              </>
            ) : formData.subjectCode === 'IN' && inglesModality === 'cloze_test' ? (
              /* Modalidad: Cloze Test - Mejorada para texto largo y 3 opciones por hueco */
              <>
                <div className="space-y-2">
                  <Label htmlFor="clozeText" className={cn(fieldErrors['clozeText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['clozeText'] ? 'text-gray-300' : '')}>
                    Texto a Completar (Usar [#] para el hueco) *
                    {fieldErrors['clozeText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(fieldErrors['clozeText'] ? 'border-2 border-red-500 rounded-md p-2' : '', theme === 'dark' && !fieldErrors['clozeText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      value={clozeText}
                      onChange={(html) => {
                        setClozeText(html)
                        // Extraer texto plano para detectar marcadores
                        // Primero intentar extraer del HTML de forma más robusta
                        const tempDiv = document.createElement('div')
                        tempDiv.innerHTML = html
                        const text = tempDiv.textContent || tempDiv.innerText || ''
                        // También buscar en el HTML directamente en caso de que los corchetes estén escapados
                        const htmlMatches = html.match(/\[(\d+)\]/g) || []
                        // Combinar ambas detecciones
                        const textMatches = text.match(/\[(\d+)\]/g) || []
                        const allMatches = [...new Set([...htmlMatches, ...textMatches])]
                        
                        const gaps = new Set<number>()
                        allMatches.forEach(match => {
                          const num = parseInt(match.replace(/[\[\]]/g, ''))
                          if (!isNaN(num)) {
                            gaps.add(num)
                          }
                        })
                        
                        // Inicializar huecos que no existen (3 opciones por defecto)
                        const newGaps = { ...clozeGaps }
                        gaps.forEach(gapNum => {
                          if (!newGaps[gapNum]) {
                            newGaps[gapNum] = { options: ['', '', ''], correctAnswer: '' }
                          }
                        })
                        // Limpiar huecos que ya no existen
                        Object.keys(newGaps).forEach(key => {
                          const num = parseInt(key)
                          if (!gaps.has(num)) {
                            delete newGaps[num]
                          }
                        })
                        setClozeGaps(newGaps)
                        
                        // Si se detectaron nuevos huecos, hacer scroll a la sección de opciones
                        if (gaps.size > 0 && Object.keys(newGaps).length > Object.keys(clozeGaps).length) {
                          setTimeout(() => {
                            const optionsSection = document.getElementById('cloze-options-section')
                            if (optionsSection) {
                              optionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }
                          }, 100)
                        }
                        
                        // Limpiar error cuando el usuario empiece a escribir
                        if (fieldErrors['clozeText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['clozeText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Escribe el texto con [#] para marcar los huecos..."
                      theme={theme}
                    />
                  </div>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usa [1], [2], [3], etc. para marcar los huecos. Cada hueco tendrá 3 opciones de respuesta.</p>
                  {Object.keys(clozeGaps).length > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      ✓ Se detectaron {Object.keys(clozeGaps).length} hueco(s). Abajo podrás agregar las opciones de respuesta.
                    </p>
                  )}
                </div>
                {/* Opciones por cada hueco detectado - Solo 3 opciones */}
                {Object.keys(clozeGaps).length > 0 ? (
                  <div id="cloze-options-section" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className={cn("text-base font-semibold", theme === 'dark' ? 'text-gray-300' : '')}>Opciones por Hueco * (3 opciones por hueco)</Label>
                      <Badge variant="outline" className="text-xs">
                        {Object.keys(clozeGaps).length} hueco(s) detectado(s)
                      </Badge>
                    </div>
                    {Object.entries(clozeGaps).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([gapNum, gapData]) => {
                      const hasGapError = fieldErrors[`clozeGap_${gapNum}`]
                      const hasOptionsError = fieldErrors[`clozeGapOptions_${gapNum}`]
                      const hasAnswerError = fieldErrors[`clozeGapAnswer_${gapNum}`]
                      const hasAnyError = hasGapError || hasOptionsError || hasAnswerError
                      return (
                      <div key={gapNum} className={cn(`border rounded-lg p-4 space-y-3`, hasAnyError ? 'border-red-500 bg-red-50' : theme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-gray-50')}>
                        <Label className={cn(`font-semibold text-lg`, hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                          Pregunta {gapNum} *
                          {hasOptionsError && <span className="ml-2 text-red-600 text-sm">⚠️ Complete las 3 opciones</span>}
                          {hasAnswerError && <span className="ml-2 text-red-600 text-sm">⚠️ Seleccione la respuesta correcta</span>}
                        </Label>
                        <div className="space-y-3">
                          {['A', 'B', 'C'].map((letter, optIndex) => {
                            const isEmpty = !gapData.options[optIndex] || !gapData.options[optIndex].trim()
                            const hasOptionError = hasOptionsError && isEmpty
                            return (
                            <div key={letter} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`cloze-gap-${gapNum}`}
                                checked={gapData.correctAnswer === letter}
                                onChange={() => {
                                  setClozeGaps({
                                    ...clozeGaps,
                                    [gapNum]: { ...gapData, correctAnswer: letter }
                                  })
                                  if (fieldErrors[`clozeGapAnswer_${gapNum}`]) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`clozeGapAnswer_${gapNum}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{letter}:</Label>
                              <Input
                                value={gapData.options[optIndex] || ''}
                                onChange={(e) => {
                                  const newOptions = [...gapData.options]
                                  newOptions[optIndex] = e.target.value
                                  setClozeGaps({
                                    ...clozeGaps,
                                    [gapNum]: { ...gapData, options: newOptions }
                                  })
                                  // Limpiar error cuando el usuario empiece a escribir
                                  if (fieldErrors[`clozeGapOptions_${gapNum}`] && newOptions.every(opt => opt && opt.trim())) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`clozeGapOptions_${gapNum}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                placeholder={`Opción ${letter}`}
                                className={cn(`flex-1`, hasOptionError ? 'border-red-500 border-2' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                              />
                            </div>
                            )
                          })}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className={cn("p-4 border-2 border-dashed rounded-lg text-center", theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-gray-50')}>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      No se detectaron huecos aún. Escribe el texto y usa marcadores como <code className={cn("px-1 py-0.5 rounded text-xs", theme === 'dark' ? 'bg-zinc-600 text-gray-300' : 'bg-white')}>[1]</code>, <code className={cn("px-1 py-0.5 rounded text-xs", theme === 'dark' ? 'bg-zinc-600 text-gray-300' : 'bg-white')}>[2]</code>, etc. para marcar los huecos.
                    </p>
                  </div>
                )}
              </>
            ) : formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension' ? (
              /* Modalidad: Comprensión de Lectura */
              <>
                <div className="space-y-2">
                  <Label htmlFor="readingText" className={cn(fieldErrors['readingText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['readingText'] ? 'text-gray-300' : '')}>
                    Texto de Lectura / Aviso / Cartel *
                    {fieldErrors['readingText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(fieldErrors['readingText'] ? 'border-2 border-red-500 rounded-md' : '', theme === 'dark' && !fieldErrors['readingText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      value={readingText}
                      onChange={(html) => {
                        setReadingText(html)
                        // Limpiar error cuando el usuario empiece a escribir
                        if (fieldErrors['readingText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['readingText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Ingresa el texto base para la comprensión de lectura..."
                      theme={theme}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imagen Informativa (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setReadingImage(file)
                          const reader = new FileReader()
                          reader.onloadend = () => setReadingImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                      id="reading-image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('reading-image')?.click()}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir Imagen
                    </Button>
                  </div>
                  {readingImagePreview && (
                    <div className="relative w-full max-w-md">
                      <img src={readingImagePreview} alt="Reading" className="w-full h-auto rounded" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-0 right-0"
                        onClick={() => {
                          setReadingImage(null)
                          setReadingImagePreview(null)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={cn(fieldErrors['readingQuestions'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['readingQuestions'] ? 'text-gray-300' : '')}>
                    Preguntas Vinculadas *
                    {fieldErrors['readingQuestions'] && <span className="ml-2 text-red-600">⚠️ Debe agregar al menos una pregunta</span>}
                  </Label>
                  {readingQuestions.map((rq, rqIndex) => {
                    const hasOptionsError = fieldErrors[`readingQuestionOptions_${rqIndex}`]
                    const hasAnswerError = fieldErrors[`readingQuestionAnswer_${rqIndex}`]
                    const hasAnyError = hasOptionsError || hasAnswerError
                    
                    return (
                      <div key={rq.id} className={cn(`border-2 rounded-lg p-4 space-y-3`, hasAnyError ? 'border-red-500 bg-red-50' : theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-200')}>
                        <div className="flex items-center justify-between">
                          <Label className={cn(hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                            Pregunta {rqIndex + 1}
                            {hasAnyError && <span className="ml-2 text-red-600 text-xs">⚠️ Campos incompletos</span>}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReadingQuestions(readingQuestions.filter((_, i) => i !== rqIndex))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <RichTextEditor
                            value={rq.questionText}
                            onChange={(html) => {
                              const updated = [...readingQuestions]
                              updated[rqIndex].questionText = html
                              setReadingQuestions(updated)
                            }}
                            placeholder="Texto de la pregunta (opcional)..."
                            theme={theme}
                          />
                        </div>
                        {/* Imagen por pregunta (opcional) */}
                        <div className="space-y-2">
                          <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imagen por Pregunta (opcional)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const updated = [...readingQuestions]
                                  updated[rqIndex].questionImage = file
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    const updatedWithPreview = [...readingQuestions]
                                    updatedWithPreview[rqIndex].questionImagePreview = reader.result as string
                                    setReadingQuestions(updatedWithPreview)
                                  }
                                  reader.readAsDataURL(file)
                                  setReadingQuestions(updated)
                                }
                              }}
                              className="hidden"
                              id={`reading-question-image-${rq.id}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`reading-question-image-${rq.id}`)?.click()}
                              className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Subir Imagen
                            </Button>
                          </div>
                          {rq.questionImagePreview && (
                            <div className="relative w-full max-w-md">
                              <img src={rq.questionImagePreview} alt={`Pregunta ${rqIndex + 1}`} className="w-full h-auto rounded" />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-0 right-0"
                                onClick={() => {
                                  const updated = [...readingQuestions]
                                  updated[rqIndex].questionImage = null
                                  updated[rqIndex].questionImagePreview = null
                                  setReadingQuestions(updated)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                            Opciones *
                            {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                          </Label>
                          {rq.options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`reading-q-${rq.id}`}
                                checked={opt.isCorrect}
                                onChange={() => {
                                  const updated = [...readingQuestions]
                                  updated[rqIndex].options = updated[rqIndex].options.map(o => ({
                                    ...o,
                                    isCorrect: o.id === opt.id
                                  }))
                                  setReadingQuestions(updated)
                                  // Limpiar error cuando se selecciona una respuesta
                                  if (fieldErrors[`readingQuestionAnswer_${rqIndex}`]) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`readingQuestionAnswer_${rqIndex}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{opt.id}:</Label>
                              <Input
                                value={opt.text || ''}
                                onChange={(e) => {
                                  const updated = [...readingQuestions]
                                  updated[rqIndex].options = updated[rqIndex].options.map(o =>
                                    o.id === opt.id ? { ...o, text: e.target.value } : o
                                  )
                                  setReadingQuestions(updated)
                                  // Limpiar error cuando el usuario empiece a escribir
                                  if (fieldErrors[`readingQuestionOptions_${rqIndex}`]) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`readingQuestionOptions_${rqIndex}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                placeholder={`Opción ${opt.id}`}
                                className={cn(`flex-1`, hasOptionsError && !opt.text?.trim() ? 'border-red-500' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                              />
                            </div>
                          ))}
                        </div>
                        {hasAnswerError && (
                          <p className="text-xs text-red-600">⚠️ Debe marcar exactamente una opción como correcta</p>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => {
                      const newId = `q${readingQuestions.length + 1}`
                      setReadingQuestions([
                        ...readingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          options: [
                            { id: 'A', text: '', imageUrl: null, isCorrect: false },
                            { id: 'B', text: '', imageUrl: null, isCorrect: false },
                            { id: 'C', text: '', imageUrl: null, isCorrect: false },
                            { id: 'D', text: '', imageUrl: null, isCorrect: false },
                          ]
                        }
                      ])
                      // Limpiar error cuando se agrega una pregunta
                      if (fieldErrors['readingQuestions']) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors['readingQuestions']
                          return newErrors
                        })
                      }
                      // Hacer scroll al nuevo botón después de un pequeño delay para que se renderice
                      setTimeout(() => {
                        const button = document.getElementById('add-reading-question-btn')
                        if (button) {
                          button.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        }
                      }, 100)
                    }}
                    id="add-reading-question-btn"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Pregunta 
                  </Button>
                </div>
              </>
            ) : (
              /* Modalidad: Opción Múltiple Estándar (o materia no es Inglés) */
              <>
                <div className="space-y-2">
                  <Label htmlFor="questionText" className={cn(fieldErrors['questionText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['questionText'] ? 'text-gray-300' : '')}>
                    Texto de la Pregunta *
                    {fieldErrors['questionText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(fieldErrors['questionText'] ? 'border-2 border-red-500 rounded-md p-2' : '', theme === 'dark' && !fieldErrors['questionText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      ref={questionTextEditorRef}
                      value={formData.questionText}
                      onChange={(html) => {
                        setFormData({ ...formData, questionText: html })
                        if (fieldErrors['questionText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['questionText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Escribe la pregunta aquí..."
                      theme={theme}
                    />
                  </div>
                </div>

                {/* Imágenes de la pregunta */}
                <div className="space-y-2">
                  <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imágenes de la Pregunta (opcional, máx. 3)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleQuestionImageUpload}
                      className="hidden"
                      id="question-images"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('question-images')?.click()}
                      disabled={questionImages.length >= 3}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir Imágenes
                    </Button>
                  </div>
                  {questionImagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {questionImagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img src={preview} alt={`Preview ${index}`} className="w-full h-32 object-cover rounded" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-0 right-0 h-6 w-6 p-0"
                            onClick={() => removeQuestionImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opciones de respuesta */}
                <div className="space-y-2">
                  <Label className={cn(fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['options'] && !fieldErrors['correctAnswer'] ? 'text-gray-300' : '')}>
                    Opciones de Respuesta *
                    {fieldErrors['options'] && <span className="ml-2 text-red-600">⚠️ Todas las opciones deben tener contenido</span>}
                    {fieldErrors['correctAnswer'] && <span className="ml-2 text-red-600">⚠️ Debe marcar exactamente una opción como correcta</span>}
                  </Label>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Cada opción debe tener texto o imagen. Marque la opción correcta.
                  </p>
                  <div className={cn(`space-y-3`, fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'border-2 border-red-500 rounded-md p-2' : '')}>
                    {options.map((option) => {
                      const hasError = fieldErrors['options'] && (!option.text && !optionFiles[option.id] && !optionImagePreviews[option.id])
                      return (
                      <div key={option.id} className={cn(`border rounded-lg p-3 space-y-2`, hasError ? 'border-red-500 bg-red-50' : theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : '')}>
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="correctAnswer"
                            checked={option.isCorrect}
                            onChange={() => handleCorrectAnswerChange(option.id)}
                            className="w-4 h-4 mt-2"
                          />
                          <span className={cn("font-medium mt-2", theme === 'dark' ? 'text-gray-300' : '')}>{option.id})</span>
                          <div className="flex-1">
                            <RichTextEditor
                              value={option.text || ''}
                              onChange={(html) => handleOptionTextChange(option.id, html)}
                              placeholder={`Texto de la opción ${option.id}`}
                              className="min-h-[100px]"
                              theme={theme}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => e.target.files && handleOptionImageUpload(option.id, e.target.files[0])}
                              className="hidden"
                              id={`option-${option.id}-image`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`option-${option.id}-image`)?.click()}
                              className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {optionImagePreviews[option.id] && (
                          <div className="relative w-32 h-32">
                            <img 
                              src={optionImagePreviews[option.id]!} 
                              alt={`Opción ${option.id}`} 
                              className="w-full h-full object-cover rounded" 
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-0 right-0 h-6 w-6 p-0"
                              onClick={() => removeOptionImage(option.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateQuestion} 
                disabled={isLoading}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Pregunta
                  </>
                )}
              </Button>
              <Button 
                onClick={handleCreateTestQuestion} 
                disabled={isLoading}
                variant="outline"
              >
                Prueba Rápida
              </Button>
              <Button 
                onClick={() => {
                  // Crear pregunta solo con texto, sin imágenes
                  handleCreateQuestionTextOnly()
                }} 
                disabled={isLoading}
                variant="secondary"
              >
                Solo Texto
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar pregunta */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={cn("max-w-4xl max-h-[90vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Editar Pregunta {selectedQuestion?.code}</DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              Modifica los campos necesarios y guarda los cambios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-subject" className={cn(fieldErrors['subject'] ? 'text-red-600 font-semibold' : '', theme === 'dark' && !fieldErrors['subject'] ? 'text-gray-300' : '')}>
                  Materia *
                  {fieldErrors['subject'] && <span className="ml-2 text-red-600 font-semibold">⚠️ Este campo es obligatorio</span>}
                </Label>
                <Select 
                  value={formData.subjectCode} 
                  onValueChange={(value) => {
                    handleSubjectChange(value)
                    if (fieldErrors['subject']) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors['subject']
                        return newErrors
                      })
                    }
                  }}
                >
                  <SelectTrigger className={cn(fieldErrors['subject'] ? 'border-red-500 border-2 bg-red-50' : '', theme === 'dark' && !fieldErrors['subject'] ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {SUBJECTS_CONFIG.map(subject => (
                      <SelectItem key={subject.code} value={subject.code}>
                        {subject.icon} {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-topic" className={cn(fieldErrors['topic'] ? 'text-red-600 font-semibold' : '', theme === 'dark' && !fieldErrors['topic'] ? 'text-gray-300' : '')}>
                  Tema *
                  {fieldErrors['topic'] && <span className="ml-2 text-red-600 font-semibold">⚠️ Este campo es obligatorio</span>}
                </Label>
                <Select 
                  value={formData.topicCode} 
                  onValueChange={(value) => {
                    handleTopicChange(value)
                    if (fieldErrors['topic']) {
                      setFieldErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors['topic']
                        return newErrors
                      })
                    }
                  }}
                  disabled={!formData.subjectCode}
                >
                  <SelectTrigger className={cn(fieldErrors['topic'] ? 'border-red-500 border-2 bg-red-50' : '', theme === 'dark' && !fieldErrors['topic'] ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {availableTopics.map(topic => (
                      <SelectItem key={topic.code} value={topic.code}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-grade" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado *</Label>
                <Select value={formData.grade} onValueChange={(value: any) => setFormData({...formData, grade: value})}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-level" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Nivel de Dificultad *</Label>
                <Select value={formData.level} onValueChange={(value: any) => handleLevelChange(value)}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    {DIFFICULTY_LEVELS.map(level => (
                      <SelectItem key={level.code} value={level.name}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Formulario de Cloze Test para edición */}
            {isEditingClozeTest ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-clozeText" className={cn(fieldErrors['clozeText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['clozeText'] ? 'text-gray-300' : '')}>
                    Texto a Completar (Usar [#] para el hueco) *
                    {fieldErrors['clozeText'] && (
                      <span className="ml-2 text-red-600 font-semibold">⚠️ Este campo es obligatorio</span>
                    )}
                  </Label>
                  <div className={cn(fieldErrors['clozeText'] ? 'border-2 border-red-500 rounded-md p-2 bg-red-50 shadow-md' : '', theme === 'dark' && !fieldErrors['clozeText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      value={editClozeText}
                      onChange={(html) => {
                        setEditClozeText(html)
                        // Extraer texto plano para detectar marcadores
                        const tempDiv = document.createElement('div')
                        tempDiv.innerHTML = html
                        const text = tempDiv.textContent || tempDiv.innerText || ''
                        const htmlMatches = html.match(/\[(\d+)\]/g) || []
                        const textMatches = text.match(/\[(\d+)\]/g) || []
                        const allMatches = [...new Set([...htmlMatches, ...textMatches])]
                        
                        const gaps = new Set<number>()
                        allMatches.forEach(match => {
                          const num = parseInt(match.replace(/[\[\]]/g, ''))
                          if (!isNaN(num)) {
                            gaps.add(num)
                          }
                        })
                        
                        // Inicializar huecos que no existen (3 opciones por defecto)
                        const updatedGaps = { ...editClozeGaps }
                        gaps.forEach(gapNum => {
                          if (!updatedGaps[gapNum]) {
                            updatedGaps[gapNum] = {
                              options: ['', '', ''],
                              correctAnswer: 'A'
                            }
                          }
                        })
                        
                        // Limpiar huecos que ya no existen
                        Object.keys(updatedGaps).forEach(gapNumStr => {
                          const gapNum = parseInt(gapNumStr)
                          if (!gaps.has(gapNum)) {
                            delete updatedGaps[gapNum]
                          }
                        })
                        
                        setEditClozeGaps(updatedGaps)
                        
                        // Limpiar error cuando el usuario empiece a escribir
                        if (fieldErrors['clozeText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['clozeText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Escribe el texto con [#] para marcar los huecos..."
                      theme={theme}
                    />
                  </div>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usa [1], [2], [3], etc. para marcar los huecos. Cada hueco tendrá 3 opciones de respuesta.</p>
                  {Object.keys(editClozeGaps).length > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      ✓ Se detectaron {Object.keys(editClozeGaps).length} pregunta(s). Abajo podrás editar las opciones de respuesta.
                    </p>
                  )}
                </div>
                
                {/* Opciones por cada hueco detectado - Solo 3 opciones */}
                {Object.keys(editClozeGaps).length > 0 ? (
                  <div id="edit-cloze-options-section" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className={cn("text-base font-semibold", theme === 'dark' ? 'text-gray-300' : '')}>Opciones por Pregunta * (3 opciones por pregunta)</Label>
                      <Badge variant="outline" className="text-xs">
                        {Object.keys(editClozeGaps).length} pregunta(s) detectada(s)
                      </Badge>
                    </div>
                    {Object.entries(editClozeGaps).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([gapNum, gapData]) => {
                      const hasGapError = fieldErrors[`clozeGap_${gapNum}`]
                      const hasOptionsError = fieldErrors[`clozeGapOptions_${gapNum}`]
                      const hasAnswerError = fieldErrors[`clozeGapAnswer_${gapNum}`]
                      const hasAnyError = hasGapError || hasOptionsError || hasAnswerError
                      return (
                      <div key={gapNum} className={cn(`border-2 rounded-lg p-4 space-y-3`, hasAnyError ? 'border-red-500 bg-red-50 shadow-md' : theme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-gray-50 border-gray-200')}>
                        <Label className={cn(`font-semibold text-lg`, hasAnyError ? 'text-red-700' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                          Pregunta {gapNum} *
                          {hasGapError && (
                            <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Esta pregunta requiere opciones</span>
                          )}
                          {hasOptionsError && (
                            <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Complete las 3 opciones (A, B, C)</span>
                          )}
                          {hasAnswerError && (
                            <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Seleccione la respuesta correcta</span>
                          )}
                        </Label>
                        <div className="space-y-3">
                          {['A', 'B', 'C'].map((letter, optIndex) => {
                            const isEmpty = !gapData.options[optIndex] || !gapData.options[optIndex].trim()
                            const hasOptionError = hasOptionsError && isEmpty
                            return (
                            <div key={letter} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`edit-cloze-gap-${gapNum}`}
                                checked={gapData.correctAnswer === letter}
                                onChange={() => {
                                  setEditClozeGaps({
                                    ...editClozeGaps,
                                    [gapNum]: { ...gapData, correctAnswer: letter }
                                  })
                                  if (fieldErrors[`clozeGapAnswer_${gapNum}`]) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`clozeGapAnswer_${gapNum}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{letter}:</Label>
                              <Input
                                value={gapData.options[optIndex] || ''}
                                onChange={(e) => {
                                  const newOptions = [...gapData.options]
                                  newOptions[optIndex] = e.target.value
                                  setEditClozeGaps({
                                    ...editClozeGaps,
                                    [gapNum]: { ...gapData, options: newOptions }
                                  })
                                  // Limpiar error cuando el usuario empiece a escribir
                                  if (fieldErrors[`clozeGapOptions_${gapNum}`] && newOptions.every(opt => opt && opt.trim())) {
                                    setFieldErrors(prev => {
                                      const newErrors = { ...prev }
                                      delete newErrors[`clozeGapOptions_${gapNum}`]
                                      return newErrors
                                    })
                                  }
                                }}
                                placeholder={`Opción ${letter}`}
                                className={cn(`flex-1`, hasOptionError ? 'border-red-500 border-2 bg-red-50' : hasAnyError ? 'border-red-300' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                              />
                            </div>
                            )
                          })}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className={cn("p-4 border-2 border-dashed rounded-lg text-center", theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-gray-50')}>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      No se detectaron preguntas aún. Escribe el texto y usa marcadores como <code className={cn("px-1 py-0.5 rounded text-xs", theme === 'dark' ? 'bg-zinc-600 text-gray-300' : 'bg-white')}>[1]</code>, <code className={cn("px-1 py-0.5 rounded text-xs", theme === 'dark' ? 'bg-zinc-600 text-gray-300' : 'bg-white')}>[2]</code>, etc. para marcar los huecos.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Texto informativo */}
                <div className="space-y-2">
                  <Label htmlFor="edit-informativeText" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Texto Informativo (opcional)</Label>
                  <RichTextEditor
                    ref={editInformativeTextEditorRef}
                    value={formData.informativeText}
                    onChange={(html) => setFormData({ ...formData, informativeText: html })}
                    placeholder="Información adicional o contexto para la pregunta..."
                    theme={theme}
                  />
                </div>

                {/* Pregunta */}
                <div className="space-y-2">
                  <Label htmlFor="edit-questionText" className={cn(fieldErrors['questionText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['questionText'] ? 'text-gray-300' : '')}>
                    Texto de la Pregunta *
                    {fieldErrors['questionText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(fieldErrors['questionText'] ? 'border-2 border-red-500 rounded-md p-2' : '', theme === 'dark' && !fieldErrors['questionText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      ref={editQuestionTextEditorRef}
                      value={formData.questionText}
                      onChange={(html) => {
                        setFormData({ ...formData, questionText: html })
                        if (fieldErrors['questionText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['questionText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Escribe la pregunta aquí..."
                      theme={theme}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Imágenes informativas - Edición - Solo para cloze test - Solo mostrar si hay imágenes existentes o nuevas */}
            {isEditingClozeTest && (informativeImagePreviews.length > 0 || editInformativeImages.length > 0) && (
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imágenes Informativas (opcional)</Label>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Agregar nuevas imágenes informativas. Máximo 5 imágenes.
                </p>
                
                {/* Mostrar imágenes existentes */}
                {informativeImagePreviews.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Imágenes existentes:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {informativeImagePreviews.map((preview, index) => (
                        <div key={index} className="relative w-full h-32">
                          <img 
                            src={preview} 
                            alt={`Imagen informativa ${index + 1}`} 
                            className="w-full h-full object-cover rounded border" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input para nuevas imágenes */}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditInformativeImageUpload}
                    className="hidden"
                    id="edit-informative-images"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('edit-informative-images')?.click()}
                    disabled={editInformativeImages.length >= 5}
                    className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Agregar Imágenes ({editInformativeImages.length}/5)
                  </Button>
                </div>

                {/* Mostrar nuevas imágenes seleccionadas */}
                {editInformativeImages.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Nuevas imágenes:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {editInformativeImages.map((file, index) => (
                        <div key={index} className="relative w-full h-32">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Nueva imagen ${index + 1}`} 
                            className="w-full h-full object-cover rounded border" 
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => removeEditInformativeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Secciones para preguntas normales (NO cloze test) */}
            {!isEditingClozeTest && (
              <>
                {/* Imágenes informativas - Edición */}
                <div className="space-y-2">
                  <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imágenes Informativas (opcional)</Label>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Agregar nuevas imágenes informativas. Máximo 5 imágenes.
                  </p>
                  
                  {/* Mostrar imágenes existentes */}
                  {informativeImagePreviews.length > 0 && (
                    <div className="space-y-2">
                      <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Imágenes existentes:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {informativeImagePreviews.map((preview, index) => (
                          <div key={index} className="relative w-full h-32">
                            <img 
                              src={preview} 
                              alt={`Imagen informativa ${index + 1}`} 
                              className="w-full h-full object-cover rounded border" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input para nuevas imágenes */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEditInformativeImageUpload}
                      className="hidden"
                      id="edit-informative-images"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('edit-informative-images')?.click()}
                      disabled={editInformativeImages.length >= 5}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Agregar Imágenes ({editInformativeImages.length}/5)
                    </Button>
                  </div>

                  {/* Mostrar nuevas imágenes seleccionadas */}
                  {editInformativeImages.length > 0 && (
                    <div className="space-y-2">
                      <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Nuevas imágenes:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {editInformativeImages.map((file, index) => (
                          <div key={index} className="relative w-full h-32">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Nueva imagen ${index + 1}`} 
                              className="w-full h-full object-cover rounded border" 
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => removeEditInformativeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pregunta */}
                <div className="space-y-2">
                  <Label htmlFor="edit-questionText" className={cn(fieldErrors['questionText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['questionText'] ? 'text-gray-300' : '')}>
                    Texto de la Pregunta *
                    {fieldErrors['questionText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={fieldErrors['questionText'] ? 'border-2 border-red-500 rounded-md p-2' : ''}>
                    <RichTextEditor
                      ref={editQuestionTextEditorRef}
                      value={formData.questionText}
                      onChange={(html) => {
                        setFormData({ ...formData, questionText: html })
                        if (fieldErrors['questionText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['questionText']
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Escribe la pregunta aquí..."
                      theme={theme}
                    />
                  </div>
                </div>

                {/* Imágenes de pregunta - Edición */}
                <div className="space-y-2">
                  <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Imágenes de Pregunta (opcional)</Label>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Agregar nuevas imágenes para la pregunta. Máximo 3 imágenes.
                  </p>
                  
                  {/* Mostrar imágenes existentes */}
                  {questionImagePreviews.length > 0 && (
                    <div className="space-y-2">
                      <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Imágenes existentes:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {questionImagePreviews.map((preview, index) => (
                          <div key={index} className="relative w-full h-32">
                            <img 
                              src={preview} 
                              alt={`Imagen de pregunta ${index + 1}`} 
                              className="w-full h-full object-cover rounded border" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input para nuevas imágenes */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEditQuestionImageUpload}
                      className="hidden"
                      id="edit-question-images"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('edit-question-images')?.click()}
                      disabled={editQuestionImages.length >= 3}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Agregar Imágenes ({editQuestionImages.length}/3)
                    </Button>
                  </div>

                  {/* Mostrar nuevas imágenes seleccionadas */}
                  {editQuestionImages.length > 0 && (
                    <div className="space-y-2">
                      <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Nuevas imágenes:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {editQuestionImages.map((file, index) => (
                          <div key={index} className="relative w-full h-32">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Nueva imagen ${index + 1}`} 
                              className="w-full h-full object-cover rounded border" 
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => removeEditQuestionImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Opciones de respuesta - Solo mostrar si NO es cloze test */}
            {!isEditingClozeTest && (
              <div className="space-y-2">
                <Label className={cn(fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['options'] && !fieldErrors['correctAnswer'] ? 'text-gray-300' : '')}>
                  Opciones de Respuesta *
                  {fieldErrors['options'] && <span className="ml-2 text-red-600">⚠️ Todas las opciones deben tener contenido</span>}
                  {fieldErrors['correctAnswer'] && <span className="ml-2 text-red-600">⚠️ Debe marcar exactamente una opción como correcta</span>}
                </Label>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Cada opción debe tener texto o imagen. Marque la opción correcta.
                </p>
                <div className={cn(`space-y-3`, fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'border-2 border-red-500 rounded-md p-2' : '')}>
                  {options.map((option) => {
                    const hasError = fieldErrors['options'] && (!option.text && !optionFiles[option.id] && !optionImagePreviews[option.id] && !option.imageUrl)
                    return (
                    <div key={option.id} className={cn(`border rounded-lg p-3 space-y-2`, hasError ? 'border-red-500 bg-red-50' : theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : '')}>
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="edit-correctAnswer"
                          checked={option.isCorrect}
                          onChange={() => handleCorrectAnswerChange(option.id)}
                          className="w-4 h-4 mt-2"
                        />
                        <span className={cn("font-medium mt-2", theme === 'dark' ? 'text-gray-300' : '')}>{option.id})</span>
                        <div className="flex-1">
                          <RichTextEditor
                            value={option.text || ''}
                            onChange={(html) => handleOptionTextChange(option.id, html)}
                            placeholder={`Texto de la opción ${option.id}`}
                            className="min-h-[100px]"
                            theme={theme}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files && handleOptionImageUpload(option.id, e.target.files[0])}
                            className="hidden"
                            id={`edit-option-${option.id}-image`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`edit-option-${option.id}-image`)?.click()}
                            className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {optionImagePreviews[option.id] && (
                        <div className="relative w-32 h-32">
                          <img 
                            src={optionImagePreviews[option.id]!} 
                            alt={`Opción ${option.id}`} 
                            className="w-full h-full object-cover rounded" 
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-0 right-0 h-6 w-6 p-0"
                            onClick={() => removeOptionImage(option.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
                setSelectedQuestion(null)
                setIsEditingClozeTest(false)
                setEditClozeText('')
                setEditClozeGaps({})
                setEditClozeRelatedQuestions([])
              }}
              className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateQuestion} 
              disabled={isLoading}
              className="bg-black text-white hover:bg-gray-800"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

             {/* Dialog para ver pregunta - VISTA COMPLETA del examen como estudiante */}
               <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className={cn("max-w-[95vw] max-h-[95vh] overflow-hidden p-0", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-50')}>
            {selectedQuestion && relatedQuestions.length > 0 && (
              <div className={cn("flex flex-col h-full", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
                {/* Botón de cerrar fijo */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewDialogOpen(false)}
                  className={cn("absolute top-2 right-2 z-50 shadow-lg", theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-gray-100')}
                >
                  <X className="h-5 w-5" />
                </Button>

                {/* Layout completo como en el examen con scroll */}
                <ScrollArea className="h-[calc(95vh-2rem)]">
                  <div className="flex flex-col lg:flex-row gap-6 p-4">
                    {/* Contenido principal del examen - EXACTO al examen */}
                    <div className="flex-1">
                      {/* Header "Estás realizando" */}
                      <div className={cn("border rounded-lg p-4 mb-6 shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-white" />
                          </div>
                          <div>
                            <h3 className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Vista Previa - Estás realizando:</h3>
                            <h2 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : '')}>
                              {relatedQuestions.length > 1 
                                ? (relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco'))
                                    ? `Cloze Test / Rellenar Huecos (${relatedQuestions.length} preguntas agrupadas)`
                                    : `Comprensión de Lectura (${relatedQuestions.length} preguntas)`)
                                : 'Pregunta del Banco de Datos'}
                            </h2>
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <span className={cn("px-2 py-1 rounded-full text-xs font-medium", theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                                {selectedQuestion.subject}
                              </span>
                              <span className={cn("px-2 py-1 rounded-full text-xs font-medium", theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')}>
                                {GRADE_CODE_TO_NAME[selectedQuestion.grade]}
                              </span>
                              {relatedQuestions.length > 1 && (
                                <span className={cn("px-2 py-1 rounded-full text-xs font-medium", theme === 'dark' ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                                  {relatedQuestions.length} preguntas agrupadas
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Texto base e imágenes compartidas - Manejo especial para Cloze Test */}
                      {relatedQuestions.length > 1 && selectedQuestion.informativeText && (
                        <Card className={cn("mb-6 border-2", theme === 'dark' ? 'border-purple-700 bg-purple-900/30' : 'border-purple-200 bg-purple-50/30')}>
                          <CardHeader>
                            <CardTitle className={cn("text-lg flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                              <BookOpen className={cn("h-5 w-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                              {/* Detectar si es Cloze Test basándose en el patrón del questionText */}
                              {relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco')) 
                                ? 'Texto de Cloze Test (Rellenar Huecos)' 
                                : 'Texto de Lectura Compartido'}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-lg max-w-none">
                              {/* Detectar si es Cloze Test */}
                              {relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco')) ? (
                                /* Visualización especial para Cloze Test con botones expandibles */
                                (() => {
                                  const clozeText = selectedQuestion.informativeText || ''
                                  // Extraer texto plano para detectar marcadores
                                  const tempDiv = document.createElement('div')
                                  tempDiv.innerHTML = clozeText
                                  const text = tempDiv.textContent || tempDiv.innerText || ''
                                  const gapMatches = text.match(/\[(\d+)\]/g) || []
                                  const gaps = new Set<number>()
                                  gapMatches.forEach(match => {
                                    const num = parseInt(match.replace(/[\[\]]/g, ''))
                                    gaps.add(num)
                                  })
                                  
                                  // Crear un mapeo de hueco número a opciones basándose en las preguntas relacionadas
                                  const gapOptionsMap: { [key: number]: QuestionOption[] } = {}
                                  relatedQuestions.forEach(q => {
                                    const match = q.questionText?.match(/hueco \[(\d+)\]/)
                                    if (match) {
                                      const gapNum = parseInt(match[1])
                                      gapOptionsMap[gapNum] = q.options || []
                                    }
                                  })
                                  
                                  // Dividir el texto en partes usando los marcadores de hueco
                                  const sortedGaps = Array.from(gaps).sort((a, b) => a - b)
                                  const parts: Array<{ type: 'text' | 'gap', content: string, gapNum?: number }> = []
                                  let remainingText = clozeText
                                  
                                  sortedGaps.forEach((gapNum) => {
                                    const gapMarker = `[${gapNum}]`
                                    const splitIndex = remainingText.indexOf(gapMarker)
                                    if (splitIndex > 0) {
                                      parts.push({ type: 'text', content: remainingText.substring(0, splitIndex) })
                                    }
                                    parts.push({ type: 'gap', content: gapMarker, gapNum })
                                    remainingText = remainingText.substring(splitIndex + gapMarker.length)
                                  })
                                  if (remainingText) {
                                    parts.push({ type: 'text', content: remainingText })
                                  }
                                  
                                  return (
                                    <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                                      <p className={cn("leading-relaxed prose max-w-none whitespace-pre-wrap", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                        {parts.map((part, idx) => {
                                          if (part.type === 'text') {
                                            // Renderizar texto manteniendo el flujo inline
                                            const html = sanitizeHtml(renderMathInHtml(part.content))
                                            return (
                                              <span 
                                                key={`text-${idx}`} 
                                                className="inline"
                                                dangerouslySetInnerHTML={{ __html: html }} 
                                              />
                                            )
                                          } else {
                                            const gapNum = part.gapNum!
                                            const options = gapOptionsMap[gapNum] || []
                                            const selectedAnswer = selectedClozeAnswers[gapNum] || ''
                                            
                                            // Encontrar la opción seleccionada para mostrar su texto (sin mostrar si es correcta)
                                            const selectedOption = options.find(opt => opt.id === selectedAnswer)
                                            
                                            return (
                                              <span key={`gap-${gapNum}`} className="inline-flex items-center gap-1 mx-0 my-0 align-middle">
                                                <Select
                                                  value={selectedAnswer}
                                                  onValueChange={(value) => {
                                                    setSelectedClozeAnswers({
                                                      ...selectedClozeAnswers,
                                                      [gapNum]: value
                                                    })
                                                  }}
                                                >
                                                  <SelectTrigger className={cn("h-8 px-3 text-xs font-semibold border-2 min-w-[100px] max-w-[250px] inline-flex", theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 border-blue-500 text-blue-300' : 'bg-white hover:bg-gray-100 border-blue-400 text-blue-700')}>
                                                    <SelectValue placeholder={`[${gapNum}]`}>
                                                      {selectedOption 
                                                        ? `${selectedOption.id}: ${selectedOption.text}` 
                                                        : `[${gapNum}]`}
                                                    </SelectValue>
                                                  </SelectTrigger>
                                                  <SelectContent className={cn("max-h-[200px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                                                    {options.length > 0 ? (
                                                      options.map((option) => (
                                                        <SelectItem 
                                                          key={option.id} 
                                                          value={option.id}
                                                        >
                                                          <div className="flex items-center gap-2 w-full">
                                                            <span className="font-semibold min-w-[20px]">{option.id}:</span>
                                                            <span className="flex-1">{option.text || 'Sin texto'}</span>
                                                          </div>
                                                        </SelectItem>
                                                      ))
                                                    ) : (
                                                      <SelectItem value="none" disabled>
                                                        Sin opciones disponibles
                                                      </SelectItem>
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                              </span>
                                            )
                                          }
                                        })}
                                      </p>
                                    </div>
                                  )
                                })()
                              ) : (
                                /* Visualización normal para comprensión de lectura */
                                <>
                                  {/* Texto informativo compartido */}
                                  {selectedQuestion.informativeText && (
                                    <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                                      <div
                                        className={cn("leading-relaxed prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(selectedQuestion.informativeText)) }}
                                      />
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Imágenes informativas compartidas */}
                              {selectedQuestion.informativeImages && selectedQuestion.informativeImages.length > 0 && (
                                <div className="mb-4">
                                  <ImageGallery images={selectedQuestion.informativeImages} />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Mostrar todas las preguntas relacionadas - Omitir si es Cloze Test */}
                      {!relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco')) && 
                        relatedQuestions.map((question, index) => (
                        <Card key={question.id || question.code} className={cn("mb-6", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : '')}>
                                {relatedQuestions.length > 1 
                                  ? `Pregunta ${index + 1} de ${relatedQuestions.length}` 
                                  : 'Pregunta 1'}
                              </CardTitle>
                              <div className="flex items-center gap-2 text-sm">
                                <span className={cn("px-2 py-1 rounded-full", theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                                  {question.topic}
                                </span>
                                <span className={cn(
                                  "px-2 py-1 rounded-full",
                                  question.level === 'Fácil' ? (theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700') :
                                  question.level === 'Medio' ? (theme === 'dark' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700') :
                                  (theme === 'dark' ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700')
                                )}>
                                  {question.level}
                                </span>
                                <Badge variant="outline" className={cn("font-mono text-xs", theme === 'dark' ? 'border-zinc-600 text-gray-300' : '')}>
                                  {question.code}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-lg max-w-none">
                              {/* Texto informativo (solo si es pregunta individual, no agrupada) */}
                              {relatedQuestions.length === 1 && question.informativeText && (
                                <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                                  <div
                                    className={cn("leading-relaxed prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(question.informativeText)) }}
                                  />
                                </div>
                              )}

                              {/* Imágenes informativas (solo si es pregunta individual) */}
                              {relatedQuestions.length === 1 && question.informativeImages && question.informativeImages.length > 0 && (
                                <div className="mb-4">
                                  <ImageGallery images={question.informativeImages} />
                                </div>
                              )}

                              {/* Imágenes de la pregunta */}
                              {question.questionImages && question.questionImages.length > 0 && (
                                <div className="mb-4">
                                  <ImageGallery images={question.questionImages} />
                                </div>
                              )}

                              {/* Texto de la pregunta */}
                              {question.questionText && (
                                <div
                                  className={cn("leading-relaxed text-lg font-medium prose max-w-none", theme === 'dark' ? 'text-white' : 'text-gray-900')}
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(question.questionText)) }}
                                />
                              )}
                            </div>
                            
                            {/* RadioGroup de opciones - Formato especial para Matching / Columnas */}
                            {question.subjectCode === 'IN' && question.options && question.options.length > 0 ? (
                              /* Formato Matching: Pregunta y Respuesta al frente con botón expandible superpuesto */
                              <div className="mt-4">
                                <div className={cn("border rounded-lg overflow-visible relative", theme === 'dark' ? 'border-zinc-700' : '')}>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                    {/* Columna de Pregunta */}
                                    <div className={cn("p-3 border-r", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                                      <div className={cn("leading-relaxed text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {question.questionText && (
                                          <div
                                            className="prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(question.questionText)) }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    {/* Columna de Respuestas con botón expandible */}
                                    <div 
                                      className={cn("p-3 relative", theme === 'dark' ? 'bg-zinc-800' : 'bg-white')}
                                      ref={(el) => {
                                        const questionKey = question.id || question.code
                                        if (el) {
                                          matchingDropdownRefs.current[questionKey] = el
                                        } else {
                                          delete matchingDropdownRefs.current[questionKey]
                                        }
                                      }}
                                    >
                                      <Collapsible
                                        open={expandedViewOptions.has(question.id || question.code)}
                                        onOpenChange={(open) => {
                                          const newExpanded = new Set(expandedViewOptions)
                                          const questionKey = question.id || question.code
                                          if (open) {
                                            newExpanded.add(questionKey)
                                          } else {
                                            newExpanded.delete(questionKey)
                                          }
                                          setExpandedViewOptions(newExpanded)
                                        }}
                                      >
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className={cn("w-full justify-between p-2 h-auto rounded-full z-10 relative", theme === 'dark' ? 'hover:bg-zinc-700 text-white' : 'hover:bg-gray-50')}
                                          >
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Ver Opciones de Respuesta</span>
                                              {selectedMatchingAnswers[question.id || question.code] && (() => {
                                                const selectedOptionId = selectedMatchingAnswers[question.id || question.code]
                                                const selectedOption = question.options.find(opt => opt.id === selectedOptionId)
                                                const selectedText = selectedOption?.text ? stripHtmlTags(selectedOption.text) : ''
                                                return selectedText ? (
                                                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded max-w-[300px] truncate", theme === 'dark' ? 'text-purple-300 bg-purple-900/50' : 'text-purple-600 bg-purple-100')} title={selectedText}>
                                                    {selectedOptionId}: {selectedText}
                                                  </span>
                                                ) : (
                                                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", theme === 'dark' ? 'text-purple-300 bg-purple-900/50' : 'text-purple-600 bg-purple-100')}>
                                                    Seleccionada: {selectedOptionId}
                                                  </span>
                                                )
                                              })()}
                                            </div>
                                            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')}>
                                              <ChevronDown className={cn(
                                                "h-3 w-3 transition-transform duration-200",
                                                theme === 'dark' ? 'text-gray-300' : 'text-gray-600',
                                                expandedViewOptions.has(question.id || question.code) ? "transform rotate-180" : ""
                                              )} />
                                            </div>
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className={cn("absolute top-full left-0 right-0 mt-1 z-20 border rounded-lg shadow-lg p-3 max-h-[400px] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200')}>
                                          <RadioGroup 
                                            className="space-y-1.5" 
                                            value={selectedMatchingAnswers[question.id || question.code] || ''}
                                            onValueChange={(value) => {
                                              const questionKey = question.id || question.code
                                              setSelectedMatchingAnswers(prev => ({
                                                ...prev,
                                                [questionKey]: value
                                              }))
                                            }}
                                          >
                                            {question.options.map((option) => (
                                              <div
                                                key={option.id}
                                                className={cn(
                                                  "flex items-start space-x-2 border rounded p-2 transition-colors",
                                                  theme === 'dark' 
                                                    ? (selectedMatchingAnswers[question.id || question.code] === option.id ? "bg-purple-900/50 border-purple-600 hover:bg-purple-900/70" : "border-zinc-700 hover:bg-zinc-700")
                                                    : (selectedMatchingAnswers[question.id || question.code] === option.id ? "bg-purple-50 border-purple-300 hover:bg-gray-50" : "hover:bg-gray-50")
                                                )}
                                              >
                                                <RadioGroupItem
                                                  value={option.id}
                                                  id={`view-${question.id || question.code}-${option.id}`}
                                                  className="mt-0.5 flex-shrink-0 h-4 w-4"
                                                />
                                                <Label
                                                  htmlFor={`view-${question.id || question.code}-${option.id}`}
                                                  className="flex-1 cursor-pointer"
                                                >
                                                  <div className="flex items-start gap-2">
                                                    <span className={cn("font-semibold text-xs flex-shrink-0", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{option.id}.</span>
                                                    <div className="flex-1 min-w-0">
                                                      {option.text && (
                                                        <div
                                                          className={cn("prose prose-sm max-w-none text-xs break-words", theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}
                                                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(option.text)) }}
                                                        />
                                                      )}
                                                      {option.imageUrl && (
                                                        <div className="mt-1">
                                                          <img 
                                                            src={option.imageUrl} 
                                                            alt={`Opción ${option.id}`}
                                                            className="max-w-full h-auto max-h-16 rounded border shadow-sm"
                                                            onError={(e) => {
                                                              console.error('Error cargando imagen de opción:', option.imageUrl);
                                                              e.currentTarget.style.display = 'none';
                                                            }}
                                                          />
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </Label>
                                              </div>
                                            ))}
                                          </RadioGroup>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Formato estándar para otras preguntas */
                            <RadioGroup className="space-y-4 mt-6" defaultValue="">
                              {question.options.map((option) => (
                                <div
                                  key={option.id}
                                  className={cn("flex items-start space-x-3 border rounded-lg p-3 transition-colors", theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-700' : 'hover:bg-gray-50')}
                                >
                                  <RadioGroupItem
                                    value={option.id}
                                    id={`view-${question.id || question.code}-${option.id}`}
                                    className="mt-1"
                                  />
                                  <Label
                                    htmlFor={`view-${question.id || question.code}-${option.id}`}
                                    className="flex-1 cursor-pointer"
                                  >
                                    <div className="flex items-start gap-3">
                                      <span className={cn("font-semibold mr-2", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{option.id}.</span>
                                      <div className="flex-1">
                                        {option.text && (
                                          <div
                                            className={cn("prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(option.text)) }}
                                          />
                                        )}
                                        {option.imageUrl && (
                                          <div className="mt-2">
                                            <img 
                                              src={option.imageUrl} 
                                              alt={`Opción ${option.id}`}
                                              className="max-w-full h-auto rounded-lg border shadow-sm"
                                              onError={(e) => {
                                                console.error('Error cargando imagen de opción:', option.imageUrl);
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                            )}
                          </CardContent>
                          <CardFooter className="flex justify-between items-center">
                            <div className={cn("flex items-center gap-2 text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>Puedes seleccionar una respuesta</span>
                            </div>
                            {relatedQuestions.length > 1 && (
                              <div className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                Pregunta {index + 1}/{relatedQuestions.length}
                              </div>
                            )}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>

                    {/* Panel lateral derecho con navegación - IGUAL AL EXAMEN */}
                    <div className="w-full lg:w-64 flex-shrink-0">
                      <div className={cn("border rounded-lg p-4 sticky top-4 flex flex-col", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                        <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                          <BarChart3 className={cn("h-4 w-4", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                          {relatedQuestions.length > 1 ? 'Preguntas Agrupadas' : 'Navegación'}
                        </h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {/* Mostrar preguntas relacionadas o simular navegación */}
                          {relatedQuestions.length > 1 ? (
                            relatedQuestions.map((q, index) => (
                              <div
                                key={q.id || q.code}
                                className={cn("w-full text-left p-3 rounded-lg flex items-center gap-2 border", theme === 'dark' ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200')}
                              >
                                <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-500 text-white">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className={cn("text-sm font-medium truncate", theme === 'dark' ? 'text-white' : '')}>
                                    Pregunta {index + 1}
                                  </div>
                                  <div className={cn("text-xs flex items-center gap-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    <Badge variant="outline" className={cn("font-mono text-xs px-1 py-0", theme === 'dark' ? 'border-zinc-600 text-gray-300' : '')}>
                                      {q.code}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            // Simular navegación para pregunta individual
                            Array.from({ length: 10 }, (_, index) => (
                              <button
                                key={index}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors",
                                  index === 0
                                    ? (theme === 'dark' ? "bg-purple-900/30 border-purple-700 border" : "bg-purple-50 border-purple-200 border")
                                    : (theme === 'dark' ? "border-zinc-700 hover:bg-zinc-700 border" : "border hover:bg-gray-50")
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                                    index === 0
                                      ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                                      : (theme === 'dark' ? "bg-zinc-700 text-gray-300 border-zinc-600 border" : "bg-gray-100 text-gray-700 border")
                                  )}
                                >
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className={cn("text-sm font-medium truncate", theme === 'dark' ? 'text-white' : '')}>Pregunta {index + 1}</div>
                                  <div className={cn("text-xs flex items-center gap-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    {index === 0 ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                        <span>Respondida</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="h-3 w-3 text-orange-500" />
                                        <span>Sin responder</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        <div className={cn("mt-4 pt-4 border-t", theme === 'dark' ? 'border-zinc-700' : '')}>
                          <div className={cn("text-sm mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Información</div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>
                              {relatedQuestions.length > 1 
                                ? `${relatedQuestions.length} preguntas agrupadas`
                                : '1 pregunta'}
                            </span>
                          </div>
                          {relatedQuestions.length > 1 && (
                            <div className={cn("mt-4 p-3 border rounded-lg", theme === 'dark' ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200')}>
                              <div className="flex items-start gap-2">
                                <BookOpen className={cn("h-4 w-4 mt-0.5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                                <div className={cn("text-xs", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                  Estas preguntas comparten el mismo texto de lectura e imágenes.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>
     </div>
   )
 }
 
