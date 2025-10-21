/**
 * Configuración de materias, temas y códigos para el sistema de preguntas
 * 
 * Este archivo define todas las materias disponibles, sus códigos únicos,
 * y los temas asociados a cada materia.
 */

export interface Topic {
  name: string;
  code: string; // Código de 2 letras
}

export interface Subject {
  name: string;
  code: string; // Código de 2 letras
  topics: Topic[];
  icon?: string; // Emoji o nombre de ícono
}

/**
 * Mapeo de grados escolares a códigos
 * 6 = Sexto, 7 = Séptimo, 8 = Octavo, 9 = Noveno, 0 = Décimo, 1 = Undécimo
 */
export const GRADE_MAPPING: Record<string, string> = {
  'Sexto': '6',
  'Séptimo': '7',
  'Octavo': '8',
  'Noveno': '9',
  'Décimo': '0',
  'Undécimo': '1',
};

/**
 * Mapeo inverso de códigos a nombres de grados
 */
export const GRADE_CODE_TO_NAME: Record<string, string> = {
  '6': 'Sexto',
  '7': 'Séptimo',
  '8': 'Octavo',
  '9': 'Noveno',
  '0': 'Décimo',
  '1': 'Undécimo',
};

/**
 * Niveles de dificultad disponibles
 */
export const DIFFICULTY_LEVELS = [
  { name: 'Fácil', code: 'F' },
  { name: 'Medio', code: 'M' },
  { name: 'Difícil', code: 'D' },
] as const;

/**
 * Configuración completa de materias y temas
 */
export const SUBJECTS_CONFIG: Subject[] = [
  {
    name: 'Matemáticas',
    code: 'MA',
    icon: '🔢',
    topics: [
      { name: 'Álgebra y Cálculo', code: 'AL' },
      { name: 'Geometría', code: 'GE' },
      { name: 'Estadistica', code: 'ES' },
    ],
  },
  {
    name: 'Lenguaje',
    code: 'LE',
    icon: '📖',
    topics: [
      { name: 'Textos literarios', code: 'TL' },
      { name: 'Textos informativos', code: 'TI' },
      { name: 'Textos filosoficos y religiosos', code: 'TF' },
    ],
  },
  {
    name: 'Biologia',
    code: 'BI',
    icon: '🌿',
    topics: [
      { name: 'Las celulas', code: 'LC' },
      { name: 'Los organismos', code: 'LO' },
      { name: 'Los organismos', code: 'BO' },
    ],
  },
  {
    name: 'Quimica',
    code: 'QU',
    icon: '🧪',
    topics: [
      { name: 'Aspectos analíticos de sustancias', code: 'AS' },
      { name: 'Aspecto fsico-químicos de sustencias', code: 'AQ' },
      { name: 'Aspectos analíticos de mezclas', code: 'AM' },
      { name: 'Aspectos físico-químicos de mezclas', code: 'AF' },
    ],
  },
  {
    name: 'Física',
    code: 'FI',
    icon: '�',
    topics: [
      { name: 'Mecanica clasica', code: 'MC' },
      { name: 'termodinamica', code: 'TD' },
      { name: 'Eventos ondulatorios', code: 'EO' },
      { name: 'Eventos electromagneticos', code: 'EE' },
    ],
  },
  {
    name: 'Inglés',
    code: 'IN',
    icon: '🇬🇧',
    topics: [
      { name: 'Prueba 1', code: 'P1' },
      { name: 'Prueba 2', code: 'P2' },
      { name: 'Prueba 3', code: 'P3' },
    ],
  },
];

/**
 * Obtiene una materia por su código
 * @param code - Código de la materia (2 letras)
 * @returns La materia encontrada o undefined
 */
export function getSubjectByCode(code: string): Subject | undefined {
  return SUBJECTS_CONFIG.find(subject => subject.code === code);
}

/**
 * Obtiene un tema por su código dentro de una materia
 * @param subjectCode - Código de la materia
 * @param topicCode - Código del tema
 * @returns El tema encontrado o undefined
 */
export function getTopicByCode(subjectCode: string, topicCode: string): Topic | undefined {
  const subject = getSubjectByCode(subjectCode);
  if (!subject) return undefined;
  return subject.topics.find(topic => topic.code === topicCode);
}

/**
 * Obtiene el nombre completo de un grado por su código
 * @param code - Código del grado (1 carácter)
 * @returns Nombre del grado
 */
export function getGradeNameByCode(code: string): string {
  return GRADE_CODE_TO_NAME[code] || code;
}

/**
 * Obtiene el código de un grado por su nombre
 * @param name - Nombre del grado
 * @returns Código del grado
 */
export function getGradeCodeByName(name: string): string {
  return GRADE_MAPPING[name] || name;
}

/**
 * Valida que un código de pregunta tenga el formato correcto
 * @param code - Código a validar (ej: MAAL1F001)
 * @returns true si el código es válido
 */
export function validateQuestionCode(code: string): boolean {
  // Formato: <MAT><TOP><GRADE><NIV><SERIE>
  // Ejemplo: MAAL1F001 (2+2+1+1+3 = 9 caracteres)
  if (code.length !== 9) return false;

  const subjectCode = code.substring(0, 2);
  const topicCode = code.substring(2, 4);
  const gradeCode = code.substring(4, 5);
  const levelCode = code.substring(5, 6);
  const serie = code.substring(6, 9);

  // Validar que la materia existe
  if (!getSubjectByCode(subjectCode)) return false;

  // Validar que el tema existe en la materia
  if (!getTopicByCode(subjectCode, topicCode)) return false;

  // Validar que el grado es válido
  if (!GRADE_CODE_TO_NAME[gradeCode]) return false;

  // Validar que el nivel es válido
  const validLevels = DIFFICULTY_LEVELS.map(l => l.code);
  if (!validLevels.includes(levelCode as any)) return false;

  // Validar que la serie son 3 dígitos
  if (!/^\d{3}$/.test(serie)) return false;

  return true;
}

/**
 * Decodifica un código de pregunta en sus componentes
 * @param code - Código a decodificar
 * @returns Componentes del código o null si es inválido
 */
export function decodeQuestionCode(code: string): {
  subject: Subject;
  topic: Topic;
  grade: string;
  gradeName: string;
  level: string;
  levelName: string;
  serie: number;
} | null {
  if (!validateQuestionCode(code)) return null;

  const subjectCode = code.substring(0, 2);
  const topicCode = code.substring(2, 4);
  const gradeCode = code.substring(4, 5);
  const levelCode = code.substring(5, 6);
  const serie = parseInt(code.substring(6, 9), 10);

  const subject = getSubjectByCode(subjectCode)!;
  const topic = getTopicByCode(subjectCode, topicCode)!;
  const gradeName = getGradeNameByCode(gradeCode);
  const level = DIFFICULTY_LEVELS.find(l => l.code === levelCode);

  return {
    subject,
    topic,
    grade: gradeCode,
    gradeName,
    level: levelCode,
    levelName: level?.name || levelCode,
    serie,
  };
}

/**
 * Ejemplo de uso:
 * 
 * Código: MAAL1F001
 * - MA: Matemáticas
 * - AL: Álgebra
 * - 1: Undécimo grado
 * - F: Fácil
 * - 001: Primera pregunta de esta combinación
 */

