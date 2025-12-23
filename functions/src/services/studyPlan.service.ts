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
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { jsonrepair } from 'jsonrepair';

/**
 * Tipos para el plan de estudio
 */
export interface StudyPlanInput {
  studentId: string;
  phase: 'first' | 'second' | 'third';
  subject: string;
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

/**
 * Información semántica de búsqueda web por tema (sin URLs)
 * Generada por la IA para definir QUÉ buscar, no DÓNDE buscar
 */
export interface TopicWebSearchInfo {
  searchIntent: string; // Intención pedagógica de búsqueda (ej: "artículo explicativo sobre ecuaciones cuadráticas")
  searchKeywords: string[]; // Palabras clave específicas para buscar recursos web educativos
  expectedContentTypes: string[]; // Tipos de contenido esperados (ej: ["artículo explicativo", "guía paso a paso", "contenido académico introductorio"])
  educationalLevel: string; // Nivel educativo (ej: "secundaria", "preparación ICFES")
}

export interface StudyPlanResponse {
  student_info: {
    studentId: string;
    phase: string;
    subject: string;
    weaknesses: StudentWeakness[];
  };
  diagnostic_summary: string; // 50 palabras sobre lo que trabajará
  study_plan_summary: string; // Resumen del plan
  topics: Array<{
    name: string; // Nombre del tema
    description: string; // Descripción del tema
    level: string; // Nivel de dificultad
    keywords: string[]; // Keywords para buscar videos en YouTube
    webSearchInfo?: TopicWebSearchInfo; // Información semántica para buscar recursos web (sin URLs)
  }>;
  practice_exercises: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>;
  // Estos campos se llenan después de buscar videos en YouTube y generar enlaces validados
  video_resources: Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
  }>;
  study_links: Array<{
    title: string;
    url: string;
    description: string;
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

      // Mapear fase a nombre de subcolección (probar múltiples variantes)
      // Nota: según firestoreHelpers.ts, 'first' se guarda como 'fase I' (minúsculas)
      const phaseVariants: Record<string, string[]> = {
        first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
        second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
        third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
      };
      
      const phaseNames = phaseVariants[phase] || [];
      if (phaseNames.length === 0) {
        throw new Error(`Fase inválida: ${phase}`);
      }

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

      // Intentar buscar en cada variante de nombre de fase
      for (const phaseName of phaseNames) {
        try {
          console.log(`\n   🔎 Buscando en subcolección: "results/${studentId}/${phaseName}"`);
          const phaseRef = studentDb.collection('results').doc(studentId).collection(phaseName);
          const phaseSnap = await phaseRef.get();
          
          totalDocsFound += phaseSnap.size;
          console.log(`      📄 Documentos encontrados en "${phaseName}": ${phaseSnap.size}`);

          phaseSnap.docs.forEach(doc => {
            docsChecked++;
            const data = doc.data();
            const examSubject = data.subject || '';
            const normalizedExamSubject = this.normalizeSubjectName(examSubject);
            
            console.log(`      📋 Examen ${doc.id}:`);
            console.log(`         - Materia en documento: "${examSubject}" (normalizada: "${normalizedExamSubject}")`);
            console.log(`         - Coincide: ${normalizedExamSubject === normalizedSubject ? '✅ SÍ' : '❌ NO'}`);
            
            // Filtrar solo exámenes de la materia específica (comparación flexible)
            if (normalizedExamSubject === normalizedSubject) {
              results.push({
                ...data,
                examId: doc.id,
              });
              console.log(`         ✅ Agregado a resultados`);
            }
          });
        } catch (error: any) {
          console.warn(`      ⚠️ Error accediendo a "${phaseName}": ${error.message}`);
          // Continuar con la siguiente variante
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
        if (q.topic) allTopics.add(q.topic);
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

    return `Eres un **experto en educación secundaria y preparación para el examen ICFES Saber 11**, con amplia experiencia pedagógica, curricular y evaluativa. Tu objetivo es diseñar un **plan de estudio personalizado** basado en el desempeño real del estudiante, detectado a partir de un cuestionario previamente respondido y almacenado en base de datos.

═══════════════════════════════════════════════════════════════
📋 INFORMACIÓN DEL ESTUDIANTE Y SU DESEMPEÑO
═══════════════════════════════════════════════════════════════

**Estudiante:** ${studentId}
**Fase:** ${phase}
**Materia:** ${subject}

**Temas abordados en el cuestionario:**
${topicsList || 'No se especificaron temas'}

**DEBILIDADES IDENTIFICADAS (Temas con menos del 60% de aciertos):**

${weaknesses.length > 0 ? weaknessesDescription : 'No se identificaron debilidades específicas. El estudiante tiene un buen desempeño general.'}

═══════════════════════════════════════════════════════════════
🎯 TU MISIÓN COMO EXPERTO EN EDUCACIÓN
═══════════════════════════════════════════════════════════════

Debes crear un **plan de estudio personalizado** que:

1. **Se enfoque exclusivamente en las debilidades identificadas** - Este es el eje central de la ruta de mejora
2. **Esté alineado con los lineamientos oficiales del ICFES Saber 11**
3. **Priorice el fortalecimiento de competencias evaluadas en Saber 11**
4. **Sea práctico, accionable y orientado a resultados**

═══════════════════════════════════════════════════════════════
📋 ESTRUCTURA DE RESPUESTA REQUERIDA (JSON)
═══════════════════════════════════════════════════════════════

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes o después. El JSON debe tener esta estructura exacta:

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
  "diagnostic_summary": "Resumen de máximo 50 palabras sobre la materia y los temas a mejorar en esta ruta de estudio",
  "study_plan_summary": "Resumen más detallado del plan de estudio (100-150 palabras)",
  "practice_exercises": [
    {
      "question": "Texto completo de la pregunta estilo ICFES",
      "options": ["A) Opción A", "B) Opción B", "C) Opción C", "D) Opción D"],
      "correctAnswer": "A",
      "explanation": "Explicación detallada de por qué esta es la respuesta correcta",
      "topic": "Tema relacionado con la debilidad"
    }
  ],
  "topics": [
    {
      "name": "Nombre del tema a estudiar",
      "description": "Descripción detallada del tema y por qué es importante",
      "level": "Básico|Intermedio|Avanzado",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "webSearchInfo": {
        "searchIntent": "Intención pedagógica de búsqueda (ej: artículo explicativo sobre ecuaciones cuadráticas)",
        "searchKeywords": ["palabra1", "palabra2", "palabra3"],
        "expectedContentTypes": ["artículo explicativo", "guía paso a paso", "contenido académico introductorio"],
        "educationalLevel": "Nivel educativo (ej: secundaria, preparación ICFES)"
      }
    }
  ]
}

═══════════════════════════════════════════════════════════════
📝 ESPECIFICACIONES DETALLADAS
═══════════════════════════════════════════════════════════════

### 1. diagnostic_summary (Máximo 50 palabras)
- Resumen conciso sobre la materia y los temas específicos a mejorar
- Debe mencionar las debilidades principales identificadas
- Ejemplo: "Este plan de estudio se enfoca en mejorar Matemáticas, específicamente en Álgebra y Geometría, donde el estudiante presenta dificultades con ecuaciones cuadráticas y propiedades de triángulos."

### 2. study_plan_summary (100-150 palabras)
- Resumen más detallado del plan de estudio
- Debe explicar la estrategia de mejora
- Debe mencionar los recursos incluidos (videos, ejercicios)

### 3. practice_exercises (EXACTAMENTE 20 ejercicios) - ⚠️ GENERAR PRIMERO ESTOS EJERCICIOS ⚠️
**ESTOS EJERCICIOS SON CRÍTICOS Y DEBEN GENERARSE COMPLETOS. GENERA ESTOS ANTES QUE LOS TOPICS.**

**REQUISITOS CRÍTICOS:**
- **20 ejercicios** - ni más ni menos
- Enfocados DIRECTAMENTE en las debilidades identificadas
- Estilo ICFES Saber 11 (preguntas tipo selección múltiple con contexto)
- Orientados a fortalecer COMPETENCIAS con fallas, NO memorización
- Cada ejercicio debe tener:
  - **question**: Pregunta completa con contexto (si aplica). Si la pregunta incluye contexto, inclúyelo en el mismo campo "question"
  - **options**: Array de EXACTAMENTE 4 opciones como strings. Cada opción DEBE comenzar con su letra seguida de ") " (ejemplo: "A) Texto de la opción")
  - **correctAnswer**: String con la letra de la respuesta correcta (ejemplo: "A", "B", "C", o "D")
  - **explanation**: Explicación detallada de por qué esta es la respuesta correcta
  - **topic**: Tema asociado que debe coincidir con una de las debilidades identificadas

**FORMATO CRÍTICO DE OPCIONES:**
- Las opciones DEBEN comenzar con la letra seguida de ") " (espacio después del paréntesis)
- Ejemplo CORRECTO: ["A) Primera opción", "B) Segunda opción", "C) Tercera opción", "D) Cuarta opción"]
- Ejemplo INCORRECTO: ["Primera opción", "Segunda opción", "Tercera opción", "Cuarta opción"] (sin prefijo)
- El correctAnswer debe ser solo la letra (ejemplo: "A", no "A)" ni "A) Texto")

**Ejemplo de estructura JSON completa para un ejercicio:**
\`\`\`json
{
  "question": "Contexto: [Si aplica]\\n\\nTexto completo de la pregunta estilo ICFES",
  "options": [
    "A) Primera opción de respuesta",
    "B) Segunda opción de respuesta",
    "C) Tercera opción de respuesta",
    "D) Cuarta opción de respuesta"
  ],
  "correctAnswer": "B",
  "explanation": "Explicación detallada de por qué esta es la respuesta correcta, incluyendo el razonamiento paso a paso.",
  "topic": "Tema relacionado con la debilidad identificada"
}
\`\`\`

**IMPORTANTE SOBRE LOS EJERCICIOS:**
- ✅ SIEMPRE incluye EXACTAMENTE 20 ejercicios en el array practice_exercises
- ✅ GENERA ESTOS EJERCICIOS PRIMERO antes de los topics para asegurar que se completen
- ✅ Cada ejercicio DEBE tener todas las propiedades requeridas (question, options, correctAnswer, explanation, topic)
- ✅ Las opciones DEBEN tener el formato "A) Texto", "B) Texto", etc.
- ✅ El correctAnswer DEBE ser solo la letra (A, B, C, o D)
- ✅ Distribuye los ejercicios entre las diferentes debilidades identificadas
- ✅ Los ejercicios deben ser progresivos en dificultad cuando sea apropiado

### 4. topics (Mínimo 3, idealmente 5-8 temas)
**REQUISITOS CRÍTICOS:**
- Cada tema DEBE estar directamente relacionado con las debilidades identificadas
- Los temas deben ser específicos y accionables
- Cada tema debe tener keywords relevantes para buscar videos educativos en YouTube

**Estructura de cada topic:**
- **name**: Nombre claro y específico del tema (ej: "Ecuaciones cuadráticas", "Análisis de textos argumentativos")
- **description**: Descripción detallada del tema, por qué es importante y cómo se relaciona con las debilidades
- **level**: Nivel de dificultad: "Básico", "Intermedio" o "Avanzado"
- **keywords**: Array de 3-5 palabras clave que se usarán para buscar videos educativos en YouTube
  - Las keywords deben ser específicas y relevantes para el tema
  - Ejemplos de keywords buenas: ["ecuaciones cuadráticas", "fórmula general", "factorización", "ICFES matemáticas"]
  - Evita keywords muy genéricas como ["matemáticas", "estudio", "aprender"]
- **webSearchInfo**: Información semántica para buscar recursos web educativos (OBLIGATORIO)
  - **searchIntent**: Intención pedagógica clara de qué tipo de contenido se busca (ej: "artículo explicativo sobre ecuaciones cuadráticas para estudiantes de secundaria")
  - **searchKeywords**: Array de 3-5 palabras clave específicas para buscar recursos web (pueden ser diferentes a las keywords de videos)
  - **expectedContentTypes**: Array de tipos de contenido esperados usando vocabulario educativo estándar:
    - "artículo explicativo"
    - "guía paso a paso"
    - "contenido académico introductorio"
    - "material de práctica"
    - "resumen conceptual"
    - "ejercicios resueltos"
    - "contenido de profundización"
  - **educationalLevel**: Nivel educativo (ej: "secundaria", "preparación ICFES", "nivel básico")

**IMPORTANTE:**
- ✅ Cada topic debe corresponder a una debilidad específica identificada
- ✅ Las keywords deben ser lo suficientemente específicas para encontrar videos relevantes
- ✅ Incluye keywords en español (los videos se buscarán en español)
- ✅ Las keywords pueden incluir términos relacionados con ICFES o preparación para exámenes
- ✅ **webSearchInfo es OBLIGATORIO** - Define QUÉ buscar, no DÓNDE buscar
- ✅ NO incluyas URLs ni referencias a sitios específicos en webSearchInfo



═══════════════════════════════════════════════════════════════
⚠️ RESTRICCIONES CRÍTICAS
═══════════════════════════════════════════════════════════════

🚫 **NO HAGAS:**
- No uses markdown (\`\`\`json) alrededor del JSON
- No agregues texto antes o después del JSON
- No uses menos de 20 ejercicios (debe ser EXACTAMENTE 20)
- No uses más de 50 palabras en diagnostic_summary
- No crees ejercicios de memorización - enfócate en competencias
- **NO incluyas campos video_resources ni study_links** - estos se generarán automáticamente por el sistema
- **NO generes URLs ni enlaces finales en webSearchInfo** - Solo información semántica (palabras clave, intención, tipos de contenido)
- **NO referencies sitios web específicos o dominios** - El backend se encargará de buscar y validar enlaces reales

✅ **SÍ HAZLO:**
- Responde SOLO con JSON válido
- **ESCAPA correctamente todas las comillas dobles dentro de strings usando \\"**
- **ESCAPA correctamente todos los saltos de línea dentro de strings usando \\n**
- **NO uses caracteres especiales sin escapar en texto**
- Crea topics específicos y relevantes para las debilidades identificadas
- Incluye keywords específicas y relevantes para cada topic (3-5 keywords por topic)
- Crea ejercicios que fortalezcan las competencias evaluadas en ICFES
- Incluye explicaciones detalladas en cada ejercicio
- **IMPORTANTE: El sistema buscará videos automáticamente usando las keywords que proporciones**
- Incluye webSearchInfo en cada topic con información clara sobre QUÉ buscar, no DÓNDE buscar
- Usa vocabulario educativo estándar en los tipos de contenido esperados

═══════════════════════════════════════════════════════════════
🎓 CONSIDERACIONES PEDAGÓGICAS
═══════════════════════════════════════════════════════════════

- **Enfoque en competencias**: Los ejercicios deben evaluar comprensión, análisis y aplicación, no solo memorización
- **Progresión lógica**: Organiza los recursos de manera que el estudiante pueda avanzar gradualmente
- **Contexto ICFES**: Todas las preguntas deben reflejar el estilo y formato del examen real
- **Recursos verificables**: Solo incluye videos y enlaces que puedas verificar que existen y son útiles

═══════════════════════════════════════════════════════════════

⚠️ **RECORDATORIO FINAL CRÍTICO - ORDEN DE GENERACIÓN:**
- **IMPORTANTE**: Genera primero "practice_exercises" (los 20 ejercicios) ANTES que "topics"
- DEBES incluir EXACTAMENTE 20 ejercicios en el campo "practice_exercises"
- Los ejercicios SON OBLIGATORIOS y son parte esencial del plan de estudio
- Si el JSON se trunca por límite de tokens, asegúrate de que los ejercicios estén completos (puedes acortar topics si es necesario)
- Cada ejercicio debe tener: question, options (4 opciones con formato "A) Texto"), correctAnswer (solo letra), explanation, y topic

**ORDEN RECOMENDADO EN EL JSON:**
1. student_info
2. diagnostic_summary
3. study_plan_summary  
4. **practice_exercises** ⬅️ GENERA ESTOS PRIMERO
5. topics

**Ahora genera el JSON completo con el plan de estudio personalizado. GENERA PRIMERO LOS 20 EJERCICIOS DE PRÁCTICA antes que los topics para evitar truncamiento.**`;
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
      const result = await geminiClient.generateContent(
        prompt,
        [],
        {
          retries: 3,
          timeout: 600000, // 10 minutos para respuestas largas
        }
      );

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
                  
                  // Mostrar contexto del error
                  const contextStart = Math.max(0, position - 50);
                  const contextEnd = Math.min(jsonString.length, position + 50);
                  const context = jsonString.substring(contextStart, contextEnd);
                  console.log(`   Contexto: "${context}"`);
                  
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
                
                // Guardar la respuesta completa en un log para análisis posterior
                console.error(`\n📋 RESPUESTA COMPLETA DE GEMINI (${result.text.length} caracteres):`);
                console.error(result.text);
                
                throw new Error(`Error parseando respuesta JSON después de múltiples intentos (incluyendo jsonrepair): ${secondError.message}. La respuesta de Gemini puede estar mal formada o truncada. Tamaño: ${result.text.length} caracteres.`);
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
      } else if (parsed.practice_exercises.length !== 20) {
        console.warn(`⚠️ Advertencia: Se esperaban 20 ejercicios, pero se recibieron ${parsed.practice_exercises.length}`);
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

      // Obtener videos desde Firestore (caché) o buscar en YouTube si es necesario
      console.log(`\n📹 Obteniendo videos educativos (Firestore primero, YouTube si es necesario)...`);
      
      // Inicializar video_resources y study_links como arrays vacíos
      parsed.video_resources = [];
      parsed.study_links = [];
      
      if (parsed.topics && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        console.log(`   📚 Procesando ${parsed.topics.length} topic(s) para obtener videos...`);
        
      // Obtener videos para cada topic (desde caché o YouTube)
      // IMPORTANTE: Cada topic debe tener exactamente 7 videos
      const videoPromises = parsed.topics.map(async (topic) => {
        try {
          if (!topic.keywords || !Array.isArray(topic.keywords) || topic.keywords.length === 0) {
            console.warn(`⚠️ Topic "${topic.name}" no tiene keywords, omitiendo búsqueda de videos`);
            return [];
          }
          
          console.log(`   🔍 Procesando videos para topic: "${topic.name}"`);
          console.log(`      Keywords: ${topic.keywords.join(', ')}`);
          
          // Obtener videos para este topic específico (retorna exactamente 7 videos)
          const videos = await this.getVideosForTopic(
            input.studentId,
            input.phase,
            input.subject,
            topic.name,
            topic.keywords
          );
          
          if (videos.length > 0) {
            console.log(`   ✅ Obtenidos ${videos.length} video(s) para topic "${topic.name}" (objetivo: 7)`);
          } else {
            console.warn(`   ⚠️ No se encontraron videos para topic "${topic.name}"`);
          }
          
          // Retornar videos con información del topic para referencia
          return videos.map(video => ({
            ...video,
            topic: topic.name, // Agregar el nombre del topic para referencia
          }));
        } catch (error: any) {
          console.error(`   ❌ Error procesando videos para topic "${topic.name}":`, error.message);
          console.error(`   Stack:`, error.stack);
          return [];
        }
      });
        
        const allVideos = await Promise.all(videoPromises);
        
        // Aplanar array de arrays - NO eliminar duplicados entre topics diferentes
        // Cada topic debe tener sus propios 7 videos, aunque algunos puedan repetirse entre topics
        parsed.video_resources = allVideos.flat();
        
        const totalVideos = parsed.video_resources.length;
        const expectedVideos = parsed.topics.length * 7;
        console.log(`✅ Total de ${totalVideos} video(s) obtenido(s) para el plan de estudio`);
        console.log(`   📊 Esperados: ${expectedVideos} videos (${parsed.topics.length} topics × 7 videos)`);
        if (totalVideos < expectedVideos) {
          console.warn(`   ⚠️ Faltan ${expectedVideos - totalVideos} video(s) (algunos topics no tienen suficientes videos)`);
        }
      } else {
        console.warn('⚠️ No se encontraron topics con keywords. No se buscarán videos.');
      }

      // Obtener enlaces web validados desde Firestore (caché) o buscar nuevos si es necesario
      console.log(`\n🔗 Obteniendo enlaces web educativos (Firestore primero, búsqueda si es necesario)...`);
      
      // Inicializar study_links como array vacío
      parsed.study_links = [];
      
      if (parsed.topics && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        console.log(`   📚 Procesando ${parsed.topics.length} topic(s) para obtener enlaces...`);
        
        // Obtener enlaces para cada topic (desde caché o búsqueda)
        // IMPORTANTE: Cada topic debe tener exactamente 10 enlaces (similar a videos con 7)
        const linkPromises = parsed.topics.map(async (topic) => {
          try {
            if (!topic.webSearchInfo) {
              console.warn(`⚠️ Topic "${topic.name}" no tiene webSearchInfo, omitiendo búsqueda de enlaces`);
              return [];
            }
            
            console.log(`   🔍 Procesando enlaces para topic: "${topic.name}"`);
            console.log(`      Intención: "${topic.webSearchInfo.searchIntent}"`);
            
            // Obtener enlaces para este topic específico (retorna exactamente 10 enlaces)
            const links = await this.getLinksForTopic(
              input.phase,
              input.subject,
              topic.name,
              topic.webSearchInfo
            );
            
            if (links.length > 0) {
              console.log(`   ✅ Obtenidos ${links.length} enlace(s) para topic "${topic.name}" (objetivo: 10)`);
            } else {
              console.warn(`   ⚠️ No se encontraron enlaces para topic "${topic.name}"`);
            }
            
            return links;
          } catch (error: any) {
            console.error(`   ❌ Error procesando enlaces para topic "${topic.name}":`, error.message);
            console.error(`   Stack:`, error.stack);
            return [];
          }
        });
        
        const allLinks = await Promise.all(linkPromises);
        
        // Aplanar array de arrays - NO eliminar duplicados entre topics diferentes
        // Cada topic debe tener sus propios 10 enlaces, aunque algunos puedan repetirse entre topics
        parsed.study_links = allLinks.flat();
        
        const totalLinks = parsed.study_links.length;
        const expectedLinks = parsed.topics.length * 10;
        console.log(`✅ Total de ${totalLinks} enlace(s) obtenido(s) para el plan de estudio`);
        console.log(`   📊 Esperados: ${expectedLinks} enlaces (${parsed.topics.length} topics × 10 enlaces)`);
        if (totalLinks < expectedLinks) {
          console.warn(`   ⚠️ Faltan ${expectedLinks - totalLinks} enlace(s) (algunos topics no tienen suficientes enlaces)`);
        }
      } else {
        console.warn('⚠️ No se encontraron topics con webSearchInfo. No se buscarán enlaces.');
      }

      // 7. Guardar en Firestore
      console.log(`\n💾 Guardando plan de estudio en Firestore...`);
      console.log(`   📊 Resumen antes de guardar:`);
      console.log(`      - Topics: ${parsed.topics?.length || 0}`);
      console.log(`      - Videos: ${parsed.video_resources?.length || 0}`);
      console.log(`      - Enlaces: ${parsed.study_links?.length || 0}`);
      console.log(`      - Ejercicios de práctica: ${parsed.practice_exercises?.length || 0}`);
      
      if (!parsed.practice_exercises || parsed.practice_exercises.length === 0) {
        console.error(`   ❌ ADVERTENCIA: Se está intentando guardar un plan sin ejercicios de práctica`);
        console.error(`   El plan se guardará, pero los estudiantes no podrán realizar ejercicios de práctica`);
      }
      
      await this.saveStudyPlan(input, parsed);

      const processingTime = Date.now() - startTime;
      console.log(`\n✅ Plan de estudio generado exitosamente en ${(processingTime / 1000).toFixed(1)}s`);

      return {
        success: true,
        studyPlan: parsed,
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
      
      // Preparar datos para guardar
      const dataToSave = {
        ...studyPlan,
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
      // Mapear fase a nombre de subcolección (probar múltiples variantes)
      const phaseVariants: Record<string, string[]> = {
        first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
        second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
        third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
      };
      
      const phaseNames = phaseVariants[phase] || [];
      
      // Obtener la base de datos correcta (superate-6c730)
      const studentDb = this.getStudentDatabase();
      
      // Intentar buscar en cada variante de nombre de fase
      for (const phaseName of phaseNames) {
        try {
          const docRef = studentDb
            .collection('AnswerIA')
            .doc(studentId)
            .collection(phaseName)
            .doc(subject);
          
          const docSnap = await docRef.get();
          
          if (docSnap.exists) {
            const data = docSnap.data() as StudyPlanResponse;
            
            // Verificar que los ejercicios existen
            if (!data.practice_exercises || !Array.isArray(data.practice_exercises)) {
              console.warn(`⚠️ Plan de estudio recuperado pero practice_exercises no existe o no es un array`);
              console.warn(`   Estudiante: ${studentId}, Fase: ${phaseName}, Materia: ${subject}`);
              // Inicializar como array vacío para evitar errores en el frontend
              data.practice_exercises = [];
            } else {
              console.log(`✅ Plan recuperado con ${data.practice_exercises.length} ejercicio(s) de práctica`);
            }
            
            return data;
          }
        } catch (error: any) {
          // Continuar con la siguiente variante
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
   * Migra videos de la estructura antigua (por estudiante) a la nueva (por tema)
   * Estructura antigua: YoutubeLinks/{studentId}/{phase}/{subject}/{topic}
   * Estructura nueva: YoutubeLinks/{phase}/{subject}/{topic}/videos
   */
  async migrateVideosToNewStructure(): Promise<{ migrated: number; errors: number }> {
    let migrated = 0;
    let errors = 0;
    
    try {
      const studentDb = this.getStudentDatabase();
      const oldStructureRef = studentDb.collection('YoutubeLinks');
      
      // Obtener todos los estudiantes en la estructura antigua
      const studentsSnapshot = await oldStructureRef.get();
      
      if (studentsSnapshot.empty) {
        console.log('ℹ️ No se encontraron documentos en YoutubeLinks (estructura antigua)');
        console.log('   Esto puede significar:');
        console.log('   1. No hay videos en la estructura antigua (nunca se generaron)');
        console.log('   2. Los videos ya fueron migrados');
        console.log('   3. Los videos están en una estructura diferente');
        
        // Verificar si hay videos en la nueva estructura
        const newStructureRef = studentDb.collection('YoutubeLinks');
        const newStructureSnapshot = await newStructureRef.get();
        
        if (!newStructureSnapshot.empty) {
          console.log(`   ✅ Se encontraron documentos en la nueva estructura (${newStructureSnapshot.docs.length} fases)`);
        }
        
        return { migrated: 0, errors: 0 };
      }
      
      console.log(`📦 Encontrados ${studentsSnapshot.docs.length} estudiante(s) en YoutubeLinks`);
      
      const phaseNames = ['Fase I', 'Fase II', 'Fase III'];
      
      for (const studentDoc of studentsSnapshot.docs) {
        const studentId = studentDoc.id;
        
        for (const phaseName of phaseNames) {
          try {
            const phaseRef = studentDoc.ref.collection(phaseName);
            const subjectsSnapshot = await phaseRef.get();
            
            if (subjectsSnapshot.empty) {
              continue; // No hay materias en esta fase para este estudiante
            }
            
            for (const subjectDoc of subjectsSnapshot.docs) {
              const subject = subjectDoc.id;
              
              // Obtener todos los topics (subcolecciones) de esta materia
              // Estructura antigua: YoutubeLinks/{studentId}/{phase}/{subject}/{topic}/videos/{videoId}
              // Necesitamos listar las subcolecciones, pero Firestore no tiene API directa para esto
              // Usaremos collectionGroup desde la raíz de la base de datos
              const topicsMap = new Map<string, any[]>();
              
              // Obtener todos los videos usando collectionGroup desde la raíz
              // Estructura antigua: YoutubeLinks/{studentId}/{phase}/{subject}/{topic}/videos/{videoId}
              console.log(`   🔍 Buscando videos para estudiante "${studentId}", fase "${phaseName}", materia "${subject}"...`);
              
              const allVideosSnapshot = await studentDb.collectionGroup('videos').get();
              console.log(`   📊 Total de videos encontrados en collectionGroup: ${allVideosSnapshot.docs.length}`);
              
              for (const videoDoc of allVideosSnapshot.docs) {
                // Extraer información del path: YoutubeLinks/{studentId}/{phase}/{subject}/{topic}/videos/{videoId}
                const pathParts = videoDoc.ref.path.split('/');
                
                // Verificar que este video pertenece a este estudiante, fase y materia
                const studentIndex = pathParts.indexOf('YoutubeLinks');
                if (studentIndex === -1 || pathParts[studentIndex + 1] !== studentId) continue;
                
                const phaseIndex = pathParts.indexOf(phaseName);
                if (phaseIndex === -1) continue;
                
                const subjectIndex = pathParts.indexOf(subject);
                if (subjectIndex === -1) continue;
                
                // El topic está después de la materia
                if (subjectIndex + 1 >= pathParts.length) continue;
                const topic = pathParts[subjectIndex + 1];
                
                // Verificar que el siguiente elemento es 'videos'
                if (subjectIndex + 2 >= pathParts.length || pathParts[subjectIndex + 2] !== 'videos') continue;
                
                if (!topicsMap.has(topic)) {
                  topicsMap.set(topic, []);
                }
                
                topicsMap.get(topic)!.push({
                  id: videoDoc.id,
                  data: videoDoc.data(),
                });
              }
              
              // Migrar cada topic
              for (const [topic, videos] of topicsMap.entries()) {
                try {
                  // Verificar si ya existe en la nueva estructura
                  const newTopicRef = studentDb
                    .collection('YoutubeLinks')
                    .doc(phaseName)
                    .collection(subject)
                    .doc(topic)
                    .collection('videos');
                  
                  const existingSnapshot = await newTopicRef.get();
                  
                  if (!existingSnapshot.empty) {
                    console.log(`   ⏭️  Topic "${topic}" ya existe en nueva estructura, omitiendo`);
                    continue;
                  }
                  
                  // Migrar videos
                  const batch = studentDb.batch();
                  videos.forEach((video, index) => {
                    const order = video.data.order || (index + 1);
                    const videoId = `video${String(order).padStart(2, '0')}`;
                    const newVideoRef = newTopicRef.doc(videoId);
                    
                    batch.set(newVideoRef, {
                      title: video.data.title || '',
                      url: video.data.url || '',
                      description: video.data.description || '',
                      channelTitle: video.data.channelTitle || '',
                      order: order,
                      savedAt: video.data.savedAt || new Date(),
                      migratedFrom: `YoutubeLinks/${studentId}/${phaseName}/${subject}/${topic}`,
                      migratedAt: new Date(),
                    }, { merge: true });
                  });
                  
                  await batch.commit();
                  migrated += videos.length;
                  console.log(`   ✅ Migrados ${videos.length} video(s) de "${topic}" (${phaseName}/${subject})`);
                } catch (error: any) {
                  console.error(`   ❌ Error migrando topic "${topic}":`, error.message);
                  errors++;
                }
              }
            }
          } catch (error: any) {
            console.error(`   ❌ Error procesando fase "${phaseName}" del estudiante "${studentId}":`, error.message);
            errors++;
          }
        }
      }
      
      console.log(`\n✅ Migración completada: ${migrated} videos migrados, ${errors} errores`);
      return { migrated, errors };
    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      return { migrated, errors: errors + 1 };
    }
  }

  /**
   * Obtiene videos para un topic específico desde Firestore (caché) o busca en YouTube si es necesario
   * @param studentId - ID del estudiante (ya no se usa en la ruta, pero se mantiene para compatibilidad)
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del topic
   * @param keywords - Keywords para buscar en YouTube si es necesario
   * @returns Array de videos con título, URL, descripción y canal
   */
  private async getVideosForTopic(
    _studentId: string, // Ya no se usa en la ruta, pero se mantiene para compatibilidad
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    keywords: string[]
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
  }>> {
    const TARGET_VIDEOS_IN_DB = 20; // Número objetivo de videos almacenados en DB (para tener variedad)
    const VIDEOS_TO_RETURN = 7; // Número de videos a retornar por topic débil
    
    try {
      console.log(`   📋 Iniciando búsqueda de videos para topic: "${topic}"`);
      console.log(`      Fase: ${phase}, Materia: ${subject}`);
      
      // 1. Consultar Firestore primero (nueva estructura: por tema, no por estudiante)
      const cachedVideos = await this.getCachedVideos(phase, subject, topic);
      
      console.log(`   📦 Videos en caché para "${topic}": ${cachedVideos.length}`);
      
      // 2. Si hay ≥20 videos en caché, retornar solo 7 (para tener variedad en la DB)
      if (cachedVideos.length >= TARGET_VIDEOS_IN_DB) {
        console.log(`   ✅ Usando ${VIDEOS_TO_RETURN} videos desde caché (hay ${cachedVideos.length} disponibles, no se consulta YouTube)`);
        // Retornar 7 videos aleatorios o los primeros 7 ordenados
        return cachedVideos.slice(0, VIDEOS_TO_RETURN);
      }
      
      // 3. Si hay <20 videos, calcular cuántos faltan y buscar en YouTube
      const videosNeeded = TARGET_VIDEOS_IN_DB - cachedVideos.length;
      console.log(`   🔍 Faltan ${videosNeeded} video(s) para completar ${TARGET_VIDEOS_IN_DB} en DB, buscando en YouTube...`);
      
      // 4. Buscar videos nuevos en YouTube (más de los necesarios para filtrar duplicados)
      const newVideos = await this.searchYouTubeVideos(keywords, videosNeeded + 5);
      
      if (newVideos.length === 0) {
        console.warn(`   ⚠️ No se encontraron videos nuevos en YouTube para "${topic}"`);
        // Retornar los que hay en caché (hasta 7)
        return cachedVideos.slice(0, VIDEOS_TO_RETURN);
      }
      
      // 5. Filtrar videos duplicados (comparar URLs)
      const existingUrls = new Set(cachedVideos.map(v => v.url));
      const uniqueNewVideos = newVideos.filter(v => !existingUrls.has(v.url));
      
      console.log(`   ✅ Encontrados ${uniqueNewVideos.length} video(s) nuevo(s) (${newVideos.length - uniqueNewVideos.length} duplicado(s) filtrado(s))`);
      
      // 6. Guardar videos nuevos en Firestore (nueva estructura: por tema, no por estudiante)
      if (uniqueNewVideos.length > 0) {
        console.log(`   💾 Guardando ${uniqueNewVideos.length} video(s) en Firestore...`);
        await this.saveVideosToCache(phase, subject, topic, uniqueNewVideos, cachedVideos.length);
        console.log(`   ✅ Videos guardados exitosamente`);
      }
      
      // 7. Obtener todos los videos desde Firestore (incluyendo los nuevos)
      const allVideos = await this.getCachedVideos(phase, subject, topic);
      
      // 8. Retornar exactamente 7 videos (o menos si no hay suficientes)
      const videosToReturn = allVideos.slice(0, VIDEOS_TO_RETURN);
      console.log(`   📤 Retornando ${videosToReturn.length} video(s) para el estudiante (de ${allVideos.length} disponibles en DB)`);
      return videosToReturn;
    } catch (error: any) {
      console.error(`❌ Error obteniendo videos para topic "${topic}":`, error.message);
      console.error(`   Stack:`, error.stack);
      return [];
    }
  }

  /**
   * Obtiene videos desde Firestore (caché)
   * Nueva estructura: YoutubeLinks/{phase}/{subject}/{topic}
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del topic
   * @returns Array de videos ordenados por campo 'order'
   */
  private async getCachedVideos(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
  }>> {
    try {
      // Mapear fase a nombre de subcolección
      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };
      
      const phaseName = phaseMap[phase];
      
      // Obtener la base de datos correcta (superate-6c730)
      const studentDb = this.getStudentDatabase();
      
      // Nueva estructura: YoutubeLinks/{phaseName}/{subject}/{topicId}/videos
      // Normalizar nombre del tema para usar como ID del documento
      const topicId = this.normalizeTopicId(topic);
      
      const topicRef = studentDb
        .collection('YoutubeLinks')
        .doc(phaseName)
        .collection(subject)
        .doc(topicId)
        .collection('videos');
      
      // Obtener todos los videos ordenados por 'order'
      const snapshot = await topicRef.orderBy('order', 'asc').get();
      
      if (snapshot.empty) {
        return [];
      }
      
      const videos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          title: data.title || '',
          url: data.url || '',
          description: data.description || '',
          channelTitle: data.channelTitle || '',
        };
      });
      
      return videos;
    } catch (error: any) {
      console.error(`❌ Error obteniendo videos desde caché:`, error.message);
      return [];
    }
  }

  /**
   * Guarda videos en Firestore (caché)
   * Nueva estructura: YoutubeLinks/{phase}/{subject}/{topic}/videos
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del topic
   * @param videos - Array de videos a guardar
   * @param startOrder - Número de orden inicial (para continuar la secuencia)
   */
  private async saveVideosToCache(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    videos: Array<{
      title: string;
      url: string;
      description: string;
      channelTitle: string;
    }>,
    startOrder: number = 0
  ): Promise<void> {
    try {
      // Mapear fase a nombre de subcolección
      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };
      
      const phaseName = phaseMap[phase];
      
      // Obtener la base de datos correcta (superate-6c730)
      const studentDb = this.getStudentDatabase();
      
      // Nueva estructura: YoutubeLinks/{phaseName}/{subject}/{topicId}/videos
      // Normalizar nombre del tema para usar como ID del documento
      const topicId = this.normalizeTopicId(topic);
      
      const topicRef = studentDb
        .collection('YoutubeLinks')
        .doc(phaseName)
        .collection(subject)
        .doc(topicId)
        .collection('videos');
      
      // Guardar cada video con formato video01, video02, etc. y campo order
      const batch = studentDb.batch();
      
      videos.forEach((video, index) => {
        const order = startOrder + index + 1;
        const videoId = `video${String(order).padStart(2, '0')}`;
        
        const videoRef = topicRef.doc(videoId);
        
        batch.set(videoRef, {
          title: video.title,
          url: video.url,
          description: video.description,
          channelTitle: video.channelTitle,
          order: order,
          savedAt: new Date(),
          topic: topic, // Guardar el nombre original del tema para referencia
        }, { merge: true });
      });
      
      await batch.commit();
      
      console.log(`   💾 Guardados ${videos.length} video(s) en caché para topic "${topic}" (${phaseName}/${subject})`);
    } catch (error: any) {
      console.error(`❌ Error guardando videos en caché:`, error.message);
      throw error;
    }
  }

  /**
   * Busca videos educativos en YouTube usando keywords
   * @param keywords - Array de keywords para buscar
   * @param maxResults - Número máximo de videos a retornar (default: 3)
   * @returns Array de videos encontrados con título, URL, descripción y canal
   */
  private async searchYouTubeVideos(
    keywords: string[],
    maxResults: number = 3
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
  }>> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
      console.warn('⚠️ YOUTUBE_API_KEY no está configurada. No se pueden buscar videos.');
      return [];
    }

    try {
      // Construir query de búsqueda combinando keywords
      const query = keywords.join(' ');
      
      // Construir URL de búsqueda
      // Usamos type=video para solo videos, videoEmbeddable=true para videos públicos
      // y order=relevance para obtener los más relevantes
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet` +
        `&q=${encodeURIComponent(query + ' educación ICFES')}` +
        `&type=video` +
        `&videoEmbeddable=true` +
        `&maxResults=${maxResults}` +
        `&order=relevance` +
        `&key=${YOUTUBE_API_KEY}`;

      console.log(`🔍 Buscando videos en YouTube con keywords: ${keywords.join(', ')}`);
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        console.warn(`⚠️ Error en API de YouTube (${response.status}): ${response.statusText}`);
        return [];
      }

      const data = await response.json() as {
        items?: Array<{
          id: {
            videoId: string;
          };
          snippet: {
            title: string;
            description: string;
            channelTitle: string;
            thumbnails?: {
              default?: { url: string };
            };
          };
        }>;
      };

      if (!data.items || data.items.length === 0) {
        console.warn(`⚠️ No se encontraron videos para keywords: ${keywords.join(', ')}`);
        return [];
      }

      // Mapear resultados a formato esperado
      const videos = data.items.map(item => ({
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description.substring(0, 200) + (item.snippet.description.length > 200 ? '...' : ''),
        channelTitle: item.snippet.channelTitle,
      }));

      console.log(`✅ Encontrados ${videos.length} video(s) para keywords: ${keywords.join(', ')}`);
      return videos;
    } catch (error: any) {
      console.error(`❌ Error buscando videos en YouTube:`, error.message);
      return [];
    }
  }

  /**
   * Lista de dominios educativos confiables para buscar recursos
   */
  private readonly TRUSTED_EDUCATIONAL_DOMAINS = [
    'edu.co', // Dominios .edu.co (Colombia)
    'edu.mx', // Dominios .edu.mx (México)
    'edu.ar', // Dominios .edu.ar (Argentina)
    'edu.pe', // Dominios .edu.pe (Perú)
    'edu.ec', // Dominios .edu.ec (Ecuador)
    'khanacademy.org',
    'coursera.org',
    'edx.org',
    'icfes.gov.co',
    'mineducacion.gov.co',
    'colombiaaprende.edu.co',
    'santillana.com.co',
    'sm.com.co',
    'norma.com.co',
    'wikipedia.org',
    'es.khanacademy.org',
    'es.wikipedia.org',
  ];

  /**
   * Valida que un enlace responda correctamente (HTTP válido)
   * @param url - URL a validar
   * @returns true si el enlace es válido, false en caso contrario
   */
  private async validateLink(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      // Intentar primero con HEAD (más eficiente)
      try {
        const response = await fetch(url, {
          method: 'HEAD', // Solo HEAD para verificar sin descargar contenido
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SuperateBot/1.0; +https://superate.edu.co)',
          },
        });
        
        clearTimeout(timeoutId);
        
        // Considerar válido si el status es 200-399 (redirecciones también son válidas)
        const isValid = response.status >= 200 && response.status < 400;
        
        if (!isValid) {
          console.log(`   ⚠️ Enlace inválido (${response.status}): ${url}`);
        }
        
        return isValid;
      } catch (headError: any) {
        // Si HEAD falla (algunos servidores lo bloquean), intentar con GET
        clearTimeout(timeoutId);
        
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), 10000);
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: getController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SuperateBot/1.0; +https://superate.edu.co)',
            },
          });
          
          clearTimeout(getTimeoutId);
          
          const isValid = response.status >= 200 && response.status < 400;
          
          if (!isValid) {
            console.log(`   ⚠️ Enlace inválido (${response.status}): ${url}`);
          }
          
          return isValid;
        } catch (getError: any) {
          clearTimeout(getTimeoutId);
          console.log(`   ⚠️ Error validando enlace ${url} (HEAD y GET fallaron): ${getError.message}`);
          return false;
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️ Error validando enlace ${url}: ${error.message}`);
      return false;
    }
  }

  /**
   * Busca enlaces educativos usando Google Custom Search API
   * Solo busca en dominios educativos confiables
   * @param webSearchInfo - Información semántica de búsqueda del tema
   * @param maxResults - Número máximo de resultados a retornar
   * @returns Array de enlaces encontrados y validados
   */
  private async searchEducationalLinks(
    webSearchInfo: TopicWebSearchInfo,
    maxResults: number = 10
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    console.log(`\n🔍 [searchEducationalLinks] Iniciando búsqueda de enlaces educativos`);
    console.log(`   Intención: "${webSearchInfo.searchIntent}"`);
    console.log(`   Keywords: ${webSearchInfo.searchKeywords.join(', ')}`);
    console.log(`   Max resultados solicitados: ${maxResults}`);
    
    // PASO 1: Verificar API Keys
    // Leer desde process.env (funciona tanto en desarrollo con .env como en producción con secrets)
    const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
    
    console.log(`   🔑 Verificando API Keys...`);
    console.log(`      GOOGLE_CSE_API_KEY: ${GOOGLE_CSE_API_KEY ? '✅ Configurada' : '❌ NO configurada'}`);
    console.log(`      GOOGLE_CSE_ID: ${GOOGLE_CSE_ID ? '✅ Configurada' : '❌ NO configurada'}`);
    
    if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
      console.error('❌ [searchEducationalLinks] GOOGLE_CSE_API_KEY o GOOGLE_CSE_ID no están configuradas.');
      console.error('   Para configurar:');
      console.error('   1. Ve a Google Cloud Console');
      console.error('   2. Crea un Custom Search Engine en https://programmablesearchengine.google.com/');
      console.error('   3. Obtén el API Key desde Google Cloud Console > APIs & Services > Credentials');
      console.error('   4. Configura las variables de entorno en Firebase Functions');
      return [];
    }

    try {
      // PASO 2: Construir query de búsqueda
      // Estrategia: Buscar sin filtro de sitio primero, luego filtrar por dominio
      // Esto nos da más resultados para filtrar
      const searchTerms = `${webSearchInfo.searchIntent} ${webSearchInfo.searchKeywords.join(' ')}`;
      const query = searchTerms;
      
      console.log(`   📝 Query construida: "${query}"`);
      
      // PASO 3: Construir URL de búsqueda
      const numResults = Math.min(maxResults * 3, 10); // Buscar más para tener opciones al validar
      const searchUrl = `https://www.googleapis.com/customsearch/v1?` +
        `key=${GOOGLE_CSE_API_KEY}` +
        `&cx=${GOOGLE_CSE_ID}` +
        `&q=${encodeURIComponent(query)}` +
        `&lr=lang_es` + // Idioma español
        `&num=${numResults}` + // Número de resultados
        `&safe=active`; // Búsqueda segura

      console.log(`   🌐 URL de búsqueda: ${searchUrl.replace(GOOGLE_CSE_API_KEY, '***API_KEY***')}`);
      console.log(`   📊 Solicitando ${numResults} resultados...`);
      
      // PASO 4: Realizar búsqueda
      const response = await fetch(searchUrl);
      
      console.log(`   📡 Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [searchEducationalLinks] Error en Google Custom Search API`);
        console.error(`   Status: ${response.status} ${response.statusText}`);
        console.error(`   Respuesta: ${errorText.substring(0, 500)}`);
        
        // Intentar parsear error JSON si es posible
        try {
          const errorData = JSON.parse(errorText);
          console.error(`   Error detallado:`, JSON.stringify(errorData, null, 2));
        } catch {
          // Si no es JSON, ya mostramos el texto
        }
        
        return [];
      }

      // PASO 5: Parsear respuesta
      const data = await response.json() as {
        items?: Array<{
          title: string;
          link: string;
          snippet: string;
          displayLink: string;
        }>;
        searchInformation?: {
          totalResults: string;
        };
        error?: {
          code: number;
          message: string;
        };
      };

      // Verificar si hay error en la respuesta
      if (data.error) {
        console.error(`❌ [searchEducationalLinks] Error en respuesta de Google Custom Search`);
        console.error(`   Código: ${data.error.code}`);
        console.error(`   Mensaje: ${data.error.message}`);
        return [];
      }

      if (!data.items || data.items.length === 0) {
        console.warn(`⚠️ [searchEducationalLinks] No se encontraron enlaces para: "${query}"`);
        if (data.searchInformation) {
          console.warn(`   Total de resultados disponibles: ${data.searchInformation.totalResults}`);
        }
        return [];
      }

      console.log(`   ✅ Total de resultados de búsqueda: ${data.items.length}`);
      if (data.searchInformation) {
        console.log(`   📊 Total disponible en Google: ${data.searchInformation.totalResults}`);
      }
      
      // PASO 6: Filtrar solo enlaces de dominios confiables
      console.log(`   🔍 Filtrando por dominios confiables...`);
      console.log(`   📋 Dominios confiables configurados (${this.TRUSTED_EDUCATIONAL_DOMAINS.length}):`);
      this.TRUSTED_EDUCATIONAL_DOMAINS.slice(0, 10).forEach((domain, idx) => {
        console.log(`      ${idx + 1}. ${domain}`);
      });
      if (this.TRUSTED_EDUCATIONAL_DOMAINS.length > 10) {
        console.log(`      ... y ${this.TRUSTED_EDUCATIONAL_DOMAINS.length - 10} más`);
      }
      
      const trustedLinks = data.items.filter(item => {
        try {
          const url = new URL(item.link);
          const hostname = url.hostname.toLowerCase();
          
          // Verificar si el hostname coincide con algún dominio confiable
          const isTrusted = this.TRUSTED_EDUCATIONAL_DOMAINS.some(trustedDomain => {
            const trustedDomainLower = trustedDomain.toLowerCase();
            
            // 1. Coincidencia exacta
            if (hostname === trustedDomainLower) {
              return true;
            }
            
            // 2. Verificar si es un subdominio del dominio confiable
            // Ejemplo: es.khanacademy.org debe coincidir con khanacademy.org
            if (hostname.endsWith('.' + trustedDomainLower)) {
              return true;
            }
            
            // 3. Para dominios de segundo nivel como .edu.co, verificar si termina con el dominio
            // Ejemplo: math.colombiaaprende.edu.co debe coincidir con colombiaaprende.edu.co
            // Esto ya está cubierto por el caso 2, pero lo dejamos explícito
            
            return false;
          });
          
          if (!isTrusted) {
            console.log(`   ⚠️ Enlace descartado (dominio no confiable): ${hostname} de ${item.link}`);
          }
          
          return isTrusted;
        } catch (error) {
          // Si no se puede parsear la URL, descartar
          console.log(`   ⚠️ Error parseando URL: ${item.link}`, error);
          return false;
        }
      });

      console.log(`   ✅ Enlaces en dominios confiables: ${trustedLinks.length} de ${data.items.length}`);
      
      if (trustedLinks.length === 0) {
        console.warn(`⚠️ [searchEducationalLinks] No se encontraron enlaces en dominios confiables`);
        console.warn(`   Query: "${query}"`);
        
        // Mostrar dominios encontrados
        const foundDomains = new Set<string>();
        data.items.forEach(item => {
          try {
            const hostname = new URL(item.link).hostname;
            foundDomains.add(hostname);
          } catch {
            // Ignorar URLs inválidas
          }
        });
        
        console.warn(`   📋 Dominios encontrados en la búsqueda (${foundDomains.size} únicos):`);
        Array.from(foundDomains).slice(0, 10).forEach((domain, idx) => {
          console.warn(`      ${idx + 1}. ${domain}`);
        });
        if (foundDomains.size > 10) {
          console.warn(`      ... y ${foundDomains.size - 10} más`);
        }
        
        console.warn(`   💡 Sugerencia: Verifica que los dominios encontrados coincidan con los configurados`);
        console.warn(`   💡 O agrega más dominios a TRUSTED_EDUCATIONAL_DOMAINS si es necesario`);
        return [];
      }

      // PASO 7: Validar cada enlace (verificar que responda correctamente)
      console.log(`   🔍 Validando ${trustedLinks.length} enlace(s) encontrado(s)...`);
      console.log(`   ⏱️  Esto puede tardar varios segundos (validación HTTP)...`);
      const validatedLinks: Array<{
        title: string;
        url: string;
        description: string;
      }> = [];

      let validatedCount = 0;
      let invalidCount = 0;
      
      for (let i = 0; i < Math.min(trustedLinks.length, maxResults * 2); i++) {
        const item = trustedLinks[i];
        console.log(`   🔗 [${i + 1}/${Math.min(trustedLinks.length, maxResults * 2)}] Validando: ${item.link.substring(0, 60)}...`);
        
        const isValid = await this.validateLink(item.link);
        
        if (isValid) {
          validatedCount++;
          validatedLinks.push({
            title: item.title,
            url: item.link,
            description: item.snippet || webSearchInfo.searchIntent,
          });
          
          console.log(`      ✅ Válido (${validatedCount}/${maxResults})`);
          
          // Si ya tenemos suficientes enlaces validados, detener
          if (validatedLinks.length >= maxResults) {
            console.log(`   🎯 Objetivo alcanzado: ${maxResults} enlaces válidos`);
            break;
          }
        } else {
          invalidCount++;
          console.log(`      ❌ Inválido (${invalidCount} inválidos hasta ahora)`);
        }
        
        // Pequeña pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n✅ [searchEducationalLinks] Resumen de validación:`);
      console.log(`   ✅ Enlaces válidos: ${validatedLinks.length}`);
      console.log(`   ❌ Enlaces inválidos: ${invalidCount}`);
      console.log(`   📊 Total procesados: ${validatedCount + invalidCount}`);
      console.log(`   🎯 Objetivo: ${maxResults} enlaces`);
      
      return validatedLinks;
    } catch (error: any) {
      console.error(`❌ Error buscando enlaces educativos:`, error.message);
      return [];
    }
  }

  /**
   * Obtiene enlaces web para un topic específico desde Firestore (caché) o busca nuevos si es necesario
   * Similar a getVideosForTopic() - garantiza escritura en Firestore
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del topic
   * @param webSearchInfo - Información semántica de búsqueda
   * @returns Array de enlaces validados (siempre desde Firestore)
   */
  private async getLinksForTopic(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    webSearchInfo: TopicWebSearchInfo
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    const TARGET_LINKS_IN_DB = 50; // Número objetivo de enlaces almacenados en DB por tema
    const LINKS_TO_RETURN = 10; // Número de enlaces a retornar por topic
    
    try {
      console.log(`   📋 Iniciando búsqueda de enlaces web para topic: "${topic}"`);
      console.log(`      Fase: ${phase}, Materia: ${subject}`);
      console.log(`      Intención: "${webSearchInfo.searchIntent}"`);
      
      // 1. Consultar Firestore primero (nueva estructura: por tema, no por estudiante)
      const cachedLinks = await this.getCachedLinks(phase, subject, topic);
      
      console.log(`   📦 Enlaces en caché para "${topic}": ${cachedLinks.length}`);
      
      // 2. Si hay ≥50 enlaces en caché, retornar solo 10 (para tener variedad en la DB)
      if (cachedLinks.length >= TARGET_LINKS_IN_DB) {
        console.log(`   ✅ Usando ${LINKS_TO_RETURN} enlace(s) desde caché (hay ${cachedLinks.length} disponibles, no se consulta búsqueda externa)`);
        // Retornar 10 enlaces ordenados
        return cachedLinks.slice(0, LINKS_TO_RETURN);
      }
      
      // 3. Si hay <50 enlaces, calcular cuántos faltan y buscar nuevos
      const linksNeeded = TARGET_LINKS_IN_DB - cachedLinks.length;
      console.log(`   🔍 Faltan ${linksNeeded} enlace(s) para completar ${TARGET_LINKS_IN_DB} en DB, buscando...`);
      
      // 4. Buscar enlaces nuevos (más de los necesarios para tener opciones al validar)
      const newLinks = await this.searchEducationalLinks(webSearchInfo, linksNeeded + 10);
      
      if (newLinks.length === 0) {
        console.warn(`   ⚠️ No se encontraron enlaces nuevos para "${topic}"`);
        // Retornar los que hay en caché (hasta 10)
        return cachedLinks.slice(0, LINKS_TO_RETURN);
      }
      
      // 5. Filtrar enlaces duplicados (comparar URLs)
      const existingUrls = new Set(cachedLinks.map(l => l.url));
      const uniqueNewLinks = newLinks.filter(l => !existingUrls.has(l.url));
      
      console.log(`   ✅ Encontrados ${uniqueNewLinks.length} enlace(s) nuevo(s) (${newLinks.length - uniqueNewLinks.length} duplicado(s) filtrado(s))`);
      
      // 6. Guardar enlaces nuevos en Firestore (nueva estructura: por tema, no por estudiante)
      if (uniqueNewLinks.length > 0) {
        console.log(`   💾 Guardando ${uniqueNewLinks.length} enlace(s) en Firestore...`);
        await this.saveLinksToCache(phase, subject, topic, uniqueNewLinks, cachedLinks.length);
        console.log(`   ✅ Enlaces guardados exitosamente`);
      }
      
      // 7. Obtener todos los enlaces desde Firestore (incluyendo los nuevos)
      const allLinks = await this.getCachedLinks(phase, subject, topic);
      
      // 8. Retornar exactamente 10 enlaces (o menos si no hay suficientes)
      const linksToReturn = allLinks.slice(0, LINKS_TO_RETURN);
      console.log(`   📤 Retornando ${linksToReturn.length} enlace(s) para el estudiante (de ${allLinks.length} disponibles en DB)`);
      return linksToReturn;
    } catch (error: any) {
      console.error(`❌ Error obteniendo enlaces para topic "${topic}":`, error.message);
      console.error(`   Stack:`, error.stack);
      return [];
    }
  }

  /**
   * Genera y obtiene enlaces web educativos para un tema específico
   * Función pública independiente que garantiza escritura en Firestore
   * @deprecated Usar getLinksForTopic() directamente desde generateStudyPlan
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del tema
   * @param webSearchInfo - Información semántica de búsqueda
   * @returns Array de enlaces validados (siempre desde Firestore)
   */
  async generateWebLinksForTopic(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    webSearchInfo: TopicWebSearchInfo
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    // Delegar a la función privada que sigue el mismo patrón que getVideosForTopic
    return this.getLinksForTopic(phase, subject, topic, webSearchInfo);
  }


  /**
   * Obtiene enlaces desde Firestore (caché)
   * Estructura: WebLinks/{phase}/{subject}/{topic}/link01, link02, ..., link50
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del tema
   * @returns Array de enlaces ordenados por campo 'order' (link01 a link50)
   */
  private async getCachedLinks(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
  }>> {
    try {
      // Mapear fase a nombre de subcolección
      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };
      
      const phaseName = phaseMap[phase];
      
      // Obtener la base de datos correcta (superate-6c730)
      const studentDb = this.getStudentDatabase();
      
      // Normalizar nombre del tema para usar como ID del documento
      const topicId = this.normalizeTopicId(topic);
      
      // Estructura: WebLinks/{phaseName}/{subject}/{topicId}
      // Los enlaces se almacenan directamente como documentos: link01, link02, ..., link50
      const topicRef = studentDb
        .collection('WebLinks')
        .doc(phaseName)
        .collection(subject)
        .doc(topicId);
      
      // Obtener todos los documentos que empiezan con "link" (link01, link02, etc.)
      // Usamos collectionGroup no es necesario aquí, podemos obtener el documento y sus subcolecciones
      // Pero como los enlaces están en el mismo nivel, necesitamos listar los documentos
      // Firestore no permite listar documentos directamente, así que usamos una subcolección
      // Cambiamos la estructura a: WebLinks/{phaseName}/{subject}/{topicId}/links/{linkId}
      const linksRef = topicRef.collection('links');
      
      // Obtener todos los enlaces ordenados por 'order'
      const snapshot = await linksRef.orderBy('order', 'asc').get();
      
      if (snapshot.empty) {
        return [];
      }
      
      const links = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          title: data.title || '',
          url: data.url || '',
          description: data.description || '',
        };
      });
      
      return links;
    } catch (error: any) {
      console.error(`❌ Error obteniendo enlaces desde caché:`, error.message);
      return [];
    }
  }

  /**
   * Guarda enlaces en Firestore (caché)
   * Estructura: WebLinks/{phase}/{subject}/{topic}/links/link01, link02, ..., link50
   * @param phase - Fase del estudiante
   * @param subject - Materia
   * @param topic - Nombre del tema
   * @param links - Array de enlaces a guardar
   * @param startOrder - Número de orden inicial (para continuar la secuencia)
   */
  private async saveLinksToCache(
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    links: Array<{
      title: string;
      url: string;
      description: string;
    }>,
    startOrder: number = 0
  ): Promise<void> {
    try {
      // Mapear fase a nombre de subcolección
      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };
      
      const phaseName = phaseMap[phase];
      
      // Obtener la base de datos correcta (superate-6c730)
      const studentDb = this.getStudentDatabase();
      
      // Normalizar nombre del tema para usar como ID del documento
      const topicId = this.normalizeTopicId(topic);
      
      // Estructura: WebLinks/{phaseName}/{subject}/{topicId}/links
      const topicRef = studentDb
        .collection('WebLinks')
        .doc(phaseName)
        .collection(subject)
        .doc(topicId)
        .collection('links');
      
      // Guardar cada enlace con formato link01, link02, etc. y campo order
      // Máximo 50 enlaces por tema (link01 a link50)
      const batch = studentDb.batch();
      
      links.forEach((link, index) => {
        const order = startOrder + index + 1;
        
        // Limitar a 50 enlaces máximo
        if (order > 50) {
          console.warn(`   ⚠️ Se alcanzó el límite de 50 enlaces para tema "${topic}", omitiendo enlace adicional`);
          return;
        }
        
        const linkId = `link${String(order).padStart(2, '0')}`;
        
        const linkRef = topicRef.doc(linkId);
        
        batch.set(linkRef, {
          title: link.title,
          url: link.url,
          description: link.description,
          order: order,
          savedAt: new Date(),
          topic: topic, // Guardar el nombre original del tema para referencia
        }, { merge: true });
      });
      
      await batch.commit();
      
      console.log(`   💾 Guardados ${links.length} enlace(s) en caché para tema "${topic}" (${phaseName}/${subject})`);
    } catch (error: any) {
      console.error(`❌ Error guardando enlaces en caché:`, error.message);
      throw error;
    }
  }

  /**
   * Normaliza el nombre de un tema para usarlo como ID de documento en Firestore
   * @param topic - Nombre del tema
   * @returns ID normalizado
   */
  private normalizeTopicId(topic: string): string {
    // Convertir a formato URL-safe y limitar longitud
    return topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9áéíóúñü]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

}

// Exportar instancia singleton
export const studyPlanService = new StudyPlanService();

export default studyPlanService;
