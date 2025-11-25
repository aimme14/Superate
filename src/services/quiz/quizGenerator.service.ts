import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME, GRADE_MAPPING } from '@/utils/subjects.config';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { phaseAnalysisService } from '@/services/phase/phaseAnalysis.service';
import { questionTrackingService } from './questionTracking.service';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { dbService } from '@/services/firebase/db.service';

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
      questionCount: 18, // 6 Álgebra/Cálculo + 6 Geometría + 6 Estadística
      timeLimit: 45,
      level: 'Fácil'
    },
    second: {
      questionCount: 18, // Mismas cantidades que Fase 1
      timeLimit: 50,
      level: 'Medio'
    },
    third: {
      questionCount: 30, // 10 Álgebra/Cálculo + 10 Geometría + 10 Estadística
      timeLimit: 60,
      level: 'Difícil'
    }
  },
  'Lenguaje': {
    first: {
      questionCount: 18, // 6 por cada tema (3 temas)
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 18, // Mismas cantidades que Fase 1
      timeLimit: 45,
      level: 'Medio'
    },
    third: {
      questionCount: 36, // 12 por cada tema (3 temas)
      timeLimit: 55,
      level: 'Difícil'
    }
  },
  'Ciencias Sociales': {
    first: {
      questionCount: 20, // 5 por cada tema (4 temas)
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 20, // Mismas cantidades que Fase 1
      timeLimit: 45,
      level: 'Medio'
    },
    third: {
      questionCount: 40, // 10 por cada tema (4 temas)
      timeLimit: 50,
      level: 'Difícil'
    }
  },
  'Biologia': {
    first: {
      questionCount: 15, // 5 por cada tema (3 temas)
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 15, // Mismas cantidades que Fase 1
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 30, // 10 por cada tema (3 temas)
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Quimica': {
    first: {
      questionCount: 20, // 5 por cada tema (4 temas)
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 20, // Mismas cantidades que Fase 1
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 40, // 10 por cada tema (4 temas)
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Física': {
    first: {
      questionCount: 20, // 5 por cada tema (4 temas)
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 20, // Mismas cantidades que Fase 1
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 40, // 10 por cada tema (4 temas)
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Inglés': {
    first: {
      questionCount: 7, // 1 pregunta agrupada por tema (7 temas), nivel Fácil
      timeLimit: 30,
      level: 'Fácil'
    },
    second: {
      questionCount: 7, // Misma cantidad, nivel Medio
      timeLimit: 35,
      level: 'Medio'
    },
    third: {
      questionCount: 7, // Misma cantidad, nivel Difícil
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

/**
 * Configuración de cantidades por tema según la fase
 */
interface PhaseTopicDistribution {
  first: { totalQuestions: number; perTopicTarget: number };
  second: { totalQuestions: number; perTopicTarget: number };
  third: { totalQuestions: number; perTopicTarget: number };
}

const SUBJECT_PHASE_DISTRIBUTIONS: Record<string, PhaseTopicDistribution> = {
  'Lenguaje': {
    first: { totalQuestions: 18, perTopicTarget: 6 }, // 6 por cada tema (3 temas)
    second: { totalQuestions: 18, perTopicTarget: 6 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 36, perTopicTarget: 12 } // 12 por cada tema (3 temas)
  },
  'Matemáticas': {
    first: { totalQuestions: 18, perTopicTarget: 6 }, // 6 por cada tema (3 temas: Álgebra/Cálculo, Geometría, Estadística)
    second: { totalQuestions: 18, perTopicTarget: 6 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 30, perTopicTarget: 10 } // 10 por cada tema (3 temas)
  },
  'Ciencias Sociales': {
    first: { totalQuestions: 20, perTopicTarget: 5 }, // 5 por cada tema (4 temas)
    second: { totalQuestions: 20, perTopicTarget: 5 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 40, perTopicTarget: 10 } // 10 por cada tema (4 temas)
  },
  'Biologia': {
    first: { totalQuestions: 15, perTopicTarget: 5 }, // 5 por cada tema (3 temas)
    second: { totalQuestions: 15, perTopicTarget: 5 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 30, perTopicTarget: 10 } // 10 por cada tema (3 temas)
  },
  'Física': {
    first: { totalQuestions: 20, perTopicTarget: 5 }, // 5 por cada tema (4 temas)
    second: { totalQuestions: 20, perTopicTarget: 5 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 40, perTopicTarget: 10 } // 10 por cada tema (4 temas)
  },
  'Quimica': {
    first: { totalQuestions: 20, perTopicTarget: 5 }, // 5 por cada tema (4 temas)
    second: { totalQuestions: 20, perTopicTarget: 5 }, // Mismas cantidades que Fase 1
    third: { totalQuestions: 40, perTopicTarget: 10 } // 10 por cada tema (4 temas)
  }
};

// Mantener compatibilidad con código existente
const SUBJECT_TOPIC_RULES: Record<string, SubjectTopicRule> = {
  'Lenguaje': { totalQuestions: 18, perTopicTarget: 6 },
  'Matemáticas': { totalQuestions: 18, perTopicTarget: 6 },
  'Ciencias Sociales': { totalQuestions: 20, perTopicTarget: 5 },
  'Biologia': { totalQuestions: 15, perTopicTarget: 5 },
  'Física': { totalQuestions: 20, perTopicTarget: 5 },
  'Quimica': { totalQuestions: 20, perTopicTarget: 5 },
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

      // Validar autorización de fase si hay studentId (capa adicional de seguridad)
      if (studentId) {
        const userResult = await dbService.getUserById(studentId);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data;
          const gradeId = studentData.gradeId || studentData.grade;
          
          if (gradeId) {
            // Verificar si ya completó esta materia en esta fase (prevenir repetición)
            const hasCompletedResult = await questionTrackingService.hasCompletedSubjectInPhase(
              studentId,
              subject,
              phase
            );
            
            if (hasCompletedResult.success && hasCompletedResult.data) {
              console.warn(`⚠️ Intento de repetir examen: ${studentId} - ${subject} - ${phase}`);
              return failure(new ErrorAPI({ 
                message: `Ya completaste este examen de ${subject} en esta fase. Solo puedes presentar cada materia una vez por fase.` 
              }));
            }

            const accessResult = await phaseAuthorizationService.canStudentAccessPhase(
              studentId,
              gradeId,
              phase as 'first' | 'second' | 'third'
            );
            
            if (!accessResult.success) {
              console.warn(`⚠️ Error verificando acceso: ${studentId} - ${phase} - ${gradeId}`);
              return failure(accessResult.error);
            }
            
            if (!accessResult.data?.canAccess) {
              console.warn(`⚠️ Intento de generar cuestionario sin autorización: ${studentId} - ${phase} - ${gradeId}`);
              return failure(new ErrorAPI({ 
                message: accessResult.data?.reason || 'No tienes acceso a esta fase. Debes completar la fase anterior primero.' 
              }));
            }
          }
        }
      }

      // Obtener configuración para la materia y fase
      const config = this.getQuizConfig(subject, phase);
      if (!config) {
        return failure(new ErrorAPI({ message: `No se encontró configuración para ${subject} - ${phase}` }));
      }

      // Obtener preguntas ya respondidas en fases anteriores (solo si hay studentId)
      let answeredQuestionIds = new Set<string>();
      if (studentId) {
        const answeredResult = await questionTrackingService.getAnsweredQuestions(
          studentId,
          subject,
          phase
        );
        if (answeredResult.success) {
          answeredQuestionIds = answeredResult.data;
        } else {
          console.warn('⚠️ No se pudieron obtener preguntas respondidas, continuando sin filtro:', answeredResult.error);
        }
      }

      // Para Fase 2, usar distribución personalizada si hay studentId
      if (phase === 'second' && studentId && subject !== 'Inglés') {
        console.log(`📊 Generando cuestionario personalizado Fase 2 para ${studentId}`);
        return await this.generatePersonalizedPhase2Quiz(subject, config, grade, studentId, answeredQuestionIds);
      }

      // Lógica especial para Inglés: preguntas agrupadas por tema
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

      // Obtener distribución según la fase
      const phaseDistribution = SUBJECT_PHASE_DISTRIBUTIONS[subject];
      const subjectRule = phaseDistribution 
        ? { totalQuestions: phaseDistribution[phase].totalQuestions, perTopicTarget: phaseDistribution[phase].perTopicTarget }
        : SUBJECT_TOPIC_RULES[subject];
      const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

      let questions: Question[] = [];

      if (subjectRule && phaseDistribution) {
        console.log(`🧠 Aplicando reglas por tópico para ${subject} - Fase ${phase}`);
        const topicResult = await this.getQuestionsWithTopicRules(
          subject, 
          config, 
          grade, 
          subjectRule, 
          answeredQuestionIds,
          phase // Pasar la fase para priorizar nivel Fácil en Fase 1
        );
        if (!topicResult.success) {
          console.warn('⚠️ No se pudieron aplicar reglas por tópico, usando búsqueda general', topicResult.error);
          const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds, phase);
          if (!generalResult.success) {
            return failure(generalResult.error);
          }
          questions = generalResult.data;
        } else {
          questions = topicResult.data;
        }
      } else if (subjectRule) {
        // Fallback a reglas antiguas si no hay distribución por fase
        console.log(`🧠 Aplicando reglas por tópico para ${subject}`);
        const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule, answeredQuestionIds, phase);
        if (!topicResult.success) {
          console.warn('⚠️ No se pudieron aplicar reglas por tópico, usando búsqueda general', topicResult.error);
          const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds, phase);
          if (!generalResult.success) {
            return failure(generalResult.error);
          }
          questions = generalResult.data;
        } else {
          questions = topicResult.data;
        }
      } else {
        const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds, phase);
        if (!generalResult.success) {
          return failure(generalResult.error);
        }
        questions = generalResult.data;
      }

      // Filtrar preguntas ya respondidas
      if (answeredQuestionIds.size > 0) {
        questions = questionTrackingService.filterAnsweredQuestions(questions, answeredQuestionIds);
        
        // Si después de filtrar no hay suficientes preguntas, intentar obtener más
        if (questions.length < expectedCount) {
          console.log(`⚠️ Después de filtrar, solo quedan ${questions.length} preguntas. Intentando obtener más...`);
          const additionalNeeded = expectedCount - questions.length;
          const additionalResult = await this.getGeneralQuestions(
            subject, 
            config, 
            grade, 
            additionalNeeded * 2, // Obtener más para tener opciones
            answeredQuestionIds,
            phase
          );
          if (additionalResult.success && additionalResult.data.length > 0) {
            const existingIds = new Set(questions.map(q => q.id || q.code));
            const newQuestions = additionalResult.data.filter(q => {
              const qId = String(q.id || q.code);
              return !existingIds.has(qId) && !answeredQuestionIds.has(qId);
            });
            questions = [...questions, ...newQuestions].slice(0, expectedCount);
          }
        }
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
    answeredQuestionIds: Set<string> = new Set(),
    phase?: 'first' | 'second' | 'third'
  ): Promise<Result<Question[]>> {
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = this.getSubjectCode(subject);
    
    // En Fase 1, priorizar nivel Fácil (excepto Inglés que ya tiene su lógica)
    const priorityLevelCode = phase === 'first' && subject !== 'Inglés' ? 'F' : undefined;
    
    const attempts: QuestionFilters[] = [];
    
    // Si es Fase 1 y no es Inglés, buscar primero nivel Fácil
    if (priorityLevelCode) {
      attempts.push(
        ...gradeValues.map(gradeValue => ({
          subject,
          subjectCode,
          grade: gradeValue,
          levelCode: priorityLevelCode,
          limit: expectedCount * 4
        })),
        {
          subject,
          subjectCode,
          levelCode: priorityLevelCode,
          limit: expectedCount * 3
        }
      );
    }
    
    // Luego buscar sin restricción de nivel (para tener opciones si no hay suficientes de nivel Fácil)
    attempts.push(
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
    );

    // Obtener más preguntas de las necesarias para tener opciones después de filtrar
    const fetchCount = answeredQuestionIds.size > 0 
      ? Math.max(expectedCount * 2, expectedCount + answeredQuestionIds.size)
      : expectedCount;
    
    const questions = await this.fetchQuestionsWithFallback(attempts, fetchCount);

    if (questions.length === 0) {
      return failure(new ErrorAPI({
        message: `No hay suficientes preguntas de ${subject} disponibles en el banco de datos`
      }));
    }

    // Filtrar preguntas ya respondidas
    const filteredQuestions = questionTrackingService.filterAnsweredQuestions(questions, answeredQuestionIds);
    
    // Si después de filtrar no hay suficientes, devolver las que hay
    if (filteredQuestions.length < expectedCount && filteredQuestions.length > 0) {
      console.warn(`⚠️ Solo se encontraron ${filteredQuestions.length} preguntas nuevas de ${expectedCount} solicitadas`);
      return success(filteredQuestions);
    }

    // Devolver la cantidad esperada
    return success(filteredQuestions.slice(0, expectedCount));
  }

  private async getQuestionsWithTopicRules(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    rule: SubjectTopicRule,
    answeredQuestionIds: Set<string> = new Set(),
    phase?: 'first' | 'second' | 'third'
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
      
      // En Fase 1, priorizar nivel Fácil (excepto Inglés que ya tiene su lógica)
      const priorityLevelCode = phase === 'first' && subject !== 'Inglés' ? 'F' : undefined;
      
      const attempts: QuestionFilters[] = [];
      
      // Si es Fase 1 y no es Inglés, buscar primero nivel Fácil
      if (priorityLevelCode) {
        attempts.push(
          ...gradeValues.flatMap(gradeValue => ([
            {
              subject,
              subjectCode,
              topicCode: topic.code,
              grade: gradeValue,
              levelCode: priorityLevelCode,
              limit: rule.perTopicTarget * 4
            },
            {
              subject,
              subjectCode,
              topic: topic.name,
              grade: gradeValue,
              levelCode: priorityLevelCode,
              limit: rule.perTopicTarget * 4
            }
          ])),
          {
            subject,
            subjectCode,
            topicCode: topic.code,
            levelCode: priorityLevelCode,
            limit: rule.perTopicTarget * 3
          },
          {
            subject,
            subjectCode,
            topic: topic.name,
            levelCode: priorityLevelCode,
            limit: rule.perTopicTarget * 3
          }
        );
      }
      
      // Luego buscar sin restricción de nivel (para tener opciones si no hay suficientes de nivel Fácil)
      attempts.push(
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
      );

      console.log(`🧩 Buscando preguntas para tópico ${topic.name} (${subject}) con ${attempts.length} intentos`);
      // Obtener más preguntas para tener opciones después de filtrar
      const fetchCount = answeredQuestionIds.size > 0 
        ? rule.perTopicTarget * 2 
        : rule.perTopicTarget;
      const topicQuestionsRaw = await this.fetchQuestionsWithFallback(attempts, fetchCount);
      // Filtrar preguntas ya respondidas
      const topicQuestions = questionTrackingService.filterAnsweredQuestions(topicQuestionsRaw, answeredQuestionIds);
      topicQuestionMap[topic.code] = topicQuestions;
      console.log(`✅ ${topicQuestions.length} preguntas almacenadas para ${topic.name} (después de filtrar)`);
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

      const fallbackResult = await this.getGeneralQuestions(subject, config, grade, missing, answeredQuestionIds, phase);
      if (fallbackResult.success && fallbackResult.data.length > 0) {
        const existingIds = new Set(questions.map(q => q.id || q.code));
        const extras = fallbackResult.data.filter(q => {
          const qId = String(q.id || q.code);
          return !existingIds.has(qId) && !answeredQuestionIds.has(qId);
        });
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
    answeredQuestionIds: Set<string> = new Set()
  ): Promise<Result<Question[]>> {
    console.log(`🇬🇧 Generando cuestionario de Inglés con preguntas agrupadas por tema`);
    
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig || !subjectConfig.topics) {
      return failure(new ErrorAPI({ message: `No se encontró configuración de temas para ${subject}` }));
    }

    // Para Inglés son 7 temas, necesitamos 1 grupo de preguntas por tema
    const topics = subjectConfig.topics;
    const gradeValues = this.getGradeSearchValues(grade);
    const subjectCode = subjectConfig.code;
    const levelCode = config.level === 'Fácil' ? 'F' : config.level === 'Medio' ? 'M' : 'D';
    
    // Mapa para almacenar grupos de preguntas por tema
    const topicGroupsMap: Record<string, Question[][]> = {};

    // Para cada tema, buscar todas las preguntas agrupadas disponibles
    for (const topic of topics) {
      console.log(`🔍 Buscando grupos de preguntas para tema: ${topic.name} (${topic.code})`);
      
      const attempts: QuestionFilters[] = [
        ...gradeValues.flatMap(gradeValue => ([
          {
            subject,
            subjectCode,
            topicCode: topic.code,
            grade: gradeValue,
            levelCode: phase === 'first' ? 'F' : levelCode, // Primera ronda: nivel fácil
            limit: 100 // Buscar muchas para tener opciones de grupos
          },
          {
            subject,
            subjectCode,
            topic: topic.name,
            grade: gradeValue,
            levelCode: phase === 'first' ? 'F' : levelCode,
            limit: 100
          }
        ])),
        {
          subject,
          subjectCode,
          topicCode: topic.code,
          levelCode: phase === 'first' ? 'F' : levelCode,
          limit: 100
        },
        {
          subject,
          subjectCode,
          topic: topic.name,
          levelCode: phase === 'first' ? 'F' : levelCode,
          limit: 100
        }
      ];

      // Obtener todas las preguntas del tema
      const allQuestions = await this.fetchQuestionsWithFallback(attempts, 100);
      
      // Filtrar solo preguntas agrupadas (que tienen informativeText)
      let groupedQuestions = allQuestions.filter(q => 
        q.subjectCode === 'IN' && 
        q.informativeText && 
        q.informativeText.trim() !== ''
      );
      
      // Filtrar preguntas ya respondidas
      groupedQuestions = questionTrackingService.filterAnsweredQuestions(groupedQuestions, answeredQuestionIds);

      // Agrupar preguntas por su informativeText (grupos de preguntas relacionadas)
      const groupsMap: { [key: string]: Question[] } = {};
      groupedQuestions.forEach(question => {
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
      console.log(`✅ Encontrados ${groups.length} grupos de preguntas para ${topic.name}`);
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
    expectedCount: number
  ): Promise<Question[]> {
    const collected = new Map<string, Question>();

    for (const [index, filters] of attempts.entries()) {
      const result = await questionService.getRandomQuestions(filters, expectedCount);
      if (!result.success) {
        console.warn(`⚠️ Intento ${index + 1} fallido con filtros`, filters, result.error);
        continue;
      }

      const deduped = this.dedupeQuestions(result.data);
      console.log(`🔎 Intento ${index + 1}: ${deduped.length} preguntas obtenidas con filtros`, filters);

      for (const question of deduped) {
        const key = question.id || question.code;
        if (!collected.has(key)) {
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
    answeredQuestionIds: Set<string> = new Set()
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
        return this.generateStandardPhase2Quiz(subject, config, grade, answeredQuestionIds);
      }

      const distribution = distributionResult.data;
      const questions: Question[] = [];

      // Usar distribución proporcional si está disponible, sino usar distribución simple
      if (distribution.weaknessDistribution && distribution.strengthDistribution) {
        // Distribución proporcional de debilidades
        for (const weaknessDist of distribution.weaknessDistribution) {
          if (weaknessDist.count > 0) {
            const weaknessQuestions = await this.getQuestionsForTopic(
              subject,
              weaknessDist.topic,
              weaknessDist.count,
              grade,
              config.level || 'Medio',
              answeredQuestionIds
            );
            questions.push(...weaknessQuestions);
            console.log(`   - ${weaknessDist.count} preguntas de ${weaknessDist.topic} (debilidad)`);
          }
        }

        // Distribución equitativa de fortalezas
        for (const strengthDist of distribution.strengthDistribution) {
          if (strengthDist.count > 0) {
            const strengthQuestions = await this.getQuestionsForTopic(
              subject,
              strengthDist.topic,
              strengthDist.count,
              grade,
              config.level || 'Medio',
              answeredQuestionIds
            );
            questions.push(...strengthQuestions);
            console.log(`   - ${strengthDist.count} preguntas de ${strengthDist.topic} (fortaleza)`);
          }
        }
      } else {
        // Fallback a distribución simple (compatibilidad)
        const primaryWeaknessQuestions = await this.getQuestionsForTopic(
          subject,
          distribution.primaryWeakness,
          distribution.primaryWeaknessCount,
          grade,
          config.level || 'Medio',
          answeredQuestionIds
        );
        questions.push(...primaryWeaknessQuestions);

        const questionsPerOtherTopic = distribution.otherTopics.length > 0
          ? Math.floor(distribution.otherTopicsCount / distribution.otherTopics.length)
          : 0;

        for (const topic of distribution.otherTopics) {
          const topicQuestions = await this.getQuestionsForTopic(
            subject,
            topic,
            questionsPerOtherTopic,
            grade,
            config.level || 'Medio',
            answeredQuestionIds
          );
          questions.push(...topicQuestions);
        }
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
    answeredQuestionIds: Set<string> = new Set()
  ): Promise<Result<GeneratedQuiz>> {
    const subjectRule = SUBJECT_TOPIC_RULES[subject];
    const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

    let questions: Question[] = [];

    if (subjectRule) {
      const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule, answeredQuestionIds, 'second');
      if (topicResult.success) {
        questions = topicResult.data;
      } else {
        const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds, 'second');
        if (generalResult.success) {
          questions = generalResult.data;
        }
      }
    } else {
      const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount, answeredQuestionIds, 'second');
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
    answeredQuestionIds: Set<string> = new Set()
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

    // Obtener más preguntas para tener opciones después de filtrar
    const fetchCount = answeredQuestionIds.size > 0 ? count * 2 : count;
    const questions = await this.fetchQuestionsWithFallback(attempts, fetchCount);
    
    // Filtrar preguntas ya respondidas
    const filteredQuestions = questionTrackingService.filterAnsweredQuestions(questions, answeredQuestionIds);
    
    // Devolver la cantidad solicitada
    return filteredQuestions.slice(0, count);
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
