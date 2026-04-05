/**
 * Vocabulario académico ICFES — lectura única por materia.
 *
 * Fuente de verdad: definitionswords/consolidado_{materiaSlug} (un documento, campo `items`).
 * No se consultan subcolecciones `palabras` ni se generan definiciones en runtime.
 */

import * as admin from 'firebase-admin';

/** Mapeo de materias ICFES a slugs Firestore */
export const MATERIA_MAP: Record<string, string> = {
  'Matemáticas': 'matematicas',
  'Lectura Crítica': 'lectura_critica',
  'Lenguaje': 'lectura_critica',
  'Ciencias Naturales': 'ciencias_naturales',
  'Física': 'fisica',
  'Biología': 'biologia',
  'Química': 'quimica',
  'Inglés': 'ingles',
  'Sociales y Ciudadanas': 'sociales_ciudadanas',
  'Ciencias Sociales': 'sociales_ciudadanas',
  matematicas: 'matematicas',
  lectura_critica: 'lectura_critica',
  lenguaje: 'lectura_critica',
  ciencias_naturales: 'ciencias_naturales',
  fisica: 'fisica',
  biologia: 'biologia',
  quimica: 'quimica',
  ingles: 'ingles',
  sociales_ciudadanas: 'sociales_ciudadanas',
};

export interface WordDefinition {
  palabra: string;
  definicion: string;
  materia: string;
  fechaCreacion: admin.firestore.Timestamp;
  version: number;
  ejemploIcfes?: string;
  respuestaEjemploIcfes?: string;
  id?: string;
}

class VocabularyService {
  private db: admin.firestore.Firestore;
  /** Caché en memoria por instancia de función (evita relecturas en la misma ejecución). */
  private readonly definitionsWordsConsolidatedCache = new Map<
    string,
    Array<WordDefinition & { id: string }>
  >();

  constructor() {
    this.db = admin.firestore();
  }

  private static readonly DEFINITIONSWORDS_COLLECTION = 'definitionswords';

  private normalizeMateria(materia: string): string {
    return MATERIA_MAP[materia] || materia.toLowerCase().replace(/\s+/g, '_');
  }

  private mapRow(
    data: admin.firestore.DocumentData,
    normalizedMateria: string
  ): WordDefinition & { id: string } {
    const fechaRaw = data.fechaCreacion;
    const fechaCreacion =
      fechaRaw &&
      typeof (fechaRaw as admin.firestore.Timestamp).toMillis === 'function'
        ? (fechaRaw as admin.firestore.Timestamp)
        : admin.firestore.Timestamp.now();

    return {
      id: String(data.id ?? ''),
      palabra: String(data.palabra ?? ''),
      definicion: String(data.definicion ?? ''),
      materia: String(data.materia ?? normalizedMateria),
      fechaCreacion,
      version: typeof data.version === 'number' ? data.version : 1,
      ...(data.ejemploIcfes && { ejemploIcfes: data.ejemploIcfes }),
      ...(data.respuestaEjemploIcfes && {
        respuestaEjemploIcfes: data.respuestaEjemploIcfes,
      }),
    };
  }

  /**
   * Una sola lectura Firestore: definitionswords/consolidado_{materiaSlug}
   */
  private async loadConsolidatedWords(
    normalizedMateria: string
  ): Promise<Array<WordDefinition & { id: string }>> {
    const hit = this.definitionsWordsConsolidatedCache.get(normalizedMateria);
    if (hit) {
      return hit;
    }

    const docId = `consolidado_${normalizedMateria}`;
    const snap = await this.db
      .collection(VocabularyService.DEFINITIONSWORDS_COLLECTION)
      .doc(docId)
      .get();

    if (!snap.exists) {
      console.warn(
        `   ⚠️ Vocabulario: no existe el documento ${docId}. Define el consolidado en Firestore.`
      );
      const empty: Array<WordDefinition & { id: string }> = [];
      this.definitionsWordsConsolidatedCache.set(normalizedMateria, empty);
      return empty;
    }

    const raw = snap.data() as { items?: admin.firestore.DocumentData[] } | undefined;
    const items = Array.isArray(raw?.items) ? raw.items : [];

    const all = items
      .filter((row) => row && String(row.id ?? '').length > 0)
      .map((row) => this.mapRow(row, normalizedMateria));

    this.definitionsWordsConsolidatedCache.set(normalizedMateria, all);
    console.log(
      `   📦 Vocabulario ${docId}: ${all.length} palabra(s) (1 lectura)`
    );
    return all;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async getWords(
    materia: string,
    limit: number = 10,
    excludeIds: string[] = []
  ): Promise<WordDefinition[]> {
    const normalizedMateria = this.normalizeMateria(materia);
    const allWords = await this.loadConsolidatedWords(normalizedMateria);
    const usable = allWords.filter(
      (word) => word.id && !excludeIds.includes(word.id)
    );
    const shuffled = this.shuffleArray([...usable]);
    return shuffled.slice(0, Math.max(0, limit));
  }

  async getAllWords(materia: string): Promise<WordDefinition[]> {
    const normalizedMateria = this.normalizeMateria(materia);
    const allWords = await this.loadConsolidatedWords(normalizedMateria);
    return allWords.filter((word) => Boolean(word.id));
  }

}

export const vocabularyService = new VocabularyService();
