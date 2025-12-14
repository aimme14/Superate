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
import { Checkbox } from '@/components/ui/checkbox'
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
  TrendingUp,
  HelpCircle
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  
  return tempDiv.innerHTML
}

// Componente para renderizar texto con fórmulas matemáticas
const MathText = ({ text, className = '' }: { text: string; className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current || !text) return
    
    // Primero, detectar y convertir fórmulas LaTeX en formato `$...$` o `$$...$$`
    let processedText = text
    
    // Convertir fórmulas en bloque $$...$$
    processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
      return `<span class="katex-formula" data-latex="${latex.trim()}" data-display="true"></span>`
    })
    
    // Convertir fórmulas inline $...$
    processedText = processedText.replace(/\$([^$]+)\$/g, (match, latex) => {
      return `<span class="katex-formula" data-latex="${latex.trim()}"></span>`
    })
    
    // Procesar el texto para renderizar fórmulas existentes
    const processedHtml = renderMathInHtml(processedText)
    containerRef.current.innerHTML = processedHtml
    
    // Renderizar todas las fórmulas con KaTeX
    const mathElements = containerRef.current.querySelectorAll('[data-latex]')
    mathElements.forEach((el) => {
      const latex = el.getAttribute('data-latex')
      if (latex && !el.querySelector('.katex')) {
        const isDisplay = el.getAttribute('data-display') === 'true'
        try {
          katex.render(latex, el as HTMLElement, {
            throwOnError: false,
            displayMode: isDisplay,
            strict: false,
          })
          el.classList.add('katex-formula')
        } catch (error) {
          console.error('Error renderizando fórmula:', error)
          el.textContent = latex
        }
      }
    })
  }, [text])
  
  return <div ref={containerRef} className={className} />
}

export default function QuestionBank({ theme }: QuestionBankProps) {
  const { notifySuccess, notifyError } = useNotification()
  
  // Función helper para extraer el texto real del usuario de matching/columnas
  // Formato: MATCHING_COLUMNS_GROUP_ID|texto real o solo MATCHING_COLUMNS_GROUP_ID
  const extractMatchingText = (informativeText: string | undefined | null): string => {
    if (!informativeText) return ''
    if (informativeText.includes('|')) {
      const parts = informativeText.split('|')
      return parts.slice(1).join('|') // En caso de que el texto tenga |, unir todo después del primer |
    }
    return '' // Si solo tiene el identificador sin texto, retornar vacío
  }
  
  // Función helper para extraer el identificador de grupo de matching/columnas
  const extractMatchingGroupId = (informativeText: string | undefined | null): string => {
    if (!informativeText) return ''
    if (informativeText.includes('|')) {
      return informativeText.split('|')[0]
    }
    return informativeText // Si no tiene |, es solo el identificador
  }
  
  // Función helper para ordenar preguntas por orden de creación (más antigua primero)
  const sortQuestionsByCreationOrder = (a: Question, b: Question): number => {
    // Primero, intentar ordenar por número de hueco si ambas son cloze test
    const aMatch = a.questionText?.match(/hueco \[(\d+)\]/)
    const bMatch = b.questionText?.match(/hueco \[(\d+)\]/)
    if (aMatch && bMatch) {
      // Ordenar por número de hueco ascendente (1, 2, 3...) para mantener el orden de inserción
      return parseInt(aMatch[1]) - parseInt(bMatch[1])
    }
    
    // Si no tienen número de hueco, ordenar por fecha de creación ascendente (más antigua primero)
    // para mantener el orden de inserción
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    if (dateA !== dateB) {
      return dateA - dateB // Más antigua primero (orden de inserción)
    }
    
    // Si tienen la misma fecha, ordenar por código
    return a.code.localeCompare(b.code)
  }
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
  const [filterAIInconsistency, setFilterAIInconsistency] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Vista de organización
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  
  // Selección múltiple
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())

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
  
  // Estados para modalidades de otras materias (MA, LE, CS, BI, QU, FI)
  const [otherSubjectsModality, setOtherSubjectsModality] = useState<'standard_mc' | 'reading_comprehension'>('standard_mc')
  
  // Estados para Comprensión de Lectura en otras materias
  const [otherSubjectsReadingText, setOtherSubjectsReadingText] = useState<string>('')
  const [otherSubjectsReadingImage, setOtherSubjectsReadingImage] = useState<File | null>(null)
  const [otherSubjectsReadingImagePreview, setOtherSubjectsReadingImagePreview] = useState<string | null>(null)
  const [otherSubjectsReadingQuestions, setOtherSubjectsReadingQuestions] = useState<Array<{
    id: string
    questionText: string
    questionImage: File | null
    questionImagePreview: string | null
    options: QuestionOption[]
  }>>([])
  
  // Estados para edición de Comprensión de Lectura en otras materias
  const [isEditingOtherSubjectsReadingComprehension, setIsEditingOtherSubjectsReadingComprehension] = useState(false)
  const [editOtherSubjectsReadingText, setEditOtherSubjectsReadingText] = useState<string>('')
  const [editOtherSubjectsReadingImage, setEditOtherSubjectsReadingImage] = useState<File | null>(null)
  const [editOtherSubjectsReadingImagePreview, setEditOtherSubjectsReadingImagePreview] = useState<string | null>(null)
  const [editOtherSubjectsReadingExistingImageUrl, setEditOtherSubjectsReadingExistingImageUrl] = useState<string | null>(null)
  const [editOtherSubjectsReadingQuestions, setEditOtherSubjectsReadingQuestions] = useState<Array<{
    id: string // ID de la pregunta en la base de datos
    questionId: string // ID único para el formulario
    questionText: string
    questionImage: File | null
    questionImagePreview: string | null
    existingQuestionImageUrl: string | null
    options: QuestionOption[]
  }>>([])
  const [editOtherSubjectsReadingRelatedQuestions, setEditOtherSubjectsReadingRelatedQuestions] = useState<Question[]>([])
  
  // Función helper para generar letras de opciones dinámicamente (A, B, C, ..., Z)
  const getOptionLetter = (index: number): string => {
    return String.fromCharCode(65 + index) // 65 es el código ASCII de 'A'
  }

  // Función helper para encontrar la siguiente letra disponible sin duplicados
  const getNextAvailableOptionLetter = (existingOptions: QuestionOption[]): string => {
    const existingIds = new Set(existingOptions.map(opt => opt.id))
    // Buscar desde A hasta Z
    for (let i = 0; i < 26; i++) {
      const letter = getOptionLetter(i)
      if (!existingIds.has(letter as any)) {
        return letter
      }
    }
    // Si todas las letras están ocupadas, retornar la siguiente (aunque no debería pasar)
    return getOptionLetter(existingOptions.length)
  }

  // Estados para Matching / Columnas (nueva estructura por bloques)
  const [matchingQuestions, setMatchingQuestions] = useState<Array<{
    id: string
    questionText: string // Texto de la pregunta
    questionImage: File | null // Imagen de la pregunta (una por pregunta)
    questionImagePreview: string | null // Vista previa de la imagen
    options: QuestionOption[] // Opciones de respuesta dinámicas (A, B, C, ..., Z)
  }>>([])
  const [expandedViewOptions, setExpandedViewOptions] = useState<Set<string>>(new Set()) // Controlar qué preguntas tienen opciones expandidas en visualización
  const [selectedMatchingAnswers, setSelectedMatchingAnswers] = useState<{ [key: string]: string }>({}) // Rastrear respuestas seleccionadas: questionId -> optionId
  const matchingDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({}) // Refs para detectar clics fuera
  const [selectedClozeAnswers, setSelectedClozeAnswers] = useState<{ [key: number]: string }>({}) // Rastrear respuestas seleccionadas por hueco
  const [selectedStandardAnswers, setSelectedStandardAnswers] = useState<{ [key: string]: string }>({}) // Rastrear respuestas seleccionadas en preguntas estándar: questionId -> optionId
  
  // Estados para Cloze Test
  const [clozeText, setClozeText] = useState<string>('') // Texto con marcadores [1], [2], etc.
  const [clozeGaps, setClozeGaps] = useState<{ [key: number]: { options: string[], correctAnswer: string } }>({}) // Opciones por hueco (dinámicas: A, B, C, ..., Z)
  
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
  // Estados para imágenes de opciones de comprensión lectora (creación)
  const [readingOptionFiles, setReadingOptionFiles] = useState<{ [questionId: string]: { [optionId: string]: File | null } }>({})
  const [readingOptionImagePreviews, setReadingOptionImagePreviews] = useState<{ [questionId: string]: { [optionId: string]: string | null } }>({})

  // Estados para edición de Comprensión de Lectura
  const [isEditingReadingComprehension, setIsEditingReadingComprehension] = useState(false) // Indica si estamos editando comprensión de lectura
  const [editReadingText, setEditReadingText] = useState<string>('') // Texto de lectura para edición
  const [editReadingImage, setEditReadingImage] = useState<File | null>(null) // Nueva imagen de lectura para edición
  const [editReadingImagePreview, setEditReadingImagePreview] = useState<string | null>(null) // Preview de nueva imagen
  const [editReadingExistingImageUrl, setEditReadingExistingImageUrl] = useState<string | null>(null) // URL de imagen existente
  const [editReadingQuestions, setEditReadingQuestions] = useState<Array<{
    id: string // ID de la pregunta en la base de datos
    questionId: string // ID único para el formulario
    questionText: string
    questionImage: File | null
    questionImagePreview: string | null
    existingQuestionImageUrl: string | null // URL de imagen existente
    options: QuestionOption[]
  }>>([])
  const [editReadingRelatedQuestions, setEditReadingRelatedQuestions] = useState<Question[]>([]) // Preguntas relacionadas de comprensión de lectura
  // Estados para imágenes de opciones de comprensión lectora (edición)
  const [editReadingOptionFiles, setEditReadingOptionFiles] = useState<{ [questionId: string]: { [optionId: string]: File | null } }>({})
  const [editReadingOptionImagePreviews, setEditReadingOptionImagePreviews] = useState<{ [questionId: string]: { [optionId: string]: string | null } }>({})

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
  }, [questions, filterSubject, filterTopic, filterGrade, filterLevel, filterAIInconsistency, searchTerm])

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

  // Limpiar selección cuando cambien los filtros
  useEffect(() => {
    setSelectedQuestionIds(new Set())
  }, [filterSubject, filterTopic, filterGrade, filterLevel, filterAIInconsistency, searchTerm])

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

    // Filtro por inconsistencias con IA
    if (filterAIInconsistency) {
      filtered = filtered.filter(q => {
        if (!q.aiJustification) return false
        
        // Obtener la opción marcada como correcta en la pregunta
        const correctOption = q.options.find(opt => opt.isCorrect)
        if (!correctOption) return false
        
        // Obtener todas las opciones incorrectas según la pregunta
        const incorrectOptions = q.options.filter(opt => !opt.isCorrect)
        
        // Verificar inconsistencias:
        // 1. La opción correcta aparece en las explicaciones de opciones incorrectas
        const correctOptionInIncorrect = q.aiJustification.incorrectAnswersExplanation?.some(
          exp => exp.optionId === correctOption.id
        )
        
        // 2. El número de explicaciones incorrectas no coincide con el número real de opciones incorrectas
        const incorrectCountMismatch = q.aiJustification.incorrectAnswersExplanation?.length !== incorrectOptions.length
        
        // 3. Confianza muy baja (menor a 0.7)
        const lowConfidence = q.aiJustification.confidence < 0.7
        
        // 4. Explicación de respuesta correcta muy corta o faltante
        const shortExplanation = !q.aiJustification.correctAnswerExplanation || 
                                 q.aiJustification.correctAnswerExplanation.length < 50
        
        // 5. Falta alguna explicación de opción incorrecta
        const missingIncorrectExplanation = incorrectOptions.some(opt => 
          !q.aiJustification.incorrectAnswersExplanation?.some(exp => exp.optionId === opt.id)
        )
        
        return correctOptionInIncorrect || incorrectCountMismatch || lowConfidence || shortExplanation || missingIncorrectExplanation
      })
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
        // Limpiar datos de modalidades específicas de inglés
        setMatchingQuestions([])
        setClozeText('')
        setClozeGaps({})
        setReadingText('')
        setReadingImage(null)
        setReadingImagePreview(null)
        setReadingQuestions([])
        // Resetear modalidad de otras materias
        setOtherSubjectsModality('standard_mc')
        // Limpiar datos de comprensión de lectura de otras materias
        setOtherSubjectsReadingText('')
        setOtherSubjectsReadingImage(null)
        setOtherSubjectsReadingImagePreview(null)
        setOtherSubjectsReadingQuestions([])
      } else {
        // Si cambia a Inglés, también resetear modalidad a estándar
        setInglesModality('standard_mc')
        // Limpiar datos de modalidades específicas de inglés para empezar limpio
        setMatchingQuestions([])
        setClozeText('')
        setClozeGaps({})
        setReadingText('')
        setReadingImage(null)
        setReadingImagePreview(null)
        setReadingQuestions([])
        // Resetear modalidad de otras materias
        setOtherSubjectsModality('standard_mc')
        setOtherSubjectsReadingText('')
        setOtherSubjectsReadingImage(null)
        setOtherSubjectsReadingImagePreview(null)
        setOtherSubjectsReadingQuestions([])
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

  const removeOptionImage = async (optionId: string) => {
    // Buscar la opción para obtener su imageUrl
    const option = options.find(opt => opt.id === optionId)
    
    // Si la opción tiene una imagen en Firebase Storage, eliminarla
    if (option?.imageUrl && option.imageUrl.trim() !== '' && !option.imageUrl.startsWith('data:')) {
      try {
        console.log(`🗑️ Eliminando imagen de opción ${optionId} del Storage...`)
        await questionService.deleteImage(option.imageUrl)
        console.log('✅ Imagen eliminada del Storage correctamente')
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
      }
    }
    
    setOptionFiles({ ...optionFiles, [optionId]: null })
    setOptionImagePreviews({ ...optionImagePreviews, [optionId]: null })
    setOptions(options.map(opt => 
      opt.id === optionId ? { ...opt, imageUrl: null } : opt
    ))
  }

  // Funciones para manejar imágenes de opciones de comprensión lectora (creación)
  const handleReadingOptionImageUpload = (questionId: string, optionId: string, file: File) => {
    setReadingOptionFiles(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: file
      }
    }))
    
    // Crear previsualización
    const reader = new FileReader()
    reader.onloadend = () => {
      setReadingOptionImagePreviews(prev => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || {}),
          [optionId]: reader.result as string
        }
      }))
    }
    reader.readAsDataURL(file)
  }

  const removeReadingOptionImage = async (questionId: string, optionId: string) => {
    // Buscar la pregunta y opción para obtener su imageUrl
    const question = readingQuestions.find(rq => rq.id === questionId) || 
                     otherSubjectsReadingQuestions.find(rq => rq.id === questionId)
    const option = question?.options.find(opt => opt.id === optionId)
    
    // Si la opción tiene una imagen en Firebase Storage, eliminarla
    if (option?.imageUrl && option.imageUrl.trim() !== '' && !option.imageUrl.startsWith('data:')) {
      try {
        console.log(`🗑️ Eliminando imagen de opción ${optionId} de pregunta ${questionId} del Storage...`)
        await questionService.deleteImage(option.imageUrl)
        console.log('✅ Imagen eliminada del Storage correctamente')
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
      }
    }
    
    setReadingOptionFiles(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: null
      }
    }))
    setReadingOptionImagePreviews(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: null
      }
    }))
    setReadingQuestions(prev => prev.map(rq => 
      rq.id === questionId 
        ? {
            ...rq,
            options: rq.options.map(opt => 
              opt.id === optionId ? { ...opt, imageUrl: null } : opt
            )
          }
        : rq
    ))
    setOtherSubjectsReadingQuestions(prev => prev.map(rq => 
      rq.id === questionId 
        ? {
            ...rq,
            options: rq.options.map(opt => 
              opt.id === optionId ? { ...opt, imageUrl: null } : opt
            )
          }
        : rq
    ))
  }

  // Funciones para manejar imágenes de opciones de comprensión lectora (edición)
  const handleEditReadingOptionImageUpload = (questionId: string, optionId: string, file: File) => {
    setEditReadingOptionFiles(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: file
      }
    }))
    
    // Crear previsualización
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditReadingOptionImagePreviews(prev => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || {}),
          [optionId]: reader.result as string
        }
      }))
    }
    reader.readAsDataURL(file)
  }

  const removeEditReadingOptionImage = async (questionId: string, optionId: string) => {
    // Buscar la pregunta y opción para obtener su imageUrl
    const question = editReadingQuestions.find(rq => rq.questionId === questionId) || 
                     editOtherSubjectsReadingQuestions.find(rq => rq.questionId === questionId)
    const option = question?.options.find(opt => opt.id === optionId)
    
    // Si la opción tiene una imagen en Firebase Storage, eliminarla
    if (option?.imageUrl && option.imageUrl.trim() !== '' && !option.imageUrl.startsWith('data:')) {
      try {
        console.log(`🗑️ Eliminando imagen de opción ${optionId} de pregunta ${questionId} del Storage...`)
        await questionService.deleteImage(option.imageUrl)
        console.log('✅ Imagen eliminada del Storage correctamente')
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
      }
    }
    
    setEditReadingOptionFiles(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: null
      }
    }))
    setEditReadingOptionImagePreviews(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [optionId]: null
      }
    }))
    setEditReadingQuestions(prev => prev.map(rq => 
      rq.questionId === questionId 
        ? {
            ...rq,
            options: rq.options.map(opt => 
              opt.id === optionId ? { ...opt, imageUrl: null } : opt
            )
          }
        : rq
    ))
    setEditOtherSubjectsReadingQuestions(prev => prev.map(rq => 
      rq.questionId === questionId 
        ? {
            ...rq,
            options: rq.options.map(opt => 
              opt.id === optionId ? { ...opt, imageUrl: null } : opt
            )
          }
        : rq
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
    console.log('🔄 Reseteando formulario completamente...')
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
    console.log('✅ Modalidad de Inglés reseteada a: standard_mc')
    setMatchingQuestions([])
    setExpandedViewOptions(new Set())
    setClozeText('')
    setClozeGaps({})
    // Limpiar estados de comprensión de lectura
    setReadingText('')
    setReadingImage(null)
    setReadingImagePreview(null)
    setReadingQuestions([])
    // Limpiar estados de edición de cloze test
    setIsEditingClozeTest(false)
    setEditClozeText('')
    setEditClozeGaps({})
    setEditClozeRelatedQuestions([])
    // Limpiar estados de edición de comprensión de lectura
    setIsEditingReadingComprehension(false)
    setEditReadingText('')
    setEditReadingImage(null)
    setEditReadingImagePreview(null)
    setEditReadingExistingImageUrl(null)
    setEditReadingQuestions([])
    setEditReadingRelatedQuestions([])
    // Limpiar estados de comprensión de lectura de otras materias
    setOtherSubjectsModality('standard_mc')
    setOtherSubjectsReadingText('')
    setOtherSubjectsReadingImage(null)
    setOtherSubjectsReadingImagePreview(null)
    setOtherSubjectsReadingQuestions([])
    // Limpiar estados de edición de comprensión de lectura de otras materias
    setIsEditingOtherSubjectsReadingComprehension(false)
    setEditOtherSubjectsReadingText('')
    setEditOtherSubjectsReadingImage(null)
    setEditOtherSubjectsReadingImagePreview(null)
    setEditOtherSubjectsReadingExistingImageUrl(null)
    setEditOtherSubjectsReadingQuestions([])
    setEditOtherSubjectsReadingRelatedQuestions([])
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
        console.log('🔍 Validando pregunta de Inglés con modalidad:', inglesModality)
        
        if (inglesModality === 'matching_columns') {
          // Validar Matching / Columnas (nueva estructura por bloques)
          if (matchingQuestions.length === 0) {
            errors['matchingQuestions'] = true
            console.error('❌ Error: No hay preguntas de matching agregadas')
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
            console.error('❌ Error: No hay texto de Cloze Test')
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
              // Validar que tenga al menos 2 opciones
              if (gapData.options.length < 2) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              const emptyOptions = gapData.options.filter(opt => !opt.trim())
              if (emptyOptions.length > 0) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              // Validar que haya una respuesta correcta (debe ser una letra válida)
              const validLetters = gapData.options.map((_, idx) => getOptionLetter(idx))
              if (!gapData.correctAnswer || !validLetters.includes(gapData.correctAnswer)) {
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
              const emptyOptions = rq.options.filter(opt => (!opt.text || !opt.text.trim()) && !readingOptionImagePreviews[rq.id]?.[opt.id])
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
          // Extraer texto plano del HTML para validar correctamente
          let questionTextPlain = ''
          if (formData.questionText) {
            try {
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = formData.questionText
              questionTextPlain = (tempDiv.textContent || tempDiv.innerText || '').trim()
            } catch (e) {
              // Si falla, usar el texto directamente
              questionTextPlain = formData.questionText.trim()
            }
          }
          
          if (!questionTextPlain) {
            errors['questionText'] = true
            console.error('❌ Error: El texto de la pregunta está vacío')
          }
          // Validar que todas las opciones tengan contenido
          const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id])
          if (emptyOptions.length > 0) {
            errors['options'] = true
            console.error('❌ Error: Hay opciones vacías')
          }
          // Validar que haya exactamente una respuesta correcta
          const correctOptions = options.filter(opt => opt.isCorrect)
          if (correctOptions.length !== 1) {
            errors['correctAnswer'] = true
            console.error(`❌ Error: Debe haber exactamente una respuesta correcta, hay ${correctOptions.length}`)
          }
        }
      } else {
        // Materia no es Inglés - validar según modalidad
        if (otherSubjectsModality === 'reading_comprehension') {
          // Validar Comprensión de Lectura para otras materias
          if (!otherSubjectsReadingText.trim()) {
            errors['otherSubjectsReadingText'] = true
          }
          if (otherSubjectsReadingQuestions.length === 0) {
            errors['otherSubjectsReadingQuestions'] = true
          } else {
            // Validar cada pregunta de lectura
            otherSubjectsReadingQuestions.forEach((rq, rqIndex) => {
              // El texto de la pregunta es opcional, no se valida
              // Validar opciones de cada pregunta
              const emptyOptions = rq.options.filter(opt => (!opt.text || !opt.text.trim()) && !readingOptionImagePreviews[rq.id]?.[opt.id] && !opt.imageUrl)
              if (emptyOptions.length > 0) {
                errors[`otherSubjectsReadingQuestionOptions_${rqIndex}`] = true
              }
              // Validar que haya una respuesta correcta
              const correctOptions = rq.options.filter(opt => opt.isCorrect)
              if (correctOptions.length !== 1) {
                errors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`] = true
              }
            })
          }
        } else {
          // Modalidad estándar (standard_mc) para otras materias
          // Extraer texto plano del HTML para validar correctamente
          let questionTextPlain = ''
          if (formData.questionText) {
            try {
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = formData.questionText
              questionTextPlain = (tempDiv.textContent || tempDiv.innerText || '').trim()
            } catch (e) {
              // Si falla, usar el texto directamente
              questionTextPlain = formData.questionText.trim()
            }
          }
          
          if (!questionTextPlain) {
            errors['questionText'] = true
            console.error('❌ Error: El texto de la pregunta está vacío')
          }
          // Validar que todas las opciones tengan contenido
          const emptyOptions = options.filter(opt => !opt.text && !optionFiles[opt.id])
          if (emptyOptions.length > 0) {
            errors['options'] = true
            console.error('❌ Error: Hay opciones vacías')
          }
          // Validar que haya exactamente una respuesta correcta
          const correctOptions = options.filter(opt => opt.isCorrect)
          if (correctOptions.length !== 1) {
            errors['correctAnswer'] = true
            console.error(`❌ Error: Debe haber exactamente una respuesta correcta, hay ${correctOptions.length}`)
          }
        }
      }

      // Si hay errores, mostrarlos y resaltar campos
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        const errorMessages: string[] = []
        
        if (errors['subject']) errorMessages.push('Materia')
        if (errors['topic']) errorMessages.push('Tema')
        if (errors['questionText']) errorMessages.push('Texto de la Pregunta')
        if (errors['matchingQuestions']) {
          errorMessages.push('Preguntas de Matching (debe agregar al menos una)')
          // Mensaje adicional si está en modo matching pero no hay preguntas
          if (formData.subjectCode === 'IN' && inglesModality === 'matching_columns') {
            notifyError({ 
              title: 'Modalidad Incorrecta', 
              message: 'Está en modo "Matching / Columnas" pero no hay preguntas de matching. Si desea crear una pregunta estándar, cambie la modalidad a "Opción Múltiple Estándar".' 
            })
            return
          }
        }
        
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
        
        if (errors['clozeText']) {
          errorMessages.push('Texto a Completar (Cloze)')
          // Mensaje adicional si está en modo cloze test pero no hay texto
          if (formData.subjectCode === 'IN' && inglesModality === 'cloze_test') {
            notifyError({ 
              title: 'Modalidad Incorrecta', 
              message: 'Está en modo "Cloze Test / Rellenar Huecos" pero no hay texto de cloze. Si desea crear una pregunta estándar, cambie la modalidad a "Opción Múltiple Estándar".' 
            })
            return
          }
        }
        if (errors['readingText']) errorMessages.push('Texto de Lectura')
        if (errors['readingQuestions']) {
          errorMessages.push('Preguntas de Lectura (debe agregar al menos una)')
          // Mensaje adicional si está en modo reading comprehension pero no hay preguntas
          if (formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') {
            notifyError({ 
              title: 'Modalidad Incorrecta', 
              message: 'Está en modo "Comprensión de Lectura Corta" pero no hay preguntas de lectura. Si desea crear una pregunta estándar, cambie la modalidad a "Opción Múltiple Estándar".' 
            })
            return
          }
        }
        if (errors['otherSubjectsReadingText']) errorMessages.push('Texto de Lectura')
        if (errors['otherSubjectsReadingQuestions']) errorMessages.push('Preguntas de Lectura (debe agregar al menos una)')
        if (errors['options']) errorMessages.push('Opciones de Respuesta')
        if (errors['correctAnswer']) errorMessages.push('Respuesta Correcta')

        // Mensajes específicos para preguntas de lectura (Inglés)
        readingQuestions.forEach((_, rqIndex) => {
          // El texto de la pregunta es opcional, no se incluye en mensajes de error
          if (errors[`readingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`readingQuestionAnswer_${rqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${rqIndex + 1} de Lectura`)
          }
        })
        
        // Mensajes específicos para preguntas de lectura (otras materias)
        otherSubjectsReadingQuestions.forEach((_, rqIndex) => {
          if (errors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]) {
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

      // Validación preventiva: verificar consistencia entre modalidad y datos ANTES de procesar imágenes
      if (formData.subjectCode === 'IN') {
        console.log('🔍 Verificando consistencia de modalidad de Inglés:', inglesModality)
        
        if (inglesModality === 'matching_columns' && matchingQuestions.length === 0) {
          notifyError({ 
            title: 'Modalidad Incorrecta', 
            message: 'Ha seleccionado "Matching / Columnas" pero no ha agregado preguntas de matching. Por favor, cambie la modalidad a "Opción Múltiple Estándar" o agregue preguntas de matching.' 
          })
          return
        }
        
        if (inglesModality === 'cloze_test' && !clozeText.trim()) {
          notifyError({ 
            title: 'Modalidad Incorrecta', 
            message: 'Ha seleccionado "Cloze Test / Rellenar Huecos" pero no ha ingresado texto. Por favor, cambie la modalidad a "Opción Múltiple Estándar" o ingrese el texto con huecos.' 
          })
          return
        }
        
        if (inglesModality === 'reading_comprehension' && readingQuestions.length === 0) {
          notifyError({ 
            title: 'Modalidad Incorrecta', 
            message: 'Ha seleccionado "Comprensión de Lectura Corta" pero no ha agregado preguntas. Por favor, cambie la modalidad a "Opción Múltiple Estándar" o agregue preguntas de lectura.' 
          })
          return
        }
      }

      setIsLoading(true)
      console.log('🚀 Iniciando proceso de creación de pregunta...')
      console.log('📋 Modalidad actual:', formData.subjectCode === 'IN' ? `Inglés - ${inglesModality}` : formData.subject)

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
        
        // Crear identificador común para agrupar preguntas de matching/columnas
        // Usar un formato especial que combine el identificador con el texto real del usuario
        // Formato: MATCHING_COLUMNS_GROUP_ID|texto real del usuario
        const matchingGroupId = `${formData.topicCode}_${formData.grade}_${formData.levelCode}_${Date.now()}`
        const matchingGroupIdentifier = `MATCHING_COLUMNS_${matchingGroupId}`
        // Guardar el texto real del usuario (si existe) junto con el identificador
        const informativeTextValue = formData.informativeText && formData.informativeText.trim() 
          ? `${matchingGroupIdentifier}|${formData.informativeText.trim()}`
          : matchingGroupIdentifier
        
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
            // Procesar imagen de la pregunta si existe
            let questionImageUrl: string | null = null
            if (mq.questionImage) {
              console.log(`📤 Procesando imagen de pregunta ${i + 1}/${matchingQuestions.length}:`, mq.questionImage.name)
              try {
                // Intentar Firebase Storage primero con timeout
                const storagePromise = questionService.uploadImage(
                  mq.questionImage, 
                  `questions/question/${Date.now()}_matching_${i}_${mq.questionImage.name}`
                )
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000) // 10 segundos
                )
                
                const result = await Promise.race([storagePromise, timeoutPromise]) as any
                
                if (result.success) {
                  console.log('✅ Imagen de pregunta matching subida a Firebase:', result.data)
                  questionImageUrl = result.data
                } else {
                  throw new Error('Storage failed')
                }
              } catch (error) {
                console.log('⚠️ Fallback a Base64 para imagen de pregunta matching')
                try {
                  const base64Url = await fileToBase64(mq.questionImage)
                  console.log('✅ Imagen de pregunta matching convertida a Base64')
                  questionImageUrl = base64Url
                } catch (base64Error) {
                  console.error('❌ Error procesando imagen de pregunta matching:', base64Error)
                  questionImageUrl = null
                }
              }
            }
            
            const questionData: any = {
              ...formData,
              // Guardar el texto real del usuario junto con el identificador para agrupar
              informativeText: informativeTextValue,
              questionText: mq.questionText,
              answerType: 'MCQ' as const,
              options: mq.options,
            }
            
            // Debug: Verificar que el informativeText se esté estableciendo correctamente
            console.log(`🔗 Creando pregunta matching ${i + 1}/${matchingQuestions.length}:`, {
              code: questionData.code || 'N/A',
              informativeText: questionData.informativeText,
              questionText: questionData.questionText?.substring(0, 50) + '...',
              topicCode: questionData.topicCode,
              grade: questionData.grade,
              levelCode: questionData.levelCode
            })

            // Agregar imagen de la pregunta si existe
            if (questionImageUrl) {
              questionData.questionImages = [questionImageUrl]
            }

            // Solo agregar campos de imágenes informativas si tienen contenido
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

          // Crear opciones para esta pregunta (todas las opciones definidas por el usuario)
          const gapOptions: QuestionOption[] = gapData.options.map((optionText, optIndex) => {
            const letter = getOptionLetter(optIndex)
            return {
              id: letter as any,
              text: optionText || '',
              imageUrl: null,
              isCorrect: gapData.correctAnswer === letter
            }
          })

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
          
          // Procesar opciones de esta pregunta (todas las opciones definidas por el usuario)
          const rqOptionsPromises = rq.options.map(async (opt) => {
            let imageUrl = null
            
            // Procesar imagen de opción si existe
            if (readingOptionFiles[rq.id]?.[opt.id]) {
              console.log(`📤 Procesando imagen de opción ${opt.id} de pregunta ${i + 1}...`)
              try {
                const storagePromise = questionService.uploadImage(
                  readingOptionFiles[rq.id][opt.id]!, 
                  `questions/reading/options/${Date.now()}_q${i + 1}_${opt.id}.jpg`
                )
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000)
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
                  imageUrl = await fileToBase64(readingOptionFiles[rq.id][opt.id]!)
                  console.log('✅ Imagen de opción convertida a Base64')
                } catch (base64Error) {
                  console.error('❌ Error procesando imagen de opción:', base64Error)
                }
              }
            }
            
            return {
              id: opt.id,
              text: opt.text || '',
              imageUrl: imageUrl || opt.imageUrl, // Usar imagen nueva o existente
              isCorrect: opt.isCorrect
            }
          })
          
          const rqOptions: QuestionOption[] = await Promise.all(rqOptionsPromises)

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
      } else if (formData.subjectCode !== 'IN' && otherSubjectsModality === 'reading_comprehension') {
        // Manejar Comprensión de Lectura para otras materias: crear múltiples preguntas
        console.log('📚 Modo Comprensión de Lectura (Otras Materias): Creando múltiples preguntas...')
        
        // Procesar imagen de lectura si existe
        let readingImageUrl: string | null = null
        if (otherSubjectsReadingImage) {
          try {
            notifySuccess({ 
              title: 'Procesando', 
              message: 'Subiendo imagen de lectura...' 
            })
            const storagePromise = questionService.uploadImage(
              otherSubjectsReadingImage, 
              `questions/reading/${Date.now()}_reading.jpg`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            if (result.success) {
              readingImageUrl = result.data
            } else {
              const base64Url = await fileToBase64(otherSubjectsReadingImage)
              readingImageUrl = base64Url
            }
          } catch (error) {
            console.error('Error procesando imagen de lectura:', error)
            const base64Url = await fileToBase64(otherSubjectsReadingImage)
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
          message: `Guardando ${otherSubjectsReadingQuestions.length} pregunta(s) en la base de datos...` 
        })

        for (let i = 0; i < otherSubjectsReadingQuestions.length; i++) {
          const rq = otherSubjectsReadingQuestions[i]
          
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
          
          // Procesar opciones de esta pregunta (todas las opciones definidas por el usuario)
          const rqOptionsPromises = rq.options.map(async (opt) => {
            let imageUrl = null
            
            // Procesar imagen de opción si existe
            if (readingOptionFiles[rq.id]?.[opt.id]) {
              console.log(`📤 Procesando imagen de opción ${opt.id} de pregunta ${i + 1} (otras materias)...`)
              try {
                const storagePromise = questionService.uploadImage(
                  readingOptionFiles[rq.id][opt.id]!, 
                  `questions/reading/options/${Date.now()}_q${i + 1}_${opt.id}.jpg`
                )
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000)
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
                  imageUrl = await fileToBase64(readingOptionFiles[rq.id][opt.id]!)
                  console.log('✅ Imagen de opción convertida a Base64')
                } catch (base64Error) {
                  console.error('❌ Error procesando imagen de opción:', base64Error)
                }
              }
            }
            
            return {
              id: opt.id,
              text: opt.text || '',
              imageUrl: imageUrl || opt.imageUrl, // Usar imagen nueva o existente
              isCorrect: opt.isCorrect
            }
          })
          
          const rqOptions: QuestionOption[] = await Promise.all(rqOptionsPromises)

          const questionData: any = {
            ...formData,
            answerType: 'MCQ' as const,
            informativeText: otherSubjectsReadingText, // El texto base va en informativeText
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
            console.log(`📝 Creando pregunta ${i + 1}/${otherSubjectsReadingQuestions.length}...`)
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
        if (successCount === otherSubjectsReadingQuestions.length) {
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
            message: `Se crearon ${successCount} pregunta(s) de ${otherSubjectsReadingQuestions.length}. ${errorCount} fallaron.` 
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
        console.log('📝 Preparando datos de la pregunta estándar...')
        console.log('📋 Materia:', formData.subjectCode, formData.subject)
        console.log('📋 Modalidad:', formData.subjectCode === 'IN' ? inglesModality : otherSubjectsModality)
        console.log('📋 Tema:', formData.topicCode, formData.topic)
        console.log('📋 Grado:', formData.grade, 'Nivel:', formData.levelCode)
        console.log('📋 Opciones finales:', finalOptions.length)
        
        try {
          // Preparar datos base de la pregunta
          const questionData: any = {
            subject: formData.subject,
            subjectCode: formData.subjectCode,
            topic: formData.topic,
            topicCode: formData.topicCode,
            grade: formData.grade,
            level: formData.level,
            levelCode: formData.levelCode,
            questionText: formData.questionText,
            answerType: 'MCQ' as const,
            options: finalOptions,
          }

          // Solo agregar informativeText si tiene contenido válido (no vacío ni undefined)
          if (formData.informativeText && formData.informativeText.trim()) {
            questionData.informativeText = formData.informativeText.trim()
          }

          // Solo agregar campos de imágenes si tienen contenido (evitar undefined)
          if (informativeImageUrls.length > 0) {
            questionData.informativeImages = informativeImageUrls
          }
          if (questionImageUrls.length > 0) {
            questionData.questionImages = questionImageUrls
          }

          console.log('📝 Datos de la pregunta preparados:', {
            subjectCode: questionData.subjectCode,
            topicCode: questionData.topicCode,
            grade: questionData.grade,
            levelCode: questionData.levelCode,
            questionTextLength: questionData.questionText?.length || 0,
            optionsCount: questionData.options?.length || 0,
            hasInformativeImages: !!questionData.informativeImages,
            hasQuestionImages: !!questionData.questionImages
          })
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

          if (result && result.success) {
            notifySuccess({ 
              title: 'Éxito', 
              message: `Pregunta creada con código: ${result.data.code}` 
            })
            resetForm()
            setIsCreateDialogOpen(false)
            loadQuestions()
            loadStats()
          } else {
            const errorMsg = result?.error || result?.message || 'No se pudo crear la pregunta'
            console.error('❌ Error en createQuestion:', errorMsg)
            notifyError({ 
              title: 'Error', 
              message: errorMsg
            })
          }
        } catch (error) {
          console.error('❌ Error al preparar o crear pregunta estándar:', error)
          throw error // Re-lanzar para que lo capture el catch externo
        }
      }
    } catch (error) {
      console.error('❌ Error al crear pregunta:', error)
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No disponible')
      
      let errorMessage = 'Error al crear la pregunta'
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message)
        console.error('❌ Error name:', error.name)
        
        if (error.message.includes('Timeout')) {
          errorMessage = 'La operación tardó demasiado. Verifique su conexión y la configuración de Firebase.'
        } else if (error.message.includes('Permission') || error.message.includes('permission')) {
          errorMessage = 'No tiene permisos para crear preguntas. Verifique su rol de administrador.'
        } else if (error.message.includes('Storage') || error.message.includes('storage')) {
          errorMessage = 'Error con el almacenamiento de imágenes. Verifique la configuración de Firebase Storage.'
        } else if (error.message.includes('Network') || error.message.includes('network')) {
          errorMessage = 'Error de conexión. Verifique su conexión a internet e intente nuevamente.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      } else {
        console.error('❌ Error desconocido:', error)
        errorMessage = 'Error desconocido al crear la pregunta. Por favor, verifique los datos e intente nuevamente.'
      }
      
      try {
        notifyError({ 
          title: 'Error al crear pregunta', 
          message: errorMessage 
        })
      } catch (notificationError) {
        console.error('❌ Error al mostrar notificación:', notificationError)
        // Si falla la notificación, al menos loguearlo
        alert(`Error: ${errorMessage}`)
      }
    } finally {
      // Asegurar que siempre se restaure el estado de loading
      try {
        setIsLoading(false)
        console.log('🏁 Proceso de creación finalizado')
      } catch (finallyError) {
        console.error('❌ Error en finally block:', finallyError)
        // Si todo falla, al menos intentar restaurar el estado manualmente
        setTimeout(() => setIsLoading(false), 100)
      }
    }
  }

  const handleViewQuestion = (question: Question) => {
    setSelectedQuestion(question)
    
    // Verificar si es una pregunta agrupada (comprensión de lectura, cloze test, o matching/columnas)
    const isMatchingColumns = question.subjectCode === 'IN' && 
                             question.informativeText && 
                             typeof question.informativeText === 'string' &&
                             (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                              question.informativeText.includes('MATCHING_COLUMNS_'))
    
    const isClozeTest = !isMatchingColumns && 
                       question.subjectCode === 'IN' && 
                       question.informativeText && 
                       question.questionText?.includes('completar el hueco')
    
    const isEnglishReadingComprehension = !isMatchingColumns && 
                                         !isClozeTest &&
                                         question.subjectCode === 'IN' && 
                                         question.informativeText
    
    const isOtherSubjectsReadingComprehension = !isMatchingColumns && 
                                               !isClozeTest &&
                                               !isEnglishReadingComprehension &&
                                               question.subjectCode !== 'IN' && 
                                               question.informativeText &&
                                               typeof question.informativeText === 'string' &&
                                               question.informativeText.trim().length > 0 &&
                                               !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                               !question.questionText?.includes('completar el hueco')
    
    // Si es una pregunta agrupada, buscar preguntas relacionadas
    if (question.informativeText && (isMatchingColumns || isClozeTest || isEnglishReadingComprehension || isOtherSubjectsReadingComprehension)) {
      let related: Question[] = []
      
      if (isMatchingColumns) {
        // Para matching/columnas, agrupar por identificador de grupo
        const questionGroupId = extractMatchingGroupId(question.informativeText)
        related = questions.filter(q => {
          if (q.subjectCode !== 'IN' || q.id === question.id ||
              q.topicCode !== question.topicCode ||
              q.grade !== question.grade ||
              q.levelCode !== question.levelCode) {
            return false
          }
          const qGroupId = extractMatchingGroupId(q.informativeText)
          return qGroupId && questionGroupId && qGroupId === questionGroupId
        })
      } else if (isClozeTest) {
        // Para cloze test, agrupar por informativeText completo e imágenes
        related = questions.filter(q => 
          q.subjectCode === 'IN' &&
          q.id !== question.id &&
          q.informativeText === question.informativeText &&
          JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
          q.topicCode === question.topicCode &&
          q.grade === question.grade &&
          q.levelCode === question.levelCode &&
          q.questionText?.includes('completar el hueco')
        )
      } else if (isEnglishReadingComprehension) {
        // Para comprensión de lectura de inglés
        related = questions.filter(q => 
          q.subjectCode === 'IN' &&
          q.id !== question.id &&
          q.informativeText === question.informativeText &&
          JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
          q.topicCode === question.topicCode &&
          q.grade === question.grade &&
          q.levelCode === question.levelCode &&
          !q.questionText?.includes('completar el hueco') &&
          !q.informativeText?.includes('MATCHING_COLUMNS_')
        )
      } else if (isOtherSubjectsReadingComprehension) {
        // Para comprensión de lectura de otras materias
        related = questions.filter(q => 
          q.subjectCode === question.subjectCode &&
          q.id !== question.id &&
          q.informativeText === question.informativeText &&
          JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
          q.topicCode === question.topicCode &&
          q.grade === question.grade &&
          q.levelCode === question.levelCode &&
          !q.questionText?.includes('completar el hueco') &&
          !q.informativeText?.includes('MATCHING_COLUMNS_')
        )
      }
      
      // Ordenar las preguntas relacionadas por orden de creación (más antigua primero)
      const allRelated = [question, ...related].sort(sortQuestionsByCreationOrder)
      setRelatedQuestions(allRelated)
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
    
    // Verificar si es una pregunta de matching/columnas (PRIORIDAD MÁS ALTA)
    // Formato: MATCHING_COLUMNS_GROUP_ID|texto real o solo MATCHING_COLUMNS_GROUP_ID
    const isMatchingColumns = question.subjectCode === 'IN' && 
                             question.informativeText && 
                             typeof question.informativeText === 'string' &&
                             (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                              question.informativeText.includes('MATCHING_COLUMNS_'))
    
    // Verificar si es una pregunta de cloze test
    const isClozeTest = !isMatchingColumns && 
                        question.subjectCode === 'IN' && 
                        question.informativeText && 
                        question.questionText?.includes('completar el hueco')
    
    // Verificar si es una pregunta de comprensión de lectura (Inglés)
    // Las preguntas de comprensión de lectura tienen informativeText pero NO tienen "completar el hueco" y NO son matching/columnas
    const isReadingComprehension = !isMatchingColumns && 
                                   !isClozeTest &&
                                   question.subjectCode === 'IN' && 
                                   question.informativeText && 
                                   typeof question.informativeText === 'string' &&
                                   question.informativeText.trim().length > 0 &&
                                   !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                   !question.questionText?.includes('completar el hueco')
    
    // Verificar si es una pregunta de comprensión de lectura para otras materias
    // Las preguntas de comprensión de lectura tienen informativeText pero NO son de inglés
    const isOtherSubjectsReadingComprehension = !isMatchingColumns && 
                                                !isClozeTest &&
                                                !isReadingComprehension &&
                                                question.subjectCode !== 'IN' && 
                                                question.informativeText && 
                                                typeof question.informativeText === 'string' &&
                                                question.informativeText.trim().length > 0 &&
                                                !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                                !question.questionText?.includes('completar el hueco')
    
    // Debug: Verificar la detección de modalidad
    console.log('🔍 Detección de modalidad para edición:', {
      code: question.code,
      subjectCode: question.subjectCode,
      isMatchingColumns,
      isClozeTest,
      isReadingComprehension,
      hasInformativeText: !!question.informativeText,
      informativeTextPreview: question.informativeText?.substring(0, 50),
      questionTextPreview: question.questionText?.substring(0, 50)
    })
    
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
      
      // Ordenar las preguntas relacionadas por orden de creación (más antigua primero)
      const sortedRelated = related.sort(sortQuestionsByCreationOrder)
      setEditClozeRelatedQuestions(sortedRelated)
      setIsEditingClozeTest(true)
      
      // Cargar el texto completo del cloze test
      setEditClozeText(question.informativeText || '')
      
      // Extraer los datos de cada hueco de las preguntas relacionadas
      const gapsData: { [key: number]: { options: string[], correctAnswer: string } } = {}
      
      related.forEach(q => {
        const match = q.questionText?.match(/hueco \[(\d+)\]/)
        if (match) {
          const gapNum = parseInt(match[1])
          // Extraer todas las opciones (no solo A, B, C)
          const options = q.options.map(opt => opt.text || '')
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
    } else if (isReadingComprehension) {
      // Modo de edición de comprensión de lectura
      console.log('📚 Modo de edición de comprensión de lectura detectado')
      setIsEditingClozeTest(false)
      setIsEditingReadingComprehension(true)
      setInglesModality('reading_comprehension')
      
      // Limpiar estados que no corresponden a comprensión de lectura
      setMatchingQuestions([])
      setClozeText('')
      setClozeGaps({})
      
      // Buscar todas las preguntas relacionadas de comprensión de lectura
      const related = questions.filter(q => 
        q.subjectCode === 'IN' &&
        q.informativeText === question.informativeText &&
        JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
        q.topicCode === question.topicCode &&
        q.grade === question.grade &&
        q.levelCode === question.levelCode &&
        !q.questionText?.includes('completar el hueco') &&
        !q.informativeText?.includes('MATCHING_COLUMNS_')
      )
      
      // Ordenar las preguntas relacionadas por orden de creación (más antigua primero)
      const sortedRelated = related.sort(sortQuestionsByCreationOrder)
      
      console.log('📚 Preguntas relacionadas de comprensión de lectura encontradas:', sortedRelated.length)
      setEditReadingRelatedQuestions(sortedRelated)
      
      // Cargar el texto de lectura
      setEditReadingText(question.informativeText || '')
      console.log('📚 Texto de lectura cargado:', question.informativeText?.substring(0, 50))
      
      // Separar la imagen de lectura de las imágenes informativas
      // La última imagen en informativeImages suele ser la imagen de lectura
      const informativeImages = question.informativeImages || []
      if (informativeImages.length > 0) {
        // Asumimos que la última imagen es la de lectura (como se guarda en la creación)
        setEditReadingExistingImageUrl(informativeImages[informativeImages.length - 1])
        setEditReadingImagePreview(informativeImages[informativeImages.length - 1])
        // Las demás son imágenes informativas normales
        setInformativeImagePreviews(informativeImages.slice(0, -1))
      } else {
        setEditReadingExistingImageUrl(null)
        setEditReadingImagePreview(null)
        setInformativeImagePreviews([])
      }
      
      // Cargar las preguntas relacionadas
      const readingQuestionsData = related.map((q, index) => {
        const questionImages = q.questionImages || []
        const questionImageUrl = questionImages.length > 0 ? questionImages[0] : null
        
        // Cargar todas las opciones de la pregunta
        const allOptions = q.options || []
        
        return {
          id: q.id || '',
          questionId: `edit-reading-q-${index}-${Date.now()}`,
          questionText: q.questionText || '',
          questionImage: null,
          questionImagePreview: questionImageUrl,
          existingQuestionImageUrl: questionImageUrl,
          options: allOptions
        }
      })
      
      setEditReadingQuestions(readingQuestionsData)
      
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
    } else if (isOtherSubjectsReadingComprehension) {
      // Modo de edición de comprensión de lectura para otras materias
      console.log('📚 Modo de edición de comprensión de lectura (otras materias) detectado')
      setIsEditingClozeTest(false)
      setIsEditingReadingComprehension(false)
      setIsEditingOtherSubjectsReadingComprehension(true)
      setOtherSubjectsModality('reading_comprehension')
      
      // Limpiar estados que no corresponden
      setMatchingQuestions([])
      setClozeText('')
      setClozeGaps({})
      setReadingText('')
      setReadingImage(null)
      setReadingImagePreview(null)
      setReadingQuestions([])
      
      // Buscar todas las preguntas relacionadas de comprensión de lectura
      const related = questions.filter(q => 
        q.subjectCode === question.subjectCode &&
        q.informativeText === question.informativeText &&
        JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
        q.topicCode === question.topicCode &&
        q.grade === question.grade &&
        q.levelCode === question.levelCode &&
        !q.questionText?.includes('completar el hueco') &&
        !q.informativeText?.includes('MATCHING_COLUMNS_')
      )
      
      // Ordenar las preguntas relacionadas por orden de creación (más antigua primero)
      const sortedRelated = related.sort(sortQuestionsByCreationOrder)
      
      console.log('📚 Preguntas relacionadas de comprensión de lectura (otras materias) encontradas:', sortedRelated.length)
      setEditOtherSubjectsReadingRelatedQuestions(sortedRelated)
      
      // Cargar el texto de lectura
      setEditOtherSubjectsReadingText(question.informativeText || '')
      console.log('📚 Texto de lectura cargado:', question.informativeText?.substring(0, 50))
      
      // Cargar imágenes informativas y imagen de lectura
      const informativeImages = question.informativeImages || []
      // La última imagen suele ser la imagen de lectura (si existe)
      if (informativeImages.length > 0) {
        const lastImage = informativeImages[informativeImages.length - 1]
        setEditOtherSubjectsReadingExistingImageUrl(lastImage)
        // Las demás son imágenes informativas normales (excluyendo la última)
        const informativeOnlyImages = informativeImages.slice(0, -1)
        setInformativeImagePreviews(informativeOnlyImages)
      } else {
        setInformativeImagePreviews([])
      }
      
      // Cargar preguntas relacionadas
      const readingQuestionsData = sortedRelated.map((q, index) => {
        const questionImages = q.questionImages || []
        const questionImageUrl = questionImages.length > 0 ? questionImages[0] : null
        
        // Extraer todas las opciones (pueden ser más de 4)
        const allOptions = q.options || []
        
        return {
          id: q.id || `rq-temp-${Date.now()}-${index}`, // ID de la pregunta en la base de datos
          questionId: `q${index + 1}`, // ID único para el formulario
          questionText: q.questionText || '',
          questionImage: null,
          questionImagePreview: questionImageUrl,
          existingQuestionImageUrl: questionImageUrl,
          options: allOptions
        }
      })
      
      setEditOtherSubjectsReadingQuestions(readingQuestionsData)
      
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
    } else if (isMatchingColumns) {
      // Modo de edición de matching/columnas
      setIsEditingClozeTest(false)
      setIsEditingReadingComprehension(false)
      setInglesModality('matching_columns')
      
      // Buscar todas las preguntas relacionadas de matching/columnas
      // Agrupar por identificador de grupo, no por texto completo
      const questionGroupId = extractMatchingGroupId(question.informativeText)
      const related = questions.filter(q => {
        if (q.subjectCode !== 'IN' || q.topicCode !== question.topicCode ||
            q.grade !== question.grade || q.levelCode !== question.levelCode) {
          return false
        }
        const qGroupId = extractMatchingGroupId(q.informativeText)
        return qGroupId && questionGroupId && qGroupId === questionGroupId
      })
      
      // Convertir preguntas relacionadas al formato de matching/columnas
      // IMPORTANTE: Preservar el ID real de Firestore para poder actualizar correctamente
      const matchingQuestionsData = related.map(q => {
        const questionImages = q.questionImages || []
        const questionImageUrl = questionImages.length > 0 ? questionImages[0] : null
        
        return {
          id: q.id || `mq-temp-${Date.now()}-${Math.random()}`, // Usar prefijo 'mq-temp-' para IDs temporales
          questionText: q.questionText || '',
          questionImage: null,
          questionImagePreview: questionImageUrl,
          options: q.options || []
        }
      })
      
      console.log('🔗 Preguntas de matching/columnas cargadas para edición:', {
        count: matchingQuestionsData.length,
        ids: matchingQuestionsData.map(mq => ({ id: mq.id, hasQuestionText: !!mq.questionText }))
      })
      
      setMatchingQuestions(matchingQuestionsData)
      
      // Cargar datos básicos del formulario
      const gradeValue = String(question.grade || '').trim() as '6' | '7' | '8' | '9' | '0' | '1'
      // Extraer el texto real del usuario (sin el identificador)
      const realText = extractMatchingText(question.informativeText)
      setFormData({
        subject: question.subject,
        subjectCode: question.subjectCode,
        topic: question.topic,
        topicCode: question.topicCode,
        grade: gradeValue,
        level: question.level as any,
        levelCode: question.levelCode as any,
        informativeText: realText, // Cargar solo el texto real del usuario
        questionText: question.questionText,
      })
      
      // Cargar imágenes informativas si existen
      setInformativeImagePreviews(question.informativeImages || [])
      
      console.log('🔗 Pregunta de matching/columnas cargada para edición:', {
        matchingQuestionsCount: matchingQuestionsData.length,
        informativeText: question.informativeText,
        relatedQuestionsCount: related.length
      })
    } else {
      // Modo de edición normal (no cloze test, no comprensión de lectura, no matching/columnas)
      console.log('📝 Modo de edición normal detectado (no modalidades especiales)')
      setIsEditingClozeTest(false)
      setIsEditingReadingComprehension(false)
      setIsEditingOtherSubjectsReadingComprehension(false)
      setInglesModality('standard_mc')
      setOtherSubjectsModality('standard_mc')
      
      // Limpiar estados de modalidades especiales
      setMatchingQuestions([])
      setClozeText('')
      setClozeGaps({})
      setEditReadingText('')
      setEditReadingQuestions([])
      setEditReadingRelatedQuestions([])
      setEditOtherSubjectsReadingText('')
      setEditOtherSubjectsReadingImage(null)
      setEditOtherSubjectsReadingImagePreview(null)
      setEditOtherSubjectsReadingExistingImageUrl(null)
      setEditOtherSubjectsReadingQuestions([])
      setEditOtherSubjectsReadingRelatedQuestions([])
      
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
        isEditingReadingComprehension: false,
        isEditingClozeTest: false,
        inglesModality: 'standard_mc'
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

  // Funciones para selección múltiple
  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const selectAllQuestions = () => {
    const allIds = new Set(filteredQuestions.map(q => q.id).filter(Boolean) as string[])
    setSelectedQuestionIds(allIds)
  }

  const deselectAllQuestions = () => {
    setSelectedQuestionIds(new Set())
  }

  const handleDeleteSelectedQuestions = async () => {
    if (selectedQuestionIds.size === 0) {
      notifyError({
        title: 'Error',
        message: 'No hay preguntas seleccionadas para eliminar'
      })
      return
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${selectedQuestionIds.size} pregunta(s)? Esta acción no se puede deshacer.`)) {
      return
    }

    if (!currentUser || currentUser.role !== 'admin') {
      notifyError({
        title: 'Error',
        message: 'No tienes permisos para eliminar preguntas'
      })
      return
    }

    const idsToDelete = Array.from(selectedQuestionIds)
    const originalQuestions = [...questions]
    const originalFilteredQuestions = [...filteredQuestions]
    
    // Actualización optimista: eliminar del estado local inmediatamente
    const updatedQuestions = questions.filter(q => q.id && !idsToDelete.includes(q.id))
    setQuestions(updatedQuestions)
    
    const updatedFilteredQuestions = filteredQuestions.filter(q => q.id && !idsToDelete.includes(q.id))
    setFilteredQuestions(updatedFilteredQuestions)
    
    // Limpiar selección
    setSelectedQuestionIds(new Set())
    
    setIsLoading(true)
    let successCount = 0
    let errorCount = 0

    try {
      // Eliminar cada pregunta
      for (const id of idsToDelete) {
        try {
          const result = await questionService.deleteQuestion(id)
          if (result.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Error al eliminar pregunta ${id}:`, result.error)
          }
        } catch (error) {
          errorCount++
          console.error(`Excepción al eliminar pregunta ${id}:`, error)
        }
      }

      // Recargar las preguntas desde la base de datos para asegurar consistencia
      await loadQuestions()
      await loadStats()

      if (errorCount === 0) {
        notifySuccess({
          title: 'Éxito',
          message: `${successCount} pregunta(s) eliminada(s) correctamente`
        })
      } else {
        notifyError({
          title: 'Eliminación parcial',
          message: `${successCount} pregunta(s) eliminada(s), ${errorCount} fallaron. Se restauraron las preguntas en el estado local.`
        })
        // Restaurar el estado original si hubo errores
        setQuestions(originalQuestions)
        setFilteredQuestions(originalFilteredQuestions)
      }
    } catch (error: any) {
      console.error('Error general al eliminar preguntas:', error)
      // Restaurar el estado original
      setQuestions(originalQuestions)
      setFilteredQuestions(originalFilteredQuestions)
      
      notifyError({
        title: 'Error',
        message: `Error al eliminar las preguntas: ${error?.message || 'Error desconocido'}`
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
              // Validar que tenga al menos 2 opciones
              if (gapData.options.length < 2) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              const emptyOptions = gapData.options.filter(opt => !opt.trim())
              if (emptyOptions.length > 0) {
                errors[`clozeGapOptions_${gapNum}`] = true
              }
              // Validar que haya una respuesta correcta (debe ser una letra válida)
              const validLetters = gapData.options.map((_, idx) => getOptionLetter(idx))
              if (!gapData.correctAnswer || !validLetters.includes(gapData.correctAnswer)) {
                errors[`clozeGapAnswer_${gapNum}`] = true
              }
            }
          })
        } else if (inglesModality === 'reading_comprehension' || isEditingReadingComprehension) {
          // Validar Comprensión de Lectura (creación o edición)
          const textToValidate = isEditingReadingComprehension ? editReadingText : readingText
          const questionsToValidate = isEditingReadingComprehension ? editReadingQuestions : readingQuestions
          
          if (!textToValidate.trim()) {
            errors['readingText'] = true
          }
          if (questionsToValidate.length === 0) {
            errors['readingQuestions'] = true
          } else {
            // Validar cada pregunta de lectura
            questionsToValidate.forEach((rq, rqIndex) => {
              // Validar opciones de cada pregunta
              const emptyOptions = rq.options.filter(opt => (!opt.text || !opt.text.trim()) && !readingOptionImagePreviews[rq.id]?.[opt.id] && !opt.imageUrl)
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
        // Materia no es Inglés
        if (isEditingOtherSubjectsReadingComprehension) {
          // Validar Comprensión de Lectura para otras materias (edición)
          if (!editOtherSubjectsReadingText.trim()) {
            errors['otherSubjectsReadingText'] = true
          }
          if (editOtherSubjectsReadingQuestions.length === 0) {
            errors['otherSubjectsReadingQuestions'] = true
          } else {
            // Validar cada pregunta de lectura
            editOtherSubjectsReadingQuestions.forEach((rq, rqIndex) => {
              // Validar opciones de cada pregunta
              const emptyOptions = rq.options.filter(opt => (!opt.text || !opt.text.trim()) && !readingOptionImagePreviews[rq.id]?.[opt.id] && !opt.imageUrl)
              if (emptyOptions.length > 0) {
                errors[`otherSubjectsReadingQuestionOptions_${rqIndex}`] = true
              }
              // Validar que haya una respuesta correcta
              const correctOptions = rq.options.filter(opt => opt.isCorrect)
              if (correctOptions.length !== 1) {
                errors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`] = true
              }
            })
          }
        } else {
          // Validación estándar para otras materias
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
            errorMessages.push(`Opciones de la Pregunta ${gapNum} (deben completarse todas las opciones, mínimo 2)`)
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

        // Mensajes específicos para preguntas de lectura (inglés)
        readingQuestions.forEach((_, rqIndex) => {
          if (errors[`readingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`readingQuestionAnswer_${rqIndex}`]) {
            errorMessages.push(`Respuesta Correcta de Pregunta ${rqIndex + 1} de Lectura`)
          }
        })
        
        // Mensajes específicos para comprensión de lectura de otras materias
        if (errors['otherSubjectsReadingText']) errorMessages.push('Texto de Lectura')
        if (errors['otherSubjectsReadingQuestions']) errorMessages.push('Preguntas de Lectura (debe agregar al menos una)')
        editOtherSubjectsReadingQuestions.forEach((_, rqIndex) => {
          if (errors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]) {
            errorMessages.push(`Opciones de Pregunta ${rqIndex + 1} de Lectura`)
          }
          if (errors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]) {
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
        
        // Buscar la opción original para detectar si se eliminó una imagen
        const originalOption = selectedQuestion?.options?.find(o => o.id === option.id)
        const hadImageBefore = originalOption?.imageUrl && originalOption.imageUrl.trim() !== ''
        const hasImageNow = option.imageUrl && option.imageUrl.trim() !== ''
        
        // Si tenía imagen antes pero ahora no, eliminarla del Storage
        if (hadImageBefore && !hasImageNow && !optionFiles[option.id] && originalOption?.imageUrl) {
          console.log(`🗑️ Eliminando imagen de opción ${option.id}...`)
          try {
            await questionService.deleteImage(originalOption.imageUrl)
            console.log('✅ Imagen de opción eliminada del Storage')
          } catch (error) {
            console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
          }
          imageUrl = null
        }
        
        if (optionFiles[option.id]) {
          // Si había una imagen anterior, eliminarla antes de subir la nueva
          if (hadImageBefore && originalOption?.imageUrl) {
            try {
              await questionService.deleteImage(originalOption.imageUrl)
              console.log('✅ Imagen anterior de opción eliminada del Storage')
            } catch (error) {
              console.warn('⚠️ No se pudo eliminar la imagen anterior del Storage:', error)
            }
          }
          
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
            // Validar que tenga al menos 2 opciones
            if (!gapData.options || !Array.isArray(gapData.options) || gapData.options.length < 2) {
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
            // Validar que haya una respuesta correcta (debe ser una letra válida)
            const validLetters = gapData.options.map((_, idx) => getOptionLetter(idx))
            if (!gapData.correctAnswer || typeof gapData.correctAnswer !== 'string' || !validLetters.includes(gapData.correctAnswer)) {
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
                errorMessages.push(`Pregunta ${gapNum} - Complete todas las opciones (mínimo 2)`)
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
          
          // Crear opciones para esta pregunta (todas las opciones definidas por el usuario)
          const gapOptions: QuestionOption[] = gapData.options.map((optionText, optIndex) => {
            const letter = getOptionLetter(optIndex)
            return {
              id: letter as any,
              text: optionText || '',
              imageUrl: null,
              isCorrect: gapData.correctAnswer === letter
            }
          })
          
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
      } else if (isEditingReadingComprehension) {
        // Manejar actualización de Comprensión de Lectura
        // Validar que todos los campos estén completos
        if (!editReadingText.trim()) {
          notifyError({ 
            title: 'Error', 
            message: 'El texto de lectura es obligatorio' 
          })
          setIsLoading(false)
          return
        }
        
        if (editReadingQuestions.length === 0) {
          notifyError({ 
            title: 'Error', 
            message: 'Debe agregar al menos una pregunta' 
          })
          setIsLoading(false)
          return
        }
        
        // Procesar nueva imagen de lectura si existe
        let newReadingImageUrl: string | null = null
        if (editReadingImage) {
          try {
            notifySuccess({ 
              title: 'Procesando', 
              message: 'Subiendo nueva imagen de lectura...' 
            })
            const storagePromise = questionService.uploadImage(
              editReadingImage, 
              `questions/reading/${Date.now()}_reading.jpg`
            )
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            )
            const result = await Promise.race([storagePromise, timeoutPromise]) as any
            if (result.success) {
              newReadingImageUrl = result.data
            } else {
              const base64Url = await fileToBase64(editReadingImage)
              newReadingImageUrl = base64Url
            }
          } catch (error) {
            console.error('Error procesando imagen de lectura:', error)
            const base64Url = await fileToBase64(editReadingImage)
            newReadingImageUrl = base64Url
          }
        }
        
        // Combinar imágenes informativas con la imagen de lectura
        const allInformativeImages = [...informativeImagePreviews]
        if (newReadingImageUrl) {
          allInformativeImages.push(newReadingImageUrl)
        } else if (editReadingExistingImageUrl) {
          allInformativeImages.push(editReadingExistingImageUrl)
        }
        
        // Actualizar todas las preguntas relacionadas de comprensión de lectura
        let successCount = 0
        let errorCount = 0
        const updatedCodes: string[] = []
        
        notifySuccess({
          title: 'Actualizando',
          message: `Actualizando ${editReadingQuestions.length} pregunta(s) de comprensión de lectura...`
        })
        
        for (let i = 0; i < editReadingQuestions.length; i++) {
          const rq = editReadingQuestions[i]
          
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
          } else if (rq.existingQuestionImageUrl) {
            questionImageUrl = rq.existingQuestionImageUrl
          }
          
          // Buscar la pregunta correspondiente
          let relatedQuestion: Question | undefined
          if (rq.id) {
            relatedQuestion = editReadingRelatedQuestions.find(q => q.id === rq.id)
          }
          
          // Verificar si cambiaron los parámetros que afectan el código
          const oldSubjectCode = relatedQuestion ? String(relatedQuestion.subjectCode || '').trim() : String(formData.subjectCode || '').trim()
          const newSubjectCode = String(formData.subjectCode || '').trim()
          const oldTopicCode = relatedQuestion ? String(relatedQuestion.topicCode || '').trim() : String(formData.topicCode || '').trim()
          const newTopicCode = String(formData.topicCode || '').trim()
          const oldGrade = relatedQuestion ? String(relatedQuestion.grade || '').trim() : String(formData.grade || '').trim()
          const newGrade = String(formData.grade || '').trim()
          const oldLevelCode = relatedQuestion ? String(relatedQuestion.levelCode || '').trim() : String(formData.levelCode || '').trim()
          const newLevelCode = String(formData.levelCode || '').trim()
          
          const codeParamsChanged = 
            oldSubjectCode !== newSubjectCode ||
            oldTopicCode !== newTopicCode ||
            oldGrade !== newGrade ||
            oldLevelCode !== newLevelCode
          
          // Generar nuevo código si es necesario
          let questionNewCode: string | undefined = undefined
          if (codeParamsChanged || !relatedQuestion) {
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
          
          // Preparar opciones (todas las opciones definidas por el usuario)
          const rqOptionsPromises = rq.options.map(async (opt) => {
            let imageUrl = opt.imageUrl || null
            
            // Buscar la opción original para detectar si se eliminó una imagen
            const originalOption = relatedQuestion?.options?.find(o => o.id === opt.id)
            const hadImageBefore = originalOption?.imageUrl && originalOption.imageUrl.trim() !== ''
            const hasImageNow = opt.imageUrl && opt.imageUrl.trim() !== ''
            
            // Si tenía imagen antes pero ahora no, eliminarla del Storage
            if (hadImageBefore && !hasImageNow && !editReadingOptionFiles[rq.questionId]?.[opt.id] && originalOption?.imageUrl) {
              console.log(`🗑️ Eliminando imagen de opción ${opt.id} de pregunta ${i + 1}...`)
              try {
                await questionService.deleteImage(originalOption.imageUrl)
                console.log('✅ Imagen de opción eliminada del Storage')
              } catch (error) {
                console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
              }
              imageUrl = null
            }
            
            // Procesar imagen de opción si existe una nueva
            if (editReadingOptionFiles[rq.questionId]?.[opt.id]) {
              console.log(`📤 Procesando nueva imagen de opción ${opt.id} de pregunta ${i + 1}...`)
              
              // Si había una imagen anterior, eliminarla
              if (hadImageBefore && originalOption?.imageUrl) {
                try {
                  await questionService.deleteImage(originalOption.imageUrl)
                  console.log('✅ Imagen anterior eliminada del Storage')
                } catch (error) {
                  console.warn('⚠️ No se pudo eliminar la imagen anterior del Storage:', error)
                }
              }
              
              try {
                const storagePromise = questionService.uploadImage(
                  editReadingOptionFiles[rq.questionId][opt.id]!, 
                  `questions/reading/options/${Date.now()}_q${i + 1}_${opt.id}.jpg`
                )
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000)
                )
                const result = await Promise.race([storagePromise, timeoutPromise]) as any
                
                if (result.success) {
                  imageUrl = result.data
                  console.log('✅ Nueva imagen de opción subida a Firebase:', result.data)
                } else {
                  throw new Error('Storage failed')
                }
              } catch (error) {
                console.log('⚠️ Fallback a Base64 para nueva imagen de opción')
                try {
                  imageUrl = await fileToBase64(editReadingOptionFiles[rq.questionId][opt.id]!)
                  console.log('✅ Nueva imagen de opción convertida a Base64')
                } catch (base64Error) {
                  console.error('❌ Error procesando nueva imagen de opción:', base64Error)
                  // Mantener la imagen existente si hay error
                }
              }
            }
            
            return {
              id: opt.id,
              text: opt.text || '',
              imageUrl: imageUrl,
              isCorrect: opt.isCorrect
            }
          })
          
          const rqOptions: QuestionOption[] = await Promise.all(rqOptionsPromises)
          
          // Preparar datos de actualización o creación
          const questionData: any = {
            subject: formData.subject,
            subjectCode: formData.subjectCode,
            topic: formData.topic,
            topicCode: formData.topicCode,
            grade: formData.grade,
            level: formData.level,
            levelCode: formData.levelCode,
            answerType: 'MCQ' as const,
            informativeText: editReadingText,
            questionText: rq.questionText,
            options: rqOptions,
          }
          
          if (allInformativeImages.length > 0) {
            questionData.informativeImages = allInformativeImages
          }
          
          if (questionImageUrl) {
            questionData.questionImages = [questionImageUrl]
          }
          
          if (questionNewCode) {
            questionData.code = questionNewCode
          }
          
          try {
            if (relatedQuestion && relatedQuestion.id) {
              const result = await questionService.updateQuestion(relatedQuestion.id, questionData)
              if (result.success) {
                successCount++
                updatedCodes.push(questionNewCode || relatedQuestion.code)
              } else {
                errorCount++
                console.error(`❌ Error actualizando pregunta ${i + 1}:`, result.error)
              }
            } else {
              if (!currentUser) {
                errorCount++
                continue
              }
              const result = await questionService.createQuestion(questionData, currentUser.uid)
              if (result.success) {
                successCount++
                updatedCodes.push(result.data.code)
              } else {
                errorCount++
                console.error(`❌ Error creando pregunta ${i + 1}:`, result.error)
              }
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error procesando pregunta ${i + 1}:`, error)
          }
        }
        
        // Eliminar preguntas que fueron removidas del formulario
        const currentQuestionIds = editReadingQuestions.filter(rq => rq.id).map(rq => rq.id!).filter((id): id is string => Boolean(id))
        const questionsToDelete = editReadingRelatedQuestions.filter(q => {
          if (!q.id) return false
          return !currentQuestionIds.includes(q.id)
        })
        
        for (const questionToDelete of questionsToDelete) {
          if (questionToDelete.id) {
            try {
              await questionService.deleteQuestion(questionToDelete.id)
              console.log(`✅ Pregunta ${questionToDelete.code} eliminada`)
            } catch (error) {
              console.error(`❌ Error eliminando pregunta ${questionToDelete.code}:`, error)
            }
          }
        }
        
        if (successCount === editReadingQuestions.length) {
          notifySuccess({
            title: 'Éxito',
            message: `${successCount} pregunta(s) de comprensión de lectura actualizada(s) correctamente.`
          })
          resetForm()
          setIsEditDialogOpen(false)
          setSelectedQuestion(null)
          setIsEditingReadingComprehension(false)
          setEditReadingText('')
          setEditReadingImage(null)
          setEditReadingImagePreview(null)
          setEditReadingExistingImageUrl(null)
          setEditReadingQuestions([])
          setEditReadingRelatedQuestions([])
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({
            title: 'Advertencia',
            message: `Se actualizaron ${successCount} pregunta(s) de ${editReadingQuestions.length}. ${errorCount} fallaron.`
          })
          loadQuestions()
          loadStats()
            } else {
              notifyError({
                title: 'Error',
                message: 'No se pudo actualizar ninguna pregunta de comprensión de lectura.'
              })
            }
          } else if (isEditingOtherSubjectsReadingComprehension) {
            // Manejar actualización de Comprensión de Lectura para otras materias
            if (!editOtherSubjectsReadingText.trim()) {
              notifyError({ 
                title: 'Error', 
                message: 'El texto de lectura es obligatorio' 
              })
              setIsLoading(false)
              return
            }
            
            if (editOtherSubjectsReadingQuestions.length === 0) {
              notifyError({ 
                title: 'Error', 
                message: 'Debe agregar al menos una pregunta' 
              })
              setIsLoading(false)
              return
            }
            
            // Procesar nueva imagen de lectura si existe
            let newReadingImageUrl: string | null = null
            if (editOtherSubjectsReadingImage) {
              try {
                notifySuccess({ 
                  title: 'Procesando', 
                  message: 'Subiendo nueva imagen de lectura...' 
                })
                const storagePromise = questionService.uploadImage(
                  editOtherSubjectsReadingImage, 
                  `questions/reading/${Date.now()}_reading.jpg`
                )
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 10000)
                )
                const result = await Promise.race([storagePromise, timeoutPromise]) as any
                if (result.success) {
                  newReadingImageUrl = result.data
                } else {
                  const base64Url = await fileToBase64(editOtherSubjectsReadingImage)
                  newReadingImageUrl = base64Url
                }
              } catch (error) {
                console.error('Error procesando imagen de lectura:', error)
                const base64Url = await fileToBase64(editOtherSubjectsReadingImage)
                newReadingImageUrl = base64Url
              }
            }
            
            // Combinar imágenes informativas con la imagen de lectura
            const allInformativeImages = [...informativeImagePreviews]
            if (newReadingImageUrl) {
              allInformativeImages.push(newReadingImageUrl)
            } else if (editOtherSubjectsReadingExistingImageUrl) {
              allInformativeImages.push(editOtherSubjectsReadingExistingImageUrl)
            }
            
            // Actualizar todas las preguntas relacionadas
            let successCount = 0
            let errorCount = 0
            const updatedCodes: string[] = []
            
            notifySuccess({
              title: 'Actualizando',
              message: `Actualizando ${editOtherSubjectsReadingQuestions.length} pregunta(s) de comprensión de lectura...`
            })
            
            for (let i = 0; i < editOtherSubjectsReadingQuestions.length; i++) {
              const rq = editOtherSubjectsReadingQuestions[i]
              
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
              } else if (rq.existingQuestionImageUrl) {
                questionImageUrl = rq.existingQuestionImageUrl
              }
              
              // Buscar la pregunta correspondiente
              let relatedQuestion: Question | undefined
              if (rq.id) {
                relatedQuestion = editOtherSubjectsReadingRelatedQuestions.find(q => q.id === rq.id)
              }
              
              // Verificar si cambiaron los parámetros que afectan el código
              const oldSubjectCode = relatedQuestion ? String(relatedQuestion.subjectCode || '').trim() : String(formData.subjectCode || '').trim()
              const newSubjectCode = String(formData.subjectCode || '').trim()
              const oldTopicCode = relatedQuestion ? String(relatedQuestion.topicCode || '').trim() : String(formData.topicCode || '').trim()
              const newTopicCode = String(formData.topicCode || '').trim()
              const oldGrade = relatedQuestion ? String(relatedQuestion.grade || '').trim() : String(formData.grade || '').trim()
              const newGrade = String(formData.grade || '').trim()
              const oldLevelCode = relatedQuestion ? String(relatedQuestion.levelCode || '').trim() : String(formData.levelCode || '').trim()
              const newLevelCode = String(formData.levelCode || '').trim()
              
              const codeParamsChanged = 
                oldSubjectCode !== newSubjectCode ||
                oldTopicCode !== newTopicCode ||
                oldGrade !== newGrade ||
                oldLevelCode !== newLevelCode
              
              // Generar nuevo código si es necesario
              let questionNewCode: string | undefined = undefined
              if (codeParamsChanged || !relatedQuestion) {
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
              
              // Preparar opciones
              const rqOptionsPromises = rq.options.map(async (opt) => {
                let imageUrl = opt.imageUrl || null
                
                // Buscar la opción original para detectar si se eliminó una imagen
                const originalOption = relatedQuestion?.options?.find(o => o.id === opt.id)
                const hadImageBefore = originalOption?.imageUrl && originalOption.imageUrl.trim() !== ''
                const hasImageNow = opt.imageUrl && opt.imageUrl.trim() !== ''
                
                // Si tenía imagen antes pero ahora no, eliminarla del Storage
                if (hadImageBefore && !hasImageNow && !editReadingOptionFiles[rq.questionId]?.[opt.id] && originalOption?.imageUrl) {
                  console.log(`🗑️ Eliminando imagen de opción ${opt.id} de pregunta ${i + 1} (otras materias)...`)
                  try {
                    await questionService.deleteImage(originalOption.imageUrl)
                    console.log('✅ Imagen de opción eliminada del Storage')
                  } catch (error) {
                    console.warn('⚠️ No se pudo eliminar la imagen del Storage:', error)
                  }
                  imageUrl = null
                }
                
                // Procesar imagen de opción si existe una nueva
                if (editReadingOptionFiles[rq.questionId]?.[opt.id]) {
                  console.log(`📤 Procesando nueva imagen de opción ${opt.id} de pregunta ${i + 1} (otras materias)...`)
                  
                  // Si había una imagen anterior, eliminarla
                  if (hadImageBefore && originalOption?.imageUrl) {
                    try {
                      await questionService.deleteImage(originalOption.imageUrl)
                      console.log('✅ Imagen anterior eliminada del Storage')
                    } catch (error) {
                      console.warn('⚠️ No se pudo eliminar la imagen anterior del Storage:', error)
                    }
                  }
                  
                  try {
                    const storagePromise = questionService.uploadImage(
                      editReadingOptionFiles[rq.questionId][opt.id]!, 
                      `questions/reading/options/${Date.now()}_q${i + 1}_${opt.id}.jpg`
                    )
                    const timeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Timeout')), 10000)
                    )
                    const result = await Promise.race([storagePromise, timeoutPromise]) as any
                    
                    if (result.success) {
                      imageUrl = result.data
                      console.log('✅ Nueva imagen de opción subida a Firebase:', result.data)
                    } else {
                      throw new Error('Storage failed')
                    }
                  } catch (error) {
                    console.log('⚠️ Fallback a Base64 para nueva imagen de opción')
                    try {
                      imageUrl = await fileToBase64(editReadingOptionFiles[rq.questionId][opt.id]!)
                      console.log('✅ Nueva imagen de opción convertida a Base64')
                    } catch (base64Error) {
                      console.error('❌ Error procesando nueva imagen de opción:', base64Error)
                      // Mantener la imagen existente si hay error
                    }
                  }
                }
                
                return {
                  id: opt.id,
                  text: opt.text || '',
                  imageUrl: imageUrl,
                  isCorrect: opt.isCorrect
                }
              })
              
              const rqOptions: QuestionOption[] = await Promise.all(rqOptionsPromises)
              
              // Preparar datos de actualización o creación
              const questionData: any = {
                subject: formData.subject,
                subjectCode: formData.subjectCode,
                topic: formData.topic,
                topicCode: formData.topicCode,
                grade: formData.grade,
                level: formData.level,
                levelCode: formData.levelCode,
                answerType: 'MCQ' as const,
                informativeText: editOtherSubjectsReadingText,
                questionText: rq.questionText,
                options: rqOptions,
              }
              
              if (allInformativeImages.length > 0) {
                questionData.informativeImages = allInformativeImages
              }
              
              // Manejar imágenes de pregunta: si hay nueva imagen, usarla; si se eliminó la existente, establecer array vacío
              if (questionImageUrl) {
                questionData.questionImages = [questionImageUrl]
              } else if (relatedQuestion && relatedQuestion.questionImages && relatedQuestion.questionImages.length > 0 && !rq.existingQuestionImageUrl) {
                // Si había una imagen existente pero fue eliminada, establecer array vacío
                questionData.questionImages = []
              } else if (rq.existingQuestionImageUrl) {
                // Mantener la imagen existente si no se eliminó
                questionData.questionImages = [rq.existingQuestionImageUrl]
              }
              
              if (questionNewCode) {
                questionData.code = questionNewCode
              }
              
              try {
                if (relatedQuestion && relatedQuestion.id) {
                  const result = await questionService.updateQuestion(relatedQuestion.id, questionData)
                  if (result.success) {
                    successCount++
                    updatedCodes.push(questionNewCode || relatedQuestion.code)
                  } else {
                    errorCount++
                    console.error(`❌ Error actualizando pregunta ${i + 1}:`, result.error)
                  }
                } else {
                  if (!currentUser) {
                    errorCount++
                    continue
                  }
                  const result = await questionService.createQuestion(questionData, currentUser.uid)
                  if (result.success) {
                    successCount++
                    updatedCodes.push(result.data.code)
                  } else {
                    errorCount++
                    console.error(`❌ Error creando pregunta ${i + 1}:`, result.error)
                  }
                }
              } catch (error) {
                errorCount++
                console.error(`❌ Error procesando pregunta ${i + 1}:`, error)
              }
            }
            
            // Eliminar preguntas que fueron removidas
            const currentQuestionIds = editOtherSubjectsReadingQuestions.filter(rq => rq.id).map(rq => rq.id!).filter((id): id is string => Boolean(id))
            const questionsToDelete = editOtherSubjectsReadingRelatedQuestions.filter(q => {
              if (!q.id) return false
              return !currentQuestionIds.includes(q.id)
            })
            
            for (const questionToDelete of questionsToDelete) {
              if (questionToDelete.id) {
                try {
                  await questionService.deleteQuestion(questionToDelete.id)
                  console.log(`✅ Pregunta ${questionToDelete.code} eliminada`)
                } catch (error) {
                  console.error(`❌ Error eliminando pregunta ${questionToDelete.code}:`, error)
                }
              }
            }
            
            if (successCount === editOtherSubjectsReadingQuestions.length) {
              notifySuccess({
                title: 'Éxito',
                message: `${successCount} pregunta(s) de comprensión de lectura actualizada(s) correctamente.`
              })
              resetForm()
              setIsEditDialogOpen(false)
              setSelectedQuestion(null)
              setIsEditingOtherSubjectsReadingComprehension(false)
              setEditOtherSubjectsReadingText('')
              setEditOtherSubjectsReadingImage(null)
              setEditOtherSubjectsReadingImagePreview(null)
              setEditOtherSubjectsReadingExistingImageUrl(null)
              setEditOtherSubjectsReadingQuestions([])
              setEditOtherSubjectsReadingRelatedQuestions([])
              loadQuestions()
              loadStats()
            } else if (successCount > 0) {
              notifyError({
                title: 'Advertencia',
                message: `Se actualizaron ${successCount} pregunta(s) de ${editOtherSubjectsReadingQuestions.length}. ${errorCount} fallaron.`
              })
              loadQuestions()
              loadStats()
            } else {
              notifyError({
                title: 'Error',
                message: 'No se pudo actualizar ninguna pregunta de comprensión de lectura.'
              })
            }
          } else if (inglesModality === 'matching_columns' || 
                     (formData.subjectCode === 'IN' && 
                      formData.informativeText && 
                      typeof formData.informativeText === 'string' &&
                      formData.informativeText.startsWith('MATCHING_COLUMNS_'))) {
        // Manejar actualización de Matching / Columnas
        // Validar que todas las preguntas estén completas
        if (matchingQuestions.length === 0) {
          notifyError({ 
            title: 'Error', 
            message: 'Debe agregar al menos una pregunta de matching/columnas' 
          })
          setIsLoading(false)
          return
        }
        
        // Validar cada pregunta de matching
        const matchingErrors: { [key: string]: boolean } = {}
        matchingQuestions.forEach((mq, mqIndex) => {
          if (!mq.questionText || !mq.questionText.trim()) {
            matchingErrors[`matchingQuestionText_${mqIndex}`] = true
          }
          const validOptions = mq.options.filter(opt => opt.text && opt.text.trim())
          if (validOptions.length < 2) {
            matchingErrors[`matchingQuestionOptions_${mqIndex}`] = true
          }
          const hasCorrectAnswer = mq.options.some(opt => opt.isCorrect)
          if (!hasCorrectAnswer) {
            matchingErrors[`matchingQuestionAnswer_${mqIndex}`] = true
          }
        })
        
        if (Object.keys(matchingErrors).length > 0) {
          setFieldErrors(matchingErrors)
          notifyError({
            title: 'Error',
            message: 'Complete todos los campos de las preguntas de matching/columnas'
          })
          setIsLoading(false)
          return
        }
        
        // Buscar todas las preguntas relacionadas de matching/columnas
        // IMPORTANTE: Usar selectedQuestion.informativeText para obtener el identificador original
        // porque formData.informativeText solo contiene el texto real del usuario (sin el identificador)
        const currentGroupId = extractMatchingGroupId(selectedQuestion?.informativeText || '')
        
        // IMPORTANTE: Usar el topicCode original de la pregunta seleccionada para buscar las preguntas relacionadas
        // porque si el usuario cambia de prueba (topicCode), las preguntas relacionadas todavía tienen el topicCode antiguo
        const originalTopicCode = selectedQuestion?.topicCode || formData.topicCode
        const originalGrade = selectedQuestion?.grade || formData.grade
        const originalLevelCode = selectedQuestion?.levelCode || formData.levelCode
        
        console.log('🔍 Actualizando matching/columnas:', {
          currentGroupId,
          originalTopicCode,
          newTopicCode: formData.topicCode,
          selectedQuestionInformativeText: selectedQuestion?.informativeText,
          formDataInformativeText: formData.informativeText,
          matchingQuestionsCount: matchingQuestions.length,
          matchingQuestionsIds: matchingQuestions.map(mq => mq.id)
        })
        
        // Buscar preguntas relacionadas usando el topicCode original (no el nuevo)
        // Esto permite encontrar las preguntas incluso cuando se cambia de prueba
        const related = currentGroupId ? questions.filter(q => {
          if (q.subjectCode !== 'IN' || q.topicCode !== originalTopicCode || 
              q.grade !== originalGrade || q.levelCode !== originalLevelCode) {
            return false
          }
          // Comparar por identificador de grupo
          const qGroupId = extractMatchingGroupId(q.informativeText)
          return qGroupId && qGroupId === currentGroupId
        }) : []
        
        console.log('🔍 Preguntas relacionadas encontradas:', related.length)
        
        // Procesar imágenes informativas nuevas
        let finalInformativeImages = [...informativeImagePreviews]
        if (newInformativeImageUrls.length > 0) {
          finalInformativeImages = [...finalInformativeImages, ...newInformativeImageUrls]
        }
        
        // Actualizar todas las preguntas relacionadas de matching/columnas
        let successCount = 0
        let errorCount = 0
        const updatedCodes: string[] = []
        
        notifySuccess({
          title: 'Actualizando',
          message: `Actualizando ${matchingQuestions.length} pregunta(s) de matching/columnas...`
        })
        
        for (let i = 0; i < matchingQuestions.length; i++) {
          const mq = matchingQuestions[i]
          
          // Procesar imagen de la pregunta si existe
          let questionImageUrl: string | null = null
          if (mq.questionImage) {
            try {
              const storagePromise = questionService.uploadImage(
                mq.questionImage, 
                `questions/question/${Date.now()}_matching_${i}_${mq.questionImage.name}`
              )
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
              )
              const result = await Promise.race([storagePromise, timeoutPromise]) as any
              if (result.success) {
                questionImageUrl = result.data
              } else {
                const base64Url = await fileToBase64(mq.questionImage)
                questionImageUrl = base64Url
              }
            } catch (error) {
              console.error('Error procesando imagen de pregunta matching:', error)
              const base64Url = await fileToBase64(mq.questionImage)
              questionImageUrl = base64Url
            }
          } else if (mq.questionImagePreview && 
                     (mq.questionImagePreview.startsWith('data:') || mq.questionImagePreview.startsWith('http'))) {
            // Mantener imagen existente
            questionImageUrl = mq.questionImagePreview
          }
          
          // Buscar la pregunta correspondiente por ID si existe, o por índice si no hay ID
          let relatedQuestion: Question | null = null
          
          // Si la pregunta de matching tiene un ID (pregunta existente), buscarla por ID
          // Solo usar IDs que no sean temporales (los IDs temporales empiezan con 'mq-temp-' o 'mq-edit-')
          // Los IDs de Firestore suelen ser strings alfanuméricos largos, no empiezan con 'mq-'
          const isTemporaryId = mq.id && (mq.id.startsWith('mq-temp-') || mq.id.startsWith('mq-edit-') || mq.id.startsWith('mq-') || mq.id.length < 10)
          
          if (mq.id && mq.id.trim() !== '' && !isTemporaryId) {
            relatedQuestion = related.find(q => q.id === mq.id) || null
            console.log(`🔍 Buscando pregunta por ID: ${mq.id}, encontrada: ${!!relatedQuestion}`)
          } else {
            console.log(`🔍 ID temporal o inválido para matching ${i + 1}: ${mq.id}, isTemporary: ${isTemporaryId}`)
          }
          
          // Si no se encontró por ID o no hay ID válido, buscar por índice
          if (!relatedQuestion && i < related.length) {
            relatedQuestion = related[i]
            console.log(`🔍 Usando pregunta relacionada por índice ${i}`)
          }
          
          // Si no hay pregunta relacionada, es una nueva pregunta que debe crearse
          if (!relatedQuestion) {
            console.log(`🆕 Nueva pregunta de matching ${i + 1} - se procesará después`)
            // Marcar para creación posterior si no hay currentGroupId
            if (!currentGroupId) {
              console.error(`❌ No se puede crear nueva pregunta sin identificador de grupo`)
              errorCount++
              continue
            }
            // Si hay currentGroupId pero no se encontró la pregunta relacionada,
            // puede ser que la pregunta tenga un ID que no coincide o que no esté en el array related
            // Intentar buscar en todas las preguntas por ID si existe
            if (mq.id && mq.id.trim() !== '' && !mq.id.startsWith('mq-temp-') && !mq.id.startsWith('mq-edit-') && !mq.id.startsWith('mq-') && mq.id.length >= 10) {
              const foundInAll = questions.find(q => q.id === mq.id)
              if (foundInAll) {
                // Verificar que la pregunta encontrada pertenezca al mismo grupo de matching
                const foundGroupId = extractMatchingGroupId(foundInAll.informativeText)
                if (foundGroupId && foundGroupId === currentGroupId) {
                  console.log(`🔍 Pregunta encontrada en todas las preguntas por ID: ${mq.id}`)
                  relatedQuestion = foundInAll
                } else {
                  console.error(`❌ La pregunta encontrada (ID: ${mq.id}) no pertenece al mismo grupo de matching. Grupo esperado: ${currentGroupId}, Grupo encontrado: ${foundGroupId}`)
                  errorCount++
                  continue
                }
              } else {
                console.error(`❌ No se encontró la pregunta relacionada para matching ${i + 1} (ID: ${mq.id}). Verifique que la pregunta exista en la base de datos.`)
                errorCount++
                continue
              }
            } else {
              // Si hay currentGroupId, podemos crear la pregunta nueva
              // Pero primero necesitamos procesar las actualizaciones existentes
              // Por ahora, marcamos error pero podríamos implementar creación aquí
              console.error(`❌ Nueva pregunta no soportada en actualización (índice ${i + 1}). ID: ${mq.id || 'sin ID'}`)
              errorCount++
              continue
            }
          }
          
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
          
          // Preparar datos de actualización - IMPORTANTE: Reconstruir el formato con el texto real
          // Obtener el identificador de grupo original (del relatedQuestion o usar el currentGroupId)
          const originalGroupId = extractMatchingGroupId(relatedQuestion.informativeText) || currentGroupId
          
          if (!originalGroupId) {
            console.error(`❌ No se pudo obtener el identificador de grupo para matching ${i + 1}`)
            errorCount++
            continue
          }
          
          // Construir el nuevo informativeText con el formato: GROUP_ID|texto real
          const newInformativeText = formData.informativeText && formData.informativeText.trim()
            ? `${originalGroupId}|${formData.informativeText.trim()}`
            : originalGroupId
          
          console.log(`📝 Actualizando pregunta matching ${i + 1}:`, {
            questionId: relatedQuestion.id,
            originalGroupId,
            newInformativeText: newInformativeText.substring(0, 50) + '...'
          })
          
          const updates: any = {
            subject: formData.subject,
            subjectCode: formData.subjectCode,
            topic: formData.topic,
            topicCode: formData.topicCode,
            grade: formData.grade,
            level: formData.level,
            levelCode: formData.levelCode,
            informativeText: newInformativeText, // Mantener el formato: GROUP_ID|texto real
            questionText: mq.questionText,
            options: mq.options,
            informativeImages: finalInformativeImages
          }
          
          // Agregar imagen de la pregunta si existe
          if (questionImageUrl) {
            updates.questionImages = [questionImageUrl]
          }
          
          if (questionNewCode) {
            updates.code = questionNewCode
          }
          
          const questionId = relatedQuestion.id
          
          if (!questionId) {
            console.error(`❌ La pregunta relacionada no tiene ID para matching ${i + 1}`)
            errorCount++
            continue
          }
          
          try {
            const result = await questionService.updateQuestion(questionId, updates)
            if (result.success) {
              successCount++
              updatedCodes.push(questionNewCode || relatedQuestion.code)
            } else {
              errorCount++
              console.error(`❌ Error actualizando pregunta matching ${i + 1}:`, result.error)
            }
          } catch (error) {
            errorCount++
            console.error(`❌ Error actualizando pregunta matching ${i + 1}:`, error)
          }
        }
        
        if (successCount === matchingQuestions.length) {
          notifySuccess({
            title: 'Éxito',
            message: `${successCount} pregunta(s) de matching/columnas actualizada(s) correctamente.`
          })
          resetForm()
          setIsEditDialogOpen(false)
          setSelectedQuestion(null)
          setMatchingQuestions([])
          setInglesModality('standard_mc')
          loadQuestions()
          loadStats()
        } else if (successCount > 0) {
          notifyError({
            title: 'Advertencia',
            message: `Se actualizaron ${successCount} pregunta(s) de ${matchingQuestions.length}. ${errorCount} fallaron.`
          })
          loadQuestions()
          loadStats()
        } else {
          notifyError({
            title: 'Error',
            message: 'No se pudo actualizar ninguna pregunta de matching/columnas.'
          })
        }
      } else {
        // Actualización normal (no cloze test, no comprensión de lectura)
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
    
    // Ordenar preguntas dentro de cada nivel por fecha de creación (más reciente primero)
    Object.keys(hierarchy).forEach(subjectCode => {
      Object.keys(hierarchy[subjectCode]).forEach(topicCode => {
        Object.keys(hierarchy[subjectCode][topicCode]).forEach(grade => {
          Object.keys(hierarchy[subjectCode][topicCode][grade]).forEach(level => {
            hierarchy[subjectCode][topicCode][grade][level].sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime()
              const dateB = new Date(b.createdAt).getTime()
              return dateB - dateA // Más reciente primero
            })
          })
        })
      })
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
  const renderQuestion = (question: Question) => {
    const isSelected = question.id ? selectedQuestionIds.has(question.id) : false
    
    return (
      <div 
        key={question.id} 
        className={cn(
          'p-3 rounded-lg border cursor-pointer transition-colors ml-8',
          theme === 'dark' 
            ? isSelected 
              ? 'border-blue-500 bg-blue-950/20 hover:bg-blue-950/30' 
              : 'border-zinc-700 hover:bg-zinc-800'
            : isSelected
              ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
              : 'border-gray-200 hover:bg-gray-50'
        )}
        onClick={() => handleViewQuestion(question)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div 
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => question.id && toggleQuestionSelection(question.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
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
          </div>
          <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
                <Eye className="h-4 w-4" />
              </Button>
              {/* Símbolo de alarma si la justificación de IA tiene problemas */}
              {(() => {
                const hasIssues = question.aiJustification && (
                  (question.aiJustification.confidence < 0.7) ||
                  (!question.aiJustification.correctAnswerExplanation || question.aiJustification.correctAnswerExplanation.length < 50) ||
                  (!question.aiJustification.incorrectAnswersExplanation || question.aiJustification.incorrectAnswersExplanation.length === 0) ||
                  (!question.aiJustification.keyConcepts || question.aiJustification.keyConcepts.length < 2)
                )
                if (hasIssues) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("flex items-center justify-center h-6 w-6 rounded-full", theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')}>
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>La justificación de IA tiene problemas de calidad</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                return null
              })()}
            </div>
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
  }

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
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            // Cuando se abre el diálogo, resetear el formulario completamente
            if (open) {
              console.log('🔄 Abriendo diálogo de creación - Reseteando formulario...')
              resetForm()
            }
          }}>
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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

            {/* Filtro de inconsistencias con IA */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-ai-inconsistency"
                checked={filterAIInconsistency}
                onCheckedChange={(checked) => setFilterAIInconsistency(checked === true)}
                className={cn(theme === 'dark' ? 'border-zinc-600' : '')}
              />
              <Label 
                htmlFor="filter-ai-inconsistency" 
                className={cn("text-sm cursor-pointer flex items-center gap-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
              >
                <AlertCircle className={cn("h-4 w-4", filterAIInconsistency ? 'text-orange-500' : 'text-gray-400')} />
                Inconsistencias con IA
              </Label>
            </div>
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
                setFilterAIInconsistency(false)
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
            <div className="flex items-center gap-4">
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Preguntas ({filteredQuestions.length})
              </CardTitle>
              {selectedQuestionIds.size > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {selectedQuestionIds.size} seleccionada{selectedQuestionIds.size > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedQuestionIds.size > 0 && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelectedQuestions}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Borrar seleccionadas ({selectedQuestionIds.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllQuestions}
                  >
                    Deseleccionar todo
                  </Button>
                </>
              )}
              {selectedQuestionIds.size === 0 && filteredQuestions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllQuestions}
                >
                  Seleccionar todo
                </Button>
              )}
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
                    <Button onClick={() => {
                      resetForm()
                      setIsCreateDialogOpen(true)
                    }} className="bg-black text-white hover:bg-gray-800">
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
                  
                  // Detectar preguntas de matching/columnas (identificadas por informativeText que contiene "MATCHING_COLUMNS_")
                  const isMatchingColumns = question.subjectCode === 'IN' && 
                                          question.informativeText && 
                                          typeof question.informativeText === 'string' &&
                                          (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                           question.informativeText.includes('MATCHING_COLUMNS_'))
                  
                  // Detectar si es cloze test (solo para inglés)
                  const isClozeTest = question.subjectCode === 'IN' && 
                                     question.questionText?.includes('completar el hueco')
                  
                  // Detectar si es comprensión de lectura para inglés
                  const isEnglishReadingComprehension = question.subjectCode === 'IN' && 
                                                       question.informativeText && 
                                                       !isMatchingColumns && 
                                                       !isClozeTest
                  
                  // Detectar si es comprensión de lectura para otras materias
                  // IMPORTANTE: Solo es comprensión de lectura si hay múltiples preguntas con el mismo informativeText
                  // Si solo hay una pregunta con informativeText, es Opción Múltiple Estándar
                  const hasMultipleWithSameInformativeText = questions.some(q => 
                    q.informativeText === question.informativeText && 
                    q.id !== question.id &&
                    q.subjectCode === question.subjectCode &&
                    q.topicCode === question.topicCode &&
                    q.grade === question.grade &&
                    q.levelCode === question.levelCode
                  )
                  
                  const isOtherSubjectsReadingComprehension = question.subjectCode !== 'IN' && 
                                                             question.informativeText && 
                                                             typeof question.informativeText === 'string' &&
                                                             question.informativeText.trim().length > 0 &&
                                                             !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                                             !question.questionText?.includes('completar el hueco') &&
                                                             hasMultipleWithSameInformativeText
                  
                  // Para preguntas con informativeText, buscar preguntas relacionadas
                  // (Cloze Test, Comprensión de Lectura o Matching/Columnas)
                  // IMPORTANTE: Para otras materias, solo agrupar si hay múltiples preguntas con el mismo informativeText
                  if (question.informativeText && 
                      (isMatchingColumns ||
                       isClozeTest ||
                       isEnglishReadingComprehension ||
                       isOtherSubjectsReadingComprehension ||
                       (question.subjectCode === 'IN' && questions.some(q => q.informativeText === question.informativeText && q.id !== question.id)))) {
                    // Para matching/columnas, usar el identificador de grupo como parte del key
                    const groupKey = isMatchingColumns
                      ? `${extractMatchingGroupId(question.informativeText)}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`
                      : `${question.informativeText}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`
                    
                    if (!groupedQuestions[groupKey]) {
                      groupedQuestions[groupKey] = []
                    }
                    
                    // Buscar todas las preguntas relacionadas
                    const related = filteredQuestions.filter(q => {
                      // Verificar que sea de la misma materia, tema, grado y nivel
                      if (q.subjectCode !== question.subjectCode || 
                          q.topicCode !== question.topicCode ||
                          q.grade !== question.grade || 
                          q.levelCode !== question.levelCode ||
                          processedIds.has(q.id || '')) {
                        return false
                      }
                      
                      if (isMatchingColumns) {
                        // Para matching/columnas (solo inglés), agrupar por identificador de grupo
                        const qGroupId = extractMatchingGroupId(q.informativeText)
                        const questionGroupId = extractMatchingGroupId(question.informativeText)
                        return qGroupId && questionGroupId && qGroupId === questionGroupId
                      } else if (isClozeTest) {
                        // Para cloze test (solo inglés), agrupar por informativeText completo e imágenes
                        return q.informativeText === question.informativeText &&
                               JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
                               q.questionText?.includes('completar el hueco')
                      } else if (isEnglishReadingComprehension) {
                        // Para comprensión de lectura de inglés, agrupar por informativeText completo e imágenes
                        return q.subjectCode === 'IN' &&
                               q.informativeText === question.informativeText &&
                               JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
                               !q.questionText?.includes('completar el hueco') &&
                               !q.informativeText?.includes('MATCHING_COLUMNS_')
                      } else if (isOtherSubjectsReadingComprehension) {
                        // Para comprensión de lectura de otras materias, agrupar por informativeText completo e imágenes
                        return q.subjectCode !== 'IN' &&
                               q.informativeText === question.informativeText &&
                               JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || []) &&
                               !q.questionText?.includes('completar el hueco') &&
                               !q.informativeText?.includes('MATCHING_COLUMNS_')
                      } else {
                        // Fallback: agrupar por informativeText completo e imágenes
                        return q.informativeText === question.informativeText &&
                               JSON.stringify(q.informativeImages || []) === JSON.stringify(question.informativeImages || [])
                      }
                    })
                    
                    related.forEach(q => {
                      groupedQuestions[groupKey].push(q)
                      processedIds.add(q.id || '')
                    })
                    
                    // Ordenar las preguntas del grupo por orden de creación (más antigua primero)
                    groupedQuestions[groupKey].sort(sortQuestionsByCreationOrder)
                  } else {
                    ungroupedQuestions.push(question)
                    processedIds.add(question.id || '')
                  }
                })
                
                // Crear un array combinado de grupos y preguntas individuales para ordenarlos juntos
                // Primero preparar los grupos con su fecha más reciente
                const groupEntries = Object.entries(groupedQuestions).map(([groupKey, groupQuestions]) => ({
                  type: 'group' as const,
                  groupKey,
                  groupQuestions,
                  latestDate: Math.max(...groupQuestions.map(q => new Date(q.createdAt).getTime()))
                }))
                
                // Preparar preguntas individuales con su fecha
                const ungroupedWithDates = ungroupedQuestions.map(question => ({
                  type: 'question' as const,
                  question,
                  latestDate: new Date(question.createdAt).getTime()
                }))
                
                // Combinar y ordenar por fecha más reciente primero (independientemente de si es grupo o pregunta individual)
                const combinedItems = [...groupEntries, ...ungroupedWithDates].sort((a, b) => {
                  return b.latestDate - a.latestDate // Más reciente primero
                })
                
                // Renderizar grupos y preguntas individuales mezclados, ordenados por fecha más reciente
                return (
                  <>
                    {combinedItems.map((item) => {
                      if (item.type === 'group') {
                        const { groupKey, groupQuestions } = item
                        const firstQuestion = groupQuestions[0]
                        // Verificar SIEMPRE si es matching/columnas primero (prioridad más alta)
                        // Verificar en TODAS las preguntas del grupo, no solo la primera
                        const isMatchingColumns = groupQuestions.some(q => {
                          const isMatch = q.subjectCode === 'IN' && 
                                         q.informativeText && 
                                         typeof q.informativeText === 'string' &&
                                         (q.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                          q.informativeText.includes('MATCHING_COLUMNS_'))
                          // Debug: Solo mostrar para debugging si es necesario
                          if (isMatch) {
                            console.log('🔍 Pregunta de matching/columnas detectada:', {
                              code: q.code,
                              informativeText: q.informativeText,
                              subjectCode: q.subjectCode
                            })
                          }
                          return isMatch
                        })
                        const isClozeTest = groupQuestions.some(q => q.questionText?.includes('completar el hueco'))
                        
                        // Detectar si es comprensión de lectura de otras materias
                        // IMPORTANTE: Solo es comprensión de lectura si hay múltiples preguntas en el grupo
                        // Si solo hay una pregunta, es Opción Múltiple Estándar con texto informativo
                        const hasOtherSubjectsWithInformativeText = groupQuestions.some(q => 
                          q.subjectCode !== 'IN' && 
                          q.informativeText && 
                          !q.questionText?.includes('completar el hueco') &&
                          !q.informativeText?.includes('MATCHING_COLUMNS_')
                        )
                        
                        const isOtherSubjectsReadingComprehension = hasOtherSubjectsWithInformativeText && 
                          groupQuestions.length > 1
                        
                        // Si es una pregunta individual de otras materias con informativeText, mostrarla como Opción Múltiple Estándar
                        const isSingleOtherSubjectQuestion = hasOtherSubjectsWithInformativeText && 
                          groupQuestions.length === 1
                        
                        // Determinar el nombre del grupo
                        // IMPORTANTE: Priorizar matching/columnas sobre otras modalidades
                        let groupName: string
                        if (isMatchingColumns) {
                          // Formato: "materia - modalidad - # preguntas - grado - nivel"
                          // Ejemplo: "Inglés - matching / columnas - 2 preguntas - Sexto - Medio"
                          groupName = `Inglés - matching / columnas - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
                          console.log('✅ Grupo de matching/columnas detectado:', {
                            groupName,
                            questionsCount: groupQuestions.length,
                            firstQuestionCode: firstQuestion.code,
                            firstQuestionInformativeText: firstQuestion.informativeText
                          })
                        } else if (isClozeTest) {
                          // Formato: "materia - modalidad - # preguntas - grado - nivel"
                          groupName = `Inglés - Cloze Test / Rellenar Huecos - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
                        } else if (isSingleOtherSubjectQuestion) {
                          // Pregunta individual de otras materias con texto informativo = Opción Múltiple Estándar
                          // Formato: "materia - modalidad - # preguntas - grado - nivel"
                          groupName = `${firstQuestion.subject} - Opción Múltiple Estándar - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
                        } else if (isOtherSubjectsReadingComprehension) {
                          // Comprensión de Lectura Corta para otras materias
                          // Formato: "materia - modalidad - # preguntas - grado - nivel"
                          groupName = `${firstQuestion.subject} - Comprensión de Lectura Corta - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
                        } else {
                          // Comprensión de Lectura Corta para Inglés
                          // Formato: "materia - modalidad - # preguntas - grado - nivel"
                          groupName = `Inglés - Comprensión de Lectura Corta - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
                        }
                        
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
                                {groupName}
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
                            {groupQuestions.sort(sortQuestionsByCreationOrder).map((question) => {
                              const isSelected = question.id ? selectedQuestionIds.has(question.id) : false
                              
                              return (
                                <div
                                  key={question.id}
                                  className={cn(
                                    'p-4 cursor-pointer transition-colors',
                                    theme === 'dark'
                                      ? isSelected
                                        ? 'bg-blue-950/20 hover:bg-blue-950/30 border-l-2 border-blue-500'
                                        : 'hover:bg-zinc-800'
                                      : isSelected
                                        ? 'bg-blue-50 hover:bg-blue-100 border-l-2 border-blue-500'
                                        : 'hover:bg-gray-50'
                                  )}
                                  onClick={() => handleViewQuestion(question)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                      <div 
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1"
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => question.id && toggleQuestionSelection(question.id)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
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
                                    </div>
                                    <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        {/* Símbolo de alarma si la justificación de IA tiene problemas */}
                                        {(() => {
                                          const hasIssues = question.aiJustification && (
                                            (question.aiJustification.confidence < 0.7) ||
                                            (!question.aiJustification.correctAnswerExplanation || question.aiJustification.correctAnswerExplanation.length < 50) ||
                                            (!question.aiJustification.incorrectAnswersExplanation || question.aiJustification.incorrectAnswersExplanation.length === 0) ||
                                            (!question.aiJustification.keyConcepts || question.aiJustification.keyConcepts.length < 2)
                                          )
                                          if (hasIssues) {
                                            return (
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div className={cn("flex items-center justify-center h-6 w-6 rounded-full", theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')}>
                                                      <AlertCircle className="h-4 w-4" />
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p>La justificación de IA tiene problemas de calidad</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            )
                                          }
                                          return null
                                        })()}
                                      </div>
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
                            })}
                          </div>
                        </div>
                      )
                      } else {
                        // Renderizar pregunta individual
                        const { question } = item
                        const isSelected = question.id ? selectedQuestionIds.has(question.id) : false
                        
                        return (
                          <div 
                            key={question.id} 
                            className={cn(
                              'p-4 rounded-lg border cursor-pointer transition-colors',
                              theme === 'dark' 
                                ? isSelected
                                  ? 'border-blue-500 bg-blue-950/20 hover:bg-blue-950/30'
                                  : 'border-zinc-700 hover:bg-zinc-800'
                                : isSelected
                                  ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                                  : 'border-gray-200 hover:bg-gray-50'
                            )}
                            onClick={() => handleViewQuestion(question)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => question.id && toggleQuestionSelection(question.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
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
                              </div>
                              <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewQuestion(question); }}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {/* Símbolo de alarma si la justificación de IA tiene problemas */}
                                  {(() => {
                                    const hasIssues = question.aiJustification && (
                                      (question.aiJustification.confidence < 0.7) ||
                                      (!question.aiJustification.correctAnswerExplanation || question.aiJustification.correctAnswerExplanation.length < 50) ||
                                      (!question.aiJustification.incorrectAnswersExplanation || question.aiJustification.incorrectAnswersExplanation.length === 0) ||
                                      (!question.aiJustification.keyConcepts || question.aiJustification.keyConcepts.length < 2)
                                    )
                                    if (hasIssues) {
                                      return (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full", theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')}>
                                                <AlertCircle className="h-4 w-4" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>La justificación de IA tiene problemas de calidad</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
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
                      }
                    })}
                  </>
                )
              })()}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog para crear pregunta - continuará en la siguiente parte... */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        // Cuando se abre el diálogo, resetear el formulario completamente
        if (open) {
          console.log('🔄 Abriendo diálogo de creación - Reseteando formulario...')
          resetForm()
        }
      }}>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="modalidad_ingles" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                    Modalidad de Pregunta Específica *
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                          <p className="max-w-xs">Selecciona el tipo de pregunta que deseas crear para Inglés</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Badge 
                    variant={inglesModality === 'standard_mc' ? 'default' : 'secondary'} 
                    className={cn(
                      'text-xs',
                      inglesModality === 'standard_mc' 
                        ? 'bg-green-500 hover:bg-green-600' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    )}
                  >
                    {inglesModality === 'standard_mc' ? 'Estándar' : 'Especial'}
                  </Badge>
                </div>
                <Select value={inglesModality} onValueChange={(value: any) => {
                  setInglesModality(value)
                  if (value !== 'standard_mc') {
                    console.log('⚠️ Cambiando a modalidad especial:', value)
                  }
                }}>
                  <SelectTrigger className={cn(
                    theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '',
                    inglesModality !== 'standard_mc' ? 'border-orange-500 border-2' : ''
                  )}>
                    <SelectValue placeholder="Seleccionar modalidad" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectItem value="standard_mc">✓ Opción Múltiple Estándar (Recomendado)</SelectItem>
                    <SelectItem value="matching_columns">Matching / Columnas</SelectItem>
                    <SelectItem value="cloze_test">Cloze Test / Rellenar Huecos</SelectItem>
                    <SelectItem value="reading_comprehension">Comprensión de Lectura Corta</SelectItem>
                  </SelectContent>
                </Select>
                {inglesModality !== 'standard_mc' && (
                  <div className={cn(
                    'flex items-start gap-2 p-3 rounded-md border',
                    theme === 'dark' 
                      ? 'bg-orange-900/20 border-orange-700 text-orange-200' 
                      : 'bg-orange-50 border-orange-300 text-orange-800'
                  )}>
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Modalidad Especial Seleccionada</p>
                      <p>
                        {inglesModality === 'matching_columns' && 'Debe agregar preguntas de matching usando el botón "Agregar Pregunta de Matching".'}
                        {inglesModality === 'cloze_test' && 'Debe ingresar un texto con huecos marcados como [1], [2], etc.'}
                        {inglesModality === 'reading_comprehension' && 'Debe agregar un texto de lectura y preguntas de comprensión.'}
                      </p>
                      <p className="mt-1 italic">Si desea crear una pregunta estándar, seleccione "Opción Múltiple Estándar".</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campo de Modalidad para otras materias - Solo visible cuando materia NO es Inglés */}
            {formData.subjectCode && formData.subjectCode !== 'IN' && (
              <div className="space-y-2">
                <Label htmlFor="modalidad_otras_materias" className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  Modalidad de Pregunta *
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                        <p className="max-w-xs">Opción Múltiple Estándar: una pregunta individual. Comprensión de Lectura Corta: crea varias preguntas agrupadas basadas en un texto común.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Select value={otherSubjectsModality} onValueChange={(value: any) => setOtherSubjectsModality(value)}>
                  <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
                    <SelectValue placeholder="Seleccionar modalidad" />
                  </SelectTrigger>
                  <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectItem value="standard_mc">Opción Múltiple Estándar</SelectItem>
                    <SelectItem value="reading_comprehension">Comprensión de Lectura Corta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Texto informativo (opcional) - Oculto para modalidad Comprensión de Lectura */}
            {/* Visible para matching/columnas y otras modalidades */}
            {!(formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') && 
             !(formData.subjectCode !== 'IN' && otherSubjectsModality === 'reading_comprehension') && (
              <div className="space-y-2">
                <Label 
                  htmlFor="informativeText" 
                  className={cn(theme === 'dark' ? 'text-gray-300' : '')}
                >
                  {formData.subjectCode === 'IN' && inglesModality === 'matching_columns'
                    ? 'Texto Compartido (opcional)'
                    : 'Texto Informativo (opcional)'}
                </Label>
                <RichTextEditor
                  ref={informativeTextEditorRef}
                  value={formData.informativeText}
                  onChange={(html) => setFormData({ ...formData, informativeText: html })}
                  placeholder="Información adicional o contexto para la pregunta..."
                  theme={theme}
                />
              </div>
            )}

            {/* Imágenes informativas - Oculto para modalidad Comprensión de Lectura */}
            {!(formData.subjectCode === 'IN' && inglesModality === 'reading_comprehension') && 
             !(formData.subjectCode !== 'IN' && otherSubjectsModality === 'reading_comprehension') && (
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
                  {/* Campo para imagen de la pregunta */}
                  <div className="space-y-2">
                    <Label>Imagen de la Pregunta (Opcional)</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              // Validar tamaño (máximo 5MB)
                              if (file.size > 5 * 1024 * 1024) {
                                notifyError({
                                  title: 'Error',
                                  message: 'La imagen es demasiado grande. Tamaño máximo: 5MB'
                                })
                                return
                              }
                              // Validar tipo
                              if (!file.type.startsWith('image/')) {
                                notifyError({
                                  title: 'Error',
                                  message: 'El archivo debe ser una imagen'
                                })
                                return
                              }
                              // Crear vista previa
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                const updated = [...matchingQuestions]
                                updated[mqIndex].questionImage = file
                                updated[mqIndex].questionImagePreview = reader.result as string
                                setMatchingQuestions(updated)
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                          className="cursor-pointer"
                        />
                      </div>
                      {mq.questionImagePreview && (
                        <div className="relative">
                          <img
                            src={mq.questionImagePreview}
                            alt="Vista previa"
                            className="h-20 w-20 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => {
                              const updated = [...matchingQuestions]
                              updated[mqIndex].questionImage = null
                              updated[mqIndex].questionImagePreview = null
                              setMatchingQuestions(updated)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                          <div className="flex items-center">
                            <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                              Opciones de Respuesta *
                              {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                            </Label>
                          </div>
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
                              {mq.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...matchingQuestions]
                                    updated[mqIndex].options = updated[mqIndex].options.filter(o => o.id !== opt.id)
                                    setMatchingQuestions(updated)
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                  </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...matchingQuestions]
                              const currentOptions = updated[mqIndex].options
                              const nextLetter = getNextAvailableOptionLetter(currentOptions)
                              updated[mqIndex].options = [
                                ...currentOptions,
                                {
                                  id: nextLetter as any,
                                  text: '',
                                  imageUrl: null,
                                  isCorrect: false
                                }
                              ]
                              setMatchingQuestions(updated)
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
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
                    className={cn(
                      "w-full mt-4 font-medium",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500 shadow-sm' 
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                    onClick={() => {
                      const newId = `mq${matchingQuestions.length + 1}`
                      // Crear opciones A-H (8 opciones iniciales)
                      const initialOptions: QuestionOption[] = Array.from({ length: 8 }, (_, i) => ({
                        id: getOptionLetter(i) as any,
                        text: '',
                        imageUrl: null,
                        isCorrect: false
                      }))
                      setMatchingQuestions([
                        ...matchingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          options: initialOptions
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
                        
                        // Inicializar huecos que no existen (3 opciones por defecto: A, B, C)
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
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usa [1], [2], [3], etc. para marcar los huecos. Cada hueco tendrá opciones de respuesta dinámicas (mínimo 2).</p>
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
                      <Label className={cn("text-base font-semibold", theme === 'dark' ? 'text-gray-300' : '')}>Opciones por Hueco *</Label>
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
                        <div className="flex items-center">
                          <Label className={cn(`font-semibold text-lg`, hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                            Pregunta {gapNum} *
                            {hasOptionsError && <span className="ml-2 text-red-600 text-sm">⚠️ Complete todas las opciones</span>}
                            {hasAnswerError && <span className="ml-2 text-red-600 text-sm">⚠️ Seleccione la respuesta correcta</span>}
                          </Label>
                        </div>
                        <div className="space-y-3">
                          {gapData.options.map((optionText, optIndex) => {
                            const letter = getOptionLetter(optIndex)
                            const isEmpty = !optionText || !optionText.trim()
                            const hasOptionError = hasOptionsError && isEmpty
                            return (
                            <div key={optIndex} className="flex items-center gap-3">
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
                                value={optionText || ''}
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
                              {gapData.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newOptions = gapData.options.filter((_, idx) => idx !== optIndex)
                                    const newCorrectAnswer = gapData.correctAnswer === letter ? '' : gapData.correctAnswer
                                    setClozeGaps({
                                      ...clozeGaps,
                                      [gapNum]: {
                                        ...gapData,
                                        options: newOptions,
                                        correctAnswer: newCorrectAnswer
                                      }
                                    })
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            )
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentOptions = gapData.options
                              setClozeGaps({
                                ...clozeGaps,
                                [gapNum]: {
                                  ...gapData,
                                  options: [...currentOptions, '']
                                }
                              })
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
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
                          <div className="flex items-center">
                            <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                              Opciones *
                              {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                            </Label>
                          </div>
                          {rq.options.map((opt) => (
                            <div key={opt.id} className="space-y-2">
                              <div className="flex items-center gap-2">
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
                                  className={cn(`flex-1`, hasOptionsError && !opt.text?.trim() && !readingOptionImagePreviews[rq.id]?.[opt.id] ? 'border-red-500' : '', theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`reading-option-${rq.id}-${opt.id}-image`}
                                  className="hidden"
                                  onChange={(e) => e.target.files && handleReadingOptionImageUpload(rq.id, opt.id, e.target.files[0])}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`reading-option-${rq.id}-${opt.id}-image`)?.click()}
                                  className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                                {rq.options.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...readingQuestions]
                                      updated[rqIndex].options = updated[rqIndex].options.filter(o => o.id !== opt.id)
                                      setReadingQuestions(updated)
                                      // Limpiar imágenes de la opción eliminada
                                      removeReadingOptionImage(rq.id, opt.id)
                                    }}
                                    className={cn(
                                      "h-8 w-8 p-0",
                                      theme === 'dark'
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50'
                                        : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                    )}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {(readingOptionImagePreviews[rq.id]?.[opt.id] || opt.imageUrl) && (
                                <div className="relative w-32 h-32 ml-10">
                                  <img 
                                    src={readingOptionImagePreviews[rq.id]?.[opt.id] || opt.imageUrl || ''} 
                                    alt={`Opción ${opt.id}`} 
                                    className="w-full h-full object-cover rounded" 
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-0 right-0 h-6 w-6 p-0"
                                    onClick={() => removeReadingOptionImage(rq.id, opt.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...readingQuestions]
                              const currentOptions = updated[rqIndex].options
                              const nextLetter = getNextAvailableOptionLetter(currentOptions)
                              updated[rqIndex].options = [
                                ...currentOptions,
                                {
                                  id: nextLetter as any,
                                  text: '',
                                  imageUrl: null,
                                  isCorrect: false
                                }
                              ]
                              setReadingQuestions(updated)
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
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
                    className={cn(
                      "w-full mt-4 font-medium",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500 shadow-sm' 
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                    onClick={() => {
                      const newId = `q${readingQuestions.length + 1}`
                      // Crear opciones iniciales A, B, C (3 opciones por defecto)
                      const initialOptions: QuestionOption[] = Array.from({ length: 3 }, (_, i) => ({
                        id: getOptionLetter(i) as any,
                        text: '',
                        imageUrl: null,
                        isCorrect: false
                      }))
                      setReadingQuestions([
                        ...readingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          options: initialOptions
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
            ) : formData.subjectCode !== 'IN' && otherSubjectsModality === 'reading_comprehension' ? (
              /* Modalidad: Comprensión de Lectura para otras materias */
              <>
                <div className="space-y-2">
                  <Label htmlFor="otherSubjectsReadingText" className={cn(fieldErrors['otherSubjectsReadingText'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['otherSubjectsReadingText'] ? 'text-gray-300' : '')}>
                    Texto de Lectura / Contexto *
                    {fieldErrors['otherSubjectsReadingText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                          <p className="max-w-xs">Ingresa el texto base, contexto o material de lectura sobre el cual se crearán múltiples preguntas agrupadas.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className={cn(fieldErrors['otherSubjectsReadingText'] ? 'border-2 border-red-500 rounded-md' : '', theme === 'dark' && !fieldErrors['otherSubjectsReadingText'] ? 'border-zinc-600' : '')}>
                    <RichTextEditor
                      value={otherSubjectsReadingText}
                      onChange={(html) => {
                        setOtherSubjectsReadingText(html)
                        // Limpiar error cuando el usuario empiece a escribir
                        if (fieldErrors['otherSubjectsReadingText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['otherSubjectsReadingText']
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
                  <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                    Imagen Informativa (opcional)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                          <p className="max-w-xs">Puedes agregar una imagen relacionada con el texto de lectura (gráficos, diagramas, ilustraciones, etc.)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setOtherSubjectsReadingImage(file)
                          const reader = new FileReader()
                          reader.onloadend = () => setOtherSubjectsReadingImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                      id="other-subjects-reading-image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('other-subjects-reading-image')?.click()}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir Imagen
                    </Button>
                  </div>
                  {otherSubjectsReadingImagePreview && (
                    <div className="relative w-full max-w-md">
                      <img src={otherSubjectsReadingImagePreview} alt="Reading" className="w-full h-auto rounded" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-0 right-0"
                        onClick={() => {
                          setOtherSubjectsReadingImage(null)
                          setOtherSubjectsReadingImagePreview(null)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={cn(fieldErrors['otherSubjectsReadingQuestions'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['otherSubjectsReadingQuestions'] ? 'text-gray-300' : '')}>
                    Preguntas Vinculadas *
                    {fieldErrors['otherSubjectsReadingQuestions'] && <span className="ml-2 text-red-600">⚠️ Debe agregar al menos una pregunta</span>}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                          <p className="max-w-xs">Crea múltiples preguntas basadas en el texto de lectura. Todas las preguntas compartirán el mismo texto base e imágenes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  {otherSubjectsReadingQuestions.map((rq, rqIndex) => {
                    const hasOptionsError = fieldErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]
                    const hasAnswerError = fieldErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]
                    const hasAnyError = hasOptionsError || hasAnswerError
                    
                    return (
                      <div key={rq.id} className={cn(`border-2 rounded-lg p-4 space-y-3`, hasAnyError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-200')}>
                        <div className="flex items-center justify-between">
                          <Label className={cn(hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                            Pregunta {rqIndex + 1}
                            {hasAnyError && <span className="ml-2 text-red-600 text-xs">⚠️ Campos incompletos</span>}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOtherSubjectsReadingQuestions(otherSubjectsReadingQuestions.filter((_, i) => i !== rqIndex))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <RichTextEditor
                            value={rq.questionText}
                            onChange={(html) => {
                              const updated = [...otherSubjectsReadingQuestions]
                              updated[rqIndex].questionText = html
                              setOtherSubjectsReadingQuestions(updated)
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
                                  const updated = [...otherSubjectsReadingQuestions]
                                  updated[rqIndex].questionImage = file
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    const updatedWithPreview = [...otherSubjectsReadingQuestions]
                                    updatedWithPreview[rqIndex].questionImagePreview = reader.result as string
                                    setOtherSubjectsReadingQuestions(updatedWithPreview)
                                  }
                                  reader.readAsDataURL(file)
                                  setOtherSubjectsReadingQuestions(updated)
                                }
                              }}
                              className="hidden"
                              id={`other-subjects-reading-question-image-${rq.id}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`other-subjects-reading-question-image-${rq.id}`)?.click()}
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
                                  const updated = [...otherSubjectsReadingQuestions]
                                  updated[rqIndex].questionImage = null
                                  updated[rqIndex].questionImagePreview = null
                                  setOtherSubjectsReadingQuestions(updated)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                              Opciones *
                              {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                            </Label>
                          </div>
                          {rq.options.map((opt) => (
                            <div key={opt.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`other-subjects-reading-q-${rq.id}`}
                                  checked={opt.isCorrect}
                                  onChange={() => {
                                    const updated = [...otherSubjectsReadingQuestions]
                                    updated[rqIndex].options = updated[rqIndex].options.map(o => ({
                                      ...o,
                                      isCorrect: o.id === opt.id
                                    }))
                                    setOtherSubjectsReadingQuestions(updated)
                                    // Limpiar error cuando se selecciona una respuesta
                                    if (fieldErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]) {
                                      setFieldErrors(prev => {
                                        const newErrors = { ...prev }
                                        delete newErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]
                                        return newErrors
                                      })
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{opt.id}:</Label>
                                <div className={cn(`flex-1`, hasOptionsError && !opt.text?.trim() && !readingOptionImagePreviews[rq.id]?.[opt.id] ? 'border-2 border-red-500 rounded' : '')}>
                                  <RichTextEditor
                                    value={opt.text || ''}
                                    onChange={(html) => {
                                      const updated = [...otherSubjectsReadingQuestions]
                                      updated[rqIndex].options = updated[rqIndex].options.map(o =>
                                        o.id === opt.id ? { ...o, text: html } : o
                                      )
                                      setOtherSubjectsReadingQuestions(updated)
                                      // Limpiar error cuando el usuario empiece a escribir
                                      if (fieldErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]) {
                                        setFieldErrors(prev => {
                                          const newErrors = { ...prev }
                                          delete newErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]
                                          return newErrors
                                        })
                                      }
                                    }}
                                    placeholder={`Opción ${opt.id}`}
                                    theme={theme}
                                    minimalToolbar={true}
                                    className="min-h-[40px]"
                                  />
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`other-subjects-reading-option-${rq.id}-${opt.id}-image`}
                                  className="hidden"
                                  onChange={(e) => e.target.files && handleReadingOptionImageUpload(rq.id, opt.id, e.target.files[0])}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`other-subjects-reading-option-${rq.id}-${opt.id}-image`)?.click()}
                                  className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                                {rq.options.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...otherSubjectsReadingQuestions]
                                      updated[rqIndex].options = updated[rqIndex].options.filter(o => o.id !== opt.id)
                                      setOtherSubjectsReadingQuestions(updated)
                                      // Limpiar imágenes de la opción eliminada
                                      removeReadingOptionImage(rq.id, opt.id)
                                    }}
                                    className={cn(
                                      "h-8 w-8 p-0",
                                      theme === 'dark'
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50'
                                        : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                    )}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {(readingOptionImagePreviews[rq.id]?.[opt.id] || opt.imageUrl) && (
                                <div className="relative w-32 h-32 ml-10">
                                  <img 
                                    src={readingOptionImagePreviews[rq.id]?.[opt.id] || opt.imageUrl || ''} 
                                    alt={`Opción ${opt.id}`} 
                                    className="w-full h-full object-cover rounded" 
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-0 right-0 h-6 w-6 p-0"
                                    onClick={() => removeReadingOptionImage(rq.id, opt.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...otherSubjectsReadingQuestions]
                              const currentOptions = updated[rqIndex].options
                              const nextLetter = getNextAvailableOptionLetter(currentOptions)
                              updated[rqIndex].options = [
                                ...currentOptions,
                                {
                                  id: nextLetter as any,
                                  text: '',
                                  imageUrl: null,
                                  isCorrect: false
                                }
                              ]
                              setOtherSubjectsReadingQuestions(updated)
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
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
                    className={cn(
                      "w-full mt-4 font-medium",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500 shadow-sm' 
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                    onClick={() => {
                      const newId = `q${otherSubjectsReadingQuestions.length + 1}`
                      // Crear opciones iniciales A, B, C (3 opciones por defecto)
                      const initialOptions: QuestionOption[] = Array.from({ length: 3 }, (_, i) => ({
                        id: getOptionLetter(i) as any,
                        text: '',
                        imageUrl: null,
                        isCorrect: false
                      }))
                      setOtherSubjectsReadingQuestions([
                        ...otherSubjectsReadingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          options: initialOptions
                        }
                      ])
                      // Limpiar error cuando se agrega una pregunta
                      if (fieldErrors['otherSubjectsReadingQuestions']) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors['otherSubjectsReadingQuestions']
                          return newErrors
                        })
                      }
                      // Hacer scroll al nuevo botón después de un pequeño delay para que se renderice
                      setTimeout(() => {
                        const button = document.getElementById('add-other-subjects-reading-question-btn')
                        if (button) {
                          button.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        }
                      }, 100)
                    }}
                    id="add-other-subjects-reading-question-btn"
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                          <p className="max-w-xs">Escribe la pregunta completa. Puedes usar formato enriquecido, fórmulas matemáticas y otros elementos.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                  <div>
                    <div>
                      <Label className={cn(fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['options'] && !fieldErrors['correctAnswer'] ? 'text-gray-300' : '')}>
                        Opciones de Respuesta *
                        {fieldErrors['options'] && <span className="ml-2 text-red-600">⚠️ Todas las opciones deben tener contenido</span>}
                        {fieldErrors['correctAnswer'] && <span className="ml-2 text-red-600">⚠️ Debe marcar exactamente una opción como correcta</span>}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="inline-block h-4 w-4 ml-2 text-gray-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}>
                              <p className="max-w-xs">Ingresa al menos 2 opciones de respuesta. Cada opción puede tener texto, imagen o ambos. Marca exactamente una opción como correcta usando el botón de radio.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Cada opción debe tener texto o imagen. Marque la opción correcta.
                      </p>
                    </div>
                  </div>
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
                            {options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setOptions(options.filter(opt => opt.id !== option.id))
                                  setOptionFiles(prev => {
                                    const newFiles = { ...prev }
                                    delete newFiles[option.id]
                                    return newFiles
                                  })
                                  setOptionImagePreviews(prev => {
                                    const newPreviews = { ...prev }
                                    delete newPreviews[option.id]
                                    return newPreviews
                                  })
                                }}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {(optionImagePreviews[option.id] || option.imageUrl) && (
                          <div className="relative w-32 h-32">
                            <img 
                              src={optionImagePreviews[option.id] || option.imageUrl || ''} 
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextLetter = getNextAvailableOptionLetter(options)
                        setOptions([
                          ...options,
                          {
                            id: nextLetter as any,
                            text: '',
                            imageUrl: null,
                            isCorrect: false
                          }
                        ])
                        setOptionFiles(prev => ({ ...prev, [nextLetter]: null }))
                        setOptionImagePreviews(prev => ({ ...prev, [nextLetter]: null }))
                      }}
                      className={cn(
                        "h-7 text-xs mt-2",
                        theme === 'dark' 
                          ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                          : ''
                      )}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar Opción
                    </Button>
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
              className={cn(
                theme === 'dark' 
                  ? 'border-zinc-600 text-gray-300 hover:bg-zinc-700 hover:text-white' 
                  : ''
              )}
            >
              Cancelar
            </Button>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateQuestion} 
                disabled={isLoading}
                className={cn(
                  theme === 'dark'
                    ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-600/50'
                    : 'bg-black text-white hover:bg-gray-800'
                )}
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar pregunta */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            // Limpiar estados de edición cuando se cierra el diálogo
            setIsEditingClozeTest(false)
            setIsEditingReadingComprehension(false)
            setIsEditingOtherSubjectsReadingComprehension(false)
            setEditClozeText('')
            setEditClozeGaps({})
            setEditClozeRelatedQuestions([])
            setEditReadingText('')
            setEditReadingImage(null)
            setEditReadingImagePreview(null)
            setEditReadingExistingImageUrl(null)
            setEditReadingQuestions([])
            setEditReadingRelatedQuestions([])
            setEditOtherSubjectsReadingText('')
            setEditOtherSubjectsReadingImage(null)
            setEditOtherSubjectsReadingImagePreview(null)
            setEditOtherSubjectsReadingExistingImageUrl(null)
            setEditOtherSubjectsReadingQuestions([])
            setEditOtherSubjectsReadingRelatedQuestions([])
            setSelectedQuestion(null)
          }
        }}
      >
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
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usa [1], [2], [3], etc. para marcar los huecos. Cada hueco tendrá opciones de respuesta dinámicas (mínimo 2).</p>
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
                      <Label className={cn("text-base font-semibold", theme === 'dark' ? 'text-gray-300' : '')}>Opciones por Pregunta *</Label>
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
                        <div className="flex items-center">
                          <Label className={cn(`font-semibold text-lg`, hasAnyError ? 'text-red-700' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                            Pregunta {gapNum} *
                            {hasGapError && (
                              <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Esta pregunta requiere opciones</span>
                            )}
                            {hasOptionsError && (
                              <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Complete todas las opciones (mínimo 2)</span>
                            )}
                            {hasAnswerError && (
                              <span className="ml-2 text-red-600 text-sm font-semibold">⚠️ Seleccione la respuesta correcta</span>
                            )}
                          </Label>
                        </div>
                        <div className="space-y-3">
                          {gapData.options.map((optionText, optIndex) => {
                            const letter = getOptionLetter(optIndex)
                            const isEmpty = !optionText || !optionText.trim()
                            const hasOptionError = hasOptionsError && isEmpty
                            return (
                            <div key={optIndex} className="flex items-center gap-3">
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
                                value={optionText || ''}
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
                              {gapData.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newOptions = gapData.options.filter((_, idx) => idx !== optIndex)
                                    const newCorrectAnswer = gapData.correctAnswer === letter ? '' : gapData.correctAnswer
                                    setEditClozeGaps({
                                      ...editClozeGaps,
                                      [gapNum]: {
                                        ...gapData,
                                        options: newOptions,
                                        correctAnswer: newCorrectAnswer
                                      }
                                    })
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            )
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentOptions = gapData.options
                              setEditClozeGaps({
                                ...editClozeGaps,
                                [gapNum]: {
                                  ...gapData,
                                  options: [...currentOptions, '']
                                }
                              })
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
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
            ) : isEditingReadingComprehension ? (
              /* Modalidad: Comprensión de Lectura - Edición */
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-readingText" className={cn(
                    fieldErrors['readingText'] ? 'text-red-600' : '',
                    theme === 'dark' && !fieldErrors['readingText'] ? 'text-gray-300' : ''
                  )}>
                    {(formData.subjectCode === 'IN' && (inglesModality === 'matching_columns' || 
                      (formData.informativeText && typeof formData.informativeText === 'string' && formData.informativeText.startsWith('MATCHING_COLUMNS_'))))
                      ? 'Texto Compartido *' 
                      : 'Texto de Lectura / Aviso / Cartel *'}
                    {fieldErrors['readingText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(
                    fieldErrors['readingText'] ? 'border-2 border-red-500 rounded-md p-2' : '',
                    theme === 'dark' && !fieldErrors['readingText'] ? 'border-zinc-600' : ''
                  )}>
                    <RichTextEditor
                      value={editReadingText}
                      onChange={(html) => {
                        setEditReadingText(html)
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
                          setEditReadingImage(file)
                          const reader = new FileReader()
                          reader.onloadend = () => setEditReadingImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                      id="edit-reading-image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('edit-reading-image')?.click()}
                      className={cn(
                        theme === 'dark' 
                          ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                          : ''
                      )}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {editReadingExistingImageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
                    </Button>
                    {editReadingExistingImageUrl && !editReadingImagePreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setEditReadingExistingImageUrl(null)
                          setEditReadingImagePreview(null)
                        }}
                        className={cn(
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : ''
                        )}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Eliminar Imagen Existente
                      </Button>
                    )}
                  </div>
                  {(editReadingImagePreview || editReadingExistingImageUrl) && (
                    <div className="relative w-full max-w-md">
                      <img 
                        src={editReadingImagePreview || editReadingExistingImageUrl || ''} 
                        alt="Reading" 
                        className="w-full h-auto rounded border border-zinc-600" 
                      />
                      {editReadingImagePreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className={cn(
                            "absolute top-0 right-0",
                            theme === 'dark'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : ''
                          )}
                          onClick={() => {
                            setEditReadingImage(null)
                            setEditReadingImagePreview(null)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <Label className={cn(
                    fieldErrors['readingQuestions'] ? 'text-red-600' : '',
                    theme === 'dark' && !fieldErrors['readingQuestions'] ? 'text-gray-300 font-semibold text-lg' : 'font-semibold text-lg'
                  )}>
                    Preguntas Vinculadas *
                    {fieldErrors['readingQuestions'] && <span className="ml-2 text-red-600 text-sm">⚠️ Debe agregar al menos una pregunta</span>}
                  </Label>
                  <div className="space-y-4">
                    {editReadingQuestions.map((rq, rqIndex) => {
                      const hasOptionsError = fieldErrors[`readingQuestionOptions_${rqIndex}`]
                      const hasAnswerError = fieldErrors[`readingQuestionAnswer_${rqIndex}`]
                      const hasAnyError = hasOptionsError || hasAnswerError
                      
                      return (
                        <div 
                          key={rq.questionId} 
                          className={cn(
                            "border-2 rounded-lg p-5 space-y-4 shadow-sm transition-all",
                            hasAnyError 
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
                              : theme === 'dark' 
                                ? 'border-zinc-600 bg-zinc-700/50 hover:border-zinc-500' 
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          )}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-600 dark:border-zinc-600">
                            <Label className={cn(
                              "text-lg font-semibold",
                              hasAnyError 
                                ? 'text-red-600 dark:text-red-400' 
                                : theme === 'dark' 
                                  ? 'text-gray-200' 
                                  : ''
                            )}>
                              Pregunta {rqIndex + 1}
                              {hasAnyError && <span className="ml-2 text-red-600 dark:text-red-400 text-xs font-normal">⚠️ Campos incompletos</span>}
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditReadingQuestions(editReadingQuestions.filter((_, i) => i !== rqIndex))}
                              className={cn(
                                theme === 'dark'
                                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-950/30'
                                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              )}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className={cn(
                            "rounded-md",
                            theme === 'dark' ? 'bg-zinc-800/50' : 'bg-white'
                          )}>
                            <RichTextEditor
                              value={rq.questionText}
                              onChange={(html) => {
                                const updated = [...editReadingQuestions]
                                updated[rqIndex].questionText = html
                                setEditReadingQuestions(updated)
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
                                    const updated = [...editReadingQuestions]
                                    updated[rqIndex].questionImage = file
                                    const reader = new FileReader()
                                    reader.onloadend = () => {
                                      const updatedWithPreview = [...editReadingQuestions]
                                      updatedWithPreview[rqIndex].questionImagePreview = reader.result as string
                                      setEditReadingQuestions(updatedWithPreview)
                                    }
                                    reader.readAsDataURL(file)
                                    setEditReadingQuestions(updated)
                                  }
                                }}
                                className="hidden"
                                id={`edit-reading-question-image-${rq.questionId}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById(`edit-reading-question-image-${rq.questionId}`)?.click()}
                                className={cn(
                                  theme === 'dark' 
                                    ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                    : ''
                                )}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                {rq.existingQuestionImageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
                              </Button>
                              {rq.existingQuestionImageUrl && !rq.questionImagePreview && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...editReadingQuestions]
                                    updated[rqIndex].existingQuestionImageUrl = null
                                    updated[rqIndex].questionImagePreview = null
                                    setEditReadingQuestions(updated)
                                  }}
                                  className={cn(
                                    theme === 'dark'
                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                      : ''
                                  )}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Eliminar Imagen Existente
                                </Button>
                              )}
                            </div>
                            {(rq.questionImagePreview || rq.existingQuestionImageUrl) && (
                              <div className="relative w-full max-w-md">
                                <img 
                                  src={rq.questionImagePreview || rq.existingQuestionImageUrl || ''} 
                                  alt={`Pregunta ${rqIndex + 1}`} 
                                  className="w-full h-auto rounded border border-zinc-600" 
                                />
                                {rq.questionImagePreview && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className={cn(
                                      "absolute top-0 right-0",
                                      theme === 'dark'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : ''
                                    )}
                                    onClick={() => {
                                      const updated = [...editReadingQuestions]
                                      updated[rqIndex].questionImage = null
                                      updated[rqIndex].questionImagePreview = null
                                      setEditReadingQuestions(updated)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center pb-2 border-b border-zinc-600 dark:border-zinc-600">
                              <Label className={cn(
                                "font-semibold",
                                hasOptionsError || hasAnswerError 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : theme === 'dark' 
                                    ? 'text-gray-300' 
                                    : ''
                              )}>
                                Opciones *
                                {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 dark:text-red-400 text-xs font-normal">⚠️ Complete todas las opciones y marque la correcta</span>}
                              </Label>
                            </div>
                            <div className="space-y-2">
                              {rq.options.map((opt) => (
                                <div key={opt.id} className="space-y-2">
                                  <div 
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                      theme === 'dark'
                                        ? 'bg-zinc-800/50 border-zinc-600 hover:border-zinc-500'
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`edit-reading-q-${rq.questionId}`}
                                      checked={opt.isCorrect}
                                      onChange={() => {
                                        const updated = [...editReadingQuestions]
                                        updated[rqIndex].options = updated[rqIndex].options.map(o => ({
                                          ...o,
                                          isCorrect: o.id === opt.id
                                        }))
                                        setEditReadingQuestions(updated)
                                        // Limpiar error cuando se selecciona una respuesta
                                        if (fieldErrors[`readingQuestionAnswer_${rqIndex}`]) {
                                          setFieldErrors(prev => {
                                            const newErrors = { ...prev }
                                            delete newErrors[`readingQuestionAnswer_${rqIndex}`]
                                            return newErrors
                                          })
                                        }
                                      }}
                                      className={cn(
                                        "w-4 h-4",
                                        theme === 'dark' ? 'accent-purple-500' : ''
                                      )}
                                    />
                                    <Label className={cn(
                                      "font-medium w-6 flex-shrink-0",
                                      theme === 'dark' ? 'text-gray-300' : ''
                                    )}>
                                      {opt.id}:
                                    </Label>
                                    <Input
                                      value={opt.text || ''}
                                      onChange={(e) => {
                                        const updated = [...editReadingQuestions]
                                        updated[rqIndex].options = updated[rqIndex].options.map(o =>
                                          o.id === opt.id ? { ...o, text: e.target.value } : o
                                        )
                                        setEditReadingQuestions(updated)
                                        // Limpiar error cuando el usuario empiece a escribir
                                        if (fieldErrors[`readingQuestionOptions_${rqIndex}`]) {
                                          const allFilled = updated[rqIndex].options.every(o => 
                                            (o.text && o.text.trim()) || 
                                            o.imageUrl || 
                                            editReadingOptionImagePreviews[rq.questionId]?.[o.id]
                                          )
                                          if (allFilled) {
                                            setFieldErrors(prev => {
                                              const newErrors = { ...prev }
                                              delete newErrors[`readingQuestionOptions_${rqIndex}`]
                                              return newErrors
                                            })
                                          }
                                        }
                                      }}
                                      placeholder={`Opción ${opt.id}`}
                                      className={cn(
                                        "flex-1",
                                        hasOptionsError && !opt.text?.trim() && !opt.imageUrl && !editReadingOptionImagePreviews[rq.questionId]?.[opt.id]
                                          ? 'border-red-500 border-2' 
                                          : '',
                                        theme === 'dark' 
                                          ? 'bg-zinc-700 border-zinc-600 text-white placeholder:text-gray-500' 
                                          : ''
                                      )}
                                    />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      id={`edit-reading-option-${rq.questionId}-${opt.id}-image`}
                                      className="hidden"
                                      onChange={(e) => e.target.files && handleEditReadingOptionImageUpload(rq.questionId, opt.id, e.target.files[0])}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => document.getElementById(`edit-reading-option-${rq.questionId}-${opt.id}-image`)?.click()}
                                      className={cn(
                                        theme === 'dark' 
                                          ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' 
                                          : ''
                                      )}
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </Button>
                                    {rq.options.length > 2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const updated = [...editReadingQuestions]
                                          updated[rqIndex].options = updated[rqIndex].options.filter(o => o.id !== opt.id)
                                          setEditReadingQuestions(updated)
                                          // Limpiar imágenes de la opción eliminada
                                          removeEditReadingOptionImage(rq.questionId, opt.id)
                                        }}
                                        className={cn(
                                          "h-8 w-8 p-0 flex-shrink-0",
                                          theme === 'dark'
                                            ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50'
                                            : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                        )}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  {(editReadingOptionImagePreviews[rq.questionId]?.[opt.id] || opt.imageUrl) && (
                                    <div className="relative w-32 h-32 ml-12">
                                      <img 
                                        src={editReadingOptionImagePreviews[rq.questionId]?.[opt.id] || opt.imageUrl || ''} 
                                        alt={`Opción ${opt.id}`} 
                                        className="w-full h-full object-cover rounded" 
                                      />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-0 right-0 h-6 w-6 p-0"
                                        onClick={() => removeEditReadingOptionImage(rq.questionId, opt.id)}
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
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const newQuestionId = `edit-reading-q-${editReadingQuestions.length}-${Date.now()}`
                      setEditReadingQuestions([
                        ...editReadingQuestions,
                        {
                          id: '',
                          questionId: newQuestionId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          existingQuestionImageUrl: null,
                          options: [
                            { id: 'A', text: '', imageUrl: null, isCorrect: false },
                            { id: 'B', text: '', imageUrl: null, isCorrect: false },
                            { id: 'C', text: '', imageUrl: null, isCorrect: false },
                          ]
                        }
                      ])
                    }}
                    className={cn(
                      "w-full",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                        : ''
                    )}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Pregunta
                  </Button>
                </div>
              </>
            ) : isEditingOtherSubjectsReadingComprehension ? (
              /* Modalidad: Comprensión de Lectura (Otras Materias) - Edición */
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-other-subjects-readingText" className={cn(
                    fieldErrors['otherSubjectsReadingText'] ? 'text-red-600' : '',
                    theme === 'dark' && !fieldErrors['otherSubjectsReadingText'] ? 'text-gray-300' : ''
                  )}>
                    Texto de Lectura / Contexto *
                    {fieldErrors['otherSubjectsReadingText'] && <span className="ml-2 text-red-600">⚠️ Campo obligatorio</span>}
                  </Label>
                  <div className={cn(
                    fieldErrors['otherSubjectsReadingText'] ? 'border-2 border-red-500 rounded-md p-2' : '',
                    theme === 'dark' && !fieldErrors['otherSubjectsReadingText'] ? 'border-zinc-600' : ''
                  )}>
                    <RichTextEditor
                      value={editOtherSubjectsReadingText}
                      onChange={(html) => {
                        setEditOtherSubjectsReadingText(html)
                        if (fieldErrors['otherSubjectsReadingText']) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors['otherSubjectsReadingText']
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
                          setEditOtherSubjectsReadingImage(file)
                          const reader = new FileReader()
                          reader.onloadend = () => setEditOtherSubjectsReadingImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                      id="edit-other-subjects-reading-image"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('edit-other-subjects-reading-image')?.click()}
                      className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {editOtherSubjectsReadingExistingImageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
                    </Button>
                    {editOtherSubjectsReadingExistingImageUrl && !editOtherSubjectsReadingImagePreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setEditOtherSubjectsReadingExistingImageUrl(null)
                          setEditOtherSubjectsReadingImagePreview(null)
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Eliminar Imagen Existente
                      </Button>
                    )}
                  </div>
                  {(editOtherSubjectsReadingImagePreview || editOtherSubjectsReadingExistingImageUrl) && (
                    <div className="relative w-full max-w-md">
                      <img 
                        src={editOtherSubjectsReadingImagePreview || editOtherSubjectsReadingExistingImageUrl || ''} 
                        alt="Reading" 
                        className="w-full h-auto rounded" 
                      />
                      {editOtherSubjectsReadingImagePreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => {
                            setEditOtherSubjectsReadingImage(null)
                            setEditOtherSubjectsReadingImagePreview(null)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <Label className={cn(
                    fieldErrors['otherSubjectsReadingQuestions'] ? 'text-red-600' : '',
                    theme === 'dark' && !fieldErrors['otherSubjectsReadingQuestions'] ? 'text-gray-300 font-semibold text-lg' : 'font-semibold text-lg'
                  )}>
                    Preguntas Vinculadas *
                    {fieldErrors['otherSubjectsReadingQuestions'] && <span className="ml-2 text-red-600 text-sm">⚠️ Debe agregar al menos una pregunta</span>}
                  </Label>
                  <div className="space-y-4">
                    {editOtherSubjectsReadingQuestions.map((rq, rqIndex) => {
                      const hasOptionsError = fieldErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]
                      const hasAnswerError = fieldErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]
                      const hasAnyError = hasOptionsError || hasAnswerError
                      
                      return (
                        <div 
                          key={rq.questionId} 
                          className={cn(
                            "border-2 rounded-lg p-5 space-y-4",
                            hasAnyError 
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
                              : theme === 'dark' 
                                ? 'border-zinc-600 bg-zinc-700/50' 
                                : 'border-gray-200 bg-gray-50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <Label className={cn(hasAnyError ? 'text-red-600' : '', theme === 'dark' && !hasAnyError ? 'text-gray-300' : '')}>
                              Pregunta {rqIndex + 1}
                              {hasAnyError && <span className="ml-2 text-red-600 text-xs">⚠️ Campos incompletos</span>}
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditOtherSubjectsReadingQuestions(editOtherSubjectsReadingQuestions.filter((_, i) => i !== rqIndex))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <RichTextEditor
                            value={rq.questionText}
                            onChange={(html) => {
                              const updated = [...editOtherSubjectsReadingQuestions]
                              updated[rqIndex].questionText = html
                              setEditOtherSubjectsReadingQuestions(updated)
                            }}
                            placeholder="Texto de la pregunta (opcional)..."
                            theme={theme}
                          />
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
                                    const updated = [...editOtherSubjectsReadingQuestions]
                                    updated[rqIndex].questionImage = file
                                    const reader = new FileReader()
                                    reader.onloadend = () => {
                                      const updatedWithPreview = [...editOtherSubjectsReadingQuestions]
                                      updatedWithPreview[rqIndex].questionImagePreview = reader.result as string
                                      setEditOtherSubjectsReadingQuestions(updatedWithPreview)
                                    }
                                    reader.readAsDataURL(file)
                                    setEditOtherSubjectsReadingQuestions(updated)
                                  }
                                }}
                                className="hidden"
                                id={`edit-other-subjects-reading-question-image-${rq.questionId}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById(`edit-other-subjects-reading-question-image-${rq.questionId}`)?.click()}
                                className={cn(
                                  theme === 'dark' 
                                    ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                    : ''
                                )}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                {rq.existingQuestionImageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
                              </Button>
                              {rq.existingQuestionImageUrl && !rq.questionImagePreview && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...editOtherSubjectsReadingQuestions]
                                    updated[rqIndex].existingQuestionImageUrl = null
                                    updated[rqIndex].questionImagePreview = null
                                    setEditOtherSubjectsReadingQuestions(updated)
                                  }}
                                  className={cn(
                                    theme === 'dark'
                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                      : ''
                                  )}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Eliminar Imagen Existente
                                </Button>
                              )}
                            </div>
                            {(rq.questionImagePreview || rq.existingQuestionImageUrl) && (
                              <div className="relative w-full max-w-md">
                                <img 
                                  src={rq.questionImagePreview || rq.existingQuestionImageUrl || ''} 
                                  alt={`Pregunta ${rqIndex + 1}`} 
                                  className="w-full h-auto rounded border border-zinc-600" 
                                />
                                {rq.questionImagePreview && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className={cn(
                                      "absolute top-0 right-0",
                                      theme === 'dark'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : ''
                                    )}
                                    onClick={() => {
                                      const updated = [...editOtherSubjectsReadingQuestions]
                                      updated[rqIndex].questionImage = null
                                      updated[rqIndex].questionImagePreview = null
                                      setEditOtherSubjectsReadingQuestions(updated)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className={cn(hasOptionsError || hasAnswerError ? 'text-red-600' : '', theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-gray-300' : '')}>
                              Opciones *
                              {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                            </Label>
                            {rq.options.map((opt) => (
                              <div key={opt.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`edit-other-subjects-reading-q-${rq.questionId}`}
                                    checked={opt.isCorrect}
                                    onChange={() => {
                                      const updated = [...editOtherSubjectsReadingQuestions]
                                      updated[rqIndex].options = updated[rqIndex].options.map(o => ({
                                        ...o,
                                        isCorrect: o.id === opt.id
                                      }))
                                      setEditOtherSubjectsReadingQuestions(updated)
                                      // Limpiar error cuando se selecciona una respuesta
                                      if (fieldErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]) {
                                        setFieldErrors(prev => {
                                          const newErrors = { ...prev }
                                          delete newErrors[`otherSubjectsReadingQuestionAnswer_${rqIndex}`]
                                          return newErrors
                                        })
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <Label className={cn("font-medium w-6", theme === 'dark' ? 'text-gray-300' : '')}>{opt.id}:</Label>
                                  <div className={cn(`flex-1`, hasOptionsError && !opt.text?.trim() && !opt.imageUrl && !editReadingOptionImagePreviews[rq.questionId]?.[opt.id] ? 'border-2 border-red-500 rounded' : '')}>
                                    <RichTextEditor
                                      value={opt.text || ''}
                                      onChange={(html) => {
                                        const updated = [...editOtherSubjectsReadingQuestions]
                                        updated[rqIndex].options = updated[rqIndex].options.map(o =>
                                          o.id === opt.id ? { ...o, text: html } : o
                                        )
                                        setEditOtherSubjectsReadingQuestions(updated)
                                        // Limpiar error cuando el usuario empiece a escribir
                                        if (fieldErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]) {
                                          const allFilled = updated[rqIndex].options.every(o => 
                                            (o.text && o.text.trim()) || 
                                            o.imageUrl || 
                                            editReadingOptionImagePreviews[rq.questionId]?.[o.id]
                                          )
                                          if (allFilled) {
                                            setFieldErrors(prev => {
                                              const newErrors = { ...prev }
                                              delete newErrors[`otherSubjectsReadingQuestionOptions_${rqIndex}`]
                                              return newErrors
                                            })
                                          }
                                        }
                                      }}
                                      placeholder={`Opción ${opt.id}`}
                                      theme={theme}
                                      minimalToolbar={true}
                                      className="min-h-[40px]"
                                    />
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    id={`edit-other-subjects-reading-option-${rq.questionId}-${opt.id}-image`}
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleEditReadingOptionImageUpload(rq.questionId, opt.id, e.target.files[0])}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById(`edit-other-subjects-reading-option-${rq.questionId}-${opt.id}-image`)?.click()}
                                    className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  {rq.options.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [...editOtherSubjectsReadingQuestions]
                                        updated[rqIndex].options = updated[rqIndex].options.filter(o => o.id !== opt.id)
                                        setEditOtherSubjectsReadingQuestions(updated)
                                        // Limpiar imágenes de la opción eliminada
                                        removeEditReadingOptionImage(rq.questionId, opt.id)
                                      }}
                                      className={cn(
                                        "h-8 w-8 p-0",
                                        theme === 'dark'
                                          ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50'
                                          : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                      )}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                {(editReadingOptionImagePreviews[rq.questionId]?.[opt.id] || opt.imageUrl) && (
                                  <div className="relative w-32 h-32 ml-10">
                                    <img 
                                      src={editReadingOptionImagePreviews[rq.questionId]?.[opt.id] || opt.imageUrl || ''} 
                                      alt={`Opción ${opt.id}`} 
                                      className="w-full h-full object-cover rounded" 
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-0 right-0 h-6 w-6 p-0"
                                      onClick={() => removeEditReadingOptionImage(rq.questionId, opt.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updated = [...editOtherSubjectsReadingQuestions]
                                const currentOptions = updated[rqIndex].options
                                const nextLetter = getNextAvailableOptionLetter(currentOptions)
                                updated[rqIndex].options = [
                                  ...currentOptions,
                                  {
                                    id: nextLetter as any,
                                    text: '',
                                    imageUrl: null,
                                    isCorrect: false
                                  }
                                ]
                                setEditOtherSubjectsReadingQuestions(updated)
                              }}
                              className={cn(
                                theme === 'dark' 
                                  ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                  : ''
                              )}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Agregar Opción
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const newQuestionId = `edit-other-subjects-reading-q-${editOtherSubjectsReadingQuestions.length}-${Date.now()}`
                      setEditOtherSubjectsReadingQuestions([
                        ...editOtherSubjectsReadingQuestions,
                        {
                          id: '',
                          questionId: newQuestionId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          existingQuestionImageUrl: null,
                          options: [
                            { id: 'A', text: '', imageUrl: null, isCorrect: false },
                            { id: 'B', text: '', imageUrl: null, isCorrect: false },
                            { id: 'C', text: '', imageUrl: null, isCorrect: false },
                          ]
                        }
                      ])
                    }}
                    className={cn("w-full", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Pregunta
                  </Button>
                </div>
              </>
            ) : formData.subjectCode === 'IN' && inglesModality === 'matching_columns' ? (
              /* Modalidad: Matching / Columnas - Edición */
              <>
                {/* Texto Compartido */}
                <div className="space-y-2">
                  <Label htmlFor="edit-informativeText" className={cn(theme === 'dark' ? 'text-white' : '')}>
                    Texto Compartido (opcional)
                  </Label>
                  <RichTextEditor
                    ref={editInformativeTextEditorRef}
                    value={formData.informativeText}
                    onChange={(html) => setFormData({ ...formData, informativeText: html })}
                    placeholder="Texto compartido para todas las preguntas..."
                    theme={theme}
                  />
                </div>

                {/* Preguntas de Matching / Columnas */}
                <div className="space-y-2">
                  <Label className={cn(
                    fieldErrors['matchingQuestions'] ? 'text-red-600' : '',
                    theme === 'dark' && !fieldErrors['matchingQuestions'] ? 'text-white' : ''
                  )}>
                    Preguntas de Matching / Columnas *
                    {fieldErrors['matchingQuestions'] && <span className="ml-2 text-red-600">⚠️ Debe agregar al menos una pregunta</span>}
                  </Label>
                  {matchingQuestions.map((mq, mqIndex) => {
                    const hasTextError = fieldErrors[`matchingQuestionText_${mqIndex}`]
                    const hasOptionsError = fieldErrors[`matchingQuestionOptions_${mqIndex}`]
                    const hasAnswerError = fieldErrors[`matchingQuestionAnswer_${mqIndex}`]
                    const hasAnyError = hasTextError || hasOptionsError || hasAnswerError
                    
                    return (
                      <div key={mq.id} className={cn(
                        "border-2 rounded-lg p-4 space-y-3",
                        hasAnyError 
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600' 
                          : theme === 'dark' 
                            ? 'border-zinc-700 bg-zinc-800' 
                            : 'border-gray-200'
                      )}>
                        <div className="flex items-center justify-between">
                          <Label className={cn(
                            hasAnyError ? 'text-red-600 dark:text-red-400' : '',
                            theme === 'dark' && !hasAnyError ? 'text-white' : ''
                          )}>
                            Pregunta {mqIndex + 1}
                            {hasAnyError && <span className="ml-2 text-red-600 dark:text-red-400 text-xs">⚠️ Campos incompletos</span>}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-7 w-7 p-0",
                              theme === 'dark' ? 'text-white hover:bg-zinc-700' : ''
                            )}
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
                        {/* Campo para imagen de la pregunta */}
                        <div className="space-y-2">
                          <Label className={cn(theme === 'dark' ? 'text-white' : '')}>
                            Imagen de la Pregunta (Opcional)
                          </Label>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    // Validar tamaño (máximo 5MB)
                                    if (file.size > 5 * 1024 * 1024) {
                                      notifyError({
                                        title: 'Error',
                                        message: 'La imagen es demasiado grande. Tamaño máximo: 5MB'
                                      })
                                      return
                                    }
                                    // Validar tipo
                                    if (!file.type.startsWith('image/')) {
                                      notifyError({
                                        title: 'Error',
                                        message: 'El archivo debe ser una imagen'
                                      })
                                      return
                                    }
                                    // Crear vista previa
                                    const reader = new FileReader()
                                    reader.onloadend = () => {
                                      const updated = [...matchingQuestions]
                                      updated[mqIndex].questionImage = file
                                      updated[mqIndex].questionImagePreview = reader.result as string
                                      setMatchingQuestions(updated)
                                    }
                                    reader.readAsDataURL(file)
                                  }
                                }}
                                className={cn(
                                  "cursor-pointer",
                                  theme === 'dark' ? 'text-white file:text-white file:bg-zinc-700 file:border-zinc-600' : ''
                                )}
                              />
                            </div>
                            {mq.questionImagePreview && (
                              <div className="relative">
                                <img
                                  src={mq.questionImagePreview}
                                  alt="Vista previa"
                                  className="h-20 w-20 object-cover rounded border"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white"
                                  onClick={() => {
                                    const updated = [...matchingQuestions]
                                    updated[mqIndex].questionImage = null
                                    updated[mqIndex].questionImagePreview = null
                                    setMatchingQuestions(updated)
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...matchingQuestions]
                              const currentOptions = updated[mqIndex].options
                              const nextLetter = getNextAvailableOptionLetter(currentOptions)
                              updated[mqIndex].options = [
                                ...currentOptions,
                                {
                                  id: nextLetter as any,
                                  text: '',
                                  imageUrl: null,
                                  isCorrect: false
                                }
                              ]
                              setMatchingQuestions(updated)
                            }}
                            className={cn(
                              "h-7 text-xs mt-2",
                              theme === 'dark' 
                                ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                                : ''
                            )}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar Opción
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Label className={cn(
                              hasOptionsError || hasAnswerError ? 'text-red-600 dark:text-red-400' : '',
                              theme === 'dark' && !hasOptionsError && !hasAnswerError ? 'text-white' : ''
                            )}>
                              Opciones de Respuesta *
                              {(hasOptionsError || hasAnswerError) && <span className="ml-2 text-red-600 dark:text-red-400 text-xs">⚠️ Complete todas las opciones y marque la correcta</span>}
                            </Label>
                          </div>
                          {mq.options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`edit-matching-q-${mq.id}`}
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
                                className={cn(
                                  "w-4 h-4",
                                  theme === 'dark' ? 'accent-purple-500' : ''
                                )}
                              />
                              <Label className={cn(
                                "font-medium w-6",
                                theme === 'dark' ? 'text-white' : ''
                              )}>
                                {opt.id}:
                              </Label>
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
                                className={cn(
                                  "flex-1",
                                  hasOptionsError && !opt.text?.trim() ? 'border-red-500 dark:border-red-600' : '',
                                  theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 placeholder:text-zinc-400' : ''
                                )}
                              />
                              {mq.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...matchingQuestions]
                                    updated[mqIndex].options = updated[mqIndex].options.filter(o => o.id !== opt.id)
                                    setMatchingQuestions(updated)
                                  }}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    theme === 'dark' 
                                      ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30' 
                                      : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                  )}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        {hasAnswerError && (
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )}>
                            ⚠️ Debe marcar exactamente una opción como correcta
                          </p>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full mt-4",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                        : ''
                    )}
                    onClick={() => {
                      const newId = `mq-edit-${matchingQuestions.length + 1}-${Date.now()}`
                      // Crear opciones A-H (8 opciones iniciales)
                      const initialOptions: QuestionOption[] = Array.from({ length: 8 }, (_, i) => ({
                        id: getOptionLetter(i) as any,
                        text: '',
                        imageUrl: null,
                        isCorrect: false
                      }))
                      setMatchingQuestions([
                        ...matchingQuestions,
                        {
                          id: newId,
                          questionText: '',
                          questionImage: null,
                          questionImagePreview: null,
                          options: initialOptions
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
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Pregunta de Matching
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Texto informativo */}
                <div className="space-y-2">
                  <Label 
                    htmlFor="edit-informativeText" 
                    className={cn(theme === 'dark' ? 'text-gray-300' : '')}
                  >
                    {(formData.subjectCode === 'IN' && (inglesModality === 'matching_columns' || 
                      (formData.informativeText && typeof formData.informativeText === 'string' && formData.informativeText.includes('MATCHING_COLUMNS_'))))
                      ? 'Texto Compartido (opcional)'
                      : 'Texto Informativo (opcional)'}
                  </Label>
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

            {/* Secciones para preguntas normales (NO cloze test, NO comprensión de lectura, NO matching/columnas, NO comprensión lectura otras materias) */}
            {!isEditingClozeTest && !isEditingReadingComprehension && !isEditingOtherSubjectsReadingComprehension && !(formData.subjectCode === 'IN' && inglesModality === 'matching_columns') && (
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

            {/* Opciones de respuesta - Solo mostrar si NO es cloze test, NO es comprensión de lectura, NO es comprensión lectura otras materias, y NO es matching/columnas */}
            {!isEditingClozeTest && !isEditingReadingComprehension && !isEditingOtherSubjectsReadingComprehension && !(formData.subjectCode === 'IN' && inglesModality === 'matching_columns') && (
              <div>
                <div className="space-y-2">
                  <div>
                    <Label className={cn(fieldErrors['options'] || fieldErrors['correctAnswer'] ? 'text-red-600' : '', theme === 'dark' && !fieldErrors['options'] && !fieldErrors['correctAnswer'] ? 'text-gray-300' : '')}>
                      Opciones de Respuesta *
                      {fieldErrors['options'] && <span className="ml-2 text-red-600">⚠️ Todas las opciones deben tener contenido</span>}
                      {fieldErrors['correctAnswer'] && <span className="ml-2 text-red-600">⚠️ Debe marcar exactamente una opción como correcta</span>}
                    </Label>
                    <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Cada opción debe tener texto o imagen. Marque la opción correcta.
                    </p>
                  </div>
                </div>
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
                          {options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setOptions(options.filter(opt => opt.id !== option.id))
                                setOptionFiles(prev => {
                                  const newFiles = { ...prev }
                                  delete newFiles[option.id]
                                  return newFiles
                                })
                                setOptionImagePreviews(prev => {
                                  const newPreviews = { ...prev }
                                  delete newPreviews[option.id]
                                  return newPreviews
                                })
                              }}
                              className={cn(
                                "h-8 w-8 p-0",
                                theme === 'dark'
                                  ? 'text-red-400 hover:text-red-300 hover:bg-red-950/50'
                                  : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              )}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {(optionImagePreviews[option.id] || option.imageUrl) && (
                        <div className="relative w-32 h-32">
                          <img 
                            src={optionImagePreviews[option.id] || option.imageUrl || ''} 
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextLetter = getNextAvailableOptionLetter(options)
                      setOptions([
                        ...options,
                        {
                          id: nextLetter as any,
                          text: '',
                          imageUrl: null,
                          isCorrect: false
                        }
                      ])
                      setOptionFiles(prev => ({ ...prev, [nextLetter]: null }))
                      setOptionImagePreviews(prev => ({ ...prev, [nextLetter]: null }))
                    }}
                    className={cn(
                      "h-7 text-xs mt-2",
                      theme === 'dark' 
                        ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600 hover:text-white hover:border-zinc-500' 
                        : ''
                    )}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar Opción
                  </Button>
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
              className={cn(
                theme === 'dark' 
                  ? 'border-zinc-600 text-gray-300 hover:bg-zinc-700 hover:text-white' 
                  : ''
              )}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateQuestion} 
              disabled={isLoading}
              className={cn(
                theme === 'dark'
                  ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-600/50'
                  : 'bg-black text-white hover:bg-gray-800'
              )}
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
                                ? (() => {
                                    const isClozeTest = relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco'))
                                    const isMatchingColumns = relatedQuestions.some(q => 
                                      q.subjectCode === 'IN' && 
                                      q.informativeText && 
                                      typeof q.informativeText === 'string' &&
                                      (q.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                       q.informativeText.includes('MATCHING_COLUMNS_'))
                                    )
                                    const isOtherSubjectsReadingComprehension = relatedQuestions.length > 1 &&
                                      relatedQuestions.some(q => 
                                        q.subjectCode !== 'IN' && 
                                        q.informativeText && 
                                        !q.questionText?.includes('completar el hueco') &&
                                        !q.informativeText?.includes('MATCHING_COLUMNS_')
                                      )
                                    const isEnglishReadingComprehension = relatedQuestions.length > 1 &&
                                      relatedQuestions.some(q => 
                                        q.subjectCode === 'IN' && 
                                        q.informativeText && 
                                        !isMatchingColumns &&
                                        !isClozeTest
                                      )
                                    
                                    if (isClozeTest) {
                                      return `Cloze Test / Rellenar Huecos (${relatedQuestions.length} preguntas agrupadas)`
                                    } else if (isMatchingColumns) {
                                      return `Matching / Columnas (${relatedQuestions.length} preguntas)`
                                    } else if (isOtherSubjectsReadingComprehension) {
                                      return `Comprensión de Lectura Corta (${relatedQuestions.length} preguntas)`
                                    } else if (isEnglishReadingComprehension) {
                                      return `Comprensión de Lectura Corta (${relatedQuestions.length} preguntas)`
                                    } else {
                                      // Si hay múltiples preguntas pero no encajan en las categorías anteriores,
                                      // mostrar como opción múltiple estándar (preguntas individuales agrupadas)
                                      return `Opción Múltiple Estándar (${relatedQuestions.length} preguntas)`
                                    }
                                  })()
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
                            <div className="flex items-center justify-between">
                              <CardTitle className={cn("text-lg flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                                <BookOpen className={cn("h-5 w-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                                {/* Detectar el tipo de modalidad para mostrar el título correcto */}
                                {(() => {
                                  const isClozeTest = relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco'))
                                  const isMatchingColumns = relatedQuestions.some(q => 
                                    q.subjectCode === 'IN' && 
                                    q.informativeText && 
                                    typeof q.informativeText === 'string' &&
                                    (q.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                     q.informativeText.includes('MATCHING_COLUMNS_'))
                                  )
                                  if (isClozeTest) {
                                    return 'Texto de Cloze Test (Rellenar Huecos)'
                                  } else if (isMatchingColumns) {
                                    return 'Texto Compartido'
                                  } else {
                                    return 'Texto de Lectura Compartido'
                                  }
                                })()}
                              </CardTitle>
                              {/* Símbolo de alarma para Cloze Test cuando hay respuesta incorrecta */}
                              {(() => {
                                const isClozeTest = relatedQuestions.some(q => q.questionText && q.questionText.includes('completar el hueco'))
                                if (isClozeTest) {
                                  // Verificar si hay algún hueco con respuesta incorrecta
                                  const hasIncorrectAnswer = relatedQuestions.some(q => {
                                    const match = q.questionText?.match(/hueco \[(\d+)\]/)
                                    if (match) {
                                      const gapNum = parseInt(match[1])
                                      const selectedAnswer = selectedClozeAnswers[gapNum]
                                      if (selectedAnswer) {
                                        const selectedOption = q.options.find(opt => opt.id === selectedAnswer)
                                        return selectedOption && !selectedOption.isCorrect
                                      }
                                    }
                                    return false
                                  })
                                  
                                  if (hasIncorrectAnswer) {
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={cn("flex items-center justify-center h-8 w-8 rounded-full", theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')}>
                                              <AlertCircle className="h-5 w-5" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Hay respuestas incorrectas en los huecos</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )
                                  }
                                }
                                return null
                              })()}
                            </div>
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
                                /* Visualización normal para comprensión de lectura o matching/columnas */
                                <>
                                  {/* Texto informativo compartido */}
                                  {selectedQuestion.informativeText && (() => {
                                    // Extraer el texto real si es matching/columnas
                                    const isMatchingColumns = selectedQuestion.subjectCode === 'IN' && 
                                                             selectedQuestion.informativeText && 
                                                             typeof selectedQuestion.informativeText === 'string' &&
                                                             (selectedQuestion.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                                              selectedQuestion.informativeText.includes('MATCHING_COLUMNS_'))
                                    const displayText = isMatchingColumns 
                                      ? extractMatchingText(selectedQuestion.informativeText) 
                                      : selectedQuestion.informativeText
                                    
                                    if (!displayText || !displayText.trim()) return null
                                    
                                    return (
                                      <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                                        <div
                                          className={cn("leading-relaxed prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(displayText)) }}
                                        />
                                      </div>
                                    )
                                  })()}
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
                              <div className="flex items-center gap-2">
                                <CardTitle className={cn(
                                  // Reducir tamaño del título para matching/columnas y comprensión de lectura
                                  (() => {
                                    const isMatchingColumns = question.subjectCode === 'IN' && 
                                      question.informativeText &&
                                      typeof question.informativeText === 'string' &&
                                      (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                       question.informativeText.includes('MATCHING_COLUMNS_'))
                                    
                                    const isReadingComprehension = !isMatchingColumns &&
                                      question.subjectCode === 'IN' &&
                                      question.informativeText &&
                                      typeof question.informativeText === 'string' &&
                                      question.informativeText.trim().length > 0 &&
                                      !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                      !question.questionText?.includes('completar el hueco')
                                    
                                    return (isMatchingColumns || isReadingComprehension) ? "text-sm font-medium" : "text-xl"
                                  })(),
                                  theme === 'dark' ? 'text-white' : ''
                                )}>
                                  {relatedQuestions.length > 1 
                                    ? `Pregunta ${index + 1} de ${relatedQuestions.length}` 
                                    : 'Pregunta 1'}
                                </CardTitle>
                                {/* Símbolo de alarma cuando hay respuesta incorrecta seleccionada */}
                                {(() => {
                                  const questionKey = question.id || question.code
                                  const isMatchingColumns = question.subjectCode === 'IN' && 
                                    question.informativeText &&
                                    typeof question.informativeText === 'string' &&
                                    (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                     question.informativeText.includes('MATCHING_COLUMNS_'))
                                  
                                  let selectedAnswer: string | undefined
                                  let hasIncorrectAnswer = false
                                  
                                  if (isMatchingColumns) {
                                    selectedAnswer = selectedMatchingAnswers[questionKey]
                                    if (selectedAnswer) {
                                      const selectedOption = question.options.find(opt => opt.id === selectedAnswer)
                                      hasIncorrectAnswer = selectedOption ? !selectedOption.isCorrect : false
                                    }
                                  } else {
                                    // Pregunta estándar (no Cloze Test, ya que esas no se muestran individualmente)
                                    selectedAnswer = selectedStandardAnswers[questionKey]
                                    if (selectedAnswer) {
                                      const selectedOption = question.options.find(opt => opt.id === selectedAnswer)
                                      hasIncorrectAnswer = selectedOption ? !selectedOption.isCorrect : false
                                    }
                                  }
                                  
                                  if (hasIncorrectAnswer) {
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={cn("flex items-center justify-center h-8 w-8 rounded-full", theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600')}>
                                              <AlertCircle className="h-5 w-5" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Respuesta incorrecta seleccionada</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
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

                              {/* Texto de la pregunta - Omitir si es Matching/Columnas (se muestra en la columna correspondiente) */}
                              {question.questionText && !(
                                question.subjectCode === 'IN' && 
                                question.informativeText &&
                                typeof question.informativeText === 'string' &&
                                (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                 question.informativeText.includes('MATCHING_COLUMNS_'))
                              ) && (
                                <div
                                  className={cn(
                                    "leading-relaxed font-medium prose max-w-none",
                                    // Aumentar tamaño para comprensión de lectura
                                    (() => {
                                      const isMatchingColumns = question.subjectCode === 'IN' && 
                                        question.informativeText &&
                                        typeof question.informativeText === 'string' &&
                                        (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                         question.informativeText.includes('MATCHING_COLUMNS_'))
                                      
                                      const isReadingComprehension = !isMatchingColumns &&
                                        question.subjectCode === 'IN' &&
                                        question.informativeText &&
                                        typeof question.informativeText === 'string' &&
                                        question.informativeText.trim().length > 0 &&
                                        !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                        !question.questionText?.includes('completar el hueco')
                                      
                                      return isReadingComprehension 
                                        ? "text-xl prose-xl" 
                                        : "text-lg prose-lg"
                                    })(),
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(question.questionText)) }}
                                />
                              )}
                            </div>
                            
                            {/* RadioGroup de opciones - Formato especial SOLO para Matching / Columnas */}
                            {/* Para Opción Múltiple Estándar en inglés, usar formato estándar como otras materias */}
                            {question.subjectCode === 'IN' && 
                             question.options && 
                             question.options.length > 0 &&
                             question.informativeText &&
                             typeof question.informativeText === 'string' &&
                             (question.informativeText.startsWith('MATCHING_COLUMNS_') || 
                              question.informativeText.includes('MATCHING_COLUMNS_')) ? (
                              /* Formato Matching: Pregunta y Respuesta al frente con botón expandible superpuesto */
                              <div className="mt-4">
                                <div className={cn("border rounded-lg overflow-visible relative", theme === 'dark' ? 'border-zinc-700' : '')}>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                    {/* Columna de Pregunta */}
                                    <div className={cn("p-4 border-r", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                                      <div className={cn("leading-relaxed text-base font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {question.questionText && (
                                          <div
                                            className="prose prose-base max-w-none"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMathInHtml(question.questionText)) }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    {/* Columna de Respuestas con botón expandible */}
                                    <div 
                                      className={cn("p-4 relative", theme === 'dark' ? 'bg-zinc-800' : 'bg-white')}
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
                                              <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Ver Opciones de Respuesta</span>
                                              {selectedMatchingAnswers[question.id || question.code] && (() => {
                                                const selectedOptionId = selectedMatchingAnswers[question.id || question.code]
                                                const selectedOption = question.options.find(opt => opt.id === selectedOptionId)
                                                const selectedText = selectedOption?.text ? stripHtmlTags(selectedOption.text) : ''
                                                return selectedText ? (
                                                  <span className={cn("text-sm font-semibold px-2 py-0.5 rounded max-w-[300px] truncate", theme === 'dark' ? 'text-purple-300 bg-purple-900/50' : 'text-purple-600 bg-purple-100')} title={selectedText}>
                                                    {selectedOptionId}: {selectedText}
                                                  </span>
                                                ) : (
                                                  <span className={cn("text-sm font-semibold px-2 py-0.5 rounded", theme === 'dark' ? 'text-purple-300 bg-purple-900/50' : 'text-purple-600 bg-purple-100')}>
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
                                                    <span className={cn("font-semibold text-sm flex-shrink-0", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{option.id}.</span>
                                                    <div className="flex-1 min-w-0">
                                                      {option.text && (
                                                        <div
                                                          className={cn("prose prose-base max-w-none text-sm break-words", theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}
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
                            <RadioGroup 
                              className="space-y-4 mt-6" 
                              value={selectedStandardAnswers[question.id || question.code] || ''}
                              onValueChange={(value) => {
                                const questionKey = question.id || question.code
                                setSelectedStandardAnswers(prev => ({
                                  ...prev,
                                  [questionKey]: value
                                }))
                              }}
                            >
                              {question.options.map((option) => {
                                // Detectar si es comprensión de lectura para aumentar tamaño
                                const isReadingComprehension = question.subjectCode === 'IN' &&
                                  question.informativeText &&
                                  typeof question.informativeText === 'string' &&
                                  question.informativeText.trim().length > 0 &&
                                  !question.informativeText.includes('MATCHING_COLUMNS_') &&
                                  !question.questionText?.includes('completar el hueco')
                                
                                return (
                                <div
                                  key={option.id}
                                  className={cn(
                                    "flex items-start space-x-3 border rounded-lg transition-colors",
                                    isReadingComprehension ? "p-4" : "p-3",
                                    theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-700' : 'hover:bg-gray-50'
                                  )}
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
                                      <span className={cn(
                                        "font-semibold mr-2",
                                        isReadingComprehension ? "text-base" : "",
                                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                                      )}>{option.id}.</span>
                                      <div className="flex-1">
                                        {option.text && (
                                          <div
                                            className={cn(
                                              "prose max-w-none",
                                              isReadingComprehension ? "prose-lg text-base" : "",
                                              theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                                            )}
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
                                )
                              })}
                            </RadioGroup>
                            )}

                            {/* Sección de Justificación generada por IA - Solo visible para Admin */}
                            <div className="mt-6 pt-6 border-t">
                              <div className={cn("flex items-center gap-2 mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                <HelpCircle className={cn("h-5 w-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                                <h4 className={cn("font-semibold text-lg", theme === 'dark' ? 'text-white' : '')}>
                                  Justificación generada por IA
                                </h4>
                              </div>

                              {question.aiJustification ? (
                                <div className={cn("space-y-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50/50 border-purple-200')}>
                                  {/* Explicación de la respuesta correcta */}
                                  <div>
                                    <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      Explicación de la respuesta correcta
                                    </h5>
                                    <MathText 
                                      text={question.aiJustification.correctAnswerExplanation}
                                      className={cn("text-sm leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                    />
                                  </div>

                                  {/* Explicaciones de respuestas incorrectas */}
                                  {question.aiJustification.incorrectAnswersExplanation && question.aiJustification.incorrectAnswersExplanation.length > 0 && (
                                    <div>
                                      <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                        <AlertCircle className="h-4 w-4 text-orange-500" />
                                        Explicaciones de respuestas incorrectas
                                      </h5>
                                      <div className="space-y-3">
                                        {question.aiJustification.incorrectAnswersExplanation.map((explanation, idx) => (
                                          <div 
                                            key={idx} 
                                            className={cn("p-3 rounded border", theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200')}
                                          >
                                            <span className={cn("font-semibold text-sm", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>
                                              Opción {explanation.optionId}:
                                            </span>
                                            <MathText 
                                              text={explanation.explanation}
                                              className={cn("text-sm mt-1 leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Conceptos clave */}
                                  {question.aiJustification.keyConcepts && question.aiJustification.keyConcepts.length > 0 && (
                                    <div>
                                      <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                        <BookOpen className="h-4 w-4 text-blue-500" />
                                        Conceptos clave
                                      </h5>
                                      <ul className={cn("list-disc list-inside space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                        {question.aiJustification.keyConcepts.map((concept, idx) => (
                                          <li key={idx} className="text-sm">{concept}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Metadata */}
                                  <div className={cn("pt-3 border-t flex items-center justify-between text-xs", theme === 'dark' ? 'border-zinc-700 text-gray-400' : 'border-gray-200 text-gray-500')}>
                                    <div className="flex items-center gap-4">
                                      <span>
                                        Dificultad percibida: <span className="font-semibold">{question.aiJustification.perceivedDifficulty}</span>
                                      </span>
                                      <span>
                                        Confianza: <span className="font-semibold">{(question.aiJustification.confidence * 100).toFixed(0)}%</span>
                                      </span>
                                    </div>
                                    {question.aiJustification.generatedBy && (
                                      <span>
                                        Generado por: <span className="font-semibold">{question.aiJustification.generatedBy}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={cn("p-4 rounded-lg border text-center", theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                                  <AlertCircle className={cn("h-8 w-8 mx-auto mb-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                                  <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    En espera de justificación
                                  </p>
                                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    La justificación será generada automáticamente por la IA
                                  </p>
                                </div>
                              )}
                            </div>
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
 
