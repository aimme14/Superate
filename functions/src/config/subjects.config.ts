/**
 * Configuración de materias y ejes temáticos (topics canónicos)
 * Sincronizado con src/utils/subjects.config.ts del frontend
 *
 * Los topics son los ejes de cada materia usados para organizar
 * videos y recursos en Firestore.
 */

export interface CanonicalTopic {
  name: string;
  code: string;
}

export interface SubjectWithTopics {
  name: string;
  code: string;
  topics: CanonicalTopic[];
}

export const SUBJECTS_CONFIG: SubjectWithTopics[] = [
  {
    name: 'Matemáticas',
    code: 'MA',
    topics: [
      { name: 'Álgebra y Cálculo', code: 'AL' },
      { name: 'Geometría', code: 'GE' },
      { name: 'Estadistica', code: 'ES' },
    ],
  },
  {
    name: 'Lenguaje',
    code: 'LE',
    topics: [
      { name: 'Textos literarios', code: 'TL' },
      { name: 'Textos informativos', code: 'TI' },
      { name: 'Textos filosoficos', code: 'TF' },
    ],
  },
  {
    name: 'Ciencias Sociales',
    code: 'CS',
    topics: [
      { name: 'El espacio, el territorio, el ambiente y la población', code: 'ET' },
      { name: 'El poder, la economia y las organicaciones sociales', code: 'PE' },
      { name: 'El tiempo y las culturas', code: 'TC' },
      { name: 'Competencias ciudadanas', code: 'CC' },
    ],
  },
  {
    name: 'Biologia',
    code: 'BI',
    topics: [
      { name: 'Las células', code: 'LC' },
      { name: 'Los organismos', code: 'LO' },
      { name: 'Los ecosistemas', code: 'LE' },
    ],
  },
  {
    name: 'Quimica',
    code: 'QU',
    topics: [
      { name: 'Aspectos analíticos de sustancias', code: 'AS' },
      { name: 'Aspecto físico-químicos de sustancias', code: 'AQ' },
      { name: 'Aspectos analíticos de mezclas', code: 'AM' },
      { name: 'Aspectos físico-químicos de mezclas', code: 'AF' },
    ],
  },
  {
    name: 'Física',
    code: 'FI',
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
    topics: [
      { name: 'Parte 1', code: 'P1' },
      { name: 'Parte 2', code: 'P2' },
      { name: 'Parte 3', code: 'P3' },
      { name: 'Parte 4', code: 'P4' },
      { name: 'Parte 5', code: 'P5' },
      { name: 'Parte 6', code: 'P6' },
      { name: 'Parte 7', code: 'P7' },
    ],
  },
];

/** Límite máximo de videos por topic en la base de datos */
export const MAX_VIDEOS_PER_TOPIC = 20;

/** Cantidad de videos a retornar por topic con debilidad */
export const VIDEOS_PER_TOPIC = 7;

/** Límite máximo de ejercicios por topic en EjerciciosIA */
export const MAX_EXERCISES_PER_TOPIC = 100;

/**
 * Obtiene la materia por nombre (case-insensitive, normalizado)
 */
export function getSubjectConfig(subjectName: string): SubjectWithTopics | undefined {
  const normalized = subjectName.trim();
  return SUBJECTS_CONFIG.find(
    (s) => s.name.toLowerCase() === normalized.toLowerCase()
  );
}

/**
 * Mapea un topic granular (de debilidades o Gemini) al topic canónico (eje) de la materia.
 * Usa coincidencia exacta primero, luego coincidencia por inclusión.
 */
export function mapToCanonicalTopic(
  subjectName: string,
  granularTopic: string
): string | null {
  const subject = getSubjectConfig(subjectName);
  if (!subject) return null;

  const normalizedGranular = granularTopic.trim().toLowerCase();

  // Coincidencia exacta
  const exact = subject.topics.find(
    (t) => t.name.toLowerCase() === normalizedGranular
  );
  if (exact) return exact.name;

  // Coincidencia por inclusión: el topic granular contiene el nombre del eje o viceversa
  const byContains = subject.topics.find((t) => {
    const canonicalLower = t.name.toLowerCase();
    return (
      canonicalLower.includes(normalizedGranular) ||
      normalizedGranular.includes(canonicalLower)
    );
  });
  if (byContains) return byContains.name;

  // Fallback: buscar por palabras clave (ej: "álgebra" en "Ecuaciones cuadráticas")
  const keywords: Record<string, Record<string, string>> = {
    'Matemáticas': {
      'álgebra': 'Álgebra y Cálculo',
      'algebra': 'Álgebra y Cálculo',
      'cálculo': 'Álgebra y Cálculo',
      'calculo': 'Álgebra y Cálculo',
      'ecuaciones': 'Álgebra y Cálculo',
      'geometría': 'Geometría',
      'geometria': 'Geometría',
      'estadística': 'Estadistica',
      'estadistica': 'Estadistica',
    },
    'Lenguaje': {
      'literario': 'Textos literarios',
      'informativo': 'Textos informativos',
      'filosófico': 'Textos filosoficos',
      'filosofico': 'Textos filosoficos',
    },
    // Para otras materias, si no hay match, retornar el primer topic como fallback conservador
  };

  const subjectKeywords = keywords[subject.name];
  if (subjectKeywords) {
    for (const [keyword, canonicalName] of Object.entries(subjectKeywords)) {
      if (normalizedGranular.includes(keyword)) {
        return canonicalName;
      }
    }
  }

  return null;
}

/**
 * Obtiene los topics canónicos con debilidad para una materia.
 * Deduplica y retorna solo ejes válidos de SUBJECTS_CONFIG.
 */
export function getCanonicalTopicsWithWeakness(
  subjectName: string,
  weaknessTopics: string[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const wt of weaknessTopics) {
    const canonical = mapToCanonicalTopic(subjectName, wt);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }

  return result;
}
