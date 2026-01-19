/**
 * Servicio de Vocabulario Académico para ICFES Saber 11
 * 
 * Gestiona el banco de vocabulario académico organizado por materias.
 * Implementa un modelo híbrido: consulta Firestore primero, luego IA si es necesario.
 */

import * as admin from 'firebase-admin';
import { geminiClient } from '../config/gemini.config';

/**
 * Mapeo de materias ICFES a nombres normalizados para Firestore
 */
export const MATERIA_MAP: Record<string, string> = {
  'Matemáticas': 'matematicas',
  'Lectura Crítica': 'lectura_critica',
  'Ciencias Naturales': 'ciencias_naturales',
  'Física': 'fisica',
  'Biología': 'biologia',
  'Química': 'quimica',
  'Inglés': 'ingles',
  'Sociales y Ciudadanas': 'sociales_ciudadanas',
  'Ciencias Sociales': 'sociales_ciudadanas', // Mapeo adicional para compatibilidad
  'matematicas': 'matematicas',
  'lectura_critica': 'lectura_critica',
  'ciencias_naturales': 'ciencias_naturales',
  'fisica': 'fisica',
  'biologia': 'biologia',
  'quimica': 'quimica',
  'ingles': 'ingles',
  'sociales_ciudadanas': 'sociales_ciudadanas',
  'ciencias_sociales': 'sociales_ciudadanas', // Mapeo adicional para normalización automática
};

/**
 * Interfaz para una definición de palabra
 */
export interface WordDefinition {
  palabra: string;
  definicion: string;
  materia: string;
  activa: boolean;
  fechaCreacion: admin.firestore.Timestamp;
  version: number;
  ejemploIcfes?: string; // Ejemplo de uso en pruebas ICFES
  respuestaEjemploIcfes?: string; // Respuesta lógica y razonable al ejemplo
  id?: string;
}

/**
 * Prompt del sistema para la IA
 */
const SYSTEM_PROMPT = `Actúa como un experto lingüista avalado por la Real Academia Española (RAE), con más de 20 años de experiencia en pedagogía y un doctorado en Ciencias de la Educación. Tu función es definir vocabulario académico utilizado en las pruebas ICFES Saber 11.

Las definiciones deben ser:
- Claras, concisas y precisas
- Adecuadas para estudiantes de grado 11
- Sin tecnicismos innecesarios
- Contextualizadas al uso académico y evaluativo del ICFES
- Máximo 4-5 líneas por definición
- No incluyas ejemplos extensos ni referencias externas.

Responde ÚNICAMENTE con la definición, sin explicaciones adicionales ni formato especial.`;

/**
 * Función helper para detectar si un texto contiene una pregunta
 */
function contienePregunta(texto: string): boolean {
  if (!texto || texto.trim() === '') return false;
  
  // Detectar signos de interrogación
  if (texto.includes('?') || texto.includes('¿')) {
    return true;
  }
  
  // Detectar palabras interrogativas comunes al inicio o en el texto
  const palabrasInterrogativas = [
    'qué', 'que', 'cuál', 'cual', 'cuáles', 'cuales',
    'cómo', 'como', 'dónde', 'donde', 'cuándo', 'cuando',
    'por qué', 'porque', 'por qué', 'porque',
    'quién', 'quien', 'quiénes', 'quienes',
    'cuánto', 'cuanto', 'cuánta', 'cuanta', 'cuántos', 'cuantos', 'cuántas', 'cuantas'
  ];
  
  // Verificar si alguna palabra interrogativa aparece en el texto
  for (const palabra of palabrasInterrogativas) {
    // Buscar al inicio de oraciones o después de puntuación
    const regex = new RegExp(`(^|[.?!]\\s+)${palabra}\\s+`, 'i');
    if (regex.test(texto)) {
      return true;
    }
  }
  
  // Detectar patrones de pregunta comunes
  const patronesPregunta = [
    /^[¿]?[a-záéíóúñ\s]+[?¿]/i, // Texto seguido de signo de interrogación
    /(qué|cual|cómo|dónde|cuándo|por qué|quién|cuánto)\s+[a-záéíóúñ]/i, // Palabra interrogativa seguida de texto
  ];
  
  for (const patron of patronesPregunta) {
    if (patron.test(texto)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Función helper para generar el prompt de ejemplo con respuesta
 */
function getExamplePrompt(palabra: string, materia: string): string {
  return `Actúa como un experto en evaluación educativa y diseño de pruebas ICFES Saber 11, con más de 15 años de experiencia en educación secundaria.

Tu función es generar un ejemplo breve y realista de cómo la palabra "${palabra}" se utiliza en una pregunta típica de las pruebas ICFES Saber 11 para la materia de ${materia}.

IMPORTANTE: Si el ejemplo que generes contiene una pregunta (tiene signos de interrogación o palabras interrogativas como "qué", "cuál", "cómo", etc.), DEBES incluir también una respuesta lógica y razonable. Si el ejemplo NO es una pregunta, NO incluyas respuesta.

REQUISITOS OBLIGATORIOS PARA EL EJEMPLO:

1. Una situación concreta
   - Debe ocurrir en un contexto reconocible (escuela, familia, ciudad, vida diaria).

2. Un solo concepto central
   - El ejemplo explica una palabra, no varias al mismo tiempo.

3. Uso explícito de la palabra
   - La palabra "${palabra}" debe aparecer escrita dentro del ejemplo.

4. Lenguaje sencillo y directo
   - Frases cortas, vocabulario común, sin tecnicismos innecesarios.

5. Relación causa–consecuencia
   - Debe mostrar qué pasa y por qué pasa, usando la palabra.

6. Acción clara (algo ocurre)
   - No solo describe, muestra una acción o decisión.

7. Evita definiciones disfrazadas
   - El ejemplo no debe sonar como una definición repetida.

8. Conexión con la experiencia del estudiante
   - El estudiante debe poder decir: "esto lo he visto" o "esto me podría pasar".

9. Tiempo y lugar implícitos o explícitos
   - Ayuda a situar mentalmente la situación.

10. No genera ambigüedad
    - No debe permitir dos interpretaciones del concepto.

11. No incluye información irrelevante
    - Todo lo que aparece en el ejemplo ayuda a entender la palabra.

12. Permite inferir el significado
    - Aunque no conozca la definición, el estudiante puede deducirla.

13. No depende de conocimientos previos complejos
    - Debe entenderse sin saber teoría avanzada.

14. Tiene coherencia lógica
    - Lo que ocurre tiene sentido y no se contradice.

15. Es breve, pero suficiente
    - Ni muy largo ni muy corto: lo justo para entender (máximo 4-5 líneas).

16. Muestra qué es y qué no es (implícitamente)
    - Deja claro el límite del concepto sin explicarlo.

17. Es fiel al uso académico real de la palabra
    - Tal como aparece en textos ICFES, no en lenguaje coloquial incorrecto.

18. Se puede convertir en pregunta
    - Un buen ejemplo puede transformarse fácilmente en una pregunta tipo examen.

19. Los ejemplos deben ser lo más aplicables y fáciles de hacer entender el uso de la palabra en la pregunta y cómo influye en la respuesta.
    - Además, no solo debe salir como sale en las ICFES, sino que el ejemplo debe contener cómo se interpreta la palabra en la pregunta para solucionar la pregunta, es decir, cómo influye la misma en la respuesta.

REQUISITOS OBLIGATORIOS PARA LA RESPUESTA (SOLO SI EL EJEMPLO ES UNA PREGUNTA):

1. Debe ser lógica y razonable
   - La respuesta debe seguir directamente del ejemplo y mostrar claramente cómo se usa la palabra.

2. Debe explicar cómo la palabra influye en la solución
   - Muestra cómo entender la palabra "${palabra}" es clave para resolver correctamente.

3. Debe ser clara y pedagógica
   - El estudiante debe entender por qué esa es la respuesta lógica y razonable.

4. Debe ser concisa
   - Máximo 4-5 líneas, directa al punto.

5. Debe reforzar el significado de la palabra
   - Al leer la respuesta, el estudiante comprende mejor qué significa "${palabra}".

FORMATO DE RESPUESTA:
- Si el ejemplo ES una pregunta, responde en formato JSON con DOS campos:
{
  "ejemplo": "Aquí va el ejemplo de uso (máximo 4-5 líneas) que contiene una pregunta",
  "respuesta": "Aquí va la respuesta lógica y razonable (máximo 4-5 líneas)"
}

- Si el ejemplo NO es una pregunta, responde en formato JSON con UN SOLO campo:
{
  "ejemplo": "Aquí va el ejemplo de uso (máximo 4-5 líneas) sin pregunta"
}

IMPORTANTE:
- El ejemplo debe ser similar a preguntas reales del ICFES Saber 11
- SOLO incluye "respuesta" si el ejemplo contiene una pregunta (signos de interrogación o palabras interrogativas)
- Si el ejemplo no es una pregunta, NO incluyas el campo "respuesta"
- Responde ÚNICAMENTE con el JSON, sin explicaciones adicionales ni texto fuera del JSON.`;
}

/**
 * Servicio principal de Vocabulario
 */
class VocabularyService {
  private db: admin.firestore.Firestore;

  constructor() {
    // Usar la base de datos por defecto (superate-ia o superate-6c730 según configuración)
    this.db = admin.firestore();
  }

  /**
   * Normaliza el nombre de la materia
   */
  private normalizeMateria(materia: string): string {
    const normalized = MATERIA_MAP[materia] || materia.toLowerCase().replace(/\s+/g, '_');
    return normalized;
  }

  /**
   * Obtiene palabras aleatorias de una materia desde Firestore
   */
  async getWords(
    materia: string,
    limit: number = 10,
    excludeIds: string[] = []
  ): Promise<WordDefinition[]> {
    try {
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      // Construir query: solo palabras activas
      let query: admin.firestore.Query = palabrasRef.where('activa', '==', true);

      // Si hay IDs a excluir, agregar filtro
      if (excludeIds.length > 0) {
        // Firestore no permite != con arrays, así que filtramos después
        const snapshot = await query.get();
        const allWords = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as WordDefinition & { id: string }))
          .filter(word => !excludeIds.includes(word.id));

        // Mezclar aleatoriamente y tomar el límite
        const shuffled = this.shuffleArray([...allWords]);
        return shuffled.slice(0, limit);
      }

      // Obtener todas las palabras activas
      const snapshot = await query.get();
      const words = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as WordDefinition & { id: string }));

      // Mezclar aleatoriamente y tomar el límite
      const shuffled = this.shuffleArray([...words]);
      return shuffled.slice(0, limit);
    } catch (error: any) {
      console.error(`❌ Error obteniendo palabras para ${materia}:`, error);
      throw new Error(`Error al obtener palabras: ${error.message}`);
    }
  }

  /**
   * Obtiene la definición de una palabra específica
   */
  async getWordDefinition(materia: string, palabra: string): Promise<WordDefinition | null> {
    try {
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      // Buscar por palabra (case-insensitive)
      const snapshot = await palabrasRef
        .where('palabra', '==', palabra.toLowerCase().trim())
        .where('activa', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        // Si no existe, intentar generar con IA
        return await this.generateAndSaveDefinition(materia, palabra);
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as WordDefinition;
    } catch (error: any) {
      console.error(`❌ Error obteniendo definición para ${palabra}:`, error);
      throw new Error(`Error al obtener definición: ${error.message}`);
    }
  }

  /**
   * Genera una definición usando IA y la guarda en Firestore
   */
  private async generateAndSaveDefinition(
    materia: string,
    palabra: string
  ): Promise<WordDefinition | null> {
    try {
      if (!(await geminiClient.isAvailable())) {
        throw new Error('Servicio de Gemini no está disponible');
      }

      // Generar definición con IA
      const prompt = `${SYSTEM_PROMPT}\n\nDefine la siguiente palabra en el contexto de ${materia} para estudiantes de grado 11:\n\n"${palabra}"`;

      const response = await geminiClient.generateContent(prompt, [], {
        timeout: 30000, // 30 segundos para definiciones simples
      });

      if (!response || !response.text) {
        throw new Error('No se pudo generar la definición');
      }

      const definicion = response.text.trim();

      // Generar ejemplo de uso en ICFES con respuesta
      let ejemploIcfes: string | undefined;
      let respuestaEjemploIcfes: string | undefined;
      try {
        const examplePrompt = getExamplePrompt(palabra, materia);
        const exampleResponse = await geminiClient.generateContent(examplePrompt, [], {
          timeout: 30000, // 30 segundos para ejemplos
        });

        if (exampleResponse && exampleResponse.text) {
          const responseText = exampleResponse.text.trim();
          
          // Intentar parsear como JSON
          try {
            // Limpiar el texto para extraer JSON (puede venir con markdown code blocks)
            let jsonText = responseText;
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
              jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }
            
            // Intentar parsear JSON
            const parsed = JSON.parse(jsonText);
            if (parsed.ejemplo) {
              ejemploIcfes = parsed.ejemplo.trim();
              
              // Solo guardar respuesta si el ejemplo contiene una pregunta
              if (parsed.respuesta && ejemploIcfes && contienePregunta(ejemploIcfes)) {
                respuestaEjemploIcfes = parsed.respuesta.trim();
              } else if (parsed.respuesta && ejemploIcfes && !contienePregunta(ejemploIcfes)) {
                // Si hay respuesta pero el ejemplo no es pregunta, no guardar la respuesta
                console.warn(`⚠️ Se generó respuesta para ${palabra} pero el ejemplo no contiene pregunta. Respuesta omitida.`);
              }
            } else {
              // Si no tiene la estructura esperada, usar todo como ejemplo
              ejemploIcfes = responseText;
            }
          } catch (parseError) {
            // Si no es JSON válido, usar todo el texto como ejemplo
            console.warn(`⚠️ No se pudo parsear JSON para ${palabra}, usando texto completo como ejemplo`);
            ejemploIcfes = responseText;
          }
        }
      } catch (exampleError: any) {
        console.warn(`⚠️ No se pudo generar ejemplo para ${palabra}:`, exampleError.message);
        // Continuar sin ejemplo si falla
      }

      // Guardar en Firestore
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      // Crear documento con ID basado en la palabra normalizada
      const palabraId = palabra.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const wordData: Omit<WordDefinition, 'id'> = {
        palabra: palabra.toLowerCase().trim(),
        definicion,
        materia: normalizedMateria,
        activa: true,
        fechaCreacion: admin.firestore.Timestamp.now(),
        version: 1,
        ...(ejemploIcfes && { ejemploIcfes }), // Agregar ejemplo solo si se generó
        ...(respuestaEjemploIcfes && { respuestaEjemploIcfes }), // Agregar respuesta solo si se generó
      };

      await palabrasRef.doc(palabraId).set(wordData);

      return {
        id: palabraId,
        ...wordData,
      } as WordDefinition;
    } catch (error: any) {
      console.error(`❌ Error generando definición para ${palabra}:`, error);
      // No lanzar error, retornar null para que el frontend maneje
      return null;
    }
  }

  /**
   * Genera un lote de definiciones (para job backend)
   */
  async generateBatch(materia: string, palabras: string[]): Promise<{
    success: number;
    failed: number;
    results: Array<{ palabra: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ palabra: string; success: boolean; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const palabra of palabras) {
      try {
        // Verificar si ya existe
        const existing = await this.getWordDefinition(materia, palabra);
        if (existing) {
          results.push({ palabra, success: true });
          success++;
          continue;
        }

        // Generar nueva
        const generated = await this.generateAndSaveDefinition(materia, palabra);
        if (generated) {
          results.push({ palabra, success: true });
          success++;
        } else {
          results.push({ palabra, success: false, error: 'No se pudo generar' });
          failed++;
        }
      } catch (error: any) {
        results.push({ palabra, success: false, error: error.message });
        failed++;
      }
    }

    return { success, failed, results };
  }

  /**
   * Mezcla un array aleatoriamente (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Cuenta cuántas palabras activas tiene una materia
   */
  async countActiveWords(materia: string): Promise<number> {
    try {
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      const snapshot = await palabrasRef.where('activa', '==', true).get();
      return snapshot.size;
    } catch (error: any) {
      console.error(`❌ Error contando palabras para ${materia}:`, error);
      return 0;
    }
  }

  /**
   * Genera ejemplos para palabras existentes que no tienen ejemplo
   */
  async generateExamplesForExistingWords(
    materia: string,
    options?: {
      limit?: number; // Límite de palabras a procesar (opcional, por defecto todas)
      batchSize?: number; // Tamaño del lote para procesar (opcional, por defecto 10)
      delayBetweenBatches?: number; // Delay en ms entre lotes (opcional, por defecto 2000)
    }
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    results: Array<{ palabra: string; success: boolean; error?: string }>;
  }> {
    try {
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      // Obtener todas las palabras activas que no tienen ejemplo
      const snapshot = await palabrasRef.where('activa', '==', true).get();
      
      const wordsWithoutExample = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as WordDefinition & { id: string }))
        .filter(word => !word.ejemploIcfes || word.ejemploIcfes.trim() === '');

      const limit = options?.limit || wordsWithoutExample.length;
      const wordsToProcess = wordsWithoutExample.slice(0, limit);
      const batchSize = options?.batchSize || 10;
      const delayBetweenBatches = options?.delayBetweenBatches || 2000;

      console.log(`📝 Procesando ${wordsToProcess.length} palabra(s) sin ejemplo para ${materia}`);
      
      const results: Array<{ palabra: string; success: boolean; error?: string }> = [];
      let success = 0;
      let failed = 0;
      let skipped = 0;

      // Procesar en lotes
      for (let i = 0; i < wordsToProcess.length; i += batchSize) {
        const batch = wordsToProcess.slice(i, i + batchSize);
        console.log(`   📦 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(wordsToProcess.length / batchSize)} (${batch.length} palabras)...`);

        for (const word of batch) {
          try {
            if (!(await geminiClient.isAvailable())) {
              throw new Error('Servicio de Gemini no está disponible');
            }

            // Generar ejemplo con respuesta
            const examplePrompt = getExamplePrompt(word.palabra, normalizedMateria);
            const exampleResponse = await geminiClient.generateContent(examplePrompt, [], {
              timeout: 30000,
            });

            if (!exampleResponse || !exampleResponse.text) {
              throw new Error('No se pudo generar el ejemplo');
            }

            const responseText = exampleResponse.text.trim();
            let ejemploIcfes: string | undefined;
            let respuestaEjemploIcfes: string | undefined;

            // Intentar parsear como JSON
            try {
              // Limpiar el texto para extraer JSON (puede venir con markdown code blocks)
              let jsonText = responseText;
              if (jsonText.includes('```json')) {
                jsonText = jsonText.split('```json')[1].split('```')[0].trim();
              } else if (jsonText.includes('```')) {
                jsonText = jsonText.split('```')[1].split('```')[0].trim();
              }
              
              // Intentar parsear JSON
              const parsed = JSON.parse(jsonText);
              if (parsed.ejemplo) {
                ejemploIcfes = parsed.ejemplo.trim();
                
                // Solo guardar respuesta si el ejemplo contiene una pregunta
                if (parsed.respuesta && ejemploIcfes && contienePregunta(ejemploIcfes)) {
                  respuestaEjemploIcfes = parsed.respuesta.trim();
                } else if (parsed.respuesta && ejemploIcfes && !contienePregunta(ejemploIcfes)) {
                  // Si hay respuesta pero el ejemplo no es pregunta, no guardar la respuesta
                  console.warn(`⚠️ Se generó respuesta para ${word.palabra} pero el ejemplo no contiene pregunta. Respuesta omitida.`);
                }
              } else {
                // Si no tiene la estructura esperada, usar todo como ejemplo
                ejemploIcfes = responseText;
              }
            } catch (parseError) {
              // Si no es JSON válido, usar todo el texto como ejemplo
              console.warn(`⚠️ No se pudo parsear JSON para ${word.palabra}, usando texto completo como ejemplo`);
              ejemploIcfes = responseText;
            }

            // Actualizar documento en Firestore
            const updateData: any = {};
            if (ejemploIcfes) {
              updateData.ejemploIcfes = ejemploIcfes;
            }
            if (respuestaEjemploIcfes) {
              updateData.respuestaEjemploIcfes = respuestaEjemploIcfes;
            }

            if (Object.keys(updateData).length > 0) {
              await palabrasRef.doc(word.id).update(updateData);
            }

            results.push({ palabra: word.palabra, success: true });
            success++;
            console.log(`      ✅ Ejemplo generado para: ${word.palabra}`);
          } catch (error: any) {
            console.error(`      ❌ Error generando ejemplo para ${word.palabra}:`, error.message);
            results.push({ palabra: word.palabra, success: false, error: error.message });
            failed++;
          }

          // Delay pequeño entre palabras para evitar rate limits
          if (i + batch.indexOf(word) < wordsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Delay entre lotes
        if (i + batchSize < wordsToProcess.length) {
          console.log(`   ⏳ Esperando ${delayBetweenBatches}ms antes del siguiente lote...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      skipped = wordsWithoutExample.length - wordsToProcess.length;

      return { success, failed, skipped, results };
    } catch (error: any) {
      console.error(`❌ Error generando ejemplos para ${materia}:`, error);
      throw new Error(`Error al generar ejemplos: ${error.message}`);
    }
  }

  /**
   * Elimina todos los ejemplos de palabras de una materia
   */
  async deleteExamplesForMateria(materia: string): Promise<{
    deleted: number;
    failed: number;
  }> {
    try {
      const normalizedMateria = this.normalizeMateria(materia);
      const materiaRef = this.db.collection('definitionswords').doc(normalizedMateria);
      const palabrasRef = materiaRef.collection('palabras');

      // Obtener todas las palabras activas que tienen ejemplo
      const snapshot = await palabrasRef.where('activa', '==', true).get();
      
      const wordsWithExample = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.ejemploIcfes && data.ejemploIcfes.trim() !== '';
        });

      console.log(`🗑️ Eliminando ejemplos de ${wordsWithExample.length} palabra(s) en ${materia}...`);

      let deleted = 0;
      let failed = 0;

      // Usar batch writes para eliminar el campo ejemploIcfes
      const batchSize = 500; // Límite de Firestore
      for (let i = 0; i < wordsWithExample.length; i += batchSize) {
        const batch = this.db.batch();
        const batchDocs = wordsWithExample.slice(i, i + batchSize);

        for (const doc of batchDocs) {
          try {
            batch.update(doc.ref, {
              ejemploIcfes: admin.firestore.FieldValue.delete(),
              respuestaEjemploIcfes: admin.firestore.FieldValue.delete(),
            });
          } catch (error: any) {
            console.error(`   ❌ Error preparando eliminación para ${doc.id}:`, error.message);
            failed++;
          }
        }

        try {
          await batch.commit();
          deleted += batchDocs.length;
          console.log(`   ✅ Eliminados ${batchDocs.length} ejemplo(s) (lote ${Math.floor(i / batchSize) + 1})`);
        } catch (error: any) {
          console.error(`   ❌ Error ejecutando batch:`, error.message);
          failed += batchDocs.length;
        }
      }

      return { deleted, failed };
    } catch (error: any) {
      console.error(`❌ Error eliminando ejemplos para ${materia}:`, error);
      throw new Error(`Error al eliminar ejemplos: ${error.message}`);
    }
  }
}

export const vocabularyService = new VocabularyService();
