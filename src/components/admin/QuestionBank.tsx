import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Textarea } from '@/components/ui/textarea'
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
  Clock,
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
    // Permitir elementos y atributos de KaTeX
    // Incluir SVG usado por KaTeX (radicales, extensibles, etc.)
    ADD_TAGS: [
      'math', 'annotation', 'semantics', 'mtext', 'mn', 'mo', 'mi', 'mspace', 'mover', 'munder', 'munderover',
      'msup', 'msub', 'msubsup', 'mfrac', 'mroot', 'msqrt', 'mtable', 'mtr', 'mtd', 'mlabeledtr', 'mrow',
      'menclose', 'mstyle', 'mpadded', 'mphantom', 'mfenced', 'maction', 'mmultiscripts', 'mover', 'munder', 'munderover',
      'svg', 'path', 'g', 'line', 'rect', 'circle', 'use'
    ],
    ADD_ATTR: [
      'data-latex', 'class', 'style', 'aria-label', 'role', 'tabindex',
      // Atributos SVG requeridos por KaTeX
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
      // Validaciones
      if (!formData.subject || !formData.topic || !formData.questionText) {
        notifyError({ 
          title: 'Error', 
          message: 'Complete todos los campos obligatorios' 
        })
        return
      }

      // Validar que todas las opciones tengan contenido
      const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id])
      if (emptyOptions.length > 0) {
        notifyError({ 
          title: 'Error', 
          message: 'Todas las opciones deben tener texto o imagen' 
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

      // Crear la pregunta
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
          message: 'No se pudo crear la pregunta' 
        })
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
    setIsViewDialogOpen(true)
  }

  const handleEditQuestion = (question: Question) => {
    setSelectedQuestion(question)
    // Cargar los datos de la pregunta en el formulario
    setFormData({
      subject: question.subject,
      subjectCode: question.subjectCode,
      topic: question.topic,
      topicCode: question.topicCode,
      grade: question.grade as any,
      level: question.level as any,
      levelCode: question.levelCode as any,
      informativeText: question.informativeText || '',
      questionText: question.questionText,
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
      subject: question.subject
    })

    setIsLoading(true)
    try {
      const result = await questionService.deleteQuestion(question.id)
      
      if (result.success) {
        console.log('✅ Eliminación exitosa, recargando preguntas...')
        notifySuccess({
          title: 'Éxito',
          message: `Pregunta ${question.code} eliminada correctamente`
        })
        // Recargar las preguntas después de eliminar
        await loadQuestions()
        await loadStats()
      } else {
        console.error('❌ Error al eliminar pregunta:', result.error)
        notifyError({
          title: 'Error',
          message: result.error?.message || 'No se pudo eliminar la pregunta'
        })
      }
    } catch (error) {
      console.error('❌ Excepción al eliminar pregunta:', error)
      notifyError({
        title: 'Error',
        message: 'Error al eliminar la pregunta. Revisa la consola para más detalles.'
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

      // Validaciones
      if (!formData.subject || !formData.topic || !formData.questionText) {
        notifyError({
          title: 'Error',
          message: 'Complete todos los campos obligatorios'
        })
        return
      }

      // Validar que todas las opciones tengan contenido
      const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id] && !opt.imageUrl)
      if (emptyOptions.length > 0) {
        notifyError({
          title: 'Error',
          message: 'Todas las opciones deben tener texto o imagen'
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
        notifySuccess({
          title: 'Éxito',
          message: `Pregunta ${selectedQuestion.code} actualizada correctamente`
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
                className="pl-10"
              />
            </div>

            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las materias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las materias</SelectItem>
                {SUBJECTS_CONFIG.map(subject => (
                  <SelectItem key={subject.code} value={subject.code}>
                    {subject.icon} {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTopic} onValueChange={setFilterTopic} disabled={filterSubject === 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los temas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los temas</SelectItem>
                {filterAvailableTopics.map(topic => (
                  <SelectItem key={topic.code} value={topic.code}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los grados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los grados</SelectItem>
                {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los niveles" />
              </SelectTrigger>
              <SelectContent>
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
              ) : (
                filteredQuestions.map((question) => {
                  return (
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
                            <span>4 opciones</span>
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
                  )
                })
              )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog para crear pregunta - continuará en la siguiente parte... */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Pregunta</DialogTitle>
            <DialogDescription>
              Complete todos los campos para crear una nueva pregunta en el banco
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Materia *</Label>
                <Select value={formData.subjectCode} onValueChange={handleSubjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS_CONFIG.map(subject => (
                      <SelectItem key={subject.code} value={subject.code}>
                        {subject.icon} {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Tema *</Label>
                <Select 
                  value={formData.topicCode} 
                  onValueChange={handleTopicChange}
                  disabled={!formData.subjectCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTopics.map(topic => (
                      <SelectItem key={topic.code} value={topic.code}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Grado *</Label>
                <Select value={formData.grade} onValueChange={(value: any) => setFormData({...formData, grade: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Nivel de Dificultad *</Label>
                <Select value={formData.level} onValueChange={(value: any) => handleLevelChange(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map(level => (
                      <SelectItem key={level.code} value={level.name}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Texto informativo (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="informativeText">Texto Informativo (opcional)</Label>
              <RichTextEditor
                ref={informativeTextEditorRef}
                value={formData.informativeText}
                onChange={(html) => setFormData({ ...formData, informativeText: html })}
                placeholder="Información adicional o contexto para la pregunta..."
              />
            </div>

            {/* Imágenes informativas */}
            <div className="space-y-2">
              <Label>Imágenes Informativas (opcional, máx. 5)</Label>
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

            {/* Pregunta */}
            <div className="space-y-2">
              <Label htmlFor="questionText">Texto de la Pregunta *</Label>
              <RichTextEditor
                ref={questionTextEditorRef}
                value={formData.questionText}
                onChange={(html) => setFormData({ ...formData, questionText: html })}
                placeholder="Escribe la pregunta aquí..."
              />
            </div>

            {/* Imágenes de la pregunta */}
            <div className="space-y-2">
              <Label>Imágenes de la Pregunta (opcional, máx. 3)</Label>
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
              <Label>Opciones de Respuesta *</Label>
              <p className="text-sm text-gray-500">
                Cada opción debe tener texto o imagen. Marque la opción correcta.
              </p>
              <div className="space-y-3">
                {options.map((option) => (
                  <div key={option.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={option.isCorrect}
                        onChange={() => handleCorrectAnswerChange(option.id)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">{option.id})</span>
                      <Input
                        value={option.text || ''}
                        onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                        placeholder={`Texto de la opción ${option.id}`}
                        className="flex-1"
                      />
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
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
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
                ))}
              </div>
            </div>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pregunta {selectedQuestion?.code}</DialogTitle>
            <DialogDescription>
              Modifica los campos necesarios y guarda los cambios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Información básica */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-subject">Materia *</Label>
                <Select value={formData.subjectCode} onValueChange={handleSubjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS_CONFIG.map(subject => (
                      <SelectItem key={subject.code} value={subject.code}>
                        {subject.icon} {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-topic">Tema *</Label>
                <Select 
                  value={formData.topicCode} 
                  onValueChange={handleTopicChange}
                  disabled={!formData.subjectCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tema" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTopics.map(topic => (
                      <SelectItem key={topic.code} value={topic.code}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-grade">Grado *</Label>
                <Select value={formData.grade} onValueChange={(value: any) => setFormData({...formData, grade: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar grado" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-level">Nivel de Dificultad *</Label>
                <Select value={formData.level} onValueChange={(value: any) => handleLevelChange(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map(level => (
                      <SelectItem key={level.code} value={level.name}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Texto informativo */}
            <div className="space-y-2">
              <Label htmlFor="edit-informativeText">Texto Informativo (opcional)</Label>
              <RichTextEditor
                ref={editInformativeTextEditorRef}
                value={formData.informativeText}
                onChange={(html) => setFormData({ ...formData, informativeText: html })}
                placeholder="Información adicional o contexto para la pregunta..."
              />
            </div>

            {/* Imágenes informativas - Edición */}
            <div className="space-y-2">
              <Label>Imágenes Informativas (opcional)</Label>
              <p className="text-sm text-gray-500">
                Agregar nuevas imágenes informativas. Máximo 5 imágenes.
              </p>
              
              {/* Mostrar imágenes existentes */}
              {informativeImagePreviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Imágenes existentes:</p>
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
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Agregar Imágenes ({editInformativeImages.length}/5)
                </Button>
              </div>

              {/* Mostrar nuevas imágenes seleccionadas */}
              {editInformativeImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Nuevas imágenes:</p>
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
              <Label htmlFor="edit-questionText">Texto de la Pregunta *</Label>
              <RichTextEditor
                ref={editQuestionTextEditorRef}
                value={formData.questionText}
                onChange={(html) => setFormData({ ...formData, questionText: html })}
                placeholder="Escribe la pregunta aquí..."
              />
            </div>

            {/* Imágenes de pregunta - Edición */}
            <div className="space-y-2">
              <Label>Imágenes de Pregunta (opcional)</Label>
              <p className="text-sm text-gray-500">
                Agregar nuevas imágenes para la pregunta. Máximo 3 imágenes.
              </p>
              
              {/* Mostrar imágenes existentes */}
              {questionImagePreviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Imágenes existentes:</p>
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
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Agregar Imágenes ({editQuestionImages.length}/3)
                </Button>
              </div>

              {/* Mostrar nuevas imágenes seleccionadas */}
              {editQuestionImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Nuevas imágenes:</p>
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

            {/* Opciones de respuesta */}
            <div className="space-y-2">
              <Label>Opciones de Respuesta *</Label>
              <p className="text-sm text-gray-500">
                Cada opción debe tener texto o imagen. Marque la opción correcta.
              </p>
              <div className="space-y-3">
                {options.map((option) => (
                  <div key={option.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="edit-correctAnswer"
                        checked={option.isCorrect}
                        onChange={() => handleCorrectAnswerChange(option.id)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">{option.id})</span>
                      <Input
                        value={option.text || ''}
                        onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                        placeholder={`Texto de la opción ${option.id}`}
                        className="flex-1"
                      />
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
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
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
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                resetForm()
                setSelectedQuestion(null)
              }}
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
          <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0 bg-gray-50">
            {selectedQuestion && (
              <div className="flex flex-col h-full bg-gray-50">
                {/* Botón de cerrar fijo */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="absolute top-2 right-2 z-50 bg-white shadow-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </Button>

                                 {/* Layout completo como en el examen con scroll */}
                 <ScrollArea className="h-[calc(95vh-2rem)]">
                 <div className="flex flex-col lg:flex-row gap-6 p-4">
                  {/* Contenido principal del examen - EXACTO al examen */}
                  <div className="flex-1">
                   {/* Header "Estás realizando" */}
                   <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
                     <div className="flex items-center gap-4">
                       <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                         <BookOpen className="w-10 h-10 text-white" />
                       </div>
                       <div>
                         <h3 className="text-sm text-gray-500 font-medium">Vista Previa - Estás realizando:</h3>
                         <h2 className="text-lg font-bold">Pregunta del Banco de Datos</h2>
                         <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                           <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                             {selectedQuestion.subject}
                           </span>
                           <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                             {GRADE_CODE_TO_NAME[selectedQuestion.grade]}
                           </span>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Badge de progreso simulado */}
                   <div className="flex justify-between items-center mb-4">
                     <div className="flex items-center gap-2">
                       <BarChart3 className="h-5 w-5 text-purple-600" />
                       <h2 className="text-lg font-semibold">Pregunta 1</h2>
                     </div>
                     <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 shadow-sm">
                         <Clock className="h-4 w-4 text-green-500" />
                         <span className="text-sm font-medium font-mono">15:00</span>
                       </div>
                     </div>
                   </div>

                   {/* Barra de progreso simulada */}
                   <div className="mb-6">
                     <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                       <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" style={{ width: '10%' }}></div>
                     </div>
                     <div className="flex justify-between mt-2 text-sm text-gray-500">
                       <span>Pregunta 1 de 10</span>
                       <span>1 respondida</span>
                     </div>
                   </div>

                   {/* Card principal de la pregunta - IGUAL AL EXAMEN */}
                   <Card className="mb-6">
                     <CardHeader>
                       <div className="flex items-center justify-between">
                         <CardTitle className="text-xl">Pregunta 1</CardTitle>
                         <div className="flex items-center gap-2 text-sm text-gray-500">
                           <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                             {selectedQuestion.topic}
                           </span>
                           <span className={cn(
                             "px-2 py-1 rounded-full",
                             selectedQuestion.level === 'Fácil' ? 'bg-green-100 text-green-700' :
                             selectedQuestion.level === 'Medio' ? 'bg-yellow-100 text-yellow-700' :
                             'bg-red-100 text-red-700'
                           )}>
                             {selectedQuestion.level}
                           </span>
                         </div>
                       </div>
                     </CardHeader>
                     <CardContent>
                       <div className="prose prose-lg max-w-none">
                         {/* Texto informativo */}
                         {selectedQuestion.informativeText && (
                           <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                             <div
                               className="text-gray-700 leading-relaxed prose max-w-none"
                               dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(selectedQuestion.informativeText)) }}
                             />
                           </div>
                         )}

                         {/* Imágenes informativas */}
                         {selectedQuestion.informativeImages && selectedQuestion.informativeImages.length > 0 && (
                           <div className="mb-4">
                             <ImageGallery images={selectedQuestion.informativeImages} />
                           </div>
                         )}

                         {/* Imágenes de la pregunta */}
                         {selectedQuestion.questionImages && selectedQuestion.questionImages.length > 0 && (
                           <div className="mb-4">
                             <ImageGallery images={selectedQuestion.questionImages} />
                           </div>
                         )}

                         {/* Texto de la pregunta */}
                         {selectedQuestion.questionText && (
                           <div
                             className="text-gray-900 leading-relaxed text-lg font-medium prose max-w-none"
                             dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(selectedQuestion.questionText)) }}
                           />
                         )}
                       </div>
                       
                       {/* RadioGroup de opciones - IDÉNTICO al examen */}
                       <RadioGroup className="space-y-4 mt-6" defaultValue="">
                         {selectedQuestion.options.map((option) => (
                           <div
                             key={option.id}
                             className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                           >
                             <RadioGroupItem
                               value={option.id}
                               id={`view-${option.id}`}
                               className="mt-1"
                             />
                             <Label
                               htmlFor={`view-${option.id}`}
                               className="flex-1 cursor-pointer"
                             >
                               <div className="flex items-start gap-3">
                                 <span className="font-semibold text-purple-600 mr-2">{option.id}.</span>
                                 <div className="flex-1">
                                   {option.text && (
                                     <div
                                       className="text-gray-900 prose max-w-none"
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
                     </CardContent>
                     <CardFooter className="flex justify-end">
                       <div className="flex items-center gap-2 text-sm text-gray-500">
                         <CheckCircle2 className="h-4 w-4 text-green-500" />
                         <span>Puedes seleccionar una respuesta</span>
                       </div>
                     </CardFooter>
                   </Card>
                 </div>

                                                                       {/* Panel lateral derecho con navegación - IGUAL AL EXAMEN */}
                   <div className="w-full lg:w-64 flex-shrink-0">
                     <div className="bg-white border rounded-lg p-4 sticky top-4 flex flex-col">
                       <h3 className="font-medium mb-3 flex items-center gap-2">
                         <BarChart3 className="h-4 w-4 text-purple-600" />
                         Navegación
                       </h3>
                       <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {/* Simular 10 preguntas para la navegación */}
                        {Array.from({ length: 10 }, (_, index) => (
                         <button
                           key={index}
                           className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${
                             index === 0
                               ? "bg-purple-50 border-purple-200 border"
                               : "border hover:bg-gray-50"
                           }`}
                         >
                           <div
                             className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                               index === 0
                                 ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                                 : "bg-gray-100 text-gray-700 border"
                             }`}
                           >
                             {index + 1}
                           </div>
                           <div className="flex-1">
                             <div className="text-sm font-medium truncate">Pregunta {index + 1}</div>
                             <div className="text-xs text-gray-500 flex items-center gap-1">
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
                                                  ))}
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="text-sm text-gray-500 mb-2">Progreso del examen</div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">1/10</span>
                            <span className="text-sm text-gray-500">10%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" style={{ width: '10%' }}></div>
                          </div>

                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                              <div className="text-xs text-amber-700">
                                Tienes 9 preguntas sin responder
                              </div>
                            </div>
                          </div>
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
 
