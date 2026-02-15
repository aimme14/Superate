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
import {
  getCanonicalTopicsWithWeakness,
  getGradeNameForAdminPath,
  getSubjectConfig,
  getTopicCode,
  mapToCanonicalTopic,
  MAX_VIDEOS_PER_TOPIC,
  MAX_EXERCISES_PER_TOPIC,
  VIDEOS_PER_TOPIC,
} from '../config/subjects.config';
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

/**
 * Información semántica para búsqueda de videos en YouTube
 * Generada por Gemini antes de realizar la búsqueda en YouTube API
 * Gemini NO genera enlaces ni IDs de video, solo criterios pedagógicos de búsqueda
 */
export interface YouTubeSearchSemanticInfo {
  searchIntent: string; // Intención pedagógica del video (qué debe aprender el estudiante)
  searchKeywords: string[]; // Lista de 5 a 8 palabras clave optimizadas para buscar videos educativos en YouTube
  academicLevel: string; // Nivel académico objetivo: "básico", "medio", "avanzado"
  expectedContentType: string; // Tipo de explicación esperada: "conceptual", "paso a paso", "con ejemplos", "ejercicios resueltos"
  competenceToStrengthen: string; // Competencia a fortalecer: "interpretación", "formulación", "argumentación"
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
   * Obtiene keywords para un topic canónico combinando las de los topics de Gemini que mapean a él.
   */
  private getKeywordsForCanonicalTopic(
    canonicalTopic: string,
    geminiTopics: Array<{ name: string; keywords?: string[] }>,
    subject: string
  ): string[] {
    const keywordsSet = new Set<string>();
    for (const gt of geminiTopics) {
      const mapped = mapToCanonicalTopic(subject, gt.name);
      if (mapped === canonicalTopic && gt.keywords?.length) {
        gt.keywords.forEach((k) => keywordsSet.add(k));
      }
    }
    if (keywordsSet.size > 0) {
      return Array.from(keywordsSet);
    }
    // Fallback: para Inglés usar keywords cortas por tema; para otras materias frase + educación ICFES
    if (this.isEnglishSubject(subject) && StudyPlanService.ENGLISH_FALLBACK_KEYWORDS[canonicalTopic]) {
      return StudyPlanService.ENGLISH_FALLBACK_KEYWORDS[canonicalTopic];
    }
    const searchTopic = this.getDescriptiveSearchTopic(subject, canonicalTopic);
    return [searchTopic, subject, 'educación ICFES'];
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
   * Frases cortas para búsqueda (YouTube/enlaces) en Inglés.
   * Parte 1 = avisos públicos / mensajes funcionales (ICFES), no publicitarios.
   */
  private static readonly ENGLISH_SEARCH_TOPIC_NAMES: Record<string, string> = {
    'Parte 1': 'Avisos y mensajes en inglés, vocabulario cotidiano',
    'Parte 2': 'Vocabulario inglés, asociación de palabras',
    'Parte 3': 'Diálogos inglés, expresiones cotidianas',
    'Parte 4': 'Comprensión lectora y gramática en contexto inglés',
    'Parte 5': 'Ideas principales, vocabulario en contexto inglés',
    'Parte 6': 'Comprensión lectora crítica, propósito del autor inglés',
    'Parte 7': 'Gramática inglés, preposiciones y conectores',
  };

  /**
   * Fallback de keywords por tema para Inglés cuando Gemini no devuelve keywords.
   * Términos genéricos por tema para encontrar videos útiles de CUALQUIER canal (no solo los recomendados).
   */
  private static readonly ENGLISH_FALLBACK_KEYWORDS: Record<string, string[]> = {
    'Parte 1': ['avisos públicos inglés', 'mensajes cortos inglés', 'vocabulario cotidiano', 'aprender inglés español', 'ICFES inglés'],
    'Parte 2': ['vocabulario inglés', 'asociación de palabras', 'comprensión léxica', 'aprender inglés español', 'ICFES inglés'],
    'Parte 3': ['diálogos inglés', 'expresiones cotidianas', 'conversación inglés', 'aprender inglés español', 'ICFES inglés'],
    'Parte 4': ['comprensión lectora inglés', 'gramática en contexto', 'lectura inglés', 'aprender inglés español', 'ICFES inglés'],
    'Parte 5': ['ideas principales texto', 'vocabulario en contexto inglés', 'comprensión de lectura', 'aprender inglés español', 'ICFES inglés'],
    'Parte 6': ['comprensión lectora crítica', 'propósito del autor', 'interpretación textos inglés', 'aprender inglés español', 'ICFES inglés'],
    'Parte 7': ['gramática inglés', 'preposiciones conectores', 'ejercicios gramática inglés', 'aprender inglés español', 'ICFES inglés'],
  };

  /**
   * Devuelve el nombre a usar para búsqueda (videos y enlaces).
   * Para Inglés usa nombres descriptivos en lugar de "Parte 1", "Parte 2", etc.
   */
  private getDescriptiveSearchTopic(subject: string, canonicalTopic: string): string {
    if (this.isEnglishSubject(subject) && StudyPlanService.ENGLISH_SEARCH_TOPIC_NAMES[canonicalTopic]) {
      return StudyPlanService.ENGLISH_SEARCH_TOPIC_NAMES[canonicalTopic];
    }
    return canonicalTopic;
  }

  /**
   * Transforma los nombres técnicos de temas de inglés a nombres descriptivos
   * para que aparezcan de forma más amigable en el prompt
   */
  private transformEnglishTopicName(topicName: string): string {
    const topicMap: Record<string, string> = {
      'Parte 1': 'Comprensión de avisos públicos, Interpretación de mensajes funcionales, Vocabulario cotidiano, Nombre recomendado: Comprensión de avisos públicos, Vocabulario cotidiano:',
      'Parte 2': 'Vocabulario, Asociación semántica, Comprensión léxica, Nombre recomendado: Vocabulario, Asociación semántica, Comprensión léxica, Nombre técnico alternativo: Reconocimiento léxico-semántico',
      'Parte 3': 'Competencia comunicativa, Pragmática del idioma, Uso natural de expresiones, Nombre recomendado: Uso funcional del idioma en diálogos, Nombre técnico alternativo: Competencia pragmática y conversacional',
      'Parte 4': 'Comprensión lectora, Gramática en contexto, Cohesión textual, Nombre recomendado: Comprensión lectora y gramática contextual. Nombre técnico alternativo: Procesamiento gramatical en textos continuos y segmentados',
      'Parte 5': 'Comprensión global del texto, Identificación de ideas principales, Información específica, Inferencias simples, Vocabulario en contexto',
      'Parte 6': 'Comprensión lectora avanzada, Propósito del autor, Opiniones y actitudes, Conclusiones a partir del texto, Relación de ideas, Nombre recomendado: Comprensión lectora crítica, Nombre técnico alternativo: Interpretación de textos, Análisis del propósito del autor, Lectura inferencial y crítica',
      'Parte 7': 'Preposiciones, conectores, cuantificadores, tiempos verbales, pronombres relativos, Gramática aplicada al contexto, Vocabulario funcional, 🎯 Nombre recomendado, Uso del lenguaje en contexto',
    };

    return topicMap[topicName] || topicName;
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
- Incluye términos que encuentren contenido útil de **cualquier canal** (no solo canales específicos): el tema + "aprender inglés", "inglés explicado en español", "gramática inglés", "vocabulario inglés", "ICFES inglés", "clase inglés bachillerato".
- Puedes mencionar canales conocidos como referencia opcional, pero **prioriza palabras clave genéricas** para que YouTube devuelva videos útiles de diversos canales educativos.` : '';

    // Instrucciones específicas de webSearchInfo por materia (alineadas a Icfes Saber 11°)
    const normalizedSubjectForWeb = this.normalizeSubjectName(subject);
    const webSearchMathSection =
      normalizedSubjectForWeb === 'matemáticas' || normalizedSubjectForWeb === 'matematicas'
        ? `
**RECURSOS WEB PARA MATEMÁTICAS (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Busca páginas web con **material para bachillerato o secundaria (grados 6 a 11)** anclado al tema (ej. geometría, álgebra, estadística). Competencias Icfes: interpretación y representación, formulación y ejecución, argumentación.
- En **searchIntent** y **searchKeywords** incluye SIEMPRE: el tema específico (ej. "geometría", "ecuaciones cuadráticas"), **"ejercicios resueltos"**, **"descripción de temas"**, "bachillerato" o "secundaria", "estudiantes", "guía" o "explicación".
- En **expectedContentTypes** incluye: "descripción de temas", "ejercicios resueltos", "guía paso a paso", "página web con explicación clara", "contenido con ejemplos entendibles", "material de práctica para secundaria".
- Ejemplo para geometría: searchIntent = "Páginas web con material de geometría para bachillerato/secundaria (6-11): descripción de temas, ejercicios resueltos, explicaciones para estudiantes"; searchKeywords = ["geometría", "ejercicios resueltos", "descripción temas", "bachillerato", "secundaria estudiantes"].`
        : '';

    const webSearchLecturaSection =
      normalizedSubjectForWeb.includes('lectura') && normalizedSubjectForWeb.includes('crítica')
        ? `
**RECURSOS WEB PARA LECTURA CRÍTICA (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Material para **bachillerato y secundaria (grados 6 a 11)**: descripción de temas, ejercicios resueltos, cómo interpretar y analizar textos, definición de palabras.
- Textos literarios cortos (cuentos, fragmentos de novelas, poemas, narraciones). Infografías, gráficas y tablas. Conectores lógicos (sin embargo, por tanto, además). Tipos de texto (argumentativo, expositivo, narrativo), intención comunicativa.
- Incluye en **searchKeywords** términos como: "Cuadernillo lectura crítica Saber 11 pdf", "Textos argumentativos cortos con preguntas", "Ejercicios inferencia lectura crítica", "Conectores lógicos ejercicios pdf", "Comprensión lectora inferencial y crítica".`
        : '';

    const webSearchCienciasSocialesSection =
      normalizedSubjectForWeb.includes('ciencias sociales') || normalizedSubjectForWeb.includes('competencias ciudadanas')
        ? `
**RECURSOS WEB PARA CIENCIAS SOCIALES (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Material para **bachillerato y secundaria (grados 6 a 11)**: descripción de temas, ejercicios resueltos. Historia de Colombia (independencia, Constitución 1991), Revolución Francesa e Industrial, guerras mundiales, Guerra Fría. Regiones naturales, economía (PIB, oferta y demanda), ramas del poder, democracia, Competencias ciudadanas, mecanismos de participación. "Ciencias sociales ICFES Saber 11 preguntas resueltas", "Competencias ciudadanas".`
        : '';

    const webSearchPhysicsChemistrySection =
      normalizedSubjectForWeb === 'física'
        ? `
**RECURSOS WEB PARA FÍSICA (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Material para **bachillerato y secundaria (grados 6 a 11)**: descripción de temas, ejercicios resueltos. Cinemática (MRU, MRUA, caída libre), Dinámica (Leyes de Newton), trabajo/energía/potencia, ondas y sonido, Electricidad y circuitos (Ley de Coulomb, Ley de Ohm), electromagnetismo, presión y fluidos. "Física ICFES Saber 11 preguntas tipo ICFES".`
        : normalizedSubjectForWeb === 'quimica'
          ? `
**RECURSOS WEB PARA QUÍMICA (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Material para **bachillerato y secundaria (grados 6 a 11)**: descripción de temas, ejercicios resueltos. Estequiometría, tabla periódica, enlace iónico/covalente/metálico, polaridad, geometría molecular (VSEPR), fuerzas intermoleculares, soluciones, ácidos y bases pH, hidrocarburos, grupos funcionales, nomenclatura. "Balanceo de ecuaciones químicas ejercicios", "Química orgánica básica ejercicios nomenclatura".`
          : '';

    const webSearchBiologiaSection =
      normalizedSubjectForWeb === 'biología' || normalizedSubjectForWeb === 'biologia'
        ? `
**RECURSOS WEB PARA BIOLOGÍA (OBLIGATORIO en webSearchInfo) - Criterios Icfes Saber 11°:**
- Material para **bachillerato y secundaria (grados 6 a 11)**: descripción de temas, ejercicios resueltos. Célula y organelos, tipos de células (animal, vegetal, procariota, eucariota), transporte celular (ósmosis, difusión), mitosis y meiosis. Genética y herencia, ADN y ARN, genes y cromosomas, leyes de Mendel, mutaciones, teorías de evolución, selección natural, adaptación. Ecosistemas, cadenas y redes tróficas, niveles tróficos, ciclos biogeoquímicos (agua, carbono, nitrógeno), biodiversidad, impacto ambiental. Sistemas digestivo, respiratorio, circulatorio, nervioso y endocrino, reproducción humana. Fotosíntesis y respiración celular, cloroplastos y mitocondrias. Bacterias, virus, hongos. Interpretación de gráficos y experimentos, variables dependientes e independientes. "Biología ICFES Saber 11 preguntas tipo ICFES", "Célula mitosis meiosis", "Ecosistemas cadenas tróficas ciclos biogeoquímicos", "Fotosíntesis y respiración celular resumen".`
        : '';

    const webSearchEnglishSection =
      normalizedSubjectForWeb === 'inglés'
        ? `
**RECURSOS WEB PARA INGLÉS (OBLIGATORIO en webSearchInfo):**
- **CRÍTICO**: Busca **contenido en ESPAÑOL que explica inglés** (no páginas solo en inglés). Material para aprender inglés explicado en español, para secundaria/ICFES.
- En **searchIntent** indica: páginas web **en español** que explican inglés (gramática, vocabulario, comprensión lectora) para el tema/debilidad.
- En **searchKeywords** incluye siempre: "inglés explicado en español", "gramática inglés secundaria", "aprender inglés español", y el tema específico.
- En **expectedContentTypes** incluye: "página en español que explica inglés", "gramática inglés explicada en español", "guía paso a paso en español", "material para aprender inglés en español".`
        : '';

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
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "webSearchInfo": {
        "searchIntent": "Páginas web con material sobre [TEMA DE LA DEBILIDAD] para bachillerato o secundaria (grados 6 a 11): descripción de temas, ejercicios resueltos, explicaciones y guías para estudiantes. Contenido anclado al tema.",
        "searchKeywords": ["[tema específico, ej. geometría, ecuaciones cuadráticas]", "ejercicios resueltos", "descripción de temas", "bachillerato", "secundaria estudiantes", "guía", "explicación"],
        "expectedContentTypes": ["descripción de temas", "ejercicios resueltos", "página web con explicación clara", "guía paso a paso", "contenido con ejemplos entendibles", "material de práctica", "resumen conceptual accesible", "libro o guía de estudio para secundaria"],
        "educationalLevel": "Bachillerato o secundaria (grados 6 a 11), estudiantes"
      }
    }
  ]
}

--- Especificaciones ---

**diagnostic_summary:** Máximo 50 palabras; menciona las debilidades principales.
**study_plan_summary:** 100-150 palabras; estrategia de mejora y recursos (videos, ejercicios).

**practice_exercises:** EXACTAMENTE 20 ejercicios. Genera este array ANTES que topics. Estilo ICFES (selección múltiple). Campos: question (texto con contexto si aplica), options (array de 4 strings con formato "A) Texto", "B) Texto", ...), correctAnswer (solo letra "A"|"B"|"C"|"D"), explanation (detallada), topic (coincide con debilidad). Enfocado en competencias, no memorización.

**topics:** Mínimo 3, idealmente 5-8. Cada uno relacionado con una debilidad.
Por topic: **name**, **description**, **level** (Básico|Intermedio|Avanzado), **keywords** (3-5 para videos; específicas, no genéricas). ${keywordsInstruction} ${englishChannelsSection}

**webSearchInfo** (OBLIGATORIO por topic). Público: bachillerato o secundaria (grados 6-11). Sin URLs ni sitios específicos. **searchIntent:** material sobre el tema con descripción de temas, ejercicios resueltos, guías para estudiantes. **searchKeywords:** tema específico + "ejercicios resueltos" + "descripción de temas" + bachillerato/secundaria + estudiantes. **expectedContentTypes:** "descripción de temas", "ejercicios resueltos", "página web con explicación clara", "guía paso a paso", "contenido con ejemplos entendibles", "material de práctica para secundaria". **educationalLevel:** "Bachillerato o secundaria (grados 6 a 11), estudiantes".
${webSearchMathSection}
${webSearchLecturaSection}
${webSearchPhysicsChemistrySection}
${webSearchBiologiaSection}
${webSearchCienciasSocialesSection}
${webSearchEnglishSection}

--- Restricciones ---

Responde solo con JSON válido. No markdown ni texto extra. EXACTAMENTE 20 ejercicios. No incluir video_resources ni study_links (se generan después). En webSearchInfo solo información semántica, sin URLs.
CRÍTICO para JSON válido: (1) No pongas comas finales antes de ] o }. (2) Dentro de cualquier string usa \\\" para comillas y \\n para saltos de línea. (3) Devuelve un único objeto; sin texto antes ni después.

--- Orden en el JSON ---

1. student_info 2. diagnostic_summary 3. study_plan_summary 4. practice_exercises (20 ejercicios; genera primero) 5. topics`;
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

      const grade = this.normalizeGradeForPath(input.grade);
      if (!parsed.student_info) parsed.student_info = {} as StudyPlanResponse['student_info'];
      (parsed.student_info as { grade?: string }).grade = grade;
      console.log(`   📋 Grado (videos y WebLinks): ${grade}`);

      // Obtener videos desde YoutubeLinks/{grado}/{materia}/{topicId}/ (caché) o YouTube
      // Usa topics CANÓNICOS (ejes de la materia) con debilidad. 7 videos por topic.
      // Llenado incremental en cada generación hasta MAX_VIDEOS_PER_TOPIC, sin duplicados.
      console.log(`\n📹 Obteniendo videos educativos (YoutubeLinks/${grade}/{materia}/{topicId}/, YouTube si es necesario)...`);

      parsed.video_resources = [];
      parsed.study_links = [];

      const weaknessTopics = (parsed.student_info?.weaknesses || []).map((w) => w.topic);
      let canonicalTopics = getCanonicalTopicsWithWeakness(input.subject, weaknessTopics);

      // Fallback para Inglés: si no se mapeó ninguna debilidad a Parte 1..7, derivar desde los topics del plan (Gemini)
      if (canonicalTopics.length === 0 && this.isEnglishSubject(input.subject) && (parsed.topics?.length ?? 0) > 0) {
        const seen = new Set<string>();
        for (const t of parsed.topics || []) {
          const canonical = mapToCanonicalTopic(input.subject, t.name);
          if (canonical && !seen.has(canonical)) {
            seen.add(canonical);
            canonicalTopics.push(canonical);
          }
        }
        if (canonicalTopics.length > 0) {
          console.log(`   🇬🇧 Inglés: no se mapearon debilidades; usando ${canonicalTopics.length} topic(s) del plan: ${canonicalTopics.join(', ')}`);
        }
      }

      if (canonicalTopics.length > 0) {
        console.log(`   📚 Topics canónicos con debilidad: ${canonicalTopics.join(', ')}`);

        // Varios topics del plan pueden mapear al mismo canónico: unir nombres para UI (ej. "Ecuaciones · Polinomios")
        const canonicalToDisplayNames = new Map<string, string[]>();
        for (const t of parsed.topics || []) {
          const canonical = mapToCanonicalTopic(input.subject, t.name);
          if (canonical) {
            const list = canonicalToDisplayNames.get(canonical) ?? [];
            if (!list.includes(t.name)) list.push(t.name);
            canonicalToDisplayNames.set(canonical, list);
          }
        }
        const formatDisplayName = (names: string[]) => names.join(' · ');

        const videoPromises = canonicalTopics.map(async (canonicalTopic) => {
          try {
            const keywords = this.getKeywordsForCanonicalTopic(
              canonicalTopic,
              parsed.topics || [],
              input.subject
            );
            console.log(`   🔍 Procesando videos para topic canónico: "${canonicalTopic}"`);
            console.log(`      Keywords: ${keywords.join(', ')}`);

            const videos = await this.getVideosForTopic(
              grade,
              input.studentId,
              input.phase,
              input.subject,
              canonicalTopic,
              keywords
            );

            if (videos.length > 0) {
              console.log(`   ✅ Obtenidos ${videos.length} video(s) para "${canonicalTopic}" (objetivo: ${VIDEOS_PER_TOPIC})`);
            } else {
              console.warn(`   ⚠️ No se encontraron videos para topic "${canonicalTopic}"`);
            }

            const displayName = formatDisplayName(canonicalToDisplayNames.get(canonicalTopic) ?? [canonicalTopic]);
            return videos.map((video) => ({
              ...video,
              topic: canonicalTopic,
              topicDisplayName: displayName,
            }));
          } catch (error: any) {
            console.error(`   ❌ Error procesando videos para topic "${canonicalTopic}":`, error.message);
            return [];
          }
        });

        const allVideos = await Promise.all(videoPromises);
        parsed.video_resources = allVideos.flat();

        let totalVideos = parsed.video_resources.length;
        const expectedVideos = canonicalTopics.length * VIDEOS_PER_TOPIC;
        console.log(`✅ Total de ${totalVideos} video(s) obtenido(s) para el plan de estudio`);
        console.log(`   📊 Esperados: ~${expectedVideos} videos (${canonicalTopics.length} topics × ${VIDEOS_PER_TOPIC} videos)`);

        // Rescate para Inglés: si no se encontró ningún video, búsqueda genérica para no bloquear el plan
        if (totalVideos === 0 && this.isEnglishSubject(input.subject)) {
          console.warn(`   🇬🇧 Inglés: 0 videos por topic; intentando búsqueda genérica de rescate...`);
          const rescueKeywords = ['inglés explicado en español', 'gramática inglés bachillerato', 'ICFES inglés'];
          const rescueVideos = await this.searchYouTubeVideos(rescueKeywords, 7, 'Inglés', canonicalTopics[0]);
          if (rescueVideos.length > 0) {
            const displayName = (() => {
              const names: string[] = [];
              for (const t of parsed.topics || []) {
                if (mapToCanonicalTopic(input.subject, t.name) === canonicalTopics[0] && !names.includes(t.name)) names.push(t.name);
              }
              return names.length > 0 ? names.join(' · ') : canonicalTopics[0];
            })();
            parsed.video_resources = rescueVideos.map((v) => ({
              ...v,
              topic: canonicalTopics[0],
              topicDisplayName: displayName,
            }));
            totalVideos = parsed.video_resources.length;
            console.log(`   ✅ Rescate: se añadieron ${totalVideos} video(s) genéricos de inglés para el plan.`);
          } else {
            console.error(`❌ ERROR CRÍTICO: No se encontraron videos para ningún topic ni en búsqueda de rescate.`);
          }
        } else if (totalVideos === 0) {
          console.error(`❌ ERROR CRÍTICO: No se encontraron videos para ningún topic.`);
        }
      } else {
        console.warn('⚠️ No se identificaron topics canónicos con debilidad. No se buscarán videos.');
      }

      console.log(`\n🔗 Obteniendo enlaces web educativos (WebLinks/${grade}/{materia}/{topicId}/)...`);

      parsed.study_links = [];

      if (canonicalTopics.length > 0) {
        console.log(`   📚 Procesando ${canonicalTopics.length} topic(s) canónico(s) para obtener enlaces...`);

        const linkPromises = canonicalTopics.map(async (canonicalTopic) => {
          try {
            console.log(`   🔍 Procesando enlaces para topic canónico: "${canonicalTopic}"`);

            const links = await this.getLinksForTopic(grade, input.subject, canonicalTopic);

            if (links.length > 0) {
              console.log(`   ✅ Obtenidos ${links.length} enlace(s) para "${canonicalTopic}"`);
            } else {
              console.warn(`   ⚠️ No se encontraron enlaces para topic "${canonicalTopic}"`);
            }

            return links.map((link) => ({
              ...link,
              topic: canonicalTopic,
            }));
          } catch (error: any) {
            console.error(`   ❌ Error procesando enlaces para topic "${canonicalTopic}":`, error.message);
            return [];
          }
        });

        const allLinks = await Promise.all(linkPromises);
        parsed.study_links = allLinks.flat();

        const totalLinks = parsed.study_links.length;
        console.log(`✅ Total de ${totalLinks} enlace(s) obtenido(s) para el plan (${canonicalTopics.length} topic(s) canónico(s)); luego se rellenan desde WebLinks para todos los temas de la materia`);
      } else {
        console.warn('⚠️ No se identificaron topics canónicos con debilidad. No se buscarán enlaces.');
      }

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

      // study_links: todos los enlaces de la materia (todos los temas en WebLinks, no solo los del plan)
      const allTopicNamesForSubject = getSubjectConfig(input.subject)?.topics.map((t) => t.name) ?? [];
      parsed.study_links = await this.buildStudyLinksFromWebLinks(grade, input.subject, allTopicNamesForSubject, input.phase);

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
            
            // study_links: fuente de verdad WebLinks; se construyen al leer
            const gradeForLinks = this.normalizeGradeForPath((data.student_info as { grade?: string })?.grade);
            const allTopicNamesForSubject = getSubjectConfig(subject)?.topics.map((t) => t.name) ?? [];
            data.study_links = await this.buildStudyLinksFromWebLinks(gradeForLinks, subject, allTopicNamesForSubject, phase);
            if (data.study_links.length > 0) {
              console.log(`   ✅ study_links desde WebLinks: ${data.study_links.length} enlace(s) para ${allTopicNamesForSubject.length} tema(s)`);
            }

            // video_resources: fuente de verdad YoutubeLinks; siempre se construyen al leer (no se persisten en AnswerIA)
            const grade = this.normalizeGradeForPath((data.student_info as { grade?: string })?.grade);
            const weaknessTopics = (data.student_info?.weaknesses || []).map((w: { topic: string }) => w.topic);
            const canonicalTopics = weaknessTopics.length > 0
              ? getCanonicalTopicsWithWeakness(subject, weaknessTopics)
              : [...new Set((data.topics || []).map((t: { name: string }) => mapToCanonicalTopic(subject, t.name)).filter(Boolean) as string[])];

            // Varios topics del plan pueden mapear al mismo canónico: unir nombres para UI (ej. "Ecuaciones · Polinomios")
            const canonicalToDisplayNames = new Map<string, string[]>();
            for (const t of data.topics || []) {
              const canonical = mapToCanonicalTopic(subject, t.name);
              if (canonical) {
                const list = canonicalToDisplayNames.get(canonical) ?? [];
                if (!list.includes(t.name)) list.push(t.name);
                canonicalToDisplayNames.set(canonical, list);
              }
            }
            const formatDisplayName = (names: string[]) => names.join(' · ');

            if (canonicalTopics.length > 0) {
              console.log(`   📹 Construyendo video_resources desde YoutubeLinks (${canonicalTopics.length} topic(s) canónico(s))...`);
              const videosByTopic = await Promise.all(
                canonicalTopics.map(async (canonicalTopic) => {
                  try {
                    const videos = await this.getCachedVideos(grade, studentId, phase, subject, canonicalTopic);
                    const displayName = formatDisplayName(canonicalToDisplayNames.get(canonicalTopic) ?? [canonicalTopic]);
                    return videos.map((video) => ({
                      ...video,
                      topic: canonicalTopic,
                      topicDisplayName: displayName,
                    }));
                  } catch (error: any) {
                    console.warn(`   ⚠️ Error obteniendo videos para topic "${canonicalTopic}":`, error?.message);
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
   * Obtiene información semántica de Gemini para buscar videos en YouTube
   * Este método se llama SOLO cuando no hay suficientes videos en Firestore
   * @param topic - Nombre del tema
   * @param subject - Materia
   * @param phase - Fase del estudiante
   * @param keywords - Keywords básicas del tema
   * @returns Información semántica para optimizar la búsqueda en YouTube
   */
  private async getYouTubeSearchSemanticInfo(
    topic: string,
    subject: string,
    phase: 'first' | 'second' | 'third',
    keywords: string[]
  ): Promise<YouTubeSearchSemanticInfo | null> {
    try {
      if (!(await geminiClient.isAvailable())) {
        console.warn('⚠️ Gemini no está disponible, usando keywords básicas');
        return null;
      }

      const phaseMap: Record<string, string> = {
        first: 'Fase I',
        second: 'Fase II',
        third: 'Fase III',
      };

      const prompt = `Actúas como un experto en educación secundaria y docencia en ${subject},
especializado en la Prueba Saber 11 (ICFES) y en el diseño de recursos educativos audiovisuales.

Tu tarea NO es generar enlaces ni recomendar videos específicos.
Tu función es definir criterios pedagógicos de búsqueda para encontrar
videos educativos adecuados para reforzar una debilidad académica.

REGLAS ESTRICTAS:
- NO generes enlaces.
- NO inventes URLs ni IDs de YouTube.
- NO menciones videos, canales o plataformas específicas.
- Limítate exclusivamente a análisis pedagógico y semántico.

Para el siguiente tema con debilidad identificada, devuelve:
1. Intención pedagógica del video (qué debe aprender el estudiante).
2. Nivel académico objetivo (básico, medio, avanzado).
3. Tipo de explicación esperada (conceptual, paso a paso, con ejemplos, ejercicios resueltos).
4. Lista de 5 a 8 palabras clave optimizadas para buscar videos educativos en YouTube.
5. Competencia a fortalecer (interpretación, formulación, argumentación).

**Tema con debilidad:** ${topic}
**Materia:** ${subject}
**Fase:** ${phaseMap[phase]}
**Keywords básicas del tema:** ${keywords.join(', ')}
${this.isEnglishSubject(subject) ? `
IMPORTANTE PARA INGLÉS: Buscamos videos EN ESPAÑOL que explican inglés, de CUALQUIER canal útil. En searchKeywords usa términos GENÉRICOS por tema (ej. "aprender inglés", "inglés explicado en español", "gramática inglés", "vocabulario inglés", "ICFES inglés") combinados con el tema. NO uses solo nombres de canales: prioriza palabras clave que encuentren contenido educativo de diversos canales.` : ''}

Devuelve exclusivamente un objeto JSON válido con esta estructura:
{
  "searchIntent": "Intención pedagógica clara de qué debe aprender el estudiante",
  "searchKeywords": ["palabra1", "palabra2", "palabra3", "palabra4", "palabra5", "palabra6", "palabra7", "palabra8"],
  "academicLevel": "básico|medio|avanzado",
  "expectedContentType": "conceptual|paso a paso|con ejemplos|ejercicios resueltos",
  "competenceToStrengthen": "interpretación|formulación|argumentación"
}

Responde SOLO con JSON válido, sin texto adicional.`;

      console.log(`   🤖 Consultando Gemini para información semántica de búsqueda...`);
      const result = await geminiClient.generateContent(prompt, [], {
        retries: 2,
        timeout: 30000, // 30 segundos
      });

      // Parsear respuesta JSON
      let cleanedText = result.text.replace(/```json\n?([\s\S]*?)\n?```/g, '$1');
      cleanedText = cleanedText.replace(/```\n?([\s\S]*?)\n?```/g, '$1');
      
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        console.warn('⚠️ No se pudo parsear respuesta de Gemini, usando keywords básicas');
        return null;
      }

      const jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
      const semanticInfo = JSON.parse(jsonString) as YouTubeSearchSemanticInfo;

      console.log(`   ✅ Información semántica obtenida de Gemini`);
      console.log(`      Intención: ${semanticInfo.searchIntent}`);
      console.log(`      Keywords: ${semanticInfo.searchKeywords.join(', ')}`);

      return semanticInfo;
    } catch (error: any) {
      console.warn(`⚠️ Error obteniendo información semántica de Gemini:`, error.message);
      console.warn(`   Se usarán keywords básicas para la búsqueda`);
      return null;
    }
  }

  /**
   * Asegura que el caché de YoutubeLinks tenga al menos minCount videos para el topic.
   * Si no hidrata: devuelve la lista en caché para evitar una segunda lectura.
   * Si hidrata: devuelve null y el llamador debe leer con getCachedVideos.
   */
  private async ensureVideosInCache(
    grade: string,
    subject: string,
    topic: string,
    keywords: string[],
    minCount: number = VIDEOS_PER_TOPIC
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
    videoId?: string;
    duration?: string;
    language?: string;
  }> | null> {
    const cached = await this.getCachedVideos(grade, '', 'first', subject, topic);
    if (cached.length >= minCount) {
      return cached;
    }
    if (cached.length >= MAX_VIDEOS_PER_TOPIC) {
      return cached;
    }

    const videosNeeded = MAX_VIDEOS_PER_TOPIC - cached.length;
    console.log(`   ⚠️ Faltan videos en caché. Buscando hasta ${videosNeeded} más en YouTube...`);
    const searchTopic = this.getDescriptiveSearchTopic(subject, topic);
    const semanticInfo = await this.getYouTubeSearchSemanticInfo(searchTopic, subject, 'first', keywords);
    const searchKeywords = semanticInfo?.searchKeywords || keywords;
    const videosToSearch = Math.min(Math.max(videosNeeded + 5, 10), 25);
    const newVideos = await this.searchYouTubeVideos(searchKeywords, videosToSearch, subject, topic);

    if (newVideos.length === 0 && cached.length === 0) {
      console.warn(`   🔄 Fallback: buscando con keywords originales`);
      const fallbackVideos = await this.searchYouTubeVideos(keywords, 10, subject, topic);
      if (fallbackVideos.length > 0) {
        await this.saveVideosToCache(grade, '', subject, topic, fallbackVideos, 0);
      }
      return null;
    }

    const existingIds = new Set(cached.map((v) => v.videoId || v.url));
    const uniqueNew = newVideos.filter((v) => {
      const id = v.videoId || v.url;
      return !existingIds.has(id);
    });
    if (uniqueNew.length > 0) {
      await this.saveVideosToCache(grade, '', subject, topic, uniqueNew, cached.length);
    }
    return null;
  }

  /**
   * Obtiene videos para un topic canónico: asegura caché y lee una sola vez desde YoutubeLinks.
   * Ruta unificada con admin: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos.
   */
  private async getVideosForTopic(
    grade: string,
    studentId: string,
    phase: 'first' | 'second' | 'third',
    subject: string,
    topic: string,
    keywords: string[]
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
      console.log(`   📋 Obteniendo videos para topic canónico: "${topic}"`);
      const maybeCached = await this.ensureVideosInCache(grade, subject, topic, keywords);
      const list = maybeCached ?? await this.getCachedVideos(grade, studentId, phase, subject, topic);
      console.log(`   📦 Leyendo caché: ${list.length} video(s)`);
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
   * Obtiene videos desde Firestore (caché).
   * Ruta unificada con admin: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos.
   * Incluye documentos creados por el admin (IDs auto-generados) y por la API (video1, video2...).
   */
  private async getCachedVideos(
    grade: string,
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
    const db = this.getStudentDatabase();
    const gradoPath = getGradeNameForAdminPath(grade);
    const subjectConfig = getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    const topicCode = getTopicCode(subject, topic);

    if (!materiaCode || !topicCode) {
      console.warn(`   ⚠️ No se pudo resolver ruta admin para materia="${subject}" topic="${topic}" (materiaCode=${materiaCode ?? '?'}, topicCode=${topicCode ?? '?'})`);
      return [];
    }

    const parseVideoDoc = (data: admin.firestore.DocumentData) => ({
      title: data.título || data.title || '',
      url: data.url || `https://www.youtube.com/watch?v=${data.videoId || ''}`,
      description: data.description || '',
      channelTitle: data.canal || data.channelTitle || '',
      videoId: data.videoId || '',
      duration: data.duración || data.duration || '',
      language: data.idioma || data.language || 'es',
      topic,
    });

    try {
      const mainPath = `YoutubeLinks/${gradoPath}/${materiaCode}/${topicCode}/videos`;
      console.log(`   🔍 Consultando: ${mainPath}`);

      const videosColRef = db.collection('YoutubeLinks').doc(gradoPath).collection(materiaCode).doc(topicCode).collection('videos');
      const snapshot = await videosColRef.get();

      const orderOrTime = (data: admin.firestore.DocumentData): number => {
        if (typeof data.order === 'number') return data.order;
        const t = data.savedAt?.toMillis?.() ?? data.createdAt?.toMillis?.();
        return t ?? 0;
      };

      const withOrder = snapshot.docs
        .map((d) => ({ doc: d, data: d.data(), order: orderOrTime(d.data()) }))
        .filter((x) => x.data?.url)
        .sort((a, b) => a.order - b.order)
        .slice(0, MAX_VIDEOS_PER_TOPIC);

      const videos = withOrder.map((x) => parseVideoDoc(x.data));
      if (videos.length > 0) {
        console.log(`   📦 Videos en caché: ${videos.length}`);
      }
      return videos;
    } catch (error: any) {
      console.error(`❌ Error obteniendo videos desde caché:`, error.message);
      return [];
    }
  }

  /**
   * Guarda videos en Firestore (caché).
   * Ruta unificada con admin: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos/video1, video2...
   * Caché global por grado, materia y topic (sin studentId).
   */
  private async saveVideosToCache(
    grade: string,
    _studentId: string,
    subject: string,
    topic: string,
    videos: Array<{
      title: string;
      url: string;
      description: string;
      channelTitle: string;
      videoId?: string;
      duration?: string;
      language?: string;
    }>,
    startOrder: number = 0
  ): Promise<void> {
    try {
      const db = this.getStudentDatabase();
      const gradoPath = getGradeNameForAdminPath(grade);
      const subjectConfig = getSubjectConfig(subject);
      const materiaCode = subjectConfig?.code;
      const topicCode = getTopicCode(subject, topic);

      if (!materiaCode || !topicCode) {
        console.warn(`   ⚠️ No se pudo resolver ruta admin para guardar videos (materia="${subject}" topic="${topic}"). No se guardan en caché.`);
        return;
      }

      const topicColRef = db.collection('YoutubeLinks').doc(gradoPath).collection(materiaCode).doc(topicCode).collection('videos');
      const savePath = `YoutubeLinks/${gradoPath}/${materiaCode}/${topicCode}/videos/video${startOrder + 1}...video${startOrder + videos.length}`;
      console.log(`   💾 Guardando ${videos.length} video(s) en: ${savePath}`);

      const batch = db.batch();
      videos.forEach((video, index) => {
        const order = startOrder + index + 1;
        if (order > MAX_VIDEOS_PER_TOPIC) {
          console.warn(`   ⚠️ Límite de ${MAX_VIDEOS_PER_TOPIC} videos para topic "${topic}"`);
          return;
        }
        const vidDocId = `video${order}`;
        let extractedVideoId = video.videoId || '';
        if (!extractedVideoId && video.url) {
          const match = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (match) extractedVideoId = match[1];
        }
        const videoRef = topicColRef.doc(vidDocId);
        batch.set(
          videoRef,
          {
            videoId: extractedVideoId,
            título: video.title,
            canal: video.channelTitle,
            duración: video.duration || '',
            idioma: video.language || 'es',
            title: video.title,
            channelTitle: video.channelTitle,
            duration: video.duration || '',
            language: video.language || 'es',
            url: video.url,
            description: video.description || '',
            order,
            savedAt: new Date(),
            topic,
          },
          { merge: true }
        );
      });
      await batch.commit();
    } catch (error: any) {
      console.error(`❌ Error guardando videos en Firestore:`, error.message);
      throw error;
    }
  }

  /**
   * Convierte duración ISO 8601 (PT4M13S) a formato legible (4:13)
   * @param duration - Duración en formato ISO 8601
   * @returns Duración en formato legible
   */
  private parseDuration(duration: string): string {
    if (!duration || !duration.startsWith('PT')) {
      return '';
    }

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      return '';
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Obtiene detalles de videos (duración, idioma) desde YouTube API
   * @param videoIds - Array de IDs de videos
   * @returns Map con videoId -> { duration, language }
   */
  private async getVideoDetails(videoIds: string[]): Promise<Map<string, { duration: string; language: string }>> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const detailsMap = new Map<string, { duration: string; language: string }>();

    if (!YOUTUBE_API_KEY || videoIds.length === 0) {
      return detailsMap;
    }

    try {
      // YouTube API permite hasta 50 videos por request
      const chunks = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
          `part=contentDetails,snippet` +
          `&id=${chunk.join(',')}` +
          `&key=${YOUTUBE_API_KEY}`;

        const response = await fetch(detailsUrl);

        if (!response.ok) {
          console.warn(`⚠️ Error obteniendo detalles de videos (${response.status}): ${response.statusText}`);
          continue;
        }

        const data = await response.json() as {
          items?: Array<{
            id: string;
            contentDetails: {
              duration: string;
            };
            snippet: {
              defaultAudioLanguage?: string;
              defaultLanguage?: string;
            };
          }>;
        };

        if (data.items) {
          data.items.forEach(item => {
            const duration = this.parseDuration(item.contentDetails.duration);
            const language = item.snippet.defaultAudioLanguage || 
                           item.snippet.defaultLanguage || 
                           'es'; // Default a español si no se especifica

            detailsMap.set(item.id, { duration, language });
          });
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ Error obteniendo detalles de videos:`, error.message);
    }

    return detailsMap;
  }

  /**
   * Log estructurado para observabilidad (Cloud Logging puede filtrar por jsonPayload).
   */
  private logYouTubeSearchEvent(
    event: 'youtube_search' | 'youtube_search_error',
    payload: { topic?: string; subject?: string; keywordsCount?: number; resultCount?: number; status?: number; message?: string }
  ): void {
    console.log(JSON.stringify({ event, ...payload }));
  }

  /**
   * Busca videos educativos en YouTube usando keywords.
   * No lanza errores: ante fallo de API o cuota agotada devuelve [] y registra evento estructurado.
   * @param keywords - Array de keywords para buscar
   * @param maxResults - Número máximo de videos a retornar (default: 3)
   * @param subject - Materia (para query y observabilidad)
   * @param topic - Topic canónico (para observabilidad)
   */
  private async searchYouTubeVideos(
    keywords: string[],
    maxResults: number = 3,
    subject?: string,
    topic?: string
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    channelTitle: string;
    videoId?: string;
    duration?: string;
    language?: string;
  }>> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
      this.logYouTubeSearchEvent('youtube_search_error', { topic, subject, keywordsCount: keywords.length, message: 'YOUTUBE_API_KEY no configurada' });
      console.error('❌ YOUTUBE_API_KEY no está configurada.');
      return [];
    }

    try {
      // Limitar a ~6 términos para no degradar relevancia en YouTube (especialmente cuando Gemini falla y se usa fallback)
      const cappedKeywords = keywords.slice(0, 6);
      let query = cappedKeywords.join(' ');
      if (cappedKeywords.length < keywords.length) {
        console.log(`   📌 Query limitada a ${cappedKeywords.length} términos para mejor relevancia`);
      }

      // Para inglés, agregar términos en español para encontrar videos en español que expliquen inglés
      if (subject && this.isEnglishSubject(subject)) {
        query = query + ' español explicación';
        console.log(`   🇬🇧 Búsqueda para Inglés: agregando términos en español para encontrar videos en español`);
      } else {
        query = query + ' educación ICFES';
      }

      // Construir URL de búsqueda
      // type=video, videoEmbeddable=true, order=relevance
      // Para Inglés: regionCode=CO y relevanceLanguage=es para priorizar contenido en español
      const regionCode = subject && this.isEnglishSubject(subject) ? '&regionCode=CO' : '';
      const relevanceLanguage = subject && this.isEnglishSubject(subject) ? '&relevanceLanguage=es' : '';
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet` +
        `&q=${encodeURIComponent(query)}` +
        `&type=video` +
        `&videoEmbeddable=true` +
        `&maxResults=${maxResults}` +
        `&order=relevance` +
        `${regionCode}` +
        `${relevanceLanguage}` +
        `&key=${YOUTUBE_API_KEY}`;

      console.log(`🔍 Buscando videos en YouTube con keywords: ${keywords.join(', ')}`);
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No se pudo leer el error');
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // ignorar
        }
        const errMessage = errorData.error?.message || response.statusText || errorText.substring(0, 200);
        this.logYouTubeSearchEvent('youtube_search_error', { topic, subject, keywordsCount: keywords.length, status: response.status, message: errMessage });
        if (response.status === 403 || response.status === 401) {
          console.error(`   ❌ YouTube API: autenticación/cuota. Razón: ${errMessage}`);
        }
        return [];
      }

      let data = await response.json() as {
        items?: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            description: string;
            channelTitle: string;
            thumbnails?: { default?: { url: string } };
          };
        }>;
      };

      // Si Inglés devolvió 0 resultados, reintentar sin relevanceLanguage (puede ser demasiado restrictivo)
      if (subject && this.isEnglishSubject(subject) && (!data.items || data.items.length === 0)) {
        console.warn(`   🇬🇧 Primera búsqueda con relevanceLanguage=es sin resultados; reintentando sin filtro de idioma...`);
        const searchUrlFallback = `https://www.googleapis.com/youtube/v3/search?` +
          `part=snippet` +
          `&q=${encodeURIComponent(query)}` +
          `&type=video` +
          `&videoEmbeddable=true` +
          `&maxResults=${maxResults}` +
          `&order=relevance` +
          `${regionCode}` +
          `&key=${YOUTUBE_API_KEY}`;
        const resFallback = await fetch(searchUrlFallback);
        if (resFallback.ok) {
          const dataFallback = await resFallback.json() as typeof data;
          if (dataFallback.items && dataFallback.items.length > 0) {
            data = dataFallback;
          }
        }
      }

      if (!data.items || data.items.length === 0) {
        this.logYouTubeSearchEvent('youtube_search', { topic, subject, keywordsCount: keywords.length, resultCount: 0 });
        console.warn(`⚠️ No se encontraron videos para topic "${topic ?? '?'}" (${keywords.length} keywords)`);
        return [];
      }

      // Extraer IDs de videos para obtener detalles (duración, idioma)
      const videoIds = data.items.map(item => item.id.videoId);
      console.log(`   📊 Obteniendo detalles (duración, idioma) para ${videoIds.length} video(s)...`);
      const videoDetails = await this.getVideoDetails(videoIds);

      // Mapear resultados a formato esperado con metadata completa
      const videos = data.items.map(item => {
        const videoId = item.id.videoId;
        const details = videoDetails.get(videoId);

        return {
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          description: item.snippet.description.substring(0, 200) + (item.snippet.description.length > 200 ? '...' : ''),
          channelTitle: item.snippet.channelTitle,
          videoId: videoId,
          duration: details?.duration || '',
          language: details?.language || 'es',
        };
      });

      this.logYouTubeSearchEvent('youtube_search', { topic, subject, keywordsCount: keywords.length, resultCount: videos.length });
      return videos;
    } catch (error: any) {
      this.logYouTubeSearchEvent('youtube_search_error', { topic, subject, keywordsCount: keywords.length, message: error?.message ?? String(error) });
      console.error(`❌ Error buscando videos en YouTube:`, error.message);
      return [];
    }
  }

  /**
   * Nombre de la colección Firestore para recursos web (única fuente de verdad).
   * Ruta completa: WebLinks/{grado}/{materiaCode}/{topicCode}/links
   * Debe coincidir con el admin de recursos y con firestore.rules.
   */
  private static readonly WEBLINKS_COLLECTION = 'WebLinks';

  /**
   * Obtiene enlaces web para un topic desde Firestore (WebLinks). Solo caché; no se usa motor de búsqueda.
   * Ruta: WebLinks/{grado}/{materiaCode}/{topicCode}/links
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
   * Construye el array study_links desde WebLinks (única fuente de verdad).
   * Trae TODOS los enlaces de cada topic (sin límite por tema).
   * topicIds: nombres canónicos de temas (ej. "Álgebra y Cálculo", "Geometría") de getSubjectConfig(subject).topics;
   * getTopicCode(subject, topicId) resuelve a código (AL, GE, ES) para la ruta WebLinks/{grado}/{materiaCode}/{topicCode}/links.
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

  /**
   * Obtiene todos los enlaces desde Firestore (sin límite).
   * Ruta unificada con admin: WebLinks/{grado}/{materiaCode}/{topicCode}/links.
   * Topics se buscan por nombre canónico (ej. "Álgebra y Cálculo") y se resuelven a topicCode (AL) vía getTopicCode.
   */
  private async getCachedLinks(
    grade: string,
    subject: string,
    topic: string,
    _phase?: 'first' | 'second' | 'third'
  ): Promise<Array<{
    title: string;
    url: string;
    description: string;
    topic?: string;
  }>> {
    const studentDb = this.getStudentDatabase();
    const gradoPath = getGradeNameForAdminPath(grade);
    const subjectConfig = getSubjectConfig(subject);
    const materiaCode = subjectConfig?.code;
    const topicCode = getTopicCode(subject, topic);

    if (!materiaCode || !topicCode) {
      console.warn(`   ⚠️ No se pudo resolver ruta admin para WebLinks materia="${subject}" topic="${topic}" (materiaCode=${materiaCode ?? '?'}, topicCode=${topicCode ?? '?'})`);
      return [];
    }

    const parseLinkDoc = (data: admin.firestore.DocumentData) => ({
      title: data.title || data.name || 'Enlace',
      url: data.url || data.link || '',
      description: data.description || '',
      topic,
    });

    try {
      const mainPath = `${StudyPlanService.WEBLINKS_COLLECTION}/${gradoPath}/${materiaCode}/${topicCode}/links`;
      console.log(`   🔍 Consultando WebLinks: ${mainPath}`);

      const linksColRef = studentDb
        .collection(StudyPlanService.WEBLINKS_COLLECTION)
        .doc(gradoPath)
        .collection(materiaCode)
        .doc(topicCode)
        .collection('links');
      const snapshot = await linksColRef.get();

      const orderOrTime = (data: admin.firestore.DocumentData): number => {
        if (typeof data.order === 'number') return data.order;
        const t = data.savedAt?.toMillis?.() ?? data.createdAt?.toMillis?.();
        return t ?? 0;
      };

      const withOrder = snapshot.docs
        .map((d) => ({ doc: d, data: d.data(), order: orderOrTime(d.data()) }))
        .filter((x) => x.data?.url || x.data?.link)
        .sort((a, b) => a.order - b.order);
      const links = withOrder.map((x) => parseLinkDoc(x.data));

      console.log(`   📦 WebLinks ${mainPath}: ${snapshot.docs.length} doc(s) en colección, ${links.length} enlace(s) devueltos (todos, sin límite)`);
      return links;
    } catch (error: any) {
      console.error(`❌ Error obteniendo enlaces desde caché:`, error.message);
      return [];
    }
  }

  /**
   * Obtiene ejercicios desde Firestore (caché EjerciciosIA).
   * Ruta unificada con admin: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicio1, ejercicio2...
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

      const promises: Promise<admin.firestore.DocumentSnapshot | null>[] = [];
      for (let i = 1; i <= MAX_EXERCISES_PER_TOPIC; i++) {
        promises.push(
          ejerciciosColRef.doc(`ejercicio${i}`).get().then((d) => (d.exists ? d : null))
        );
      }
      const docs = await Promise.all(promises);
      const withOrder = docs
        .filter((doc): doc is admin.firestore.DocumentSnapshot => doc !== null)
        .map((doc) => {
          const data = doc?.data();
          return data ? { ...parseExerciseDoc(data), order: data.order ?? 0 } : null;
        })
        .filter((v): v is NonNullable<typeof v> & { order: number } => v !== null);
      withOrder.sort((a, b) => (a.order as number) - (b.order as number));
      return withOrder;
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
   * Normaliza el grado para usar en la ruta WebLinks/{grado}/{materia}/{topicId}/.
   * Retorna "6".."11" para escalabilidad por grados.
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
