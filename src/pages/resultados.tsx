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
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Detalles del Examen: {selectedExam.examTitle}
              </h2>
              <Button variant="outline" onClick={hideExamDetails}>
                Cerrar
              </Button>
            </div>

            {/* Información general */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Puntuación General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(selectedExam.score.overallPercentage)}`}>
                      {selectedExam.score.overallPercentage}%
                    </div>
                    <div className="text-gray-600 mt-2">
                      {selectedExam.score.correctAnswers} de {selectedExam.score.totalQuestions} correctas
                    </div>
                    <Progress
                      value={selectedExam.score.overallPercentage}
                      className="mt-4"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Información del Examen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha:</span>
                    <span className="font-medium">{formatDate(selectedExam.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tiempo empleado:</span>
                    <span className="font-medium">{formatDuration(selectedExam.timeSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preguntas respondidas:</span>
                    <span className="font-medium">{selectedExam.score.totalAnswered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge className={selectedExam.completed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {selectedExam.completed ? "Completado" : "Incompleto"}
                    </Badge>
                  </div>
                  {isFraudAttempt(selectedExam) ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Seguridad:</span>
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        <Shield className="h-3 w-3 mr-1" />
                        Intento de fraude detectado
                      </Badge>
                    </div>
                  ) : selectedExam.tabChangeCount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Advertencias:</span>
                      <span className="font-medium text-orange-600">{selectedExam.tabChangeCount}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Mensaje de intento de fraude */}
            {isFraudAttempt(selectedExam) && (
              <Card className="mb-6 border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-red-800">
                    <Shield className="h-6 w-6" />
                    <div>
                      <h3 className="font-semibold">Intento de fraude detectado</h3>
                      <p className="text-sm mt-1">
                        El examen fue cerrado automáticamente debido a cambios repetidos de pestaña o ventana. 
                        Esto se considera una violación de las reglas del examen.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detalles por pregunta */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Desglose por Pregunta
                </CardTitle>
                <CardDescription>
                  Revisa tu desempeño pregunta por pregunta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  {selectedExam.questionDetails.map((question, index) => (
                    <div key={question.questionId} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${!question.answered ? 'bg-gray-200 text-gray-600' :
                            question.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Pregunta {index + 1}</span>
                              {question.answered ? (
                                question.isCorrect ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )
                              ) : (
                                <AlertCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewQuestion(question)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver pregunta
                            </Button>
                          </div>
                          <p className="text-sm text-gray-700 mb-3">{question.questionText}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Tu respuesta: </span>
                              <span className={`font-medium ${!question.answered ? 'text-gray-400' :
                                  question.isCorrect ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {question.userAnswer ? question.userAnswer.toUpperCase() : 'Sin responder'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Respuesta correcta: </span>
                              <span className="font-medium text-green-600">
                                {question.correctAnswer.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Tema: </span>
                              <span className="font-medium text-blue-600">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
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
            <span className="text-red-600 font-bold text-2xl">
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" active />
            <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Resultados</h1>
          <p className="text-gray-600">Revisa tu desempeño en las evaluaciones presentadas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Historial de Evaluaciones
            </CardTitle>
            <CardDescription>
              {evaluations.length > 0
                ? `Has presentado ${evaluations.length} evaluación${evaluations.length > 1 ? 'es' : ''}`
                : "Aún no has presentado ninguna evaluación"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-gray-600">Cargando resultados...</span>
              </div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No has presentado ningún examen aún</p>
                <p className="text-gray-400 mb-4">Cuando presentes una evaluación, aparecerá aquí</p>
                <Link to="/dashboard#evaluacion">
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
                    Ir a las Evaluaciones
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {evaluations.map((evaluation) => (
                  <div key={evaluation.examId} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {evaluation.examTitle}
                          </h3>
                          <Badge className={getScoreBadgeColor(evaluation.score.overallPercentage)}>
                            {evaluation.score.overallPercentage}%
                          </Badge>
                          {getSecurityBadge(evaluation)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
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
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0 bg-gray-50">
          {loadingQuestion ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-2 text-gray-600">Cargando pregunta...</span>
            </div>
          ) : selectedQuestion && selectedQuestionDetail ? (
            <div className="flex flex-col h-full bg-gray-50">
              {/* Botón de cerrar fijo */}
              <Button
                variant="ghost"
                size="sm"
                onClick={hideQuestionView}
                className="absolute top-2 right-2 z-50 bg-white shadow-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Layout completo como en el examen con scroll */}
              <ScrollArea className="h-[calc(95vh-2rem)]">
                <div className="flex flex-col lg:flex-row gap-6 p-4">
                  {/* Contenido principal del examen */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm text-gray-500 font-medium">Vista de Pregunta - Resultado del Examen</h3>
                          <h2 className="text-lg font-bold">{selectedExam?.examTitle || 'Examen'}</h2>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                              {selectedQuestion.subject}
                            </span>
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                              {selectedQuestion.topic}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card principal de la pregunta */}
                    <Card className="mb-6">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl">Pregunta</CardTitle>
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
                              className="text-gray-900 leading-relaxed text-lg font-medium prose max-w-none"
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
                                  isUserCorrect ? "border-green-500 bg-green-50" :
                                    isUserIncorrect ? "border-red-500 bg-red-50" :
                                      isCorrectAnswer && showCorrect ? "border-green-300 bg-green-50" :
                                        "border-gray-200 hover:bg-gray-50"
                                )}
                              >
                                <div className="flex items-center gap-2 mt-1">
                                  <div className={cn(
                                    "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                                    isUserAnswer ? "border-purple-600 bg-purple-100" :
                                      isCorrectAnswer && showCorrect ? "border-green-600 bg-green-100" :
                                        "border-gray-300 bg-white"
                                  )}>
                                    {isUserAnswer && (
                                      <div className="h-3 w-3 rounded-full bg-purple-600"></div>
                                    )}
                                    {!isUserAnswer && isCorrectAnswer && showCorrect && (
                                      <div className="h-3 w-3 rounded-full bg-green-600"></div>
                                    )}
                                  </div>
                                  <span className="font-semibold text-purple-600">{option.id}.</span>
                                </div>
                                <Label className="flex-1 cursor-pointer">
                                  <div className="flex-1">
                                    {option.text && (
                                      <div
                                        className="text-gray-900 prose max-w-none"
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
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Tu respuesta: </span>
                              <span className={cn(
                                "font-medium",
                                !selectedQuestionDetail.answered ? 'text-gray-400' :
                                  selectedQuestionDetail.isCorrect ? 'text-green-600' : 'text-red-600'
                              )}>
                                {selectedQuestionDetail.userAnswer ? selectedQuestionDetail.userAnswer.toUpperCase() : 'Sin responder'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Respuesta correcta: </span>
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
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No se pudo cargar la pregunta completa.</p>
                <p className="text-sm text-gray-500 mt-2">Mostrando información básica:</p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                  <p className="text-sm text-gray-700 mb-2">{selectedQuestionDetail.questionText}</p>
                  <div className="text-sm">
                    <div>
                      <span className="text-gray-500">Tu respuesta: </span>
                      <span className={cn(
                        "font-medium",
                        !selectedQuestionDetail.answered ? 'text-gray-400' :
                          selectedQuestionDetail.isCorrect ? 'text-green-600' : 'text-red-600'
                      )}>
                        {selectedQuestionDetail.userAnswer ? selectedQuestionDetail.userAnswer.toUpperCase() : 'Sin responder'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-gray-500">Respuesta correcta: </span>
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
}

function NavItem({ href, icon, text, active = false }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`flex items-center ${active ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}