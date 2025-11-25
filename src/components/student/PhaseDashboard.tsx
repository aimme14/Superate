import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Lock, 
  Play, 
  Clock, 
  TrendingUp,
  BookOpen,
  Target,
  Award,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { StudentPhaseProgress, PhaseType } from '@/interfaces/phase.interface';
import { dbService } from '@/services/firebase/db.service';
import { useNotification } from '@/hooks/ui/useNotification';

interface PhaseDashboardProps {
  theme: 'light' | 'dark';
}

const PHASE_NAMES: Record<PhaseType, string> = {
  first: 'Fase 1 - Diagnóstico',
  second: 'Fase 2 - Refuerzo',
  third: 'Fase 3 - Simulacro ICFES',
};

const PHASE_DESCRIPTIONS: Record<PhaseType, string> = {
  first: 'Evaluación inicial para determinar tus fortalezas y debilidades',
  second: 'Refuerzo personalizado basado en tus resultados de la Fase 1',
  third: 'Simulacro final tipo ICFES con puntuación 0-500',
};

const SUBJECTS = [
  'Matemáticas',
  'Lenguaje',
  'Ciencias Sociales',
  'Biologia',
  'Quimica',
  'Física',
  'Inglés',
];

export default function PhaseDashboard({ theme }: PhaseDashboardProps) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { notifyError } = useNotification();
  
  const [phaseProgress, setPhaseProgress] = useState<Record<PhaseType, StudentPhaseProgress | null>>({
    first: null,
    second: null,
    third: null,
  });
  const [phaseAccess, setPhaseAccess] = useState<Record<PhaseType, { canAccess: boolean; reason?: string }>>({
    first: { canAccess: false },
    second: { canAccess: false },
    third: { canAccess: false },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadStudentData();
    }
  }, [user]);

  const loadStudentData = async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      // Obtener información del estudiante
      const userResult = await dbService.getUserById(user.uid);
      if (!userResult.success) {
        notifyError({ 
          title: 'Error',
          message: 'Error al cargar información del estudiante'
        });
        return;
      }

      const studentData = userResult.data;
      const studentGradeId = studentData.gradeId || studentData.grade;
      
      if (!studentGradeId) {
        notifyError({ 
          title: 'Error',
          message: 'No se encontró información de grado para el estudiante'
        });
        return;
      }

      // Cargar progreso y acceso para cada fase
      const phases: PhaseType[] = ['first', 'second', 'third'];
      const newProgress: Record<PhaseType, StudentPhaseProgress | null> = {
        first: null,
        second: null,
        third: null,
      };
      const newAccess: Record<PhaseType, { canAccess: boolean; reason?: string }> = {
        first: { canAccess: false },
        second: { canAccess: false },
        third: { canAccess: false },
      };

      for (const phase of phases) {
        // Cargar progreso
        const progressResult = await phaseAuthorizationService.getStudentPhaseProgress(user.uid, phase);
        if (progressResult.success && progressResult.data) {
          newProgress[phase] = progressResult.data;
        }

        // Verificar acceso
        const accessResult = await phaseAuthorizationService.canStudentAccessPhase(
          user.uid,
          studentGradeId,
          phase
        );
        if (accessResult.success) {
          newAccess[phase] = accessResult.data;
        }
      }

      setPhaseProgress(newProgress);
      setPhaseAccess(newAccess);
    } catch (error) {
      console.error('Error cargando datos del estudiante:', error);
      notifyError({ 
        title: 'Error',
        message: 'Error al cargar información de fases'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPhase = (phase: PhaseType) => {
    // Navegar a la página de selección de materia para la fase
    navigate(`/quiz?phase=${phase}`);
  };

  const getPhaseStatus = (phase: PhaseType) => {
    const progress = phaseProgress[phase];
    const access = phaseAccess[phase];

    if (!access.canAccess) {
      return {
        status: 'locked',
        label: 'Bloqueada',
        icon: Lock,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-zinc-800',
      };
    }

    if (progress?.status === 'completed') {
      return {
        status: 'completed',
        label: 'Completada',
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
      };
    }

    if (progress?.status === 'in_progress') {
      return {
        status: 'in_progress',
        label: 'En progreso',
        icon: Clock,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      };
    }

    return {
      status: 'available',
      label: 'Disponible',
      icon: Play,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    };
  };

  const getCompletedSubjectsCount = (phase: PhaseType) => {
    const progress = phaseProgress[phase];
    return progress?.subjectsCompleted.length || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Target className="h-5 w-5 text-blue-500" />
            Evaluaciones por Fases
          </CardTitle>
          <CardDescription>
            Sistema de evaluación en cascada. Completa cada fase para desbloquear la siguiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['first', 'second', 'third'] as PhaseType[]).map((phase) => {
            const status = getPhaseStatus(phase);
            const progress = phaseProgress[phase];
            const access = phaseAccess[phase];
            const completedSubjects = getCompletedSubjectsCount(phase);
            const StatusIcon = status.icon;

            return (
              <Card
                key={phase}
                className={cn(
                  'border-2 transition-all',
                  status.status === 'completed' && 'border-green-500',
                  status.status === 'in_progress' && 'border-yellow-500',
                  status.status === 'available' && 'border-blue-500',
                  status.status === 'locked' && 'border-gray-300 dark:border-zinc-700',
                  status.bgColor
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn('p-2 rounded-lg', status.color, status.bgColor)}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {PHASE_NAMES[phase]}
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {PHASE_DESCRIPTIONS[phase]}
                          </p>
                        </div>
                        <Badge
                          variant={
                            status.status === 'completed'
                              ? 'default'
                              : status.status === 'in_progress'
                              ? 'secondary'
                              : status.status === 'available'
                              ? 'outline'
                              : 'secondary'
                          }
                          className={cn(
                            status.status === 'completed' && 'bg-green-500 text-white',
                            status.status === 'in_progress' && 'bg-yellow-500 text-white',
                            status.status === 'available' && 'bg-blue-500 text-white'
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>

                      {status.status === 'locked' && access.reason && (
                        <Alert className={cn(
                          "mt-4",
                          theme === 'dark' ? 'bg-red-950/20 border-red-800' : 'bg-red-50 border-red-200'
                        )}>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <AlertTitle className="text-red-800 dark:text-red-200">Fase bloqueada</AlertTitle>
                          <AlertDescription className="text-red-700 dark:text-red-300">
                            {access.reason}
                          </AlertDescription>
                        </Alert>
                      )}

                      {status.status === 'in_progress' && progress && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                              Progreso
                            </span>
                            <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {completedSubjects} / {SUBJECTS.length} materias completadas
                            </span>
                          </div>
                          <Progress 
                            value={(completedSubjects / SUBJECTS.length) * 100} 
                            className="h-3"
                          />
                          
                          {/* Materias completadas */}
                          {progress.subjectsCompleted.length > 0 && (
                            <div className="mt-3">
                              <p className={cn("text-xs font-medium mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                Materias completadas ({progress.subjectsCompleted.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {progress.subjectsCompleted.map((subject) => (
                                  <Badge key={subject} variant="outline" className={cn(
                                    "text-xs border-green-500",
                                    theme === 'dark' ? 'bg-green-950/30 text-green-300' : 'bg-green-50 text-green-700'
                                  )}>
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                    {subject}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Materias pendientes */}
                          {progress.subjectsCompleted.length < SUBJECTS.length && (
                            <div className="mt-3">
                              <p className={cn("text-xs font-medium mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                Materias pendientes ({SUBJECTS.length - progress.subjectsCompleted.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {SUBJECTS.filter(s => !progress.subjectsCompleted.includes(s)).map((subject) => (
                                  <Badge key={subject} variant="outline" className={cn(
                                    "text-xs",
                                    theme === 'dark' ? 'bg-zinc-800 text-gray-400' : 'bg-gray-50 text-gray-600'
                                  )}>
                                    {subject}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Mensaje contextual */}
                          {completedSubjects === SUBJECTS.length && (
                            <Alert className={cn(
                              "mt-3",
                              theme === 'dark' ? 'bg-green-950/20 border-green-800' : 'bg-green-50 border-green-200'
                            )}>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <AlertTitle className="text-green-800 dark:text-green-200">
                                ¡Fase completada!
                              </AlertTitle>
                              <AlertDescription className="text-green-700 dark:text-green-300">
                                Has completado todas las materias de esta fase. Esperando autorización del administrador para avanzar a la siguiente fase.
                              </AlertDescription>
                            </Alert>
                          )}

                          {completedSubjects < SUBJECTS.length && completedSubjects > 0 && (
                            <Alert className={cn(
                              "mt-3",
                              theme === 'dark' ? 'bg-yellow-950/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'
                            )}>
                              <Clock className="h-4 w-4 text-yellow-500" />
                              <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                                En progreso
                              </AlertTitle>
                              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                                Faltan {SUBJECTS.length - completedSubjects} materia(s) para completar esta fase: {SUBJECTS.filter(s => !progress.subjectsCompleted.includes(s)).join(', ')}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}

                      {status.status === 'completed' && progress && (
                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                            <Award className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Fase completada el {new Date(progress.completedAt || '').toLocaleDateString()}
                            </span>
                          </div>
                          {progress.overallScore !== undefined && (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              Puntuación general: {progress.overallScore.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {status.status === 'available' || status.status === 'in_progress' ? (
                        <Button
                          onClick={() => handleStartPhase(phase)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {status.status === 'in_progress' ? (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Continuar
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Iniciar
                            </>
                          )}
                        </Button>
                      ) : status.status === 'completed' ? (
                        <Button
                          variant="outline"
                          onClick={() => navigate('/resultados')}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Ver Resultados
                        </Button>
                      ) : (
                        <Button variant="outline" disabled>
                          <Lock className="h-4 w-4 mr-2" />
                          Bloqueada
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <BookOpen className="h-5 w-5 text-purple-500" />
            Información sobre las Fases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Fase 1 - Diagnóstico
              </h4>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Esta fase evalúa tus conocimientos actuales en todas las materias. Al completarla, recibirás un análisis
                personalizado con tus fortalezas y debilidades, además de una ruta de mejoramiento generada por IA.
              </p>
            </div>
            <div>
              <h4 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Fase 2 - Refuerzo
              </h4>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Basada en tus resultados de la Fase 1, esta fase se enfoca en reforzar tus áreas débiles. El 50% de las
                preguntas estarán relacionadas con tu debilidad principal, mientras que el resto se distribuirá entre los
                demás temas.
              </p>
            </div>
            <div>
              <h4 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Fase 3 - Simulacro ICFES
              </h4>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Esta es la evaluación final tipo ICFES. Todos los temas se evalúan por igual y recibirás un puntaje en
                la escala oficial ICFES (0-500), junto con un diagnóstico final completo y recomendaciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

