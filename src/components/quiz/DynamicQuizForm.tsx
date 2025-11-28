import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, Calculator, Timer, HelpCircle, Users, Play, Maximize, Database, X } from "lucide-react"
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
import ImageGallery from "@/components/common/ImageGallery";
import { sanitizeMathHtml } from "@/utils/sanitizeMathHtml";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { processExamResults, checkPhaseAccess } from "@/utils/phaseIntegration";
import { useNotification } from "@/hooks/ui/useNotification";
import { dbService } from "@/services/firebase/db.service";
import { getPhaseName, getAllPhases } from "@/utils/firestoreHelpers";

const db = getFirestore(firebaseApp);

// Tipo para el seguimiento de tiempo por pregunta
interface QuestionTimeData {
  questionId: string;
  timeSpent: number; // en segundos
  startTime: number; // timestamp
  endTime?: number; // timestamp
}


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
  // DEBUG: Información completa antes de guardar
  console.log(`[saveExamResults] 🔍 DEBUG - Información completa:`, {
    userId,
    examId,
    examDataPhase: examData.phase,
    examDataPhaseType: typeof examData.phase,
    examDataPhaseValue: JSON.stringify(examData.phase),
    isSecond: examData.phase === 'second',
    isSecondString: examData.phase === 'second' || examData.phase === 'Second' || examData.phase === 'SECOND'
  });
  
  // Determinar la fase y obtener el nombre de la subcolección
  const phaseName = getPhaseName(examData.phase);
  
  console.log(`[saveExamResults] 🔍 DEBUG - Resultado de getPhaseName:`, {
    inputPhase: examData.phase,
    outputPhaseName: phaseName,
    expectedForSecond: 'Fase II',
    matches: phaseName === 'Fase II'
  });
  
  // Verificar que las respuestas de fase 2 se guarden en "Fase II"
  if (examData.phase === 'second' || examData.phase === 'Second' || examData.phase === 'SECOND') {
    console.log(`[saveExamResults] ✅ Guardando respuestas de Fase 2 en carpeta: results/${userId}/${phaseName}/${examId}`);
    if (phaseName !== 'Fase II') {
      console.error(`[saveExamResults] ❌ ERROR: La fase 2 debería guardarse en "Fase II" pero se está usando: ${phaseName}`);
      console.error(`[saveExamResults] ❌ Valores recibidos:`, {
        examDataPhase: examData.phase,
        phaseName,
        getPhaseNameResult: getPhaseName(examData.phase)
      });
    } else {
      console.log(`[saveExamResults] ✅ Confirmado: Se guardará en "Fase II"`);
    }
  }
  
  // Guardar en la subcolección correspondiente a la fase
  const docRef = doc(db, "results", userId, phaseName, examId);
  console.log(`[saveExamResults] 📝 Guardando en ruta: results/${userId}/${phaseName}/${examId}`);
  
  // Para Fase II, asegurarse de que la carpeta existe
  // Si no existe, se creará automáticamente al guardar el primer documento
  if (examData.phase === 'second' && phaseName === 'Fase II') {
    console.log(`[saveExamResults] 🔍 Verificando/creando carpeta "Fase II" para el primer examen de Fase 2`);
  }
  
  await setDoc(
    docRef,
    {
      ...examData,
      timestamp: Date.now(),
    }
  );
  
  console.log(`[saveExamResults] ✅ Examen guardado exitosamente en: results/${userId}/${phaseName}/${examId}`);
  console.log(`[saveExamResults] 📁 La carpeta "${phaseName}" ahora existe en Firestore`);
  
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
  const { theme } = useThemeContext();
  const { notifySuccess, notifyError } = useNotification();
  const userId = user?.uid;

  // Usar sanitizeMathHtml para permitir fórmulas matemáticas de KaTeX
  const sanitizeHtml = sanitizeMathHtml

  // Estados principales
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingExamData, setExistingExamData] = useState<any | null>(null);
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [fullscreenExitWithTabChange, setFullscreenExitWithTabChange] = useState(false)

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
        
        // PRIMERO: Verificar acceso y bloqueo ANTES de generar el cuestionario
        const userResult = await dbService.getUserById(userId);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data;
          const gradeId = studentData.gradeId || studentData.grade;

          if (gradeId) {
            // Verificar acceso a la fase
            const accessCheck = await checkPhaseAccess(userId, gradeId, phase);
            if (!accessCheck.canAccess) {
              setExamState('blocked');
              notifyError({
                title: 'Acceso bloqueado',
                message: accessCheck.reason || 'No tienes acceso a esta fase. Debes completar la fase anterior primero.'
              });
              return;
            }

            // Verificar si el examen ya fue completado y si debe estar bloqueado
            const { phaseAuthorizationService } = await import('@/services/phase/phaseAuthorization.service');
            const progressResult = await phaseAuthorizationService.getStudentPhaseProgress(userId, phase);
            
            let isSubjectCompleted = false;
            let allSubjectsCompleted = false;
            
            if (progressResult.success && progressResult.data) {
              const progress = progressResult.data;
              // Normalizar nombres para comparación (case-insensitive y sin espacios extra)
              const normalizedSubject = subject.trim();
              const completedSubjects = (progress.subjectsCompleted || []).map((s: string) => s.trim());
              
              // Comparación case-insensitive
              isSubjectCompleted = completedSubjects.some(
                (s: string) => s.toLowerCase() === normalizedSubject.toLowerCase()
              );
              allSubjectsCompleted = completedSubjects.length >= 7; // Total de materias (>= por si hay más)
              
              console.log(`[DynamicQuizForm] Verificando bloqueo para "${subject}" - Fase ${phase}:`, {
                normalizedSubject,
                isSubjectCompleted,
                allSubjectsCompleted,
                completedCount: completedSubjects.length,
                completedSubjects,
                progressData: progress
              });
            } else {
              console.log(`[DynamicQuizForm] No se pudo obtener progreso para ${subject} - Fase ${phase}`);
            }
            
            // VERIFICACIÓN CRÍTICA: Consultar directamente los exámenes guardados en Firestore
            // Ruta: results/estudiante/fase/examen
            // Esta es la fuente de verdad para verificar si un examen está completado
            // Funciona para TODAS las materias
            try {
              const { getFirestore, collection, getDocs } = await import('firebase/firestore');
              const { firebaseApp } = await import('@/services/db');
              const db = getFirestore(firebaseApp);
              const { getPhaseName } = await import('@/utils/firestoreHelpers');
              
              const phaseName = getPhaseName(phase);
              const resultsRef = collection(db, 'results', userId, phaseName);
              const resultsSnapshot = await getDocs(resultsRef);
              
              // Verificar si hay algún examen completado para esta materia
              const normalizedSubject = subject.trim().toLowerCase();
              
              // Mapeo de códigos de materia a nombres (para detectar exámenes antiguos sin campo subject)
              const subjectCodeMap: Record<string, string> = {
                'IN': 'inglés',
                'MA': 'matemáticas',
                'LE': 'lenguaje',
                'CS': 'ciencias sociales',
                'BI': 'biologia',
                'QU': 'quimica',
                'FI': 'física'
              };
              
              console.log(`[DynamicQuizForm] 🔍 Verificando Firestore para ${subject} - Fase ${phase}:`, {
                totalDocs: resultsSnapshot.docs.length
              });
              
              resultsSnapshot.docs.forEach(doc => {
                const examData = doc.data();
                const examSubject = (examData.subject || '').trim().toLowerCase();
                const examCompleted = examData.completed === true;
                
                // FALLBACK: Si no hay campo subject, intentar detectar por el ID del documento
                // Los IDs de exámenes dinámicos siguen el patrón: <CODIGO_MATERIA><GRADO><NUMERO>
                let detectedSubject = examSubject;
                if (!examSubject && doc.id) {
                  const docIdUpper = doc.id.toUpperCase();
                  // Buscar si el ID empieza con algún código de materia conocido
                  for (const [code, subjectName] of Object.entries(subjectCodeMap)) {
                    if (docIdUpper.startsWith(code)) {
                      detectedSubject = subjectName;
                      console.log(`[DynamicQuizForm] 🔍 Examen sin campo subject detectado por ID: ${doc.id} -> ${subjectName} (código: ${code})`);
                      break;
                    }
                  }
                }
                
                // Si el examen está completado y es de la materia correcta
                if (examCompleted && detectedSubject === normalizedSubject) {
                  isSubjectCompleted = true;
                  console.log(`[DynamicQuizForm] ✅ Examen completado encontrado en Firestore: ${subject} - Fase ${phase} - Doc ID: ${doc.id}`, {
                    detectedBy: examData.subject ? 'subject field' : 'document ID'
                  });
                  
                  // Si el examen no tiene el campo subject, actualizarlo (sin await, se ejecuta en background)
                  if (!examData.subject && gradeId) {
                    console.log(`[DynamicQuizForm] 🔄 Actualizando examen antiguo: agregando campo subject a ${doc.id}`);
                    import('firebase/firestore').then(({ updateDoc, doc: docFn }) => {
                      const examRef = docFn(db, 'results', userId, phaseName, doc.id);
                      updateDoc(examRef, {
                        subject: subject
                      }).then(() => {
                        console.log(`[DynamicQuizForm] ✅ Campo subject agregado a ${doc.id}`);
                      }).catch((error) => {
                        console.error(`[DynamicQuizForm] ❌ Error actualizando examen:`, error);
                      });
                    }).catch((error) => {
                      console.error(`[DynamicQuizForm] ❌ Error importando updateDoc:`, error);
                    });
                  }
                  
                  // Intentar sincronizar el progreso
                  if (gradeId) {
                    phaseAuthorizationService.updateStudentPhaseProgress(
                      userId,
                      gradeId,
                      phase,
                      subject,
                      true
                    ).then(() => {
                      console.log(`[DynamicQuizForm] ✅ Progreso sincronizado para ${subject} - Fase ${phase}`);
                    }).catch((error) => {
                      console.error(`[DynamicQuizForm] ❌ Error sincronizando progreso:`, error);
                    });
                  }
                }
              });
            } catch (error) {
              console.error(`[DynamicQuizForm] ❌ Error consultando exámenes guardados:`, error);
            }
            
            // Verificar si la siguiente fase está autorizada
            const nextPhase: 'first' | 'second' | 'third' | null = phase === 'first' ? 'second' : phase === 'second' ? 'third' : null;
            let nextPhaseAuthorized = false;
            if (nextPhase) {
              const nextPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, nextPhase);
              nextPhaseAuthorized = nextPhaseAccess.success && nextPhaseAccess.data.canAccess;
            }
            
            // Si el examen ya fue completado Y no todas las materias están completadas Y la siguiente fase no está autorizada
            if (isSubjectCompleted && !allSubjectsCompleted && !nextPhaseAuthorized) {
              console.log(`[DynamicQuizForm] BLOQUEANDO examen: ${subject} - Fase ${phase}`);
              setExamState('blocked');
              notifyError({
                title: 'Examen Finalizado',
                message: 'Este examen ya fue completado. Debes completar todas las demás materias de esta fase para poder volver a presentarlo, o esperar a que el administrador autorice la siguiente fase.'
              });
              return;
            } else if (isSubjectCompleted) {
              console.log(`[DynamicQuizForm] Examen completado pero NO bloqueado:`, {
                allSubjectsCompleted,
                nextPhaseAuthorized
              });
            }
          }
        }
        
        // SEGUNDO: Generar el cuestionario solo si no está bloqueado
        const quizResult = await quizGeneratorService.generateQuiz(subject, phase, grade, userId);
        
        if (!quizResult.success) {
          console.error('Error generando cuestionario:', quizResult.error);
          console.error('Detalles del error:', {
            subject,
            phase,
            grade,
            error: quizResult.error
          });
          setExamState('error');
          return;
        }

        const quiz = quizResult.data;
        setQuizData(quiz);
        setTimeLeft(quiz.timeLimit * 60);

        // Verificar si ya se presentó este examen específico (por examId)
        // Esto es adicional, pero el bloqueo principal ya se verificó arriba
        const existingExam = await checkExamStatus(userId, quiz.id, phase);
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

      // DEBUG: Verificar el valor de phase antes de crear examResult
      console.log(`[DynamicQuizForm] 🔍 DEBUG - Valores de fase antes de guardar:`, {
        propPhase: phase,
        quizDataPhase: quizData.phase,
        phaseType: typeof quizData.phase,
        phaseValue: quizData.phase
      });

      const examResult = {
        userId,
        examId: quizData.id,
        examTitle: quizData.title,
        subject: quizData.subject,
        phase: quizData.phase || phase, // Usar quizData.phase o el prop phase como fallback
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

      // DEBUG: Verificar el valor de phase en examResult
      console.log(`[DynamicQuizForm] 🔍 DEBUG - examResult.phase antes de guardar:`, {
        examResultPhase: examResult.phase,
        phaseType: typeof examResult.phase,
        isSecond: examResult.phase === 'second',
        willUseFaseII: getPhaseName(examResult.phase) === 'Fase II'
      });

      const result = await saveExamResults(userId, quizData.id, examResult);
      console.log('Examen guardado exitosamente:', result)

      // Procesar resultados según la fase (análisis, actualización de progreso, etc.)
      if (result.success && quizData.phase) {
        try {
          const processResult = await processExamResults(
            userId!,
            quizData.subject,
            quizData.phase,
            examResult
          );

          if (processResult.success) {
            console.log('✅ Resultados procesados exitosamente');
            if (quizData.phase === 'first') {
              notifySuccess({
                title: 'Análisis completado',
                message: 'Tu rendimiento ha sido analizado. Revisa tu plan de mejoramiento personalizado.'
              });
            }
          } else {
            console.error('⚠️ Error procesando resultados:', processResult.error);
            notifyError({
              title: 'Advertencia',
              message: 'El examen se guardó pero hubo un error al procesar el análisis. Los resultados están disponibles.'
            });
          }
        } catch (error) {
          console.error('❌ Error procesando resultados:', error);
          // No mostrar error al usuario, el examen ya se guardó
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

  // Detectar cambios de pantalla completa - PRINCIPAL
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (examState !== 'active') return;
      
      setTimeout(() => {
        const fullscreenElement =
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement;

        const isCurrentlyFullscreen = !!fullscreenElement;
        const isHidden = document.hidden;
        
        console.log('Fullscreen change:', { isCurrentlyFullscreen, isHidden, examState });

        setIsFullscreen(isCurrentlyFullscreen);

        if (!isCurrentlyFullscreen) {
          console.log('Salida de pantalla completa detectada durante examen activo');
          
          // Verificar si también se cambió de pestaña
          if (isHidden) {
            console.log('También se cambió de pestaña');
            // Se salió de pantalla completa Y cambió de pestaña
            setFullscreenExitWithTabChange(true);
            setTabChangeCount(prev => {
              const newCount = prev + 1;
              console.log('Tab change count:', newCount);
              
              // Si es la segunda vez que sale de pantalla completa Y cambia de pestaña, finalizar
              if (newCount >= 2) {
                console.log('Finalizando examen por segunda salida con cambio de pestaña');
                setExamLocked(true);
                handleSubmit(false, true);
              } else {
                setShowFullscreenExit(true);
              }
              return newCount;
            });
          } else {
            console.log('Solo salida de pantalla completa, sin cambio de pestaña');
            // Solo salió de pantalla completa (sin cambiar de pestaña)
            setFullscreenExitWithTabChange(false);
            setShowFullscreenExit(true);
          }
        }
      }, 150);
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

  // Detectar cambios de pestaña
  useEffect(() => {
    if (examState !== 'active' || examLocked) return;
    
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      console.log('Visibility change:', { isHidden, examState });
      
      setTimeout(() => {
        const fullscreenElement =
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement;
        
        const isCurrentlyFullscreen = !!fullscreenElement;
        
        if (!isHidden) {
          // El usuario volvió a la pestaña
          console.log('Pestaña visible, fullscreen:', isCurrentlyFullscreen);
          
          // Si volvió a la pestaña y NO está en pantalla completa, mostrar modal
          if (!isCurrentlyFullscreen) {
            console.log('Volvió a pestaña sin pantalla completa, mostrando modal');
            setFullscreenExitWithTabChange(_ => {
              // Si ya había salido de fullscreen antes, es un cambio de pestaña también
              const hadTabChange = !isCurrentlyFullscreen;
              setShowFullscreenExit(true);
              return hadTabChange;
            });
          }
        } else {
          // El usuario cambió de pestaña
          console.log('Pestaña oculta, fullscreen:', isCurrentlyFullscreen);
          
          if (isCurrentlyFullscreen) {
            // Solo cambió de pestaña (todavía en fullscreen)
            console.log('Solo cambio de pestaña, todavía en fullscreen');
            setTabChangeCount(prev => {
              const newCount = prev + 1;

              if (newCount >= 3) {
                setExamLocked(true);
                handleSubmit(true, true);
              }
              return newCount;
            });
          }
          // Si no está en fullscreen, el evento fullscreenchange ya lo manejó
        }
      }, 150);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [examState, examLocked]);

  // Detectar Escape - el evento fullscreenchange se encargará de mostrar el modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && examState === 'active') {
        // No prevenir el comportamiento por defecto
        // Dejar que el navegador salga de pantalla completa
        // El evento fullscreenchange detectará el cambio y mostrará el modal
        console.log('ESC presionado durante el examen');
      }
    };

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
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





  // Pantalla de carga
  const LoadingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center animate-pulse", theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
              <Database className={cn("h-8 w-8", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : '')}>Generando cuestionario...</CardTitle>
          <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>
            Estamos preparando tu evaluación personalizada de {subject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla de error
  const ErrorScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
              <AlertCircle className={cn("h-8 w-8", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-800')}>Error al cargar el cuestionario</CardTitle>
          <CardDescription className={cn("text-lg", theme === 'dark' ? 'text-gray-400' : '')}>
            No se pudo generar el cuestionario de {subject}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className={cn(theme === 'dark' ? 'text-red-300' : 'text-red-800')}>Posibles Causas</AlertTitle>
            <AlertDescription className={cn("space-y-2", theme === 'dark' ? 'text-red-200' : 'text-red-700')}>
              <div>• No hay suficientes preguntas de {subject} en el banco de datos</div>
              <div>• Problemas de conexión con Firebase</div>
              <div>• Filtros muy específicos (grado: {grade}, fase: {phase})</div>
              <div>• Error en la configuración del cuestionario</div>
            </AlertDescription>
          </Alert>
          
          <Alert className={cn(theme === 'dark' ? 'border-blue-800 bg-blue-900/30' : 'border-blue-200 bg-blue-50')}>
            <Database className="h-4 w-4 text-blue-600" />
            <AlertTitle className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>Información de Debug</AlertTitle>
            <AlertDescription className={cn(theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
              <div className="text-sm space-y-1">
                <div><strong>Materia:</strong> {subject}</div>
                <div><strong>Fase:</strong> {phase}</div>
                <div><strong>Grado:</strong> {grade || 'No especificado'}</div>
                <div><strong>Usuario:</strong> {userId ? 'Autenticado' : 'No autenticado'}</div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          >
            <Database className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className={cn("w-full", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
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
      <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-amber-800' : 'border-amber-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')}>
              <AlertCircle className={cn("h-8 w-8", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", theme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>Examen Ya Presentado</CardTitle>
          <CardDescription className={cn("text-lg", theme === 'dark' ? 'text-gray-400' : '')}>
            Ya has completado este examen anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(theme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className={cn(theme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>Información del Examen</AlertTitle>
            <AlertDescription className={cn(theme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
              Solo se permite una presentación por examen. Tu intento anterior ya fue registrado.
            </AlertDescription>
          </Alert>

          {existingExamData && (
            <div className={cn("rounded-lg p-4 space-y-3", theme === 'dark' ? 'bg-zinc-700/50' : 'bg-gray-50')}>
              <h4 className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Detalles de tu presentación:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Fecha:</span>
                  <div className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>
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
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntuación:</span>
                  <div className={cn("font-medium text-lg", theme === 'dark' ? 'text-white' : '')}>
                    {existingExamData.score.correctAnswers}/{existingExamData.score.totalQuestions}
                    <span className={cn("text-sm ml-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      ({existingExamData.score.overallPercentage}%)
                    </span>
                  </div>
                </div>
                <div>
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo usado:</span>
                  <div className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>
                    {formatTime(existingExamData.timeSpent || existingExamData.totalExamTimeSeconds || 0)}
                  </div>
                </div>
                <div>
                  <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Estado:</span>
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
        <Card className={cn("shadow-lg border-0", theme === 'dark' ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-zinc-700' : 'bg-gradient-to-br from-purple-50 to-blue-50')}>
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
            <CardTitle className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent')}>
              ¡Bienvenido al {quizData.title}!
            </CardTitle>
            <CardDescription className={cn("text-lg max-w-2xl mx-auto", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {quizData.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Información del examen */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className={cn("rounded-lg p-4 text-center border shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quizData.timeLimit} minutos</div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tiempo límite</div>
              </div>
              <div className={cn("rounded-lg p-4 text-center border shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{quizData.totalQuestions} preguntas</div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total de preguntas</div>
              </div>
              <div className={cn("rounded-lg p-4 text-center border shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
                <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Opción múltiple</div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tipo de pregunta</div>
              </div>
            </div>

            {/* Instrucciones */}
            <div className={cn("rounded-lg p-6 border shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <h3 className={cn("text-lg font-semibold mb-4 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Instrucciones importantes
              </h3>
              <ul className="space-y-3">
                {quizData.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Advertencias */}
            <Alert className={cn(theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className={cn(theme === 'dark' ? 'text-red-300' : 'text-red-800')}>Control de Pestañas</AlertTitle>
              <AlertDescription className={cn(theme === 'dark' ? 'text-red-200' : 'text-red-700')}>
                El sistema detectará si cambias de pestaña o pierdes el foco de la ventana. Después de 3 intentos, el examen se finalizará automáticamente.
              </AlertDescription>
            </Alert>
            
            <Alert className={cn(theme === 'dark' ? 'border-purple-800 bg-purple-900/30' : 'border-purple-200 bg-purple-50')}>
              <Maximize className="h-4 w-4 text-purple-600" />
              <AlertTitle className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-800')}>Modo Pantalla Completa</AlertTitle>
              <AlertDescription className={cn(theme === 'dark' ? 'text-purple-200' : 'text-purple-700')}>
                El examen se realizará en pantalla completa. Si sales de este modo durante la prueba, se mostrará una alerta y podrás elegir entre volver al examen o finalizarlo automáticamente.
              </AlertDescription>
            </Alert>

            <Alert className={cn(theme === 'dark' ? 'border-green-800 bg-green-900/30' : 'border-green-200 bg-green-50')}>
              <Database className="h-4 w-4 text-green-600" />
              <AlertTitle className={cn(theme === 'dark' ? 'text-green-300' : 'text-green-800')}>Una Sola Oportunidad</AlertTitle>
              <AlertDescription className={cn(theme === 'dark' ? 'text-green-200' : 'text-green-700')}>
                Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
              </AlertDescription>
            </Alert>

            <Alert className={cn(theme === 'dark' ? 'border-blue-800 bg-blue-900/30' : 'border-blue-200 bg-blue-50')}>
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>Seguimiento de Tiempo</AlertTitle>
              <AlertDescription className={cn(theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
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

  // Modal de salida de pantalla completa
  const FullscreenExitModal = () => {
    if (!showFullscreenExit) return null;
    
    const hasTabChange = fullscreenExitWithTabChange;
    const isLastWarning = tabChangeCount >= 1;

    console.log('Mostrando modal FullscreenExit:', { hasTabChange, isLastWarning, tabChangeCount });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <Card className={cn("w-full max-w-md mx-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center",
                hasTabChange && isLastWarning ? (theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100') :
                hasTabChange ? (theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100') :
                (theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')
              )}>
                <Maximize className={cn(
                  "h-8 w-8",
                  hasTabChange && isLastWarning ? 'text-red-600' :
                  hasTabChange ? 'text-orange-600' :
                  'text-amber-600'
                )} />
              </div>
            </div>
            <CardTitle className={cn(
              "text-xl",
              hasTabChange && isLastWarning ? (theme === 'dark' ? 'text-red-400' : 'text-red-800') :
              hasTabChange ? (theme === 'dark' ? 'text-orange-400' : 'text-orange-800') :
              (theme === 'dark' ? 'text-amber-400' : 'text-amber-800')
            )}>
              {hasTabChange && isLastWarning 
                ? '¡Advertencia Final!' 
                : hasTabChange 
                ? 'Salida de Pantalla Completa y Cambio de Pestaña'
                : 'Salida de Pantalla Completa'}
            </CardTitle>
            <CardDescription className={cn("text-base", theme === 'dark' ? 'text-gray-400' : '')}>
              {hasTabChange && isLastWarning
                ? 'Has salido de pantalla completa y cambiado de pestaña por segunda vez'
                : hasTabChange
                ? 'Has salido de pantalla completa y cambiado de pestaña'
                : 'Has salido del modo pantalla completa'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {hasTabChange && isLastWarning ? (
              <>
                <Alert className={cn(theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className={cn("font-bold", theme === 'dark' ? 'text-red-300' : 'text-red-800')}>¡Último Aviso!</AlertTitle>
                  <AlertDescription className={cn(theme === 'dark' ? 'text-red-200' : 'text-red-700')}>
                    Si vuelves a salir de pantalla completa y cambiar de pestaña, el examen se finalizará automáticamente.
                  </AlertDescription>
                </Alert>
                <p className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : hasTabChange ? (
              <>
                <Alert className={cn(theme === 'dark' ? 'border-orange-800 bg-orange-900/30' : 'border-orange-200 bg-orange-50')}>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertTitle className={cn(theme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>Advertencia</AlertTitle>
                  <AlertDescription className={cn(theme === 'dark' ? 'text-orange-200' : 'text-orange-700')}>
                    Has salido de pantalla completa y cambiado de pestaña. Si lo vuelves a hacer, el examen se tomará por finalizado.
                  </AlertDescription>
                </Alert>
                <p className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : (
              <>
                <p className={cn("mb-4 font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  El examen debe realizarse en pantalla completa. Por favor, vuelve a poner pantalla completa o finaliza el examen.
                </p>
                <Alert className={cn(theme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className={cn(theme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                    Si eliges finalizar el examen, se guardarán todas tus respuestas actuales.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={returnToExam}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Maximize className="h-4 w-4 mr-2" />
              Volver a Pantalla Completa
            </Button>
            <Button
              onClick={handleExitFullscreen}
              variant="outline"
              className={cn("w-full", theme === 'dark' ? 'border-red-700 text-red-400 hover:bg-red-900/30 bg-zinc-700' : 'border-red-300 text-red-600 hover:bg-red-50')}
            >
              <X className="h-4 w-4 mr-2" />
              Finalizar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
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
        <Card className={cn("shadow-lg border-0", theme === 'dark' ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-blue-50')}>
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-green-400' : 'text-green-800')}>
              ¡Examen Completado!
            </CardTitle>
            <CardDescription className={cn("text-lg", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Tus respuestas han sido guardadas exitosamente
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Resultados principales */}
            <div className={cn("rounded-lg p-6 border shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
              <h3 className={cn("text-xl font-semibold mb-4 text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Resultados del Examen
              </h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {score.correctAnswers}
                  </div>
                  <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respuestas correctas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Preguntas respondidas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {score.overallPercentage}%
                  </div>
                  <div className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Puntuación final</div>
                </div>
              </div>
              <Progress
                value={score.overallPercentage}
                className="h-3 mb-2"
              />
              <div className={cn("text-center text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
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
    const answeredQuestions = Object.keys(answers).length
    const questionId = currentQ.id || currentQ.code;

    return (
      <div className={cn("flex flex-col lg:flex-row gap-6 min-h-screen pt-2 px-4 pb-4", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-25')}>
        {/* Contenido principal del examen */}
        <div className="flex-1">
          <div className={cn("border rounded-lg p-3 mb-2 shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden">
                  <Calculator className={cn("w-12 h-12", theme === 'dark' ? 'text-blue-400' : 'text-blue-500')} />
                </div>
                <div>
                  <h3 className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estás realizando:</h3>
                  <h2 className={cn("text-base font-bold", theme === 'dark' ? 'text-white' : '')}>{quizData.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tiempo restante */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm",
                  timeLeft > 600
                    ? (theme === 'dark' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200')
                    : timeLeft > 300
                      ? (theme === 'dark' ? 'bg-orange-900/50 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-200')
                      : (theme === 'dark' ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-200')
                )}>
                  <Clock className={cn("h-4 w-4", timeLeft > 600
                      ? 'text-green-500'
                      : timeLeft > 300
                        ? 'text-orange-500'
                        : 'text-red-500'
                    )} />
                  <span className={cn("text-sm font-medium font-mono", timeLeft > 600
                      ? (theme === 'dark' ? 'text-green-300' : 'text-green-700')
                      : timeLeft > 300
                        ? (theme === 'dark' ? 'text-orange-300' : 'text-orange-700')
                        : (theme === 'dark' ? 'text-red-300' : 'text-red-700')
                    )}>
                    {formatTimeLeft(timeLeft)}
                  </span>
                </div>
                {/* Preguntas respondidas */}
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", theme === 'dark' ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                  <span className="text-sm font-medium">{answeredQuestions} respondidas</span>
                </div>
                {/* Advertencias de cambio de pestaña */}
                {tabChangeCount > 0 && (
                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", theme === 'dark' ? 'bg-orange-900/50 border-orange-700' : 'bg-orange-50 border-orange-200')}>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-orange-300' : 'text-orange-700')}>
                      {3 - tabChangeCount} intentos restantes
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Card className={cn("mb-6", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : '')}>Pregunta {currentQuestion + 1}</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn("px-2 py-1 rounded-full", theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                    {currentQ.topic}
                  </span>
                  <span className={cn("px-2 py-1 rounded-full", theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')}>
                    {currentQ.level}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none">
                {/* Texto informativo */}
                {currentQ.informativeText && (
                  <div className={cn("mb-4 p-4 rounded-lg border", theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                    <div
                      className={cn("leading-relaxed prose max-w-none", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQ.informativeText) }}
                    />
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
                  <div
                    className={cn("leading-relaxed text-lg font-medium prose max-w-none", theme === 'dark' ? 'text-white' : 'text-gray-900')}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQ.questionText) }}
                  />
                )}
              </div>
              
              <RadioGroup
                value={answers[questionId] || ""}
                onValueChange={(value) => handleAnswerChange(questionId, value)}
                className="space-y-0.5 mt-6"
              >
                {currentQ.options.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleAnswerChange(questionId, option.id)}
                    className={cn("flex items-start space-x-3 border rounded-lg p-3 transition-colors cursor-pointer", theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-700' : 'hover:bg-gray-50')}
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
                        <span className={cn("font-semibold mr-2", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{option.id}.</span>
                        <div className="flex-1">
                          {option.text && (
                            <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}>{option.text}</span>
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
        <div className="w-full lg:w-56 flex-shrink-0">
          <div className={cn("border rounded-lg p-3 sticky top-4 shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
            <h3 className={cn("text-xs font-semibold mb-2.5 uppercase tracking-wide", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
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
                    className={cn(
                      "relative h-9 w-9 rounded-md flex items-center justify-center text-xs font-semibold transition-all duration-200 hover:scale-110",
                      isCurrent
                        ? isAnswered
                          ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-lg ring-2 ring-purple-400 ring-offset-1"
                          : "bg-gradient-to-br from-purple-500 to-blue-400 text-white shadow-md ring-2 ring-purple-300 ring-offset-1"
                        : isAnswered
                        ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm hover:shadow-md"
                        : (theme === 'dark' ? "bg-zinc-700 text-gray-300 border border-zinc-600 hover:bg-zinc-600 hover:border-purple-500" : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 hover:border-purple-300")
                    )}
                    title={`Pregunta ${index + 1}${isAnswered ? " - Respondida" : " - Sin responder"}`}
                  >
                    {index + 1}
                    {isAnswered && !isCurrent && (
                      <CheckCircle2 className={cn("absolute -top-1 -right-1 h-3 w-3 text-green-500 rounded-full", theme === 'dark' ? 'bg-zinc-800' : 'bg-white')} />
                    )}
                  </button>
                )
              })}
            </div>

            <div className={cn("mt-4 pt-4 border-t", theme === 'dark' ? 'border-zinc-700' : '')}>
              <div className={cn("text-sm mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Progreso del examen</div>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>
                  {answeredQuestions}/{quizData.questions.length}
                </span>
                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
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
                <p className={cn("text-xs text-center mt-2", theme === 'dark' ? 'text-orange-400' : 'text-orange-500')}>
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
        <Card className={cn("w-full max-w-md mx-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
                <Send className={cn("h-8 w-8", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              </div>
            </div>
            <CardTitle className={cn("text-xl", theme === 'dark' ? 'text-blue-400' : 'text-blue-800')}>
              ¿Enviar Examen?
            </CardTitle>
            <CardDescription className={cn("text-base", theme === 'dark' ? 'text-gray-400' : '')}>
              Confirma que deseas enviar tus respuestas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("rounded-lg p-4", theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {score.totalAnswered}
                  </div>
                  <div className={cn(theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>Respondidas</div>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    {unanswered}
                  </div>
                  <div className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Sin responder</div>
                </div>
              </div>
            </div>

            {unanswered > 0 && (
              <Alert className={cn(theme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className={cn(theme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
                  Tienes {unanswered} pregunta{unanswered > 1 ? 's' : ''} sin responder.
                  Estas se contarán como incorrectas.
                </AlertDescription>
              </Alert>
            )}

            <Alert className={cn(theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className={cn(theme === 'dark' ? 'text-red-200' : 'text-red-700')}>
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
              className={cn("w-full", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
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
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      {examState === 'loading' && <LoadingScreen />}
      {examState === 'error' && <ErrorScreen />}
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {examState === 'blocked' && (
        <div className="max-w-2xl mx-auto">
          <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
                  <AlertCircle className={cn("h-8 w-8", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
                </div>
              </div>
              <CardTitle className={cn("text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-800')}>Acceso Bloqueado</CardTitle>
              <CardDescription className={cn("text-lg", theme === 'dark' ? 'text-gray-400' : '')}>
                No tienes acceso a esta fase evaluativa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className={cn(theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className={cn(theme === 'dark' ? 'text-red-300' : 'text-red-800')}>Información</AlertTitle>
                <AlertDescription className={cn(theme === 'dark' ? 'text-red-200' : 'text-red-700')}>
                  Esta fase aún no está disponible para ti. Debes completar la fase anterior y esperar la autorización del administrador.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button
                onClick={() => navigate('/dashboard#fases')}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                Ver Estado de Fases
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Modales - siempre al final para que estén encima de todo */}
      {showWarning && <SubmitWarningModal />}
      {showFullscreenExit && <FullscreenExitModal />}
    </div>
  )
}

export default DynamicQuizForm;
