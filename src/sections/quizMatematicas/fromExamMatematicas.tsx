import { Clock, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, Calculator, Timer, HelpCircle, Users, Play, Maximize, Database, X, ZoomIn } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { useAuthContext } from "@/context/AuthContext";
import { quizGeneratorService, GeneratedQuiz } from "@/services/quiz/quizGenerator.service";
import { getPhaseName, getAllPhases } from "@/utils/firestoreHelpers";
import { getQuizTheme, getQuizBackgroundStyle } from "@/utils/quizThemes";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { dbService } from "@/services/firebase/db.service";
import { checkPhaseAccess } from "@/utils/phaseIntegration";
import { useNotification } from "@/hooks/ui/useNotification";
import { processExamResults } from "@/utils/phaseIntegration";

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

// Función para mapear el grado del usuario al código que usa el banco de preguntas
const mapGradeToCode = (gradeName: string): string => {
  const gradeMap: { [key: string]: string } = {
    '6°1': '6', '6°2': '6', '6°3': '6',
    '7°1': '7', '7°2': '7', '7°3': '7',
    '8°1': '8', '8°2': '8', '8°3': '8',
    '9°1': '9', '9°2': '9', '9°3': '9',
    '10°1': '0', '10°2': '0', '10°3': '0',
    '11°1': '1', '11°2': '1', '11°3': '1'
  };
  return gradeMap[gradeName] || '1'; // Default a undécimo si no se encuentra
};

// Configuración del examen de Matemáticas
const examConfig = {
  subject: "Matemáticas",
  phase: "first" as const,
  examId: "exam_matematicas_001", // ID único del examen
  title: "Examen de Matemáticas",
  description: "Evaluación de habilidades matemáticas y resolución de problemas",
  module: "Módulo de Matemáticas",
};

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams();
  const { user } = useAuthContext();
  const { theme: appTheme } = useThemeContext();
  const { notifyError } = useNotification();
  const userId = user?.uid;

  // Obtener parámetros de la URL para determinar la fase y materia
  const phaseParam = searchParams.get('phase') as 'first' | 'second' | 'third' | null;
  const subjectParam = searchParams.get('subject');
  const currentPhase = phaseParam || examConfig.phase;
  const currentSubject = subjectParam || examConfig.subject;

  // Estados principales
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken, no_questions
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [fullscreenExitWithTabChange, setFullscreenExitWithTabChange] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingExamData, setExistingExamData] = useState<any | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Estados para el seguimiento de tiempo por pregunta
  const [questionTimeData, setQuestionTimeData] = useState<{ [key: string]: QuestionTimeData }>({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<number>(0);

  // Cargar cuestionario dinámico al montar el componente
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true; // Flag para evitar actualizaciones de estado en componentes desmontados

    const loadQuiz = async () => {
      console.log('=== INICIANDO CARGA DEL CUESTIONARIO DE MATEMÁTICAS ===');
      console.log('UserId:', userId);
      console.log('ExamConfig:', examConfig);

      if (!userId) {
        console.log('No hay userId, esperando...');
        return;
      }

      try {
        console.log('Iniciando carga del cuestionario para:', currentSubject, currentPhase);
        if (isMounted) {
          setExamState('loading');
        }
        
        // PRIMERO: Verificar acceso y bloqueo ANTES de generar el cuestionario
        const userResult = await dbService.getUserById(userId);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data;
          const gradeId = studentData.gradeId || studentData.grade;

          if (gradeId) {
            // Verificar acceso a la fase
            const accessCheck = await checkPhaseAccess(userId, gradeId, currentPhase);
            if (!accessCheck.canAccess) {
              if (isMounted) {
                setExamState('blocked');
                notifyError({
                  title: 'Acceso bloqueado',
                  message: accessCheck.reason || 'No tienes acceso a esta fase. Debes completar la fase anterior primero.'
                });
              }
              return;
            }

            // Verificar si el examen ya fue completado y si debe estar bloqueado
            const { phaseAuthorizationService } = await import('@/services/phase/phaseAuthorization.service');
            const progressResult = await phaseAuthorizationService.getStudentPhaseProgress(userId, currentPhase);
            
            let isSubjectCompleted = false;
            let allSubjectsCompleted = false;
            
            if (progressResult.success && progressResult.data) {
              const progress = progressResult.data;
              // Normalizar nombres para comparación (case-insensitive)
              const normalizedSubject = currentSubject.trim();
              const completedSubjects = (progress.subjectsCompleted || []).map((s: string) => s.trim());
              isSubjectCompleted = completedSubjects.some(
                (s: string) => s.toLowerCase() === normalizedSubject.toLowerCase()
              );
              allSubjectsCompleted = completedSubjects.length >= 7; // Total de materias
              
              console.log(`[fromExamMatematicas] Verificando bloqueo para ${currentSubject} - Fase ${currentPhase}:`, {
                normalizedSubject,
                isSubjectCompleted,
                allSubjectsCompleted,
                completedCount: completedSubjects.length,
                completedSubjects
              });
            }
            
            // VERIFICACIÓN CRÍTICA: Consultar directamente Firestore (results/estudiante/fase/examen)
            // Esta es la fuente de verdad para verificar si un examen está completado
            // Funciona para TODAS las materias
            try {
              const { getFirestore, collection, getDocs } = await import('firebase/firestore');
              const { firebaseApp } = await import('@/services/db');
              const db = getFirestore(firebaseApp);
              const { getPhaseName } = await import('@/utils/firestoreHelpers');
              
              const phaseName = getPhaseName(currentPhase);
              const resultsRef = collection(db, 'results', userId, phaseName);
              const resultsSnapshot = await getDocs(resultsRef);
              
              const normalizedSubject = currentSubject.trim().toLowerCase();
              
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
              
              console.log(`[fromExamMatematicas] 🔍 Verificando Firestore para ${currentSubject} - Fase ${currentPhase}:`, {
                totalDocs: resultsSnapshot.docs.length,
                normalizedSubject,
                phaseName
              });
              
              // Log de todos los documentos encontrados para debugging
              if (resultsSnapshot.docs.length > 0) {
                console.log(`[fromExamMatematicas] 📄 Documentos encontrados en Firestore (${resultsSnapshot.docs.length} total):`, 
                  resultsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                      id: doc.id,
                      subject: data.subject,
                      completed: data.completed,
                      phase: data.phase,
                      score: data.score
                    };
                  })
                );
              }
              
              // Reiniciar isSubjectCompleted para esta verificación
              let foundCompletedExam = false;
              
              resultsSnapshot.docs.forEach(doc => {
                const examData = doc.data();
                const examSubject = (examData.subject || '').trim().toLowerCase();
                const examCompleted = examData.completed === true;
                
                console.log(`[fromExamMatematicas] 🔍 Analizando documento ${doc.id}:`, {
                  examSubject: examSubject || '(vacío)',
                  examCompleted,
                  normalizedSubject,
                  hasSubject: !!examData.subject,
                  rawData: {
                    subject: examData.subject,
                    completed: examData.completed,
                    phase: examData.phase,
                    score: examData.score
                  }
                });
                
                // FALLBACK: Si no hay campo subject, intentar detectar por el ID del documento
                let detectedSubject = examSubject;
                if (!examSubject && doc.id) {
                  const docIdUpper = doc.id.toUpperCase();
                  for (const [code, subjectName] of Object.entries(subjectCodeMap)) {
                    if (docIdUpper.startsWith(code)) {
                      detectedSubject = subjectName;
                      console.log(`[fromExamMatematicas] 🔍 Examen sin campo subject detectado por ID: ${doc.id} -> ${subjectName} (código: ${code})`);
                      break;
                    }
                  }
                }
                
                // CRÍTICO: Solo considerar el examen como completado si:
                // 1. El examen tiene completed === true (estricto)
                // 2. El examen es de la materia correcta (detectedSubject === normalizedSubject)
                // 3. NO considerar exámenes que no están completados
                const isCorrectSubject = detectedSubject === normalizedSubject;
                const shouldCount = examCompleted && isCorrectSubject;
                
                console.log(`[fromExamMatematicas] 📊 Evaluación del documento ${doc.id}:`, {
                  examCompleted,
                  detectedSubject,
                  normalizedSubject,
                  isCorrectSubject,
                  shouldCount,
                  willMarkAsCompleted: shouldCount
                });
                
                if (shouldCount) {
                  foundCompletedExam = true;
                  isSubjectCompleted = true;
                  console.log(`[fromExamMatematicas] ✅ Examen completado encontrado en Firestore: ${currentSubject} - Fase ${currentPhase} - Doc ID: ${doc.id}`, {
                    examData: {
                      subject: examData.subject,
                      completed: examData.completed,
                      score: examData.score,
                      detectedSubject
                    }
                  });
                  
                  // Si el examen no tiene el campo subject, actualizarlo (sin await, se ejecuta en background)
                  if (!examData.subject && gradeId) {
                    console.log(`[fromExamMatematicas] 🔄 Actualizando examen antiguo: agregando campo subject a ${doc.id}`);
                    import('firebase/firestore').then(({ updateDoc, doc: docFn }) => {
                      const examRef = docFn(db, 'results', userId, phaseName, doc.id);
                      updateDoc(examRef, {
                        subject: currentSubject
                      }).then(() => {
                        console.log(`[fromExamMatematicas] ✅ Campo subject agregado a ${doc.id}`);
                      }).catch((error) => {
                        console.error(`[fromExamMatematicas] ❌ Error actualizando examen:`, error);
                      });
                    }).catch((error) => {
                      console.error(`[fromExamMatematicas] ❌ Error importando updateDoc:`, error);
                    });
                  }
                }
              });
              
              // Log final de la verificación
              console.log(`[fromExamMatematicas] 📊 Resumen de verificación Firestore para ${currentSubject}:`, {
                totalDocs: resultsSnapshot.docs.length,
                foundCompletedExam,
                isSubjectCompleted,
                normalizedSubject,
                phaseName
              });
              
              // CRÍTICO: Si no se encontró ningún examen completado, FORZAR isSubjectCompleted = false
              // Esto previene bloqueos incorrectos cuando hay documentos pero ninguno está realmente completado
              if (!foundCompletedExam) {
                isSubjectCompleted = false;
                console.log(`[fromExamMatematicas] ✅✅✅ NO se encontró examen completado para ${currentSubject} - Fase ${currentPhase}. FORZANDO isSubjectCompleted = false`);
              } else {
                console.log(`[fromExamMatematicas] ⚠️⚠️⚠️ Se encontró examen completado para ${currentSubject} - Fase ${currentPhase}. isSubjectCompleted = true`);
              }
            } catch (error) {
              console.error(`[fromExamMatematicas] ❌ Error consultando Firestore:`, error);
              // En caso de error, asumir que NO está completado para evitar bloqueos incorrectos
              isSubjectCompleted = false;
            }
            
            // Verificar si la siguiente fase está autorizada
            const nextPhase: 'first' | 'second' | 'third' | null = currentPhase === 'first' ? 'second' : currentPhase === 'second' ? 'third' : null;
            let nextPhaseAuthorized = false;
            if (nextPhase) {
              const nextPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, nextPhase);
              nextPhaseAuthorized = nextPhaseAccess.success && nextPhaseAccess.data.canAccess;
            }
            
            // CRÍTICO: Solo bloquear si el examen YA fue completado (isSubjectCompleted = true)
            // Si isSubjectCompleted = false, el examen debe estar disponible
            // Bloquear solo si: examen completado AND no todas las materias completadas AND siguiente fase no autorizada
            if (isSubjectCompleted && !allSubjectsCompleted && !nextPhaseAuthorized) {
              console.log(`[fromExamMatematicas] BLOQUEANDO examen: ${currentSubject} - Fase ${currentPhase}`, {
                isSubjectCompleted,
                allSubjectsCompleted,
                nextPhaseAuthorized,
                reason: 'Examen completado, esperando otras materias o autorización de siguiente fase'
              });
              if (isMounted) {
                setExamState('blocked');
                notifyError({
                  title: 'Examen bloqueado',
                  message: 'Este examen ya fue completado. Debes completar todas las demás materias de esta fase para poder volver a presentarlo, o esperar a que el administrador autorice la siguiente fase.'
                });
              }
              return;
            } else if (!isSubjectCompleted) {
              // Si el examen NO está completado, debe estar disponible (no bloquear)
              console.log(`[fromExamMatematicas] ✅ Examen NO completado para ${currentSubject} - Fase ${currentPhase}, debe estar disponible`, {
                isSubjectCompleted,
                allSubjectsCompleted,
                nextPhaseAuthorized,
                message: 'Continuando con la carga del cuestionario...'
              });
              // NO retornar aquí - continuar con la carga del cuestionario
            } else {
              // Examen completado pero todas las materias completadas o siguiente fase autorizada
              console.log(`[fromExamMatematicas] Examen completado pero NO bloqueado:`, {
                isSubjectCompleted,
                allSubjectsCompleted,
                nextPhaseAuthorized,
                reason: allSubjectsCompleted ? 'Todas las materias completadas' : 'Siguiente fase autorizada',
                message: 'Continuando con la carga del cuestionario...'
              });
              // NO retornar aquí - continuar con la carga del cuestionario
            }
          }
        }
        
        // Obtener el grado del usuario desde el contexto
        const userGradeName = (user as any)?.gradeName || (user as any)?.grade;
        console.log('Grado del usuario (nombre):', userGradeName);
        
        // Mapear el grado al código que usa el banco de preguntas
        const userGrade = mapGradeToCode(userGradeName);
        console.log('Grado del usuario (código):', userGrade);
        
        // SEGUNDO: Generar el cuestionario solo si no está bloqueado
        const quizResult = await quizGeneratorService.generateQuiz(
          currentSubject, 
          currentPhase,
          userGrade,
          userId // Pasar userId para personalización en Fase 2
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
          // Calcular tiempo límite: 2 minutos por pregunta
          const timeLimitMinutes = quiz.questions.length * 2;
          setTimeLeft(timeLimitMinutes * 60);
        }

        // Verificar si ya se presentó este examen
        // CRÍTICO: Solo considerar el examen como "ya presentado" si está completado
        // Si el examen existe pero no está completado, permitir continuar
        const existingExam = await checkExamStatus(userId, quiz.id, currentPhase);
        if (existingExam) {
          // Verificar si el examen está realmente completado
          const isCompleted = existingExam.completed === true;
          const examSubject = (existingExam.subject || '').trim().toLowerCase();
          const normalizedSubject = currentSubject.trim().toLowerCase();
          const isCorrectSubject = examSubject === normalizedSubject || !examSubject; // Permitir si no tiene subject (exámenes antiguos)
          
          console.log(`[fromExamMatematicas] Examen encontrado:`, {
            examId: quiz.id,
            isCompleted,
            examSubject,
            normalizedSubject,
            isCorrectSubject,
            shouldBlock: isCompleted && isCorrectSubject
          });
          
          // Solo bloquear si el examen está completado Y es de la materia correcta
          if (isCompleted && isCorrectSubject) {
            console.log(`[fromExamMatematicas] Examen ya completado - mostrando pantalla de examen terminado`);
            if (isMounted) {
              setExistingExamData(existingExam);
              setExamState('already_taken');
            }
          } else {
            // El examen existe pero no está completado, o no es de la materia correcta
            // Permitir continuar o reanudar
            console.log(`[fromExamMatematicas] Examen encontrado pero NO completado o materia incorrecta - permitiendo continuar`, {
              isCompleted,
              isCorrectSubject
            });
            if (isMounted) {
              setExamState('welcome');
            }
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
          } else {
            console.error('⚠️ Error procesando resultados:', processResult.error);
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
            setFullscreenExitWithTabChange(true);
            setTabChangeCount(prev => {
              const newCount = prev + 1;
              if (newCount >= 2) {
                setExamLocked(true);
                handleSubmit(false, true);
              } else {
                setShowFullscreenExit(true);
              }
              return newCount;
            });
          } else {
            console.log('Solo salida de pantalla completa, sin cambio de pestaña');
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
      
      setTimeout(() => {
        const fullscreenElement =
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement;
        
        const isCurrentlyFullscreen = !!fullscreenElement;
        
        if (!isHidden && !isCurrentlyFullscreen && !showFullscreenExit) {
          // Volvió a la pestaña sin pantalla completa
          setFullscreenExitWithTabChange(true);
          setShowFullscreenExit(true);
        } else if (isHidden && isCurrentlyFullscreen) {
          // Solo cambió de pestaña (todavía en fullscreen)
          setTabChangeCount(prev => {
            const newCount = prev + 1;
            setShowTabChangeWarning(true);
            if (newCount >= 3) {
              setExamLocked(true);
              handleSubmit(true, true);
            }
            return newCount;
          });
        }
      }, 150);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [examState, examLocked, showFullscreenExit]);

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    await enterFullscreen()
    setExamState('active')
  }

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
            Estamos preparando tu evaluación personalizada de {examConfig.subject}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla de error
  const ErrorScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-red-400' : 'text-red-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", appTheme === 'dark' ? 'text-red-400' : 'text-red-800')}>Error al cargar el cuestionario</CardTitle>
          <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : '')}>
            No se pudo generar el cuestionario de {examConfig.subject}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-red-300' : 'text-red-800')}>Posibles Causas</AlertTitle>
            <AlertDescription className={cn("space-y-2", appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
              <div>• No hay suficientes preguntas de {examConfig.subject} en el banco de datos</div>
              <div>• Problemas de conexión con Firebase</div>
              <div>• Filtros muy específicos (grado, fase: {examConfig.phase})</div>
              <div>• Error en la configuración del cuestionario</div>
            </AlertDescription>
          </Alert>
          
          <Alert className={cn(appTheme === 'dark' ? 'border-blue-800 bg-blue-900/30' : 'border-blue-200 bg-blue-50')}>
            <Database className="h-4 w-4 text-blue-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>Información de Debug</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
              <div className="text-sm space-y-1">
                <div><strong>Materia:</strong> {examConfig.subject}</div>
                <div><strong>Fase:</strong> {examConfig.phase}</div>
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
            className={cn("w-full", appTheme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
          >
            Volver al Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Pantalla cuando no hay preguntas
  const NoQuestionsScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-amber-800' : 'border-amber-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", appTheme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>No hay preguntas disponibles</CardTitle>
          <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : '')}>
            No se encontraron preguntas suficientes para este examen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(appTheme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50')}>
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>Información</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
              El banco de preguntas no tiene suficientes preguntas de {examConfig.subject} para tu grado y nivel actual.
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
    const theme = getQuizTheme('matemáticas')
    return (
      <div className="max-w-4xl mx-auto relative z-10">
        <Card className={cn(`shadow-xl border-0 ${theme.cardBackground} backdrop-blur-sm`, appTheme === 'dark' ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-zinc-700' : '')}>
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Calculator className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-blue-400 rounded-full flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            <CardTitle className={cn(`text-3xl font-bold mb-2`, appTheme === 'dark' ? 'text-white' : theme.primaryColor)}>
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

            {/* Advertencias */}
            <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-red-300' : 'text-red-800')}>Control de Pestañas</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
                El sistema detectará si cambias de pestaña o pierdes el foco de la ventana. Después de 2 intentos, el examen se finalizará automáticamente.
              </AlertDescription>
            </Alert>
            
            <Alert className={cn(appTheme === 'dark' ? 'border-purple-800 bg-purple-900/30' : 'border-purple-200 bg-purple-50')}>
              <Maximize className="h-4 w-4 text-purple-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-purple-300' : 'text-purple-800')}>Modo Pantalla Completa</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-purple-200' : 'text-purple-700')}>
                El examen se realizará en pantalla completa. Si sales de este modo durante la prueba, se mostrará una alerta y podrás elegir entre volver al examen o finalizarlo automáticamente.
              </AlertDescription>
            </Alert>

            <Alert className={cn(appTheme === 'dark' ? 'border-green-800 bg-green-900/30' : 'border-green-200 bg-green-50')}>
              <Database className="h-4 w-4 text-green-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-green-300' : 'text-green-800')}>Una Sola Oportunidad</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-green-200' : 'text-green-700')}>
                Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
              </AlertDescription>
            </Alert>

            <Alert className={cn(appTheme === 'dark' ? 'border-blue-800 bg-blue-900/30' : 'border-blue-200 bg-blue-50')}>
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle className={cn(appTheme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>Seguimiento de Tiempo</AlertTitle>
              <AlertDescription className={cn(appTheme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
                El sistema registrará el tiempo que dedicas a cada pregunta individualmente. Esta información se incluirá en tus resultados finales.
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

  // Modal de salida de pantalla completa
  const FullscreenExitModal = () => {
    if (!showFullscreenExit) return null;
    
    const hasTabChange = fullscreenExitWithTabChange;
    const isLastWarning = tabChangeCount >= 1;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
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
                  hasTabChange && isLastWarning ? 'text-red-600' :
                  hasTabChange ? 'text-orange-600' :
                  'text-amber-600'
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
                ? 'Has salido de pantalla completa y cambiado de pestaña por segunda vez'
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
                    Has salido de pantalla completa y cambiado de pestaña. Si lo vuelves a hacer, el examen se tomará por finalizado.
                  </AlertDescription>
                </Alert>
                <p className={cn(appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Por favor, vuelve a poner pantalla completa y mantén esta pestaña activa.
                </p>
              </>
            ) : (
              <>
                <p className={cn("mb-4 font-medium", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  El examen debe realizarse en pantalla completa. Por favor, vuelve a poner pantalla completa o finaliza el examen.
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
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Maximize className="h-4 w-4 mr-2" />
              Volver a Pantalla Completa
            </Button>
            <Button
              onClick={handleExitFullscreen}
              variant="outline"
              className={cn("w-full", appTheme === 'dark' ? 'border-red-700 text-red-400 hover:bg-red-900/30 bg-zinc-700' : 'border-red-300 text-red-600 hover:bg-red-50')}
            >
              <X className="h-4 w-4 mr-2" />
              Finalizar Examen
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
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
    const theme = getQuizTheme('matemáticas')

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
                  <Calculator className={cn("w-12 h-12", appTheme === 'dark' ? 'text-blue-400' : 'text-blue-500')} />
                </div>
                <div>
                  <h3 className={cn("text-xs font-medium", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estás realizando:</h3>
                  <h2 className={cn("text-base font-bold", appTheme === 'dark' ? 'text-white' : '')}>{quizData.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tiempo restante */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm",
                  timeLeft > 600
                    ? (appTheme === 'dark' ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200')
                    : timeLeft > 300
                      ? (appTheme === 'dark' ? 'bg-orange-900/50 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-200')
                      : (appTheme === 'dark' ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-200')
                )}>
                  <Clock className={cn("h-4 w-4", timeLeft > 600
                      ? 'text-green-500'
                      : timeLeft > 300
                        ? 'text-orange-500'
                        : 'text-red-500'
                    )} />
                  <span className={cn("text-sm font-medium font-mono", timeLeft > 600
                      ? (appTheme === 'dark' ? 'text-green-300' : 'text-green-700')
                      : timeLeft > 300
                        ? (appTheme === 'dark' ? 'text-orange-300' : 'text-orange-700')
                        : (appTheme === 'dark' ? 'text-red-300' : 'text-red-700')
                    )}>
                    {formatTimeLeft(timeLeft)}
                  </span>
                </div>
                {/* Preguntas respondidas */}
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", appTheme === 'dark' ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                  <span className="text-sm font-medium">{answeredQuestions} respondidas</span>
                </div>
                {/* Advertencias de cambio de pestaña */}
                {tabChangeCount > 0 && (
                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", appTheme === 'dark' ? 'bg-orange-900/50 border-orange-700' : 'bg-orange-50 border-orange-200')}>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className={cn("text-sm font-medium", appTheme === 'dark' ? 'text-orange-300' : 'text-orange-700')}>
                      {2 - tabChangeCount} intentos restantes
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Card className={cn(`mb-6 ${theme.cardBackground} shadow-xl backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={cn(`text-xl ${theme.primaryColor}`, appTheme === 'dark' ? 'text-white' : '')}>Pregunta {currentQuestion + 1}</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn("px-2 py-1 rounded-full", appTheme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                    {currentQ.topic}
                  </span>
                  <span className={cn("px-2 py-1 rounded-full", appTheme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')}>
                    {currentQ.level}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none">
                {/* Texto informativo */}
                {currentQ.informativeText && (
                  <div className={cn("mb-4 p-4 rounded-lg border", appTheme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200')}>
                    <p className={cn("leading-relaxed", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{stripHtmlTags(currentQ.informativeText)}</p>
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
                  <p className={cn("leading-relaxed text-lg font-medium", appTheme === 'dark' ? 'text-white' : 'text-gray-900')}>{stripHtmlTags(currentQ.questionText)}</p>
                )}
              </div>
              
              {/* Detectar si todas las opciones tienen imágenes y no tienen texto significativo */}
              {(() => {
                const allOptionsHaveImages = currentQ.options.every(opt => opt.imageUrl);
                const noSignificantText = currentQ.options.every(opt => !opt.text || stripHtmlTags(opt.text).trim().length === 0);
                const isImageOnlyLayout = allOptionsHaveImages && noSignificantText;

                if (isImageOnlyLayout) {
                  // Layout 2x2 para respuestas solo con imágenes
                  return (
                    <RadioGroup
                      value={answers[questionId] || ""}
                      onValueChange={(value) => handleAnswerChange(questionId, value)}
                      className="mt-6"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        {currentQ.options.map((option) => {
                          return (
                            <div
                              key={option.id}
                              onClick={() => handleAnswerChange(questionId, option.id)}
                              className={cn(
                                `relative rounded-lg p-2 transition-all duration-200 cursor-pointer border-2`,
                                answers[questionId] === option.id
                                  ? appTheme === 'dark'
                                    ? 'border-purple-500 bg-purple-900/30'
                                    : 'border-purple-500 bg-purple-50'
                                  : appTheme === 'dark'
                                    ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700'
                                    : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50/50'
                              )}
                            >
                              <RadioGroupItem
                                value={option.id}
                                id={`${questionId}-${option.id}`}
                                className="absolute top-1.5 left-1.5 z-10"
                              />
                              <div className="flex flex-col items-center justify-center pt-5">
                                <span className={cn(`font-bold text-sm mb-1.5`, appTheme === 'dark' ? 'text-purple-400' : theme.primaryColor)}>
                                  {option.id}.
                                </span>
                                {option.imageUrl && (
                                  <div 
                                    className="relative w-full flex justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomedImage(option.imageUrl || null);
                                    }}
                                  >
                                    <img 
                                      src={option.imageUrl} 
                                      alt={`Opción ${option.id}`}
                                      className="max-w-[180px] max-h-[120px] w-auto h-auto rounded-md cursor-zoom-in hover:opacity-90 transition-opacity object-contain"
                                      onError={(e) => {
                                        console.error('Error cargando imagen de opción:', option.imageUrl);
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 rounded-md">
                                      <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </RadioGroup>
                  );
                } else {
                  // Layout normal para respuestas con texto o mixtas
                  return (
                    <RadioGroup
                      value={answers[questionId] || ""}
                      onValueChange={(value) => handleAnswerChange(questionId, value)}
                      className="space-y-0.5 mt-6"
                    >
                      {currentQ.options.map((option) => (
                        <div
                          key={option.id}
                          onClick={() => handleAnswerChange(questionId, option.id)}
                          className={cn(
                            `flex items-start space-x-3 rounded-lg p-4 transition-all duration-200 relative overflow-hidden cursor-pointer`,
                            appTheme === 'dark' 
                              ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 border' 
                              : `${theme.answerBorder} ${theme.answerBackground} ${theme.answerHover}`
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
                            <div className="flex items-start gap-3">
                              <span className={cn(`font-bold mr-2 text-base flex-shrink-0`, appTheme === 'dark' ? 'text-purple-400' : theme.primaryColor)}>{option.id}.</span>
                              <div className="flex-1">
                                {option.text && (
                                  <span className={cn(`text-base leading-relaxed`, appTheme === 'dark' ? 'text-gray-300' : theme.answerText)}>{stripHtmlTags(option.text)}</span>
                                )}
                                {option.imageUrl && (
                                  <div 
                                    className="mt-2 flex justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomedImage(option.imageUrl || null);
                                    }}
                                  >
                                    <div className="relative">
                                      <img 
                                        src={option.imageUrl} 
                                        alt={`Opción ${option.id}`}
                                        className="option-image cursor-zoom-in hover:opacity-90 transition-opacity"
                                        onError={(e) => {
                                          console.error('Error cargando imagen de opción:', option.imageUrl);
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 rounded">
                                        <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  );
                }
              })()}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={nextQuestion}
                disabled={currentQuestion === quizData.questions.length - 1}
                className={`flex items-center gap-2 ${theme.buttonGradient} ${theme.buttonHover} text-white shadow-lg`}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Panel lateral derecho con navegación de preguntas */}
        <div className="w-full lg:w-56 flex-shrink-0 relative z-10">
          <div className={cn(`${theme.cardBackground} border rounded-lg p-3 sticky top-4 shadow-lg backdrop-blur-sm`, appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <h3 className={cn("text-xs font-semibold mb-2.5 uppercase tracking-wide", appTheme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
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
                        : (appTheme === 'dark' ? "bg-zinc-700 text-gray-300 border border-zinc-600 hover:bg-zinc-600 hover:border-purple-500" : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 hover:border-purple-300")
                    )}
                    title={`Pregunta ${index + 1}${isAnswered ? " - Respondida" : " - Sin responder"}`}
                  >
                    {index + 1}
                    {isAnswered && !isCurrent && (
                      <CheckCircle2 className={cn("absolute -top-1 -right-1 h-3 w-3 text-green-500 rounded-full", appTheme === 'dark' ? 'bg-zinc-800' : 'bg-white')} />
                    )}
                  </button>
                )
              })}
            </div>

            <div className={cn("mt-4 pt-4 border-t", appTheme === 'dark' ? 'border-zinc-700' : '')}>
              <div className={cn("text-sm mb-2", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Progreso del examen</div>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-sm font-medium", appTheme === 'dark' ? 'text-white' : '')}>
                  {answeredQuestions}/{quizData.questions.length}
                </span>
                <span className={cn("text-sm", appTheme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {Math.round((answeredQuestions / quizData.questions.length) * 100)}%
                </span>
              </div>
              <Progress value={(answeredQuestions / quizData.questions.length) * 100} className="h-2" />

              <Button
                onClick={showSubmitWarning}
                disabled={isSubmitting}
                className={`w-full mt-4 ${theme.buttonGradient} ${theme.buttonHover} text-white shadow-lg`}
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
                <p className={cn("text-xs text-center mt-2", appTheme === 'dark' ? 'text-orange-400' : 'text-orange-500')}>
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

  // Pantalla de bloqueo
  const BlockedScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className={cn("shadow-lg", appTheme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-red-800' : 'border-red-200')}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", appTheme === 'dark' ? 'bg-red-900/50' : 'bg-red-100')}>
              <AlertCircle className={cn("h-8 w-8", appTheme === 'dark' ? 'text-red-400' : 'text-red-600')} />
            </div>
          </div>
          <CardTitle className={cn("text-2xl", appTheme === 'dark' ? 'text-red-400' : 'text-red-800')}>Examen Terminado</CardTitle>
          <CardDescription className={cn("text-lg", appTheme === 'dark' ? 'text-gray-400' : '')}>
            Este examen ya fue completado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={cn(appTheme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50')}>
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className={cn(appTheme === 'dark' ? 'text-red-300' : 'text-red-800')}>Información</AlertTitle>
            <AlertDescription className={cn(appTheme === 'dark' ? 'text-red-200' : 'text-red-700')}>
             -l.,ñl .
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
  )

  // Renderizado principal
  const theme = getQuizTheme('matemáticas')
  return (
    <div 
      className={cn("min-h-screen quiz-gradient-bg relative", appTheme === 'dark' ? 'bg-zinc-900' : '')}
      style={appTheme === 'dark' ? {} : getQuizBackgroundStyle(theme)}
    >
      {examState === 'loading' && <LoadingScreen />}
      {examState === 'error' && <ErrorScreen />}
      {examState === 'blocked' && <BlockedScreen />}
      {examState === 'no_questions' && <NoQuestionsScreen />}
      {examState === 'welcome' && <WelcomeScreen />}
      {examState === 'active' && <ExamScreen />}
      {examState === 'completed' && <CompletedScreen />}
      {examState === 'already_taken' && <AlreadyTakenScreen />}

      {/* Modales */}
      {showWarning && <SubmitWarningModal />}
      {showFullscreenExit && <FullscreenExitModal />}
      
      {/* Modal de zoom para imágenes */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setZoomedImage(null)}
              className={cn(
                "absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors",
                appTheme === 'dark' ? 'text-white' : 'text-white'
              )}
            >
              <X className="h-8 w-8" />
            </button>
            <img 
              src={zoomedImage} 
              alt="Imagen ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamWithFirebase;

