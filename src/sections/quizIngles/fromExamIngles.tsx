import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookCheck, Timer, HelpCircle, Users, Play, Maximize, X, Database, Flag, Eye } from "lucide-react"
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

const db = getFirestore(firebaseApp);

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

// Datos de ejemplo para el examen
const examData = {
  id: "exam_english_001", // ID único del examen
  title: "Examen de Inglés",
  description: "Evaluación de habilidades de pensamiento crítico y comprensión lectora",
  timeLimit: 30, // minutos
  module: "Módulo de Inglés",
  totalQuestions: 25,
  instructions: [
    "Lee cuidadosamente cada pregunta antes de responder",
    "Solo hay una respuesta correcta por pregunta",
    "Puedes navegar entre preguntas usando los botones o el panel lateral",
    "Puedes marcar preguntas para revisar más tarde usando el botón de bandera",
    "El tiempo es limitado, administra bien tu tiempo",
    "Una vez enviado el examen, no podrás modificar tus respuestas"
  ],
  questions: [
    {
      id: 1,
      text: "María tiene 7 manzanas más que Pedro. Si Pedro tiene \\( x \\) manzanas, y entre los dos tienen 17, ¿cuántas manzanas tiene Pedro?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
        { id: "c", text: "7" },
        { id: "d", text: "10" },
      ],
      correctAnswer: "b",
    },
    {
      id: 2,
      text: "What is the past tense of 'go'?",
      options: [
        { id: "a", text: "goed" },
        { id: "b", text: "went" },
        { id: "c", text: "gone" },
        { id: "d", text: "going" },
      ],
      correctAnswer: "b",
    },
    {
      id: 3,
      text: "Choose the correct sentence:",
      options: [
        { id: "a", text: "She don't like coffee" },
        { id: "b", text: "She doesn't likes coffee" },
        { id: "c", text: "She doesn't like coffee" },
        { id: "d", text: "She not like coffee" },
      ],
      correctAnswer: "c",
    }
  ],
}

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken
  const [timeLeft, setTimeLeft] = useState(examData.timeLimit * 60)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [markedForReview, setMarkedForReview] = useState<{ [key: number]: boolean }>({})
  const [questionTimes, setQuestionTimes] = useState<{ [key: number]: number }>({})
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const { user } = useAuthContext();
  const userId = user?.uid;
  const [existingExamData, setExistingExamData] = useState<any>(null);

  // Registro de tiempo por pregunta
  useEffect(() => {
    if (examState === 'active') {
      const currentQuestionId = examData.questions[currentQuestion].id;
      const startTime = Date.now();
      setQuestionStartTime(startTime);

      return () => {
        const endTime = Date.now();
        const timeSpent = Math.floor((endTime - startTime) / 1000);
        setQuestionTimes(prev => ({
          ...prev,
          [currentQuestionId]: (prev[currentQuestionId] || 0) + timeSpent
        }));
      };
    }
  }, [currentQuestion, examState]);

  // Función para marcar pregunta para revisar
  const toggleMarkForReview = (questionId: number) => {
    setMarkedForReview(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Función para obtener el estado de una pregunta
  const getQuestionStatus = (questionId: number) => {
    const isAnswered = !!answers[questionId];
    const isMarked = !!markedForReview[questionId];
    
    if (isAnswered && isMarked) return 'answered-marked';
    if (isAnswered) return 'answered';
    if (isMarked) return 'marked';
    return 'unanswered';
  };

  // Función para obtener las clases de color según el estado
  const getQuestionStatusStyles = (questionId: number, isCurrent: boolean) => {
    const status = getQuestionStatus(questionId);
    const baseClasses = "w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors";
    
    if (isCurrent) {
      return `${baseClasses} bg-purple-50 border-purple-200 border`;
    }
    
    switch (status) {
      case 'answered-marked':
        return `${baseClasses} bg-orange-50 border-orange-200 border hover:bg-orange-100`;
      case 'answered':
        return `${baseClasses} bg-green-50 border-green-200 border hover:bg-green-100`;
      case 'marked':
        return `${baseClasses} bg-yellow-50 border-yellow-200 border hover:bg-yellow-100`;
      default:
        return `${baseClasses} border hover:bg-gray-50`;
    }
  };

  // Función para obtener el color del círculo de número de pregunta
  const getQuestionNumberStyles = (questionId: number) => {
    const status = getQuestionStatus(questionId);
    
    switch (status) {
      case 'answered-marked':
        return "bg-orange-500 text-white";
      case 'answered':
        return "bg-green-500 text-white";
      case 'marked':
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-100 text-gray-700 border";
    }
  };

  // Función para obtener el ícono de estado
  const getStatusIcon = (questionId: number) => {
    const status = getQuestionStatus(questionId);
    
    switch (status) {
      case 'answered-marked':
        return <Flag className="h-3 w-3 text-orange-500" />;
      case 'answered':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'marked':
        return <Flag className="h-3 w-3 text-yellow-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-orange-500" />;
    }
  };

  // Función para obtener el texto de estado
  const getStatusText = (questionId: number) => {
    const status = getQuestionStatus(questionId);
    
    switch (status) {
      case 'answered-marked':
        return 'Respondida y marcada';
      case 'answered':
        return 'Respondida';
      case 'marked':
        return 'Marcada para revisar';
      default:
        return 'Sin responder';
    }
  };

  // Verificar al cargar si el examen ya fue presentado
  useEffect(() => {
    if (!userId) return;
  
    const fetchExamStatus = async () => {
      try {
        const existingExam = await checkExamStatus(userId, examData.id);
        if (existingExam) {
          setExistingExamData(existingExam)
          setExamState('already_taken')
        } else {
          setExamState('welcome')
        }
      } catch (error) {
        console.error('Error verificando estado del examen:', error)
        setExamState('welcome')
      }
    }
  
    fetchExamStatus()
  }, [userId])

  // Función para calcular la puntuación
  const calculateScore = () => {
    let correctAnswers = 0
    let totalAnswered = 0

    examData.questions.forEach(question => {
      if (answers[question.id]) {
        totalAnswered++
        if (answers[question.id] === question.correctAnswer) {
          correctAnswers++
        }
      }
    })

    return {
      correctAnswers,
      totalAnswered,
      totalQuestions: examData.questions.length,
      percentage: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      overallPercentage: Math.round((correctAnswers / examData.questions.length) * 100)
    }
  }

  // Función para guardar resultados en Firebase
  const saveToFirebase = async (timeExpired = false, lockedByFraud = false) => {
    // Registrar tiempo de la pregunta actual antes de guardar
    const currentQuestionId = examData.questions[currentQuestion].id;
    const currentTime = Date.now();
    const timeSpent = Math.floor((currentTime - questionStartTime) / 1000);
    const finalQuestionTimes = {
      ...questionTimes,
      [currentQuestionId]: (questionTimes[currentQuestionId] || 0) + timeSpent
    };

    setIsSubmitting(true)
    try {
      const score = calculateScore()
      const examResult = {
        userId,
        examId: examData.id,
        examTitle: examData.title,
        answers,
        score,
        timeExpired,
        lockedByFraud,
        fraudAttempts: tabChangeCount,
        markedForReview,
        questionTimes: finalQuestionTimes,
        startTime: new Date(Date.now() - (examData.timeLimit * 60 - timeLeft) * 1000).toISOString(),
        endTime: new Date().toISOString(),
        timeSpent: examData.timeLimit * 60 - timeLeft,
        completed: true,
        questionDetails: examData.questions.map(question => ({
          questionId: question.id,
          questionText: question.text,
          userAnswer: answers[question.id] || null,
          correctAnswer: question.correctAnswer,
          isCorrect: answers[question.id] === question.correctAnswer,
          answered: !!answers[question.id],
          markedForReview: !!markedForReview[question.id],
          timeSpent: finalQuestionTimes[question.id] || 0
        }))
      }

      if (!userId || !examData.id) {
        throw new Error("Falta userId o examData.id");
      }
      const result = await saveExamResults(userId, examData.id, examResult);
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
        // El warning se mantiene visible
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
          <CardTitle className="text-xl">Verificando estado del examen...</CardTitle>
          <CardDescription>
            Por favor espera mientras verificamos si ya has presentado este examen
          </CardDescription>
        </CardHeader>
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
                    {Math.floor(existingExamData.timeSpent / 60)}:{(existingExamData.timeSpent % 60).toString().padStart(2, '0')} min
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
            Volver a las demas pruebas
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Componente de Bienvenida
  const WelcomeScreen = () => (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-emerald-400 rounded-full flex items-center justify-center">
                <BookCheck className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent mb-2">
            ¡Bienvenido al {examData.title}!
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 max-w-2xl mx-auto">
            {examData.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información del examen */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-900">{examData.timeLimit} minutos</div>
              <div className="text-sm text-gray-500">Tiempo límite</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-900">{examData.questions.length} preguntas</div>
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
              {examData.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <span className="text-gray-700">{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Advertencia de intento de fraude */}
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Detección de Intento de Fraude</AlertTitle>
            <AlertDescription className="text-red-700">
              El sistema detectará intentos de fraude como cambio de pestaña, minimizar la ventana, o perder el foco. Después de 3 intentos, el examen se finalizará automáticamente.
            </AlertDescription>
          </Alert>

          <Alert className="border-purple-200 bg-purple-50">
            <Maximize className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-800">Modo Pantalla Completa</AlertTitle>
            <AlertDescription className="text-purple-700">
              El examen se realizará en pantalla completa. Si sales de este modo durante la prueba, se mostrará una alerta y podrás elegir entre volver al examen o finalizarlo automáticamente.
            </AlertDescription>
          </Alert>

          {/* Advertencia de una sola presentación */}
          <Alert className="border-green-200 bg-green-50">
            <Database className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Una Sola Oportunidad</AlertTitle>
            <AlertDescription className="text-green-700">
              Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
            </AlertDescription>
          </Alert>

          {/* Advertencia general */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">¡Importante!</AlertTitle>
            <AlertDescription className="text-amber-700">
              Una vez que inicies el examen, el cronómetro comenzará a correr. Asegúrate de tener una conexión estable a internet y un ambiente tranquilo para concentrarte.
            </ AlertDescription>
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

  // Modal de advertencia de intento de fraude
  const FraudWarningModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-800">¡Intento de Fraude Detectado!</CardTitle>
          <CardDescription className="text-base">
            Comportamiento sospechoso detectado
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-red-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-red-600 mb-1">Intentos restantes</div>
            <div className="text-2xl font-bold text-red-800">{3 - tabChangeCount}</div>
          </div>
          <p className="text-gray-700 mb-2">
            Has intentado cambiar de pestaña, minimizar la ventana o perder el foco del examen.
          </p>
          <p className="text-sm text-red-600 font-medium">
          {tabChangeCount >= 2
              ? "¡Último aviso! El próximo intento finalizará el examen automáticamente."
              : "Tienes pocas oportunidades restantes."}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={continueExam}
            className="flex-1 bg-blue-500 hover:bg-blue-600"
            disabled={tabChangeCount >= 2}
          >
            Continuar Examen
          </Button>
          <Button
            onClick={finishExamByTabChange}
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            Finalizar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Modal de salida de pantalla completa
  const FullscreenExitModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center">
              <Maximize className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-orange-800">Pantalla Completa Requerida</CardTitle>
          <CardDescription>
            Has salido del modo pantalla completa
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-700 mb-4">
            El examen debe realizarse en modo pantalla completa por políticas de seguridad.
          </p>
          <p className="text-sm text-orange-600">
            ¿Qué deseas hacer?
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={returnToExam}
            className="flex-1 bg-green-500 hover:bg-green-600"
          >
            Volver al Examen
          </Button>
          <Button
            onClick={handleExitFullscreen}
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
          >
            Finalizar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Temporizador
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (examState === 'active' && timeLeft > 0 && !examLocked) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            handleSubmit(true)
            return 0
          }
          return time - 1
        })
      }, 1000)
    } else if (timeLeft === 0 && examState === 'active') {
      handleSubmit(true)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [examState, timeLeft, examLocked])

  // Función para manejar el envío
  const handleSubmit = async (timeExpired = false, lockedByFraud = false) => {
    if (examState !== 'active') return

    setShowWarning(true)
    try {
      await saveToFirebase(timeExpired, lockedByFraud)
      setExamState('completed')
    } catch (error) {
      console.error('Error al enviar el examen:', error)
      alert('Error al enviar el examen. Por favor, inténtalo de nuevo.')
    } finally {
      setShowWarning(false)
    }
  }

  // Función para confirmar envío
  const confirmSubmit = () => {
    setShowWarning(false)
    handleSubmit()
  }

  // Función para cancelar envío
  const cancelSubmit = () => {
    setShowWarning(false)
  }

  // Función para manejar respuestas
  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Función para navegar a pregunta específica
  const goToQuestion = (questionIndex: number) => {
    setCurrentQuestion(questionIndex)
  }

  // Función para navegar a siguiente pregunta
  const nextQuestion = () => {
    if (currentQuestion < examData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  // Función para navegar a pregunta anterior
  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  // Formatear tiempo
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Pantalla de examen activo
  const ActiveExamScreen = () => (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Panel lateral de navegación */}
      <div className="w-80 bg-white shadow-lg border-r overflow-y-auto">
        <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-blue-500">
          <h2 className="text-white font-semibold text-lg">Panel de Navegación</h2>
          <div className="text-purple-100 text-sm mt-1">
            {examData.questions.length} preguntas en total
          </div>
        </div>
        
        {/* Resumen de estado */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.keys(answers).length}
              </div>
              <div className="text-gray-600">Respondidas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values(markedForReview).filter(Boolean).length}
              </div>
              <div className="text-gray-600">Marcadas</div>
            </div>
          </div>
        </div>

        {/* Leyenda de colores */}
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900 mb-3">Leyenda</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span>Respondida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span>Marcada para revisar</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              <span>Respondida y marcada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded-full border"></div>
              <span>Sin responder</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-200 rounded-full border-2 border-purple-500"></div>
              <span>Pregunta actual</span>
            </div>
          </div>
        </div>

        {/* Lista de preguntas */}
        <div className="p-4 space-y-2">
          {examData.questions.map((question, index) => (
            <button
              key={question.id}
              onClick={() => goToQuestion(index)}
              className={getQuestionStatusStyles(question.id, index === currentQuestion)}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getQuestionNumberStyles(question.id)}`}>
                {index + 1}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 truncate">
                  Pregunta {index + 1}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {getStatusIcon(question.id)}
                  {getStatusText(question.id)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col">
        {/* Header con temporizador */}
        <div className="bg-white shadow-sm border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">{examData.title}</h1>
            <div className="text-sm text-gray-500">
              Pregunta {currentQuestion + 1} de {examData.questions.length}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <Button
              onClick={() => setShowWarning(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Examen
            </Button>
          </div>
        </div>

        {/* Contenido de la pregunta */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    Pregunta {currentQuestion + 1}
                  </CardTitle>
                  <Button
                    onClick={() => toggleMarkForReview(examData.questions[currentQuestion].id)}
                    variant="outline"
                    size="sm"
                    className={`gap-2 ${
                      markedForReview[examData.questions[currentQuestion].id]
                        ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    <Flag className="h-4 w-4" />
                    {markedForReview[examData.questions[currentQuestion].id] ? 'Desmarcaar' : 'Marcar para revisar'}
                  </Button>
                </div>
                <CardDescription className="text-lg leading-relaxed">
                  {examData.questions[currentQuestion].text}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[examData.questions[currentQuestion].id] || ""}
                  onValueChange={(value) => handleAnswerChange(examData.questions[currentQuestion].id, value)}
                >
                  {examData.questions[currentQuestion].options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer text-base">
                        {option.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  onClick={prevQuestion}
                  disabled={currentQuestion === 0}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={((currentQuestion + 1) / examData.questions.length) * 100} 
                    className="w-32"
                  />
                  <span className="text-sm text-gray-500 min-w-max">
                    {currentQuestion + 1} / {examData.questions.length}
                  </span>
                </div>
                <Button
                  onClick={nextQuestion}
                  disabled={currentQuestion === examData.questions.length - 1}
                  className="flex items-center gap-2"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )

  // Modal de confirmación de envío
  const SubmitWarningModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-amber-800">¿Enviar Examen?</CardTitle>
          <CardDescription>
            Esta acción no se puede deshacer
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-amber-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-amber-600 mb-2">Progreso actual</div>
            <div className="text-2xl font-bold text-amber-800 mb-1">
              {Object.keys(answers).length} / {examData.questions.length}
            </div>
            <div className="text-sm text-amber-600">preguntas respondidas</div>
          </div>
          <p className="text-gray-700 mb-2">
            Una vez enviado, no podrás modificar tus respuestas.
          </p>
          <p className="text-sm text-amber-600">
            ¿Estás seguro de que quieres enviar el examen?
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={cancelSubmit}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmSubmit}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Examen'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Pantalla de resultados
  const ResultsScreen = () => {
    const score = calculateScore()
    
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl text-green-600 mb-2">¡Examen Completado!</CardTitle>
            <CardDescription className="text-lg">
              Tus respuestas han sido enviadas correctamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Puntuación */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {score.correctAnswers} / {score.totalQuestions}
              </div>
              <div className="text-lg text-gray-600 mb-1">Respuestas correctas</div>
              <div className="text-3xl font-bold text-blue-600">
                {score.overallPercentage}%
              </div>
              <div className="text-sm text-gray-500">Puntuación total</div>
            </div>

            {/* Estadísticas detalladas */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="text-2xl font-bold text-green-600">
                  {score.correctAnswers}
                </div>
                <div className="text-sm text-gray-500">Correctas</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="text-2xl font-bold text-red-600">
                  {score.totalQuestions - score.correctAnswers}
                </div>
                <div className="text-sm text-gray-500">Incorrectas</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {formatTime(examData.timeLimit * 60 - timeLeft)}
                </div>
                <div className="text-sm text-gray-500">Tiempo usado</div>
              </div>
            </div>

            {/* Preguntas marcadas para revisar */}
            {Object.values(markedForReview).filter(Boolean).length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <Flag className="h-5 w-5" />
                  <span className="font-medium">Preguntas marcadas para revisar</span>
                </div>
                <div className="text-sm text-yellow-700">
                  Marcaste {Object.values(markedForReview).filter(Boolean).length} preguntas para revisar durante el examen.
                </div>
              </div>
            )}

            {/* Información adicional */}
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Información</AlertTitle>
              <AlertDescription className="text-blue-700">
                Tus resultados han sido guardados automáticamente. No es necesario realizar ninguna acción adicional.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              Volver al Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Renderizado condicional
  if (examLocked) {
    return <ResultsScreen />
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        {examState === 'loading' && <LoadingScreen />}
        {examState === 'already_taken' && <AlreadyTakenScreen />}
        {examState === 'welcome' && <WelcomeScreen />}
        {examState === 'active' && <ActiveExamScreen />}
        {examState === 'completed' && <ResultsScreen />}
        
        {/* Modales */}
        {showWarning && <SubmitWarningModal />}
        {showTabChangeWarning && <FraudWarningModal />}
        {showFullscreenExit && <FullscreenExitModal />}
      </div>
    </div>
  )
}

export default ExamWithFirebase