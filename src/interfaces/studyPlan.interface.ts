/**
 * Tipos compartidos para planes de estudio (Fase I).
 */

/**
 * Materias disponibles en el sistema
 */
export type SubjectName = 
  | 'Matemáticas' 
  | 'Lenguaje' 
  | 'Ciencias Sociales' 
  | 'Biologia' 
  | 'Quimica' 
  | 'Física' 
  | 'Inglés';

/**
 * Fases permitidas para autorización de planes de estudio
 * Solo Fase I y Fase II
 */
export type StudyPlanPhase = 'first' | 'second';

