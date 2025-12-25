/**
 * Interfaces para el sistema de autorización de planes de estudio
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

/**
 * Autorización de generación de plan de estudio por fase, materia y grado
 */
export interface StudyPlanAuthorization {
  id: string;
  gradeId: string;
  gradeName: string;
  phase: StudyPlanPhase; // 'first' o 'second'
  subject: SubjectName;
  authorized: boolean;
  authorizedBy: string; // UID del administrador
  authorizedAt: string; // ISO date string
  institutionId?: string;
  campusId?: string;
  createdAt: string;
  updatedAt: string;
}


