import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Users, 
  GraduationCap,
  Loader2,
  AlertCircle,
  Clock,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/hooks/ui/useNotification';
import { useInstitutionOptions, useCampusOptions, useAllGradeOptions } from '@/hooks/query/useInstitutionQuery';
import { useAuthContext } from '@/context/AuthContext';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { PhaseAuthorization, GradePhaseCompletion, PhaseType } from '@/interfaces/phase.interface';
import { dbService } from '@/services/firebase/db.service';

interface PhaseAuthorizationManagementProps {
  theme: 'light' | 'dark';
}

interface GradePhaseStatus {
  gradeId: string;
  gradeName: string;
  institutionId: string;
  institutionName: string;
  campusId: string;
  campusName: string;
  totalStudents: number;
  phases: {
    first: { authorized: boolean; completion?: GradePhaseCompletion };
    second: { authorized: boolean; completion?: GradePhaseCompletion };
    third: { authorized: boolean; completion?: GradePhaseCompletion };
  };
}

const PHASE_NAMES: Record<PhaseType, string> = {
  first: 'Fase 1',
  second: 'Fase 2',
  third: 'Fase 3',
};

const PHASE_DESCRIPTIONS: Record<PhaseType, string> = {
  first: 'Diagnóstico',
  second: 'Refuerzo',
  third: 'Simulacro ICFES',
};

export default function PhaseAuthorizationManagement({ theme }: PhaseAuthorizationManagementProps) {
  const { notifySuccess, notifyError } = useNotification();
  const { user } = useAuthContext();
  const { options: institutions = [] } = useInstitutionOptions();
  const { options: allGrades = [], isLoading: isLoadingGrades } = useAllGradeOptions();
  
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [gradesStatus, setGradesStatus] = useState<GradePhaseStatus[]>([]);
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set());
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizeDialogOpen, setIsAuthorizeDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<PhaseType | null>(null);
  const [selectedGradeInfo, setSelectedGradeInfo] = useState<{ id: string; name: string; institutionId?: string; campusId?: string } | null>(null);

  const { options: campuses = [] } = useCampusOptions(selectedInstitution !== 'all' ? selectedInstitution : '');

  // Filtrar grados según los filtros seleccionados
  const filteredGrades = useMemo(() => {
    return allGrades.filter(grade => {
      if (selectedInstitution !== 'all' && grade.institutionId !== selectedInstitution) return false;
      if (selectedCampus !== 'all' && grade.campusId !== selectedCampus) return false;
      return true;
    });
  }, [allGrades, selectedInstitution, selectedCampus]);

  // Cargar estados de fases para todos los grados filtrados
  useEffect(() => {
    if (filteredGrades.length > 0) {
      loadAllGradesStatus();
    } else {
      setGradesStatus([]);
    }
  }, [filteredGrades.length, selectedInstitution, selectedCampus]);

  const loadAllGradesStatus = async () => {
    if (filteredGrades.length === 0) return;
    
    setIsLoading(true);
    try {
      const statusPromises = filteredGrades.map(async (grade) => {
        // Obtener autorizaciones del grado
        const authResult = await phaseAuthorizationService.getGradeAuthorizations(grade.value);
        const authorizations: PhaseAuthorization[] = authResult.success ? authResult.data : [];

        // Obtener número total de estudiantes del grado
        const studentsResult = await dbService.getFilteredStudents({
          gradeId: grade.value,
          isActive: true,
        });

        const totalStudents = studentsResult.success ? studentsResult.data.length : 0;

        // Verificar completitud para cada fase
        const phases: PhaseType[] = ['first', 'second', 'third'];
        const phaseStatus: GradePhaseStatus['phases'] = {
          first: { authorized: false },
          second: { authorized: false },
          third: { authorized: false },
        };

        for (const phase of phases) {
          const auth = authorizations.find(a => a.phase === phase && a.authorized);
          phaseStatus[phase].authorized = !!auth;

          if (totalStudents > 0) {
            const completionResult = await phaseAuthorizationService.checkGradePhaseCompletion(
              grade.value,
              phase,
              totalStudents
            );

            if (completionResult.success) {
              phaseStatus[phase].completion = completionResult.data;
            }
          }
        }

        return {
          gradeId: grade.value,
          gradeName: grade.label,
          institutionId: grade.institutionId,
          institutionName: grade.institutionName,
          campusId: grade.campusId,
          campusName: grade.campusName,
          totalStudents,
          phases: phaseStatus,
        } as GradePhaseStatus;
      });

      const statuses = await Promise.all(statusPromises);
      setGradesStatus(statuses);
    } catch (error) {
      console.error('Error al cargar estados de grados:', error);
      notifyError({ 
        title: 'Error',
        message: 'Error al cargar estados de fases'
      });
    } finally {
      setIsLoading(false);
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
        await loadAllGradesStatus();
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
        await loadAllGradesStatus();
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

  const canAuthorizeNextPhase = (gradeStatus: GradePhaseStatus, phase: PhaseType) => {
    if (phase === 'first') return true;
    
    const previousPhase: PhaseType = phase === 'second' ? 'first' : 'second';
    const prevCompletion = gradeStatus.phases[previousPhase].completion;
    
    return prevCompletion?.allCompleted === true;
  };

  const getCurrentPhase = (gradeStatus: GradePhaseStatus): PhaseType | null => {
    if (gradeStatus.phases.first.authorized && !gradeStatus.phases.first.completion?.allCompleted) {
      return 'first';
    }
    if (gradeStatus.phases.second.authorized && !gradeStatus.phases.second.completion?.allCompleted) {
      return 'second';
    }
    if (gradeStatus.phases.third.authorized && !gradeStatus.phases.third.completion?.allCompleted) {
      return 'third';
    }
    // Si todas están completadas o ninguna está autorizada, retornar la última autorizada
    if (gradeStatus.phases.third.authorized) return 'third';
    if (gradeStatus.phases.second.authorized) return 'second';
    if (gradeStatus.phases.first.authorized) return 'first';
    return null;
  };

  const getStudentSummary = (gradeStatus: GradePhaseStatus) => {
    // Obtener la fase actual o la última autorizada
    const currentPhase = getCurrentPhase(gradeStatus);
    if (!currentPhase) {
      return {
        completed: 0,
        inProgress: 0,
        pending: gradeStatus.totalStudents,
        total: gradeStatus.totalStudents
      };
    }

    const phaseCompletion = gradeStatus.phases[currentPhase].completion;
    if (!phaseCompletion) {
      return {
        completed: 0,
        inProgress: 0,
        pending: gradeStatus.totalStudents,
        total: gradeStatus.totalStudents
      };
    }

    return {
      completed: phaseCompletion.completedStudents,
      inProgress: phaseCompletion.inProgressStudents,
      pending: phaseCompletion.pendingStudents,
      total: phaseCompletion.totalStudents
    };
  };

  const groupGradesByInstitutionAndCampus = (grades: GradePhaseStatus[]) => {
    // Primero agrupar por institución
    const byInstitution = grades.reduce((acc, grade) => {
      const institutionId = grade.institutionId;
      if (!acc[institutionId]) {
        acc[institutionId] = {
          institutionId,
          institutionName: grade.institutionName,
          campuses: {}
        };
      }
      
      // Luego agrupar por sede dentro de cada institución
      const campusId = grade.campusId;
      if (!acc[institutionId].campuses[campusId]) {
        acc[institutionId].campuses[campusId] = {
          campusId,
          campusName: grade.campusName,
          grades: []
        };
      }
      
      acc[institutionId].campuses[campusId].grades.push(grade);
      return acc;
    }, {} as Record<string, { 
      institutionId: string; 
      institutionName: string; 
      campuses: Record<string, {
        campusId: string;
        campusName: string;
        grades: GradePhaseStatus[];
      }>;
    }>);

    // Convertir a array y transformar campuses a array
    return Object.values(byInstitution).map(institution => ({
      ...institution,
      campuses: Object.values(institution.campuses)
    }));
  };

  const toggleGradeExpansion = (gradeId: string) => {
    setExpandedGrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gradeId)) {
        newSet.delete(gradeId);
      } else {
        newSet.add(gradeId);
      }
      return newSet;
    });
  };

  const isGradeExpanded = (gradeId: string) => {
    return expandedGrades.has(gradeId);
  };

  const toggleInstitutionExpansion = (institutionId: string) => {
    setExpandedInstitutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(institutionId)) {
        newSet.delete(institutionId);
      } else {
        newSet.add(institutionId);
      }
      return newSet;
    });
  };

  const isInstitutionExpanded = (institutionId: string) => {
    return expandedInstitutions.has(institutionId);
  };

  const toggleCampusExpansion = (campusId: string) => {
    setExpandedCampuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campusId)) {
        newSet.delete(campusId);
      } else {
        newSet.add(campusId);
      }
      return newSet;
    });
  };

  const isCampusExpanded = (campusId: string) => {
    return expandedCampuses.has(campusId);
  };

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={cn('text-sm font-medium mb-2 block', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Institución
              </label>
              <Select value={selectedInstitution} onValueChange={(value) => {
                setSelectedInstitution(value);
                setSelectedCampus('all');
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
                onValueChange={setSelectedCampus}
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
          </div>

          {/* Lista de grados con estados */}
          {isLoading || isLoadingGrades ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : gradesStatus.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {filteredGrades.length === 0 
                  ? 'No hay grados disponibles con los filtros seleccionados'
                  : 'Cargando estados de fases...'}
              </p>
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {groupGradesByInstitutionAndCampus(gradesStatus).map((institutionGroup) => {
                const isInstitutionExpandedState = isInstitutionExpanded(institutionGroup.institutionId);
                const totalGrades = institutionGroup.campuses.reduce((sum, campus) => sum + campus.grades.length, 0);
                
                return (
                  <div key={institutionGroup.institutionId} className={cn(
                    'space-y-4 rounded-lg border p-3',
                    theme === 'dark' 
                      ? 'border-zinc-700 bg-zinc-800/40' 
                      : 'border-gray-200 bg-gray-50'
                  )}>
                    {/* Título de la institución */}
                    <button
                      onClick={() => toggleInstitutionExpansion(institutionGroup.institutionId)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 pb-2 border-b transition-all',
                        'hover:bg-gray-100 dark:hover:bg-zinc-700/50 rounded-t-lg px-3 py-2 -mx-3 -mt-3',
                        theme === 'dark' ? 'border-zinc-600' : 'border-gray-300',
                        'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-t-lg'
                      )}
                      aria-label={isInstitutionExpandedState ? 'Colapsar sedes' : 'Expandir sedes'}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className={cn('h-5 w-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                        <h2 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institutionGroup.institutionName}
                        </h2>
                        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}>
                          ({totalGrades} {totalGrades === 1 ? 'grado' : 'grados'}, {institutionGroup.campuses.length} {institutionGroup.campuses.length === 1 ? 'sede' : 'sedes'})
                        </span>
                      </div>
                      <div className="flex-shrink-0">
                        {isInstitutionExpandedState ? (
                          <ChevronUp className={cn('h-5 w-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                        ) : (
                          <ChevronDown className={cn('h-5 w-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                        )}
                      </div>
                    </button>
                    
                    {/* Sedes de la institución */}
                    <div 
                      className={cn(
                        'overflow-hidden transition-all duration-300 ease-in-out space-y-4',
                        isInstitutionExpandedState
                          ? 'max-h-[10000px] opacity-100' 
                          : 'max-h-0 opacity-0'
                      )}
                    >
                      {institutionGroup.campuses.map((campusGroup) => {
                        const isCampusExpandedState = isCampusExpanded(campusGroup.campusId);
                        
                        return (
                          <div key={campusGroup.campusId} className={cn(
                            'space-y-3 pl-4 border-l rounded-r-lg',
                            theme === 'dark' 
                              ? 'border-zinc-600 bg-zinc-800/30' 
                              : 'border-gray-300 bg-gray-100/50'
                          )}>
                            {/* Título de la sede */}
                            <button
                              onClick={() => toggleCampusExpansion(campusGroup.campusId)}
                              className={cn(
                                'w-full flex items-center justify-between gap-2 pb-2 border-b transition-all',
                                'hover:bg-gray-200 dark:hover:bg-zinc-700/50 rounded px-2 py-1.5 -mx-2',
                                theme === 'dark' ? 'border-zinc-600' : 'border-gray-300',
                                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                              )}
                              aria-label={isCampusExpandedState ? 'Colapsar grados' : 'Expandir grados'}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                                <h3 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {campusGroup.campusName}
                                </h3>
                                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}>
                                  ({campusGroup.grades.length} {campusGroup.grades.length === 1 ? 'grado' : 'grados'})
                                </span>
                              </div>
                              <div className="flex-shrink-0">
                                {isCampusExpandedState ? (
                                  <ChevronUp className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                                ) : (
                                  <ChevronDown className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                                )}
                              </div>
                            </button>
                            
                            {/* Grid de grados de la sede */}
                            <div 
                              className={cn(
                                'overflow-hidden transition-all duration-300 ease-in-out',
                                isCampusExpandedState
                                  ? 'max-h-[10000px] opacity-100' 
                                  : 'max-h-0 opacity-0'
                              )}
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 relative" style={{ gridAutoRows: 'min-content' }}>
                              {campusGroup.grades.map((gradeStatus) => {
                const currentPhase = getCurrentPhase(gradeStatus);
                const studentSummary = getStudentSummary(gradeStatus);
                
                const isExpanded = isGradeExpanded(gradeStatus.gradeId);
                
                return (
                  <Card 
                    key={gradeStatus.gradeId}
                    className={cn(
                      'border-2 transition-all hover:shadow-lg relative',
                      isExpanded && 'z-10 shadow-xl',
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700' 
                        : 'bg-white border-blue-100'
                    )}
                  >
                    <CardContent className="p-5">
                      {/* Header del grado */}
                      <div className="mb-4">
                        <button
                          onClick={() => toggleGradeExpansion(gradeStatus.gradeId)}
                          className={cn(
                            'w-full flex items-start justify-between gap-2 pb-2 border-b transition-all',
                            'hover:bg-gray-50 dark:hover:bg-zinc-700/50 rounded px-3 py-2 -mx-5 -mt-5 mb-4',
                            theme === 'dark' ? 'border-zinc-600' : 'border-gray-300',
                            'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                          )}
                          aria-label={isExpanded ? 'Colapsar fases' : 'Expandir fases'}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {gradeStatus.gradeName}
                              </h3>
                              {currentPhase && (
                                <Badge 
                                  variant="outline"
                                  className={cn(
                                    'text-xs',
                                    currentPhase === 'first' && 'border-blue-500 text-blue-600 dark:text-blue-400',
                                    currentPhase === 'second' && 'border-yellow-500 text-yellow-600 dark:text-yellow-400',
                                    currentPhase === 'third' && 'border-green-500 text-green-600 dark:text-green-400'
                                  )}
                                >
                                  {PHASE_NAMES[currentPhase]}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span>{gradeStatus.institutionName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>{gradeStatus.campusName}</span>
                              </div>
                            </div>
                            {/* Información compacta de estudiantes */}
                            <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                <span className="font-medium">{studentSummary.completed}</span>
                              </div>
                              <span className="text-gray-400 dark:text-gray-500">·</span>
                              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                <Clock className="h-2.5 w-2.5" />
                                <span className="font-medium">{studentSummary.inProgress}</span>
                              </div>
                              <span className="text-gray-400 dark:text-gray-500">·</span>
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                <Users className="h-2.5 w-2.5" />
                                <span>{studentSummary.total}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronUp className={cn('h-5 w-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                            ) : (
                              <ChevronDown className={cn('h-5 w-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Estados de las fases */}
                      <div 
                        className={cn(
                          'overflow-hidden transition-all duration-300 ease-in-out',
                          isExpanded
                            ? 'max-h-[2000px] opacity-100' 
                            : 'max-h-0 opacity-0'
                        )}
                      >
                        <div className="space-y-3 pt-2">
                        {(['first', 'second', 'third'] as PhaseType[]).map((phase) => {
                          const phaseData = gradeStatus.phases[phase];
                          const isAuthorized = phaseData.authorized;
                          const completion = phaseData.completion;
                          const canAuthorize = canAuthorizeNextPhase(gradeStatus, phase);

                          return (
                            <div
                              key={phase}
                              className={cn(
                                'p-3 rounded-lg border transition-all',
                                isAuthorized
                                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                  : 'border-gray-300 dark:border-zinc-700',
                                theme === 'dark' && !isAuthorized && 'bg-zinc-700/50'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isAuthorized ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Lock className="h-4 w-4 text-gray-400" />
                                  )}
                                  <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {PHASE_NAMES[phase]}
                                  </span>
                                  <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    {PHASE_DESCRIPTIONS[phase]}
                                  </span>
                                </div>
                                <Button
                                  variant={isAuthorized ? "destructive" : "default"}
                                  size="default"
                                  className={cn(
                                    'h-9 px-4 text-sm font-semibold shadow-sm transition-all',
                                    !isAuthorized && !canAuthorize && 'opacity-50 cursor-not-allowed',
                                    !isAuthorized && canAuthorize && 'bg-green-600 hover:bg-green-700 text-white border-green-700 hover:border-green-800',
                                    isAuthorized && 'bg-red-600 hover:bg-red-700 text-white'
                                  )}
                                  onClick={() => {
                                    setSelectedPhase(phase);
                                    setSelectedGradeInfo({
                                      id: gradeStatus.gradeId,
                                      name: gradeStatus.gradeName,
                                      institutionId: gradeStatus.institutionId,
                                      campusId: gradeStatus.campusId,
                                    });
                                    if (isAuthorized) {
                                      setIsRevokeDialogOpen(true);
                                    } else {
                                      setIsAuthorizeDialogOpen(true);
                                    }
                                  }}
                                  disabled={isLoading || (!isAuthorized && !canAuthorize)}
                                >
                                  {isAuthorized ? (
                                    <>
                                      <Unlock className="h-4 w-4 mr-2" />
                                      Revocar
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="h-4 w-4 mr-2" />
                                      Autorizar
                                    </>
                                  )}
                                </Button>
                              </div>

                              {isAuthorized && completion && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                      Progreso
                                    </span>
                                    <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      {completion.completedStudents}/{completion.totalStudents}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={completion.completionPercentage} 
                                    className="h-1.5"
                                  />
                                </div>
                              )}

                              {!isAuthorized && phase !== 'first' && !canAuthorize && (
                                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Fase anterior pendiente</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                              );
                            })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
              ¿Estás seguro de que deseas autorizar {selectedPhase && `${PHASE_NAMES[selectedPhase]} - ${PHASE_DESCRIPTIONS[selectedPhase]}`} para el grado {selectedGradeInfo?.name || 'seleccionado'}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAuthorizeDialogOpen(false)}
              className={cn(
                'border-2 font-semibold',
                theme === 'dark' 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400'
              )}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAuthorize} 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold border-2 border-green-700 hover:border-green-800"
            >
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
              ¿Estás seguro de que deseas revocar la autorización de {selectedPhase && `${PHASE_NAMES[selectedPhase]} - ${PHASE_DESCRIPTIONS[selectedPhase]}`} para el grado {selectedGradeInfo?.name || 'seleccionado'}?
              <br /><br />
              Los estudiantes no podrán acceder a esta fase hasta que sea autorizada nuevamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className={cn(
                'border-2 font-semibold',
                theme === 'dark' 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white bg-zinc-800' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 bg-white'
              )}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevoke} 
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold border-2 border-red-700 hover:border-red-800"
            >
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

