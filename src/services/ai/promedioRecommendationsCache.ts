/**
 * Caché local de recomendaciones IA del análisis (promedio).
 * Reduce llamadas a Gemini cuando los resultados del estudiante no han cambiado.
 *
 * @see gemini.service — la clave VITE_GEMINI_API_KEY expone el modelo en el cliente;
 *   a futuro migrar generación a Cloud Functions para mayor seguridad y cuotas centralizadas.
 */

const STORAGE_PREFIX = 'superate_promedio_ai_recs';
const CACHE_VERSION = 1;
/** Tiempo de vida de la caché (72 h). Tras nuevas evaluaciones el hash cambia y se regenera. */
export const PROMEDIO_RECOMMENDATIONS_TTL_MS = 72 * 60 * 60 * 1000;

export type CachedRecommendation = {
  priority: string;
  subject: string;
  topic: string;
  resources: string[];
  timeEstimate: string;
  explanation: string;
};

type CacheEntry = {
  v: number;
  hash: string;
  savedAt: number;
  recommendations: CachedRecommendation[];
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}_v${CACHE_VERSION}_${userId}`;
}

/** Payload alineado con geminiService.generateRecommendations (desde AnalysisData consolidado). */
export type PromedioRecommendationPayload = {
  subjects: Array<{
    name: string;
    percentage: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  overall: { averagePercentage: number; score: number };
  patterns: { strongestArea: string; weakestArea: string; timeManagement: string };
};

export function buildPayloadFromAnalysisData(data: {
  subjects: Array<{ name: string; percentage: number; strengths: string[]; weaknesses: string[] }>;
  overall: { averagePercentage: number; score: number };
  patterns: { strongestArea: string; weakestArea: string; timeManagement: string };
}): PromedioRecommendationPayload {
  return {
    subjects: data.subjects.map((s) => ({
      name: s.name,
      percentage: s.percentage,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
    })),
    overall: {
      averagePercentage: data.overall.averagePercentage,
      score: data.overall.score,
    },
    patterns: { ...data.patterns },
  };
}

/** Firma estable del rendimiento actual para decidir si hace falta nueva llamada a IA. */
export function buildPromedioRecommendationsHash(data: PromedioRecommendationPayload): string {
  const subjects = [...data.subjects]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((s) => ({
      n: s.name,
      p: Math.round(s.percentage * 100) / 100,
      w: [...s.weaknesses].sort().join(','),
    }));
  const payload = JSON.stringify({
    subjects,
    avg: Math.round(data.overall.averagePercentage * 100) / 100,
    score: Math.round(data.overall.score),
    wk: data.patterns.weakestArea,
    st: data.patterns.strongestArea,
    tm: data.patterns.timeManagement,
  });
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function getCachedPromedioRecommendations(
  userId: string,
  payloadHash: string
): CachedRecommendation[] | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.v !== CACHE_VERSION || entry.hash !== payloadHash) return null;
    if (Date.now() - entry.savedAt > PROMEDIO_RECOMMENDATIONS_TTL_MS) {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    if (!Array.isArray(entry.recommendations)) return null;
    return entry.recommendations;
  } catch {
    return null;
  }
}

export function setCachedPromedioRecommendations(
  userId: string,
  payloadHash: string,
  recommendations: CachedRecommendation[]
): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const entry: CacheEntry = {
      v: CACHE_VERSION,
      hash: payloadHash,
      savedAt: Date.now(),
      recommendations,
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(entry));
  } catch {
    /* quota exceeded u otro */
  }
}

export function clearPromedioRecommendationsCache(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* noop */
  }
}
