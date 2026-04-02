/**
 * Nombres de subcolección de fase alineados con el cliente (results) y con saveStudyPlan (AnswerIA).
 * Cliente: src/utils/firestoreHelpers.ts → getPhaseName
 */

export type PhaseKind = 'first' | 'second' | 'third';

/** results/{uid}/{nombre}/... — igual que getPhaseName: first → "fase I" */
export function getCanonicalResultsPhaseSubcollection(phase: PhaseKind): string {
  const map: Record<PhaseKind, string> = {
    first: 'fase I',
    second: 'Fase II',
    third: 'fase III',
  };
  return map[phase];
}

/** AnswerIA/{uid}/{nombre}/{subject} — igual que saveStudyPlan en studyPlan.service */
export function getCanonicalAnswerIAPhaseSubcollection(phase: PhaseKind): string {
  const map: Record<PhaseKind, string> = {
    first: 'Fase I',
    second: 'Fase II',
    third: 'Fase III',
  };
  return map[phase];
}

/** Solo rutas legacy si el canónico está vacío o el doc no existe (datos antiguos / migraciones). */
export function getLegacyResultsPhaseAlternates(phase: PhaseKind): string[] {
  const legacy: Record<PhaseKind, string[]> = {
    first: ['Fase I', 'Fase 1', 'fase 1', 'first'],
    second: ['fase II', 'Fase 2', 'fase 2', 'second'],
    third: ['Fase III', 'Fase 3', 'fase 3', 'third'],
  };
  const canonical = getCanonicalResultsPhaseSubcollection(phase);
  return legacy[phase].filter((p) => p !== canonical);
}

export function getLegacyAnswerIAPhaseAlternates(phase: PhaseKind): string[] {
  const legacy: Record<PhaseKind, string[]> = {
    first: ['fase I', 'Fase 1', 'fase 1', 'first'],
    second: ['fase II', 'Fase 2', 'fase 2', 'second'],
    third: ['fase III', 'Fase 3', 'fase 3', 'third'],
  };
  const canonical = getCanonicalAnswerIAPhaseSubcollection(phase);
  return legacy[phase].filter((p) => p !== canonical);
}
