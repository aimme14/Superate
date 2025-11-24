import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Users, 
  GraduationCap,
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/hooks/ui/useNotification';
import { useInstitutionOptions, useCampusOptions, useGradeOptions } from '@/hooks/query/useInstitutionQuery';
import { useAuthContext } from '@/context/AuthContext';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { PhaseAuthorization, GradePhaseCompletion, PhaseType } from '@/interfaces/phase.interface';
import { dbService } from '@/services/firebase/db.service';

interface PhaseAuthorizationManagementProps {
  theme: 'light' | 'dark';
}

const PHASE_NAMES: Record<PhaseType, string> = {
  first: 'Fase 1 - Diagnóstico',
  second: 'Fase 2 - Refuerzo',
  third: 'Fase 3 - Simulacro ICFES',
};

const PHASE_DESCRIPTIONS: Record<PhaseType, string> = {
  first: 'Evaluación inicial para determinar fortalezas y debilidades',
  second: 'Refuerzo personalizado basado en resultados de Fase 1',
  third: 'Simulacro final tipo ICFES con puntuación 0-500',
};

export default function PhaseAuthorizationManagement({ theme }: PhaseAuthorizationManagementProps) {
  const { notifySuccess, notifyError } = useNotification();
  const { user } = useAuthContext();
  const { options: institutions = [] } = useInstitutionOptions();
  
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [authorizations, setAuthorizations] = useState<PhaseAuthorization[]>([]);
  const [completions, setCompletions] = useState<Record<string, GradePhaseCompletion>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizeDialogOpen, setIsAuthorizeDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<PhaseType | null>(null);
  const [selectedGradeInfo, setSelectedGradeInfo] = useState<{ id: string; name: string; institutionId?: string; campusId?: string } | null>(null);

  const { options: campuses = [] } = useCampusOptions(selectedInstitution !== 'all' ? selectedInstitution : '');
  const { options: grades = [] } = useGradeOptions(
    selectedInstitution !== 'all' ? selectedInstitution : '',
    selectedCampus !== 'all' ? selectedCampus : ''
  );

  // Cargar autorizaciones y completitudes
  useEffect(() => {
    if (selectedGrade !== 'all') {
      loadAuthorizations();
      loadCompletions();
    }
  }, [selectedGrade]);

  const loadAuthorizations = async () => {
    if (selectedGrade === 'all') return;
    
    setIsLoading(true);
    try {
      const result = await phaseAuthorizationService.getGradeAuthorizations(selectedGrade);
      if (result.success) {
        setAuthorizations(result.data);
      } else {
        notifyError({ 
          title: 'Error',
          message: 'Error al cargar autorizaciones'
        });
      }
    } catch (error) {
      notifyError({ 
        title: 'Error',
        message: 'Error al cargar autorizaciones'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCompletions = async () => {
    if (selectedGrade === 'all') return;

    try {
      // Obtener número total de estudiantes del grado
      const studentsResult = await dbService.getFilteredStudents({
        gradeId: selectedGrade,
        isActive: true,
      });

      if (!studentsResult.success) return;

      const totalStudents = studentsResult.data.length;

      // Verificar completitud para cada fase
      const phases: PhaseType[] = ['first', 'second', 'third'];
      const newCompletions: Record<string, GradePhaseCompletion> = {};

      for (const phase of phases) {
        const completionResult = await phaseAuthorizationService.checkGradePhaseCompletion(
          selectedGrade,
          phase,
          totalStudents
        );

        if (completionResult.success) {
          newCompletions[phase] = completionResult.data;
        }
      }

      setCompletions(newCompletions);
    } catch (error) {
      console.error('Error al cargar completitudes:', error);
    }
  };

  const handleAuthorize = async () => {
    if (!selectedPhase || !selectedGradeInfo || !user?.uid) return;

    setIsLoading(true);
    try {
      const result = await phaseAuthorizationService.authorizePhase(
        selectedGradeInfo.id,
        selectedGradeInfo.name,
        selectedPhase,
        user.uid,
        selectedGradeInfo.institutionId,
        selectedGradeInfo.campusId
      );

      if (result.success) {
        notifySuccess({ 
          title: 'Fase autorizada',
          message: `Fase ${PHASE_NAMES[selectedPhase]} autorizada para ${selectedGradeInfo.name}`
        });
        setIsAuthorizeDialogOpen(false);
        setSelectedPhase(null);
        setSelectedGradeInfo(null);
        await loadAuthorizations();
        await loadCompletions();
      } else {
        notifyError({ 
          title: 'Error',
          message: 'Error al autorizar fase'
        });
      }
    } catch (error) {
      notifyError({ 
        title: 'Error',
        message: 'Error al autorizar fase'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedPhase || !selectedGradeInfo) return;

    setIsLoading(true);
    try {
      const result = await phaseAuthorizationService.revokePhaseAuthorization(
        selectedGradeInfo.id,
        selectedPhase
      );

      if (result.success) {
        notifySuccess({ 
          title: 'Autorización revocada',
          message: `Autorización de ${PHASE_NAMES[selectedPhase]} revocada para ${selectedGradeInfo.name}`
        });
        setIsRevokeDialogOpen(false);
        setSelectedPhase(null);
        setSelectedGradeInfo(null);
        await loadAuthorizations();
      } else {
        notifyError({ 
          title: 'Error',
          message: 'Error al revocar autorización'
        });
      }
    } catch (error) {
      notifyError({ 
        title: 'Error',
        message: 'Error al revocar autorización'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPhaseStatus = (phase: PhaseType) => {
    const auth = authorizations.find(a => a.phase === phase);
    if (!auth) return { authorized: false, status: 'locked' };
    
    return {
      authorized: auth.authorized,
      status: auth.authorized ? 'authorized' : 'revoked',
      completion: completions[phase],
    };
  };

  const canAuthorizeNextPhase = (phase: PhaseType) => {
    if (phase === 'first') return true;
    
    const previousPhase: PhaseType = phase === 'second' ? 'first' : 'second';
    const prevCompletion = completions[previousPhase];
    
    return prevCompletion?.allCompleted === true;
  };

  const selectedGradeData = grades.find(g => g.value === selectedGrade);

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Lock className="h-5 w-5 text-blue-500" />
            Autorización de Fases Evaluativas
          </CardTitle>
          <CardDescription>
            Gestiona la autorización de fases evaluativas por grado. Las fases deben autorizarse en orden y solo cuando todos los estudiantes del grado hayan completado la fase anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn('text-sm font-medium mb-2 block', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Institución
              </label>
              <Select value={selectedInstitution} onValueChange={(value) => {
                setSelectedInstitution(value);
                setSelectedCampus('all');
                setSelectedGrade('all');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las instituciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las instituciones</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.value} value={inst.value}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={cn('text-sm font-medium mb-2 block', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Sede
              </label>
              <Select 
                value={selectedCampus} 
                onValueChange={(value) => {
                  setSelectedCampus(value);
                  setSelectedGrade('all');
                }}
                disabled={selectedInstitution === 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las sedes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.value} value={campus.value}>
                      {campus.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={cn('text-sm font-medium mb-2 block', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Grado
              </label>
              <Select 
                value={selectedGrade} 
                onValueChange={setSelectedGrade}
                disabled={selectedCampus === 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grados</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade.value} value={grade.value}>
                      {grade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estado de fases */}
          {selectedGrade !== 'all' && (
            <div className="space-y-4 mt-6">
              {(['first', 'second', 'third'] as PhaseType[]).map((phase) => {
                const status = getPhaseStatus(phase);
                const canAuthorize = canAuthorizeNextPhase(phase);
                const completion = status.completion;

                return (
                  <Card 
                    key={phase}
                    className={cn(
                      'border-2 transition-all',
                      status.authorized
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-300 dark:border-zinc-700',
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-white'
                    )}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                              'p-2 rounded-lg',
                              status.authorized 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-gray-400'
                            )}>
                              {status.authorized ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Lock className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {PHASE_NAMES[phase]}
                              </h3>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                {PHASE_DESCRIPTIONS[phase]}
                              </p>
                            </div>
                          </div>

                          {status.authorized && completion && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                  Progreso del grado
                                </span>
                                <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {completion.completedStudents} / {completion.totalStudents} estudiantes
                                </span>
                              </div>
                              <Progress 
                                value={completion.completionPercentage} 
                                className="h-2"
                              />
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {completion.completedStudents} completados
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-yellow-500" />
                                  {completion.inProgressStudents} en progreso
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-gray-400" />
                                  {completion.pendingStudents} pendientes
                                </span>
                              </div>
                            </div>
                          )}

                          {!status.authorized && phase !== 'first' && !canAuthorize && (
                            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  Debe completarse la fase anterior antes de autorizar esta fase
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {status.authorized ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedPhase(phase);
                                setSelectedGradeInfo({
                                  id: selectedGrade,
                                  name: selectedGradeData?.label || '',
                                  institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
                                  campusId: selectedCampus !== 'all' ? selectedCampus : undefined,
                                });
                                setIsRevokeDialogOpen(true);
                              }}
                              disabled={isLoading}
                            >
                              <Unlock className="h-4 w-4 mr-2" />
                              Revocar
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedPhase(phase);
                                setSelectedGradeInfo({
                                  id: selectedGrade,
                                  name: selectedGradeData?.label || '',
                                  institutionId: selectedInstitution !== 'all' ? selectedInstitution : undefined,
                                  campusId: selectedCampus !== 'all' ? selectedCampus : undefined,
                                });
                                setIsAuthorizeDialogOpen(true);
                              }}
                              disabled={isLoading || !canAuthorize}
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              Autorizar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedGrade === 'all' && (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Selecciona un grado para gestionar las autorizaciones de fases
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de autorización */}
      <Dialog open={isAuthorizeDialogOpen} onOpenChange={setIsAuthorizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar Fase</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas autorizar {selectedPhase && PHASE_NAMES[selectedPhase]} para el grado {selectedGradeInfo?.name || 'seleccionado'}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuthorizeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAuthorize} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Autorizando...
                </>
              ) : (
                'Autorizar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de revocación */}
      <AlertDialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar Autorización</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas revocar la autorización de {selectedPhase && PHASE_NAMES[selectedPhase]} para el grado {selectedGradeInfo?.name || 'seleccionado'}?
              Los estudiantes no podrán acceder a esta fase hasta que sea autorizada nuevamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revocando...
                </>
              ) : (
                'Revocar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

