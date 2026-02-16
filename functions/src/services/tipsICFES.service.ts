/**
 * Servicio de Tips ICFES (Tips para Romperla en el ICFES).
 * Genera tips con Gemini y los guarda en Firestore (TipsIA) en superate-6c730.
 * Uso: npm run generate-tips (o con BATCH_SIZE=30, etc.)
 */

import { getStudentDatabase } from '../utils/firestoreHelpers';
import { geminiClient } from '../config/gemini.config';
import { jsonrepair } from 'jsonrepair';

export const TIP_CATEGORIES = [
  'Estrategia',
  'Tiempo',
  'Simulacro',
  'Errores Comunes',
  'Motivacion',
  'Tecnica de Estudio',
  'Dia del Examen',
  'MiniReto',
] as const;

export type TipCategory = (typeof TIP_CATEGORIES)[number];

export interface TipICFES {
  id?: string;
  title: string;
  description: string;
  subject: string;
  topic: string;
  level: string;
  category: string;
  example?: string;
  recommendation?: string;
  tags: string[];
  createdBy: string;
  createdAt: number;
  active: boolean;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

/**
 * Obtiene hasta `limit` tips aleatorios desde Firestore (TipsIA).
 */
export async function getRandomTips(limit: number = DEFAULT_LIMIT): Promise<TipICFES[]> {
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const db = getStudentDatabase();
  const snapshot = await db.collection('TipsIA').where('active', '==', true).get();

  if (snapshot.empty) return [];

  const all = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as TipICFES[];

  if (all.length <= effectiveLimit) return all;

  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, effectiveLimit);
}

const SUBJECT_TO_TIP_TERMS: Record<string, string[]> = {
  'Matemáticas': ['Matematicas'],
  'Lenguaje': ['Lectura Critica', 'Lenguaje'],
  'Ciencias Sociales': ['Ciencias Sociales'],
  'Biologia': ['Ciencias Naturales', 'Biologia'],
  'Quimica': ['Ciencias Naturales', 'Quimica'],
  'Física': ['Ciencias Naturales', 'Física', 'Fisica'],
  'Inglés': ['Ingles', 'Inglés'],
};

function getTipSearchTermsForSubject(subjectName: string): string[] {
  const trimmed = subjectName.trim();
  const terms = SUBJECT_TO_TIP_TERMS[trimmed];
  if (terms) return terms;
  return [trimmed.normalize('NFD').replace(/\u0300/g, '').replace(/\s+/g, ' ')];
}

/** Normaliza para comparación (quita tildes) así "Lectura Crítica" y "Lectura Critica" coinciden. */
function normalizeForMatch(s: string): string {
  return s.normalize('NFD').replace(/\u0300/g, '').toLowerCase();
}

function tipMatchesSubject(tip: TipICFES, subjectName: string): boolean {
  const raw = (tip.subject ?? '').trim();
  if (!raw) return false;
  const subjectNorm = normalizeForMatch(raw);
  const terms = getTipSearchTermsForSubject(subjectName);
  for (const term of terms) {
    if (subjectNorm.includes(normalizeForMatch(term))) return true;
  }
  if (subjectNorm.includes('general')) return true;
  return false;
}

/**
 * Obtiene hasta `limit` tips aleatorios filtrados por materia.
 */
export async function getTipsBySubject(subjectName: string, limit: number = 5): Promise<TipICFES[]> {
  const effectiveLimit = Math.min(Math.max(1, limit), 20);
  const db = getStudentDatabase();
  const snapshot = await db.collection('TipsIA').where('active', '==', true).get();

  if (snapshot.empty) return [];

  const all = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as TipICFES[];

  const forSubject = all.filter((t) => tipMatchesSubject(t, subjectName));
  if (forSubject.length <= effectiveLimit) return forSubject;

  const shuffled = [...forSubject];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, effectiveLimit);
}

export interface GenerateAndSaveTipsResult {
  saved: number;
  skipped: number;
}

/** Payload que devuelve la IA (sin id, createdBy, createdAt, active) */
interface TipFromAI {
  title?: string;
  description?: string;
  subject?: string;
  topic?: string;
  level?: string;
  category?: string;
  example?: string;
  recommendation?: string;
  tags?: string[];
}

function isValidTip(t: TipFromAI): t is TipFromAI & { title: string; description: string; category: string } {
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof (t as any).title === 'string' &&
    (t as any).title.trim() !== '' &&
    typeof (t as any).description === 'string' &&
    (t as any).description.trim() !== '' &&
    typeof (t as any).category === 'string' &&
    (t as any).category.trim() !== ''
  );
}

function buildTipsPrompt(count: number, categories: string[]): string {
  const categoriesList = categories.length > 0 ? categories.join(', ') : TIP_CATEGORIES.join(', ');
  const perArea = Math.floor(count / 5);
  const remainder = count % 5;
  return `Eres un mentor experto en la prueba ICFES Saber 11 de Colombia con más de 20 años de experiencia, especializado en estrategias de alto puntaje (350 a 500). Tu misión es generar consejos altamente efectivos para estudiantes de grado 11 que se preparan para el examen.

**Contexto Saber 11 (obligatorio tenerlo en cuenta)**
La prueba Saber 11 se compone de cinco módulos:
• Lectura Crítica
• Matemáticas
• Sociales y Ciudadanas (usa subject "Ciencias Sociales" en el JSON)
• Ciencias Naturales
• Inglés

Cada módulo evalúa competencias como interpretar, argumentar, proponer, analizar información, resolver problemas y comprender textos. El examen usa preguntas de selección múltiple con única respuesta, con distractores diseñados para confundir, y el tiempo limitado es un factor crítico.

Los estudiantes suelen fallar por: mala gestión del tiempo, lectura apresurada, caer en distractores que parecen correctos, no entender qué está preguntando el enunciado, no analizar errores después de simulacros.

**Reglas obligatorias para cada tip**
1. **Preciso:** Enfocado en una situación real del Saber 11, por ejemplo: preguntas de inferencia en Lectura Crítica; proporcionalidad, porcentajes o funciones en Matemáticas; causa-consecuencia, competencias ciudadanas y leyes en Sociales; interpretación de gráficas, química, física y biología en Ciencias Naturales; lectura de instrucciones, avisos públicos y demás en Inglés.
2. **Contextual:** Explica por qué funciona el consejo, usando lógica típica del ICFES. Ejemplo: "porque el ICFES usa distractores con palabras copiadas del texto pero con sentido diferente. no debe mencionar siempre porque el ICFES, usa otros modos de persuación para que entienda mucho mejor el estudiante".
3. **Accionable:** En "recommendation" debe existir una acción inmediata, medible y práctica. Ejemplo: "En tu próximo simulacro, usa cronómetro y no gastes más de 90 segundos por pregunta antes de saltarla."
4. **Con ejemplo práctico cuando sea útil:** El campo "example" debe incluir un caso realista, con pasos, números, mini-situación o micro-ejercicio.

**Distribución obligatoria**
Los ${count} tips deben cubrir TODAS las áreas. Distribución mínima aproximada: 20% Lectura Crítica, 20% Matemáticas, 20% Ciencias Naturales, 20% Ciencias Sociales, 20% Inglés. Para ${count} tips: aproximadamente ${perArea} por área${remainder > 0 ? ` y reparte los ${remainder} restantes entre las áreas` : ''}. Distribuye lo más equilibrado posible.

**Categorías a repartir:** ${categoriesList}

**Ortografía:** Usa siempre ortografía correcta del español con tildes: Matemáticas, Lectura Crítica, Inglés, Técnica, Motivación, Física, Química, también, hábito, práctica, compresión, etc.

**Valor de "subject" en el JSON (usa exactamente uno por tip):** "Lectura Crítica" | "Matemáticas" | "Ciencias Sociales" | "Ciencias Naturales" | "Inglés". No uses "General" en esta generación; asigna siempre una materia concreta.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después:

{
  "tips": [
    {
      "title": "Título corto y específico (máx. 60 caracteres)",
      "description": "Descripción clara que explique el consejo y su contexto. Incluye por qué funciona en el contexto del ICFES.",
      "subject": "Lectura Crítica | Matemáticas | Ciencias Sociales | Ciencias Naturales | Inglés",
      "topic": "Tema concreto (ej. Inferencia, Porcentajes, Competencias ciudadanas)",
      "level": "Básico | Medio | Avanzado",
      "category": "Una de: ${TIP_CATEGORIES.join(', ')}",
      "example": "Ejemplo práctico con pasos, números o mini-ejercicio realista. Obligatorio cuando el tip lo permita.",
      "recommendation": "Acción inmediata, medible y práctica (ej. tiempo en segundos, número de preguntas, qué hacer en el próximo simulacro).",
      "tags": ["icfes", "saber11", "y 2-3 tags más relevantes"]
    }
  ]
}

Genera exactamente ${count} elementos en "tips". No incluyas createdBy, createdAt ni active. Ortografía impecable. Respeta la distribución por área.`;
}

/**
 * Genera tips con Gemini y los guarda en Firestore (TipsIA).
 */
export async function generateAndSaveTips(options?: {
  count?: number;
  categories?: string[];
  dryRun?: boolean;
}): Promise<GenerateAndSaveTipsResult> {
  const count = Math.min(Math.max(1, options?.count ?? 10), 20);
  const categories = options?.categories?.length
    ? options.categories
    : [...TIP_CATEGORIES];
  const dryRun = options?.dryRun === true;

  if (!(await geminiClient.isAvailable())) {
    throw new Error('Gemini no está disponible');
  }

  const prompt = buildTipsPrompt(count, categories);
  const result = await geminiClient.generateContent(prompt, [], {
    timeout: 120000,
    retries: 2,
  });

  let cleanedText = result.text
    .replace(/```json\n?([\s\S]*?)\n?```/g, '$1')
    .replace(/```\n?([\s\S]*?)\n?```/g, '$1');
  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No se encontró JSON en la respuesta de Gemini');
  }
  let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
  try {
    JSON.parse(jsonString);
  } catch {
    jsonString = jsonrepair(jsonString);
  }

  const parsed = JSON.parse(jsonString) as { tips?: TipFromAI[] };
  const rawTips = Array.isArray(parsed.tips) ? parsed.tips : [];

  const now = Date.now();
  const createdBy = 'gemini';
  let saved = 0;
  let skipped = 0;

  if (!dryRun) {
    const db = getStudentDatabase();
    const col = db.collection('TipsIA');

    for (const t of rawTips) {
      if (!isValidTip(t)) {
        skipped++;
        continue;
      }
      const tip: Record<string, unknown> = {
        title: String(t.title).trim(),
        description: String(t.description).trim(),
        subject: typeof t.subject === 'string' ? t.subject.trim() : 'General',
        topic: typeof t.topic === 'string' ? t.topic.trim() : 'General',
        level: typeof t.level === 'string' ? t.level.trim() : 'Medio',
        category: String(t.category).trim(),
        tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x)) : ['icfes'],
        createdBy,
        createdAt: now,
        active: true,
      };
      if (typeof t.example === 'string' && t.example.trim()) tip.example = t.example.trim();
      if (typeof t.recommendation === 'string' && t.recommendation.trim()) tip.recommendation = t.recommendation.trim();
      await col.add(tip);
      saved++;
    }
  } else {
    skipped = rawTips.filter((t) => !isValidTip(t)).length;
    saved = 0;
  }

  return { saved, skipped };
}
