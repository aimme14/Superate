import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookMarked, Timer, HelpCircle, Users, Play, Maximize, X, Database } from "lucide-react"
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
import { getPhaseName, getAllPhases } from "@/utils/firestoreHelpers";

const db = getFirestore(firebaseApp);

// Tipo para el seguimiento de tiempo por pregunta
interface QuestionTimeData {
  questionId: number;
  timeSpent: number; // en segundos
  startTime: number; // timestamp
  endTime?: number; // timestamp
}

// Nueva interfaz para preguntas con soporte de imágenes
interface Question {
  id: number;
  topic: string;
  text?: string; // Opcional para preguntas con imagen
  imageUrl?: string; // URL de la imagen de la pregunta
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
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
const checkExamStatus = async (userId: string, examId: string, phase?: 'first' | 'second' | 'third') => {
  // Si se proporciona la fase, buscar solo en esa subcolección
  if (phase) {
    const phaseName = getPhaseName(phase);
    const docRef = doc(db, "results", userId, phaseName, examId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } else {
    // Si no se proporciona fase, buscar en todas las subcolecciones
    const phases = getAllPhases();
    for (const phaseName of phases) {
      const docRef = doc(db, "results", userId, phaseName, examId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    }
  }
  
  // También verificar estructura antigua para compatibilidad
  const oldDocRef = doc(db, "results", userId);
  const oldDocSnap = await getDoc(oldDocRef);
  if (oldDocSnap.exists()) {
    const data = oldDocSnap.data();
    return data[examId] || null;
  }
  
  return null;
};

// Guarda los resultados del examen
const saveExamResults = async (userId: string, examId: string, examData: any) => {
  // Determinar la fase y obtener el nombre de la subcolección
  const phaseName = getPhaseName(examData.phase);
  
  // Verificar que las respuestas de fase 2 se guarden en "Fase II"
  if (examData.phase === 'second') {
    console.log(`✅ Guardando respuestas de Fase 2 en carpeta: results/${userId}/${phaseName}/${examId}`);
    if (phaseName !== 'Fase II') {
      console.error(`❌ ERROR: La fase 2 debería guardarse en "Fase II" pero se está usando: ${phaseName}`);
    }
  }
  
  // Guardar en la subcolección correspondiente a la fase
  const docRef = doc(db, "results", userId, phaseName, examId);
  await setDoc(
    docRef,
    {
      ...examData,
      timestamp: Date.now(),
    }
  );
  
  console.log(`✅ Examen guardado exitosamente en: results/${userId}/${phaseName}/${examId}`);
  return { success: true, id: `${userId}_${examId}` };
};

// Datos de ejemplo para el examen - ACTUALIZADO con soporte de imágenes
const examDataBase = {
  id: "exam_sociales_001", // ID único del examen
  title: "Examen de Sociales",
  description: "Evaluación de habilidades sobre historia",
  timeLimit: 30, // minutos
  module: "Módulo de Sociales",
  totalQuestions: 25,
  instructions: [
    "Observa cuidadosamente cada imagen/pregunta antes de responder",
    "Solo hay una respuesta correcta por pregunta",
    "Puedes navegar entre preguntas usando los botones o el panel lateral",
    "El tiempo es limitado, administra bien tu tiempo",
    "Una vez enviado el examen, no podrás modificar tus respuestas",
    "Las preguntas aparecen en orden aleatorio para cada usuario"
  ],
  questions: [
    {
      id: 1,
      topic: "Historia",
      imageUrl: "/images/sociales/presidente-republica.png", // URL de la imagen
      text: "¿Cuál es el nombre del presidente de la República?", // Texto de respaldo opcional
      options: [
        { id: "a", text: "Pedro" },
        { id: "b", text: "Juan" },
        { id: "c", text: "Maria" },
        { id: "d", text: "Ana" },
      ],
      correctAnswer: "b",
    },
    {
      id: 2,
      topic: "Historia",
      imageUrl: "/images/sociales/geografia-colombia.png",
      text: "Identifica la región mostrada en el mapa:",
      options: [
        { id: "a", text: "Región Pacífica" },
        { id: "b", text: "Región Andina" },
        { id: "c", text: "Región Caribe" },
        { id: "d", text: "Región Amazónica" },
      ],
      correctAnswer: "b",
    },
    {
      id: 3,
      topic: "Historia",
      imageUrl: "/images/sociales/independencia.png",
      text: "¿En qué año ocurrió el evento mostrado en la imagen?",
      options: [
        { id: "a", text: "1810" },
        { id: "b", text: "1819" },
        { id: "c", text: "1821" },
        { id: "d", text: "1830" },
      ],
      correctAnswer: "c",
    }
  ] as Question[],
};

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken
  const [examData, setExamData] = useState(examDataBase); // Estado para almacenar datos del examen aleatorizados
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [maxReachedQuestion, setMaxReachedQuestion] = useState(0) // Última pregunta alcanzada por el estudiante
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [fullscreenExitWithTabChange, setFullscreenExitWithTabChange] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuthContext();
  const userId = user?.uid;
  const [existingExamData, setExistingExamData] = useState<any | null>(null);

  // Estados para el seguimiento de tiempo por pregunta
  const [questionTimeData, setQuestionTimeData] = useState<{ [key: number]: QuestionTimeData }>({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(0);

  // Aleatorizar preguntas al cargar el componente
  useEffect(() => {
    const shuffledQuestions = shuffleArray(examDataBase.questions);
    setExamData({
      ...examDataBase,
      questions: shuffledQuestions
    });
    // Calcular tiempo límite: 2 minutos por pregunta
    const timeLimitMinutes = shuffledQuestions.length * 2;
    setTimeLeft(timeLimitMinutes * 60);
  }, []);

  // Función para inicializar el seguimiento de tiempo de una pregunta
  const initializeQuestionTime = (questionId: number) => {
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
  const finalizeQuestionTime = (questionId: number) => {
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
  // BLOQUEA TODA navegación desde los botones de navegación (solo permite avanzar con el botón "Siguiente")
<<<<<<< HEAD
  // @ts-ignore - Función intencionalmente no usada (bloqueada para navegación)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
=======
  // Nota: Esta función se mantiene por diseño pero no se usa activamente (navegación bloqueada)
  // @ts-expect-error - Función mantenida para referencia pero no utilizada activamente
>>>>>>> origin/main
  const changeQuestion = (_newQuestionIndex: number) => {
    // BLOQUEAR TODA navegación desde los botones de navegación
    // Solo permitir cambiar de pregunta cuando se usa el botón "Siguiente"
    // Los botones de navegación son SOLO marcadores visuales
    return;
  };

  // Función interna para cambiar de pregunta (solo usada por nextQuestion)
  const internalChangeQuestion = (newQuestionIndex: number) => {
    // Finalizar tiempo de la pregunta actual
    const currentQuestionId = examData.questions[currentQuestion].id;
    finalizeQuestionTime(currentQuestionId);

    // Cambiar a la nueva pregunta
    setCurrentQuestion(newQuestionIndex);

    // Inicializar tiempo de la nueva pregunta
    const newQuestionId = examData.questions[newQuestionIndex].id;
    initializeQuestionTime(newQuestionId);
  };

  // Función para formatear tiempo en minutos y segundos
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Inicializar seguimiento de tiempo cuando el examen comienza
  useEffect(() => {
    if (examState === 'active' && examStartTime === 0) {
      const now = Date.now();
      setExamStartTime(now);
      // Inicializar la primera pregunta y marcar como alcanzada
      setMaxReachedQuestion(0);
      initializeQuestionTime(examData.questions[0].id);
    }
  }, [examState]);

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
  const saveToFirebase = async (timeExpired = false, lockedByTabChange = false) => {
    setIsSubmitting(true)

    // Finalizar el tiempo de la pregunta actual antes de enviar
    const currentQuestionId = examData.questions[currentQuestion].id;
    finalizeQuestionTime(currentQuestionId);

    try {
      const score = calculateScore()
      const examEndTime = Date.now();
      const totalExamTime = Math.floor((examEndTime - examStartTime) / 1000);

      const examResult = {
        userId,
        examId: examData.id,
        examTitle: examData.title,
        answers,
        score,
        topic: examData.questions[currentQuestion].topic,
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
        questionDetails: examData.questions.map(question => ({
          questionId: question.id,
          questionText: question.text,
          userAnswer: answers[question.id] || null,
          correctAnswer: question.correctAnswer,
          topic: question.topic,
          isCorrect: answers[question.id] === question.correctAnswer,
          answered: !!answers[question.id],
          timeSpent: questionTimeData[question.id]?.timeSpent || 0,
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

  // Detectar cambios de pestaña y pérdida de foco
  useEffect(() => {
    if (examState !== 'active' || examLocked) return;

    // Flag para evitar procesamiento duplicado
    let isProcessingTabChange = false;

    const handleTabChange = () => {
      // Evitar procesamiento duplicado
      if (isProcessingTabChange) return;
      isProcessingTabChange = true;

      setTabChangeCount(prev => {
        const newCount = prev + 1;
        
        // Si es la segunda vez (newCount === 2), finalizar examen automáticamente
        if (newCount === 2) {
          // Cerrar cualquier modal abierto
          setShowTabChangeWarning(false);
          setShowFullscreenExit(false);
          
          // Finalizar el examen inmediatamente
          setExamLocked(true);
          setTimeout(() => {
            handleSubmit(true, true);
          }, 50);
        } else if (newCount === 1) {
          // Primera vez: mostrar advertencia
          setShowTabChangeWarning(true);
        }
        
        return newCount;
      });

      // Resetear el flag después de un breve delay
      setTimeout(() => {
        isProcessingTabChange = false;
      }, 500);
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !examLocked) {
        handleTabChange();
      }
    };

    const handleWindowBlur = () => {
      // Solo procesar si realmente cambió de pestaña (verificado por visibilitychange)
      if (!examLocked && document.hidden) {
        setTimeout(() => {
          if (document.hidden && !examLocked) {
            handleTabChange();
          }
        }, 100);
      }
    };

    const handleWindowFocus = () => {
      // El aviso se mantiene visible si hay una advertencia activa
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [examState, examLocked]);

  // Detectar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;

      const isCurrentlyFullscreen = !!fullscreenElement;
      console.log('Fullscreen change detectado. Estado:', isCurrentlyFullscreen, 'ExamState:', examState);
      setIsFullscreen(isCurrentlyFullscreen);

      if (examState === 'active' && !isCurrentlyFullscreen) {
        console.log('Salida de pantalla completa detectada durante examen activo');
        // Verificar si también se cambió de pestaña
        const isHidden = document.hidden;
        if (isHidden) {
          // Se salió de pantalla completa Y cambió de pestaña
          setFullscreenExitWithTabChange(true);
          setTabChangeCount(prev => {
            const newCount = prev + 1;
            console.log('Tab change count en fullscreenchange:', newCount);
            if (newCount >= 1) {
              setExamLocked(true);
              handleSubmit(false, true);
            } else {
              setShowFullscreenExit(true);
            }
            return newCount;
          });
        } else {
          // Solo salió de pantalla completa (sin cambiar de pestaña aún)
          setFullscreenExitWithTabChange(false);
          setShowFullscreenExit(true);
        }
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
  }, [examState, tabChangeCount]);

  // Detectar tecla Escape como respaldo
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && examState === 'active') {
        console.log('Escape presionado durante examen activo');
        // Prevenir la salida automática de pantalla completa
        event.preventDefault();
        event.stopPropagation();
        
        // Mostrar el modal inmediatamente
        const isHidden = document.hidden;
        setFullscreenExitWithTabChange(isHidden);
        
        if (isHidden) {
          setTabChangeCount(prev => {
            const newCount = prev + 1;
            console.log('Tab change count:', newCount);
            if (newCount >= 1) {
              setExamLocked(true);
              handleSubmit(false, true);
            } else {
              setShowFullscreenExit(true);
            }
            return newCount;
          });
        } else {
          setShowFullscreenExit(true);
        }
        
        setTimeout(() => {
          const fullscreenElement =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement;

          console.log('Estado de pantalla completa después de Escape:', !!fullscreenElement);
          
          if (!fullscreenElement) {
            setIsFullscreen(false);
            // Asegurar que el modal se muestre
            setShowFullscreenExit(true);
          }
        }, 50);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [examState, tabChangeCount]);

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    // Restablecer contador de intentos de fraude al iniciar el examen
    setTabChangeCount(0);
    setShowTabChangeWarning(false);
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
    setFullscreenExitWithTabChange(false)
    await enterFullscreen()
    
    // Verificar que realmente entró en pantalla completa
    setTimeout(() => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;
      
      if (!fullscreenElement && examState === 'active') {
        setShowFullscreenExit(true)
      }
    }, 100)
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
  const WelcomeScreen = () => (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-green-400 rounded-full flex items-center justify-center">
                <BookMarked className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent mb-2">
            ¡Bienvenido al examen de {examData.title}!
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
              <div className="font-semibold text-gray-900">{examData.questions.length * 2} minutos</div>
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

          {/* Advertencia cambio de pestaña */}
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Control de Pestañas</AlertTitle>
            <AlertDescription className="text-red-700">
              El sistema detectará si cambias de pestaña o pierdes el foco de la ventana. ⚠️ A la segunda vez que cambies de pestaña, el examen se finalizará automáticamente.
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
            <div className="text-sm text-orange-600 mb-1">Intento de fraude detectado</div>
            <div className="text-2xl font-bold text-orange-800">{tabChangeCount}</div>
          </div>
          <p className="text-gray-700 mb-2">
            Has cambiado de pestaña o perdido el foco de la ventana del examen.
          </p>
          <p className="text-sm text-red-600 font-medium">
            ⚠️ Esta es tu primera advertencia. Si cambias de pestaña una segunda vez, el examen se finalizará automáticamente.
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
  const FullscreenExitModal = () => {
    const hasTabChange = fullscreenExitWithTabChange;
    const isLastWarning = tabChangeCount >= 1;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={`h-16 w-16 ${hasTabChange && isLastWarning ? 'bg-red-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                <Maximize className={`h-8 w-8 ${hasTabChange && isLastWarning ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
            </div>
            <CardTitle className={`text-xl ${hasTabChange && isLastWarning ? 'text-red-800' : 'text-orange-800'}`}>
              {hasTabChange && isLastWarning 
                ? '¡Advertencia Final!' 
                : hasTabChange 
                ? 'Salida de Pantalla Completa y Cambio de Pestaña'
                : 'Salida de Pantalla Completa'}
            </CardTitle>
            <CardDescription className="text-base">
              {hasTabChange && isLastWarning
                ? 'Has salido de pantalla completa y cambiado de pestaña'
                : hasTabChange
                ? 'Has salido de pantalla completa y cambiado de pestaña'
                : 'Has salido del modo pantalla completa'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {hasTabChange && isLastWarning ? (
              <>
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800 font-bold">¡Último Aviso!</AlertTitle>
                  <AlertDescription className="text-red-700">
                    Si vuelves a salir de pantalla completa y cambiar de pestaña, el examen se finalizará automáticamente.
                  </AlertDescription>
                </Alert>
                <p className="text-gray-700 font-medium">
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : hasTabChange ? (
              <>
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-800">Advertencia</AlertTitle>
                  <AlertDescription className="text-orange-700">
                    Has salido de pantalla completa y cambiado de pestaña. ⚠️ Esta es tu primera advertencia. Si lo vuelves a hacer una segunda vez, el examen se finalizará automáticamente.
                  </AlertDescription>
                </Alert>
                <p className="text-gray-700">
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-700 mb-4">
                  El examen debe realizarse en pantalla completa. Por favor, vuelve a poner pantalla completa.
                </p>
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    Si eliges finalizar el examen, se guardarán todas tus respuestas actuales.
                  </AlertDescription>
                </Alert>
              </>
            )}
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
      // Aquí podrías mostrar un mensaje de error al usuario
    }
  }

  // Función para manejar el cambio de respuesta
  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Función para ir a la siguiente pregunta
  const nextQuestion = () => {
    if (currentQuestion < examData.questions.length - 1) {
      const nextIndex = currentQuestion + 1;
      // Actualizar maxReachedQuestion cuando se avanza con el botón siguiente
      if (nextIndex > maxReachedQuestion) {
        setMaxReachedQuestion(nextIndex);
      }
      // Usar la función interna para cambiar de pregunta (no bloqueada)
      internalChangeQuestion(nextIndex);
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
    const currentQ = examData.questions[currentQuestion]
    const answeredQuestions = Object.keys(answers).length

    return (
      <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-gray-25 pt-2 px-4 pb-4">
        {/* Contenido principal del examen */}
        <div className="flex-1">
          <div className="bg-white border rounded-lg p-3 mb-2 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden">
                  <BookMarked className="w-12 h-12 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xs text-gray-500 font-medium">Estás realizando:</h3>
                  <h2 className="text-base font-bold">{examData.module || examData.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tiempo restante */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm ${timeLeft > 600
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
                {/* Preguntas respondidas */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  <span className="text-sm font-medium">{answeredQuestions} respondidas</span>
                </div>
                {/* Advertencias de cambio de pestaña */}
                {tabChangeCount === 1 && (
                  <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-200">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      1 intento de fraude detectado
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Pregunta {currentQuestion + 1}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none">
                {currentQ.imageUrl && (
                  <div className="mb-4">
                    <img 
                      src={currentQ.imageUrl} 
                      alt={currentQ.text || 'Pregunta con imagen'} 
                      className="max-w-full h-auto rounded-lg border shadow-sm"
                      onError={(e) => {
                        console.error('Error cargando imagen:', currentQ.imageUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {currentQ.text && (
                  <p className="text-gray-900 leading-relaxed">{currentQ.text}</p>
                )}
              </div>
              <RadioGroup
                value={answers[currentQ.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQ.id, value)}
                className="space-y-0.5 mt-6"
              >
                {currentQ.options.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleAnswerChange(currentQ.id, option.id)}
                    className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <RadioGroupItem
                      value={option.id}
                      id={`${currentQ.id}-${option.id}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`${currentQ.id}-${option.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="font-semibold text-purple-600 mr-2">{option.id.toUpperCase()}.</span>
                      {option.text}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={nextQuestion}
                disabled={currentQuestion === examData.questions.length - 1}
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
              {examData.questions.map((q, index) => {
                const isAnswered = answers[q.id];
                const isCurrent = currentQuestion === index;
                // TODOS los botones están bloqueados - solo son marcadores visuales
                // No se puede navegar desde los botones, solo desde el botón "Siguiente"
                
                return (
                  <button
                    key={q.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // BLOQUEAR TODOS los clics - los botones son SOLO marcadores visuales
                      return false;
                    }}
                    className={`relative h-9 w-9 rounded-md flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-not-allowed ${
                      isCurrent
                        ? isAnswered
                          ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-2 ring-purple-400 ring-offset-1"
                          : "bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-2 ring-purple-300 ring-offset-1"
                        : isAnswered
                        ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm hover:shadow-md"
                        : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 hover:border-purple-300"
                    }`}
                    title={`Pregunta ${index + 1}${isAnswered ? " - Respondida" : " - Sin responder"} - Solo marcador visual`}
                    onMouseDown={(e) => {
                      // Prevenir cualquier acción - los botones son solo marcadores visuales
                      e.preventDefault();
                      e.stopPropagation();
                    }}
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
                  {answeredQuestions}/{examData.questions.length}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((answeredQuestions / examData.questions.length) * 100)}%
                </span>
              </div>
              <Progress value={(answeredQuestions / examData.questions.length) * 100} className="h-2" />

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

              {answeredQuestions < examData.questions.length && (
                <p className="text-xs text-center mt-2 text-orange-500">
                  Tienes {examData.questions.length - answeredQuestions} preguntas sin responder
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
    const unanswered = examData.questions.length - score.totalAnswered

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
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {/* Modales */}
      {showWarning && <SubmitWarningModal />}
      {showTabChangeWarning && <TabChangeWarningModal />}
      {showFullscreenExit && <FullscreenExitModal />}
    </div>
  )
}

export default ExamWithFirebase