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
import { useThemeContext } from '@/context/ThemeContext';
import {
  usePhaseStatusForSubjects,
  getPhaseStatesForSubject,
  computeAvailablePhase,
} from '@/hooks/query/usePhaseStatusForSubjects';
import type { PhaseType } from '@/interfaces/phase.interface';

interface SubjectPhaseStatusProps {
  subject: string;
  theme?: 'light' | 'dark';
  onPhaseSelect?: (phase: PhaseType) => void;
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

  const {
    phaseStatesBySubject,
    isLoading,
  } = usePhaseStatusForSubjects(user?.uid ?? undefined);

  const phaseStates = getPhaseStatesForSubject(phaseStatesBySubject, subject);
  const availablePhase = computeAvailablePhase(phaseStates);
  const displayPhase: PhaseType = availablePhase || 'first';

  const getPhaseStatus = (phase: PhaseType) => {
    const state = phaseStates[phase];
    const nextPhase: PhaseType | null = phase === 'first' ? 'second' : phase === 'second' ? 'third' : null;
    const nextPhaseAuthorized = nextPhase ? phaseStates[nextPhase].canAccess : false;

    if (state.isExamCompleted && !state.allSubjectsCompleted && !nextPhaseAuthorized) {
      return {
        status: 'locked',
        label: 'Bloqueada',
        icon: Lock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-zinc-800',
        reason: 'Esperando...'
      };
    }

    if (state.isCompleted && state.allSubjectsCompleted) {
      return {
        status: 'completed',
        label: 'Completada',
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
      };
    }

    if (!state.canAccess) {
      return {
        status: 'locked',
        label: 'No habilitado',
        icon: Lock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-zinc-800',
      };
    }

    if (state.isInProgress) {
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
      icon: CheckCircle2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    };
  };

  const handlePhaseClick = (phase: PhaseType) => {
    if (onPhaseSelect) {
      onPhaseSelect(phase);
    } else {
      const link = `/quiz?subject=${encodeURIComponent(subject)}&phase=${phase}`;
      navigate(link);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  const phaseStatus = getPhaseStatus(displayPhase);
  const StatusIcon = phaseStatus.icon;

  const allPhasesCompleted =
    (phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) &&
    (phaseStates.second.isCompleted || phaseStates.second.isExamCompleted) &&
    (phaseStates.third.isCompleted || phaseStates.third.isExamCompleted);

  if (allPhasesCompleted) {
    return (
      <div className="space-y-3">
        <div
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2 rounded-md',
            theme === 'dark'
              ? 'bg-green-900/30 text-green-300 border border-green-800/50'
              : 'bg-green-50 text-green-700 border border-green-200'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Fases completadas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-lg p-3 border',
          phaseStatus.bgColor,
          theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', phaseStatus.color)} />
            <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {getPhaseName(displayPhase)}
            </span>
          </div>
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              phaseStatus.status === 'completed' && 'bg-green-500',
              phaseStatus.status === 'in_progress' && 'bg-yellow-500',
              phaseStatus.status === 'available' && 'bg-blue-500',
              phaseStatus.status === 'locked' && phaseStatus.label === 'No habilitado' && 'bg-gray-500',
              phaseStatus.status === 'locked' && phaseStatus.label === 'Bloqueada' && 'bg-gray-500'
            )}
          >
            <StatusIcon className="h-4 w-4 text-white" />
          </div>
        </div>

        {phaseStatus.status !== 'locked' &&
          ((phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) ||
            (phaseStates.second.isCompleted || phaseStates.second.isExamCompleted)) && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {(phaseStates.first.isCompleted || phaseStates.first.isExamCompleted) && (
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md',
                    theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Fase 1</span>
                </div>
              )}
              {(phaseStates.second.isCompleted || phaseStates.second.isExamCompleted) && (
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md',
                    theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Fase 2</span>
                </div>
              )}
            </div>
          )}

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

        {phaseStatus.status === 'completed' && (
          <div className={cn('mt-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Esta fase ha sido completada
          </div>
        )}
      </div>
    </div>
  );
}
