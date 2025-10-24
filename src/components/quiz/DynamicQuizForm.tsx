import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, Calculator, Timer, HelpCircle, Users, Play, Maximize, X, Database, Image as ImageIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate } from "react-router-dom"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { useAuthContext } from "@/context/AuthContext";
import { quizGeneratorService, GeneratedQuiz } from "@/services/quiz/quizGenerator.service";
import { Question } from "@/services/firebase/question.service";
import ImageGallery from "@/components/common/ImageGallery";

const db = getFirestore(firebaseApp);

// Tipo para el seguimiento de tiempo por pregunta
interface QuestionTimeData {
  questionId: string;
  timeSpent: number; // en segundos
  startTime: number; // timestamp
  endTime?: number; // timestamp
}

// Función para aleatorizar array (algoritmo Fisher-Yates)
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Verifica si el usuario ya presentó el examen
const checkExamStatus = async (userId: string, examId: string) => {
  const docRef = doc(db, "results", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data[examId] || null;
  }
  return null;
};

// Guarda los resultados del examen
const saveExamResults = async (userId: string, examId: string, examData: any) => {
  const docRef = doc(db, "results", userId);
  await setDoc(
    docRef,
    {
      [examId]: {
        ...examData,
        timestamp: Date.now(),
      },
    },
    { merge: true }
  );
  return { success: true, id: `${userId}_${examId}` };
};

interface DynamicQuizFormProps {
  subject: string;
  phase: 'first' | 'second' | 'third';
  grade?: string;
}

const DynamicQuizForm = ({ subject, phase, grade }: DynamicQuizFormProps) => {
  const navigate = useNavigate()
  const { user } = useAuthContext();
  const userId = user?.uid;

  // Estados principales
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingExamData, setExistingExamData] = useState<any | null>(null);

  // Estados para el seguimiento de tiempo por pregunta
  const [questionTimeData, setQuestionTimeData] = useState<{ [key: string]: QuestionTimeData }>({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(0);

  // Cargar cuestionario al montar el componente
  useEffect(() => {
    const loadQuiz = async () => {
      if (!userId) return;

      try {
        setExamState('loading');
        
        // Generar el cuestionario dinámicamente
        const quizResult = await quizGeneratorService.generateQuiz(subject, phase, grade);
        
        if (!quizResult.success) {
          console.error('Error generando cuestionario:', quizResult.error);
          setExamState('error');
          return;
        }

        const quiz = quizResult.data;
        setQuizData(quiz);
        setTimeLeft(quiz.timeLimit * 60);

        // Verificar si ya se presentó este examen
        const existingExam = await checkExamStatus(userId, quiz.id);
        if (existingExam) {
          setExistingExamData(existingExam);
          setExamState('already_taken');
        } else {
          setExamState('welcome');
        }

      } catch (error) {
        console.error('Error cargando cuestionario:', error);
        setExamState('error');
      }
    };

    loadQuiz();
  }, [userId, subject, phase, grade]);

  // Función para inicializar el seguimiento de tiempo de una pregunta
  const initializeQuestionTime = (questionId: string) => {
    const now = Date.now();
    setQuestionTimeData(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        timeSpent: 0,
        startTime: now,
      }
    }));
    setCurrentQuestionStartTime(now);
  };

  // Función para finalizar el seguimiento de tiempo de una pregunta
  const finalizeQuestionTime = (questionId: string) => {
    if (currentQuestionStartTime > 0) {
      const now = Date.now();
      const timeSpentInThisVisit = Math.floor((now - currentQuestionStartTime) / 1000);

      setQuestionTimeData(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          timeSpent: (prev[questionId]?.timeSpent || 0) + timeSpentInThisVisit,
          endTime: now
        }
      }));
    }
  };

  // Función para cambiar de pregunta con seguimiento de tiempo
  const changeQuestion = (newQuestionIndex: number) => {
    if (!quizData) return;

    // Finalizar tiempo de la pregunta actual
    const currentQuestionId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code;
    finalizeQuestionTime(currentQuestionId);

    // Cambiar a la nueva pregunta
    setCurrentQuestion(newQuestionIndex);

    // Inicializar tiempo de la nueva pregunta
    const newQuestionId = quizData.questions[newQuestionIndex].id || quizData.questions[newQuestionIndex].code;
    initializeQuestionTime(newQuestionId);
  };

  // Función para formatear tiempo en minutos y segundos
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Inicializar seguimiento de tiempo cuando el examen comienza
  useEffect(() => {
    if (examState === 'active' && examStartTime === 0 && quizData) {
      const now = Date.now();
      setExamStartTime(now);
      // Inicializar la primera pregunta
      const firstQuestionId = quizData.questions[0].id || quizData.questions[0].code;
      initializeQuestionTime(firstQuestionId);
    }
  }, [examState, quizData]);

  // Función para calcular la puntuación
  const calculateScore = () => {
    if (!quizData) return { correctAnswers: 0, totalAnswered: 0, totalQuestions: 0, percentage: 0, overallPercentage: 0 };

    let correctAnswers = 0
    let totalAnswered = 0

    quizData.questions.forEach(question => {
      const questionId = question.id || question.code;
      if (answers[questionId]) {
        totalAnswered++
        const correctOption = question.options.find(opt => opt.isCorrect);
        if (answers[questionId] === correctOption?.id) {
          correctAnswers++
        }
      }
    })

    return {
      correctAnswers,
      totalAnswered,
      totalQuestions: quizData.questions.length,
      percentage: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      overallPercentage: Math.round((correctAnswers / quizData.questions.length) * 100)
    }
  }

  // Función para guardar resultados en Firebase
  const saveToFirebase = async (timeExpired = false, lockedByTabChange = false) => {
    if (!quizData || !userId) return;

    setIsSubmitting(true)

    // Finalizar el tiempo de la pregunta actual antes de enviar
    const currentQuestionId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code;
    finalizeQuestionTime(currentQuestionId);

    try {
      const score = calculateScore()
      const examEndTime = Date.now();
      const totalExamTime = Math.floor((examEndTime - examStartTime) / 1000);

      const examResult = {
        userId,
        examId: quizData.id,
        examTitle: quizData.title,
        subject: quizData.subject,
        phase: quizData.phase,
        answers,
        score,
        timeExpired,
        lockedByTabChange,
        tabChangeCount,
        startTime: new Date(examStartTime).toISOString(),
        endTime: new Date(examEndTime).toISOString(),
        timeSpent: totalExamTime,
        completed: true,
        // Datos de tiempo por pregunta
        questionTimeTracking: questionTimeData,
        totalExamTimeSeconds: totalExamTime,
        // Detalles por pregunta con tiempo incluido
        questionDetails: quizData.questions.map(question => {
          const questionId = question.id || question.code;
          const correctOption = question.options.find(opt => opt.isCorrect);
          return {
            questionId,
            questionText: question.questionText,
            userAnswer: answers[questionId] || null,
            correctAnswer: correctOption?.id || '',
            topic: question.topic,
            isCorrect: answers[questionId] === correctOption?.id,
            answered: !!answers[questionId],
            timeSpent: questionTimeData[questionId]?.timeSpent || 0,
          }
        })
      }

      const result = await saveExamResults(userId, quizData.id, examResult);
      console.log('Examen guardado exitosamente:', result)
      return result
    } catch (error) {
      console.error('Error guardando examen:', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Función para entrar en pantalla completa
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;

      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).msRequestFullscreen) {
        (el as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error("Error entering fullscreen:", error);
    }
  };

  // Función para salir de pantalla completa
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
    }
  };

  // Detectar cambios de pestaña y pérdida de foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (examState === 'active' && document.hidden) {
        setTabChangeCount(prev => prev + 1);
        setShowTabChangeWarning(true);

        if (tabChangeCount >= 2) {
          setExamLocked(true);
          handleSubmit(true, true);
        }
      }
    };

    const handleWindowBlur = () => {
      if (examState === 'active') {
        setTabChangeCount(prev => prev + 1);
        setShowTabChangeWarning(true);

        if (tabChangeCount >= 2) {
          setExamLocked(true);
          handleSubmit(true, true);
        }
      }
    };

    const handleWindowFocus = () => {
      if (examState === 'active' && showTabChangeWarning && !examLocked) {
        // El aviso se mantiene visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [examState, tabChangeCount, showTabChangeWarning, examLocked]);

  // Detectar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;

      const isCurrentlyFullscreen = !!fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (examState === 'active' && !isCurrentlyFullscreen) {
        setShowFullscreenExit(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [examState]);

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    await enterFullscreen()
    setExamState('active')
  }

  // Manejar salida de pantalla completa durante el examen
  const handleExitFullscreen = async () => {
    setShowFullscreenExit(false)
    await handleSubmit(false, false)
    await exitFullscreen()
  }

  // Volver al examen en pantalla completa
  const returnToExam = async () => {
    setShowFullscreenExit(false)
    await enterFullscreen()
  }

  // Continuar examen después de advertencia de cambio de pestaña
  const continueExam = () => {
    setShowTabChangeWarning(false)
  }

  // Finalizar examen por cambio de pestaña
  const finishExamByTabChange = async () => {
    setShowTabChangeWarning(false)
    setExamLocked(true)
    await handleSubmit(true, true)
  }

  // Pantalla de carga
  const LoadingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Generando cuestionario...</CardTitle>
          <CardDescription>
            Estamos preparando tu evaluación personalizada de {subject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla de error
  const ErrorScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-red-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-800">Error al cargar el cuestionario</CardTitle>
          <CardDescription className="text-lg">
            No se pudo generar el cuestionario de {subject}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Información del Error</AlertTitle>
            <AlertDescription className="text-red-700">
              Puede que no haya suficientes preguntas disponibles en el banco para esta materia y nivel.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
          >
            Volver al Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Pantalla cuando ya se presentó el examen
  const AlreadyTakenScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-amber-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-amber-800">Examen Ya Presentado</CardTitle>
          <CardDescription className="text-lg">
            Ya has completado este examen anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Información del Examen</AlertTitle>
            <AlertDescription className="text-amber-700">
              Solo se permite una presentación por examen. Tu intento anterior ya fue registrado.
            </AlertDescription>
          </Alert>

          {existingExamData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Detalles de tu presentación:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Fecha:</span>
                  <div className="font-medium">
                    {new Date(existingExamData.endTime).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Puntuación:</span>
                  <div className="font-medium text-lg">
                    {existingExamData.score.correctAnswers}/{existingExamData.score.totalQuestions}
                    <span className="text-sm text-gray-500 ml-1">
                      ({existingExamData.score.overallPercentage}%)
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Tiempo usado:</span>
                  <div className="font-medium">
                    {formatTime(existingExamData.timeSpent || existingExamData.totalExamTimeSeconds || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Estado:</span>
                  <div className="font-medium text-green-600">Completado</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          >
            Ir a las demás pruebas
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Componente de Bienvenida
  const WelcomeScreen = () => {
    if (!quizData) return null;

    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-blue-50">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Brain className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-blue-400 rounded-full flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent mb-2">
              ¡Bienvenido al {quizData.title}!
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 max-w-2xl mx-auto">
              {quizData.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Información del examen */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-900">{quizData.timeLimit} minutos</div>
                <div className="text-sm text-gray-500">Tiempo límite</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-900">{quizData.totalQuestions} preguntas</div>
                <div className="text-sm text-gray-500">Total de preguntas</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="font-semibold text-gray-900">Opción múltiple</div>
                <div className="text-sm text-gray-500">Tipo de pregunta</div>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Instrucciones importantes
              </h3>
              <ul className="space-y-3">
                {quizData.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <span className="text-gray-700">{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Advertencias */}
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Control de Pestañas</AlertTitle>
              <AlertDescription className="text-red-700">
                El sistema detectará si cambias de pestaña o pierdes el foco de la ventana. Después de 3 intentos, el examen se finalizará automáticamente.
              </AlertDescription>
            </Alert>
            
            <Alert className="border-purple-200 bg-purple-50">
              <Maximize className="h-4 w-4 text-purple-600" />
              <AlertTitle className="text-purple-800">Modo Pantalla Completa</AlertTitle>
              <AlertDescription className="text-purple-700">
                El examen se realizará en pantalla completa. Si sales de este modo durante la prueba, se mostrará una alerta y podrás elegir entre volver al examen o finalizarlo automáticamente.
              </AlertDescription>
            </Alert>

            <Alert className="border-green-200 bg-green-50">
              <Database className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Una Sola Oportunidad</AlertTitle>
              <AlertDescription className="text-green-700">
                Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
              </AlertDescription>
            </Alert>

            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Seguimiento de Tiempo</AlertTitle>
              <AlertDescription className="text-blue-700">
                El sistema registrará el tiempo que dedicas a cada pregunta individualmente. Esta información se incluirá en tus resultados finales.
              </AlertDescription>
            </Alert>
          </CardContent>

          <CardFooter className="flex justify-center pt-6">
            <Button
              onClick={startExam}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Play className="h-5 w-5 mr-2" />
              Iniciar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Efecto para manejar el temporizador
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (examState === 'active' && timeLeft > 0 && !examLocked) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit(true, false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [examState, timeLeft, examLocked])

  // Función para manejar el envío del examen
  const handleSubmit = async (timeExpired = false, lockedByTabChange = false) => {
    if (examLocked || examState !== 'active') return

    setExamLocked(true)
    setShowWarning(false)
    setShowTabChangeWarning(false)
    setShowFullscreenExit(false)

    try {
      await saveToFirebase(timeExpired, lockedByTabChange)
      setExamState('completed')

      // Salir de pantalla completa después de completar
      if (isFullscreen) {
        await exitFullscreen()
      }
    } catch (error) {
      console.error('Error guardando examen:', error)
    }
  }

  // Función para manejar el cambio de respuesta
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Función para ir a la siguiente pregunta
  const nextQuestion = () => {
    if (quizData && currentQuestion < quizData.questions.length - 1) {
      changeQuestion(currentQuestion + 1)
    }
  }

  // Función para mostrar advertencia de envío
  const showSubmitWarning = () => {
    setShowWarning(true)
  }

  // Función para confirmar envío
  const confirmSubmit = () => {
    setShowWarning(false)
    handleSubmit(false, false)
  }

  // Función para cancelar envío
  const cancelSubmit = () => {
    setShowWarning(false)
  }

  // Función para formatear tiempo restante
  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Pantalla de examen completado
  const CompletedScreen = () => {
    const score = calculateScore()

    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-blue-50">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-green-800 mb-2">
              ¡Examen Completado!
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Tus respuestas han sido guardadas exitosamente
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Resultados principales */}
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
                Resultados del Examen
              </h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {score.correctAnswers}
                  </div>
                  <div className="text-sm text-gray-500">Respuestas correctas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className="text-sm text-gray-500">Preguntas respondidas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {score.overallPercentage}%
                  </div>
                  <div className="text-sm text-gray-500">Puntuación final</div>
                </div>
              </div>
              <Progress
                value={score.overallPercentage}
                className="h-3 mb-2"
              />
              <div className="text-center text-sm text-gray-600">
                Progreso: {score.overallPercentage}% del total
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center pt-6">
            <Button
              onClick={() => navigate('/dashboard')}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-blue-500 hover:from-green-700 hover:to-blue-600 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Volver a las demas pruebas
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Pantalla principal del examen
  const ExamScreen = () => {
    if (!quizData) return null;

    const currentQ = quizData.questions[currentQuestion]
    const progress = ((currentQuestion + 1) / quizData.questions.length) * 100
    const answeredQuestions = Object.keys(answers).length
    const questionId = currentQ.id || currentQ.code;

    return (
      <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-gray-50 p-4">
        {/* Contenido principal del examen */}
        <div className="flex-1">
          <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                <Calculator className="w-16 h-16 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm text-gray-500 font-medium">Estás realizando:</h3>
                <h2 className="text-lg font-bold">{quizData.title}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{quizData.timeLimit} minutos</span>
                  <span className="mx-1">•</span>
                  <span>{quizData.questions.length} preguntas</span>
                  {tabChangeCount > 0 && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="text-orange-600 font-medium">
                        Advertencias: {tabChangeCount}/3
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">{quizData.title}</h2>
            </div>
            <div className="flex items-center gap-4">
              {tabChangeCount > 0 && (
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700">
                    {3 - tabChangeCount} intentos restantes
                  </span>
                </div>
              )}
              {/* tiempo restante */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm ${timeLeft > 600
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : timeLeft > 300
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                <Clock className={`h-4 w-4 ${timeLeft > 600
                    ? 'text-green-500'
                    : timeLeft > 300
                      ? 'text-orange-500'
                      : 'text-red-500'
                  }`} />
                <span className={`text-sm font-medium font-mono ${timeLeft > 600
                    ? 'text-green-700'
                    : timeLeft > 300
                      ? 'text-orange-700'
                      : 'text-red-700'
                  }`}>
                  {formatTimeLeft(timeLeft)}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>
                Pregunta {currentQuestion + 1} de {quizData.questions.length}
              </span>
              <span>{answeredQuestions} respondidas</span>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Pregunta {currentQuestion + 1}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {currentQ.topic}
                  </span>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {currentQ.level}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none">
                {/* Texto informativo */}
                {currentQ.informativeText && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-gray-700 leading-relaxed">{currentQ.informativeText}</p>
                  </div>
                )}

                {/* Imágenes informativas */}
                {currentQ.informativeImages && currentQ.informativeImages.length > 0 && (
                  <div className="mb-4">
                    <ImageGallery images={currentQ.informativeImages} />
                  </div>
                )}

                {/* Imagen de la pregunta */}
                {currentQ.questionImages && currentQ.questionImages.length > 0 && (
                  <div className="mb-4">
                    <ImageGallery images={currentQ.questionImages} />
                  </div>
                )}

                {/* Texto de la pregunta */}
                {currentQ.questionText && (
                  <p className="text-gray-900 leading-relaxed text-lg font-medium">{currentQ.questionText}</p>
                )}
              </div>
              
              <RadioGroup
                value={answers[questionId] || ""}
                onValueChange={(value) => handleAnswerChange(questionId, value)}
                className="space-y-4 mt-6"
              >
                {currentQ.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <RadioGroupItem
                      value={option.id}
                      id={`${questionId}-${option.id}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`${questionId}-${option.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-semibold text-purple-600 mr-2">{option.id}.</span>
                        <div className="flex-1">
                          {option.text && (
                            <span className="text-gray-900">{option.text}</span>
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
              <Button
                onClick={nextQuestion}
                disabled={currentQuestion === quizData.questions.length - 1}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Panel lateral derecho con navegación de preguntas */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white border rounded-lg p-4 sticky top-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              Navegación
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {quizData.questions.map((q, index) => {
                const qId = q.id || q.code;
                return (
                  <button
                    key={qId}
                    onClick={() => changeQuestion(index)}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${currentQuestion === index
                        ? "bg-purple-50 border-purple-200 border"
                        : "border hover:bg-gray-50"
                      }`}
                  >
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${answers[qId]
                          ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 border"
                        }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">Pregunta {index + 1}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {answers[qId] ? (
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
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500 mb-2">Progreso del examen</div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {answeredQuestions}/{quizData.questions.length}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((answeredQuestions / quizData.questions.length) * 100)}%
                </span>
              </div>
              <Progress value={(answeredQuestions / quizData.questions.length) * 100} className="h-2" />

              <Button
                onClick={showSubmitWarning}
                disabled={isSubmitting}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Enviando...
                  </>
                ) : (
                  'Finalizar examen'
                )}
              </Button>

              {answeredQuestions < quizData.questions.length && (
                <p className="text-xs text-center mt-2 text-orange-500">
                  Tienes {quizData.questions.length - answeredQuestions} preguntas sin responder
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Modal de confirmación de envío
  const SubmitWarningModal = () => {
    const score = calculateScore()
    const unanswered = quizData ? quizData.questions.length - score.totalAnswered : 0

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Send className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-xl text-blue-800">
              ¿Enviar Examen?
            </CardTitle>
            <CardDescription className="text-base">
              Confirma que deseas enviar tus respuestas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className="text-blue-600">Respondidas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {unanswered}
                  </div>
                  <div className="text-gray-600">Sin responder</div>
                </div>
              </div>
            </div>

            {unanswered > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Tienes {unanswered} pregunta{unanswered > 1 ? 's' : ''} sin responder.
                  Estas se contarán como incorrectas.
                </AlertDescription>
              </Alert>
            )}

            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                Una vez enviado, no podrás modificar tus respuestas.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={confirmSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Enviando...' : 'Confirmar y Enviar'}
            </Button>
            <Button
              onClick={cancelSubmit}
              variant="outline"
              className="w-full"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Renderizado principal
  return (
    <div className="min-h-screen bg-gray-50">
      {examState === 'loading' && <LoadingScreen />}
      {examState === 'error' && <ErrorScreen />}
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {/* Modales */}
      {showWarning && <SubmitWarningModal />}
    </div>
  )
}

export default DynamicQuizForm;
