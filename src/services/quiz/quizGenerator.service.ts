import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME, GRADE_MAPPING } from '@/utils/subjects.config';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { phaseAnalysisService } from '@/services/phase/phaseAnalysis.service';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/services/db';

/**
 * Configuración de cuestionarios por materia y fase
 */
export interface QuizConfig {
  subject: string;
  subjectCode: string;
  phase: 'first' | 'second' | 'third'; // Primera, segunda, tercera ronda
  questionCount: number;
  timeLimit: number; // en minutos
  grade?: string; // Grado específico, si no se especifica usa todos
  level?: string; // Nivel específico para la fase
}

/**
 * Resultado de un cuestionario generado
 */
export interface GeneratedQuiz {
  id: string;
  title: string;
  description: string;
  subject: string;
  subjectCode: string;
  phase: string;
  questions: Question[];
  timeLimit: number;
  totalQuestions: number;
  instructions: string[];
  createdAt: Date;
}

/**
 * Configuración de cuestionarios por materia y fase
 */
const QUIZ_CONFIGURATIONS: Record<string, Record<string, Partial<QuizConfig>>> = {
  'Matemáticas': {
    first: {
      questionCount: 18,
      timeLimit: 45,
      level: 'Fácil'
    },
    second: {
      questionCount: 18,
      timeLimit: 50,
      level: 'Medio'
    },
    third: {
      questionCount: 18,
      timeLimit: 60,
      level: 'Difícil'
    }
  },
  'Lenguaje': {
    first: {
      questionCount: 18,
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 18,
      timeLimit: 45,
      level: 'Medio'
    },
    third: {
      questionCount: 18,
      timeLimit: 55,
      level: 'Difícil'
    }
  },
  'Ciencias Sociales': {
    first: {
      questionCount: 20,
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 20,
      timeLimit: 45,
      level: 'Medio'
    },
    third: {
      questionCount: 20,
      timeLimit: 50,
      level: 'Difícil'
    }
  },
  'Biologia': {
    first: {
      questionCount: 15,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 15,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 15,
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Quimica': {
    first: {
      questionCount: 15,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 15,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 15,
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Física': {
    first: {
      questionCount: 15,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 15,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 15,
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Inglés': {
    first: {
      questionCount: 12,
      timeLimit: 30,
      level: 'Fácil'
    },
    second: {
      questionCount: 14,
      timeLimit: 35,
      level: 'Medio'
    },
    third: {
      questionCount: 16,
      timeLimit: 40,
      level: 'Difícil'
    }
  }
};

/**
 * Instrucciones por fase
 */
const PHASE_INSTRUCTIONS = {
  first: [
    "Esta es la primera ronda de evaluación para determinar tu nivel actual",
    "Responde con calma, no hay prisa - el objetivo es conocer tu estado",
    "Si no sabes una respuesta, es mejor dejarla en blanco que adivinar",
    "Las preguntas están diseñadas para evaluar tus conocimientos base",
    "Esta evaluación ayudará a crear tu plan de estudio personalizado"
  ],
  second: [
    "Esta es la segunda ronda - refuerzo de áreas débiles",
    "Las preguntas se enfocan en los temas que necesitas mejorar",
    "Usa todo el tiempo disponible para pensar bien tus respuestas",
    "Esta fase te ayudará a consolidar tus conocimientos",
    "Las preguntas están adaptadas a tu nivel de la primera ronda"
  ],
  third: [
    "Esta es la tercera ronda - simulacro tipo ICFES",
    "Simula las condiciones reales del examen ICFES",
    "Administra bien tu tiempo - es crucial para el éxito",
    "Lee cuidadosamente cada pregunta antes de responder",
    "Esta es tu oportunidad de demostrar todo lo aprendido"
  ]
};

interface SubjectTopicRule {
  totalQuestions: number;
  perTopicTarget: number;
}

const SUBJECT_TOPIC_RULES: Record<string, SubjectTopicRule> = {
  'Lenguaje': { totalQuestions: 18, perTopicTarget: 6 },
  'Matemáticas': { totalQuestions: 18, perTopicTarget: 6 },
  'Ciencias Sociales': { totalQuestions: 20, perTopicTarget: 5 },
  'Biologia': { totalQuestions: 15, perTopicTarget: 6 },
  'Física': { totalQuestions: 15, perTopicTarget: 6 },
  'Quimica': { totalQuestions: 15, perTopicTarget: 6 },
};

/**
 * Servicio para generar cuestionarios dinámicamente
 */
class QuizGeneratorService {
  private static instance: QuizGeneratorService;

  static getInstance() {
    if (!QuizGeneratorService.instance) {
      QuizGeneratorService.instance = new QuizGeneratorService();
    }
    return QuizGeneratorService.instance;
  }

  /**
   * Obtiene todas las preguntas ya respondidas por el estudiante en fases anteriores
   */
  private async getAnsweredQuestions(
    studentId: string,
    subject: string,
    currentPhase: 'first' | 'second' | 'third'
  ): Promise<Set<string>> {
    const answeredQuestionIds = new Set<string>();
    
    try {
      const db = getFirestore(firebaseApp);
      
      // Determinar qué fases anteriores revisar
      const phasesToCheck: string[] = [];
      if (currentPhase === 'second') {
        // Fase 2: excluir preguntas de fase 1
        phasesToCheck.push('fase I');
      } else if (currentPhase === 'third') {
        // Fase 3: excluir preguntas de fase 1 y fase 2
        phasesToCheck.push('fase I', 'Fase II', 'fase II'); // Incluir ambas variantes de fase 2
      }
      
      // Obtener resultados de las fases anteriores
      for (const phaseName of phasesToCheck) {
        try {
          const phaseRef = collection(db, "results", studentId, phaseName);
          const phaseSnap = await getDocs(phaseRef);
          
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data();
            
            // Verificar que sea de la misma materia
            if (examData.subject && examData.subject.trim().toLowerCase() === subject.trim().toLowerCase()) {
              // Extraer IDs de preguntas de questionDetails
              if (examData.questionDetails && Array.isArray(examData.questionDetails)) {
                examData.questionDetails.forEach((detail: any) => {
                  if (detail.questionId) {
                    answeredQuestionIds.add(detail.questionId);
                  }
                  if (detail.questionCode) {
                    answeredQuestionIds.add(detail.questionCode);
                  }
                });
              }
              
              // También verificar en answers (estructura antigua)
              if (examData.answers && typeof examData.answers === 'object') {
                Object.keys(examData.answers).forEach(questionId => {
                  answeredQuestionIds.add(questionId);
                });
              }
            }
          });
        } catch (error) {
          console.warn(`⚠️ Error obteniendo resultados de ${phaseName}:`, error);
          // Continuar con otras fases aunque una falle
        }
      }
      
      console.log(`📋 Preguntas ya respondidas en fases anteriores para ${subject}: ${answeredQuestionIds.size}`);
    } catch (error) {
      console.error('❌ Error obteniendo preguntas respondidas:', error);
      // Retornar set vacío si hay error, para no bloquear la generación
    }
    
    return answeredQuestionIds;
  }

  /**
   * Genera un cuestionario dinámico basado en la materia y fase
   */
  async generateQuiz(
    subject: string,
    phase: 'first' | 'second' | 'third',
    grade?: string,
    studentId?: string
  ): Promise<Result<GeneratedQuiz>> {
    try {
      console.log(`🎯 Generando cuestionario: ${subject} - ${phase}${grade ? ` - Grado ${grade}` : ''}${studentId ? ` - Estudiante ${studentId}` : ''}`);

      // Obtener configuración para la materia y fase
      const config = this.getQuizConfig(subject, phase);
      if (!config) {
        return failure(new ErrorAPI({ message: `No se encontró configuración para ${subject} - ${phase}` }));
      }

      // Obtener preguntas ya respondidas en fases anteriores (solo si hay studentId y no es fase 1)
      let answeredQuestionIds = new Set<string>();
      if (studentId && phase !== 'first') {
        answeredQuestionIds = await this.getAnsweredQuestions(studentId, subject, phase);
        console.log(`🚫 Excluyendo ${answeredQuestionIds.size} preguntas ya respondidas en fases anteriores`);
      }

      // Lógica especial para Inglés: preguntas agrupadas por tema (aplica para todas las fases)
      if (subject === 'Inglés') {
        console.log(`🇬🇧 Aplicando lógica especial para Inglés con preguntas agrupadas`);
        const englishResult = await this.getEnglishGroupedQuestions(subject, config, grade, phase, answeredQuestionIds);
        if (!englishResult.success) {
          return failure(englishResult.error);
        }
        const sortedQuestions = englishResult.data;
        
        // Generar ID único para el cuestionario
        const quizId = this.generateQuizId(subject, phase, grade);

        // Crear el cuestionario
        const quiz: GeneratedQuiz = {
          id: quizId,
          title: this.generateQuizTitle(subject, phase),
          description: this.generateQuizDescription(subject, phase),
          subject: subject,
          subjectCode: this.getSubjectCode(subject),
          phase: phase,
          questions: sortedQuestions,
          timeLimit: config.timeLimit || 40,
          totalQuestions: sortedQuestions.length,
          instructions: PHASE_INSTRUCTIONS[phase],
          createdAt: new Date()
        };

        console.log(`✅ Cuestionario de Inglés generado: ${quiz.title} con ${sortedQuestions.length} preguntas agrupadas`);
        return success(quiz);
      }

      // Para Fase 3, usar distribución proporcional independiente por temas (excepto Inglés que ya se manejó arriba)
      if (phase === 'third') {
        console.log(`📊 Generando cuestionario Fase 3 con distribución proporcional por temas`);
        return await this.generatePhase3ProportionalQuiz(subject, config, grade, answeredQuestionIds);
      }

      // Para Fase 2, usar distribución personalizada si hay studentId
      if (phase === 'second' && studentId && subject !== 'Inglés') {
        console.log(`📊 Generando cuestionario personalizado Fase 2 para ${studentId}`);
        return await this.generatePersonalizedPhase2Quiz(subject, config, grade, studentId, answeredQuestionIds);
      }

      const subjectRule = SUBJECT_TOPIC_RULES[subject];
      const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

      let questions: Question[] = [];

      if (subjectRule) {
        console.log(`🧠 Aplicando reglas por tópico para ${subject}`);
        const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule, answeredQuestionIds);
        if (!topicResult.success) {
          console.warn('⚠️ No se pudieron aplicar reglas por tópico, usando búsqueda general', topicResult.error);
          const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds);
          if (!generalResult.success) {
            return failure(generalResult.error);
          }
          questions = generalResult.data;
        } else {
          questions = topicResult.data;
        }
      } else {
        const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds);
        if (!generalResult.success) {
          return failure(generalResult.error);
        }
        questions = generalResult.data;
      }

      if (questions.length < expectedCount) {
        console.warn(`⚠️ Sólo se obtuvieron ${questions.length} preguntas de ${expectedCount} solicitadas para ${subject}`);
      }

      // Ordenar preguntas agrupadas por orden de creación (más antigua primero)
      // Las preguntas agrupadas tienen el mismo informativeText (especialmente para inglés)
      const sortedQuestions = this.sortGroupedQuestionsByCreationOrder(questions, subject);

      // Generar ID único para el cuestionario
      const quizId = this.generateQuizId(subject, phase, grade);

      // Crear el cuestionario
      const quiz: GeneratedQuiz = {
        id: quizId,
        title: this.generateQuizTitle(subject, phase),
        description: this.generateQuizDescription(subject, phase),
        subject: subject,
        subjectCode: this.getSubjectCode(subject),
        phase: phase,
        questions: sortedQuestions,
        timeLimit: config.timeLimit || 40,
        totalQuestions: questions.length,
        instructions: PHASE_INSTRUCTIONS[phase],
        createdAt: new Date()
      };

      console.log(`✅ Cuestionario generado: ${quiz.title} con ${questions.length} preguntas`);
      return success(quiz);

    } catch (e) {
      console.error('❌ Error generando cuestionario:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar cuestionario')));
    }
  }

  private async getGeneralQuestions(
    subject: string,
    _config: Partial<QuizConfig>,
    grade: string | undefined,
    expectedCount: number,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<Question[]>> {
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = this.getSubjectCode(subject);
    const attempts: QuestionFilters[] = [
      ...gradeValues.map(gradeValue => ({
        subject,
        subjectCode,
        grade: gradeValue,
        limit: expectedCount * 4
      })),
      {
        subject,
        subjectCode,
        limit: expectedCount * 3
      },
      {
        subject,
        limit: expectedCount * 3
      }
    ];

    const questions = await this.fetchQuestionsWithFallback(attempts, expectedCount, excludeQuestionIds);

    if (questions.length === 0) {
      return failure(new ErrorAPI({
        message: `No hay suficientes preguntas de ${subject} disponibles en el banco de datos`
      }));
    }

    return success(questions);
  }

  private async getQuestionsWithTopicRules(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    rule: SubjectTopicRule,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<Question[]>> {
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig) {
      return failure(new ErrorAPI({ message: `No se encontró configuración de tópicos para ${subject}` }));
    }

    if (!subjectConfig.topics || subjectConfig.topics.length === 0) {
      return failure(new ErrorAPI({ message: `La materia ${subject} no tiene tópicos configurados` }));
    }

    const topicQuestionMap: Record<string, Question[]> = {};

    for (const topic of subjectConfig.topics) {
      const gradeValues = this.getGradeSearchValues(grade);
      const subjectCode = subjectConfig.code;
      const attempts: QuestionFilters[] = [
        ...gradeValues.flatMap(gradeValue => ([
          {
            subject,
            subjectCode,
            topicCode: topic.code,
            grade: gradeValue,
            limit: rule.perTopicTarget * 4
          },
          {
            subject,
            subjectCode,
            topic: topic.name,
            grade: gradeValue,
            limit: rule.perTopicTarget * 4
          }
        ])),
        {
          subject,
          subjectCode,
          topicCode: topic.code,
          limit: rule.perTopicTarget * 3
        },
        {
          subject,
          subjectCode,
          topic: topic.name,
          limit: rule.perTopicTarget * 3
        },
        {
          subject,
          topic: topic.name,
          limit: rule.perTopicTarget * 3
        }
      ];

      console.log(`🧩 Buscando preguntas para tópico ${topic.name} (${subject}) con ${attempts.length} intentos`);
      const topicQuestions = await this.fetchQuestionsWithFallback(attempts, rule.perTopicTarget, excludeQuestionIds);
      topicQuestionMap[topic.code] = topicQuestions;
      console.log(`✅ ${topicQuestions.length} preguntas almacenadas para ${topic.name}`);
    }

    let questions = this.balanceQuestionsByTopic(
      subjectConfig.topics.map(t => t.code),
      topicQuestionMap,
      rule.totalQuestions,
      rule.perTopicTarget
    );

    if (questions.length < rule.totalQuestions) {
      const missing = rule.totalQuestions - questions.length;
      console.warn(`⚠️ Faltan ${missing} preguntas para ${subject}, intentando completar con selección general`);

      const fallbackResult = await this.getGeneralQuestions(subject, config, grade, missing, excludeQuestionIds);
      if (fallbackResult.success && fallbackResult.data.length > 0) {
        const existingIds = new Set(questions.map(q => q.id || q.code));
        const extras = fallbackResult.data.filter(q => !existingIds.has(q.id || q.code));
        questions = this.shuffleArray([...questions, ...extras]).slice(0, rule.totalQuestions);
      }
    }

    if (questions.length === 0) {
      return failure(new ErrorAPI({ message: `No se encontraron preguntas para ${subject}` }));
    }

    return success(questions);
  }

  /**
   * Lógica especial para Inglés: selecciona 1 pregunta agrupada por cada uno de los 7 temas
   * Las preguntas agrupadas comparten el mismo informativeText
   */
  private async getEnglishGroupedQuestions(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    phase: 'first' | 'second' | 'third',
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<Question[]>> {
    const phaseLevel = phase === 'first' ? 'Fácil' : phase === 'second' ? 'Medio' : 'Difícil';
    console.log(`🇬🇧 Generando cuestionario de Inglés - Fase ${phase} (Nivel: ${phaseLevel}) con preguntas agrupadas por tema`);
    
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig || !subjectConfig.topics) {
      return failure(new ErrorAPI({ message: `No se encontró configuración de temas para ${subject}` }));
    }

    // Para Inglés son 7 temas, necesitamos 1 grupo de preguntas por tema
    const topics = subjectConfig.topics;
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = subjectConfig.code;
    const levelCode = config.level === 'Fácil' ? 'F' : config.level === 'Medio' ? 'M' : 'D';
    
    console.log(`📚 Buscando grupos de preguntas para ${topics.length} temas${phase === 'third' ? ' (Nivel: Difícil)' : ''}`);
    
    // Mapa para almacenar grupos de preguntas por tema
    const topicGroupsMap: Record<string, Question[][]> = {};

    // Para cada tema, buscar todas las preguntas agrupadas disponibles
    for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
      const topic = topics[topicIndex];
      console.log(`🔍 [${topicIndex + 1}/${topics.length}] Buscando grupos para: ${topic.name} (${topic.code})${phase === 'third' ? ' - Nivel Difícil' : ''}`);
      
      // Para Fase 3: buscar SOLO nivel Difícil (D) - optimizado con menos intentos
      // Para Fase 1 y 2: usar el nivel específico
      const attempts: QuestionFilters[] = phase === 'third' 
        ? [
            // Fase 3: Priorizar búsquedas más específicas primero (nivel Difícil)
            // 1. Intentar con grado específico + nivel Difícil + topicCode
            ...gradeValues.flatMap(gradeValue => ([
              {
                subject,
                subjectCode,
                topicCode: topic.code,
                grade: gradeValue,
                levelCode: 'D', // Fase 3: SOLO nivel Difícil
                limit: 60
              }
            ])),
            // 2. Intentar con grado específico + nivel Difícil + topic name
            ...gradeValues.flatMap(gradeValue => ([
              {
                subject,
                subjectCode,
                topic: topic.name,
                grade: gradeValue,
                levelCode: 'D',
                limit: 60
              }
            ])),
            // 3. Intentar sin grado + nivel Difícil + topicCode
            {
              subject,
              subjectCode,
              topicCode: topic.code,
              levelCode: 'D',
              limit: 60
            },
            // 4. Intentar sin grado + nivel Difícil + topic name
            {
              subject,
              subjectCode,
              topic: topic.name,
              levelCode: 'D',
              limit: 60
            },
            // 5. Fallback: sin nivel pero con topicCode (solo si no se encontró nada)
            ...gradeValues.flatMap(gradeValue => ([
              {
                subject,
                subjectCode,
                topicCode: topic.code,
                grade: gradeValue,
                limit: 40
              }
            ])),
            {
              subject,
              subjectCode,
              topicCode: topic.code,
              limit: 40
            }
          ]
        : [
            // Fase 1 y 2: usar nivel específico (optimizado)
            ...gradeValues.flatMap(gradeValue => ([
              {
                subject,
                subjectCode,
                topicCode: topic.code,
                grade: gradeValue,
                levelCode: phase === 'first' ? 'F' : levelCode,
                limit: 60
              },
              {
                subject,
                subjectCode,
                topic: topic.name,
                grade: gradeValue,
                levelCode: phase === 'first' ? 'F' : levelCode,
                limit: 60
              }
            ])),
            {
              subject,
              subjectCode,
              topicCode: topic.code,
              levelCode: phase === 'first' ? 'F' : levelCode,
              limit: 60
            },
            {
              subject,
              subjectCode,
              topic: topic.name,
              levelCode: phase === 'first' ? 'F' : levelCode,
              limit: 60
            }
          ];

      // Para Inglés: buscar grupos completos, no cantidad fija de preguntas
      // Buscar hasta encontrar al menos un grupo completo por tema y nivel
      let allQuestions: Question[] = [];
      let foundCompleteGroup = false;
      
      // Intentar cada filtro hasta encontrar un grupo completo
      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex++) {
        const filters = attempts[attemptIndex];
        const result = await questionService.getRandomQuestions(filters, 100);
        if (!result.success) {
          console.log(`   Intento ${attemptIndex + 1}/${attempts.length} fallido`);
          continue;
        }

        // Filtrar solo preguntas agrupadas (que tienen informativeText) y que no hayan sido respondidas
        const filtered = result.data.filter(q => 
          q.subjectCode === 'IN' && 
          q.informativeText && 
          q.informativeText.trim() !== '' &&
          !excludeQuestionIds.has(q.id || q.code)
        );

        // Agregar a la colección sin duplicados
        const existingIds = new Set(allQuestions.map(q => q.id || q.code));
        const newQuestions = filtered.filter(q => !existingIds.has(q.id || q.code));
        allQuestions.push(...newQuestions);

        // Verificar si hay al menos un grupo completo (agrupar temporalmente para verificar)
        const tempGroupsMap: { [key: string]: Question[] } = {};
        allQuestions.forEach(question => {
          const groupKey = `${question.informativeText}_${topic.code}_${question.grade}_${question.levelCode}_${JSON.stringify(question.informativeImages || [])}`;
          if (!tempGroupsMap[groupKey]) {
            tempGroupsMap[groupKey] = [];
          }
          tempGroupsMap[groupKey].push(question);
        });

        const tempGroups = Object.values(tempGroupsMap).filter(group => group.length > 0);
        if (tempGroups.length > 0) {
          foundCompleteGroup = true;
          console.log(`   ✅ Grupo completo encontrado en intento ${attemptIndex + 1}/${attempts.length}`);
          break; // Detener búsqueda al encontrar al menos un grupo
        } else {
          console.log(`   Intento ${attemptIndex + 1}/${attempts.length}: ${newQuestions.length} preguntas nuevas, aún sin grupo completo`);
        }
      }

      // Si no se encontró grupo en los intentos específicos, usar fallback
      if (!foundCompleteGroup && allQuestions.length === 0) {
        console.warn(`   ⚠️ No se encontraron grupos con filtros específicos, usando búsqueda general`);
        const fallbackResult = await this.fetchQuestionsWithFallback(attempts.slice(0, 2), 30, excludeQuestionIds);
        allQuestions = fallbackResult.filter(q => 
          q.subjectCode === 'IN' && 
          q.informativeText && 
          q.informativeText.trim() !== '' &&
          !excludeQuestionIds.has(q.id || q.code)
        );
      }

      // Agrupar todas las preguntas encontradas (una sola vez al final)
      const groupsMap: { [key: string]: Question[] } = {};
      allQuestions.forEach(question => {
        // Clave única para el grupo: informativeText + tema + grado + nivel + imágenes
        const groupKey = `${question.informativeText}_${topic.code}_${question.grade}_${question.levelCode}_${JSON.stringify(question.informativeImages || [])}`;
        if (!groupsMap[groupKey]) {
          groupsMap[groupKey] = [];
        }
        groupsMap[groupKey].push(question);
      });

      // Convertir el mapa en un array de grupos
      const groups = Object.values(groupsMap).filter(group => group.length > 0);
      
      // Ordenar las preguntas dentro de cada grupo por fecha de creación
      groups.forEach(group => {
        group.sort((a, b) => {
          // Ordenar por número de hueco si es cloze test
          const aMatch = a.questionText?.match(/hueco \[(\d+)\]/);
          const bMatch = b.questionText?.match(/hueco \[(\d+)\]/);
          if (aMatch && bMatch) {
            return parseInt(aMatch[1]) - parseInt(bMatch[1]);
          }
          
          // Ordenar por fecha de creación
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          if (dateA !== dateB) {
            return dateA - dateB;
          }
          
          return a.code.localeCompare(b.code);
        });
      });

      topicGroupsMap[topic.code] = groups;
      const totalQuestionsInGroups = groups.reduce((sum, group) => sum + group.length, 0);
      if (groups.length > 0) {
        console.log(`✅ [${topicIndex + 1}/${topics.length}] ${groups.length} grupo(s) completo(s) encontrado(s) para ${topic.name} (${totalQuestionsInGroups} preguntas en total)`);
      } else {
        console.warn(`⚠️ [${topicIndex + 1}/${topics.length}] No se encontraron grupos completos para ${topic.name}`);
      }
    }

    // Seleccionar 1 grupo aleatorio de cada tema
    const selectedGroups: Question[][] = [];
    const usedGroupKeys = new Set<string>();

    for (const topic of topics) {
      const groups = topicGroupsMap[topic.code] || [];
      if (groups.length === 0) {
        console.warn(`⚠️ No se encontraron grupos de preguntas para el tema ${topic.name}`);
        continue;
      }

      // Mezclar los grupos para selección aleatoria
      const shuffledGroups = this.shuffleArray(groups);
      
      // Seleccionar el primer grupo disponible (ya está mezclado)
      const selectedGroup = shuffledGroups[0];
      
      // Verificar que no sea un grupo duplicado (mismo informativeText)
      const groupKey = `${selectedGroup[0]?.informativeText}_${selectedGroup[0]?.topicCode}_${selectedGroup[0]?.grade}_${selectedGroup[0]?.levelCode}`;
      if (!usedGroupKeys.has(groupKey)) {
        selectedGroups.push(selectedGroup);
        usedGroupKeys.add(groupKey);
        console.log(`✅ Seleccionado 1 grupo de ${selectedGroup.length} preguntas para ${topic.name}`);
      } else {
        // Si ya usamos este grupo, intentar con otro
        const alternativeGroup = shuffledGroups.find(g => {
          const key = `${g[0]?.informativeText}_${g[0]?.topicCode}_${g[0]?.grade}_${g[0]?.levelCode}`;
          return !usedGroupKeys.has(key);
        });
        
        if (alternativeGroup) {
          selectedGroups.push(alternativeGroup);
          const altKey = `${alternativeGroup[0]?.informativeText}_${alternativeGroup[0]?.topicCode}_${alternativeGroup[0]?.grade}_${alternativeGroup[0]?.levelCode}`;
          usedGroupKeys.add(altKey);
          console.log(`✅ Seleccionado grupo alternativo de ${alternativeGroup.length} preguntas para ${topic.name}`);
        } else {
          console.warn(`⚠️ No se encontró grupo alternativo para ${topic.name}, usando el disponible`);
          selectedGroups.push(selectedGroup);
        }
      }
    }

    if (selectedGroups.length === 0) {
      return failure(new ErrorAPI({ 
        message: 'No se encontraron grupos de preguntas agrupadas para Inglés. Asegúrate de que existen preguntas con informativeText para todos los temas.' 
      }));
    }

    // Mezclar aleatoriamente el orden de los grupos (para que cada estudiante tenga orden diferente)
    const shuffledSelectedGroups = this.shuffleArray(selectedGroups);

    // Aplanar los grupos en un solo array de preguntas
    const finalQuestions: Question[] = [];
    shuffledSelectedGroups.forEach(group => {
      finalQuestions.push(...group);
    });

    console.log(`✅ Cuestionario de Inglés generado con ${selectedGroups.length} grupos de preguntas (${finalQuestions.length} preguntas en total)`);
    return success(finalQuestions);
  }

  private balanceQuestionsByTopic(
    topicCodes: string[],
    topicQuestionMap: Record<string, Question[]>,
    totalTarget: number,
    perTopicTarget: number
  ): Question[] {
    type TopicQuestion = { topicCode: string; question: Question };

    const topicEntries = topicCodes.map(code => ({
      code,
      questions: this.shuffleArray(topicQuestionMap[code] || [])
    }));

    const selected: TopicQuestion[] = [];
    const leftovers: Record<string, Question[]> = {};

    for (const entry of topicEntries) {
      const target = Math.min(perTopicTarget, entry.questions.length);
      const initial = entry.questions.slice(0, target);
      initial.forEach((question: Question) => selected.push({ topicCode: entry.code, question }));
      leftovers[entry.code] = entry.questions.slice(target);
    }

    // Completar con preguntas restantes si todavía faltan
    let index = 0;
    while (selected.length < totalTarget && topicEntries.some(entry => (leftovers[entry.code] || []).length > 0)) {
      const entry = topicEntries[index % topicEntries.length];
      if (leftovers[entry.code] && leftovers[entry.code].length > 0) {
        const question = leftovers[entry.code].shift()!;
        selected.push({ topicCode: entry.code, question });
      }
      index++;
    }

    if (selected.length === 0) {
      return [];
    }

    // Reducir hasta alcanzar la cantidad objetivo, intentando mantener equilibrio
    while (selected.length > totalTarget) {
      const counts = selected.reduce<Record<string, number>>((acc, item) => {
        acc[item.topicCode] = (acc[item.topicCode] || 0) + 1;
        return acc;
      }, {});

      const candidates = Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

      const topicToReduce = (candidates[0]?.[0]) || Object.entries(counts)[0][0];
      const indices = selected
        .map((item, idx) => (item.topicCode === topicToReduce ? idx : -1))
        .filter(idx => idx !== -1);

      const removeIndex = indices[Math.floor(Math.random() * indices.length)];
      selected.splice(removeIndex, 1);
    }

    return this.shuffleArray(selected.map(item => item.question));
  }

  private dedupeQuestions(questions: Question[]): Question[] {
    const map = new Map<string, Question>();
    questions.forEach(question => {
      const key = question.id || question.code;
      if (!map.has(key)) {
        map.set(key, question);
      }
    });
    return Array.from(map.values());
  }

  private getGradeSearchValues(grade?: string): string[] {
    if (!grade) {
      return [];
    }

    const values = new Set<string>();
    const cleaned = grade.toString().trim();
    if (!cleaned) {
      return [];
    }

    values.add(cleaned);

    const codeFromInput = this.toGradeCode(cleaned);
    if (codeFromInput) {
      values.add(codeFromInput);
      const name = GRADE_CODE_TO_NAME[codeFromInput];
      if (name) {
        values.add(name);
      }
      const numeric = this.gradeCodeToNumeric(codeFromInput);
      if (numeric) {
        values.add(numeric);
        values.add(`${numeric}°`);
      }
    }

    const numericFromInput = this.extractNumericGrade(cleaned);
    if (numericFromInput) {
      values.add(numericFromInput);
      values.add(`${numericFromInput}°`);
      const codeFromNumeric = this.numericToGradeCode(numericFromInput);
      if (codeFromNumeric) {
        values.add(codeFromNumeric);
        const name = GRADE_CODE_TO_NAME[codeFromNumeric];
        if (name) {
          values.add(name);
        }
      }
    }

    Object.entries(GRADE_MAPPING).forEach(([name, code]) => {
      if (name.toLowerCase() === cleaned.toLowerCase()) {
        values.add(name);
        values.add(code);
        const numeric = this.gradeCodeToNumeric(code);
        if (numeric) {
          values.add(numeric);
          values.add(`${numeric}°`);
        }
      }
    });

    return Array.from(values).filter(Boolean);
  }

  private toGradeCode(value: string): string | null {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.length === 1 && GRADE_CODE_TO_NAME[trimmed]) {
      return trimmed;
    }

    const lower = trimmed.toLowerCase();
    const mappingEntry = Object.entries(GRADE_MAPPING).find(([name]) => name.toLowerCase() === lower);
    if (mappingEntry) {
      return mappingEntry[1];
    }

    const numeric = this.extractNumericGrade(trimmed);
    if (numeric) {
      return this.numericToGradeCode(numeric);
    }

    return null;
  }

  private extractNumericGrade(value: string): string | null {
    const match = value.match(/\d+/);
    if (!match) return null;
    return match[0];
  }

  private numericToGradeCode(numeric: string): string | null {
    if (!numeric) return null;
    switch (numeric) {
      case '10':
        return '0';
      case '11':
        return '1';
      case '6':
      case '7':
      case '8':
      case '9':
        return numeric;
      default:
        return null;
    }
  }

  private gradeCodeToNumeric(code: string): string | null {
    switch (code) {
      case '0':
        return '10';
      case '1':
        return '11';
      case '6':
      case '7':
      case '8':
      case '9':
        return code;
      default:
        return null;
    }
  }

  private async fetchQuestionsWithFallback(
    attempts: QuestionFilters[],
    expectedCount: number,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Question[]> {
    const collected = new Map<string, Question>();

    for (const [index, filters] of attempts.entries()) {
      const result = await questionService.getRandomQuestions(filters, expectedCount * 2); // Obtener más para tener opciones después de filtrar
      if (!result.success) {
        console.warn(`⚠️ Intento ${index + 1} fallido con filtros`, filters, result.error);
        continue;
      }

      // Filtrar preguntas ya respondidas
      const filtered = result.data.filter(q => {
        const key = q.id || q.code;
        return !excludeQuestionIds.has(key);
      });

      const deduped = this.dedupeQuestions(filtered);
      console.log(`🔎 Intento ${index + 1}: ${deduped.length} preguntas obtenidas (${result.data.length} totales, ${result.data.length - filtered.length} excluidas) con filtros`, filters);

      for (const question of deduped) {
        const key = question.id || question.code;
        if (!collected.has(key) && !excludeQuestionIds.has(key)) {
          collected.set(key, question);
        }
        if (collected.size >= expectedCount) {
          break;
        }
      }

      if (collected.size >= expectedCount) {
        break;
      }
    }

    return this.shuffleArray(Array.from(collected.values())).slice(0, expectedCount);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Ordena las preguntas agrupadas por orden de creación (más antigua primero)
   * Mantiene el orden dentro de cada grupo basado en fecha de creación
   */
  private sortGroupedQuestionsByCreationOrder(questions: Question[], subject: string): Question[] {
    // Solo aplicar para inglés que tiene preguntas agrupadas
    if (subject !== 'Inglés') {
      return questions;
    }

    // Agrupar preguntas por informativeText (para preguntas agrupadas)
    const groupedMap: { [key: string]: Question[] } = {};
    const ungrouped: Question[] = [];

    questions.forEach(question => {
      if (question.informativeText && question.subjectCode === 'IN') {
        const groupKey = `${question.informativeText}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`;
        if (!groupedMap[groupKey]) {
          groupedMap[groupKey] = [];
        }
        groupedMap[groupKey].push(question);
      } else {
        ungrouped.push(question);
      }
    });

    // Ordenar preguntas dentro de cada grupo por fecha de creación
    Object.keys(groupedMap).forEach(groupKey => {
      groupedMap[groupKey].sort((a, b) => {
        // Primero, intentar ordenar por número de hueco si ambas son cloze test
        const aMatch = a.questionText?.match(/hueco \[(\d+)\]/);
        const bMatch = b.questionText?.match(/hueco \[(\d+)\]/);
        if (aMatch && bMatch) {
          return parseInt(aMatch[1]) - parseInt(bMatch[1]);
        }

        // Si no tienen número de hueco, ordenar por fecha de creación ascendente
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (dateA !== dateB) {
          return dateA - dateB; // Más antigua primero (orden de inserción)
        }

        // Si tienen la misma fecha, ordenar por código
        return a.code.localeCompare(b.code);
      });
    });

    // Reconstruir el array con grupos ordenados y preguntas no agrupadas
    // Mantener el orden original mezclado pero con grupos ordenados internamente
    const result: Question[] = [];
    const processedIds = new Set<string>();

    questions.forEach(question => {
      if (processedIds.has(question.id || question.code)) {
        return;
      }

      if (question.informativeText && question.subjectCode === 'IN') {
        const groupKey = `${question.informativeText}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`;
        const group = groupedMap[groupKey];
        if (group) {
          result.push(...group);
          group.forEach(q => processedIds.add(q.id || q.code));
        }
      } else {
        result.push(question);
        processedIds.add(question.id || question.code);
      }
    });

    return result;
  }

  /**
   * Obtiene la configuración para una materia y fase específica
   */
  private getQuizConfig(subject: string, phase: string): Partial<QuizConfig> | null {
    const subjectConfig = QUIZ_CONFIGURATIONS[subject];
    if (!subjectConfig) {
      return null;
    }

    const phaseConfig = subjectConfig[phase];
    if (!phaseConfig) {
      return null;
    }

    return {
      subject,
      subjectCode: this.getSubjectCode(subject),
      phase: phase as 'first' | 'second' | 'third',
      ...phaseConfig
    };
  }

  /**
   * Obtiene el código de una materia
   */
  private getSubjectCode(subject: string): string {
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    return subjectConfig?.code || 'XX';
  }

  /**
   * Genera un ID único para el cuestionario
   */
  private generateQuizId(subject: string, phase: string, grade?: string): string {
    const subjectCode = this.getSubjectCode(subject);
    const phaseCode = phase === 'first' ? '1' : phase === 'second' ? '2' : '3';
    const gradeCode = grade || 'X';
    const timestamp = Date.now().toString().slice(-6);
    
    return `${subjectCode}${phaseCode}${gradeCode}${timestamp}`;
  }

  /**
   * Genera el título del cuestionario
   */
  private generateQuizTitle(subject: string, phase: string): string {
    const phaseNames = {
      first: 'Primera Ronda - Evaluación Inicial',
      second: 'Segunda Ronda - Refuerzo',
      third: 'Tercera Ronda - Simulacro ICFES'
    };

    return `${subject} - ${phaseNames[phase as keyof typeof phaseNames]}`;
  }

  /**
   * Genera la descripción del cuestionario
   */
  private generateQuizDescription(subject: string, phase: string): string {
    const descriptions = {
      first: `Evaluación inicial de ${subject} para determinar tu nivel actual y crear un plan de estudio personalizado.`,
      second: `Refuerzo de áreas débiles en ${subject} basado en tu rendimiento en la primera ronda.`,
      third: `Simulacro tipo ICFES de ${subject} para evaluar tu preparación final.`
    };

    return descriptions[phase as keyof typeof descriptions];
  }

  /**
   * Genera un cuestionario personalizado para Fase 2 basado en debilidades
   */
  private async generatePersonalizedPhase2Quiz(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    studentId: string,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<GeneratedQuiz>> {
    try {
      // Obtener distribución personalizada
      const totalQuestions = config.questionCount || 18;
      const distributionResult = await phaseAnalysisService.generatePhase2Distribution(
        studentId,
        subject,
        totalQuestions
      );

      if (!distributionResult.success) {
        console.warn('⚠️ No se pudo obtener distribución personalizada, usando distribución estándar');
        // Fallback a distribución estándar
        return this.generateStandardPhase2Quiz(subject, config, grade);
      }

      const distribution = distributionResult.data;
      const questions: Question[] = [];

      // Obtener preguntas de la debilidad principal (50%)
      const primaryWeaknessQuestions = await this.getQuestionsForTopic(
        subject,
        distribution.primaryWeakness,
        distribution.primaryWeaknessCount,
        grade,
        config.level || 'Medio',
        excludeQuestionIds
      );
      questions.push(...primaryWeaknessQuestions);

      // Obtener preguntas de otros temas (50% distribuido equitativamente)
      if (distribution.otherTopics.length > 0) {
        const baseQuestionsPerTopic = Math.floor(distribution.otherTopicsCount / distribution.otherTopics.length);
        const remainder = distribution.otherTopicsCount % distribution.otherTopics.length;
        
        // Distribuir equitativamente, asignando el resto a los primeros temas
        for (let i = 0; i < distribution.otherTopics.length; i++) {
          const topic = distribution.otherTopics[i];
          const questionsForThisTopic = baseQuestionsPerTopic + (i < remainder ? 1 : 0);
          
          if (questionsForThisTopic > 0) {
            const topicQuestions = await this.getQuestionsForTopic(
              subject,
              topic,
              questionsForThisTopic,
              grade,
              config.level || 'Medio',
              excludeQuestionIds
            );
            questions.push(...topicQuestions);
          }
        }
      } else {
        // Caso edge: solo hay 1 tema (la debilidad principal)
        // En este caso, usar distribución estándar
        console.warn(`⚠️ Solo hay 1 tema en ${subject}, usando distribución estándar`);
        return this.generateStandardPhase2Quiz(subject, config, grade, excludeQuestionIds);
      }

      // Mezclar preguntas
      const shuffledQuestions = this.shuffleArray(questions);

      // Generar ID único para el cuestionario
      const quizId = this.generateQuizId(subject, 'second', grade);

      // Crear el cuestionario
      const quiz: GeneratedQuiz = {
        id: quizId,
        title: this.generateQuizTitle(subject, 'second'),
        description: `Refuerzo personalizado de ${subject} enfocado en ${distribution.primaryWeakness}`,
        subject: subject,
        subjectCode: this.getSubjectCode(subject),
        phase: 'second',
        questions: shuffledQuestions,
        timeLimit: config.timeLimit || 50,
        totalQuestions: shuffledQuestions.length,
        instructions: PHASE_INSTRUCTIONS.second,
        createdAt: new Date()
      };

      console.log(`✅ Cuestionario personalizado Fase 2 generado: ${quiz.title} con ${shuffledQuestions.length} preguntas`);
      console.log(`   - ${distribution.primaryWeaknessCount} preguntas de ${distribution.primaryWeakness}`);
      console.log(`   - ${distribution.otherTopicsCount} preguntas distribuidas en otros temas`);
      return success(quiz);
    } catch (e) {
      console.error('❌ Error generando cuestionario personalizado Fase 2:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar cuestionario personalizado Fase 2')));
    }
  }

  /**
   * Genera cuestionario estándar para Fase 2 (fallback)
   */
  private async generateStandardPhase2Quiz(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<GeneratedQuiz>> {
    const subjectRule = SUBJECT_TOPIC_RULES[subject];
    const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

    let questions: Question[] = [];

    if (subjectRule) {
      const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule, excludeQuestionIds);
      if (topicResult.success) {
        questions = topicResult.data;
      } else {
        const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, excludeQuestionIds);
        if (generalResult.success) {
          questions = generalResult.data;
        }
      }
    } else {
      const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, excludeQuestionIds);
      if (generalResult.success) {
        questions = generalResult.data;
      }
    }

    const quizId = this.generateQuizId(subject, 'second', grade);
    const quiz: GeneratedQuiz = {
      id: quizId,
      title: this.generateQuizTitle(subject, 'second'),
      description: this.generateQuizDescription(subject, 'second'),
      subject: subject,
      subjectCode: this.getSubjectCode(subject),
      phase: 'second',
      questions: questions,
      timeLimit: config.timeLimit || 50,
      totalQuestions: questions.length,
      instructions: PHASE_INSTRUCTIONS.second,
      createdAt: new Date()
    };

    return success(quiz);
  }

  /**
   * Obtiene preguntas para un tema específico
   */
  private async getQuestionsForTopic(
    subject: string,
    topic: string,
    count: number,
    grade: string | undefined,
    level: string,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Question[]> {
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig) {
      return [];
    }

    const topicConfig = subjectConfig.topics?.find(t => t.name === topic);
    const topicCode = topicConfig?.code || '';
    const levelCode = level === 'Fácil' ? 'F' : level === 'Medio' ? 'M' : 'D';
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = subjectConfig.code;

    const attempts: QuestionFilters[] = [
      ...gradeValues.flatMap(gradeValue => ([
        {
          subject,
          subjectCode,
          topicCode,
          topic,
          grade: gradeValue,
          levelCode,
          limit: count * 3
        }
      ])),
      {
        subject,
        subjectCode,
        topicCode,
        topic,
        levelCode,
        limit: count * 2
      },
      {
        subject,
        topic,
        levelCode,
        limit: count * 2
      }
    ];

    const questions = await this.fetchQuestionsWithFallback(attempts, count, excludeQuestionIds);
    return questions;
  }

  /**
   * Obtiene preguntas variadas para un tema específico (sin filtrar por nivel)
   * Usado en Fase 3 para obtener preguntas de cualquier nivel
   */
  private async getQuestionsForTopicVaried(
    subject: string,
    topic: string,
    count: number,
    grade: string | undefined,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Question[]> {
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig) {
      return [];
    }

    const topicConfig = subjectConfig.topics?.find(t => t.name === topic);
    const topicCode = topicConfig?.code || '';
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = subjectConfig.code;

    // Intentar obtener preguntas sin filtrar por nivel (variadas)
    const attempts: QuestionFilters[] = [
      // Intentar con grado específico, sin nivel
      ...gradeValues.flatMap(gradeValue => ([
        {
          subject,
          subjectCode,
          topicCode,
          topic,
          grade: gradeValue,
          limit: count * 4
        }
      ])),
      // Intentar sin grado, sin nivel
      {
        subject,
        subjectCode,
        topicCode,
        topic,
        limit: count * 3
      },
      {
        subject,
        topic,
        limit: count * 3
      },
      // Fallback: intentar con cada nivel individualmente
      ...gradeValues.flatMap(gradeValue => 
        ['F', 'M', 'D'].flatMap(levelCode => ([
          {
            subject,
            subjectCode,
            topicCode,
            topic,
            grade: gradeValue,
            levelCode,
            limit: Math.ceil(count / 3) * 2
          }
        ]))
      ),
      ...['F', 'M', 'D'].flatMap(levelCode => ([
        {
          subject,
          subjectCode,
          topicCode,
          topic,
          levelCode,
          limit: Math.ceil(count / 3) * 2
        }
      ]))
    ];

    const questions = await this.fetchQuestionsWithFallback(attempts, count, excludeQuestionIds);
    return questions;
  }

  /**
   * Genera un cuestionario para Fase 3 con distribución exacta: 10 preguntas por tema
   * Total = número de temas × 10
   * Esta fase es independiente y no depende de análisis de fases anteriores
   */
  private async generatePhase3ProportionalQuiz(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Result<GeneratedQuiz>> {
    try {
      console.log(`🎯 Generando cuestionario Fase 3 para ${subject}`);

      // Obtener configuración de la materia
      const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
      if (!subjectConfig || !subjectConfig.topics || subjectConfig.topics.length === 0) {
        return failure(new ErrorAPI({ 
          message: `No se encontró configuración de temas para ${subject}` 
        }));
      }

      const topics = subjectConfig.topics;
      const questionsPerTopic = 10; // Cada tema tiene exactamente 10 preguntas
      const totalQuestionsRequired = topics.length * questionsPerTopic; // Total = temas × 10
      
      console.log(`📚 Materia: ${subject} con ${topics.length} temas`);
      console.log(`📊 Total requerido: ${totalQuestionsRequired} preguntas (${questionsPerTopic} por tema)`);

      // Paso 1: Obtener preguntas de cada tema (intentar obtener más para tener opciones)
      const topicQuestionsMap: Record<string, Question[]> = {};
      
      for (const topic of topics) {
        console.log(`🔍 Obteniendo preguntas variadas para tema: ${topic.name} (${topic.code})`);
        
        // Intentar obtener más preguntas de las necesarias para tener opciones y poder redistribuir
        const topicQuestions = await this.getQuestionsForTopicVaried(
          subject,
          topic.name,
          questionsPerTopic * 3, // Intentar obtener 3 veces más para tener opciones
          grade,
          excludeQuestionIds
        );
        
        topicQuestionsMap[topic.code] = topicQuestions;
        console.log(`✅ ${topicQuestions.length} preguntas obtenidas para ${topic.name}`);
      }

      // Paso 2: Distribuir preguntas intentando dar 10 a cada tema
      const questionsByTopic: Record<string, Question[]> = {};
      const selectedIds = new Set<string>();
      
      // Primera pasada: asignar hasta 10 preguntas a cada tema
      for (const topic of topics) {
        const available = topicQuestionsMap[topic.code] || [];
        const shuffled = this.shuffleArray([...available]);
        const selected: Question[] = [];
        
        for (const question of shuffled) {
          const key = question.id || question.code;
          if (!selectedIds.has(key) && selected.length < questionsPerTopic) {
            selected.push(question);
            selectedIds.add(key);
          }
        }
        
        questionsByTopic[topic.code] = selected;
      }

      // Paso 3: Si algún tema no tiene 10 preguntas, completar con preguntas de otros temas
      for (const topic of topics) {
        const current = questionsByTopic[topic.code]?.length || 0;
        if (current < questionsPerTopic) {
          // Buscar preguntas adicionales de otros temas de la misma materia
          for (const otherTopic of topics) {
            if (otherTopic.code === topic.code) continue; // Saltar el mismo tema
            
            const otherQuestions = topicQuestionsMap[otherTopic.code] || [];
            const available = otherQuestions.filter(q => {
              const key = q.id || q.code;
              return !selectedIds.has(key);
            });
            
            if (available.length > 0 && questionsByTopic[topic.code].length < questionsPerTopic) {
              const shuffled = this.shuffleArray([...available]);
              const needed = questionsPerTopic - questionsByTopic[topic.code].length;
              const toAdd = shuffled.slice(0, Math.min(needed, available.length));
              
              for (const question of toAdd) {
                const key = question.id || question.code;
                if (!selectedIds.has(key)) {
                  questionsByTopic[topic.code].push(question);
                  selectedIds.add(key);
                }
              }
            }
            
            // Si ya completamos las 10 preguntas, salir del bucle
            if (questionsByTopic[topic.code].length >= questionsPerTopic) {
              break;
            }
          }
        }
      }

      // Paso 4: Recolectar todas las preguntas seleccionadas
      const selectedQuestions: Question[] = [];
      for (const topic of topics) {
        const questions = questionsByTopic[topic.code] || [];
        selectedQuestions.push(...questions);
      }

      // Verificar que se obtuvieron preguntas
      if (selectedQuestions.length === 0) {
        return failure(new ErrorAPI({ 
          message: `No se encontraron preguntas disponibles para ${subject} en Fase 3` 
        }));
      }

      // Paso 5: Mezclar todas las preguntas para orden aleatorio
      const finalQuestions = this.shuffleArray(selectedQuestions);

      // Generar ID único para el cuestionario
      const quizId = this.generateQuizId(subject, 'third', grade);

      // Crear el cuestionario
      const quiz: GeneratedQuiz = {
        id: quizId,
        title: this.generateQuizTitle(subject, 'third'),
        description: this.generateQuizDescription(subject, 'third'),
        subject: subject,
        subjectCode: this.getSubjectCode(subject),
        phase: 'third',
        questions: finalQuestions,
        timeLimit: config.timeLimit || 60,
        totalQuestions: finalQuestions.length,
        instructions: PHASE_INSTRUCTIONS.third,
        createdAt: new Date()
      };

      console.log(`✅ Cuestionario Fase 3 generado: ${quiz.title} con ${finalQuestions.length} preguntas`);
      console.log(`📊 Distribución final por temas:`);
      for (const topic of topics) {
        const count = finalQuestions.filter(q => 
          q.topic === topic.name || q.topicCode === topic.code
        ).length;
        console.log(`   - ${topic.name}: ${count} preguntas`);
      }

      return success(quiz);
    } catch (e) {
      console.error('❌ Error generando cuestionario Fase 3:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar cuestionario Fase 3')));
    }
  }

  /**
   * Obtiene todas las configuraciones disponibles
   */
  getAvailableConfigurations(): Record<string, Record<string, Partial<QuizConfig>>> {
    return QUIZ_CONFIGURATIONS;
  }

  /**
   * Verifica si una materia tiene configuración para una fase específica
   */
  hasConfiguration(subject: string, phase: string): boolean {
    const subjectConfig = QUIZ_CONFIGURATIONS[subject];
    return !!(subjectConfig && subjectConfig[phase]);
  }

  /**
   * Obtiene las materias disponibles
   */
  getAvailableSubjects(): string[] {
    return Object.keys(QUIZ_CONFIGURATIONS);
  }

  /**
   * Obtiene las fases disponibles para una materia
   */
  getAvailablePhases(subject: string): string[] {
    const subjectConfig = QUIZ_CONFIGURATIONS[subject];
    return subjectConfig ? Object.keys(subjectConfig) : [];
  }
}

export const quizGeneratorService = QuizGeneratorService.getInstance();
