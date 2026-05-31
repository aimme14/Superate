import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME, GRADE_MAPPING } from '@/utils/subjects.config';
import { shuffleArray } from '@/utils/arrayUtils';
import { validateGroupedQuestionsConsecutive } from '@/utils/quizGroupedQuestions';
import { isEnglishGroupComplete } from '@/utils/clozeTest';
import {
  getEnglishExamGroupId,
  groupQuestionsByExamGroupId,
} from '@/utils/englishGroupId';
import { sortQuestionsByCreationOrder } from '@/components/admin/questionBank/questionBankUtils';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { logger } from '@/utils/logger';

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

  private async getAnsweredQuestions(
    studentId: string,
    subject: string,
    currentPhase: 'first' | 'second' | 'third',
    preloadedEvaluations?: any[]
  ): Promise<Set<string>> {
    const answeredQuestionIds = new Set<string>();

    if (currentPhase === 'first') return answeredQuestionIds;

    try {
      let evaluations: any[];
      if (preloadedEvaluations) {
        evaluations = preloadedEvaluations;
      } else {
        const { fetchEvaluationsFromStudentSummary } = await import(
          '@/services/studentProgressSummary/fetchEvaluationsFromSummary'
        );
        evaluations = await fetchEvaluationsFromStudentSummary(studentId);
      }

      const phasesToExclude: string[] = currentPhase === 'second'
        ? ['first']
        : ['first', 'second'];

      evaluations
        .filter(e =>
          e.phase != null &&
          phasesToExclude.includes(e.phase) &&
          e.subject?.trim().toLowerCase() === subject.trim().toLowerCase()
        )
        .forEach(e => {
          if (Array.isArray(e.questionDetails)) {
            e.questionDetails.forEach((d: any) => {
              if (d.questionId) answeredQuestionIds.add(d.questionId);
            });
          }
          if (e.answers && typeof e.answers === 'object') {
            Object.keys(e.answers).forEach(id => answeredQuestionIds.add(id));
          }
        });

    } catch (error) {
      logger.warn('Error obteniendo preguntas respondidas desde summary:', error);
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
    studentId?: string,
    preloadedEvaluations?: any[]
  ): Promise<Result<GeneratedQuiz>> {
    try {
      logger.debug(`Generando cuestionario: ${subject} - ${phase}${grade ? ` - Grado ${grade}` : ''}${studentId ? ` - Estudiante ${studentId}` : ''}`);

      // Obtener configuración para la materia y fase
      const config = this.getQuizConfig(subject, phase);
      if (!config) {
        return failure(new ErrorAPI({ message: `No se encontró configuración para ${subject} - ${phase}` }));
      }

      // Obtener preguntas ya respondidas en fases anteriores (solo si hay studentId y no es fase 1)
      let answeredQuestionIds = new Set<string>();
      if (studentId && phase !== 'first') {
        answeredQuestionIds = await this.getAnsweredQuestions(studentId, subject, phase, preloadedEvaluations);
        logger.debug(`Excluyendo ${answeredQuestionIds.size} preguntas ya respondidas en fases anteriores`);
      }

      // Lógica especial para Inglés: preguntas agrupadas por tema (aplica para todas las fases)
      if (subject === 'Inglés') {
        logger.debug('Aplicando lógica especial para Inglés con preguntas agrupadas');
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

        logger.debug(`Cuestionario de Inglés generado: ${quiz.title} con ${sortedQuestions.length} preguntas agrupadas`);
        return success(quiz);
      }

      // Para Fase 3, usar distribución proporcional independiente por temas (excepto Inglés que ya se manejó arriba)
      if (phase === 'third') {
        logger.debug('Generando cuestionario Fase 3 con distribución proporcional por temas');
        return await this.generatePhase3ProportionalQuiz(subject, config, grade, answeredQuestionIds);
      }

      const subjectRule = SUBJECT_TOPIC_RULES[subject];
      const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

      let questions: Question[] = [];

      if (subjectRule) {
        logger.debug(`Aplicando reglas por tópico para ${subject}`);
        const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule, answeredQuestionIds);
        if (!topicResult.success) {
          logger.warn('No se pudieron aplicar reglas por tópico, usando búsqueda general');
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
        logger.warn(`Sólo se obtuvieron ${questions.length} preguntas de ${expectedCount} solicitadas para ${subject}`);
      }

      // Ordenar preguntas agrupadas por orden de creación (más antigua primero)
      // Las preguntas agrupadas tienen el mismo informativeText (especialmente para inglés)
      const sortedQuestions = this.sortGroupedQuestionsByCreationOrder(questions, subject);

      // Validación: asegurar que grupos estén consecutivos (excluye Inglés)
      if (subject !== 'Inglés') {
        const validation = validateGroupedQuestionsConsecutive(sortedQuestions, 'IN');
        if (!validation.isValid) {
          logger.error('Validación de agrupación fallida:', validation.message);
        }
      }

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

      logger.debug(`Cuestionario generado: ${quiz.title} con ${questions.length} preguntas`);
      return success(quiz);

    } catch (e) {
      logger.error('Error generando cuestionario:', e);
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

    await Promise.all(
      subjectConfig.topics.map(async (topic) => {
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
        const topicQuestions = await this.fetchQuestionsWithFallback(attempts, rule.perTopicTarget, excludeQuestionIds);
        topicQuestionMap[topic.code] = topicQuestions;
      })
    );

    let questions = this.balanceQuestionsByTopic(
      subjectConfig.topics.map(t => t.code),
      topicQuestionMap,
      rule.totalQuestions,
      rule.perTopicTarget
    );

    if (questions.length < rule.totalQuestions) {
      const missing = rule.totalQuestions - questions.length;
      logger.warn(`Faltan ${missing} preguntas para ${subject}, completando con selección general`);

      const fallbackResult = await this.getGeneralQuestions(subject, config, grade, missing, excludeQuestionIds);
      if (fallbackResult.success && fallbackResult.data.length > 0) {
        const existingIds = new Set(questions.map(q => q.id || q.code));
        const extras = fallbackResult.data.filter(q => !existingIds.has(q.id || q.code));
        questions = shuffleArray([...questions, ...extras]).slice(0, rule.totalQuestions);
      }
    }

    if (questions.length === 0) {
      return failure(new ErrorAPI({ message: `No se encontraron preguntas para ${subject}` }));
    }

    return success(questions);
  }

  /**
   * Carga preguntas agrupadas de una parte IN (P1–P7) con una query por grado intentado.
   */
  private async fetchEnglishPartQuestions(
    topicCode: string,
    gradeValues: string[],
    levelCode: string,
    excludeQuestionIds: Set<string>,
  ): Promise<Question[]> {
    const collected: Question[] = [];
    const seen = new Set<string>();

    const absorb = (list: Question[]) => {
      for (const q of list) {
        const key = q.id || q.code;
        if (!key || seen.has(key)) continue;
        if (q.subjectCode !== 'IN') continue;
        if (!q.informativeText?.trim()) continue;
        if (excludeQuestionIds.has(key)) continue;
        seen.add(key);
        collected.push(q);
      }
    };

    for (const gradeValue of gradeValues) {
      const result = await questionService.getFilteredQuestions({
        subjectCode: 'IN',
        topicCode,
        grade: gradeValue,
        levelCode,
        limit: 200,
      });
      if (result.success) absorb(result.data);
    }

    if (collected.length === 0) {
      const fallback = await questionService.getFilteredQuestions({
        subjectCode: 'IN',
        topicCode,
        levelCode,
        limit: 200,
      });
      if (fallback.success) absorb(fallback.data);
    }

    return collected;
  }

  /**
   * Inglés: 1 ejercicio completo por parte (P1→P7), agrupado por englishGroupId.
   */
  private async getEnglishGroupedQuestions(
    subject: string,
    config: Partial<QuizConfig>,
    grade: string | undefined,
    phase: 'first' | 'second' | 'third',
    excludeQuestionIds: Set<string> = new Set(),
  ): Promise<Result<Question[]>> {
    const phaseLevel = phase === 'first' ? 'Fácil' : phase === 'second' ? 'Medio' : 'Difícil';
    logger.debug(`Generando cuestionario de Inglés - Fase ${phase} (Nivel: ${phaseLevel})`);

    const subjectConfig = SUBJECTS_CONFIG.find((s) => s.name === subject);
    if (!subjectConfig?.topics) {
      return failure(new ErrorAPI({ message: `No se encontró configuración de temas para ${subject}` }));
    }

    const topics = subjectConfig.topics;
    const gradeValues = this.getGradeSearchValues(grade);
    const levelCode = config.level === 'Fácil' ? 'F' : config.level === 'Medio' ? 'M' : 'D';
    const resolvedLevelCode = phase === 'third' ? 'D' : phase === 'first' ? 'F' : levelCode;

    logger.debug(`Inglés: ${topics.length} partes, nivel ${resolvedLevelCode}, englishGroupId`);

    const usedGroupIds = new Set<string>();
    const selectedGroups: Question[][] = [];

    for (const topic of topics) {
      const pool = await this.fetchEnglishPartQuestions(
        topic.code,
        gradeValues,
        resolvedLevelCode,
        excludeQuestionIds,
      );

      const groups = groupQuestionsByExamGroupId(pool).map((group) =>
        [...group].sort(sortQuestionsByCreationOrder),
      );

      const completeGroups = groups.filter((g) => isEnglishGroupComplete(g));
      const selectable = completeGroups.length > 0 ? completeGroups : groups;

      if (selectable.length === 0) {
        logger.warn(`Sin grupos para ${topic.name} (${topic.code}) nivel ${resolvedLevelCode}`);
        continue;
      }

      const shuffled = shuffleArray(selectable);
      const picked =
        shuffled.find((g) => !usedGroupIds.has(getEnglishExamGroupId(g[0]))) ?? shuffled[0];

      if (!isEnglishGroupComplete(picked)) {
        logger.warn(
          `Grupo incompleto para ${topic.name}: ${picked.length} pregunta(s) — englishGroupId=${getEnglishExamGroupId(picked[0])}`,
        );
      }

      const groupId = getEnglishExamGroupId(picked[0]);
      usedGroupIds.add(groupId);
      selectedGroups.push(picked);
      logger.debug(
        `Parte ${topic.code}: grupo ${groupId} (${picked.length} preguntas)`,
      );
    }

    if (selectedGroups.length === 0) {
      return failure(
        new ErrorAPI({
          message:
            'No se encontraron grupos de preguntas agrupadas para Inglés. Verifica partes P1–P7, nivel y grado.',
        }),
      );
    }

    if (selectedGroups.length < topics.length) {
      logger.warn(`Inglés: ${selectedGroups.length}/${topics.length} partes con preguntas disponibles`);
    }

    const finalQuestions = selectedGroups.flat();

    logger.debug(
      `Cuestionario Inglés: ${selectedGroups.length} partes, ${finalQuestions.length} preguntas (orden P1→P7)`,
    );
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
      questions: shuffleArray(topicQuestionMap[code] || [])
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

    return shuffleArray(selected.map(item => item.question));
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

    const cleaned = grade.toString().trim();
    if (!cleaned) {
      return [];
    }

    const codeFromInput = this.toGradeCode(cleaned);
    if (codeFromInput) {
      // El banco guarda grade en código canónico (6,7,8,9,0,1).
      // Consultar únicamente por ese valor evita búsquedas ambiguas/lentas.
      return [codeFromInput];
    }

    const numericFromInput = this.extractNumericGrade(cleaned);
    if (numericFromInput) {
      const codeFromNumeric = this.numericToGradeCode(numericFromInput);
      if (codeFromNumeric) {
        return [codeFromNumeric];
      }
    }

    // Si no se pudo mapear, usar el valor original como último recurso.
    return [cleaned];
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

  private async fetchQuestionsWithFallback(
    attempts: QuestionFilters[],
    expectedCount: number,
    excludeQuestionIds: Set<string> = new Set()
  ): Promise<Question[]> {
    const collected = new Map<string, Question>();

    for (const [index, filters] of attempts.entries()) {
      const result = await questionService.getRandomQuestions(filters, expectedCount * 2); // Obtener más para tener opciones después de filtrar
      if (!result.success) {
        logger.warn(`Intento ${index + 1} fallido`);
        continue;
      }

      // Filtrar preguntas ya respondidas
      const filtered = result.data.filter(q => {
        const key = q.id || q.code;
        return !excludeQuestionIds.has(key);
      });

      const deduped = this.dedupeQuestions(filtered);
      logger.debug(`Intento ${index + 1}: ${deduped.length} preguntas (${result.data.length - filtered.length} excluidas)`);

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

    return shuffleArray(Array.from(collected.values())).slice(0, expectedCount);
  }

  /**
   * Normaliza el texto informativo para usarlo como clave de agrupación
   * (trim + colapsar espacios) para que preguntas con el mismo contenido se agrupen aunque varíe el formato.
   */
  private normalizeInformativeTextForGroup(text: string | undefined): string {
    return (text || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Ordena las preguntas asegurando que las agrupadas (mismo texto/contexto) se muestren consecutivas.
   * Regla obligatoria: si un grupo contiene N preguntas, deben aparecer una tras otra sin intercalar.
   * Aplica a: Matemáticas, Lenguaje, Ciencias Naturales (Biología, Química, Física), Ciencias Sociales.
   * Excluye: Inglés (tiene lógica propia).
   *
   * @param questions - Preguntas a ordenar
   * @param subject - Materia (para excluir Inglés)
   * @param shuffleGroupOrder - Si true, mezcla el orden de los grupos para variedad (Fase 2 y 3)
   */
  private sortGroupedQuestionsByCreationOrder(questions: Question[], subject: string, shuffleGroupOrder = false): Question[] {
    // Para inglés, usar la lógica especial existente
    if (subject === 'Inglés') {
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

    // Para todas las demás materias (excepto inglés): agrupar por informativeText y mostrar consecutivas
    const groupedMap: { [key: string]: Question[] } = {};
    const ungrouped: Question[] = [];

    questions.forEach(question => {
      const rawText = question.informativeText && question.informativeText.trim() !== '';
      // No exigir subjectCode: el array ya es de una sola materia; agrupar solo por contenido
      if (rawText) {
        const normalizedText = this.normalizeInformativeTextForGroup(question.informativeText);
        const informativeImages = JSON.stringify(question.informativeImages || []);
        const groupKey = `${normalizedText}_${informativeImages}`;

        if (!groupedMap[groupKey]) {
          groupedMap[groupKey] = [];
        }
        groupedMap[groupKey].push(question);
      } else {
        ungrouped.push(question);
      }
    });

    // Ordenar preguntas dentro de cada grupo por fecha de creación (más antigua primero)
    Object.keys(groupedMap).forEach(groupKey => {
      groupedMap[groupKey].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (dateA !== dateB) {
          return dateA - dateB; // Más antigua primero (orden de creación)
        }
        // Si tienen la misma fecha, ordenar por código
        return a.code.localeCompare(b.code);
      });
    });

    // Reconstruir el array: grupos consecutivos (opcionalmente en orden aleatorio), luego no agrupadas
    const result: Question[] = [];
    const processedIds = new Set<string>();

    // Orden de grupos: primera aparición en questions (o aleatorio si shuffleGroupOrder)
    const seenKeys = new Set<string>();
    const orderedGroupKeys: string[] = [];
    questions.forEach(question => {
      if (question.informativeText && question.informativeText.trim() !== '') {
        const normalizedText = this.normalizeInformativeTextForGroup(question.informativeText);
        const informativeImages = JSON.stringify(question.informativeImages || []);
        const groupKey = `${normalizedText}_${informativeImages}`;
        if (groupedMap[groupKey] && !seenKeys.has(groupKey)) {
          seenKeys.add(groupKey);
          orderedGroupKeys.push(groupKey);
        }
      }
    });

    const finalGroupKeys = shuffleGroupOrder ? shuffleArray(orderedGroupKeys) : orderedGroupKeys;

    // Agregar grupos de preguntas agrupadas (consecutivas, sin intercalar)
    finalGroupKeys.forEach(groupKey => {
      const group = groupedMap[groupKey];
      if (group) {
        result.push(...group);
        group.forEach(q => processedIds.add(q.id || q.code));
      }
    });

    // Agregar después las preguntas no agrupadas (opción múltiple estándar)
    const ungroupedShuffled = shuffleGroupOrder ? shuffleArray([...ungrouped]) : ungrouped;
    ungroupedShuffled.forEach(question => {
      if (!processedIds.has(question.id || question.code)) {
        result.push(question);
        processedIds.add(question.id || question.code);
      }
    });

    logger.debug(`Preguntas ordenadas para ${subject}: ${Object.keys(groupedMap).length} grupo(s), ${ungrouped.length} estándar`);
    
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
      logger.debug(`Generando cuestionario Fase 3 para ${subject}`);

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
      
      logger.debug(`Fase 3: ${subject} - ${topics.length} temas, ${totalQuestionsRequired} preguntas requeridas`);

      // Paso 1: Obtener preguntas de cada tema (intentar obtener más para tener opciones)
      const topicQuestionsMap: Record<string, Question[]> = {};
      
      for (const topic of topics) {
        logger.debug(`Obteniendo preguntas para tema: ${topic.name}`);
        
        // Intentar obtener más preguntas de las necesarias para tener opciones y poder redistribuir
        const topicQuestions = await this.getQuestionsForTopicVaried(
          subject,
          topic.name,
          questionsPerTopic * 3, // Intentar obtener 3 veces más para tener opciones
          grade,
          excludeQuestionIds
        );
        
        topicQuestionsMap[topic.code] = topicQuestions;
        logger.debug(`${topicQuestions.length} preguntas para ${topic.name}`);
      }

      // Paso 2: Distribuir preguntas intentando dar 10 a cada tema
      const questionsByTopic: Record<string, Question[]> = {};
      const selectedIds = new Set<string>();
      
      // Primera pasada: asignar hasta 10 preguntas a cada tema
      for (const topic of topics) {
        const available = topicQuestionsMap[topic.code] || [];
        const shuffled = shuffleArray([...available]);
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
              const shuffled = shuffleArray([...available]);
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

      // Paso 5: Ordenar respetando grupos consecutivos (regla obligatoria para todas las fases)
      const finalQuestions = this.sortGroupedQuestionsByCreationOrder(selectedQuestions, subject, true);

      const validation = validateGroupedQuestionsConsecutive(finalQuestions, 'IN');
      if (!validation.isValid) {
        logger.error('[Fase 3] Validación de agrupación fallida:', validation.message);
      }

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

      logger.debug(`Cuestionario Fase 3 generado: ${quiz.title} con ${finalQuestions.length} preguntas`);

      return success(quiz);
    } catch (e) {
      logger.error('Error generando cuestionario Fase 3:', e);
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
