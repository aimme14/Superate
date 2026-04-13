/**
 * Servicio de Plan de Estudio Personalizado con IA
 * 
 * Genera planes de estudio personalizados basados en las debilidades
 * detectadas en los resultados de los exámenes del estudiante
 */

// Cargar variables de entorno desde .env (solo en desarrollo local)
import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import { geminiClient, GEMINI_CONFIG } from '../config/gemini.config';
import { geminiCentralizedService } from './geminiService';
import {
  getSubjectConfig,
  getTopicCode,
  type SubjectWithTopics,
  VIDEOS_PER_TOPIC,
} from '../config/subjects.config';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { jsonrepair } from 'jsonrepair';
import {
  getCanonicalAnswerIAPhaseSubcollection,
  getCanonicalResultsPhaseSubcollection,
  getLegacyAnswerIAPhaseAlternates,
  getLegacyResultsPhaseAlternates,
} from '../utils/resultsPhasePath';

/** Sin salida a consola en producción (Cloud Logging). Solo emulador o NODE_ENV=development. */
const SP_CONSOLE =
  process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';

function spLog(...args: unknown[]): void {
  if (SP_CONSOLE) console.log(...args);
}
function spWarn(...args: unknown[]): void {
  if (SP_CONSOLE) console.warn(...args);
}
function spErr(...args: unknown[]): void {
  if (SP_CONSOLE) console.error(...args);
}

/**
 * Tipos para el plan de estudio
 */
export interface StudyPlanInput {
  studentId: string;
  phase: 'first' | 'second' | 'third';
  subject: string;
  /** Grado del estudiante en student_info (opcional; default "11"). */
  grade?: string;
}

export interface StudentWeakness {
  topic: string;
  percentage: number;
  correct: number;
  total: number;
  questions: Array<{
    questionId: string | number;
    questionText: string;
    topic: string;
    isCorrect: boolean;
  }>;
}

export interface StudyPlanResponse {
  student_info: {
    studentId: string;
    phase: string;
    subject: string;
    grade?: string; // Grado del estudiante (metadatos; videos/enlaces usan solo consolidados por materia)
    weaknesses: StudentWeakness[];
  };
  diagnostic_summary: string; // 50 palabras sobre lo que trabajará
  study_plan_summary: string; // Resumen del plan
  topics: Array<{
    name: string; // Nombre del tema
    description: string; // Descripción del tema
    level: string; // Nivel de dificultad
    keywords: string[]; // Palabras clave del plan (Gemini); videos vienen de YoutubeLinks/consolidado_*
  }>;
  /** Solo persistidos en AnswerIA; este servicio no lee ni escribe EjerciciosIA. */
  practice_exercises: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>;
  // Videos: YoutubeLinks/consolidado_{materiaCode} (1 lectura); no se persisten en AnswerIA.
  // topic = tema canónico (ruta); topicDisplayName = nombre del plan (Gemini) para UI.
  video_resources: Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
    videoId?: string;
    duration?: string;
    language?: string;
    topic?: string; // Tema canónico de la materia (ruta YoutubeLinks)
    topicDisplayName?: string; // Nombre libre del plan para mostrar en UI
  }>;
  study_links: Array<{
    title: string;
    url: string;
    description: string;
    topic?: string; // Tema al que pertenece el enlace
  }>;
}

export interface StudyPlanGenerationResult {
  success: boolean;
  studyPlan?: StudyPlanResponse;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Servicio principal de Plan de Estudio
 */
class StudyPlanService {
  private static readonly TARGET_EXERCISE_COUNT = 10;
  /** Una promesa por materiaCode: evita cargas duplicadas del consolidado_* en paralelo. */
  private readonly webLinksConsolidatedPromises = new Map<
    string,
    Promise<Array<{ title: string; url: string; description: string; topic?: string }>>
  >();
  private readonly youtubeLinksConsolidatedPromises = new Map<
    string,
    Promise<
      Array<{
        title: string;
        url: string;
        description: string;
        channelTitle: string;
        videoId?: string;
        duration?: string;
        language?: string;
        topic?: string;
      }>
    >
  >();

  /** Firestore superate-6c730 (una sola instancia por proceso). */
  private studentDbCache: admin.firestore.Firestore | null = null;

  /**
   * Obtiene una instancia de Firestore para el proyecto superate-6c730
   * donde están almacenados los resultados de los estudiantes
   */
  private getStudentDatabase(): admin.firestore.Firestore {
    if (this.studentDbCache) {
      return this.studentDbCache;
    }
    try {
      // Intentar obtener la app existente para superate-6c730
      let studentApp: admin.app.App;
      try {
        studentApp = admin.app('superate-6c730');
      } catch {
        // Si no existe, crear una nueva app para superate-6c730
        // Intentar cargar las credenciales del proyecto superate-6c730
        const credentialsPath = path.resolve(__dirname, '../../serviceAccountKey.json');
        
        if (fs.existsSync(credentialsPath)) {
          // Desarrollo local: usar archivo de credenciales
          try {
            const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            studentApp = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: 'superate-6c730',
            }, 'superate-6c730');
            spLog('✅ Base de datos de estudiantes (superate-6c730) inicializada con credenciales locales');
          } catch (error: any) {
            spWarn('⚠️ Error cargando credenciales locales, intentando con credenciales por defecto:', error.message);
            // Fallback: usar credenciales por defecto
            studentApp = admin.initializeApp({
              projectId: 'superate-6c730',
            }, 'superate-6c730');
          }
        } else {
          // Producción (Cloud Functions): usar credenciales por defecto
          // Esto funcionará si las credenciales de superate-ia tienen acceso a superate-6c730
          // O si ambos proyectos están en la misma organización de GCP
          spLog('📝 Usando credenciales por defecto para acceder a superate-6c730');
          studentApp = admin.initializeApp({
            projectId: 'superate-6c730',
          }, 'superate-6c730');
        }
      }
      
      this.studentDbCache = studentApp.firestore();
      return this.studentDbCache;
    } catch (error: any) {
      spErr('❌ Error obteniendo base de datos de estudiantes:', error);
      throw new Error(`No se pudo acceder a la base de datos superate-6c730: ${error.message}`);
    }
  }

  /**
   * Normaliza el nombre de una materia para comparación
   */
  private normalizeSubjectName(subject: string): string {
    return subject.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Indica si la materia es Inglés (acepta "Inglés", "ingles", "Ingles", "english").
   */
  private isEnglishSubject(subject: string): boolean {
    const n = this.normalizeSubjectName(subject);
    return n === 'inglés' || n === 'ingles' || n === 'english';
  }

  /**
   * Obtiene los resultados del estudiante para una fase y materia específica
   */
  private async getStudentResults(
    studentId: string,
    phase: 'first' | 'second' | 'third',
    subject: string
  ): Promise<any[]> {
    try {
      spLog(`\n🔍 Buscando resultados para:`);
      spLog(`   Estudiante: ${studentId}`);
      spLog(`   Fase: ${phase}`);
      spLog(`   Materia: ${subject}`);

      const canonicalPhase = getCanonicalResultsPhaseSubcollection(phase);
      const phaseNamesToTry = [
        canonicalPhase,
        ...getLegacyResultsPhaseAlternates(phase),
      ];

      // Obtener la base de datos correcta (superate-6c730)
      spLog(`\n📊 Obteniendo acceso a base de datos superate-6c730...`);
      const studentDb = this.getStudentDatabase();
      spLog(`   ✅ Base de datos obtenida`);

      // Normalizar el nombre de la materia para comparación
      const normalizedSubject = this.normalizeSubjectName(subject);
      spLog(`   Materia normalizada: "${normalizedSubject}"`);

      const results: any[] = [];
      let totalDocsFound = 0;
      let docsChecked = 0;

      // Un solo intento con lectura típica: canónico (getPhaseName en cliente). Si la subcolección está vacía, probar legacy.
      for (const phaseName of phaseNamesToTry) {
        try {
          spLog(`\n   🔎 Buscando en subcolección: "results/${studentId}/${phaseName}"`);
          const phaseRef = studentDb.collection('results').doc(studentId).collection(phaseName);
          const phaseSnap = await phaseRef.get();

          if (phaseSnap.empty) {
            spLog(`      📄 Sin documentos en "${phaseName}", siguiente variante`);
            continue;
          }

          totalDocsFound += phaseSnap.size;
          spLog(`      📄 Documentos encontrados en "${phaseName}": ${phaseSnap.size}`);

          phaseSnap.docs.forEach((doc) => {
            docsChecked++;
            const data = doc.data();
            const examSubject = data.subject || '';
            const normalizedExamSubject = this.normalizeSubjectName(examSubject);

            spLog(`      📋 Examen ${doc.id}:`);
            spLog(`         - Materia en documento: "${examSubject}" (normalizada: "${normalizedExamSubject}")`);
            spLog(`         - Coincide: ${normalizedExamSubject === normalizedSubject ? '✅ SÍ' : '❌ NO'}`);

            if (normalizedExamSubject === normalizedSubject) {
              results.push({
                ...data,
                examId: doc.id,
              });
              spLog(`         ✅ Agregado a resultados`);
            }
          });

          // Solo una carpeta de fase por estudiante (evita duplicar si hubiera dos variantes pobladas).
          break;
        } catch (error: any) {
          spWarn(`      ⚠️ Error accediendo a "${phaseName}": ${error.message}`);
        }
      }

      spLog(`\n📊 RESUMEN DE BÚSQUEDA:`);
      spLog(`   Total de documentos encontrados: ${totalDocsFound}`);
      spLog(`   Documentos revisados: ${docsChecked}`);
      spLog(`   Resultados que coinciden con "${subject}": ${results.length}`);

      if (results.length === 0 && totalDocsFound > 0) {
        spWarn(`\n⚠️ ADVERTENCIA: Se encontraron ${totalDocsFound} documento(s) pero ninguno coincide con la materia "${subject}"`);
        spWarn(`   Esto puede deberse a:`);
        spWarn(`   - Diferencia en el nombre de la materia (mayúsculas/minúsculas, espacios)`);
        spWarn(`   - El campo "subject" no está presente en los documentos`);
      }

      return results;
    } catch (error: any) {
      spErr(`\n❌ Error obteniendo resultados para ${studentId} en ${phase}/${subject}:`, error);
      spErr(`   Stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Calcula las debilidades del estudiante basado en los resultados
   */
  private calculateWeaknesses(results: any[]): StudentWeakness[] {
    if (results.length === 0) {
      return [];
    }

    // Agrupar preguntas por tema
    const topicMap: Record<string, {
      correct: number;
      total: number;
      questions: Array<{
        questionId: string | number;
        questionText: string;
        topic: string;
        isCorrect: boolean;
      }>;
    }> = {};

    results.forEach(exam => {
      const questionDetails = exam.questionDetails || [];
      questionDetails.forEach((q: any) => {
        const topic = q.topic || 'Sin tema';
        if (!topicMap[topic]) {
          topicMap[topic] = {
            correct: 0,
            total: 0,
            questions: [],
          };
        }
        
        topicMap[topic].total++;
        if (q.isCorrect) {
          topicMap[topic].correct++;
        }
        
        topicMap[topic].questions.push({
          questionId: q.questionId || '',
          questionText: q.questionText || '',
          topic: q.topic || topic,
          isCorrect: q.isCorrect || false,
        });
      });
    });

    // Convertir a array de debilidades (temas con < 60%)
    const weaknesses: StudentWeakness[] = Object.entries(topicMap)
      .map(([topic, stats]) => {
        const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        return {
          topic,
          percentage: Math.round(percentage),
          correct: stats.correct,
          total: stats.total,
          questions: stats.questions,
        };
      })
      .filter(w => w.percentage < 60) // Solo debilidades (< 60%)
      .sort((a, b) => a.percentage - b.percentage); // Ordenar por menor porcentaje primero

    return weaknesses;
  }

  /**
   * Helper para verificar y loggear el estado de practice_exercises después del parsing
   */
  private logPracticeExercisesStatus(parsed: any, context: string): void {
    if (!parsed.practice_exercises) {
      spErr(`❌ [${context}] parsed.practice_exercises es ${typeof parsed.practice_exercises}`);
      spErr(`   Keys disponibles en parsed: ${Object.keys(parsed).join(', ')}`);
      // Buscar variantes del nombre
      const possibleKeys = Object.keys(parsed).filter(k => 
        k.toLowerCase().includes('practice') || 
        k.toLowerCase().includes('exercise') ||
        k.toLowerCase().includes('ejercicio')
      );
      if (possibleKeys.length > 0) {
        spWarn(`   ⚠️ Se encontraron posibles claves relacionadas: ${possibleKeys.join(', ')}`);
      }
    } else if (!Array.isArray(parsed.practice_exercises)) {
      spErr(`❌ [${context}] parsed.practice_exercises existe pero NO es un array, es: ${typeof parsed.practice_exercises}`);
      spErr(`   Valor: ${JSON.stringify(parsed.practice_exercises).substring(0, 200)}`);
    } else {
      spLog(`✅ [${context}] parsed.practice_exercises existe y es un array con ${parsed.practice_exercises.length} elemento(s)`);
      if (parsed.practice_exercises.length > 0) {
        spLog(`   Primer ejercicio (muestra): ${JSON.stringify(parsed.practice_exercises[0]).substring(0, 150)}...`);
      }
    }
  }

  private extractJsonObjectFromModelText(raw: string): string {
    const t = raw
      .replace(/```json\n?([\s\S]*?)\n?```/gi, '$1')
      .replace(/```\n?([\s\S]*?)\n?```/g, '$1')
      .trim();
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first === -1 || last < first) {
      throw new Error('No se encontró un objeto JSON en la respuesta del modelo');
    }
    return t.slice(first, last + 1);
  }

  private parseModelJsonToStudyPlan(raw: string): StudyPlanResponse {
    const jsonString = this.extractJsonObjectFromModelText(raw);
    try {
      return JSON.parse(jsonString) as StudyPlanResponse;
    } catch {
      const repaired = jsonrepair(jsonString);
      return JSON.parse(repaired) as StudyPlanResponse;
    }
  }

  /**
   * Construye el prompt maestro para generar el plan de estudio
   */
  private buildStudyPlanPrompt(
    phase: string,
    subject: string,
    weaknesses: StudentWeakness[],
    examResults: any[]
  ): string {
    // Construir descripción de los temas abordados
    const allTopics = new Set<string>();
    examResults.forEach(exam => {
      const questionDetails = exam.questionDetails || [];
      questionDetails.forEach((q: any) => {
        if (q.topic) {
          allTopics.add(q.topic);
        }
      });
    });

    const topicsList = Array.from(allTopics).join(', ');

    // Construir descripción detallada de debilidades
    const weaknessesDescription = weaknesses.map(w => {
      const sampleQuestions = w.questions.slice(0, 3).map(q => 
        `- ${q.questionText.substring(0, 100)}${q.questionText.length > 100 ? '...' : ''}`
      ).join('\n');
      
      return `**${w.topic}**: ${w.percentage}% de aciertos (${w.correct}/${w.total} correctas)
Preguntas de ejemplo:
${sampleQuestions}`;
    }).join('\n\n');

    // Construir instrucción de keywords según la materia
    const keywordsInstruction = this.isEnglishSubject(subject)
      ? '- ✅ **Para Inglés: Incluye keywords los videos serán en español explicando temas de inglés'
      : '- ✅ Incluye keywords en español (los videos se buscarán en español)';
    
    // Instrucción para inglés: priorizar keywords que encuentren videos útiles de CUALQUIER canal
    const englishChannelsSection = this.isEnglishSubject(subject) ? `
**KEYWORDS PARA INGLÉS (videos en español que explican inglés):**
- Incluye términos que encuentren contenido útil de **cualquier canal** (no solo canales específicos): el tema + "aprender inglés", "inglés explicado en español", "gramática inglés", "comprensión lectora inglés", "ICFES inglés", "clase inglés bachillerato".
- Puedes mencionar canales conocidos como referencia opcional, pero **prioriza palabras clave genéricas** para que YouTube devuelva videos útiles de diversos canales educativos.` : '';

    return `Eres un experto en educación secundaria y preparación ICFES Saber 11. Diseñas planes de estudio personalizados basados en el desempeño real del estudiante.

--- Contexto académico (sin datos personales identificables) ---

**Fase:** ${phase} | **Materia:** ${subject}

**Temas del cuestionario:** ${topicsList || 'No especificados'}

**Debilidades (menos del 60% de aciertos):**
${weaknesses.length > 0 ? weaknessesDescription : 'No se identificaron debilidades.'}

Genera un plan enfocado solo en esas debilidades, alineado con ICFES Saber 11 y accionable.

--- Formato de respuesta ---

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después. Estructura:

{
  "student_info": {
    "studentId": "",
    "phase": "${phase}",
    "subject": "${subject}",
    "weaknesses": [
      {
        "topic": "Nombre del tema",
        "percentage": 45,
        "correct": 2,
        "total": 5
      }
    ]
  },
  "diagnostic_summary": "Resumen de máximo 50 palabras sobre la materia y los temas a mejorar en esta ruta de estudio (debes mencionar las debilidades principales identificadas)",
  "study_plan_summary": "Resumen más detallado del plan de estudio (100-150 palabras) (debes explicar la estrategia de mejora y los recursos incluidos (videos, ejercicios))",
  "practice_exercises": [
    {
      "question": "Texto completo de la pregunta estilo ICFES",
      "options": ["A) Opción A", "B) Opción B", "C) Opción C", "D) Opción D"],
      "correctAnswer": "A",
      "explanation": "Explicación detallada de por qué esta es la respuesta correcta (debes explicar el proceso de resolución de la pregunta)",
      "topic": "Tema relacionado con la debilidad (debes que debe ser exactamente el mismo tema que la debilidad identificada)"
    }
  ],
  "topics": [
    {
      "name": "Nombre del tema a estudiar",
      "description": "Descripción detallada del tema y por qué es importante (debes explicar el tema y por qué es importante para el estudiante)",
      "level": "Básico|Intermedio|Avanzado",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

--- Especificaciones ---

**diagnostic_summary:** Máximo 50 palabras; menciona las debilidades principales.
**study_plan_summary:** 100-150 palabras; estrategia de mejora y recursos (videos, ejercicios).

**practice_exercises:** EXACTAMENTE ${StudyPlanService.TARGET_EXERCISE_COUNT} ejercicios. Genera este array ANTES que topics. Estilo ICFES (selección múltiple). Campos: question (texto con contexto si aplica), options (array de 4 strings con formato "A) Texto", "B) Texto", ...), correctAnswer (solo letra "A"|"B"|"C"|"D"), explanation (detallada), topic (coincide con debilidad). Enfocado en competencias, no memorización.

**topics:** Mínimo 3, idealmente 5-8. Cada uno relacionado con una debilidad.
Por topic: **name**, **description**, **level** (Básico|Intermedio|Avanzado), **keywords** (3-5 para videos; específicas, no genéricas). ${keywordsInstruction} ${englishChannelsSection}

--- Restricciones ---

Responde solo con JSON válido. No markdown ni texto extra. EXACTAMENTE ${StudyPlanService.TARGET_EXERCISE_COUNT} ejercicios. No incluir video_resources ni study_links (se generan después).
CRÍTICO para JSON válido: (1) No pongas comas finales antes de ] o }. (2) Dentro de cualquier string usa \\\" para comillas y \\n para saltos de línea. (3) Devuelve un único objeto; sin texto antes ni después.

--- Orden en el JSON ---

1. student_info 2. diagnostic_summary 3. study_plan_summary 4. practice_exercises (${StudyPlanService.TARGET_EXERCISE_COUNT} ejercicios; genera primero) 5. topics`;
  }

  /**
   * Genera el plan de estudio usando Gemini
   */
  async generateStudyPlan(
    input: StudyPlanInput
  ): Promise<StudyPlanGenerationResult> {
    const startTime = Date.now();
    
    try {
      if (!(await geminiClient.isAvailable())) {
        throw new Error('Servicio de Gemini no está disponible');
      }

      spLog(`\n📚 Generando plan de estudio para:`);
      spLog(`   Estudiante: ${input.studentId}`);
      spLog(`   Fase: ${input.phase}`);
      spLog(`   Materia: ${input.subject}`);

      // 1. Obtener resultados del estudiante
      spLog(`\n📊 Obteniendo resultados del estudiante...`);
      const examResults = await this.getStudentResults(
        input.studentId,
        input.phase,
        input.subject
      );

      if (examResults.length === 0) {
        throw new Error(`No se encontraron resultados para el estudiante ${input.studentId} en la fase ${input.phase} para la materia ${input.subject}`);
      }

      spLog(`   ✅ Encontrados ${examResults.length} examen(es) completado(s)`);

      // 2. Calcular debilidades
      spLog(`\n🔍 Calculando debilidades...`);
      const weaknesses = this.calculateWeaknesses(examResults);
      
      if (weaknesses.length === 0) {
        throw new Error('No se identificaron debilidades. El estudiante tiene un buen desempeño en todos los temas.');
      }

      spLog(`   ✅ Identificadas ${weaknesses.length} debilidad(es):`);
      weaknesses.forEach(w => {
        spLog(`      - ${w.topic}: ${w.percentage}% (${w.correct}/${w.total})`);
      });

      // 3. Construir prompt
      spLog(`\n📝 Construyendo prompt para Gemini...`);
      const prompt = this.buildStudyPlanPrompt(
        input.phase,
        input.subject,
        weaknesses,
        examResults
      );

      // 4. Generar contenido con Gemini (modo JSON + timeout alineado con Cloud Functions)
      spLog(`\n🤖 Enviando request a Gemini (application/json)...`);
      const result = await geminiCentralizedService.generateContent({
        userId: input.studentId,
        prompt,
        processName: 'study_plan',
        images: [],
        options: {
          retries: 3,
          timeout: GEMINI_CONFIG.GENERATION_SUMMARY_AND_PLAN_TIMEOUT_MS,
          responseMimeType: 'application/json',
        },
      });

      spLog(`study_plan: respuesta ${result.text.length} caracteres`);

      let parsed: StudyPlanResponse;
      try {
        parsed = this.parseModelJsonToStudyPlan(result.text);
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        spErr('study_plan: error parseando JSON:', msg);
        throw parseErr instanceof Error
          ? parseErr
          : new Error('Error parseando plan de estudio: ' + msg);
      }

      // student_info canónico (UID y debilidades reales no se envían al modelo; se aplican aquí)
      parsed.student_info = {
        studentId: input.studentId,
        phase: input.phase,
        subject: input.subject,
        weaknesses,
      };

      this.logPracticeExercisesStatus(parsed, 'plan parseado');

      // 5. Validar estructura mínima
      if (!parsed.diagnostic_summary || !parsed.study_plan_summary) {
        throw new Error('La respuesta de Gemini no tiene la estructura esperada');
      }

      if (!parsed.practice_exercises || !Array.isArray(parsed.practice_exercises)) {
        parsed.practice_exercises = [];
      }

      if (parsed.practice_exercises.length === 0) {
        spErr('study_plan: practice_exercises vacío (tokens/modelo)');
        spErr('   muestra (400 chars):', result.text.substring(0, 400));
      } else if (
        parsed.practice_exercises.length !== StudyPlanService.TARGET_EXERCISE_COUNT
      ) {
        spWarn(
          `study_plan: se esperaban ${StudyPlanService.TARGET_EXERCISE_COUNT} ejercicios, hay ${parsed.practice_exercises.length}`
        );
      }

      // Validar y normalizar estructura de cada ejercicio
      const invalidExercises: number[] = [];
      parsed.practice_exercises.forEach((exercise, idx) => {
        const validationErrors: string[] = [];
        
        // Validar campos requeridos
        if (!exercise.question) validationErrors.push('falta question');
        if (!exercise.options || !Array.isArray(exercise.options)) {
          validationErrors.push('options no es un array');
        } else if (exercise.options.length !== 4) {
          validationErrors.push(`options tiene ${exercise.options.length} elementos (debe tener 4)`);
        }
        if (!exercise.correctAnswer) validationErrors.push('falta correctAnswer');
        if (!exercise.explanation) validationErrors.push('falta explanation');
        if (!exercise.topic) validationErrors.push('falta topic');
        
        // Validar formato de opciones
        if (exercise.options && Array.isArray(exercise.options)) {
          const expectedLetters = ['A', 'B', 'C', 'D'];
          exercise.options.forEach((option, optIdx) => {
            if (typeof option !== 'string') {
              validationErrors.push(`option ${optIdx + 1} no es un string`);
            } else {
              // Normalizar: asegurar que cada opción empiece con su letra y ") "
              const expectedPrefix = `${expectedLetters[optIdx]}) `;
              if (!option.trim().toUpperCase().startsWith(expectedPrefix.toUpperCase())) {
                // Intentar normalizar: agregar el prefijo si falta
                if (!option.trim().toUpperCase().match(/^[A-D]\)\s/)) {
                  spWarn(`   🔧 Normalizando opción ${optIdx + 1} del ejercicio ${idx + 1}: agregando prefijo "${expectedPrefix}"`);
                  parsed.practice_exercises[idx].options[optIdx] = `${expectedPrefix}${option.trim()}`;
                }
              }
            }
          });
        }
        
        // Validar formato de correctAnswer
        if (exercise.correctAnswer) {
          const normalizedAnswer = exercise.correctAnswer.trim().toUpperCase().charAt(0);
          if (!['A', 'B', 'C', 'D'].includes(normalizedAnswer)) {
            validationErrors.push(`correctAnswer "${exercise.correctAnswer}" no es válido (debe ser A, B, C o D)`);
          } else if (exercise.correctAnswer !== normalizedAnswer) {
            // Normalizar correctAnswer si tiene formato incorrecto
            spWarn(`   🔧 Normalizando correctAnswer del ejercicio ${idx + 1}: "${exercise.correctAnswer}" -> "${normalizedAnswer}"`);
            parsed.practice_exercises[idx].correctAnswer = normalizedAnswer;
          }
        }
        
        if (validationErrors.length > 0) {
          invalidExercises.push(idx);
          spWarn(`⚠️ Ejercicio ${idx + 1} tiene problemas: ${validationErrors.join(', ')}`);
        }
      });

      if (invalidExercises.length > 0) {
        spWarn(`⚠️ ${invalidExercises.length} ejercicio(s) tienen estructura inválida (índices: ${invalidExercises.join(', ')})`);
        // Filtrar ejercicios inválidos para evitar errores en el frontend
        parsed.practice_exercises = parsed.practice_exercises.filter((_, idx) => !invalidExercises.includes(idx));
        spLog(`   Se guardarán ${parsed.practice_exercises.length} ejercicio(s) válido(s)`);
      }

      const grade = this.normalizeGradeForPath(input.grade);
      (parsed.student_info as { grade?: string }).grade = grade;
      spLog(`   📋 Grado (student_info): ${grade}`);

      // Todos los temas de la materia (videos y enlaces; no solo debilidades).
      const subjectConfigForResources = getSubjectConfig(input.subject);
      const allTopicNamesForSubjectGen =
        subjectConfigForResources?.topics.map((t) => t.name) ?? [];

      const [videoResources, studyLinks] = await Promise.all([
        this.buildVideoResourcesFromYoutubeConsolidado(
          input.subject,
          allTopicNamesForSubjectGen,
          subjectConfigForResources
        ),
        this.buildStudyLinksFromWebLinksConsolidated(
          input.subject,
          allTopicNamesForSubjectGen,
          subjectConfigForResources
        ),
      ]);
      parsed.video_resources = videoResources;
      parsed.study_links = studyLinks;
      if (parsed.video_resources.length === 0) {
        spWarn(
          `⚠️ Sin videos en YoutubeLinks/consolidado para esta materia; el plan sigue sin video_resources.`
        );
      }

      // 7. Guardar en Firestore (practice_exercises solo en AnswerIA; sin EjerciciosIA)
      spLog(`\n💾 Guardando plan de estudio en Firestore...`);
      spLog(`   📊 Resumen antes de guardar:`);
      spLog(`      - Topics: ${parsed.topics?.length || 0}`);
      spLog(`      - Videos: ${parsed.video_resources?.length || 0}`);
      spLog(`      - Enlaces: ${parsed.study_links?.length || 0}`);
      spLog(`      - Ejercicios de práctica: ${parsed.practice_exercises?.length || 0}`);
      
      // Validación: el plan debe estar completo antes de guardar y retornar
      if (!parsed.topics || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
        throw new Error('El plan debe tener al menos un topic');
      }

      // Verificar que el plan tenga todos los recursos necesarios
      const hasExercises = parsed.practice_exercises && Array.isArray(parsed.practice_exercises) && parsed.practice_exercises.length > 0;
      const hasLinks = parsed.study_links && Array.isArray(parsed.study_links) && parsed.study_links.length > 0;

      if (!hasExercises) {
        throw new Error('El plan debe tener al menos un ejercicio de práctica');
      }

      // Enlaces web: si no hay ninguno, se permite el plan pero se registra advertencia (los links solo vienen de WebLinks/caché)
      if (!hasLinks) {
        spWarn('⚠️ El plan se generó sin enlaces web. Agrega enlaces en WebLinks (admin) para la materia y temas del plan.');
        parsed.study_links = parsed.study_links || [];
      }

      // Verificar que los videos tengan campos válidos
      const invalidVideos = parsed.video_resources.filter(v => !v.title || !v.url);
      if (invalidVideos.length > 0) {
        throw new Error(`${invalidVideos.length} video(s) sin título o URL válida`);
      }

      // Filtrar enlaces sin título o URL válida (evitar fallar todo el plan por datos incompletos de caché o API)
      if (parsed.study_links.length > 0) {
        const validLinks = parsed.study_links
          .filter(
            (l) => (l.title && l.url) || (l.title && (l as any).link)
          )
          .map((l) => ({
            title: l.title || 'Enlace',
            url: l.url || (l as any).link || '',
            description: l.description || '',
            topic: l.topic,
          }))
          .filter((l) => l.url && l.url.startsWith('http'));
        const removed = parsed.study_links.length - validLinks.length;
        if (removed > 0) {
          spWarn(`⚠️ Se omitieron ${removed} enlace(s) sin título o URL válida. Se conservan ${validLinks.length} enlace(s) válido(s).`);
        }
        parsed.study_links = validLinks;
      }

      const stillBad = parsed.practice_exercises.filter(
        (e) =>
          !e.question ||
          !e.options ||
          e.options.length !== 4 ||
          !e.correctAnswer
      );
      if (stillBad.length > 0) {
        throw new Error(`${stillBad.length} ejercicio(s) incompleto(s) tras validación`);
      }

      await this.saveStudyPlan(input, parsed);

      const processingTime = Date.now() - startTime;
      spLog(`\n✅ Plan de estudio generado y guardado exitosamente en ${(processingTime / 1000).toFixed(1)}s`);
      spLog(`   ✅ Videos: ${parsed.video_resources.length}`);
      spLog(`   ✅ Enlaces (desde WebLinks): ${parsed.study_links.length}`);
      spLog(`   ✅ Ejercicios: ${parsed.practice_exercises.length}`);

      return {
        success: true,
        studyPlan: parsed, // Retornar el plan generado directamente
        processingTimeMs: processingTime,
      };
    } catch (error: any) {
      spErr(`❌ Error generando plan de estudio:`, error);
      
      return {
        success: false,
        error: error.message || 'Error desconocido',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Guarda el plan de estudio en Firestore
   * Estructura: AnswerIA/{studentId}/{phaseName}/{subject}
   * Se guarda en superate-6c730 donde están los datos de los estudiantes
   */
  private async saveStudyPlan(
    input: StudyPlanInput,
    studyPlan: StudyPlanResponse
  ): Promise<void> {
    try {
      const phaseName = getCanonicalAnswerIAPhaseSubcollection(input.phase);

      const studentDb = this.getStudentDatabase();
      
      // Estructura: AnswerIA/{studentId}/{phaseName}/{subject}
      const docRef = studentDb
        .collection('AnswerIA')
        .doc(input.studentId)
        .collection(phaseName)
        .doc(input.subject);
      
      // Preparar datos para guardar.
      // study_links y video_resources no se persisten: fuentes de verdad son WebLinks y YoutubeLinks.
      const dataToSave = {
        ...studyPlan,
        study_links: [] as StudyPlanResponse['study_links'],
        video_resources: [] as StudyPlanResponse['video_resources'],
        generatedAt: new Date(),
        generatedBy: GEMINI_CONFIG.MODEL_NAME,
        version: '1.0',
      };

      // Validar que practice_exercises existe antes de guardar
      if (!dataToSave.practice_exercises || !Array.isArray(dataToSave.practice_exercises)) {
        spWarn(`   ⚠️ practice_exercises no existe o no es un array antes de guardar, inicializando como array vacío`);
        dataToSave.practice_exercises = [];
      }

      spLog(`   📝 Antes de guardar: ${dataToSave.practice_exercises?.length ?? 0} ejercicio(s)`);

      await docRef.set(dataToSave, { merge: true });

      spLog(`   ✅ Plan guardado: AnswerIA/${input.studentId}/${phaseName}/${input.subject}`);
    } catch (error: any) {
      spErr('❌ Error guardando plan de estudio:', error);
      throw error;
    }
  }

  /**
   * Obtiene un plan de estudio existente
   * Estructura: AnswerIA/{studentId}/{phaseName}/{subject}
   * Se busca en superate-6c730 donde están los datos de los estudiantes
   */
  async getStudyPlan(
    studentId: string,
    phase: 'first' | 'second' | 'third',
    subject: string
  ): Promise<StudyPlanResponse | null> {
    try {
      const phaseNamesToTry = [
        getCanonicalAnswerIAPhaseSubcollection(phase),
        ...getLegacyAnswerIAPhaseAlternates(phase),
      ];

      const studentDb = this.getStudentDatabase();

      for (const phaseName of phaseNamesToTry) {
        try {
          const docRef = studentDb
            .collection('AnswerIA')
            .doc(studentId)
            .collection(phaseName)
            .doc(subject);

          const docSnap = await docRef.get();

          if (!docSnap.exists) {
            continue;
          }

          const data = docSnap.data() as StudyPlanResponse;

          if (!data.practice_exercises || !Array.isArray(data.practice_exercises)) {
            spWarn(`⚠️ Plan de estudio recuperado pero practice_exercises no existe o no es un array`);
            spWarn(`   Estudiante: ${studentId}, Fase: ${phaseName}, Materia: ${subject}`);
            data.practice_exercises = [];
          } else {
            spLog(`✅ Plan recuperado con ${data.practice_exercises.length} ejercicio(s) de práctica`);
          }

          const subjectCfg = getSubjectConfig(subject);
          const allTopicNamesForSubject =
            subjectCfg?.topics.map((t) => t.name) ?? [];
          const [links, videos] = await Promise.all([
            this.buildStudyLinksFromWebLinksConsolidated(
              subject,
              allTopicNamesForSubject,
              subjectCfg
            ),
            this.buildVideoResourcesFromYoutubeConsolidado(
              subject,
              allTopicNamesForSubject,
              subjectCfg
            ),
          ]);
          data.study_links = links;
          data.video_resources = videos;

          return data;
        } catch (error: any) {
          spWarn(`   ⚠️ Error buscando en ${phaseName}:`, error.message);
        }
      }

      return null;
    } catch (error: any) {
      spErr('Error obteniendo plan de estudio:', error);
      return null;
    }
  }

  /**
   * Nombre de la colección Firestore para recursos web y videos (solo documentos consolidado_{materiaCode}).
   */
  private static readonly WEBLINKS_COLLECTION = 'WebLinks';
  private static readonly YOUTUBE_LINKS_COLLECTION = 'YoutubeLinks';

  /**
   * Videos desde YoutubeLinks/consolidado_{materiaCode} únicamente (1 lectura Firestore por materia por invocación, con caché en memoria).
   */
  private getOrLoadYoutubeLinksConsolidated(
    materiaCode: string
  ): Promise<
    Array<{
      title: string;
      url: string;
      description: string;
      channelTitle: string;
      videoId?: string;
      duration?: string;
      language?: string;
      topic?: string;
    }>
  > {
    let p = this.youtubeLinksConsolidatedPromises.get(materiaCode);
    if (!p) {
      p = this.fetchYoutubeLinksConsolidatedItems(materiaCode);
      this.youtubeLinksConsolidatedPromises.set(materiaCode, p);
    }
    return p;
  }

  private async fetchYoutubeLinksConsolidatedItems(
    materiaCode: string
  ): Promise<
    Array<{
      title: string;
      url: string;
      description: string;
      channelTitle: string;
      videoId?: string;
      duration?: string;
      language?: string;
      topic?: string;
    }>
  > {
    const studentDb = this.getStudentDatabase();
    const parseVideoRow = (data: admin.firestore.DocumentData) => ({
      title: data.título || data.title || '',
      url:
        data.url ||
        (data.videoId ? `https://www.youtube.com/watch?v=${data.videoId}` : ''),
      description: data.description || '',
      channelTitle: data.canal || data.channelTitle || '',
      videoId: data.videoId || '',
      duration: data.duración || data.duration || '',
      language: data.idioma || data.language || 'es',
      topic: typeof data.topic === 'string' ? data.topic : '',
    });
    const docId = `consolidado_${materiaCode}`;
    const snap = await studentDb
      .collection(StudyPlanService.YOUTUBE_LINKS_COLLECTION)
      .doc(docId)
      .get();
    if (!snap.exists) {
      spWarn(`   ⚠️ YoutubeLinks: no existe ${docId}`);
      return [];
    }
    const raw = snap.data() as { items?: admin.firestore.DocumentData[] } | undefined;
    const orderOrTime = (data: admin.firestore.DocumentData): number => {
      if (typeof data.order === 'number') return data.order;
      const t = data.savedAt?.toMillis?.() ?? data.createdAt?.toMillis?.();
      return t ?? 0;
    };
    const allVideosForSubject = (Array.isArray(raw?.items) ? raw.items : [])
      .filter((x) => x?.url || x?.videoId)
      .sort((a, b) => orderOrTime(a) - orderOrTime(b))
      .map((x) => parseVideoRow(x));
    spLog(
      `   📦 YoutubeLinks ${docId}: ${allVideosForSubject.length} video(s) (1 lectura)`
    );
    return allVideosForSubject;
  }

  /**
   * Una lectura a YoutubeLinks/consolidado_{materiaCode}; reparte videos por tema en memoria (hasta VIDEOS_PER_TOPIC por tema).
   */
  private async buildVideoResourcesFromYoutubeConsolidado(
    subject: string,
    topicDisplayNames: string[],
    cachedSubjectConfig?: SubjectWithTopics
  ): Promise<StudyPlanResponse['video_resources']> {
    const subjectConfig = cachedSubjectConfig ?? getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    if (!materiaCode || topicDisplayNames.length === 0) {
      return [];
    }
    const allVideosForSubject = await this.getOrLoadYoutubeLinksConsolidated(materiaCode);
    const out: StudyPlanResponse['video_resources'] = [];
    const uniqueTopics = [...new Set(topicDisplayNames)];
    for (const topicName of uniqueTopics) {
      const topicCode = getTopicCode(subject, topicName);
      if (!topicCode) {
        spWarn(
          `   ⚠️ YoutubeLinks: sin topicCode materia="${subject}" tema="${topicName}"`
        );
        continue;
      }
      const slice = allVideosForSubject
        .filter(
          (v) =>
            typeof v.topic === 'string' &&
            v.topic.trim().toUpperCase() === topicCode.trim().toUpperCase()
        )
        .slice(0, VIDEOS_PER_TOPIC)
        .map((v) => ({
          title: v.title,
          url: v.url,
          description: v.description,
          channelTitle: v.channelTitle,
          videoId: v.videoId,
          duration: v.duration,
          language: v.language,
          topic: topicName,
          topicDisplayName: topicName,
        }));
      out.push(...slice);
    }
    spLog(
      `   ✅ video_resources: consolidado_${materiaCode} (1 lectura) → ${out.length} video(s) en ${uniqueTopics.length} tema(s)`
    );
    return out;
  }

  /**
   * Enlaces web por tema: solo WebLinks/consolidado_{materiaCode} (filtrado por topicCode en items).
   */
  private async getLinksForTopic(
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>> {
    try {
      spLog(`   📋 Obteniendo enlaces web para topic: "${topic}" (desde caché)`);
      const cachedLinks = await this.getCachedLinks(subject, topic);
      spLog(`   📦 Enlaces en caché para "${topic}": ${cachedLinks.length}`);
      return cachedLinks.map((link) => ({ ...link, topic }));
    } catch (error: any) {
      spErr(`❌ Error obteniendo enlaces para topic "${topic}":`, error.message);
      return [];
    }
  }

  /**
   * Obtiene enlaces web para un tema desde WebLinks (solo caché).
   * @param grade Grado (ej. "Décimo"). Opcional; si no se pasa se usa default.
   */
  async generateWebLinksForTopic(
    _phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    _grade?: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    return this.getLinksForTopic(subject, topic);
  }

  private getOrLoadWebLinksConsolidated(
    materiaCode: string
  ): Promise<Array<{ title: string; url: string; description: string; topic?: string }>> {
    let p = this.webLinksConsolidatedPromises.get(materiaCode);
    if (!p) {
      p = this.fetchWebLinksConsolidatedItems(materiaCode);
      this.webLinksConsolidatedPromises.set(materiaCode, p);
    }
    return p;
  }

  /**
   * WebLinks/consolidado_{materiaCode} únicamente (1 lectura Firestore por materia, con caché en memoria).
   */
  private async fetchWebLinksConsolidatedItems(
    materiaCode: string
  ): Promise<Array<{ title: string; url: string; description: string; topic?: string }>> {
    const studentDb = this.getStudentDatabase();
    const parseLinkDoc = (data: admin.firestore.DocumentData) => ({
      title: data.title || data.name || 'Enlace',
      url: data.url || data.link || '',
      description: data.description || '',
      topic: typeof data.topic === 'string' ? data.topic : '',
    });
    const docId = `consolidado_${materiaCode}`;
    const snap = await studentDb.collection(StudyPlanService.WEBLINKS_COLLECTION).doc(docId).get();
    if (!snap.exists) {
      spWarn(`   ⚠️ WebLinks: no existe ${docId}`);
      return [];
    }
    const raw = snap.data() as { items?: admin.firestore.DocumentData[] } | undefined;
    const orderOrTime = (data: admin.firestore.DocumentData): number => {
      if (typeof data.order === 'number') return data.order;
      const t = data.savedAt?.toMillis?.() ?? data.createdAt?.toMillis?.();
      return t ?? 0;
    };
    const allLinksForSubject = (Array.isArray(raw?.items) ? raw.items : [])
      .filter((x) => x?.url || x?.link)
      .sort((a, b) => orderOrTime(a) - orderOrTime(b))
      .map((x) => parseLinkDoc(x));
    spLog(`   📦 WebLinks ${docId}: ${allLinksForSubject.length} enlace(s) (1 lectura)`);
    return allLinksForSubject;
  }

  /**
   * Una lectura a WebLinks/consolidado_{materiaCode}; filtra enlaces por cada tema en memoria.
   */
  private async buildStudyLinksFromWebLinksConsolidated(
    subject: string,
    topicIds: string[],
    cachedSubjectConfig?: SubjectWithTopics
  ): Promise<Array<{ title: string; url: string; description: string; topic?: string }>> {
    if (topicIds.length === 0) return [];
    const subjectConfig = cachedSubjectConfig ?? getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    if (!materiaCode) {
      spWarn(`   ⚠️ WebLinks: sin código de materia para "${subject}"`);
      return [];
    }
    const allLinksForSubject = await this.getOrLoadWebLinksConsolidated(materiaCode);
    const uniqueTopics = [...new Set(topicIds)];
    const total: Array<{ title: string; url: string; description: string; topic?: string }> = [];
    for (const topicId of uniqueTopics) {
      const topicCode = getTopicCode(subject, topicId);
      if (!topicCode) {
        spWarn(`   ⚠️ WebLinks: sin topicCode materia="${subject}" tema="${topicId}"`);
        continue;
      }
      const links = allLinksForSubject
        .filter(
          (l) =>
            typeof l.topic === 'string' &&
            l.topic.trim().toUpperCase() === topicCode.trim().toUpperCase()
        )
        .map((l) => ({ ...l, topic: topicId }));
      total.push(...links);
    }
    spLog(
      `   ✅ study_links: consolidado_${materiaCode} (1 lectura) → ${total.length} enlace(s) en ${uniqueTopics.length} tema(s)`
    );
    return total;
  }

  /**
   * Un tema: misma única lectura consolidado que el plan completo (caché en memoria por materia).
   */
  private async getCachedLinks(
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>> {
    try {
      return await this.buildStudyLinksFromWebLinksConsolidated(subject, [topic]);
    } catch (error: any) {
      spErr(`❌ Error obteniendo enlaces desde consolidado:`, error.message);
      return [];
    }
  }

  /**
   * Normaliza el grado del estudiante ("6".."11") para student_info y APIs; WebLinks/YoutubeLinks no usan grado en la ruta.
   */
  private normalizeGradeForPath(grade: string | undefined): string {
    if (!grade || typeof grade !== 'string') return '11';
    const g = grade.trim().toLowerCase();
    const map: Record<string, string> = {
      '6': '6', 'sexto': '6',
      '7': '7', 'septimo': '7', 'séptimo': '7',
      '8': '8', 'octavo': '8',
      '9': '9', 'noveno': '9',
      '0': '10', '10': '10', 'decimo': '10', 'décimo': '10',
      '1': '11', '11': '11', 'undecimo': '11', 'undécimo': '11',
    };
    if (map[g]) return map[g];
    if (/^[6-9]$|^1[01]$/.test(g)) return g;
    return '11';
  }

}

// Exportar instancia singleton
export const studyPlanService = new StudyPlanService();

export default studyPlanService;
