import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Users, 
  GraduationCap,
  Loader2,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/hooks/ui/useNotification';
import { useInstitutionOptions, useCampusOptions, useAllGradeOptions } from '@/hooks/query/useInstitutionQuery';
import { useAuthContext } from '@/context/AuthContext';
import { studyPlanAuthorizationService } from '@/services/studyPlan/studyPlanAuthorization.service';
import { StudyPlanAuthorization, SubjectName, StudyPlanPhase } from '@/interfaces/studyPlan.interface';
import { dbService } from '@/services/firebase/db.service';

interface StudyPlanAuthorizationManagementProps {
  theme: 'light' | 'dark';
}

interface GradeSubjectStatus {
  gradeId: string;
  gradeName: string;
  institutionId: string;
  institutionName: string;
  campusId: string;
  campusName: string;
  totalStudents: number;
  subjects: {
    [key in SubjectName]: {
      first: { authorized: boolean };
      second: { authorized: boolean };
    };
  };
}

// Fases disponibles para planes de estudio
const STUDY_PLAN_PHASES: { phase: StudyPlanPhase; name: string; label: string }[] = [
  { phase: 'first', name: 'Fase I', label: 'Fase I' },
  { phase: 'second', name: 'Fase II', label: 'Fase II' }
];

// Lista de todas las materias del sistema
const ALL_SUBJECTS: SubjectName[] = [
  'Matemáticas',
  'Lenguaje',
  'Ciencias Sociales',
  'Biologia',
  'Quimica',
  'Física',
  'Inglés'
];

// Iconos para cada materia
const SUBJECT_ICONS: Record<SubjectName, string> = {
  'Matemáticas': '🔢',
  'Lenguaje': '📖',
  'Ciencias Sociales': '🌍',
  'Biologia': '🌿',
  'Quimica': '🧪',
  'Física': '⚛️',
  'Inglés': '🇬🇧'
};

export default function StudyPlanAuthorizationManagement({ theme }: StudyPlanAuthorizationManagementProps) {
  const { notifySuccess, notifyError } = useNotification();
  const { user } = useAuthContext();
  const { options: institutions = [] } = useInstitutionOptions();
  const { options: allGrades = [], isLoading: isLoadingGrades } = useAllGradeOptions();
  
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [gradesStatus, setGradesStatus] = useState<GradeSubjectStatus[]>([]);
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set());
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizeDialogOpen, setIsAuthorizeDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<SubjectName | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<StudyPlanPhase | null>(null);
  const [selectedGradeInfo, setSelectedGradeInfo] = useState<{ id: string; name: string; institutionId?: string; campusId?: string } | null>(null);
  const isLoadingRef = useRef(false);

  const { options: campuses = [] } = useCampusOptions(selectedInstitution !== 'all' ? selectedInstitution : '');

  // Filtrar grados según los filtros seleccionados
  const filteredGrades = useMemo(() => {
    return allGrades.filter(grade => {
      if (selectedInstitution !== 'all' && grade.institutionId !== selectedInstitution) return false;
      if (selectedCampus !== 'all' && grade.campusId !== selectedCampus) return false;
      return true;
    });
  }, [allGrades, selectedInstitution, selectedCampus]);

  const loadAllGradesStatus = useCallback(async () => {
    if (filteredGrades.length === 0 || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    
    try {
      const statusPromises = filteredGrades.map(async (grade) => {
        // Obtener autorizaciones del grado
        const authResult = await studyPlanAuthorizationService.getGradeAuthorizations(grade.value);
        const authorizations: StudyPlanAuthorization[] = authResult.success ? authResult.data : [];

        // Obtener número total de estudiantes del grado
        const studentsResult = await dbService.getFilteredStudents({
          gradeId: grade.value,
          isActive: true,
        });

        const totalStudents = studentsResult.success ? studentsResult.data.length : 0;

        // Crear estado de autorización para cada materia y fase
        const subjectsStatus: GradeSubjectStatus['subjects'] = {
          'Matemáticas': { first: { authorized: false }, second: { authorized: false } },
          'Lenguaje': { first: { authorized: false }, second: { authorized: false } },
          'Ciencias Sociales': { first: { authorized: false }, second: { authorized: false } },
          'Biologia': { first: { authorized: false }, second: { authorized: false } },
          'Quimica': { first: { authorized: false }, second: { authorized: false } },
          'Física': { first: { authorized: false }, second: { authorized: false } },
          'Inglés': { first: { authorized: false }, second: { authorized: false } },
        };

        // Marcar materias autorizadas por fase
        authorizations.forEach(auth => {
          if (auth.authorized && auth.subject in subjectsStatus && (auth.phase === 'first' || auth.phase === 'second')) {
            subjectsStatus[auth.subject as SubjectName][auth.phase].authorized = true;
          }
        });

        return {
          gradeId: grade.value,
          gradeName: grade.label,
          institutionId: grade.institutionId,
          institutionName: grade.institutionName,
          campusId: grade.campusId,
          campusName: grade.campusName,
          totalStudents,
          subjects: subjectsStatus,
        } as GradeSubjectStatus;
      });

      const statuses = await Promise.all(statusPromises);
      setGradesStatus(statuses);
    } catch (error) {
      console.error('Error al cargar estados de grados:', error);
      notifyError({ 
        title: 'Error',
        message: 'Error al cargar estados de planes de estudio'
      });
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [filteredGrades, notifyError]);

  // Cargar estados de planes de estudio para todos los grados filtrados
  useEffect(() => {
    if (filteredGrades.length > 0) {
      loadAllGradesStatus();
    } else {
      setGradesStatus([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGrades.length, selectedInstitution, selectedCampus]);

  const handleAuthorize = async () => {
    if (!selectedSubject || !selectedPhase || !selectedGradeInfo || !user?.uid) return;

    setIsLoading(true);
    try {
      const result = await studyPlanAuthorizationService.authorizeStudyPlan(
        selectedGradeInfo.id,
        selectedGradeInfo.name,
        selectedPhase,
        selectedSubject,
        user.uid,
        selectedGradeInfo.institutionId,
        selectedGradeInfo.campusId
      );

      if (result.success) {
        const phaseName = selectedPhase === 'first' ? 'Fase I' : 'Fase II';
        notifySuccess({ 
          title: 'Plan de estudio autorizado',
          message: `Generación de plan de estudio para ${selectedSubject} (${phaseName}) autorizada para ${selectedGradeInfo.name}`
        });
        setIsAuthorizeDialogOpen(false);
        setSelectedSubject(null);
        setSelectedPhase(null);
        setSelectedGradeInfo(null);
        await loadAllGradesStatus();
      } else {
        notifyError({ 
          title: 'Error',
          message: 'Error al autorizar plan de estudio'
        });
      }
    } catch (error) {
      notifyError({ 
        title: 'Error',
        message: 'Error al autorizar plan de estudio'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedSubject || !selectedPhase || !selectedGradeInfo) return;

    setIsLoading(true);
    try {
      const result = await studyPlanAuthorizationService.revokeStudyPlanAuthorization(
        selectedGradeInfo.id,
        selectedPhase,
        selectedSubject
      );

      if (result.success) {
        const phaseName = selectedPhase === 'first' ? 'Fase I' : 'Fase II';
        notifySuccess({ 
          title: 'Autorización revocada',
          message: `Autorización de plan de estudio para ${selectedSubject} (${phaseName}) revocada para ${selectedGradeInfo.name}`
        });
        setIsRevokeDialogOpen(false);
        setSelectedSubject(null);
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

  const groupGradesByInstitutionAndCampus = (grades: GradeSubjectStatus[]) => {
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
        grades: GradeSubjectStatus[];
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

  const getAuthorizedSubjectsCount = (gradeStatus: GradeSubjectStatus): number => {
    let count = 0;
    Object.values(gradeStatus.subjects).forEach(subject => {
      if (subject.first.authorized) count++;
      if (subject.second.authorized) count++;
    });
    return count;
  };

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Brain className="h-5 w-5 text-purple-500" />
              Autorización de Planes de Estudio
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllGradesStatus()}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2',
                theme === 'dark' 
                  ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' 
                  : 'bg-white hover:bg-gray-50'
              )}
              title="Actualizar datos"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
          <CardDescription>
            <p>
              Gestiona la autorización de generación de planes de estudio por fase, materia y grado. 
              Las autorizaciones son independientes por fase (Fase I y Fase II). 
              Cuando una materia está autorizada para una fase, todos los estudiantes de ese grado podrán generar planes de estudio para esa materia en esa fase específica.
            </p>
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
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : gradesStatus.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {filteredGrades.length === 0 
                  ? 'No hay grados disponibles con los filtros seleccionados'
                  : 'Cargando estados de planes de estudio...'}
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
                        'cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-t-lg'
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
                                'cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
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
                              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {campusGroup.grades.map((gradeStatus) => {
                                  const isExpanded = isGradeExpanded(gradeStatus.gradeId);
                                  const authorizedCount = getAuthorizedSubjectsCount(gradeStatus);
                                  
                                  return (
                                    <Card 
                                      key={gradeStatus.gradeId}
                                      className={cn(
                                        'border-2 transition-all hover:shadow-lg relative',
                                        isExpanded && 'z-10 shadow-xl',
                                        theme === 'dark' 
                                          ? 'bg-zinc-800 border-zinc-700' 
                                          : 'bg-white border-purple-100'
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
                                              'cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                                            )}
                                            aria-label={isExpanded ? 'Colapsar materias' : 'Expandir materias'}
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                                  {gradeStatus.gradeName}
                                                </h3>
                                                <Badge 
                                                  variant="outline"
                                                  className={cn(
                                                    'text-xs',
                                                    authorizedCount > 0 
                                                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                                                      : 'border-gray-400 text-gray-500'
                                                  )}
                                                >
                                                  {authorizedCount}/{ALL_SUBJECTS.length * 2} autorizadas
                                                </Badge>
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
                                              <div className="flex items-center gap-1 mt-2">
                                                <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                                  {gradeStatus.totalStudents} estudiantes
                                                </span>
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

                                        {/* Lista de materias */}
                                        <div 
                                          className={cn(
                                            'overflow-hidden transition-all duration-300 ease-in-out',
                                            isExpanded
                                              ? 'max-h-[2000px] opacity-100' 
                                              : 'max-h-0 opacity-0'
                                          )}
                                        >
                                          <div className="space-y-3 pt-2">
                                            {ALL_SUBJECTS.map((subject) => {
                                              const subjectStatus = gradeStatus.subjects[subject];

                                              return (
                                                <div
                                                  key={subject}
                                                  className={cn(
                                                    'p-3 rounded-lg border transition-all',
                                                    theme === 'dark' 
                                                      ? 'border-zinc-700 bg-zinc-800/50' 
                                                      : 'border-gray-300 bg-gray-50'
                                                  )}
                                                >
                                                  {/* Título de la materia */}
                                                  <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-lg">{SUBJECT_ICONS[subject]}</span>
                                                    <span className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                                      {subject}
                                                    </span>
                                                  </div>
                                                  
                                                  {/* Controles por fase - Vertical */}
                                                  <div className="space-y-2">
                                                    {STUDY_PLAN_PHASES.map((phaseInfo) => {
                                                      const isAuthorized = subjectStatus[phaseInfo.phase].authorized;

                                                      return (
                                                        <div
                                                          key={phaseInfo.phase}
                                                          className={cn(
                                                            'p-2 rounded border transition-all flex items-center justify-between',
                                                            isAuthorized
                                                              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                                              : 'border-gray-300 dark:border-zinc-700',
                                                            theme === 'dark' && !isAuthorized && 'bg-zinc-700/30'
                                                          )}
                                                        >
                                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className={cn('text-xs font-medium whitespace-nowrap', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                                              {phaseInfo.label}
                                                            </span>
                                                            {isAuthorized ? (
                                                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                                            ) : (
                                                              <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                                            )}
                                                          </div>
                                                          <Button
                                                            size="sm"
                                                            variant={isAuthorized ? "destructive" : "default"}
                                                            onClick={() => {
                                                              setSelectedSubject(subject);
                                                              setSelectedPhase(phaseInfo.phase);
                                                              setSelectedGradeInfo({
                                                                id: gradeStatus.gradeId,
                                                                name: gradeStatus.gradeName,
                                                                institutionId: gradeStatus.institutionId,
                                                                campusId: gradeStatus.campusId
                                                              });
                                                              if (isAuthorized) {
                                                                setIsRevokeDialogOpen(true);
                                                              } else {
                                                                setIsAuthorizeDialogOpen(true);
                                                              }
                                                            }}
                                                            disabled={isLoading}
                                                            className="ml-2 h-7 text-xs flex-shrink-0"
                                                          >
                                                            {isAuthorized ? (
                                                              <>
                                                                <Unlock className="h-3 w-3 mr-1" />
                                                                Deshabilitar
                                                              </>
                                                            ) : (
                                                              <>
                                                                <Lock className="h-3 w-3 mr-1" />
                                                                Habilitar
                                                              </>
                                                            )}
                                                          </Button>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
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
        <DialogContent className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Autorizar Plan de Estudio
            </DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              ¿Estás seguro de que deseas autorizar la generación de planes de estudio para{' '}
              <strong>{selectedSubject}</strong> ({selectedPhase === 'first' ? 'Fase I' : 'Fase II'}) en el grado <strong>{selectedGradeInfo?.name}</strong>?
              <br />
              <br />
              Todos los estudiantes de este grado podrán generar planes de estudio para esta materia en esta fase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthorizeDialogOpen(false);
                setSelectedSubject(null);
                setSelectedGradeInfo(null);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAuthorize}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
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
        <AlertDialogContent className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white')}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Revocar Autorización
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              ¿Estás seguro de que deseas revocar la autorización de generación de planes de estudio para{' '}
              <strong>{selectedSubject}</strong> ({selectedPhase === 'first' ? 'Fase I' : 'Fase II'}) en el grado <strong>{selectedGradeInfo?.name}</strong>?
              <br />
              <br />
              Los estudiantes de este grado ya no podrán generar nuevos planes de estudio para esta materia en esta fase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
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


