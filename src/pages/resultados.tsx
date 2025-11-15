import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Home, ContactRound, NotepadText, BarChart2, Apple, CheckCircle2, AlertCircle, Clock, BookOpen, TrendingUp, User, Shield, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { doc, getDoc, getFirestore } from "firebase/firestore";
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

const db = getFirestore(firebaseApp);

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
        // Obtenemos los resultados del documento "results" usando el userId
        const docRef = doc(db, "results", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserResults;

          // Convertimos el objeto a array de evaluaciones
          const evaluationsArray = Object.entries(data).map(([examId, examData]) => ({
            ...examData,
            examId, // Asegurar que el examId esté presente
          }));

          // Ordenamos por fecha (más reciente primero)
          evaluationsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

          setEvaluations(evaluationsArray);
        } else {
          setEvaluations([]);
        }
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

            {/* Información general */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                    <TrendingUp className="h-5 w-5" />
                    Puntuación General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(selectedExam.score.overallPercentage)}`}>
                      {selectedExam.score.overallPercentage}%
                    </div>
                    <div className={cn("mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {selectedExam.score.correctAnswers} de {selectedExam.score.totalQuestions} correctas
                    </div>
                    <Progress
                      value={selectedExam.score.overallPercentage}
                      className="mt-4"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                    <Clock className="h-5 w-5" />
                    Información del Examen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Fecha:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{formatDate(selectedExam.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo empleado:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{formatDuration(selectedExam.timeSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Preguntas respondidas:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{selectedExam.score.totalAnswered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Estado:</span>
                    <Badge className={selectedExam.completed ? (theme === 'dark' ? "bg-green-800 text-green-200" : "bg-green-100 text-green-800") : (theme === 'dark' ? "bg-yellow-800 text-yellow-200" : "bg-yellow-100 text-yellow-800")}>
                      {selectedExam.completed ? "Completado" : "Incompleto"}
                    </Badge>
                  </div>
                  {isFraudAttempt(selectedExam) ? (
                    <div className="flex justify-between">
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Seguridad:</span>
                      <Badge className={theme === 'dark' ? "bg-red-800 text-red-200 border-red-700" : "bg-red-100 text-red-800 border-red-200"}>
                        <Shield className="h-3 w-3 mr-1" />
                        Intento de fraude detectado
                      </Badge>
                    </div>
                  ) : selectedExam.tabChangeCount > 0 ? (
                    <div className="flex justify-between">
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Advertencias:</span>
                      <span className={cn("font-medium", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>{selectedExam.tabChangeCount}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
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
                <div className="space-y-4 max-h-60 overflow-y-auto">
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
                          <p className={cn("text-sm mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{question.questionText}</p>
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
            <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" theme={theme} />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
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
              <div className="space-y-4">
                {evaluations.map((evaluation) => (
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