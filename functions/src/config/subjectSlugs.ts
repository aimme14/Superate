/**
 * Slugs canónicos de las 7 materias (alineado con SUBJECTS_CONFIG y exámenes).
 */

export const EXPECTED_SUBJECT_COUNT = 7;

export const SUBJECT_SLUGS = [
  'matematicas',
  'lenguaje',
  'ciencias_sociales',
  'biologia',
  'quimica',
  'fisica',
  'ingles',
] as const;

export type SubjectSlug = (typeof SUBJECT_SLUGS)[number];

const SUBJECT_SLUG_SET = new Set<string>(SUBJECT_SLUGS);

/**
 * Convierte el texto de materia del examen (subject / examTitle) a slug estable.
 * Devuelve null si no coincide con ninguna de las 7 materias.
 */
export function subjectLabelToSlug(raw: string | undefined | null): SubjectSlug | null {
  if (!raw || typeof raw !== 'string') return null;
  const n = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const direct: Record<string, SubjectSlug> = {
    matematicas: 'matematicas',
    matemáticas: 'matematicas',
    lenguaje: 'lenguaje',
    lectura_critica: 'lenguaje',
    'lectura critica': 'lenguaje',
    'ciencias sociales': 'ciencias_sociales',
    sociales: 'ciencias_sociales',
    biologia: 'biologia',
    biología: 'biologia',
    quimica: 'quimica',
    química: 'quimica',
    fisica: 'fisica',
    física: 'fisica',
    ingles: 'ingles',
    inglés: 'ingles',
    english: 'ingles',
  };

  if (direct[n]) return direct[n];

  if (n.includes('matematic')) return 'matematicas';
  if (n.includes('lenguaje') || n.includes('lectura')) return 'lenguaje';
  if (n.includes('sociales') || n.includes('social')) return 'ciencias_sociales';
  if (n.includes('biolog')) return 'biologia';
  if (n.includes('quimic')) return 'quimica';
  if (n.includes('fisic') && !n.includes('quimic')) return 'fisica';
  if (n.includes('ingles') || n.includes('inglés') || n === 'in') return 'ingles';

  return null;
}

export function isKnownSubjectSlug(slug: string): slug is SubjectSlug {
  return SUBJECT_SLUG_SET.has(slug);
}
