import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Lock, 
  Play, 
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { PhaseType } from '@/interfaces/phase.interface';
import { dbService } from '@/services/firebase/db.service';
import { useThemeContext } from '@/context/ThemeContext';

// Lista de todas las materias del sistema
const ALL_SUBJECTS = [
  'Matemáticas',
  'Lenguaje',
  'Ciencias Sociales',
  'Biologia',
  'Quimica',
  'Física',
  'Inglés'
];

interface SubjectPhaseStatusProps {
  subject: string;
  theme?: 'light' | 'dark';
  onPhaseSelect?: (phase: PhaseType) => void;
}

interface PhaseState {
  phase: PhaseType;
  canAccess: boolean;
  isCompleted: boolean;
  isInProgress: boolean;
  isExamCompleted: boolean; // Si el examen específico ya fue completado
  allSubjectsCompleted: boolean; // Si todas las materias de la fase están completadas
  reason?: string;
}

export default function SubjectPhaseStatus({ 
  subject, 
  theme: propTheme,
  onPhaseSelect 
}: SubjectPhaseStatusProps) {
  const { user } = useAuthContext();
  const { theme: contextTheme } = useThemeContext();
  const navigate = useNavigate();
  const theme = propTheme || contextTheme;
  
  const [phaseStates, setPhaseStates] = useState<Record<PhaseType, PhaseState>>({
    first: { phase: 'first', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
    second: { phase: 'second', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
    third: { phase: 'third', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [availablePhase, setAvailablePhase] = useState<PhaseType | null>(null);

  useEffect(() => {
    if (user?.uid) {
      loadPhaseStates();
    }
  }, [user, subject]);

  // Recargar estados cuando la ventana vuelve a tener foco (después de completar un examen)
  useEffect(() => {
    if (!user?.uid) return;
    
    const handleFocus = () => {
      loadPhaseStates();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.uid, subject]);

  const loadPhaseStates = async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      // Obtener información del estudiante
      const userResult = await dbService.getUserById(user.uid);
      if (!userResult.success || !userResult.data) {
        console.error('Error obteniendo información del estudiante');
        setIsLoading(false);
        return;
      }

      const studentData = userResult.data;
      const gradeId = studentData.gradeId || studentData.grade;
      
      if (!gradeId) {
        console.error('No se encontró gradeId para el estudiante');
        setIsLoading(false);
        return;
      }

      const newStates: Record<PhaseType, PhaseState> = {
        first: { phase: 'first', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
        second: { phase: 'second', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
        third: { phase: 'third', canAccess: false, isCompleted: false, isInProgress: false, isExamCompleted: false, allSubjectsCompleted: false },
      };

      // Verificar cada fase
      for (const phase of ['first', 'second', 'third'] as PhaseType[]) {
        // Verificar acceso
        const accessResult = await phaseAuthorizationService.canStudentAccessPhase(
          user.uid,
          gradeId,
          phase
        );

        if (accessResult.success) {
          newStates[phase].canAccess = accessResult.data.canAccess;
          newStates[phase].reason = accessResult.data.reason;
        }

        // Verificar progreso
        const progressResult = await phaseAuthorizationService.getStudentPhaseProgress(
          user.uid,
          phase
        );

        if (progressResult.success && progressResult.data) {
          const progress = progressResult.data;
          // Normalizar nombres de materias para comparación (case-insensitive)
          const normalizedSubject = subject.trim();
          const completedSubjects = (progress.subjectsCompleted || []).map((s: string) => s.trim());
          const inProgressSubjects = (progress.subjectsInProgress || []).map((s: string) => s.trim());
          
          // Comparación case-insensitive
          newStates[phase].isCompleted = completedSubjects.some(
            (s: string) => s.toLowerCase() === normalizedSubject.toLowerCase()
          );
          newStates[phase].isInProgress = inProgressSubjects.some(
            (s: string) => s.toLowerCase() === normalizedSubject.toLowerCase()
          );
          
          // Verificar si todas las materias están completadas
          newStates[phase].allSubjectsCompleted = completedSubjects.length >= ALL_SUBJECTS.length;
          
          // Debug logs
          if (phase === 'first') {
            console.log(`[SubjectPhaseStatus] ${subject} - Fase ${phase}:`, {
              normalizedSubject,
              isCompleted: newStates[phase].isCompleted,
              allSubjectsCompleted: newStates[phase].allSubjectsCompleted,
              completedCount: completedSubjects.length,
              totalSubjects: ALL_SUBJECTS.length,
              completedSubjects: completedSubjects
            });
          }
        }

        // VERIFICACIÓN CRÍTICA: Consultar directamente los exámenes guardados en Firestore
        // Ruta: results/estudiante/fase/examen
        // Esto es la fuente de verdad para verificar si un examen está completado
        // Para fase 2, buscar tanto en "fase II" (antiguo) como "Fase II" (nuevo) para retrocompatibilidad
        try {
          const { getFirestore, collection, getDocs } = await import('firebase/firestore');
          const { firebaseApp } = await import('@/services/db');
          const db = getFirestore(firebaseApp);
          const { getPhaseName } = await import('@/utils/firestoreHelpers');
          
          const phaseName = getPhaseName(phase);
          
          // Para fase 2, buscar en ambas carpetas (antigua y nueva) para retrocompatibilidad
          let resultsSnapshot;
          if (phase === 'second') {
            // Intentar primero con el nombre nuevo "Fase II"
            const newPhaseName = 'Fase II';
            const newResultsRef = collection(db, 'results', user.uid, newPhaseName);
            const newSnapshot = await getDocs(newResultsRef);
            
            // Intentar también con el nombre antiguo "fase II" para retrocompatibilidad
            const oldPhaseName = 'fase II';
            const oldResultsRef = collection(db, 'results', user.uid, oldPhaseName);
            const oldSnapshot = await getDocs(oldResultsRef);
            
            // Combinar ambos resultados
            const allDocs = [...newSnapshot.docs, ...oldSnapshot.docs];
            resultsSnapshot = {
              docs: allDocs,
              empty: allDocs.length === 0,
              size: allDocs.length
            } as any;
            
            console.log(`[SubjectPhaseStatus] 🔍 Búsqueda retrocompatible Fase 2:`, {
              newPhaseName,
              oldPhaseName,
              newDocs: newSnapshot.docs.length,
              oldDocs: oldSnapshot.docs.length,
              totalDocs: allDocs.length
            });
          } else {
            // Para otras fases, usar el nombre normal
            const resultsRef = collection(db, 'results', user.uid, phaseName);
            resultsSnapshot = await getDocs(resultsRef);
          }
          
          // Verificar si hay algún examen completado para esta materia específica
          const normalizedSubject = subject.trim().toLowerCase();
          let foundCompletedExam = false;
          
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
          
          console.log(`[SubjectPhaseStatus] 🔍 Buscando examen completado en Firestore:`, {
            subject,
            normalizedSubject,
            phase,
            phaseName,
            totalDocs: resultsSnapshot.docs.length
          });
          
          resultsSnapshot.docs.forEach((doc: any) => {
            const examData = doc.data();
            const examSubject = (examData.subject || '').trim().toLowerCase();
            const examCompleted = examData.completed === true;
            
            // FALLBACK: Si no hay campo subject, intentar detectar por el ID del documento
            // Los IDs de exámenes dinámicos siguen el patrón: <CODIGO_MATERIA><GRADO><NUMERO>
            // Ejemplo: IN11305670 = Inglés (IN), grado 1, número 305670
            let detectedSubject = examSubject;
            if (!examSubject && doc.id) {
              const docIdUpper = doc.id.toUpperCase();
              // Buscar si el ID empieza con algún código de materia conocido
              for (const [code, subjectName] of Object.entries(subjectCodeMap)) {
                if (docIdUpper.startsWith(code)) {
                  detectedSubject = subjectName;
                  console.log(`[SubjectPhaseStatus] 🔍 Examen sin campo subject detectado por ID: ${doc.id} -> ${subjectName} (código: ${code})`);
                  break;
                }
              }
            }
            
            console.log(`[SubjectPhaseStatus] 📄 Revisando documento ${doc.id}:`, {
              examSubject,
              detectedSubject,
              normalizedSubject,
              examCompleted,
              match: detectedSubject === normalizedSubject,
              willMatch: examCompleted && detectedSubject === normalizedSubject
            });
            
            // Si el examen está completado y es de la materia correcta
            if (examCompleted && detectedSubject === normalizedSubject) {
              foundCompletedExam = true;
              console.log(`[SubjectPhaseStatus] ✅ Examen completado encontrado en Firestore: ${subject} - Fase ${phase} - Doc ID: ${doc.id}`, {
                examData: {
                  subject: examData.subject,
                  completed: examData.completed,
                  score: examData.score
                },
                detectedBy: examData.subject ? 'subject field' : 'document ID'
              });
              
              // Si el examen no tiene el campo subject, marcarlo para actualizar después
              if (!examData.subject) {
                console.log(`[SubjectPhaseStatus] 🔄 Examen sin campo subject detectado: ${doc.id} - Se actualizará después`);
              }
            }
          });
          
          if (!foundCompletedExam && resultsSnapshot.docs.length > 0) {
            console.log(`[SubjectPhaseStatus] ⚠️ No se encontró examen completado para ${subject} en Fase ${phase}. Documentos encontrados:`, 
              resultsSnapshot.docs.map((doc: any) => ({
                id: doc.id,
                subject: doc.data().subject,
                completed: doc.data().completed
              }))
            );
          }
          
          // IMPORTANTE: Si encontramos un examen completado en Firestore, marcar como completado
          // Esto es la fuente de verdad, independientemente del estado del progreso
          if (foundCompletedExam) {
            // Guardar el estado anterior para verificar si necesita sincronización
            const wasInProgress = newStates[phase].isCompleted;
            
            newStates[phase].isExamCompleted = true;
            newStates[phase].isCompleted = true;
            
            console.log(`[SubjectPhaseStatus] ✅ Examen completado encontrado en Firestore: ${subject} - Fase ${phase}`, {
              wasInProgress,
              isExamCompleted: newStates[phase].isExamCompleted,
              allSubjectsCompleted: newStates[phase].allSubjectsCompleted
            });
            
            // Actualizar exámenes antiguos que no tienen el campo subject
            // Buscar el documento que encontramos y actualizarlo si es necesario
            for (const docSnapshot of resultsSnapshot.docs) {
              const examData = docSnapshot.data();
              if (!examData.subject && examData.completed && gradeId) {
                // Detectar por ID del documento
                const docIdUpper = docSnapshot.id.toUpperCase();
                const subjectCodeMap: Record<string, string> = {
                  'IN': 'inglés',
                  'MA': 'matemáticas',
                  'LE': 'lenguaje',
                  'CS': 'ciencias sociales',
                  'BI': 'biologia',
                  'QU': 'quimica',
                  'FI': 'física'
                };
                
                for (const [code, subjectName] of Object.entries(subjectCodeMap)) {
                  if (docIdUpper.startsWith(code) && subjectName === normalizedSubject) {
                    console.log(`[SubjectPhaseStatus] 🔄 Actualizando examen antiguo: agregando campo subject a ${docSnapshot.id}`);
                    try {
                      const { updateDoc, doc: docFn } = await import('firebase/firestore');
                      const examRef = docFn(db, 'results', user.uid, phaseName, docSnapshot.id);
                      await updateDoc(examRef, {
                        subject: subject
                      });
                      console.log(`[SubjectPhaseStatus] ✅ Campo subject agregado a ${docSnapshot.id}`);
                    } catch (error) {
                      console.error(`[SubjectPhaseStatus] ❌ Error actualizando examen:`, error);
                    }
                    break;
                  }
                }
              }
            }
            
            // Si no estaba en el progreso, sincronizar
            if (!wasInProgress && gradeId) {
              console.log(`[SubjectPhaseStatus] Sincronizando progreso para ${subject} - Fase ${phase}`);
              try {
                await phaseAuthorizationService.updateStudentPhaseProgress(
                  user.uid,
                  gradeId,
                  phase,
                  subject,
                  true
                );
                console.log(`[SubjectPhaseStatus] ✅ Progreso sincronizado para ${subject} - Fase ${phase}`);
              } catch (error) {
                console.error(`[SubjectPhaseStatus] ❌ Error sincronizando progreso:`, error);
              }
            }
          } else {
            // Si no hay examen completado en Firestore, el examen NO está completado
            // CRÍTICO: isExamCompleted debe ser false si no se encuentra examen en Firestore
            // Esto asegura que exámenes no presentados estén disponibles
            newStates[phase].isExamCompleted = false;
            // Si el progreso dice que está completado pero no hay examen en Firestore, 
            // hay una inconsistencia - priorizar Firestore como fuente de verdad
            if (newStates[phase].isCompleted) {
              console.log(`[SubjectPhaseStatus] ⚠️ Inconsistencia detectada: progreso marca ${subject} como completada en Fase ${phase}, pero no hay examen en Firestore. Priorizando Firestore.`);
              newStates[phase].isCompleted = false;
            }
            console.log(`[SubjectPhaseStatus] No se encontró examen completado en Firestore para ${subject} - Fase ${phase}`, {
              isCompleted: newStates[phase].isCompleted,
              isExamCompleted: newStates[phase].isExamCompleted,
              message: 'Examen NO completado - debe estar disponible si la fase está autorizada'
            });
          }
        } catch (error) {
          console.error(`[SubjectPhaseStatus] Error consultando exámenes guardados:`, error);
          // En caso de error, asumir que el examen NO está completado para evitar bloqueos incorrectos
          // Es mejor permitir acceso que bloquear incorrectamente
          newStates[phase].isExamCompleted = false;
          console.log(`[SubjectPhaseStatus] Error al consultar Firestore, asumiendo examen NO completado para ${subject} - Fase ${phase}`);
        }
      }

      setPhaseStates(newStates);

      // Determinar qué fase mostrar basándose en el estado real del estudiante
      // Estrategia: Buscar la primera fase disponible que el estudiante puede acceder
      // y que NO esté completada para esta materia específica
      let foundPhase: PhaseType | null = null;
      
      // PASO 1: Buscar la primera fase disponible (canAccess = true) que NO esté completada para esta materia
      // PRIORIDAD: Exámenes no presentados (isExamCompleted = false) con fase autorizada deben estar disponibles
      for (const phase of ['first', 'second', 'third'] as PhaseType[]) {
        const state = newStates[phase];
        
        // Verificar si esta fase está bloqueada (completada pero esperando otras materias o autorización)
        const nextPhase: PhaseType | null = phase === 'first' ? 'second' : phase === 'second' ? 'third' : null;
        const nextPhaseAuthorized = nextPhase ? newStates[nextPhase].canAccess : false;
        const isBlocked = state.isExamCompleted && !state.allSubjectsCompleted && !nextPhaseAuthorized;
        
        // Fase disponible si:
        // - Tiene acceso (canAccess = true) - verificado desde la base de datos
        // - NO está bloqueada (solo bloqueada si examen completado, no todas completadas, y siguiente fase no autorizada)
        // - NO está completada para esta materia específica (isExamCompleted = false)
        // CRÍTICO: Si isExamCompleted = false y canAccess = true, la fase DEBE estar disponible
        if (state.canAccess && !isBlocked && !state.isExamCompleted && !state.isCompleted) {
          foundPhase = phase;
          console.log(`[SubjectPhaseStatus] ✅ Fase ${phase} disponible para ${subject}:`, {
            canAccess: state.canAccess,
            isExamCompleted: state.isExamCompleted,
            isCompleted: state.isCompleted,
            isBlocked,
            allSubjectsCompleted: state.allSubjectsCompleted,
            nextPhaseAuthorized
          });
          break;
        }
      }
      
      // PASO 2: Si no se encontró fase disponible, buscar la primera fase bloqueada que deba mostrarse
      // (completada para esta materia pero esperando otras materias o autorización)
      if (!foundPhase) {
        for (const phase of ['first', 'second', 'third'] as PhaseType[]) {
          const state = newStates[phase];
          const nextPhase: PhaseType | null = phase === 'first' ? 'second' : phase === 'second' ? 'third' : null;
          const nextPhaseAuthorized = nextPhase ? newStates[nextPhase].canAccess : false;
          const isBlocked = state.isExamCompleted && !state.allSubjectsCompleted && !nextPhaseAuthorized;
          
          // Mostrar fase bloqueada si:
          // - El examen está completado para esta materia
          // - Pero no todas las materias están completadas
          // - Y la siguiente fase no está autorizada
          // - Y tiene acceso (canAccess = true)
          if (isBlocked && state.canAccess) {
            foundPhase = phase;
            console.log(`[SubjectPhaseStatus] 🔒 Fase ${phase} bloqueada para ${subject} (se mostrará como bloqueada):`, {
              isExamCompleted: state.isExamCompleted,
              allSubjectsCompleted: state.allSubjectsCompleted,
              nextPhaseAuthorized,
              canAccess: state.canAccess
            });
            break;
          }
        }
      }
      
      // PASO 3: Si aún no hay fase, mostrar la primera fase que el estudiante puede acceder
      // PERO solo si el examen NO está completado (para evitar mostrar fases bloqueadas incorrectamente)
      // Esto asegura que siempre se muestre algo, pero prioriza exámenes no presentados
      if (!foundPhase) {
        for (const phase of ['first', 'second', 'third'] as PhaseType[]) {
          const state = newStates[phase];
          // Solo usar como fallback si tiene acceso Y el examen NO está completado
          // Si el examen está completado, ya debería haberse encontrado en PASO 2
          if (state.canAccess && !state.isExamCompleted) {
            foundPhase = phase;
            console.log(`[SubjectPhaseStatus] 📌 Mostrando Fase ${phase} como fallback para ${subject}:`, {
              canAccess: state.canAccess,
              isExamCompleted: state.isExamCompleted,
              isCompleted: state.isCompleted
            });
            break;
          }
        }
      }
      
      // PASO 4: Si aún no hay fase, usar Fase 1 por defecto
      if (!foundPhase) {
        foundPhase = 'first';
        console.log(`[SubjectPhaseStatus] ⚠️ No se encontró fase disponible, usando Fase 1 por defecto para ${subject}`);
      }
      
      // DEBUG: Log del estado final de todas las fases
      console.log(`[SubjectPhaseStatus] 📊 Estado final de fases para ${subject}:`, {
        first: {
          isExamCompleted: newStates.first.isExamCompleted,
          isCompleted: newStates.first.isCompleted,
          allSubjectsCompleted: newStates.first.allSubjectsCompleted,
          canAccess: newStates.first.canAccess
        },
        second: {
          isExamCompleted: newStates.second.isExamCompleted,
          isCompleted: newStates.second.isCompleted,
          allSubjectsCompleted: newStates.second.allSubjectsCompleted,
          canAccess: newStates.second.canAccess
        },
        third: {
          isExamCompleted: newStates.third.isExamCompleted,
          isCompleted: newStates.third.isCompleted,
          allSubjectsCompleted: newStates.third.allSubjectsCompleted,
          canAccess: newStates.third.canAccess
        },
        foundPhase
      });
      
      setAvailablePhase(foundPhase);

    } catch (error) {
      console.error('Error cargando estados de fases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPhaseName = (phase: PhaseType): string => {
    const names: Record<PhaseType, string> = {
      first: 'Fase 1',
      second: 'Fase 2',
      third: 'Fase 3',
    };
    return names[phase];
  };

  const getPhaseStatus = (phase: PhaseType) => {
    const state = phaseStates[phase];
    
    // Si el examen ya fue completado pero no todas las materias están completadas
    // y la siguiente fase no está autorizada, está bloqueado
    const nextPhase: PhaseType | null = phase === 'first' ? 'second' : phase === 'second' ? 'third' : null;
    const nextPhaseAuthorized = nextPhase ? phaseStates[nextPhase].canAccess : false;
    
    console.log(`[SubjectPhaseStatus] getPhaseStatus para ${subject} - Fase ${phase}:`, {
      isExamCompleted: state.isExamCompleted,
      allSubjectsCompleted: state.allSubjectsCompleted,
      nextPhaseAuthorized,
      canAccess: state.canAccess,
      isCompleted: state.isCompleted,
      isInProgress: state.isInProgress,
      shouldBlock: state.isExamCompleted && !state.allSubjectsCompleted && !nextPhaseAuthorized
    });
    
    // CRÍTICO: Si el examen NO está completado (isExamCompleted = false) y tiene acceso,
    // debe estar disponible, NO bloqueado
    // Solo bloquear si el examen está completado Y no todas las materias están completadas Y la siguiente fase no está autorizada
    if (state.isExamCompleted && !state.allSubjectsCompleted && !nextPhaseAuthorized) {
      console.log(`[SubjectPhaseStatus] 🔒 BLOQUEANDO ${subject} - Fase ${phase} (examen completado, esperando otras materias)`);
      return {
        status: 'locked',
        label: 'Bloqueada',
        icon: Lock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-zinc-800',
        reason: 'Esperando...'
      };
    }
    
    // Si todas las materias están completadas, la fase está completada
    if (state.isCompleted && state.allSubjectsCompleted) {
      return {
        status: 'completed',
        label: 'Completada',
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
      };
    }

    // Si no tiene acceso, no está habilitado (fase no autorizada)
    if (!state.canAccess) {
      return {
        status: 'locked',
        label: 'No habilitado',
        icon: Lock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-zinc-800',
      };
    }

    // Si está en progreso, mostrar estado en progreso
    if (state.isInProgress) {
      return {
        status: 'in_progress',
        label: 'En progreso',
        icon: Clock,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      };
    }

    // Si tiene acceso y el examen NO está completado, está disponible
    // Esta es la condición por defecto para exámenes no presentados con fase autorizada
    return {
      status: 'available',
      label: 'Disponible',
      icon: CheckCircle2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    };
  };

  const handlePhaseClick = (phase: PhaseType) => {
    if (onPhaseSelect) {
      onPhaseSelect(phase);
    } else {
      // Fallback: navegar directamente si no hay callback
      const link = `/quiz?subject=${encodeURIComponent(subject)}&phase=${phase}`;
      navigate(link);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  // Determinar qué fase mostrar
  // Usar la fase disponible calculada, o Fase 1 por defecto
  const displayPhase: PhaseType = availablePhase || 'first';
  
  console.log(`[SubjectPhaseStatus] 📌 Fase a mostrar para ${subject}: ${displayPhase}`, {
    first: {
      isCompleted: phaseStates.first.isCompleted,
      isExamCompleted: phaseStates.first.isExamCompleted,
      canAccess: phaseStates.first.canAccess
    },
    second: {
      isCompleted: phaseStates.second.isCompleted,
      isExamCompleted: phaseStates.second.isExamCompleted,
      canAccess: phaseStates.second.canAccess
    },
    third: {
      isCompleted: phaseStates.third.isCompleted,
      isExamCompleted: phaseStates.third.isExamCompleted,
      canAccess: phaseStates.third.canAccess
    },
    availablePhase,
    displayPhase
  });

  const phaseStatus = getPhaseStatus(displayPhase);
  const StatusIcon = phaseStatus.icon;

  // Verificar si todas las fases están completadas
  const allPhasesCompleted = 
    (phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) &&
    (phaseStates.second.isCompleted || phaseStates.second.isExamCompleted) &&
    (phaseStates.third.isCompleted || phaseStates.third.isExamCompleted);

  // Si todas las fases están completadas, solo mostrar el cuadro verde
  if (allPhasesCompleted) {
    return (
      <div className="space-y-3">
        <div className={cn(
          "flex items-center justify-center gap-2 px-3 py-2 rounded-md",
          theme === 'dark' 
            ? 'bg-green-900/30 text-green-300 border border-green-800/50' 
            : 'bg-green-50 text-green-700 border border-green-200'
        )}>
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Fases completadas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Estado de la fase actual */}
      <div className={cn(
        "rounded-lg p-3 border",
        phaseStatus.bgColor,
        theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-4 w-4", phaseStatus.color)} />
            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {getPhaseName(displayPhase)}
            </span>
          </div>
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md",
            phaseStatus.status === 'completed' && 'bg-green-500',
            phaseStatus.status === 'in_progress' && 'bg-yellow-500',
            phaseStatus.status === 'available' && 'bg-blue-500',
            phaseStatus.status === 'locked' && phaseStatus.label === 'No habilitado' && 'bg-gray-500',
            phaseStatus.status === 'locked' && phaseStatus.label === 'Bloqueada' && 'bg-gray-500'
          )}>
            <StatusIcon className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Indicadores de fases completadas con chulitos */}
        {phaseStatus.status !== 'locked' && 
          ((phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) ||
           (phaseStates.second.isCompleted || phaseStates.second.isExamCompleted)) && (
          <div className="flex items-center justify-center gap-2 mb-2">
            {(phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md",
                theme === 'dark' 
                  ? 'bg-green-900/30 text-green-300' 
                  : 'bg-green-50 text-green-700'
              )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Fase 1</span>
              </div>
            )}
            {(phaseStates.second.isCompleted || phaseStates.second.isExamCompleted) && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md",
                theme === 'dark' 
                  ? 'bg-green-900/30 text-green-300' 
                  : 'bg-green-50 text-green-700'
              )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Fase 2</span>
              </div>
            )}
          </div>
        )}

        {/* Mensaje de bloqueo */}
        {/*{phaseStatus.status === 'locked' && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {phaseStatus.reason || state.reason || 'Segunda fase en proceso.'}
            </AlertDescription>
          </Alert>
        )}*/}

        {/* Botón de acción */}
        {phaseStatus.status === 'available' && (
          <Button
            onClick={() => handlePhaseClick(displayPhase)}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Presentar Prueba
          </Button>
        )}

        {phaseStatus.status === 'in_progress' && (
          <Button
            onClick={() => handlePhaseClick(displayPhase)}
            className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700 text-white"
            size="sm"
          >
            <Clock className="h-4 w-4 mr-2" />
            Continuar Prueba
          </Button>
        )}

        {/*{phaseStatus.status === 'locked' && (
          <div className={cn("mt-2 text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            No disponible en este momento
          </div>
        )}*/}

        {phaseStatus.status === 'completed' && (
          <div className={cn("mt-2 text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Esta fase ha sido completada
          </div>
        )}
      </div>

      {/* Indicador de espera de autorización */}
      {/*{phaseStatus.status === 'locked' && displayPhase !== 'first' && (
        <Alert className={cn(
          theme === 'dark' ? 'border-amber-800 bg-amber-900/30' : 'border-amber-200 bg-amber-50'
        )}>
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className={cn("text-xs", theme === 'dark' ? 'text-amber-200' : 'text-amber-700')}>
            Esperando autorización del administrador para desbloquear esta fase
          </AlertDescription>
        </Alert>
      )}*/}
    </div>
  );
}

