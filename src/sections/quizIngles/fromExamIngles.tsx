import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookCheck, Timer, HelpCircle, Users, Play, Maximize, X, Database, Shield } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/ui/select"
import { useState, useEffect, useRef, useCallback } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate, useSearchParams } from "react-router-dom"
import { dbService } from "@/services/firebase/db.service";
import { useAuthContext } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { EVALUATIONS_QUERY_KEY } from "@/hooks/query/useStudentEvaluations";
import { getQuizTheme, getQuizBackgroundStyle } from "@/utils/quizThemes";
import { quizGeneratorService, GeneratedQuiz } from "@/services/quiz/quizGenerator.service";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Question } from "@/services/firebase/question.service";
import { useNotification } from "@/hooks/ui/useNotification";
import { processExamResults } from "@/utils/phaseIntegration";
import { gradeLabelToBankCode } from "@/utils/gradeMapping";
import ImageGallery from "@/components/common/ImageGallery";
import { saveExamResultsAndRegister } from "@/services/firebase/examResults.service";
import { validateExamPresentationGate } from "@/services/quiz/validateExamPresentationGate";

// Tipo para el seguimiento de tiempo por pregunta
interface QuestionTimeData {
  questionId: string;
  timeSpent: number; // en segundos
  startTime: number; // timestamp
  endTime?: number; // timestamp
}


// Guarda los resultados del examen y los registra en el contador del admin (servicio unificado)
const saveExamResults = async (userId: string, examId: string, examData: any) => {
  const result = await saveExamResultsAndRegister(userId, examId, examData);
  if (!result.success) throw result.error;
  return { success: true as const, id: result.data.id };
};

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

// Configuración del examen de Inglés
const examConfig = {
  subject: "Inglés",
  phase: "first" as const,
  examId: "exam_english_001", // ID único del examen
  title: "Examen de Inglés",
  description: "Evaluación de habilidades en inglés",
  module: "Módulo de Inglés",
};

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams();
  const { user } = useAuthContext();
  const { theme: appTheme } = useThemeContext();
  const { notifyError } = useNotification();
  const userId = user?.uid;

  // Obtener parámetros de la URL para determinar la fase
  const phaseParam = searchParams.get('phase') as 'first' | 'second' | 'third' | null;
  const currentPhase = phaseParam || examConfig.phase;

  // Estados principales
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const answersRef = useRef<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, awaiting_validation, welcome, active, completed, already_taken, no_questions
  const [validationChecking, setValidationChecking] = useState(false)
  const gradeIdRef = useRef<string | undefined>(undefined)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [maxReachedQuestion, setMaxReachedQuestion] = useState(0) // Última pregunta alcanzada por el estudiante
  const [questionGroups, setQuestionGroups] = useState<Question[][]>([]); // Grupos de preguntas agrupadas
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0); // Índice del grupo actual
  
  // Ref para mantener referencia a handleSubmit
  const handleSubmitRef = useRef<((timeExpired?: boolean, lockedByTabChange?: boolean) => Promise<void>) | null>(null);
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [fullscreenExitWithTabChange, setFullscreenExitWithTabChange] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingExamData, setExistingExamData] = useState<any | null>(null);

  // Estados para el seguimiento de tiempo por pregunta
  const [questionTimeData, setQuestionTimeData] = useState<{ [key: string]: QuestionTimeData }>({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(0);
  
  // Estado para controlar qué Select está abierto (por ID de pregunta)
  const [openSelects, setOpenSelects] = useState<{ [key: string]: boolean }>({});
  // Ref para rastrear si un cierre es intencional
  const intentionalCloseRef = useRef<{ [key: string]: boolean }>({});

  // Cargar cuestionario dinámico al montar el componente
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    let isMounted = true;

    const loadQuiz = async () => {
      console.log('=== INICIANDO CARGA DEL CUESTIONARIO DE INGLÉS ===');
      console.log('UserId:', userId);
      console.log('Phase:', currentPhase);

      if (!userId) {
        console.log('No hay userId, esperando...');
        return;
      }

      try {
        console.log('Iniciando carga del cuestionario para:', examConfig.subject, currentPhase);
        if (isMounted) {
          setExamState('loading');
        }
        
        // PRIMERO: Verificar acceso y bloqueo ANTES de generar el cuestionario
        const userResult = await dbService.getUserById(userId);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data;
          const gradeId = studentData.gradeId || studentData.grade;

          if (gradeId) {
            gradeIdRef.current = gradeId;
            const { phaseAuthorizationService } = await import('@/services/phase/phaseAuthorization.service');
            const checkPhaseAccess = async (uid: string, gId: string, ph: 'first' | 'second' | 'third') => {
              const accessResult = await phaseAuthorizationService.canStudentAccessPhase(uid, gId, ph);
              return accessResult.success ? accessResult.data : { canAccess: false, reason: 'Error verificando acceso' };
            };

            const accessCheck = await checkPhaseAccess(userId, gradeId, currentPhase);
            if (!accessCheck.canAccess) {
              console.log(`[fromExamIngles] Acceso bloqueado: ${accessCheck.reason}`);
              if (isMounted) {
                setExamState('blocked');
                notifyError({
                  title: 'Acceso bloqueado',
                  message: accessCheck.reason || 'No tienes acceso a esta fase. Debes completar la fase anterior primero.'
                });
              }
              return;
            }
          } else {
            gradeIdRef.current = undefined;
          }
        }
        
        // Obtener el grado del usuario desde el contexto
        const userGradeName = (user as any)?.gradeName || (user as any)?.grade;
        console.log('Grado del usuario (nombre):', userGradeName);
        
        // Mapear el grado al código que usa el banco de preguntas
        const userGrade = gradeLabelToBankCode(userGradeName) ?? '1';
        console.log('Grado del usuario (código):', userGrade);
        
        // SEGUNDO: Generar el cuestionario solo si no está bloqueado
        // Nota: Inglés tiene lógica especial de preguntas agrupadas, pero aún así pasamos userId
        const quizResult = await quizGeneratorService.generateQuiz(
          examConfig.subject, 
          currentPhase,
          userGrade,
          userId // Pasar userId para personalización en Fase 2 (aunque Inglés tiene lógica especial)
        );
        
        console.log('Resultado del generador de cuestionario:', quizResult);
        
        if (!quizResult.success) {
          console.error('Error generando cuestionario:', quizResult.error);
          if (isMounted) {
            setExamState('no_questions');
          }
          return;
        }

        const quiz = quizResult.data;
        console.log('Cuestionario generado exitosamente:', quiz);
        
        if (isMounted) {
          setQuizData(quiz);
          
          // Agrupar preguntas por informativeText para inglés
          if (quiz.subject === 'Inglés') {
            const groups: Question[][] = [];
            let currentGroup: Question[] = [];
            let currentInformativeText = '';
            
            quiz.questions.forEach((question, index) => {
              const informativeText = question.informativeText || '';
              const informativeImages = JSON.stringify(question.informativeImages || []);
              const groupKey = `${informativeText}_${informativeImages}`;
              
              // Si tiene informativeText, agrupar
              if (informativeText && informativeText.trim() !== '' && question.subjectCode === 'IN') {
                if (groupKey !== currentInformativeText) {
                  // Nuevo grupo
                  if (currentGroup.length > 0) {
                    groups.push([...currentGroup]);
                  }
                  currentGroup = [question];
                  currentInformativeText = groupKey;
                } else {
                  // Mismo grupo
                  currentGroup.push(question);
                }
              } else {
                // Pregunta individual sin grupo
                if (currentGroup.length > 0) {
                  groups.push([...currentGroup]);
                  currentGroup = [];
                  currentInformativeText = '';
                }
                groups.push([question]);
              }
              
              // Si es la última pregunta, agregar el grupo actual
              if (index === quiz.questions.length - 1 && currentGroup.length > 0) {
                groups.push([...currentGroup]);
              }
            });
            
            setQuestionGroups(groups);
            setCurrentGroupIndex(0);
            console.log(`✅ Preguntas agrupadas en ${groups.length} grupos para inglés`);
          } else {
            // Para otras materias, cada pregunta es un grupo individual
            const individualGroups = quiz.questions.map(q => [q]);
            setQuestionGroups(individualGroups);
            setCurrentGroupIndex(0);
          }
          
          // Calcular tiempo límite: usar el del quiz o 2 minutos por pregunta como fallback
          const timeLimitMinutes = quiz.timeLimit || (quiz.questions.length * 2);
          setTimeLeft(timeLimitMinutes * 60);
          setExamState('awaiting_validation');
        }
      } catch (error) {
        console.error('Error cargando cuestionario:', error);
        if (isMounted) {
          setExamState('no_questions');
        }
      }
    };

    loadQuiz();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [userId, currentPhase, user]);

  const runValidationFromSummary = useCallback(async () => {
    if (!userId || !quizData) return;
    const gradeId = gradeIdRef.current;
    if (!gradeId) {
      notifyError({ title: 'Datos incompletos', message: 'No se encontró el grado del estudiante.' });
      return;
    }
    setValidationChecking(true);
    try {
      const outcome = await validateExamPresentationGate({
        userId,
        gradeId,
        phase: currentPhase,
        subjectLabel: examConfig.subject,
        quizId: quizData.id,
      });
      if (outcome.type === 'blocked') {
        setExamState('blocked');
        notifyError({
          title: 'Examen bloqueado',
          message: 'Este examen está bloqueado. Verifica que la fase esté habilitada y que hayas completado la fase anterior.',
        });
        return;
      }
      if (outcome.type === 'already_taken') {
        setExistingExamData(outcome.examSnapshot);
        setExamState('already_taken');
        return;
      }
      setExamState('welcome');
    } catch (err) {
      console.error('[fromExamIngles] Validación:', err);
      notifyError({ title: 'Error', message: 'No se pudo comprobar el acceso. Intenta de nuevo.' });
    } finally {
      setValidationChecking(false);
    }
  }, [userId, quizData, currentPhase, notifyError]);

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

  // Función interna para cambiar de pregunta (solo usada por nextQuestion)
  const internalChangeQuestion = (newQuestionIndex: number) => {
    if (!quizData) return;
    
    // Finalizar tiempo de las preguntas del grupo actual
    if (quizData.subject === 'Inglés' && questionGroups.length > 0 && questionGroups[currentGroupIndex]) {
      questionGroups[currentGroupIndex].forEach(q => {
        const questionId = q.id || q.code;
        if (questionId) finalizeQuestionTime(questionId);
      });
    } else {
      const currentQuestionId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code;
      finalizeQuestionTime(currentQuestionId);
    }

    // Cambiar a la nueva pregunta
    setCurrentQuestion(newQuestionIndex);
    
    // Para inglés, actualizar el índice del grupo
    if (quizData.subject === 'Inglés' && questionGroups.length > 0) {
            // Encontrar a qué grupo pertenece esta pregunta
            let foundGroupIndex = 0;
            let accumulated = 0;
            for (let i = 0; i < questionGroups.length; i++) {
              if (newQuestionIndex < accumulated + questionGroups[i].length) {
                foundGroupIndex = i;
                break;
              }
              accumulated += questionGroups[i].length;
            }
            setCurrentGroupIndex(foundGroupIndex);
            
            // Inicializar tiempo de la primera pregunta del nuevo grupo
            if (questionGroups.length > 0 && questionGroups[foundGroupIndex]) {
              const firstQuestionId = questionGroups[foundGroupIndex][0].id || questionGroups[foundGroupIndex][0].code;
              if (firstQuestionId) initializeQuestionTime(firstQuestionId);
            }
    } else {
      const newQuestionId = quizData.questions[newQuestionIndex].id || '';
      initializeQuestionTime(newQuestionId);
    }
  };

  // Función interna para cambiar de grupo (solo usada por nextQuestion)
  const internalChangeGroup = (newGroupIndex: number) => {
    if (!quizData || questionGroups.length === 0) return;
    
    // Finalizar tiempo del grupo actual
    questionGroups[currentGroupIndex].forEach(q => {
      const questionId = q.id || q.code;
      if (questionId) finalizeQuestionTime(questionId);
    });
    
    // Cambiar al nuevo grupo
    setCurrentGroupIndex(newGroupIndex);
    
    // Calcular el índice de la primera pregunta del grupo
    let questionIndex = 0;
    for (let i = 0; i < newGroupIndex; i++) {
      questionIndex += questionGroups[i].length;
    }
    setCurrentQuestion(questionIndex);
    
    // Inicializar tiempo de la primera pregunta del nuevo grupo
    const firstQuestionId = questionGroups[newGroupIndex][0].id || questionGroups[newGroupIndex][0].code;
    if (firstQuestionId) initializeQuestionTime(firstQuestionId);
  };

  // Función para formatear tiempo en minutos y segundos
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Inicializar seguimiento de tiempo cuando el examen comienza
  useEffect(() => {
    if (examState === 'active' && examStartTime === 0 && quizData && quizData.questions.length > 0) {
      const now = Date.now();
      setExamStartTime(now);
      // Inicializar la primera pregunta y marcar como alcanzada
      setMaxReachedQuestion(0);
      const firstQuestionId = quizData.questions[0].id || quizData.questions[0].code;
      if (firstQuestionId) {
        initializeQuestionTime(firstQuestionId);
      }
    }
  }, [examState, quizData]);

  // Función para calcular la puntuación
  const calculateScore = (answersToUse?: { [key: string]: string }) => {
    if (!quizData) {
      return {
        correctAnswers: 0,
        totalAnswered: 0,
        totalQuestions: 0,
        percentage: 0,
        overallPercentage: 0
      };
    }

    // Usar las respuestas proporcionadas o el estado answers por defecto
    const answersMap = answersToUse || answers;

    let correctAnswers = 0
    let totalAnswered = 0

    quizData.questions.forEach(question => {
      const questionId = question.id || question.code
      const correctOption = question.options.find(opt => opt.isCorrect)
      const correctAnswer = correctOption?.id || ''
      if (answersMap[questionId]) {
        totalAnswered++
        if (answersMap[questionId] === correctAnswer) {
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
    if (!quizData) return;
    
    setIsSubmitting(true)

    // Finalizar el tiempo de la pregunta actual antes de enviar
    const currentQuestionId = quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code;
    finalizeQuestionTime(currentQuestionId);

    try {
      // Usar answersRef.current para obtener el valor más actualizado
      const currentAnswers = answersRef.current;
      
      const score = calculateScore(currentAnswers)
      const examEndTime = Date.now();
      const totalExamTime = Math.floor((examEndTime - examStartTime) / 1000);

      // DEBUG: Verificar el objeto answers antes de guardar
      console.log('🔍 DEBUG - Objeto answers antes de guardar:', currentAnswers);
      console.log('🔍 DEBUG - Total de respuestas guardadas:', Object.keys(currentAnswers).length);
      console.log('🔍 DEBUG - IDs de preguntas en quizData:', quizData.questions.map(q => ({ id: q.id, code: q.code })));

      const examResult = {
        userId,
        examId: quizData.id,
        examTitle: quizData.title,
        subject: quizData.subject || examConfig.subject, // IMPORTANTE: Incluir el campo subject
        answers: currentAnswers,
        score,
        topic: quizData.questions[currentQuestion]?.topic || '',
        timeExpired,
        lockedByTabChange,
        tabChangeCount,
        startTime: new Date(examStartTime).toISOString(),
        endTime: new Date(examEndTime).toISOString(),
        timeSpent: totalExamTime,
        completed: true,
        phase: quizData.phase,
        // Datos de tiempo por pregunta
        questionTimeTracking: questionTimeData,
        totalExamTimeSeconds: totalExamTime,
        // Detalles por pregunta con tiempo incluido
        questionDetails: quizData.questions.map(question => {
          const correctOption = question.options.find(opt => opt.isCorrect)
          const correctAnswer = correctOption?.id || ''
          const questionId = question.id || question.code
          const userAnswer = currentAnswers[questionId] || null
          
          // DEBUG: Verificar cada pregunta
          if (!userAnswer) {
            console.warn(`⚠️ Pregunta sin respuesta: questionId=${questionId}, question.id=${question.id}, question.code=${question.code}, answers keys:`, Object.keys(currentAnswers));
          }
          
          return {
            questionId: questionId,
            questionText: stripHtmlTags(question.questionText || ''),
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            topic: question.topic,
            isCorrect: userAnswer === correctAnswer,
            answered: !!userAnswer,
            timeSpent: questionTimeData[questionId]?.timeSpent || 0,
          }
        })
      }

      console.log('📤 Guardando en Firebase:', {
        userId,
        examId: quizData.id,
        subject: quizData.subject || examConfig.subject,
        phase: quizData.phase,
        totalAnswers: Object.keys(currentAnswers).length,
        score: score.overallPercentage + '%'
      });

      if (!userId || !quizData.id) {
        throw new Error("Falta userId o quizData.id");
      }
      const result = await saveExamResults(userId, quizData.id, examResult);
      console.log('Examen guardado exitosamente:', result)
      if (result) queryClient.invalidateQueries({ queryKey: EVALUATIONS_QUERY_KEY });

      // Procesar resultados según la fase (análisis, actualización de progreso, etc.)
      if (result && quizData.phase) {
        try {
          const processResult = await processExamResults(
            userId,
            quizData.subject || examConfig.subject,
            quizData.phase,
            examResult
          );
          if (processResult.success) {
            console.log('✅ Resultados procesados exitosamente');
          } else {
            console.error('⚠️ Error procesando resultados:', processResult.error);
          }
        } catch (error) {
          console.error('⚠️ Error al procesar resultados:', error);
        }
      }
      
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

    // Flag para evitar que ambos eventos incrementen el contador duplicadamente
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
          // IMPORTANTE: No establecer examLocked aquí, dejar que handleSubmit lo haga
          // porque handleSubmit verifica examLocked al inicio y retorna si ya está bloqueado
          
          // Intentar múltiples veces para asegurar que la referencia esté disponible
          const attemptFinalize = (attempts = 0) => {
            if (handleSubmitRef.current) {
              // Llamar a handleSubmit que internamente establecerá examLocked
              handleSubmitRef.current(false, true).catch(error => {
                console.error('Error al finalizar examen por cambio de pestaña:', error);
                // Si falla, establecer estados manualmente como fallback
                setExamLocked(true);
                setExamState('completed');
              });
            } else if (attempts < 5) {
              // Si la referencia no está disponible, intentar de nuevo después de un breve delay
              setTimeout(() => attemptFinalize(attempts + 1), 100);
            } else {
              // Si después de varios intentos la referencia no está disponible, forzar la finalización
              console.error('handleSubmitRef no disponible después de varios intentos, finalizando manualmente');
              // Establecer estados y guardar directamente
              setExamLocked(true);
              setShowTabChangeWarning(false);
              setShowFullscreenExit(false);
              
              // Guardar y finalizar directamente
              saveToFirebase(false, true).then(() => {
                setExamState('completed');
                if (isFullscreen) {
                  exitFullscreen();
                }
              }).catch(error => {
                console.error('Error al finalizar examen manualmente:', error);
                setExamState('completed');
              });
            }
          };
          
          // Iniciar el intento de finalización
          setTimeout(() => attemptFinalize(), 50);
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
      if (!examLocked) {
        if (document.hidden) {
          // Cuando se oculta la pestaña, incrementar contador
          handleTabChange();
        } else {
          // Cuando vuelve a la pestaña, verificar si debe mostrarse el modal
          // Usar una verificación con el estado actual
          setTimeout(() => {
            setTabChangeCount(currentCount => {
              if (currentCount === 1) {
                setShowTabChangeWarning(true);
              }
              return currentCount;
            });
          }, 100);
        }
      }
    };

    const handleWindowBlur = () => {
      // Solo procesar si la ventana perdió el foco y no está en pantalla completa
      // y no está bloqueado
      if (!examLocked && !document.hidden) {
        // El blur puede ocurrir sin cambio de pestaña (ej: click en otra ventana)
        // Por eso verificamos también visibilitychange
        // Solo procesar si realmente cambió de pestaña
          setTimeout(() => {
          if (document.hidden && !examLocked) {
            handleTabChange();
          }
          }, 100);
        }
    };

    const handleWindowFocus = () => {
      // El aviso se mantiene visible si hay una advertencia activa y el examen no está bloqueado
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
    if (examState !== 'active' || examLocked) return;

    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;

      const isCurrentlyFullscreen = !!fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (examState === 'active' && !isCurrentlyFullscreen && !examLocked) {
        // Verificar si también se cambió de pestaña
        // Si cambió de pestaña, el listener de visibilitychange ya lo manejará
        // Solo manejar la salida de pantalla completa sin cambio de pestaña
        if (!document.hidden) {
          // Solo salió de pantalla completa (sin cambiar de pestaña)
          setFullscreenExitWithTabChange(false);
          setShowFullscreenExit(true);
        } else {
          // Se salió de pantalla completa Y cambió de pestaña
          // El listener de visibilitychange manejará el cambio de pestaña
          // Solo marcamos que fue con cambio de pestaña para el modal
          setFullscreenExitWithTabChange(true);
          // No incrementamos tabChangeCount aquí porque ya lo hace visibilitychange
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
  }, [examState, examLocked]);

  // Detectar tecla Escape como respaldo
  useEffect(() => {
    if (examState !== 'active' || examLocked) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && examState === 'active' && !examLocked) {
        // Verificar si hay un Select abierto - si es así, no interferir
        const selectContent = document.querySelector('[data-radix-select-content]');
        const selectTrigger = document.querySelector('[data-radix-select-trigger][data-state="open"]');
        
        if (selectContent || selectTrigger) {
          // Hay un Select abierto, no hacer nada para permitir que se cierre normalmente
          return;
        }
        
        // Prevenir la salida automática de pantalla completa
        event.preventDefault();
        
        setTimeout(() => {
          const fullscreenElement =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement;

          if (!fullscreenElement && !examLocked) {
            setIsFullscreen(false);
            
            // Verificar si también se cambió de pestaña
            // Si cambió de pestaña, el listener de visibilitychange ya lo manejará
            if (document.hidden) {
              setFullscreenExitWithTabChange(true);
              // No incrementamos tabChangeCount aquí porque ya lo hace visibilitychange
            } else {
              setFullscreenExitWithTabChange(false);
              setShowFullscreenExit(true);
            }
          } else if (fullscreenElement && !examLocked) {
            // Si aún está en pantalla completa pero se presionó Escape, mostrar advertencia
            setFullscreenExitWithTabChange(false);
            setShowFullscreenExit(true);
          }
        }, 50);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [examState, examLocked]);

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

  const AwaitingValidationScreen = () => {
    if (!quizData) return null;
    return (
      <div className="max-w-2xl mx-auto">
        <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <CardTitle className={cn("text-xl", appTheme === 'dark' ? 'text-white' : '')}>
              Cuestionario listo: {quizData.title}
            </CardTitle>
            <CardDescription className={cn(appTheme === 'dark' ? 'text-gray-400' : '')}>
              Confirma en el servidor si puedes presentar este intento (una consulta al pulsar el botón).
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={validationChecking}
              onClick={() => void runValidationFromSummary()}
              className="text-sm"
            >
              {validationChecking ? 'Comprobando…' : 'Comprobar acceso al examen'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  // Pantalla de carga
  const LoadingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center animate-pulse", appTheme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
              <Database className={cn("h-8 w-8", appTheme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-xl", appTheme === 'dark' ? 'text-white' : '')}>Generando cuestionario...</CardTitle>
          <CardDescription className={cn(appTheme === 'dark' ? 'text-gray-400' : '')}>
            Estamos preparando tu evaluación de {examConfig.subject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla cuando el examen está bloqueado
  const BlockedScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-red-400' : 'text-red-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", appTheme === 'dark' ? 'text-red-400' : 'text-red-800')}>Examen Bloqueado</CardTitle>
          <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : '')}>
            Este examen está bloqueado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-red-300' : 'text-red-800')}>Información</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
              Este examen está bloqueado. Verifica que la fase esté habilitada y que hayas completado la fase anterior.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-500 hover:shadow-lg"
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
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-amber-800' : 'border-amber-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>Examen Ya Presentado</CardTitle>
          <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : '')}>
            Ya has completado este examen anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>Información del Examen</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
              Solo se permite una presentación por examen. Tu intento anterior ya fue registrado.
            </AlertDescription>
          </Alert>

          {existingExamData && (
            <div className={cn("rounded-lg p-4 space-y-3", appTheme === 'dark' ? 'bg-zinc-700/50' : 'bg-gray-50')}>
              <h4 className={cn("font-medium", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>Detalles de tu presentación:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Fecha:</span>
                  <div className={cn("font-medium", appTheme === 'dark' ? 'text-white' : '')}>
                    {new Date(
                      existingExamData.endTime ||
                        (typeof existingExamData.timestamp === 'number' ? existingExamData.timestamp : Date.now())
                    ).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div>
                  <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntuación:</span>
                  <div className={cn("font-medium text-lg", appTheme === 'dark' ? 'text-white' : '')}>
                    {existingExamData.score.correctAnswers}/{existingExamData.score.totalQuestions}
                    <span className={cn("text-sm ml-1", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      ({existingExamData.score.overallPercentage}%)
                    </span>
                  </div>
                </div>
                <div>
                  <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo usado:</span>
                  <div className={cn("font-medium", appTheme === 'dark' ? 'text-white' : '')}>
                    {formatTime(existingExamData.timeSpent || existingExamData.totalExamTimeSeconds || 0)}
                  </div>
                </div>
                <div>
                  <span className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Estado:</span>
                  <div className="font-medium text-green-600">Completado</div>
                </div>
              </div>

              {/* Mostrar tiempo por pregunta si está disponible */}
              {existingExamData.questionTimeTracking && (
                <div className="mt-4">
                  <h5 className={cn("font-medium mb-2", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>Tiempo por pregunta:</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {Object.entries(existingExamData.questionTimeTracking).map(([questionId, timeData]: [string, any]) => (
                      <div key={questionId} className={cn("flex justify-between text-xs", appTheme === 'dark' ? 'text-gray-300' : '')}>
                        <span>Pregunta {questionId}:</span>
                        <span className={cn("font-medium", appTheme === 'dark' ? 'text-white' : '')}>{formatTime(timeData.timeSpent)}</span>
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
            className="bg-purple-600 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-500 hover:shadow-lg"
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
    
    const theme = getQuizTheme('inglés')
    return (
    <div className="max-w-4xl mx-auto relative z-10">
      <Card className={cn(`shadow-xl border-0 backdrop-blur-sm`, appTheme === 'dark' ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-zinc-700' : theme.cardBackground)}>
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
          <CardTitle className={cn("text-3xl font-bold mb-2", appTheme === 'dark' ? 'text-white' : theme.primaryColor)}>
            ¡Bienvenido al examen de {quizData.title}!
          </CardTitle>
          <CardDescription className={cn("text-lg max-w-2xl mx-auto", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            {quizData.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información del examen */}
          <div className="grid md:grid-cols-3 gap-4">
              <div className={cn("rounded-lg p-4 text-center border shadow-sm", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className={cn("font-semibold", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{quizData.questions.length * 2} minutos</div>
                <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tiempo límite</div>
              </div>
            <div className={cn("rounded-lg p-4 text-center border shadow-sm", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <div className={cn("font-semibold", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{quizData.totalQuestions} preguntas</div>
              <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total de preguntas</div>
            </div>
            <div className={cn("rounded-lg p-4 text-center border shadow-sm", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <div className={cn("font-semibold", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>Opción múltiple</div>
              <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tipo de pregunta</div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className={cn("rounded-lg p-6 border shadow-sm", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
            <h3 className={cn("text-lg font-semibold mb-4 flex items-center gap-2", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Instrucciones importantes
            </h3>
            <ul className="space-y-3">
              {quizData.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <span className={cn(appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Advertencia antitrampa */}
          <Alert className={cn(appTheme === 'dark' ? 'border-orange-800 bg-orange-900/30' : 'border-orange-200 bg-orange-50')}>
            <Shield className="h-4 w-4 text-orange-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>Antitrampa</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-orange-200' : 'text-orange-700')}>
              Responde de manera sincera para que puedas tener una mejora Real y puedas mejorar tu puntaje.
            </AlertDescription>
          </Alert>

          {/* Advertencia general */}
          <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>¡Importante!</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
              Una vez que inicies el examen, el cronómetro comenzará a correr. Asegúrate de tener una conexión estable a internet y un ambiente tranquilo para concentrarte.
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex justify-center pt-6">
          <Button
            onClick={startExam}
            size="lg"
            className={`${theme.buttonGradient} ${theme.buttonHover} text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300`}
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
  const TabChangeWarningModal = () => {
    // No mostrar el modal si el examen está bloqueado o ya se alcanzó el límite
    if (examLocked || tabChangeCount >= 2) {
      return null;
    }

    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className={cn("w-full max-w-md mx-4", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-xl", appTheme === 'dark' ? 'text-orange-400' : 'text-orange-800')}>¡Advertencia!</CardTitle>
          <CardDescription className={cn("text-base", appTheme === 'dark' ? 'text-gray-400' : '')}>
            Cambio de pestaña detectado
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className={cn("rounded-lg p-4 mb-4", appTheme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-50')}>
            <div className={cn("text-sm mb-1", appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>Intento de fraude detectado</div>
              <div className={cn("text-2xl font-bold", appTheme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>{tabChangeCount}</div>
          </div>
          <p className={cn("mb-2", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            Has cambiado de pestaña o perdido el foco de la ventana del examen.
          </p>
          <p className={cn("text-sm font-medium", appTheme === 'dark' ? 'text-red-400' : 'text-red-600')}>
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
            className={cn("w-full border-red-300 text-red-600 hover:bg-red-50", appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
          >
            <X className="h-4 w-4 mr-2" />
            Finalizar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
    );
  }

  // Modal de salida de pantalla completa
  const FullscreenExitModal = () => {
    const hasTabChange = fullscreenExitWithTabChange;
    const isLastWarning = tabChangeCount >= 1;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className={cn("w-full max-w-md mx-4", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center",
                hasTabChange && isLastWarning ? (appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100') :
                hasTabChange ? (appTheme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100') :
                (appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')
              )}>
                <Maximize className={cn(
                  "h-8 w-8",
                  hasTabChange && isLastWarning ? (appTheme === 'dark' ? 'text-red-400' : 'text-red-600') :
                  hasTabChange ? (appTheme === 'dark' ? 'text-orange-400' : 'text-orange-600') :
                  (appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600')
                )} />
              </div>
            </div>
            <CardTitle className={cn(
              "text-xl",
              hasTabChange && isLastWarning ? (appTheme === 'dark' ? 'text-red-400' : 'text-red-800') :
              hasTabChange ? (appTheme === 'dark' ? 'text-orange-400' : 'text-orange-800') :
              (appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800')
            )}>
              {hasTabChange && isLastWarning 
                ? '¡Advertencia Final!' 
                : hasTabChange 
                ? 'Salida de Pantalla Completa y Cambio de Pestaña'
                : 'Salida de Pantalla Completa'}
            </CardTitle>
            <CardDescription className={cn("text-base", appTheme === 'dark' ? 'text-gray-400' : '')}>
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
                <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className={cn("font-bold", appTheme === 'dark' ? 'text-red-300' : 'text-red-800')}>¡Último Aviso!</AlertTitle>
                  <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
                    Si vuelves a salir de pantalla completa y cambiar de pestaña, el examen se finalizará automáticamente.
                  </AlertDescription>
                </Alert>
                <p className={cn("font-medium", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : hasTabChange ? (
              <>
                <Alert className={cn(appTheme === 'dark' ? 'border-orange-800 bg-orange-900/30' : 'border-orange-200 bg-orange-50')}>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className={cn(appTheme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>Advertencia</AlertTitle>
                  <AlertDescription className={cn(appTheme === 'dark' ? 'text-orange-200' : 'text-orange-700')}>
                    Has cambiado de pestaña, lo cual se considera intento de fraude y quedará registrado. Será notificado al acudiente. ⚠️ Esta es tu primera advertencia. Si lo vuelves a hacer, el examen se finalizará automáticamente.
                  </AlertDescription>
                </Alert>
                <p className={cn(appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : (
              <>
                <p className={cn("mb-4", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  El examen solo se realiza en pantalla completa, vuelve al modo de pantalla completa o se registrará como intento de fraude.
                </p>
                <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
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
              className={cn("w-full border-red-300 text-red-600 hover:bg-red-50", appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
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
  const handleSubmit = useCallback(async (timeExpired = false, lockedByTabChange = false) => {
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
  }, [examLocked, examState, isFullscreen])
  
  // Actualizar la referencia a handleSubmit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Función para manejar el cambio de respuesta
  const handleAnswerChange = (questionId: string, answer: string) => {
    console.log('🔵 handleAnswerChange llamado:', { questionId, answer });
    setAnswers(prev => {
      // Solo actualizar si el valor realmente cambió
      if (prev[questionId] === answer) {
        return prev;
      }
      const newAnswers = {
        ...prev,
        [questionId]: answer
      };
      // Actualizar también la ref
      answersRef.current = newAnswers;
      console.log('🔵 Respuesta guardada en answers:', { questionId, answer, totalAnswers: Object.keys(newAnswers).length });
      return newAnswers;
    });
  }
  
  // Sincronizar answersRef con answers cuando cambia
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Función para ir a la siguiente pregunta o grupo
  const nextQuestion = () => {
    if (!quizData) return;
    
    // Para inglés, navegar entre grupos
    if (quizData.subject === 'Inglés' && questionGroups.length > 0) {
      if (currentGroupIndex < questionGroups.length - 1) {
        const nextGroupIndex = currentGroupIndex + 1;
        // Calcular el índice de pregunta correspondiente
        let nextQuestionIndex = 0;
        for (let i = 0; i < nextGroupIndex; i++) {
          nextQuestionIndex += questionGroups[i].length;
        }
        // Actualizar maxReachedQuestion
        if (nextQuestionIndex > maxReachedQuestion) {
          setMaxReachedQuestion(nextQuestionIndex);
        }
        // Usar la función interna para cambiar de grupo (no bloqueada)
        internalChangeGroup(nextGroupIndex);
      }
    } else {
      // Para otras materias, navegar entre preguntas individuales
      if (currentQuestion < quizData.questions.length - 1) {
        const nextIndex = currentQuestion + 1;
        // Actualizar maxReachedQuestion cuando se avanza con el botón siguiente
        if (nextIndex > maxReachedQuestion) {
          setMaxReachedQuestion(nextIndex);
        }
        // Usar la función interna para cambiar de pregunta (no bloqueada)
        internalChangeQuestion(nextIndex);
      }
    }
  }
  
  // Función para saltar pregunta/grupo (No sé)
  const handleSkipQuestion = () => {
    // No guardamos ninguna respuesta, simplemente avanzamos a la siguiente pregunta/grupo
    nextQuestion();
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

  // Pantalla cuando no hay preguntas disponibles
  const NoQuestionsScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-red-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-800">No hay preguntas disponibles</CardTitle>
          <CardDescription className="text-lg">
            No se encontraron preguntas para este cuestionario en este momento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Información</AlertTitle>
            <AlertDescription className="text-red-700">
              Por favor, contacta al administrador o intenta más tarde.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-500 hover:shadow-lg"
          >
            Volver al Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Pantalla de examen completado
  const CompletedScreen = () => {
    if (!quizData) return null;
    
    const score = calculateScore()

    return (
      <div className="max-w-4xl mx-auto">
        <Card className={cn("shadow-lg border-0", appTheme === 'dark' ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-blue-50')}>
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className={cn("text-3xl font-bold mb-2", appTheme === 'dark' ? 'text-green-400' : 'text-green-800')}>
              ¡Examen Completado!
            </CardTitle>
            <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Tus respuestas han sido guardadas exitosamente
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Resultados principales */}
            <div className={cn("rounded-lg p-6 border shadow-sm", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <h3 className={cn("text-xl font-semibold mb-4 text-center", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Resultados del Examen
              </h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {score.correctAnswers}
                  </div>
                  <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuestas correctas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Preguntas respondidas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {score.overallPercentage}%
                  </div>
                  <div className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Puntuación final</div>
                </div>
              </div>
              <Progress
                value={score.overallPercentage}
                className="h-3 mb-2"
              />
              <div className={cn("text-center text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Progreso: {score.overallPercentage}% del total
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center pt-6">
            <Button
              onClick={() => navigate('/dashboard')}
              size="lg"
              className="bg-green-600 hover:bg-gradient-to-r hover:from-green-600 hover:to-blue-500 hover:shadow-lg text-white px-8 py-3 text-lg font-semibold transition-all duration-300"
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
    
    const answeredQuestions = Object.keys(answers).length
    const theme = getQuizTheme('inglés')

    // Para inglés con grupos, mostrar todas las preguntas del grupo actual juntas
    const isEnglishWithGroups = quizData.subject === 'Inglés' && questionGroups.length > 0;
    
    // Obtener las preguntas del grupo actual o la pregunta actual
    const currentGroupQuestions = isEnglishWithGroups && questionGroups[currentGroupIndex] 
      ? questionGroups[currentGroupIndex] 
      : [quizData.questions[currentQuestion]];
    
    // Obtener el contenido informativo del grupo (de la primera pregunta)
    const firstGroupQuestion = currentGroupQuestions[0];
    const hasInformativeContent = firstGroupQuestion?.informativeText && 
                                   firstGroupQuestion.informativeText.trim() !== '';
    
    // Detectar si es Cloze Test (alguna pregunta tiene "completar el hueco" en el questionText)
    const isClozeTest = currentGroupQuestions.some(q => 
      q.questionText && q.questionText.includes('completar el hueco')
    );
    
    // Detectar si es Matching Columns (el informativeText tiene MATCHING_COLUMNS_)
    const isMatchingColumns = firstGroupQuestion?.informativeText && 
                               typeof firstGroupQuestion.informativeText === 'string' &&
                               (firstGroupQuestion.informativeText.startsWith('MATCHING_COLUMNS_') || 
                                firstGroupQuestion.informativeText.includes('MATCHING_COLUMNS_'));
    
    // Función para extraer el texto real de matching columns
    const extractMatchingText = (informativeText: string): string => {
      if (!informativeText) return '';
      if (informativeText.includes('|')) {
        const parts = informativeText.split('|');
        return parts.slice(1).join('|'); // Todo después del primer |
      }
      return ''; // Si solo tiene el identificador sin texto, retornar vacío
    };

    return (
      <div 
        className={cn("flex flex-col lg:flex-row gap-6 min-h-screen pt-2 px-8 pb-4 quiz-gradient-bg relative", appTheme === 'dark' ? 'bg-zinc-900' : '')}
        style={appTheme === 'dark' ? {} : getQuizBackgroundStyle(theme)}
      >
        {/* Contenido principal del examen */}
        <div className="flex-1 relative z-10">
          <div className={cn(`${theme.cardBackground} border rounded-lg p-3 mb-2 shadow-lg backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden">
                  <BookCheck className="w-12 h-12 text-emerald-500" />
                </div>
                <div>
                  <h3 className={cn("text-xs font-medium", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estás realizando:</h3>
                  <h2 className={cn("text-base font-normal", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{quizData.title}</h2>
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

          <Card className={cn(`mb-6 ${theme.cardBackground} shadow-xl backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                {isEnglishWithGroups ? (
                  <CardTitle className={cn(`text-lg font-normal`, appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    Grupo {currentGroupIndex + 1} de {questionGroups.length} 
                    {currentGroupQuestions.length > 1 && ` (${currentGroupQuestions.length} preguntas)`}
                  </CardTitle>
                ) : (
                  <CardTitle className={cn(`text-lg font-normal`, appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    Pregunta {currentQuestion + 1}
                  </CardTitle>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none">
                {/* Mostrar contenido informativo (texto e imágenes) para preguntas agrupadas */}
                {hasInformativeContent && firstGroupQuestion && (
                  <div className={cn("mb-6 p-4 rounded-lg border-2", appTheme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-blue-50 border-blue-200')}>
                    <h3 className={cn("text-lg font-semibold mb-3", appTheme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                      Lea la siguiente información antes de responder:
                    </h3>
                    
                    {/* Imágenes informativas */}
                    {firstGroupQuestion.informativeImages && firstGroupQuestion.informativeImages.length > 0 && (
                      <div className="mb-4">
                        <ImageGallery 
                          images={firstGroupQuestion.informativeImages} 
                          title="Imágenes informativas" 
                          maxImages={5}
                        />
                      </div>
                    )}
                    
                    {/* Texto informativo - mostrar de forma especial si es Cloze Test o Matching Columns */}
                    {isClozeTest ? (
                      (() => {
                        const clozeText = firstGroupQuestion.informativeText || '';
                        // Extraer texto plano para detectar marcadores
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = clozeText;
                        const text = tempDiv.textContent || tempDiv.innerText || '';
                        const gapMatches = text.match(/\[(\d+)\]/g) || [];
                        const gaps = new Set<number>();
                        gapMatches.forEach(match => {
                          const num = parseInt(match.replace(/[\[\]]/g, ''));
                          gaps.add(num);
                        });
                        
                        // Crear un mapeo de hueco número a pregunta y opciones
                        const gapQuestionMap: { [key: number]: { question: Question; options: typeof firstGroupQuestion.options } } = {};
                        currentGroupQuestions.forEach(q => {
                          const match = q.questionText?.match(/hueco \[(\d+)\]/);
                          if (match) {
                            const gapNum = parseInt(match[1]);
                            gapQuestionMap[gapNum] = {
                              question: q,
                              options: q.options || []
                            };
                          }
                        });
                        
                        // Dividir el texto en partes usando los marcadores de hueco
                        const sortedGaps = Array.from(gaps).sort((a, b) => a - b);
                        const parts: Array<{ type: 'text' | 'gap'; content: string; gapNum?: number }> = [];
                        let remainingText = clozeText;
                        
                        sortedGaps.forEach((gapNum) => {
                          const gapMarker = `[${gapNum}]`;
                          const splitIndex = remainingText.indexOf(gapMarker);
                          if (splitIndex >= 0) {
                            if (splitIndex > 0) {
                              parts.push({ type: 'text', content: remainingText.substring(0, splitIndex) });
                            }
                            parts.push({ type: 'gap', content: gapMarker, gapNum });
                            remainingText = remainingText.substring(splitIndex + gapMarker.length);
                          }
                        });
                        if (remainingText) {
                          parts.push({ type: 'text', content: remainingText });
                        }
                        
                        return (
                          <div 
                            className={cn("text-base leading-relaxed", appTheme === 'dark' ? 'text-gray-200' : 'text-gray-800')}
                          >
                            {parts.map((part, idx) => {
                              if (part.type === 'text') {
                                // Renderizar texto manteniendo el flujo inline
                                return (
                                  <span 
                                    key={`text-${idx}`} 
                                    className="inline"
                                    dangerouslySetInnerHTML={{ __html: part.content }} 
                                  />
                                );
                              } else {
                                const gapNum = part.gapNum!;
                                const gapData = gapQuestionMap[gapNum];
                                if (!gapData) return null;
                                
                                const question = gapData.question;
                                const options = gapData.options;
                                const questionId = question.id || question.code;
                                const selectedAnswer = answers[questionId] || '';
                                const isOpen = openSelects[questionId] || false;
                                
                                return (
                                  <span 
                                    key={`gap-${gapNum}`} 
                                    className="inline-flex items-center gap-1 mx-0 my-0 align-middle"
                                  >
                                    <Select
                                      value={selectedAnswer || undefined}
                                      open={isOpen}
                                      onOpenChange={(open) => {
                                        if (open) {
                                          // Abrir está siempre permitido
                                          setOpenSelects(prev => ({ ...prev, [questionId]: true }));
                                        } else {
                                          // Para cerrar, verificar si es intencional
                                          // Si no es intencional (por ejemplo, un re-render), mantener abierto
                                          if (intentionalCloseRef.current[questionId]) {
                                            setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                            intentionalCloseRef.current[questionId] = false;
                                          }
                                          // Si no es intencional, simplemente no hacer nada (mantener el estado actual)
                                        }
                                      }}
                                      onValueChange={(value) => {
                                        handleAnswerChange(questionId, value);
                                        // Marcar como cierre intencional y cerrar el dropdown después de seleccionar
                                        intentionalCloseRef.current[questionId] = true;
                                        setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                      }}
                                    >
                                      <SelectTrigger 
                                        className={cn(
                                          "h-8 px-3 text-xs font-semibold border-2 min-w-[100px] max-w-[250px] inline-flex",
                                          appTheme === 'dark' 
                                            ? 'bg-zinc-700 hover:bg-zinc-600 border-blue-500 text-blue-300' 
                                            : 'bg-white hover:bg-gray-100 border-blue-400 text-blue-700',
                                          // Deshabilitar animaciones que pueden causar intermitencia
                                          "!transition-none hover:!scale-100"
                                        )}
                                      >
                                        <SelectValue placeholder={`[${gapNum}]`} />
                                      </SelectTrigger>
                                      <SelectContent 
                                        className={cn(
                                          "!max-h-none overflow-visible [&_[data-radix-select-viewport]]:!h-auto [&_[data-radix-select-viewport]]:!max-h-none",
                                          "[&>button]:hidden", // Ocultar botones de scroll
                                          appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200',
                                          // Deshabilitar animaciones que pueden causar intermitencia
                                          "!animate-none !transition-none"
                                        )}
                                        style={{ zIndex: 99999 }}
                                        onPointerDownOutside={(e) => {
                                          const target = e.target as HTMLElement;
                                          
                                          // Verificar si el click es dentro del SelectContent o su portal
                                          // Radix UI renderiza el contenido en un portal, así que verificamos el atributo data-radix-select-content
                                          const selectContent = target.closest('[data-radix-select-content]');
                                          const selectViewport = target.closest('[data-radix-select-viewport]');
                                          const selectItem = target.closest('[data-radix-select-item]');
                                          
                                          if (selectContent || selectViewport || selectItem) {
                                            // Prevenir el cierre si está dentro del dropdown o sus elementos
                                            e.preventDefault();
                                            return;
                                          }
                                          
                                          // Verificar si el click es en el contenedor del texto Cloze Test
                                          const textContainer = target.closest('.text-base.leading-relaxed');
                                          if (textContainer) {
                                            // Prevenir el cierre si está dentro del área de texto
                                            e.preventDefault();
                                            return;
                                          }
                                          
                                          // Si el click es fuera, marcar como cierre intencional y permitir el cierre
                                          intentionalCloseRef.current[questionId] = true;
                                          setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                        }}
                                        onEscapeKeyDown={() => {
                                          // Marcar como cierre intencional y cerrar el dropdown cuando se presiona Escape
                                          intentionalCloseRef.current[questionId] = true;
                                          setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                        }}
                                        position="popper"
                                        sideOffset={5}
                                        avoidCollisions={true}
                                      >
                                        {options.length > 0 ? (
                                          options.map((option) => (
                                            <SelectItem 
                                              key={option.id} 
                                              value={option.id}
                                              className="!transition-none hover:!scale-100 hover:!translate-y-0 hover:!shadow-none data-[highlighted]:!scale-100 data-[highlighted]:!translate-y-0 data-[highlighted]:!shadow-none [&>div]:!opacity-0 [&>div]:!animate-none"
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
                                );
                              }
                            })}
                          </div>
                        );
                      })()
                    ) : isMatchingColumns ? (
                      /* Mostrar solo el texto informativo para Matching Columns (las preguntas se mostrarán abajo) */
                      (() => {
                        const displayText = extractMatchingText(firstGroupQuestion.informativeText || '');
                        if (!displayText || !displayText.trim()) return null;
                        
                        return (
                          <div 
                            className={cn("text-base leading-relaxed", appTheme === 'dark' ? 'text-gray-200' : 'text-gray-800')}
                            dangerouslySetInnerHTML={{ __html: displayText }} 
                          />
                        );
                      })()
                    ) : (
                      /* Texto informativo normal para comprensión de lectura */
                      <div 
                        className={cn("text-base leading-relaxed whitespace-pre-wrap", appTheme === 'dark' ? 'text-gray-200' : 'text-gray-800')}
                        dangerouslySetInnerHTML={{ __html: firstGroupQuestion.informativeText || '' }} 
                      />
                    )}
                  </div>
                )}

                {/* Mostrar todas las preguntas del grupo - solo si NO es Cloze Test */}
                {!isClozeTest && (
                  <div className="space-y-4">
                    {isMatchingColumns ? (
                      /* Formato especial para Matching Columns: dos columnas */
                      currentGroupQuestions.map((question, qIndex) => {
                        const questionId = question.id || question.code;
                        const selectedAnswer = answers[questionId] || '';
                        const isOpen = openSelects[questionId] || false;
                        
                        return (
                          <div 
                            key={question.id || question.code || qIndex} 
                            className={cn("border rounded-lg overflow-hidden", appTheme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                              {/* Columna izquierda: Descripción/Pregunta */}
                              <div className={cn("p-4 border-r", appTheme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200')}>
                                <div className={cn("leading-relaxed text-base font-medium", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {question.questionText && (
                                    <div
                                      className="prose prose-base max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.questionText }} 
                                    />
                                  )}
                                </div>
                              </div>
                              
                              {/* Columna derecha: Selector de respuesta */}
                              <div 
                                className={cn("p-4 flex items-center", appTheme === 'dark' ? 'bg-zinc-800' : 'bg-white')}
                              >
                                <Select
                                  value={selectedAnswer || undefined}
                                  open={isOpen}
                                  onOpenChange={(open) => {
                                    if (open) {
                                      // Abrir está siempre permitido
                                      setOpenSelects(prev => ({ ...prev, [questionId]: true }));
                                    } else {
                                      // Para cerrar, verificar si es intencional
                                      // Si no es intencional (por ejemplo, un re-render), mantener abierto
                                      if (intentionalCloseRef.current[questionId]) {
                                        setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                        intentionalCloseRef.current[questionId] = false;
                                      }
                                      // Si no es intencional, simplemente no hacer nada (mantener el estado actual)
                                    }
                                  }}
                                  onValueChange={(value) => {
                                    handleAnswerChange(questionId, value);
                                    // Marcar como cierre intencional y cerrar el dropdown después de seleccionar
                                    intentionalCloseRef.current[questionId] = true;
                                    setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                  }}
                                >
                                  <SelectTrigger 
                                    className={cn(
                                      "w-full h-auto p-3 text-sm font-medium",
                                      appTheme === 'dark' 
                                        ? 'bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-white' 
                                        : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-900',
                                      // Deshabilitar animaciones que pueden causar intermitencia
                                      "!transition-none hover:!scale-100"
                                    )}
                                  >
                                    <SelectValue placeholder="Ver Opciones de Respuesta" />
                                  </SelectTrigger>
                                  <SelectContent 
                                    className={cn(
                                      "!max-h-none overflow-visible [&_[data-radix-select-viewport]]:!h-auto [&_[data-radix-select-viewport]]:!max-h-none",
                                      "[&>button]:hidden", // Ocultar botones de scroll
                                      appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200',
                                      // Deshabilitar animaciones que pueden causar intermitencia
                                      "!animate-none !transition-none [&>div]:!animate-none [&>div]:!transition-none"
                                    )}
                                    style={{ zIndex: 99999 }}
                                    position="popper"
                                    sideOffset={5}
                                    avoidCollisions={true}
                                    onPointerDownOutside={(e) => {
                                      const target = e.target as HTMLElement;
                                      
                                      // Verificar si el click es dentro del SelectContent o su portal
                                      // Radix UI renderiza el contenido en un portal, así que verificamos el atributo data-radix-select-content
                                      const selectContent = target.closest('[data-radix-select-content]');
                                      const selectViewport = target.closest('[data-radix-select-viewport]');
                                      const selectItem = target.closest('[data-radix-select-item]');
                                      
                                      if (selectContent || selectViewport || selectItem) {
                                        // Prevenir el cierre si está dentro del dropdown o sus elementos
                                        e.preventDefault();
                                        return;
                                      }
                                      
                                      // Si el click es fuera, marcar como cierre intencional y permitir el cierre
                                      intentionalCloseRef.current[questionId] = true;
                                      setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                    }}
                                    onEscapeKeyDown={() => {
                                      // Marcar como cierre intencional y cerrar el dropdown cuando se presiona Escape
                                      intentionalCloseRef.current[questionId] = true;
                                      setOpenSelects(prev => ({ ...prev, [questionId]: false }));
                                    }}
                                  >
                                    {question.options && question.options.length > 0 ? (
                                      question.options.map((option) => (
                                        <SelectItem 
                                          key={option.id} 
                                          value={option.id}
                                          className={cn(
                                            "!transition-none !transform-none hover:!scale-100 hover:!translate-y-0 hover:!shadow-none hover:!transform-none",
                                            "data-[highlighted]:!scale-100 data-[highlighted]:!translate-y-0 data-[highlighted]:!shadow-none data-[highlighted]:!transform-none",
                                            "data-[state=checked]:!scale-100 data-[state=checked]:!translate-y-0 data-[state=checked]:!transform-none",
                                            "[&>div]:!opacity-0 [&>div]:!animate-none [&>div]:!transition-none",
                                            "cursor-pointer", // Asegurar que el cursor indique que es clickeable
                                            appTheme === 'dark' 
                                              ? 'hover:!bg-zinc-700 data-[highlighted]:!bg-zinc-700 focus:!bg-zinc-700' 
                                              : 'hover:!bg-gray-100 data-[highlighted]:!bg-gray-100 focus:!bg-gray-100'
                                          )}
                                          onPointerDown={(e) => {
                                            // Prevenir que el evento se propague y cause problemas
                                            e.stopPropagation();
                                          }}
                                        >
                                          <div className="flex items-center gap-2 w-full pointer-events-none">
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
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* Formato normal para comprensión de lectura */
                      currentGroupQuestions.map((question, qIndex) => (
                        <div key={question.id || question.code || qIndex} className="border-b border-gray-200 dark:border-zinc-700 pb-6 last:border-b-0 last:pb-0">
                          {/* Imágenes de la pregunta individual */}
                          {question.questionImages && question.questionImages.length > 0 && (
                            <div className="mb-4">
                              <ImageGallery images={question.questionImages} title="Imágenes de la pregunta" maxImages={3} />
                            </div>
                          )}
                          
                          {/* Número de pregunta dentro del grupo */}
                          {currentGroupQuestions.length > 1 && (
                            <div className={cn("text-sm font-semibold mb-2", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              Pregunta {qIndex + 1} de {currentGroupQuestions.length}:
                            </div>
                          )}
                          
                          {/* Texto de la pregunta */}
                          {question.questionText && (
                            <p className={cn("leading-relaxed mb-4", appTheme === 'dark' ? 'text-white' : 'text-gray-900')} dangerouslySetInnerHTML={{ __html: question.questionText }} />
                          )}
                          
                          {/* Opciones de respuesta */}
                          <RadioGroup
                            value={answers[question.id || question.code] || ""}
                            onValueChange={(value) => handleAnswerChange(question.id || question.code, value)}
                            className="space-y-0.5"
                          >
                            {question.options.map((option) => {
                              const questionId = question.id || question.code;
                              return (
                              <div
                                key={option.id}
                                onClick={() => handleAnswerChange(questionId, option.id)}
                                className={cn(
                                  `flex items-start space-x-3 rounded-lg p-4 transition-none relative cursor-pointer`,
                                  appTheme === 'dark' 
                                    ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/90 border' 
                                    : `${theme.answerBorder} ${theme.answerBackground} hover:bg-opacity-60`
                                )}
                                style={appTheme === 'dark' ? {} : (theme.pattern ? { 
                                  backgroundImage: theme.pattern,
                                  backgroundSize: '100% 100%'
                                } : {})}
                              >
                                <RadioGroupItem
                                  value={option.id}
                                  id={`${questionId}-${option.id}`}
                                  className="mt-1 relative z-10"
                                />
                                <Label
                                  htmlFor={`${questionId}-${option.id}`}
                                  className="flex-1 cursor-pointer relative z-10"
                                >
                                  <span className={cn(`font-bold mr-2 text-base flex-shrink-0`, appTheme === 'dark' ? 'text-purple-400' : theme.primaryColor)}>{option.id.toUpperCase()}.</span>
                                  <span className={cn(`text-base leading-relaxed`, appTheme === 'dark' ? 'text-gray-300' : theme.answerText)}>{option.text || ''}</span>
                                </Label>
                              </div>
                              );
                            })}
                          </RadioGroup>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                onClick={handleSkipQuestion}
                disabled={isEnglishWithGroups ? currentGroupIndex === questionGroups.length - 1 : currentQuestion === quizData.questions.length - 1}
                variant="outline"
                className={cn("flex items-center gap-2 focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent hover:border-inherit hover:text-inherit", appTheme === 'dark' ? 'border-gray-600 text-gray-300 dark:hover:bg-transparent dark:hover:border-gray-600 dark:hover:text-gray-300' : 'border-gray-300 text-gray-700 hover:border-gray-300 hover:text-gray-700')}
              >
                <HelpCircle className="h-4 w-4" />
                No sé
              </Button>
              <Button
                onClick={() => {
                  const isLastGroup = isEnglishWithGroups ? currentGroupIndex === questionGroups.length - 1 : currentQuestion === quizData.questions.length - 1;
                  if (isLastGroup) {
                    showSubmitWarning();
                  } else {
                    nextQuestion();
                  }
                }}
                disabled={
                  isSubmitting ||
                  (isEnglishWithGroups 
                    ? !currentGroupQuestions.some(q => answers[q.id || q.code])
                    : !answers[quizData.questions[currentQuestion].id || quizData.questions[currentQuestion].code])
                }
                variant="outline"
                className={cn("flex items-center gap-2 !transition-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-transparent hover:border-inherit hover:text-inherit", appTheme === 'dark' ? 'border-gray-600 text-gray-300 dark:hover:bg-transparent dark:hover:border-gray-600 dark:hover:text-gray-300' : 'border-gray-300 text-gray-700 hover:border-gray-300 hover:text-gray-700')}
                style={{ transition: 'none' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transition = 'background-color 150ms ease-in-out';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transition = 'none';
                }}
              >
                {(isEnglishWithGroups ? currentGroupIndex === questionGroups.length - 1 : currentQuestion === quizData.questions.length - 1) ? (
                  isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>Finalizar examen <ChevronRight className="h-4 w-4" /></>
                  )
                ) : (
                  <>Siguiente <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Panel lateral derecho con navegación de preguntas */}
        <div className="w-full lg:w-56 flex-shrink-0 relative z-10">
          <div className={cn(`${theme.cardBackground} border rounded-lg p-3 sticky top-4 shadow-lg backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <h3 className={cn("text-xs font-semibold mb-2.5 uppercase tracking-wide", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              {isEnglishWithGroups ? 'Navegación por Grupos' : 'Navegación'}
            </h3>
            {isEnglishWithGroups && questionGroups.length > 0 ? (
              <div className="space-y-2 pb-2">
                {questionGroups.map((group, groupIndex) => {
                  // Calcular índice de la primera pregunta del grupo
                  let firstQuestionIndex = 0;
                  for (let i = 0; i < groupIndex; i++) {
                    firstQuestionIndex += questionGroups[i].length;
                  }
                  
                  // Verificar si todas las preguntas del grupo están respondidas
                  const allAnswered = group.every(q => {
                    const questionId = q.id || q.code;
                    return answers[questionId];
                  });
                  
                  // Verificar si alguna pregunta del grupo está respondida
                  const someAnswered = group.some(q => {
                    const questionId = q.id || q.code;
                    return answers[questionId];
                  });
                  
                  const isCurrent = currentGroupIndex === groupIndex;
                  
                  return (
                    <button
                      key={groupIndex}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // BLOQUEAR TODOS los clics - los botones son SOLO marcadores visuales
                        return false;
                      }}
                      className={cn(
                        "w-full p-3 rounded-md flex flex-col items-start text-xs font-semibold transition-all duration-200 cursor-not-allowed border-2",
                        isCurrent
                          ? allAnswered
                            ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-2 ring-purple-400 ring-offset-1 border-purple-400"
                            : "bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-2 ring-purple-300 ring-offset-1 border-purple-300"
                          : allAnswered
                          ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm hover:shadow-md border-purple-500"
                          : someAnswered
                          ? appTheme === 'dark' 
                            ? "bg-zinc-700 text-gray-300 border-zinc-600 hover:bg-zinc-600 border-amber-500/50" 
                            : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                          : appTheme === 'dark' 
                          ? "bg-zinc-700 text-gray-300 border-zinc-600 hover:bg-zinc-600 hover:border-purple-500" 
                          : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-purple-300"
                      )}
                      title={`Grupo ${groupIndex + 1} (${group.length} pregunta${group.length > 1 ? 's' : ''})${allAnswered ? " - Completado" : someAnswered ? " - Parcialmente respondido" : " - Sin responder"} - Solo marcador visual`}
                      onMouseDown={(e) => {
                        // Prevenir cualquier acción - los botones son solo marcadores visuales
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold">Grupo {groupIndex + 1}</span>
                        {allAnswered && !isCurrent && (
                          <CheckCircle2 className="h-4 w-4 text-green-300" />
                        )}
                      </div>
                      <span className={cn("text-xs", isCurrent ? 'text-white/90' : appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {group.length} pregunta{group.length > 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {quizData.questions.map((q, index) => {
                  const questionId = q.id || q.code
                  const isAnswered = answers[questionId];
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
                      className={cn(
                        "relative h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-200 cursor-not-allowed",
                        isCurrent
                          ? isAnswered
                            ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-1 ring-purple-400 scale-110"
                            : "bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-1 ring-purple-300 scale-110"
                          : isAnswered
                          ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm"
                          : (appTheme === 'dark' ? "bg-zinc-700 text-gray-300 border border-zinc-600" : "bg-gray-100 text-gray-600 border border-gray-300")
                      )}
                      title={`Pregunta ${index + 1}${isAnswered ? " - Respondida" : " - Sin responder"} - Solo marcador visual`}
                      onMouseDown={(e) => {
                        // Prevenir cualquier acción - los botones son solo marcadores visuales
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      {index + 1}
                      {isAnswered && !isCurrent && (
                        <CheckCircle2 className={cn("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-green-500 rounded-full", appTheme === 'dark' ? 'bg-zinc-800' : 'bg-white')} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className={cn("mt-3 pt-3 border-t", appTheme === 'dark' ? 'border-zinc-700' : '')}>
              <div className={cn("text-xs mb-1.5 font-medium", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Progreso del examen</div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn("text-xs font-semibold", appTheme === 'dark' ? 'text-white' : '')}>
                  {answeredQuestions}/{quizData.questions.length}
                </span>
                <span className={cn("text-xs", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {Math.round((answeredQuestions / quizData.questions.length) * 100)}%
                </span>
              </div>
              <Progress value={(answeredQuestions / quizData.questions.length) * 100} className="h-1.5 mb-3" />

              <Button
                onClick={showSubmitWarning}
                disabled={isSubmitting}
                size="sm"
                className={`w-full ${theme.buttonGradient} ${theme.buttonHover} text-white shadow-lg text-xs py-2`}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Enviando...
                  </>
                ) : (
                  'Finalizar examen'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Modal de confirmación de envío
  const SubmitWarningModal = () => {
    if (!quizData) return null;
    
    const score = calculateScore()
    const unanswered = quizData.questions.length - score.totalAnswered

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className={cn("w-full max-w-md mx-4", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
                <Send className={cn("h-8 w-8", appTheme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              </div>
            </div>
            <CardTitle className={cn("text-xl", appTheme === 'dark' ? 'text-blue-400' : 'text-blue-800')}>
              ¿Enviar Examen?
            </CardTitle>
            <CardDescription className={cn("text-base", appTheme === 'dark' ? 'text-gray-400' : '')}>
              Confirma que deseas enviar tus respuestas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("rounded-lg p-4", appTheme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className={cn(appTheme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>Respondidas</div>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    {unanswered}
                  </div>
                  <div className={cn(appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Sin responder</div>
                </div>
              </div>
            </div>

            {unanswered > 0 && (
              <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                  Tienes {unanswered} pregunta{unanswered > 1 ? 's' : ''} sin responder.
                  Estas se contarán como incorrectas.
                </AlertDescription>
              </Alert>
            )}

            <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
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
              className={cn("w-full", appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
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
  const theme = getQuizTheme('inglés')
  return (
    <div 
      className={cn("min-h-screen quiz-gradient-bg relative", appTheme === 'dark' ? 'bg-zinc-900' : '')}
      style={appTheme === 'dark' ? {} : getQuizBackgroundStyle(theme)}
    >
      {examState === 'loading' && <LoadingScreen />}
      {examState === 'awaiting_validation' && <AwaitingValidationScreen />}
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'blocked' && <BlockedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}
      {examState === 'no_questions' && <NoQuestionsScreen />}

      {/* Modales */}
      {showWarning && <SubmitWarningModal />}
      {showTabChangeWarning && !examLocked && tabChangeCount < 2 && <TabChangeWarningModal />}
      {showFullscreenExit && !examLocked && <FullscreenExitModal />}
    </div>
  )
}

export default ExamWithFirebase