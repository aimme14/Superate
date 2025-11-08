import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookOpen, Play, Users, Timer, HelpCircle, Maximize, X, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { useAuthContext } from "@/context/AuthContext";
import { quizGeneratorService, GeneratedQuiz } from "@/services/quiz/quizGenerator.service";

const db = getFirestore(firebaseApp);

// Función para limpiar HTML y mostrar solo texto
const stripHtmlTags = (html: string): string => {
  if (!html) return ''
  
  // Crear un elemento temporal para extraer el texto limpio
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Extraer solo el texto sin etiquetas HTML
  let text = tempDiv.textContent || tempDiv.innerText || ''
  
  // Eliminar cualquier etiqueta HTML que pueda haber quedado (por si acaso)
  text = text.replace(/<[^>]*>/g, '')
  
  // Limpiar espacios en blanco múltiples
  text = text.replace(/\s+/g, ' ').trim()
  
  // Reemplazar saltos de línea con espacios
  text = text.replace(/\n/g, ' ')
  
  // Limpiar espacios múltiples nuevamente
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}

// Función para mapear el nombre del grado al código que usa el banco de preguntas
const mapGradeToCode = (gradeName: string | undefined): string | undefined => {
  if (!gradeName) return undefined;
  
  const gradeMap: Record<string, string> = {
    '6°': '6',
    '6°1': '6',
    '6°2': '6',
    '6°3': '6',
    '7°': '7',
    '7°1': '7',
    '7°2': '7',
    '7°3': '7',
    '8°': '8',
    '8°1': '8',
    '8°2': '8',
    '8°3': '8',
    '9°': '9',
    '9°1': '9',
    '9°2': '9',
    '9°3': '9',
    '10°': '0',
    '10°1': '0',
    '10°2': '0',
    '10°3': '0',
    '11°': '1',
    '11°1': '1',
    '11°2': '1',
    '11°3': '1',
    'Sexto': '6',
    'Séptimo': '7',
    'Octavo': '8',
    'Noveno': '9',
    'Décimo': '0',
    'Undécimo': '1',
    // Agregar más variaciones posibles
    '11': '1',
    '11°1°': '1',
    '11°1°1': '1'
  };
  
  return gradeMap[gradeName] || undefined;
};

// Tipo para el seguimiento de tiempo por pregunta
interface QuestionTimeData {
  questionId: string;
  timeSpent: number; // en segundos
  startTime: number; // timestamp
  endTime?: number; // timestamp
}


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

// Configuración del examen de Lenguaje
const examConfig = {
  subject: "Lenguaje",
  phase: "first" as const,
  examId: "exam_lengua_001", // ID único del examen
  title: "Examen de Lenguaje",
  description: "Evaluación de habilidades de pensamiento crítico y comprensión lectora",
  module: "Módulo de Lenguaje",
};

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const { user } = useAuthContext();
  const userId = user?.uid;

  // Estados principales
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken, no_questions
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

  // Cargar cuestionario dinámico al montar el componente
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true; // Flag para evitar actualizaciones de estado en componentes desmontados

    const loadQuiz = async () => {
      console.log('=== INICIANDO CARGA DEL CUESTIONARIO ===');
      console.log('UserId:', userId);
      console.log('ExamConfig:', examConfig);

      if (!userId) {
        console.log('No hay userId, esperando...');
        return;
      }

      try {
        console.log('Iniciando carga del cuestionario para:', examConfig.subject, examConfig.phase);
        if (isMounted) {
          setExamState('loading');
        }
        
        // Obtener el grado del usuario desde el contexto
        const userGradeName = (user as any)?.gradeName || (user as any)?.grade;
        console.log('Grado del usuario (nombre):', userGradeName);
        
        // Mapear el grado al código que usa el banco de preguntas
        const userGrade = mapGradeToCode(userGradeName);
        console.log('Grado del usuario (código):', userGrade);
        
        // Generar el cuestionario dinámicamente desde el banco de preguntas
        const quizResult = await quizGeneratorService.generateQuiz(
          examConfig.subject, 
          examConfig.phase,
          userGrade
        );
        
        console.log('Resultado del generador de cuestionario:', quizResult);
        
        if (!quizResult.success) {
          console.error('Error generando cuestionario:', quizResult.error);
          console.log('Detalles del error:', {
            subject: examConfig.subject,
            phase: examConfig.phase,
            userGrade,
            userGradeName,
            error: quizResult.error
          });
          console.log('Mostrando pantalla de no hay preguntas...');
          if (isMounted) {
            setExamState('no_questions');
          }
          return;
        }

        const quiz = quizResult.data;
        console.log('Cuestionario generado exitosamente:', quiz);
        
        if (isMounted) {
          setQuizData(quiz);
          setTimeLeft(quiz.timeLimit * 60);
        }

        // Verificar si ya se presentó este examen
        const existingExam = await checkExamStatus(userId, examConfig.examId);
        if (existingExam) {
          console.log('Examen ya presentado:', existingExam);
          if (isMounted) {
            setExistingExamData(existingExam);
            setExamState('already_taken');
          }
        } else {
          console.log('Examen disponible, mostrando pantalla de bienvenida');
          if (isMounted) {
            setExamState('welcome');
          }
        }

        // Limpiar el timeout ya que la carga fue exitosa
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

      } catch (error) {
        console.error('Error cargando cuestionario:', error);
        console.log('Mostrando pantalla de no hay preguntas por error...');
        if (isMounted) {
          setExamState('no_questions');
        }
      }
    };

    // Timeout de seguridad para evitar que se quede en loading indefinidamente
    timeoutId = setTimeout(() => {
      console.log('Timeout alcanzado, verificando estado actual...');
      if (isMounted) {
        setExamState(prevState => {
          if (prevState === 'loading') {
            console.log('Estado sigue en loading, mostrando pantalla de no hay preguntas...');
            return 'no_questions';
          }
          console.log('Estado ya cambió a:', prevState, '- no aplicando timeout');
          return prevState;
        });
      }
    }, 30000); // 30 segundos

    loadQuiz();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [userId]);

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
        examId: examConfig.examId,
        examTitle: examConfig.title,
        subject: examConfig.subject,
        phase: examConfig.phase,
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

      const result = await saveExamResults(userId, examConfig.examId, examResult);
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
  const enterFullscreen = async (): Promise<boolean> => {
    try {
      const el = document.documentElement as any;

      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error("Error entering fullscreen:", error);
    }
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
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
      // Aquí podrías mostrar un mensaje de error al usuario
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

  // Detectar tecla Escape como respaldo
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && examState === 'active') {
        setTimeout(() => {
          const fullscreenElement =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement;

          if (!fullscreenElement) {
            setIsFullscreen(false);
            setShowFullscreenExit(true);
          }
        }, 50);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [examState]);

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    const entered = await enterFullscreen()
    setExamState('active')
    if (!entered) {
      setTimeout(() => {
        const fullscreenElement =
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement;

        if (!fullscreenElement) {
          setIsFullscreen(false);
          setShowFullscreenExit(true);
        }
      }, 100);
    }
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
            Estamos preparando tu evaluación personalizada de {examConfig.subject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla cuando no hay preguntas disponibles
  const NoQuestionsScreen = () => {
    const userGradeName = (user as any)?.gradeName || (user as any)?.grade;
    const userGrade = mapGradeToCode(userGradeName);
    
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Database className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-blue-800">Banco de Preguntas en Construcción</CardTitle>
            <CardDescription className="text-lg">
              Estamos agregando preguntas para {examConfig.subject}
              {userGradeName && (
                <span className="block text-sm text-gray-600 mt-1">
                  Grado: {userGradeName} (Código: {userGrade || 'No disponible'})
                </span>
              )}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <Database className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Información Importante</AlertTitle>
            <AlertDescription className="text-blue-700">
              Nuestro equipo está trabajando activamente para agregar más preguntas al banco de {examConfig.subject}. 
              Pronto tendrás acceso a una amplia variedad de ejercicios para practicar.
            </AlertDescription>
          </Alert>
          
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">¿Qué puedes hacer mientras tanto?</AlertTitle>
            <AlertDescription className="text-green-700">
              Puedes explorar otras materias que ya tienen preguntas disponibles, como Matemáticas, 
              Ciencias Sociales, Ciencias Naturales o Inglés.
            </AlertDescription>
          </Alert>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span className="font-semibold text-purple-800">Próximamente</span>
            </div>
            <p className="text-purple-700 text-sm">
              Estamos preparando preguntas de diferentes niveles de dificultad para que puedas 
              practicar y mejorar tus conocimientos en {examConfig.subject}.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Explorar Otras Materias
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
  }

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

              {/* Mostrar tiempo por pregunta si está disponible */}
              {existingExamData.questionTimeTracking && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Tiempo por pregunta:</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {Object.entries(existingExamData.questionTimeTracking).map(([questionId, timeData]: [string, any]) => (
                      <div key={questionId} className="flex justify-between text-xs">
                        <span>Pregunta {questionId}:</span>
                        <span className="font-medium">{formatTime(timeData.timeSpent)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-purple-400 rounded-full flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-white" />
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

          {/* Advertencia cambio de pestaña */}
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

          {/* Advertencia de una sola presentación */}
          <Alert className="border-green-200 bg-green-50">
            <Database className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Una Sola Oportunidad</AlertTitle>
            <AlertDescription className="text-green-700">
              Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
            </AlertDescription>
          </Alert>

          {/* Nueva advertencia sobre seguimiento de tiempo */}
          <Alert className="border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Seguimiento de Tiempo</AlertTitle>
            <AlertDescription className="text-blue-700">
              El sistema registrará el tiempo que dedicas a cada pregunta individualmente. Esta información se incluirá en tus resultados finales.
            </AlertDescription>
          </Alert>

          {/* Advertencia general */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">¡Importante!</AlertTitle>
            <AlertDescription className="text-amber-700">
              Una vez que inicies el examen, el cronómetro comenzará a correr. Asegúrate de tener una conexión estable a internet y un ambiente tranquilo para concentrarte.
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

  // Modal de advertencia de cambio de pestaña
  const TabChangeWarningModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-orange-800">¡Advertencia!</CardTitle>
          <CardDescription className="text-base">
            Cambio de pestaña detectado
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-orange-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-orange-600 mb-1">Intentos restantes</div>
            <div className="text-2xl font-bold text-orange-800">{3 - tabChangeCount}</div>
          </div>
          <p className="text-gray-700 mb-2">
            Has cambiado de pestaña o perdido el foco de la ventana del examen.
          </p>
          <p className="text-sm text-red-600 font-medium">
            {tabChangeCount >= 2
              ? "¡Último aviso! El próximo cambio finalizará el examen automáticamente."
              : `Después de ${3 - tabChangeCount} intentos más, el examen se finalizará automáticamente.`
            }
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={continueExam}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Continuar Examen
          </Button>
          <Button
            onClick={finishExamByTabChange}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-2" />
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
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <Maximize className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-800">Salida de Pantalla Completa</CardTitle>
          <CardDescription className="text-base">
            Has salido del modo pantalla completa
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-700 mb-4">
            El examen debe realizarse en pantalla completa. ¿Qué deseas hacer?
          </p>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              Si eliges finalizar el examen, se guardarán todas tus respuestas actuales.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={returnToExam}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Maximize className="h-4 w-4 mr-2" />
            Volver a Pantalla Completa
          </Button>
          <Button
            onClick={handleExitFullscreen}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-2" />
            Finalizar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

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

            {/* Tiempo por pregunta */}
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Tiempo por Pregunta
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {quizData?.questions.map((question, index) => {
                  const questionId = question.id || question.code;
                  const timeData = questionTimeData[questionId]
                  const correctOption = question.options.find(opt => opt.isCorrect);
                  const isCorrect = answers[questionId] === correctOption?.id
                  const isAnswered = !!answers[questionId]

                  return (
                    <div key={questionId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-600' :
                          isAnswered ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            Pregunta {index + 1}
                          </div>
                          <div className="text-xs text-gray-500">
                            {isCorrect ? '✓ Correcta' : isAnswered ? '✗ Incorrecta' : '— Sin responder'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatTime(timeData?.timeSpent || 0)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Estadísticas adicionales */}
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Estadísticas del Examen
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Tiempo total usado</div>
                  <div className="text-lg font-medium text-gray-900">
                    {formatTime(Math.floor((Date.now() - examStartTime) / 1000))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Tiempo promedio por pregunta</div>
                  <div className="text-lg font-medium text-gray-900">
                    {formatTime(Math.floor(Object.values(questionTimeData).reduce((acc, q) => acc + (q.timeSpent || 0), 0) / (quizData?.questions.length || 1)))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Estado del examen</div>
                  <div className="text-lg font-medium text-green-600">
                    Completado
                  </div>
                </div>
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
                <BookOpen className="w-16 h-16 text-purple-500" />
              </div>
              <div>
                <h3 className="text-sm text-gray-500 font-medium">Estás realizando:</h3>
                <h2 className="text-lg font-bold">{examConfig.module || examConfig.title}</h2>
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
                    <p className="text-gray-700 leading-relaxed">{stripHtmlTags(currentQ.informativeText)}</p>
                  </div>
                )}

                {/* Imágenes informativas - Grandes y bonitas, sin necesidad de click */}
                {currentQ.informativeImages && currentQ.informativeImages.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {currentQ.informativeImages.map((imageUrl, index) => (
                      <div key={index} className="flex justify-center">
                        <img 
                          src={imageUrl} 
                          alt={`Imagen informativa ${index + 1}`}
                          className="question-image"
                          onError={(e) => {
                            console.error('Error cargando imagen informativa:', imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Imagen de la pregunta - Grandes y bonitas, sin necesidad de click */}
                {currentQ.questionImages && currentQ.questionImages.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {currentQ.questionImages.map((imageUrl, index) => (
                      <div key={index} className="flex justify-center">
                        <img 
                          src={imageUrl} 
                          alt={`Imagen de pregunta ${index + 1}`}
                          className="question-image"
                          onError={(e) => {
                            console.error('Error cargando imagen de pregunta:', imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Texto de la pregunta - Limpio, sin etiquetas HTML */}
                {currentQ.questionText && (
                  <p className="text-gray-900 leading-relaxed text-lg font-medium">{stripHtmlTags(currentQ.questionText)}</p>
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
                            <span className="text-gray-900">{stripHtmlTags(option.text)}</span>
                          )}
                          {option.imageUrl && (
                            <div className="mt-2 flex justify-center">
                              <img 
                                src={option.imageUrl} 
                                alt={`Opción ${option.id}`}
                                className="option-image"
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
        <div className="w-full lg:w-56 flex-shrink-0">
          <div className="bg-white border rounded-lg p-3 sticky top-4 shadow-sm">
            <h3 className="text-xs font-semibold mb-2.5 text-gray-700 uppercase tracking-wide">
              Navegación
            </h3>
            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pb-2">
              {quizData.questions.map((q, index) => {
                const qId = q.id || q.code;
                const isAnswered = answers[qId];
                const isCurrent = currentQuestion === index;
                return (
                  <button
                    key={qId}
                    onClick={() => changeQuestion(index)}
                    className={`relative h-9 w-9 rounded-md flex items-center justify-center text-xs font-semibold transition-all duration-200 hover:scale-110 ${
                      isCurrent
                        ? isAnswered
                          ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-2 ring-purple-400 ring-offset-1"
                          : "bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-2 ring-purple-300 ring-offset-1"
                        : isAnswered
                        ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm hover:shadow-md"
                        : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 hover:border-purple-300"
                    }`}
                    title={`Pregunta ${index + 1}${isAnswered ? " - Respondida" : " - Sin responder"}`}
                  >
                    {index + 1}
                    {isAnswered && !isCurrent && (
                      <CheckCircle2 className="absolute -top-1 -right-1 h-3 w-3 text-green-500 bg-white rounded-full" />
                    )}
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

  // Debug: Log del estado actual
  console.log('=== RENDERIZADO ===');
  console.log('Estado actual del examen:', examState);
  console.log('UserId:', userId);
  console.log('QuizData:', quizData);
  console.log('Estados disponibles:', ['loading', 'no_questions', 'welcome', 'active', 'completed', 'already_taken']);
  console.log('Estado válido:', ['loading', 'no_questions', 'welcome', 'active', 'completed', 'already_taken'].includes(examState));

  // Renderizado principal
  return (
    <div className="min-h-screen bg-gray-50">
      {examState === 'loading' && <LoadingScreen />}
      {examState === 'no_questions' && <NoQuestionsScreen />}
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {/* Debug: Mostrar estado si no hay pantalla activa */}
      {!['loading', 'no_questions', 'welcome', 'active', 'completed', 'already_taken'].includes(examState) && (
        <div className="max-w-2xl mx-auto p-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Estado desconocido:</strong> {examState}
            <br />
            <strong>UserId:</strong> {userId || 'No disponible'}
            <br />
            <strong>QuizData:</strong> {quizData ? 'Disponible' : 'No disponible'}
          </div>
        </div>
      )}

      {/* Modales */}
      {showWarning && <SubmitWarningModal />}
      {showTabChangeWarning && <TabChangeWarningModal />}
      {showFullscreenExit && <FullscreenExitModal />}
    </div>
  )
}

export default ExamWithFirebase