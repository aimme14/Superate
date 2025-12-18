import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ContactRound, NotepadText, BarChart2, Apple, CheckCircle2, AlertCircle, Clock, BookOpen, TrendingUp, User, Shield, Eye, X, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { doc, getDoc, getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseApp } from "@/services/firebase/db.service";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { questionService, Question } from "@/services/firebase/question.service";
import ImageGallery from "@/components/common/ImageGallery";
import { sanitizeMathHtml } from "@/utils/sanitizeMathHtml";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/context/ThemeContext";
import { getAllPhases, getPhaseType } from "@/utils/firestoreHelpers";

const db = getFirestore(firebaseApp);

// Función para eliminar etiquetas HTML y obtener solo el texto
const stripHtml = (html: string): string => {
  if (!html) return ''
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  return tempDiv.textContent || tempDiv.innerText || ''
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
      // Reemplazar √x (símbolo Unicode)
      replaced = replaced.replace(/√\s*([^\s]+)/g, (_m, inner) => {
        return `<span class="katex-formula" data-latex="\\sqrt{${inner}}"></span>`
      })
      if (replaced !== text) {
        const wrapper = document.createElement('span')
        wrapper.innerHTML = replaced
        textNode.parentNode?.replaceChild(wrapper, textNode)
      }
    })
  } catch (e) {
    console.warn('Error procesando fórmulas matemáticas:', e)
  }
  
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
    processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (_match, latex) => {
      return `<span class="katex-formula" data-latex="${latex.trim()}" data-display="true"></span>`
    })
    
    // Convertir fórmulas inline $...$
    processedText = processedText.replace(/\$([^$]+)\$/g, (_match, latex) => {
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
        import('katex').then((katexModule) => {
          const katex = katexModule.default
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
        }).catch(() => {
          console.warn('No se pudo cargar KaTeX')
        })
      }
    })
  }, [text])
  
  return <div ref={containerRef} className={className} />
}

interface ExamScore {
  correctAnswers: number;
  totalAnswered: number;
  totalQuestions: number;
  percentage: number;
  overallPercentage: number;
}

interface ExamResult {
  userId: string;
  examId: string;
  examTitle: string;
  answers: { [key: string]: string };
  score: ExamScore;
  topic: string;
  timeExpired: boolean;
  lockedByTabChange: boolean;
  tabChangeCount: number;
  startTime: string;
  endTime: string;
  timeSpent: number;
  completed: boolean;
  timestamp: number;
  phase?: string;
  questionDetails: Array<{
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
  }>;
}

interface UserResults {
  [examId: string]: ExamResult;
}

export default function EvaluationsTab() {
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedQuestionDetail, setSelectedQuestionDetail] = useState<{
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
  } | null>(null);
  const [showQuestionView, setShowQuestionView] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    'fase I': true,
    'Fase II': true,
    'fase III': true,
  });
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();

  useEffect(() => {
    const fetchEvaluations = async () => {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setEvaluations([]);
        setLoading(false);
        return;
      }

      try {
        // Obtenemos los resultados de todas las subcolecciones de fases
        const phases = getAllPhases();
        const evaluationsArray: any[] = [];

        // Leer de las subcolecciones de fases
        for (const phaseName of phases) {
          const phaseRef = collection(db, "results", user.uid, phaseName);
          const phaseSnap = await getDocs(phaseRef);
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data();
            // Determinar la fase: SIEMPRE usar el nombre de la subcolección como fuente de verdad
            // Esto asegura que incluso si el documento tiene phase: undefined, sabemos la fase correcta
            const phaseFromCollection = getPhaseType(phaseName); // Esto devuelve 'first', 'second', 'third' o null
            const phaseFromDocument = examData.phase;
            
            // Priorizar: si el documento tiene una fase válida, usarla; sino, usar la de la subcolección
            let finalPhase: string = 'first'; // Valor por defecto
            
            // Primero intentar usar la fase de la subcolección (fuente de verdad más confiable)
            if (phaseFromCollection) {
              finalPhase = phaseFromCollection;
            }
            
            // Si el documento tiene una fase válida, intentar usarla (pero solo si es válida)
            if (phaseFromDocument) {
              const phaseType = getPhaseType(String(phaseFromDocument));
              if (phaseType) {
                // El documento tiene una fase válida en formato 'first', 'second', 'third'
                finalPhase = phaseType;
              } else if (phaseFromDocument === 'fase I' || phaseFromDocument === 'Fase I' || 
                         phaseFromDocument === 'Fase II' || phaseFromDocument === 'fase II' ||
                         phaseFromDocument === 'fase III' || phaseFromDocument === 'Fase III') {
                // El documento tiene una fase en formato español, convertirla
                const convertedPhase = getPhaseType(phaseFromDocument);
                if (convertedPhase) {
                  finalPhase = convertedPhase;
                }
              }
            }
            
            // Asegurar que siempre tengamos un valor válido
            if (!finalPhase || (finalPhase !== 'first' && finalPhase !== 'second' && finalPhase !== 'third')) {
              // Si no pudimos determinar la fase, usar la de la subcolección o 'first' por defecto
              finalPhase = phaseFromCollection || 'first';
            }
            
            // Debug: Log para resultados problemáticos
            if (!examData.phase || examData.phase === undefined) {
              console.log(`🔍 Resultado sin phase en documento - Subcolección: ${phaseName}, Fase asignada: ${finalPhase}`, {
                examTitle: examData.examTitle,
                examId: doc.id,
                phaseFromCollection,
                phaseFromDocument: examData.phase
              });
            }
            
            evaluationsArray.push({
              ...examData,
              examId: doc.id,
              phase: finalPhase,
            });
          });
        }

        // También leer de la estructura antigua para compatibilidad
        const oldDocRef = doc(db, "results", user.uid);
        const oldDocSnap = await getDoc(oldDocRef);
        if (oldDocSnap.exists()) {
          const oldData = oldDocSnap.data() as UserResults;
          Object.entries(oldData).forEach(([examId, examData]) => {
            // Intentar inferir la fase del título o usar 'first' por defecto
            let inferredPhase: string = 'first';
            if (examData.phase) {
              const phaseType = getPhaseType(String(examData.phase));
              if (phaseType) {
                inferredPhase = phaseType;
              }
            } else if (examData.examTitle) {
              // Intentar inferir de el título
              const title = String(examData.examTitle).toLowerCase();
              if (title.includes('fase ii') || title.includes('segunda fase')) {
                inferredPhase = 'second';
              } else if (title.includes('fase iii') || title.includes('tercera fase')) {
                inferredPhase = 'third';
              }
            }
            
            evaluationsArray.push({
              ...examData,
              examId,
              phase: inferredPhase,
            });
          });
        }

        // Ordenamos por fecha (más reciente primero)
        evaluationsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Debug: Log para ver qué fases tienen los resultados
        console.log('📊 Resultados agrupados por fase:', {
          total: evaluationsArray.length,
          porFase: evaluationsArray.reduce((acc, evaluation) => {
            const phase = evaluation.phase || 'sin fase';
            acc[phase] = (acc[phase] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sinFase: evaluationsArray.filter(e => !e.phase || e.phase === 'Sin fase').map(e => ({
            examTitle: e.examTitle,
            phase: e.phase,
            examId: e.examId
          }))
        });

        setEvaluations(evaluationsArray);
      } catch (error) {
        console.error("Error al obtener las evaluaciones:", error);
        setEvaluations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluations();
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-100 text-green-800";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  // Función para determinar si fue intento de fraude
  const isFraudAttempt = (evaluation: ExamResult) => {
    return evaluation.lockedByTabChange && evaluation.tabChangeCount > 0;
  };

  // Función para obtener el badge de estado de seguridad
  const getSecurityBadge = (evaluation: ExamResult) => {
    if (evaluation.tabChangeCount > 0) {
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-200">
          Intento de fraude
        </Badge>
      );
    }
    return null;
  };

  const showExamDetails = (exam: ExamResult) => {
    setSelectedExam(exam);
    setShowDetails(true);
  };

  const hideExamDetails = () => {
    setSelectedExam(null);
    setShowDetails(false);
  };

  // Función para visualizar una pregunta completa
  const handleViewQuestion = async (questionDetail: {
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
  }) => {
    setLoadingQuestion(true);
    setSelectedQuestionDetail(questionDetail);
    setShowQuestionView(true);

    try {
      // Intentar obtener la pregunta completa desde Firebase
      const result = await questionService.getQuestionByIdOrCode(String(questionDetail.questionId));
      if (result.success) {
        setSelectedQuestion(result.data);
      } else {
        console.error('Error al obtener la pregunta:', result.error);
        // Si no se puede obtener, usar solo los datos que tenemos
        setSelectedQuestion(null);
      }
    } catch (error) {
      console.error('Error al cargar la pregunta:', error);
      setSelectedQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const hideQuestionView = () => {
    setShowQuestionView(false);
    setSelectedQuestion(null);
    setSelectedQuestionDetail(null);
  };

  // Función para agrupar evaluaciones por fase
  const groupEvaluationsByPhase = (evaluations: ExamResult[]) => {
    const grouped: Record<string, ExamResult[]> = {
      'fase I': [],
      'Fase II': [],
      'fase III': [],
      'Sin fase': []
    };

    evaluations.forEach(evaluation => {
      // Determinar la fase del examen
      let phaseKey = 'Sin fase';
      
      if (evaluation.phase) {
        // Normalizar el valor de phase (puede venir como string o como tipo PhaseType)
        const phaseValue = String(evaluation.phase).toLowerCase().trim();
        
        // Intentar mapear usando getPhaseType primero
        const phaseType = getPhaseType(evaluation.phase);
        if (phaseType === 'first') {
          phaseKey = 'fase I';
        } else if (phaseType === 'second') {
          phaseKey = 'Fase II';
        } else if (phaseType === 'third') {
          phaseKey = 'fase III';
        } else {
          // Si getPhaseType no funcionó, verificar directamente los nombres de fase
          if (phaseValue === 'first' || phaseValue === 'fase i' || evaluation.phase === 'fase I' || evaluation.phase === 'Fase I') {
            phaseKey = 'fase I';
          } else if (phaseValue === 'second' || phaseValue === 'fase ii' || evaluation.phase === 'Fase II' || evaluation.phase === 'fase II') {
            phaseKey = 'Fase II';
          } else if (phaseValue === 'third' || phaseValue === 'fase iii' || evaluation.phase === 'fase III' || evaluation.phase === 'Fase III') {
            phaseKey = 'fase III';
          }
        }
      }

      grouped[phaseKey].push(evaluation);
    });

    return grouped;
  };

  // Función para toggle de expandir/colapsar fase
  const togglePhase = (phaseKey: string) => {
    setExpandedPhases(prev => ({
      ...prev,
      [phaseKey]: !prev[phaseKey]
    }));
  };

  // Función para obtener el nombre de la fase en español
  const getPhaseDisplayName = (phaseKey: string) => {
    const phaseNames: Record<string, string> = {
      'fase I': 'Primera Fase',
      'Fase II': 'Segunda Fase',
      'fase III': 'Tercera Fase',
      'Sin fase': 'Sin Fase Específica'
    };
    return phaseNames[phaseKey] || phaseKey;
  };

  // Función para ordenar las fases por la fecha del examen más reciente
  const getPhaseOrderByLatestExam = (groupedEvaluations: Record<string, ExamResult[]>) => {
    const allPhases = ['fase I', 'Fase II', 'fase III', 'Sin fase'];
    
    // Calcular la fecha del examen más reciente de cada fase
    const phaseDates: Record<string, number> = {};
    allPhases.forEach(phaseKey => {
      const phaseExams = groupedEvaluations[phaseKey] || [];
      if (phaseExams.length > 0) {
        // Obtener el timestamp más reciente de esta fase
        const latestTimestamp = Math.max(...phaseExams.map(exam => exam.timestamp || 0));
        phaseDates[phaseKey] = latestTimestamp;
      } else {
        // Si no hay exámenes, usar 0 para que aparezcan al final
        phaseDates[phaseKey] = 0;
      }
    });
    
    // Ordenar las fases por fecha descendente (más reciente primero)
    // Si tienen la misma fecha o no tienen exámenes, mantener el orden original
    return allPhases.sort((a, b) => {
      const dateA = phaseDates[a] || 0;
      const dateB = phaseDates[b] || 0;
      
      // Si ambas tienen exámenes, ordenar por fecha (más reciente primero)
      if (dateA > 0 && dateB > 0) {
        return dateB - dateA;
      }
      
      // Si solo una tiene exámenes, esa va primero
      if (dateA > 0 && dateB === 0) return -1;
      if (dateA === 0 && dateB > 0) return 1;
      
      // Si ninguna tiene exámenes, mantener el orden original
      return 0;
    });
  };

  // Modal de detalles del examen
  const ExamDetailsModal = () => {
    if (!selectedExam || !showDetails) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={cn("rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto", theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-white')}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Detalles del Examen: {selectedExam.examTitle}
              </h2>
              <Button variant="outline" onClick={hideExamDetails} className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}>
                Cerrar
              </Button>
            </div>

            {/* Mensaje de intento de fraude */}
            {isFraudAttempt(selectedExam) && (
              <Card className={cn("mb-6", theme === 'dark' ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50')}>
                <CardContent className="pt-6">
                  <div className={cn("flex items-center gap-3", theme === 'dark' ? 'text-red-300' : 'text-red-800')}>
                    <Shield className="h-6 w-6" />
                    <div>
                      <h3 className="font-semibold">Intento de fraude detectado</h3>
                      <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-red-200' : '')}>
                        El examen fue cerrado automáticamente debido a cambios repetidos de pestaña o ventana. 
                        Esto se considera una violación de las reglas del examen.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detalles por pregunta */}
            <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : '')}>
              <CardHeader>
                <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                  <BookOpen className="h-5 w-5" />
                  Desglose por Pregunta
                </CardTitle>
                <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
                  Revisa tu desempeño pregunta por pregunta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[calc(90vh-300px)] overflow-y-auto">
                  {selectedExam.questionDetails.map((question, index) => (
                    <div key={question.questionId} className={cn("border rounded-lg p-4", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' : 'border-gray-200 hover:bg-gray-50')}>
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${!question.answered ? 'bg-gray-200 text-gray-600' :
                            question.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Pregunta {index + 1}</span>
                              {question.answered ? (
                                question.isCorrect ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )
                              ) : (
                                <AlertCircle className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewQuestion(question)}
                              className={cn("flex items-center gap-2", theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
                            >
                              <Eye className="h-4 w-4" />
                              Ver pregunta
                            </Button>
                          </div>
                          <p className={cn("text-sm mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{stripHtml(question.questionText)}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tu respuesta: </span>
                              <span className={cn("font-medium", !question.answered ? (theme === 'dark' ? 'text-gray-500' : 'text-gray-400') :
                                  question.isCorrect ? 'text-green-600' : 'text-red-600'
                                )}>
                                {question.userAnswer ? question.userAnswer.toUpperCase() : 'Sin responder'}
                              </span>
                            </div>
                            <div>
                              <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuesta correcta: </span>
                              <span className="font-medium text-green-600">
                                {question.correctAnswer.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tema: </span>
                              <span className={cn("font-medium", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                                {question.topic.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      {/* Header */}
      <header className={cn("shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-b border-zinc-700' : 'bg-white')}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={institutionLogo} 
              width="80" 
              height="80" 
              alt={`Logo de ${institutionName}`} 
              className="mr-2"
              onError={(e) => {
                e.currentTarget.src = '/assets/agustina.png'
              }}
            />
            <span className={cn("font-bold text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" theme={theme} />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" active theme={theme} />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Desempeño" theme={theme} />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Mis Resultados</h1>
          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Revisa tu desempeño en las evaluaciones presentadas</p>
        </div>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
              <User className="h-5 w-5" />
              Historial de Evaluaciones
            </CardTitle>
            <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
              {evaluations.length > 0
                ? `Has presentado ${evaluations.length} evaluación${evaluations.length > 1 ? 'es' : ''}`
                : "Aún no has presentado ninguna evaluación"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className={cn("animate-spin rounded-full h-8 w-8 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
                <span className={cn("ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cargando resultados...</span>
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <p className={cn("text-lg mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No has presentado ningún examen aún</p>
                <p className={cn("mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Cuando presentes una evaluación, aparecerá aquí</p>
                <Link to="/dashboard#evaluacion">
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
                    Ir a las Evaluaciones
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const groupedEvaluations = groupEvaluationsByPhase(evaluations);
                  // Ordenar las fases por la fecha del examen más reciente
                  const phaseOrder = getPhaseOrderByLatestExam(groupedEvaluations);
                  
                  return phaseOrder.map((phaseKey) => {
                    const phaseEvaluations = groupedEvaluations[phaseKey];
                    // Ocultar si está vacía
                    if (phaseEvaluations.length === 0) return null;

                    const isExpanded = expandedPhases[phaseKey] ?? true;

                    return (
                      <div key={phaseKey} className={cn("border rounded-lg overflow-hidden", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-white')}>
                        {/* Header de la fase */}
                        <button
                          onClick={() => togglePhase(phaseKey)}
                          className={cn(
                            "w-full p-4 flex items-center justify-between transition-colors",
                            theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronUp className={cn("h-5 w-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                            ) : (
                              <ChevronDown className={cn("h-5 w-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                            )}
                            <h2 className={cn("text-xl font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {getPhaseDisplayName(phaseKey)}
                            </h2>
                            <Badge variant="outline" className={cn(
                              phaseKey === 'fase I' ? (theme === 'dark' ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700') :
                              phaseKey === 'Fase II' ? (theme === 'dark' ? 'bg-purple-900/30 border-purple-700 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700') :
                              phaseKey === 'fase III' ? (theme === 'dark' ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700') :
                              (theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')
                            )}>
                              {phaseEvaluations.length} {phaseEvaluations.length === 1 ? 'examen' : 'exámenes'}
                            </Badge>
                          </div>
                          <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {isExpanded ? 'Ocultar' : 'Mostrar'}
                          </span>
                        </button>

                        {/* Contenido de la fase (colapsable) */}
                        {isExpanded && (
                          <div className={cn("border-t", theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                            <div className="p-4 space-y-4">
                              {phaseEvaluations.map((evaluation) => (
                                <div key={evaluation.examId} className={cn("border rounded-lg p-6 transition-shadow", theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' : 'border-gray-200 hover:shadow-md')}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                          {evaluation.examTitle}
                                        </h3>
                                        <Badge className={getScoreBadgeColor(evaluation.score.overallPercentage)}>
                                          {evaluation.score.overallPercentage}%
                                        </Badge>
                                        {getSecurityBadge(evaluation)}
                                      </div>
                                      <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4" />
                                          <span>Fecha: {formatDate(evaluation.timestamp)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <BookOpen className="h-4 w-4" />
                                          <span>
                                            {evaluation.score.correctAnswers}/{evaluation.score.totalQuestions} correctas
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4" />
                                          <span>Tiempo: {formatDuration(evaluation.timeSpent)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className={`text-3xl font-bold ${getScoreColor(evaluation.score.overallPercentage)}`}>
                                          {evaluation.score.overallPercentage}%
                                        </div>
                                        <Progress
                                          value={evaluation.score.overallPercentage}
                                          className="w-24 mt-1"
                                        />
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => showExamDetails(evaluation)}
                                        className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
                                      >
                                        Ver Detalles
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de detalles */}
      <ExamDetailsModal />

      {/* Modal para visualizar pregunta completa */}
      <Dialog open={showQuestionView} onOpenChange={setShowQuestionView}>
        <DialogContent className={cn("max-w-[95vw] max-h-[95vh] overflow-hidden p-0", theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-gray-50')}>
          {loadingQuestion ? (
            <div className="flex items-center justify-center p-8">
              <div className={cn("animate-spin rounded-full h-8 w-8 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
              <span className={cn("ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cargando pregunta...</span>
            </div>
          ) : selectedQuestion && selectedQuestionDetail ? (
            <div className={cn("flex flex-col h-full", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
              {/* Botón de cerrar fijo */}
              <Button
                variant="ghost"
                size="sm"
                onClick={hideQuestionView}
                className={cn("absolute top-2 right-2 z-50 shadow-lg", theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-gray-100')}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Layout completo como en el examen con scroll */}
              <ScrollArea className="h-[calc(95vh-2rem)]">
                <div className="flex flex-col lg:flex-row gap-6 p-4">
                  {/* Contenido principal del examen */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className={cn("border rounded-lg p-4 mb-6 shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                      <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Vista de Pregunta - Resultado del Examen</h3>
                          <h2 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : '')}>{selectedExam?.examTitle || 'Examen'}</h2>
                          <div className="flex items-center gap-2 text-sm mt-1">
                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                              {selectedQuestion.subject}
                            </span>
                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')}>
                              {selectedQuestion.topic}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card principal de la pregunta */}
                    <Card className={cn("mb-6", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : '')}>Pregunta</CardTitle>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={cn("px-2 py-1 rounded-full", theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                              {selectedQuestion.topic}
                            </span>
                            <span className={cn(
                              "px-2 py-1 rounded-full",
                              selectedQuestion.level === 'Fácil' ? (theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700') :
                                selectedQuestion.level === 'Medio' ? (theme === 'dark' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700') :
                                  (theme === 'dark' ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700')
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
                            <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                              <div
                                className={cn("leading-relaxed prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                dangerouslySetInnerHTML={{ __html: sanitizeMathHtml(renderMathInHtml(selectedQuestion.informativeText)) }}
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
                              className={cn("leading-relaxed text-lg font-medium prose max-w-none", theme === 'dark' ? 'text-white' : 'text-gray-900')}
                              dangerouslySetInnerHTML={{ __html: sanitizeMathHtml(renderMathInHtml(selectedQuestion.questionText)) }}
                            />
                          )}
                        </div>
                        
                        {/* RadioGroup de opciones con marcado de respuestas */}
                        <div className="space-y-4 mt-6">
                          {selectedQuestion.options.map((option) => {
                            const isUserAnswer = selectedQuestionDetail.userAnswer === option.id;
                            const isCorrectAnswer = option.isCorrect;
                            const isUserCorrect = isUserAnswer && isCorrectAnswer;
                            const isUserIncorrect = isUserAnswer && !isCorrectAnswer;
                            const showCorrect = !selectedQuestionDetail.answered || isCorrectAnswer;

                            return (
                              <div
                                key={option.id}
                                className={cn(
                                  "flex items-start space-x-3 border-2 rounded-lg p-3 transition-colors",
                                  isUserCorrect ? (theme === 'dark' ? "border-green-500 bg-green-900/30" : "border-green-500 bg-green-50") :
                                    isUserIncorrect ? (theme === 'dark' ? "border-red-500 bg-red-900/30" : "border-red-500 bg-red-50") :
                                      isCorrectAnswer && showCorrect ? (theme === 'dark' ? "border-green-400 bg-green-900/20" : "border-green-300 bg-green-50") :
                                        (theme === 'dark' ? "border-zinc-700 hover:bg-zinc-700" : "border-gray-200 hover:bg-gray-50")
                                )}
                              >
                                <div className="flex items-center gap-2 mt-1">
                                  <div className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                                    isUserAnswer ? (theme === 'dark' ? "border-purple-500 bg-purple-900/50" : "border-purple-600 bg-purple-100") :
                                      isCorrectAnswer && showCorrect ? (theme === 'dark' ? "border-green-500 bg-green-900/50" : "border-green-600 bg-green-100") :
                                        (theme === 'dark' ? "border-zinc-600 bg-zinc-700" : "border-gray-300 bg-white")
                                  )}>
                                    {isUserAnswer && (
                                      <div className={cn("h-3 w-3 rounded-full", theme === 'dark' ? 'bg-purple-400' : 'bg-purple-600')}></div>
                                    )}
                                    {!isUserAnswer && isCorrectAnswer && showCorrect && (
                                      <div className={cn("h-3 w-3 rounded-full", theme === 'dark' ? 'bg-green-400' : 'bg-green-600')}></div>
                                    )}
                                  </div>
                                  <span className={cn("font-semibold", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{option.id}.</span>
                                </div>
                                <Label className="flex-1 cursor-pointer">
                                  <div className="flex-1">
                                    {option.text && (
                                      <div
                                        className={cn("prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}
                                        dangerouslySetInnerHTML={{ __html: sanitizeMathHtml(renderMathInHtml(option.text || '')) }}
                                      />
                                    )}
                                    {option.imageUrl && (
                                      <div className="mt-2">
                                        <img 
                                          src={option.imageUrl} 
                                          alt={`Opción ${option.id}`}
                                          className="max-w-xs h-auto rounded-lg border shadow-sm"
                                          onError={(e) => {
                                            console.error('Error cargando imagen de opción:', option.imageUrl);
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </Label>
                                <div className="flex flex-col gap-1">
                                  {isUserAnswer && (
                                    <Badge className={isUserCorrect ? "bg-green-500" : "bg-red-500"}>
                                      {isUserCorrect ? "✓ Correcta" : "✗ Tu respuesta"}
                                    </Badge>
                                  )}
                                  {isCorrectAnswer && showCorrect && !isUserAnswer && (
                                    <Badge className="bg-green-500">✓ Correcta</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                      <CardContent className="pt-0">
                        <div className={cn("mt-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-gray-50')}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tu respuesta: </span>
                              <span className={cn(
                                "font-medium",
                                !selectedQuestionDetail.answered ? (theme === 'dark' ? 'text-gray-500' : 'text-gray-400') :
                                  selectedQuestionDetail.isCorrect ? 'text-green-600' : 'text-red-600'
                              )}>
                                {selectedQuestionDetail.userAnswer ? selectedQuestionDetail.userAnswer.toUpperCase() : 'Sin responder'}
                              </span>
                            </div>
                            <div>
                              <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuesta correcta: </span>
                              <span className="font-medium text-green-600">
                                {selectedQuestionDetail.correctAnswer.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      {/* Justificación de la respuesta (legacy) */}
                      {selectedQuestion.justification && (
                        <CardContent className="pt-0">
                          <div className={cn("mt-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                            <h4 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                              <BookOpen className="h-4 w-4" />
                              Justificación
                            </h4>
                            <div
                              className={cn("prose prose-sm max-w-none whitespace-pre-wrap", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                              dangerouslySetInnerHTML={{ __html: sanitizeMathHtml(renderMathInHtml(selectedQuestion.justification)) }}
                            />
                          </div>
                        </CardContent>
                      )}

                      {/* Justificación generada por IA */}
                      {selectedQuestion.aiJustification && (
                        <CardContent className="pt-0">
                          <div className={cn("mt-4 pt-4 border-t", theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
                            <div className={cn("flex items-center gap-2 mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              <HelpCircle className={cn("h-5 w-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                              <h4 className={cn("font-semibold text-lg", theme === 'dark' ? 'text-white' : '')}>
                                Explicación detallada
                              </h4>
                            </div>

                            <div className={cn("space-y-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50/50 border-purple-200')}>
                              {/* Explicación de la respuesta correcta */}
                              <div>
                                <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ¿Por qué la respuesta correcta es {selectedQuestionDetail.correctAnswer.toUpperCase()}?
                                </h5>
                                <MathText 
                                  text={selectedQuestion.aiJustification.correctAnswerExplanation}
                                  className={cn("text-sm leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                />
                              </div>

                              {/* Explicación de la respuesta del estudiante si fue incorrecta */}
                              {!selectedQuestionDetail.isCorrect && selectedQuestionDetail.userAnswer && (
                                <div>
                                  <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                    ¿Por qué tu respuesta {selectedQuestionDetail.userAnswer.toUpperCase()} no es correcta?
                                  </h5>
                                  {(() => {
                                    const userAnswerExplanation = selectedQuestion.aiJustification.incorrectAnswersExplanation?.find(
                                      exp => exp.optionId === selectedQuestionDetail.userAnswer
                                    )
                                    if (userAnswerExplanation) {
                                      return (
                                        <MathText 
                                          text={userAnswerExplanation.explanation}
                                          className={cn("text-sm leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                                        />
                                      )
                                    }
                                    return (
                                      <p className={cn("text-sm leading-relaxed italic", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                        No hay explicación específica disponible para esta opción.
                                      </p>
                                    )
                                  })()}
                                </div>
                              )}

                              {/* Explicaciones de todas las respuestas incorrectas (si el estudiante respondió correctamente) */}
                              {selectedQuestionDetail.isCorrect && selectedQuestion.aiJustification.incorrectAnswersExplanation && selectedQuestion.aiJustification.incorrectAnswersExplanation.length > 0 && (
                                <div>
                                  <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                    ¿Por qué las otras opciones no son correctas?
                                  </h5>
                                  <div className="space-y-3">
                                    {selectedQuestion.aiJustification.incorrectAnswersExplanation.map((explanation, idx) => (
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
                              {selectedQuestion.aiJustification.keyConcepts && selectedQuestion.aiJustification.keyConcepts.length > 0 && (
                                <div>
                                  <h5 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                                    <BookOpen className="h-4 w-4 text-blue-500" />
                                    Conceptos clave para recordar
                                  </h5>
                                  <ul className={cn("list-disc list-inside space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                    {selectedQuestion.aiJustification.keyConcepts.map((concept, idx) => (
                                      <li key={idx} className="text-sm">{concept}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : selectedQuestionDetail ? (
            <div className="p-8">
              <div className="text-center">
                <AlertCircle className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>No se pudo cargar la pregunta completa.</p>
                <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Mostrando información básica:</p>
                <div className={cn("mt-4 p-4 rounded-lg text-left", theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50')}>
                  <p className={cn("text-sm mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{selectedQuestionDetail.questionText}</p>
                  <div className="text-sm">
                    <div>
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tu respuesta: </span>
                      <span className={cn(
                        "font-medium",
                        !selectedQuestionDetail.answered ? (theme === 'dark' ? 'text-gray-500' : 'text-gray-400') :
                          selectedQuestionDetail.isCorrect ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedQuestionDetail.userAnswer ? selectedQuestionDetail.userAnswer.toUpperCase() : 'Sin responder'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuesta correcta: </span>
                      <span className="font-medium text-green-600">
                        {selectedQuestionDetail.correctAnswer.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente auxiliar para navegación
interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
  theme?: 'light' | 'dark';
}

function NavItem({ href, icon, text, active = false, theme = 'light' }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center",
        active 
          ? theme === 'dark' ? "text-red-400 font-medium" : "text-red-600 font-medium"
          : theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}