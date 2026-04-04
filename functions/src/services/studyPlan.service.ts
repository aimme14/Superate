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
  getGradeNameForAdminPath,
  getSubjectConfig,
  getTopicCode,
  mapToCanonicalTopic,
  MAX_EXERCISES_PER_TOPIC,
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

/**
 * Tipos para el plan de estudio
 */
export interface StudyPlanInput {
  studentId: string;
  phase: 'first' | 'second' | 'third';
  subject: string;
  /** Grado para escalar WebLinks por nivel (ej: "6", "10", "11", "Décimo", "Undécimo"). Opcional: default "11". */
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
    grade?: string; // Grado para WebLinks (ej: "6".."11")
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
  practice_exercises: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>;
  // Videos: fuente de verdad es YoutubeLinks; no se persisten en AnswerIA.
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

  /**
   * Obtiene una instancia de Firestore para el proyecto superate-6c730
   * donde están almacenados los resultados de los estudiantes
   */
  private getStudentDatabase(): admin.firestore.Firestore {
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
            console.log('✅ Base de datos de estudiantes (superate-6c730) inicializada con credenciales locales');
          } catch (error: any) {
            console.warn('⚠️ Error cargando credenciales locales, intentando con credenciales por defecto:', error.message);
            // Fallback: usar credenciales por defecto
            studentApp = admin.initializeApp({
              projectId: 'superate-6c730',
            }, 'superate-6c730');
          }
        } else {
          // Producción (Cloud Functions): usar credenciales por defecto
          // Esto funcionará si las credenciales de superate-ia tienen acceso a superate-6c730
          // O si ambos proyectos están en la misma organización de GCP
          console.log('📝 Usando credenciales por defecto para acceder a superate-6c730');
          studentApp = admin.initializeApp({
            projectId: 'superate-6c730',
          }, 'superate-6c730');
        }
      }
      
      // Obtener Firestore
      return studentApp.firestore();
    } catch (error: any) {
      console.error('❌ Error obteniendo base de datos de estudiantes:', error);
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
      console.log(`\n🔍 Buscando resultados para:`);
      console.log(`   Estudiante: ${studentId}`);
      console.log(`   Fase: ${phase}`);
      console.log(`   Materia: ${subject}`);

      const canonicalPhase = getCanonicalResultsPhaseSubcollection(phase);
      const phaseNamesToTry = [
        canonicalPhase,
        ...getLegacyResultsPhaseAlternates(phase),
      ];

      // Obtener la base de datos correcta (superate-6c730)
      console.log(`\n📊 Obteniendo acceso a base de datos superate-6c730...`);
      const studentDb = this.getStudentDatabase();
      console.log(`   ✅ Base de datos obtenida`);

      // Normalizar el nombre de la materia para comparación
      const normalizedSubject = this.normalizeSubjectName(subject);
      console.log(`   Materia normalizada: "${normalizedSubject}"`);

      const results: any[] = [];
      let totalDocsFound = 0;
      let docsChecked = 0;

      // Un solo intento con lectura típica: canónico (getPhaseName en cliente). Si la subcolección está vacía, probar legacy.
      for (const phaseName of phaseNamesToTry) {
        try {
          console.log(`\n   🔎 Buscando en subcolección: "results/${studentId}/${phaseName}"`);
          const phaseRef = studentDb.collection('results').doc(studentId).collection(phaseName);
          const phaseSnap = await phaseRef.get();

          if (phaseSnap.empty) {
            console.log(`      📄 Sin documentos en "${phaseName}", siguiente variante`);
            continue;
          }

          totalDocsFound += phaseSnap.size;
          console.log(`      📄 Documentos encontrados en "${phaseName}": ${phaseSnap.size}`);

          phaseSnap.docs.forEach((doc) => {
            docsChecked++;
            const data = doc.data();
            const examSubject = data.subject || '';
            const normalizedExamSubject = this.normalizeSubjectName(examSubject);

            console.log(`      📋 Examen ${doc.id}:`);
            console.log(`         - Materia en documento: "${examSubject}" (normalizada: "${normalizedExamSubject}")`);
            console.log(`         - Coincide: ${normalizedExamSubject === normalizedSubject ? '✅ SÍ' : '❌ NO'}`);

            if (normalizedExamSubject === normalizedSubject) {
              results.push({
                ...data,
                examId: doc.id,
              });
              console.log(`         ✅ Agregado a resultados`);
            }
          });

          // Solo una carpeta de fase por estudiante (evita duplicar si hubiera dos variantes pobladas).
          break;
        } catch (error: any) {
          console.warn(`      ⚠️ Error accediendo a "${phaseName}": ${error.message}`);
        }
      }

      console.log(`\n📊 RESUMEN DE BÚSQUEDA:`);
      console.log(`   Total de documentos encontrados: ${totalDocsFound}`);
      console.log(`   Documentos revisados: ${docsChecked}`);
      console.log(`   Resultados que coinciden con "${subject}": ${results.length}`);

      if (results.length === 0 && totalDocsFound > 0) {
        console.warn(`\n⚠️ ADVERTENCIA: Se encontraron ${totalDocsFound} documento(s) pero ninguno coincide con la materia "${subject}"`);
        console.warn(`   Esto puede deberse a:`);
        console.warn(`   - Diferencia en el nombre de la materia (mayúsculas/minúsculas, espacios)`);
        console.warn(`   - El campo "subject" no está presente en los documentos`);
      }

      return results;
    } catch (error: any) {
      console.error(`\n❌ Error obteniendo resultados para ${studentId} en ${phase}/${subject}:`, error);
      console.error(`   Stack:`, error.stack);
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
      console.error(`❌ [${context}] parsed.practice_exercises es ${typeof parsed.practice_exercises}`);
      console.error(`   Keys disponibles en parsed: ${Object.keys(parsed).join(', ')}`);
      // Buscar variantes del nombre
      const possibleKeys = Object.keys(parsed).filter(k => 
        k.toLowerCase().includes('practice') || 
        k.toLowerCase().includes('exercise') ||
        k.toLowerCase().includes('ejercicio')
      );
      if (possibleKeys.length > 0) {
        console.warn(`   ⚠️ Se encontraron posibles claves relacionadas: ${possibleKeys.join(', ')}`);
      }
    } else if (!Array.isArray(parsed.practice_exercises)) {
      console.error(`❌ [${context}] parsed.practice_exercises existe pero NO es un array, es: ${typeof parsed.practice_exercises}`);
      console.error(`   Valor: ${JSON.stringify(parsed.practice_exercises).substring(0, 200)}`);
    } else {
      console.log(`✅ [${context}] parsed.practice_exercises existe y es un array con ${parsed.practice_exercises.length} elemento(s)`);
      if (parsed.practice_exercises.length > 0) {
        console.log(`   Primer ejercicio (muestra): ${JSON.stringify(parsed.practice_exercises[0]).substring(0, 150)}...`);
      }
    }
  }

  /**
   * Para Inglés se usan solo los nombres canónicos "Parte 1".."Parte 7" (sin nombres alternativos)
   * para que el contenido (videos, enlaces) cargue correctamente por tema.
   */
  private transformEnglishTopicName(topicName: string): string {
    return topicName;
  }

  /**
   * Construye el prompt maestro para generar el plan de estudio
   */
  private buildStudyPlanPrompt(
    studentId: string,
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
          // Para inglés, transformar los nombres de temas
          const topicName = this.isEnglishSubject(subject)
            ? this.transformEnglishTopicName(q.topic)
            : q.topic;
          allTopics.add(topicName);
        }
      });
    });

    const topicsList = Array.from(allTopics).join(', ');

    // Construir descripción detallada de debilidades
    const weaknessesDescription = weaknesses.map(w => {
      const sampleQuestions = w.questions.slice(0, 3).map(q => 
        `- ${q.questionText.substring(0, 100)}${q.questionText.length > 100 ? '...' : ''}`
      ).join('\n');
      
      // Para inglés, transformar el nombre del tema en la descripción de debilidades
      const displayTopic = this.isEnglishSubject(subject)
        ? this.transformEnglishTopicName(w.topic)
        : w.topic;
      
      return `**${displayTopic}**: ${w.percentage}% de aciertos (${w.correct}/${w.total} correctas)
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

--- Datos del estudiante ---

**Estudiante:** ${studentId} | **Fase:** ${phase} | **Materia:** ${subject}

**Temas del cuestionario:** ${topicsList || 'No especificados'}

**Debilidades (menos del 60% de aciertos):**
${weaknesses.length > 0 ? weaknessesDescription : 'No se identificaron debilidades.'}

Genera un plan enfocado solo en esas debilidades, alineado con ICFES Saber 11 y accionable.

--- Formato de respuesta ---

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después. Estructura:

{
  "student_info": {
    "studentId": "${studentId}",
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

      console.log(`\n📚 Generando plan de estudio para:`);
      console.log(`   Estudiante: ${input.studentId}`);
      console.log(`   Fase: ${input.phase}`);
      console.log(`   Materia: ${input.subject}`);

      // 1. Obtener resultados del estudiante
      console.log(`\n📊 Obteniendo resultados del estudiante...`);
      const examResults = await this.getStudentResults(
        input.studentId,
        input.phase,
        input.subject
      );

      if (examResults.length === 0) {
        throw new Error(`No se encontraron resultados para el estudiante ${input.studentId} en la fase ${input.phase} para la materia ${input.subject}`);
      }

      console.log(`   ✅ Encontrados ${examResults.length} examen(es) completado(s)`);

      // 2. Calcular debilidades
      console.log(`\n🔍 Calculando debilidades...`);
      const weaknesses = this.calculateWeaknesses(examResults);
      
      if (weaknesses.length === 0) {
        throw new Error('No se identificaron debilidades. El estudiante tiene un buen desempeño en todos los temas.');
      }

      console.log(`   ✅ Identificadas ${weaknesses.length} debilidad(es):`);
      weaknesses.forEach(w => {
        console.log(`      - ${w.topic}: ${w.percentage}% (${w.correct}/${w.total})`);
      });

      // 3. Construir prompt
      console.log(`\n📝 Construyendo prompt para Gemini...`);
      const prompt = this.buildStudyPlanPrompt(
        input.studentId,
        input.phase,
        input.subject,
        weaknesses,
        examResults
      );

      // 4. Generar contenido con Gemini (con timeout extendido para respuestas largas)
      console.log(`\n🤖 Enviando request a Gemini (esto puede tardar varios minutos)...`);
      const result = await geminiCentralizedService.generateContent({
        userId: input.studentId,
        prompt,
        processName: 'study_plan',
        images: [],
        options: {
          retries: 3,
          timeout: 600000, // 10 minutos para respuestas largas
        },
      });

      // Verificar respuesta de Gemini ANTES del parsing
      console.log(`\n📋 RESPUESTA DE GEMINI RECIBIDA:`);
      console.log(`   Tamaño total: ${result.text.length} caracteres`);
      
      // Buscar si hay referencias a practice_exercises en el texto crudo
      const hasPracticeExercisesInText = result.text.toLowerCase().includes('practice_exercises') || 
                                         result.text.toLowerCase().includes('"practice_exercises"') ||
                                         result.text.toLowerCase().includes("'practice_exercises'");
      console.log(`   ¿Contiene "practice_exercises" en el texto?: ${hasPracticeExercisesInText ? '✅ SÍ' : '❌ NO'}`);
      
      // Buscar si hay arrays de ejercicios
      const exerciseMatches = result.text.match(/(?:practice_exercises|practiceExercises).*?\[/gi);
      if (exerciseMatches) {
        console.log(`   ✅ Se encontraron ${exerciseMatches.length} referencia(s) a practice_exercises con array`);
        exerciseMatches.forEach((match, idx) => {
          console.log(`      ${idx + 1}. ${match.substring(0, 100)}...`);
        });
      } else {
        console.warn(`   ⚠️ No se encontraron referencias a practice_exercises con arrays en el texto`);
      }
      
      // Mostrar últimos 1000 caracteres para ver si está truncado
      if (result.text.length > 1000) {
        console.log(`   Últimos 500 caracteres de la respuesta:`);
        console.log(`   "${result.text.substring(result.text.length - 500)}"`);
      }

      // 5. Parsear respuesta JSON con manejo robusto de errores
      console.log(`\n📥 Parseando respuesta de Gemini...`);
      let parsed: StudyPlanResponse;
      
      try {
        // Limpiar la respuesta: eliminar bloques de código markdown
        let cleanedText = result.text.replace(/```json\n?([\s\S]*?)\n?```/g, '$1');
        cleanedText = cleanedText.replace(/```\n?([\s\S]*?)\n?```/g, '$1');
        
        // Buscar el JSON: desde la primera llave hasta la última
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          throw new Error('No se encontró estructura JSON válida en la respuesta');
        }
        
        let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
        
        // Detectar y completar estructuras incompletas
        const openBrackets = (jsonString.match(/\[/g) || []).length;
        const closeBrackets = (jsonString.match(/\]/g) || []).length;
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        
        // Si hay más corchetes abiertos que cerrados, cerrar los arrays
        if (openBrackets > closeBrackets) {
          const missingBrackets = openBrackets - closeBrackets;
          jsonString += ']'.repeat(missingBrackets);
          console.log(`⚠️ Completando ${missingBrackets} corchete(s) de array faltante(s)`);
        }
        
        // Si hay más llaves abiertas que cerradas, cerrar los objetos
        if (openBraces > closeBraces) {
          const missingBraces = openBraces - closeBraces;
          jsonString += '}'.repeat(missingBraces);
          console.log(`⚠️ Completando ${missingBraces} llave(s) de objeto faltante(s)`);
        }
        
        // Limpieza básica (pero preservar escapes válidos)
        jsonString = jsonString
          .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":') // Comillas simples en propiedades
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Comillas simples en valores
          .replace(/,(\s*[}\]])/g, '$1') // Trailing commas
          // NO reemplazar \n ni \" aquí - son válidos en JSON strings
          // Solo normalizar espacios múltiples fuera de strings
          .replace(/(?<!")\s+(?!")/g, ' '); // Espacios múltiples (pero no dentro de strings)
        
        // Intentar parsear
        parsed = JSON.parse(jsonString);
        console.log('✅ JSON parseado exitosamente');
        
        // Verificar INMEDIATAMENTE después del parsing si practice_exercises existe
        this.logPracticeExercisesStatus(parsed, 'después del parsing inicial');
      } catch (parseError: any) {
        console.warn('⚠️ Falló el parsing JSON inicial. Intentando limpieza agresiva...');
        
        try {
          // Estrategia más agresiva
          let cleanedText = result.text
            .replace(/```json\n?([\s\S]*?)\n?```/g, '$1')
            .replace(/```\n?([\s\S]*?)\n?```/g, '$1');
          
          const firstBrace = cleanedText.indexOf('{');
          let lastBrace = cleanedText.lastIndexOf('}');
          
          // Si no hay llave de cierre, intentar completar el JSON
          if (lastBrace === -1 || lastBrace <= firstBrace) {
            const lastQuote = cleanedText.lastIndexOf('"');
            if (lastQuote > firstBrace) {
              cleanedText = cleanedText.substring(0, lastQuote + 1) + '}';
              lastBrace = cleanedText.length - 1;
            } else {
              throw new Error('JSON parece estar truncado y no se puede completar');
            }
          }
          
          let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
          
          // Detectar y completar estructuras incompletas
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          
          if (openBrackets > closeBrackets) {
            jsonString += ']'.repeat(openBrackets - closeBrackets);
          }
          
          if (openBraces > closeBraces) {
            jsonString += '}'.repeat(openBraces - closeBraces);
          }
          
          // Limpieza más agresiva (pero cuidadosa)
          jsonString = jsonString
            .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ': "$1"')
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/\n\s*\n/g, '\n')
            // NO reemplazar \n ni \" aquí - pueden ser válidos en strings JSON
            .replace(/\s+/g, ' '); // Solo normalizar espacios múltiples
          
          parsed = JSON.parse(jsonString);
          console.log('✅ JSON parseado con estrategia alternativa');
          this.logPracticeExercisesStatus(parsed, 'después del parsing alternativo');
        } catch (secondError: any) {
          console.error('❌ Falló el parsing agresivo');
          console.error('   Error:', secondError.message);
          
          // Intentar extraer la posición del error
          const positionMatch = secondError.message.match(/position (\d+)/);
          if (positionMatch) {
            const position = parseInt(positionMatch[1]);
            console.error(`   Posición del error: ${position}`);
            console.error(`   Tamaño total de la respuesta: ${result.text.length} caracteres`);
            
            // Mostrar contexto alrededor del error
            const contextStart = Math.max(0, position - 200);
            const contextEnd = Math.min(result.text.length, position + 200);
            const context = result.text.substring(contextStart, contextEnd);
            console.error(`   Contexto alrededor del error:`);
            console.error(`   "${context}"`);
            
            // Intentar corregir el error en esa posición específica
            try {
              console.log('🔧 Intentando corregir error en posición específica...');
              let jsonString = result.text
                .replace(/```json\n?([\s\S]*?)\n?```/g, '$1')
                .replace(/```\n?([\s\S]*?)\n?```/g, '$1');
              
              const firstBrace = jsonString.indexOf('{');
              let lastBrace = jsonString.lastIndexOf('}');
              
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                
                // Intentar corregir el problema en la posición específica
                // Si el error es "Expected ',' or '}'", probablemente hay una comilla sin cerrar o un carácter problemático
                if (position < jsonString.length) {
                  console.log(`   🔧 Analizando error en posición ${position}...`);
                  
                  // Mostrar contexto del error (más amplio para mejor diagnóstico)
                  const contextStart = Math.max(0, position - 200);
                  const contextEnd = Math.min(jsonString.length, position + 200);
                  const context = jsonString.substring(contextStart, contextEnd);
                  console.log(`   Contexto ampliado (posiciones ${contextStart}-${contextEnd}): "${context}"`);
                  
                  // Buscar el problema específico: "Expected ',' or '}'"
                  // Esto generalmente significa que hay un valor sin cerrar o una estructura incompleta
                  const beforeError = jsonString.substring(Math.max(0, position - 100), position);
                  const afterError = jsonString.substring(position, Math.min(jsonString.length, position + 100));
                  console.log(`   Antes del error: "${beforeError.substring(Math.max(0, beforeError.length - 50))}"`);
                  console.log(`   Después del error: "${afterError.substring(0, 50)}"`);
                  
                  // Estrategia 1: Verificar si hay una comilla sin cerrar
                  let quoteCount = 0;
                  let inString = false;
                  for (let i = 0; i < position; i++) {
                    if (jsonString[i] === '"' && (i === 0 || jsonString[i - 1] !== '\\')) {
                      inString = !inString;
                      quoteCount++;
                    }
                  }
                  
                  console.log(`   Estado: ${inString ? 'Dentro de string' : 'Fuera de string'}, Comillas encontradas: ${quoteCount}`);
                  
                  // Si estamos dentro de un string y el error es "Expected ',' or '}'", 
                  // probablemente el string no está cerrado correctamente
                  if (inString) {
                    console.log('   🔧 Detectado: Estamos dentro de un string sin cerrar');
                    // Buscar hacia adelante para encontrar dónde debería cerrarse el string
                    let closePosition = position;
                    while (closePosition < jsonString.length && 
                           jsonString[closePosition] !== '"' && 
                           jsonString[closePosition] !== ',' && 
                           jsonString[closePosition] !== '}') {
                      closePosition++;
                    }
                    
                    // Si encontramos una comilla, verificar si está escapada
                    if (closePosition < jsonString.length && jsonString[closePosition] === '"') {
                      if (closePosition === 0 || jsonString[closePosition - 1] !== '\\') {
                        // La comilla está correctamente cerrada, el problema es otro
                        console.log('   ℹ️ La comilla parece estar cerrada correctamente');
                      }
                    } else {
                      // Insertar comilla de cierre antes del siguiente carácter problemático
                      console.log(`   🔧 Insertando comilla de cierre en posición ${closePosition}`);
                      jsonString = jsonString.substring(0, closePosition) + '"' + jsonString.substring(closePosition);
                    }
                  }
                  
                  // Estrategia 2: Buscar caracteres problemáticos comunes
                  const problemChars = ['\n', '\r', '\t'];
                  for (const char of problemChars) {
                    const charIndex = jsonString.indexOf(char, Math.max(0, position - 100));
                    if (charIndex !== -1 && charIndex < position + 100) {
                      console.log(`   ⚠️ Carácter problemático encontrado en posición ${charIndex}: ${JSON.stringify(char)}`);
                      // Reemplazar con espacio si está fuera de un string
                      if (!inString) {
                        jsonString = jsonString.substring(0, charIndex) + ' ' + jsonString.substring(charIndex + 1);
                      }
                    }
                  }
                  
                  // Limpieza final
                  jsonString = jsonString
                    .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":')
                    .replace(/:\s*'([^']*)'/g, ': "$1"')
                    .replace(/,(\s*[}\]])/g, '$1');
                  
                  // Completar estructuras
                  const openBrackets = (jsonString.match(/\[/g) || []).length;
                  const closeBrackets = (jsonString.match(/\]/g) || []).length;
                  const openBraces = (jsonString.match(/\{/g) || []).length;
                  const closeBraces = (jsonString.match(/\}/g) || []).length;
                  
                  if (openBrackets > closeBrackets) {
                    jsonString += ']'.repeat(openBrackets - closeBrackets);
                  }
                  if (openBraces > closeBraces) {
                    jsonString += '}'.repeat(openBraces - closeBraces);
                  }
                  
                  // Intentar parsear de nuevo
                  try {
                    parsed = JSON.parse(jsonString);
                    console.log('✅ JSON corregido y parseado exitosamente');
                    this.logPracticeExercisesStatus(parsed, 'después del parsing corregido');
                  } catch (retryError: any) {
                    console.error('   ❌ Aún falla después de corrección:', retryError.message);
                    // Si aún falla, lanzar el error original
                    throw secondError;
                  }
                } else {
                  throw secondError;
                }
              } else {
                throw secondError;
              }
            } catch (fixError: any) {
              console.error('❌ No se pudo corregir el error automáticamente con estrategias manuales');
              console.error('   Intentando usar jsonrepair como último recurso...');
              
              try {
                // Usar jsonrepair como último recurso
                let cleanedText = result.text
                  .replace(/```json\n?([\s\S]*?)\n?```/g, '$1')
                  .replace(/```\n?([\s\S]*?)\n?```/g, '$1');
                
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
                  
                  // Usar jsonrepair para reparar el JSON
                  const repairedJson = jsonrepair(jsonString);
                  parsed = JSON.parse(repairedJson);
                  console.log('✅ JSON reparado exitosamente con jsonrepair');
                  this.logPracticeExercisesStatus(parsed, 'después del parsing con jsonrepair');
                } else {
                  throw new Error('No se encontró estructura JSON válida para reparar');
                }
              } catch (repairError: any) {
                console.error('❌ jsonrepair también falló:', repairError.message);
                console.error('   Primeros 2000 caracteres:', result.text.substring(0, 2000));
                console.error('   Últimos 500 caracteres:', result.text.substring(Math.max(0, result.text.length - 500)));
                
                // Intentar extraer y reparar el JSON parcial antes de fallar completamente
                try {
                  const firstBrace = result.text.indexOf('{');
                  if (firstBrace !== -1) {
                    // Intentar encontrar el punto de truncamiento y cerrar el JSON manualmente
                    let jsonString = result.text.substring(firstBrace);
                    
                    // Buscar el último objeto/array completo antes del error
                    const errorPosition = repairError.message.includes('position') 
                      ? parseInt(repairError.message.match(/position (\d+)/)?.[1] || '0')
                      : jsonString.length;
                    
                    console.log(`   🔍 Error en posición ${errorPosition} de ${jsonString.length} caracteres`);
                    console.log(`   🔍 Tipo de error: ${repairError.message}`);
                    
                    // Estrategia mejorada: buscar hacia atrás desde el error para encontrar un punto seguro de corte
                    let safeCutPosition = errorPosition;
                    
                    // Si el error es "Colon expected", probablemente hay un problema de sintaxis
                    // Buscar hacia atrás para encontrar el último objeto/array válido
                    if (repairError.message.includes('Colon expected')) {
                      console.log('   🔧 Error "Colon expected" detectado. Buscando punto seguro de corte...');
                      
                      // Buscar hacia atrás desde el error para encontrar un cierre válido
                      let braceDepth = 0;
                      let bracketDepth = 0;
                      let inString = false;
                      let escapeNext = false;
                      
                      for (let i = errorPosition - 1; i >= 0; i--) {
                        const char = jsonString[i];
                        
                        if (escapeNext) {
                          escapeNext = false;
                          continue;
                        }
                        
                        if (char === '\\') {
                          escapeNext = true;
                          continue;
                        }
                        
                        if (char === '"' && !escapeNext) {
                          inString = !inString;
                          continue;
                        }
                        
                        if (!inString) {
                          if (char === '}') braceDepth++;
                          else if (char === '{') {
                            braceDepth--;
                            if (braceDepth === 0 && bracketDepth === 0) {
                              // Encontramos un objeto completo
                              safeCutPosition = i + 1;
                              break;
                            }
                          } else if (char === ']') bracketDepth++;
                          else if (char === '[') {
                            bracketDepth--;
                            if (braceDepth === 0 && bracketDepth === 0) {
                              // Encontramos un array completo
                              safeCutPosition = i + 1;
                              break;
                            }
                          } else if ((char === ',' || char === ':') && braceDepth === 0 && bracketDepth === 0) {
                            // Punto seguro de corte
                            safeCutPosition = i + 1;
                            break;
                          }
                        }
                      }
                      
                      // Si no encontramos un punto seguro, usar una posición más conservadora
                      if (safeCutPosition === errorPosition) {
                        safeCutPosition = Math.max(0, errorPosition - 5000); // Retroceder 5KB
                        console.log(`   ⚠️ No se encontró punto seguro, usando posición conservadora: ${safeCutPosition}`);
                      } else {
                        console.log(`   ✅ Punto seguro encontrado en posición: ${safeCutPosition}`);
                      }
                    }
                    
                    // Extraer JSON hasta el punto seguro
                    let truncatedJson = jsonString.substring(0, safeCutPosition);
                    
                    // Buscar el último objeto completo válido
                    const lastBrace = truncatedJson.lastIndexOf('}');
                    if (lastBrace > 0) {
                      // Intentar extraer solo hasta el último objeto completo
                      const beforeLastBrace = truncatedJson.substring(0, lastBrace + 1);
                      
                      // Verificar si podemos parsear hasta aquí
                      try {
                        const testParsed = JSON.parse(beforeLastBrace);
                        if (testParsed.diagnostic_summary || testParsed.study_plan_summary) {
                          truncatedJson = beforeLastBrace;
                          console.log(`   ✅ Usando JSON hasta el último objeto completo (posición ${lastBrace})`);
                        }
                      } catch (e) {
                        // Continuar con la estrategia original
                      }
                    }
                    
                    // Contar llaves y corchetes abiertos
                    const openBraces = (truncatedJson.match(/\{/g) || []).length;
                    const closeBraces = (truncatedJson.match(/\}/g) || []).length;
                    const openBrackets = (truncatedJson.match(/\[/g) || []).length;
                    const closeBrackets = (truncatedJson.match(/\]/g) || []).length;
                    
                    // Cerrar arrays primero
                    if (openBrackets > closeBrackets) {
                      truncatedJson += ']'.repeat(openBrackets - closeBrackets);
                    }
                    
                    // Cerrar objetos
                    if (openBraces > closeBraces) {
                      truncatedJson += '}'.repeat(openBraces - closeBraces);
                    }
                    
                    // Limpiar trailing commas antes de cerrar
                    truncatedJson = truncatedJson.replace(/,(\s*[}\]])/g, '$1');
                    
                    // Intentar parsear el JSON parcial reparado
                    try {
                      const partialParsed = JSON.parse(truncatedJson);
                      console.log('⚠️ Se logró parsear un JSON parcial (puede estar incompleto)');
                      
                      // Si tiene al menos la estructura básica, usarlo
                      if (partialParsed.diagnostic_summary && partialParsed.study_plan_summary) {
                        parsed = partialParsed;
                        console.log('✅ Usando JSON parcial reparado (puede faltar contenido)');
                        // Continuar con el flujo normal, pero con datos parciales
                      } else {
                        throw new Error('JSON parcial no tiene estructura mínima válida');
                      }
                    } catch (parseError: any) {
                      console.error(`   ❌ No se pudo parsear JSON parcial: ${parseError.message}`);
                      throw new Error('JSON parcial no se pudo parsear');
                    }
                  } else {
                    throw repairError;
                  }
                } catch (partialError: any) {
                  console.error('❌ No se pudo recuperar JSON parcial:', partialError.message);
                
                // Guardar la respuesta completa en un log para análisis posterior
                console.error(`\n📋 RESPUESTA COMPLETA DE GEMINI (${result.text.length} caracteres):`);
                console.error(result.text);
                
                  throw new Error(`Error parseando respuesta JSON después de múltiples intentos (incluyendo jsonrepair): ${repairError.message}. La respuesta de Gemini puede estar mal formada o truncada. Tamaño: ${result.text.length} caracteres. Por favor, intenta generar el plan nuevamente.`);
                }
              }
            }
          } else {
            console.error('   Primeros 2000 caracteres:', result.text.substring(0, 2000));
            console.error('   Últimos 500 caracteres:', result.text.substring(Math.max(0, result.text.length - 500)));
            throw new Error(`Error parseando respuesta JSON después de múltiples intentos: ${secondError.message}. La respuesta de Gemini puede estar mal formada o truncada.`);
          }
        }
      }

      // 6. Validar estructura
      if (!parsed.diagnostic_summary || !parsed.study_plan_summary) {
        throw new Error('La respuesta de Gemini no tiene la estructura esperada');
      }

      // Inicializar practice_exercises si no existe o está undefined
      if (!parsed.practice_exercises || !Array.isArray(parsed.practice_exercises)) {
        console.warn(`⚠️ Advertencia: practice_exercises no existe o no es un array, inicializando como array vacío`);
        parsed.practice_exercises = [];
      }

      // Validar y loggear información sobre ejercicios
      console.log(`\n📝 EJERCICIOS DE PRÁCTICA:`);
      console.log(`   Total recibidos: ${parsed.practice_exercises.length}`);
      
      if (parsed.practice_exercises.length === 0) {
        console.error(`❌ ERROR CRÍTICO: No se generaron ejercicios de práctica. El plan de estudio requiere ejercicios para ser útil.`);
        console.error(`   Esto puede deberse a:`);
        console.error(`   1. Gemini no generó los ejercicios (truncamiento o límite de tokens)`);
        console.error(`   2. El parsing JSON falló y eliminó los ejercicios`);
        console.error(`   3. El prompt no fue lo suficientemente claro`);
        console.error(`\n🔍 DIAGNÓSTICO:`);
        console.error(`   Verificando si los ejercicios están en la respuesta cruda de Gemini...`);
        
        // Buscar ejercicios en el texto original
        const originalText = result.text;
        const exercisePatterns = [
          /"practice_exercises"\s*:\s*\[/i,
          /practice_exercises.*?\[.*?\{/is,
          /"question"\s*:/i,
          /"options"\s*:\s*\[/i
        ];
        
        const foundPatterns = exercisePatterns.map((pattern, idx) => {
          const matches = originalText.match(pattern);
          return { pattern: idx, found: !!matches, count: matches ? matches.length : 0 };
        });
        
        console.error(`   Patrones encontrados en respuesta original:`);
        foundPatterns.forEach((fp, idx) => {
          console.error(`      ${idx + 1}. ${fp.found ? '✅ Encontrado' : '❌ NO encontrado'} (${fp.count} ocurrencia(s))`);
        });
        
        // Si no hay ejercicios, intentar regenerarlos con un prompt más simple y directo
        console.error(`\n🔧 SOLUCIÓN: Los ejercicios NO están en la respuesta.`);
        console.error(`   El plan se guardará sin ejercicios, pero esto afectará la utilidad del plan.`);
        console.error(`   Recomendación: Verificar límites de tokens de Gemini o dividir la generación en dos pasos.`);
      } else if (parsed.practice_exercises.length !== StudyPlanService.TARGET_EXERCISE_COUNT) {
        console.warn(`⚠️ Advertencia: Se esperaban ${StudyPlanService.TARGET_EXERCISE_COUNT} ejercicios, pero se recibieron ${parsed.practice_exercises.length}`);
        console.warn(`   El plan de estudio seguirá guardándose, pero puede estar incompleto.`);
      } else {
        console.log(`✅ Se generaron correctamente ${parsed.practice_exercises.length} ejercicios de práctica`);
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
                  console.warn(`   🔧 Normalizando opción ${optIdx + 1} del ejercicio ${idx + 1}: agregando prefijo "${expectedPrefix}"`);
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
            console.warn(`   🔧 Normalizando correctAnswer del ejercicio ${idx + 1}: "${exercise.correctAnswer}" -> "${normalizedAnswer}"`);
            parsed.practice_exercises[idx].correctAnswer = normalizedAnswer;
          }
        }
        
        if (validationErrors.length > 0) {
          invalidExercises.push(idx);
          console.warn(`⚠️ Ejercicio ${idx + 1} tiene problemas: ${validationErrors.join(', ')}`);
        }
      });

      if (invalidExercises.length > 0) {
        console.warn(`⚠️ ${invalidExercises.length} ejercicio(s) tienen estructura inválida (índices: ${invalidExercises.join(', ')})`);
        // Filtrar ejercicios inválidos para evitar errores en el frontend
        parsed.practice_exercises = parsed.practice_exercises.filter((_, idx) => !invalidExercises.includes(idx));
        console.log(`   Se guardarán ${parsed.practice_exercises.length} ejercicio(s) válido(s)`);
      }

      const grade = this.normalizeGradeForPath(input.grade);
      if (!parsed.student_info) parsed.student_info = {} as StudyPlanResponse['student_info'];
      (parsed.student_info as { grade?: string }).grade = grade;
      console.log(`   📋 Grado (videos y WebLinks): ${grade}`);

      // Todos los temas de la materia (videos y enlaces; no solo debilidades).
      const allTopicNamesForSubjectGen =
        getSubjectConfig(input.subject)?.topics.map((t) => t.name) ?? [];

      // Videos: YoutubeLinks/consolidado_{materiaCode} — mismo criterio que al leer AnswerIA.
      console.log(
        `\n📹 Videos desde YoutubeLinks/consolidado_* (${allTopicNamesForSubjectGen.length} tema(s) de la materia)...`
      );
      parsed.video_resources = [];
      if (allTopicNamesForSubjectGen.length > 0) {
        const videosByTopic = await Promise.all(
          allTopicNamesForSubjectGen.map(async (topicName) => {
            try {
              const videos = await this.getVideosForTopic(
                grade,
                input.studentId,
                input.phase,
                input.subject,
                topicName
              );
              return videos.map((video) => ({
                ...video,
                topic: topicName,
                topicDisplayName: topicName,
              }));
            } catch (error: any) {
              console.warn(`   ⚠️ Error videos tema "${topicName}":`, error?.message);
              return [];
            }
          })
        );
        parsed.video_resources = videosByTopic.flat();
        const totalVideos = parsed.video_resources.length;
        const cap = allTopicNamesForSubjectGen.length * VIDEOS_PER_TOPIC;
        console.log(
          `✅ Total ${totalVideos} video(s) desde consolidado (${allTopicNamesForSubjectGen.length} temas × hasta ${VIDEOS_PER_TOPIC}/tema ≈ ${cap})`
        );
        if (totalVideos === 0) {
          console.error(`❌ No hay videos en YoutubeLinks/consolidado para esta materia.`);
        }
      }

      // Enlaces: WebLinks/consolidado_{materiaCode} (1 lectura; todos los temas de la materia)
      console.log(`\n🔗 Enlaces desde WebLinks/consolidado_* (${allTopicNamesForSubjectGen.length} tema(s))...`);
      parsed.study_links = await this.buildStudyLinksFromWebLinks(
        grade,
        input.subject,
        allTopicNamesForSubjectGen,
        input.phase
      );
      console.log(`   ✅ ${parsed.study_links.length} enlace(s) desde consolidado`);

      // 6b. Guardar ejercicios en EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ (misma ruta que admin)
      if (parsed.practice_exercises && parsed.practice_exercises.length > 0) {
        console.log(`\n📝 Guardando ejercicios en EjerciciosIA (grado/materiaCode/topicCode)...`);
        const exercisesByTopic = new Map<string, typeof parsed.practice_exercises>();
        for (const ex of parsed.practice_exercises) {
          const canonicalTopic = mapToCanonicalTopic(input.subject, ex.topic);
          const topicKey = canonicalTopic || this.normalizeTopicId(ex.topic);
          if (!exercisesByTopic.has(topicKey)) {
            exercisesByTopic.set(topicKey, []);
          }
          exercisesByTopic.get(topicKey)!.push(ex);
        }
        let totalSaved = 0;
        for (const [topicKey, exs] of exercisesByTopic) {
          const n = await this.saveExercisesToCache(grade, input.subject, topicKey, exs);
          totalSaved += n;
        }
        if (totalSaved > 0) {
          console.log(`   ✅ Total: ${totalSaved} ejercicio(s) guardados en EjerciciosIA`);
        }
      }

      // 7. Guardar en Firestore
      console.log(`\n💾 Guardando plan de estudio en Firestore...`);
      console.log(`   📊 Resumen antes de guardar:`);
      console.log(`      - Topics: ${parsed.topics?.length || 0}`);
      console.log(`      - Videos: ${parsed.video_resources?.length || 0}`);
      console.log(`      - Enlaces: ${parsed.study_links?.length || 0}`);
      console.log(`      - Ejercicios de práctica: ${parsed.practice_exercises?.length || 0}`);
      
      // Validación: el plan debe estar completo antes de guardar y retornar
      if (!parsed.topics || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
        throw new Error('El plan debe tener al menos un topic');
      }

      // Verificar que el plan tenga todos los recursos necesarios
      const hasExercises = parsed.practice_exercises && Array.isArray(parsed.practice_exercises) && parsed.practice_exercises.length > 0;
      const hasVideos = parsed.video_resources && Array.isArray(parsed.video_resources) && parsed.video_resources.length > 0;
      const hasLinks = parsed.study_links && Array.isArray(parsed.study_links) && parsed.study_links.length > 0;

      if (!hasExercises) {
        throw new Error('El plan debe tener al menos un ejercicio de práctica');
      }

      if (!hasVideos) {
        throw new Error('El plan debe tener al menos un video educativo');
      }

      // Enlaces web: si no hay ninguno, se permite el plan pero se registra advertencia (los links solo vienen de WebLinks/caché)
      if (!hasLinks) {
        console.warn('⚠️ El plan se generó sin enlaces web. Agrega enlaces en WebLinks (admin) para la materia y temas del plan.');
        parsed.study_links = parsed.study_links || [];
      }

      // Verificar que los videos tengan campos válidos
      const invalidVideos = parsed.video_resources.filter(v => !v.title || !v.url);
      if (invalidVideos.length > 0) {
        throw new Error(`${invalidVideos.length} video(s) sin título o URL válida`);
      }

      // Filtrar enlaces sin título o URL válida (evitar fallar todo el plan por datos incompletos de caché o API)
      if (parsed.study_links.length > 0) {
        const validLinks = parsed.study_links.filter(
          (l) => (l.title && l.url) || (l.title && (l as any).link)
        ).map((l) => ({
          title: l.title || 'Enlace',
          url: l.url || (l as any).link || '',
          description: l.description || '',
          topic: l.topic,
        })).filter((l) => l.url && l.url.startsWith('http'));
        const removed = parsed.study_links.length - validLinks.length;
        if (removed > 0) {
          console.warn(`⚠️ Se omitieron ${removed} enlace(s) sin título o URL válida. Se conservan ${validLinks.length} enlace(s) válido(s).`);
        }
        parsed.study_links = validLinks;
      }

      // Verificar que los ejercicios tengan campos válidos
      const incompleteExercises = parsed.practice_exercises.filter(e => !e.question || !e.options || !e.correctAnswer);
      if (incompleteExercises.length > 0) {
        throw new Error(`${incompleteExercises.length} ejercicio(s) incompleto(s)`);
      }
      
      await this.saveStudyPlan(input, parsed);

      const processingTime = Date.now() - startTime;
      console.log(`\n✅ Plan de estudio generado y guardado exitosamente en ${(processingTime / 1000).toFixed(1)}s`);
      console.log(`   ✅ Videos: ${parsed.video_resources.length}`);
      console.log(`   ✅ Enlaces (desde WebLinks): ${parsed.study_links.length}`);
      console.log(`   ✅ Ejercicios: ${parsed.practice_exercises.length}`);

      return {
        success: true,
        studyPlan: parsed, // Retornar el plan generado directamente
        processingTimeMs: processingTime,
      };
    } catch (error: any) {
      console.error(`❌ Error generando plan de estudio:`, error);
      
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
      // Mapear fase a nombre de subcolección
      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };
      
      const phaseName = phaseMap[input.phase];
      
      // Obtener la base de datos correcta (superate-6c730)
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
        console.warn(`   ⚠️ practice_exercises no existe o no es un array antes de guardar, inicializando como array vacío`);
        dataToSave.practice_exercises = [];
      }

      console.log(`   📝 Verificando estructura antes de guardar:`);
      console.log(`      - practice_exercises existe: ${!!dataToSave.practice_exercises}`);
      console.log(`      - practice_exercises es array: ${Array.isArray(dataToSave.practice_exercises)}`);
      console.log(`      - Cantidad de ejercicios: ${dataToSave.practice_exercises?.length || 0}`);

      await docRef.set(dataToSave, { merge: true });

      console.log(`   ✅ Plan guardado en: AnswerIA/${input.studentId}/${phaseName}/${input.subject}`);
      
      // Verificar que se guardó correctamente
      const verificationDoc = await docRef.get();
      if (verificationDoc.exists) {
        const savedData = verificationDoc.data();
        const savedExercisesCount = savedData?.practice_exercises?.length || 0;
        console.log(`   ✅ Verificación: Plan guardado correctamente con ${savedExercisesCount} ejercicio(s) de práctica`);
        
        if (savedExercisesCount === 0 && studyPlan.practice_exercises && studyPlan.practice_exercises.length > 0) {
          console.error(`   ❌ ERROR: Se intentaron guardar ${studyPlan.practice_exercises.length} ejercicios pero se guardaron 0`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error guardando plan de estudio:', error);
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
            console.warn(`⚠️ Plan de estudio recuperado pero practice_exercises no existe o no es un array`);
            console.warn(`   Estudiante: ${studentId}, Fase: ${phaseName}, Materia: ${subject}`);
            data.practice_exercises = [];
          } else {
            console.log(`✅ Plan recuperado con ${data.practice_exercises.length} ejercicio(s) de práctica`);
          }

          const gradeForLinks = this.normalizeGradeForPath((data.student_info as { grade?: string })?.grade);
          const allTopicNamesForSubject = getSubjectConfig(subject)?.topics.map((t) => t.name) ?? [];
          data.study_links = await this.buildStudyLinksFromWebLinks(gradeForLinks, subject, allTopicNamesForSubject, phase);
          if (data.study_links.length > 0) {
            console.log(`   ✅ study_links desde WebLinks: ${data.study_links.length} enlace(s) para ${allTopicNamesForSubject.length} tema(s)`);
          }

          const grade = this.normalizeGradeForPath((data.student_info as { grade?: string })?.grade);
          const allTopicsForVideos = getSubjectConfig(subject)?.topics.map((t) => t.name) ?? [];
          if (allTopicsForVideos.length > 0) {
            console.log(`   📹 Construyendo video_resources desde YoutubeLinks (${allTopicsForVideos.length} tema(s) de la materia)...`);
            const videosByTopic = await Promise.all(
              allTopicsForVideos.map(async (topicName) => {
                try {
                  const videos = await this.getCachedVideos(grade, studentId, phase, subject, topicName);
                  return videos.map((video) => ({
                    ...video,
                    topic: topicName,
                    topicDisplayName: topicName,
                  }));
                } catch (error: any) {
                  console.warn(`   ⚠️ Error obteniendo videos para topic "${topicName}":`, error?.message);
                  return [];
                }
              })
            );
            data.video_resources = videosByTopic.flat();
            if (data.video_resources.length > 0) {
              console.log(`   ✅ video_resources desde YoutubeLinks: ${data.video_resources.length} video(s)`);
            }
          } else {
            data.video_resources = [];
          }

          return data;
        } catch (error: any) {
          console.warn(`   ⚠️ Error buscando en ${phaseName}:`, error.message);
        }
      }

      return null;
    } catch (error: any) {
      console.error('Error obteniendo plan de estudio:', error);
      return null;
    }
  }


  /**
   * Videos para un topic canónico: solo YoutubeLinks/consolidado_{materiaCode} (sin YouTube API ni rutas por grado/topic).
   */
  private async getVideosForTopic(
    grade: string,
    studentId: string,
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
    videoId?: string;
    duration?: string;
    language?: string;
  }>> {
    try {
      const list = await this.getCachedVideos(grade, studentId, phase, subject, topic);
      return list.slice(0, VIDEOS_PER_TOPIC).map((v) => ({
        title: v.title,
        url: v.url,
        description: v.description,
        channelTitle: v.channelTitle,
        videoId: v.videoId,
        duration: v.duration,
        language: v.language,
      }));
    } catch (error: any) {
      console.error(`❌ Error obteniendo videos para topic "${topic}":`, error.message);
      return [];
    }
  }

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
      console.warn(`   ⚠️ YoutubeLinks: no existe ${docId}`);
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
    console.log(
      `   📦 YoutubeLinks ${docId}: ${allVideosForSubject.length} video(s) (1 lectura)`
    );
    return allVideosForSubject;
  }

  private async getCachedVideos(
    _grade: string,
    _studentId: string,
    _phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
    videoId?: string;
    duration?: string;
    language?: string;
    topic?: string;
  }>> {
    const subjectConfig = getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    const topicCode = getTopicCode(subject, topic);

    if (!materiaCode || !topicCode) {
      console.warn(`   ⚠️ No se pudo resolver ruta admin para YoutubeLinks materia="${subject}" topic="${topic}" (materiaCode=${materiaCode ?? '?'}, topicCode=${topicCode ?? '?'})`);
      return [];
    }

    try {
      const allVideosForSubject = await this.getOrLoadYoutubeLinksConsolidated(materiaCode);
      const videos = allVideosForSubject
        .filter(
          (v) =>
            typeof v.topic === 'string' &&
            v.topic.trim().toUpperCase() === topicCode.trim().toUpperCase()
        )
        .slice(0, VIDEOS_PER_TOPIC)
        .map((v) => ({
          ...v,
          topic,
        }));

      console.log(
        `   📎 Videos filtrados tema ${topicCode} (${topic}): ${videos.length}`
      );
      return videos;
    } catch (error: any) {
      console.error(`❌ Error obteniendo videos desde caché:`, error.message);
      return [];
    }
  }

  /**
   * Nombre de la colección Firestore para recursos web (única fuente de verdad).
   * Lectura: WebLinks/consolidado_{materiaCode} únicamente.
   */
  private static readonly WEBLINKS_COLLECTION = 'WebLinks';
  private static readonly YOUTUBE_LINKS_COLLECTION = 'YoutubeLinks';

  /**
   * Enlaces web por tema: solo WebLinks/consolidado_{materiaCode} (filtrado por topicCode en items).
   */
  private async getLinksForTopic(
    grade: string,
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>> {
    try {
      console.log(`   📋 Obteniendo enlaces web para topic: "${topic}" (desde caché)`);
      const cachedLinks = await this.getCachedLinks(grade, subject, topic);
      console.log(`   📦 Enlaces en caché para "${topic}": ${cachedLinks.length}`);
      return cachedLinks.map((link) => ({ ...link, topic }));
    } catch (error: any) {
      console.error(`❌ Error obteniendo enlaces para topic "${topic}":`, error.message);
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
    grade?: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    const g = this.normalizeGradeForPath(grade);
    return this.getLinksForTopic(g, subject, topic);
  }


  /**
   * Construye study_links desde WebLinks/consolidado_{materiaCode} (1 lectura Firestore por materia).
   * topicIds: nombres canónicos; getTopicCode → código (AL, GE, BI, …) para filtrar items.topic.
   */
  private async buildStudyLinksFromWebLinks(
    grade: string,
    subject: string,
    topicIds: string[],
    phase?: 'first' | 'second' | 'third'
  ): Promise<Array<{ title: string; url: string; description: string; topic?: string }>> {
    if (topicIds.length === 0) return [];
    const uniqueTopics = [...new Set(topicIds)];
    const allLinksByTopic = await Promise.all(
      uniqueTopics.map(async (topicId) => {
        try {
          return this.getCachedLinks(grade, subject, topicId, phase);
        } catch (error: any) {
          console.warn(`   ⚠️ Error obteniendo enlaces para topic "${topicId}":`, error?.message);
          return [];
        }
      })
    );
    const total = allLinksByTopic.flat();
    const perTopic = uniqueTopics.map((t, i) => `${t}:${allLinksByTopic[i].length}`).join(', ');
    console.log(`   📊 buildStudyLinksFromWebLinks: ${total.length} enlace(s) total para ${uniqueTopics.length} tema(s) [${perTopic}] (sin límite por tema)`);
    return total;
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
      console.warn(`   ⚠️ WebLinks: no existe ${docId}`);
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
    console.log(`   📦 WebLinks ${docId}: ${allLinksForSubject.length} enlace(s) (1 lectura)`);
    return allLinksForSubject;
  }

  /**
   * Filtra por topicCode sobre el consolidado ya cargado en memoria (getOrLoadWebLinksConsolidated).
   */
  private async getCachedLinks(
    _grade: string,
    subject: string,
    topic: string,
    _phase?: 'first' | 'second' | 'third'
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>> {
    const subjectConfig = getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    const topicCode = getTopicCode(subject, topic);

    if (!materiaCode || !topicCode) {
      console.warn(`   ⚠️ No se pudo resolver ruta admin para WebLinks materia="${subject}" topic="${topic}" (materiaCode=${materiaCode ?? '?'}, topicCode=${topicCode ?? '?'})`);
      return [];
    }

    try {
      const allLinksForSubject = await this.getOrLoadWebLinksConsolidated(materiaCode);
      const links = allLinksForSubject
        .filter(
          (l) =>
            typeof l.topic === 'string' &&
            l.topic.trim().toUpperCase() === topicCode.trim().toUpperCase()
        )
        .map((l) => ({ ...l, topic }));
      console.log(
        `   📎 Enlaces filtrados tema ${topicCode} (${topic}): ${links.length}`
      );
      return links;
    } catch (error: any) {
      console.error(`❌ Error obteniendo enlaces desde caché:`, error.message);
      return [];
    }
  }

  /** Orden estable: campo order o número en id `ejercicioN`. */
  private static exerciseDocOrder(docId: string, data: admin.firestore.DocumentData): number {
    if (typeof data.order === 'number' && !Number.isNaN(data.order)) {
      return data.order;
    }
    const m = /^ejercicio(\d+)$/i.exec(docId);
    return m ? parseInt(m[1], 10) : 0;
  }

  /**
   * Obtiene ejercicios desde Firestore (caché EjerciciosIA).
   * Ruta unificada con admin: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicio1...
   * Optimizado: query orderBy('order') + limit (pocas lecturas vs N gets por slot vacío).
   */
  private async getCachedExercises(
    grade: string,
    subject: string,
    topic: string
  ): Promise<Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>> {
    const db = this.getStudentDatabase();
    const gradoPath = getGradeNameForAdminPath(grade);
    const subjectConfig = getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    const topicCode = getTopicCode(subject, topic);

    if (!materiaCode || !topicCode) {
      console.warn(`   ⚠️ No se pudo resolver ruta admin para EjerciciosIA materia="${subject}" topic="${topic}"`);
      return [];
    }

    const parseExerciseDoc = (data: admin.firestore.DocumentData) => ({
      question: data.question || '',
      options: Array.isArray(data.options) ? data.options : [],
      correctAnswer: data.correctAnswer || '',
      explanation: data.explanation || '',
      topic: data.topic || topic,
    });

    try {
      const ejerciciosColRef = db
        .collection('EjerciciosIA')
        .doc(gradoPath)
        .collection(materiaCode)
        .doc(topicCode)
        .collection('ejercicios');

      let snap: admin.firestore.QuerySnapshot | null = null;
      try {
        snap = await ejerciciosColRef
          .orderBy('order', 'asc')
          .limit(MAX_EXERCISES_PER_TOPIC)
          .get();
      } catch (orderErr: any) {
        console.warn(
          `   ⚠️ orderBy('order') en EjerciciosIA falló, usando lectura completa:`,
          orderErr?.message
        );
      }

      if (!snap || snap.empty) {
        snap = await ejerciciosColRef.get();
      }

      if (snap.empty) {
        return [];
      }

      const parsed = snap.docs
        .map((doc) => {
          const data = doc.data();
          if (!data || !data.question) return null;
          const order = StudyPlanService.exerciseDocOrder(doc.id, data);
          return { doc, data, order };
        })
        .filter((x): x is { doc: admin.firestore.QueryDocumentSnapshot; data: admin.firestore.DocumentData; order: number } => x !== null)
        .sort((a, b) => a.order - b.order)
        .slice(0, MAX_EXERCISES_PER_TOPIC)
        .map((x) => parseExerciseDoc(x.data));

      return parsed;
    } catch (error: any) {
      console.warn(`   ⚠️ Error leyendo ejercicios desde EjerciciosIA:`, error.message);
      return [];
    }
  }

  /**
   * Guarda ejercicios en Firestore (caché EjerciciosIA).
   * Ruta unificada con admin: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicio1, ejercicio2...
   * Incremental: agrega nuevos sin duplicar por texto de pregunta.
   */
  private async saveExercisesToCache(
    grade: string,
    subject: string,
    topic: string,
    exercises: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      topic: string;
    }>
  ): Promise<number> {
    if (exercises.length === 0) return 0;
    try {
      const db = this.getStudentDatabase();
      const gradoPath = getGradeNameForAdminPath(grade);
      const subjectConfig = getSubjectConfig(subject);
      const materiaCode = subjectConfig?.code;
      const topicCode = getTopicCode(subject, topic);

      if (!materiaCode || !topicCode) {
        console.warn(`   ⚠️ No se pudo resolver ruta admin para guardar ejercicios (materia="${subject}" topic="${topic}"). No se guardan en caché.`);
        return 0;
      }

      const cached = await this.getCachedExercises(grade, subject, topic);
      const startOrder = cached.length;
      const existingQuestions = new Set(
        cached.map((e) => e.question.trim().toLowerCase().substring(0, 200))
      );

      const ejerciciosColRef = db
        .collection('EjerciciosIA')
        .doc(gradoPath)
        .collection(materiaCode)
        .doc(topicCode)
        .collection('ejercicios');

      const toSave: typeof exercises = [];
      for (const exercise of exercises) {
        if (startOrder + toSave.length >= MAX_EXERCISES_PER_TOPIC) break;
        const qKey = exercise.question.trim().toLowerCase().substring(0, 200);
        if (existingQuestions.has(qKey)) continue;
        existingQuestions.add(qKey);
        toSave.push(exercise);
      }

      if (toSave.length === 0) return 0;

      const batch = db.batch();
      toSave.forEach((exercise, index) => {
        const order = startOrder + index + 1;
        batch.set(
          ejerciciosColRef.doc(`ejercicio${order}`),
          {
            question: exercise.question,
            options: exercise.options,
            correctAnswer: exercise.correctAnswer,
            explanation: exercise.explanation || '',
            topic: exercise.topic || topic,
            order,
            savedAt: new Date(),
          },
          { merge: true }
        );
      });
      await batch.commit();
      console.log(`   💾 Guardados ${toSave.length} ejercicio(s) en EjerciciosIA/${gradoPath}/${materiaCode}/${topicCode}/ejercicios`);
      return toSave.length;
    } catch (error: any) {
      console.error(`❌ Error guardando ejercicios en EjerciciosIA:`, error.message);
      return 0;
    }
  }

  private normalizeTopicId(topic: string): string {
    return topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9áéíóúñü]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
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
