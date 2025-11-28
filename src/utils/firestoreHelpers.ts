/**
 * Utilidades para trabajar con Firestore y el sistema de fases
 */

export type PhaseType = 'first' | 'second' | 'third';

/**
 * Mapea el tipo de fase a su nombre en español para Firestore
 */
export function getPhaseName(phase: PhaseType | string | undefined): string {
  const phaseMap: Record<string, string> = {
    'first': 'fase I',
    'second': 'Fase II',
    'third': 'fase III'
  };
  
  if (!phase) return 'fase I'; // Default a fase I si no se especifica
  
  return phaseMap[phase] || 'fase I';
}

/**
 * Obtiene todas las fases disponibles
 */
export function getAllPhases(): string[] {
  return ['fase I', 'Fase II', 'fase III'];
}

/**
 * Convierte el nombre de fase en español de vuelta al tipo
 * Soporta tanto 'fase II' (antiguo) como 'Fase II' (nuevo) para retrocompatibilidad
 */
export function getPhaseType(phaseName: string): PhaseType | null {
  const reverseMap: Record<string, PhaseType> = {
    'fase I': 'first',
    'fase II': 'second',  // Mantener para retrocompatibilidad
    'Fase II': 'second',  // Nuevo formato con mayúsculas
    'fase III': 'third'
  };
  
  return reverseMap[phaseName] || null;
}

