import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME, GRADE_MAPPING } from '@/utils/subjects.config';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';

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
   * Genera un cuestionario dinámico basado en la materia y fase
   */
  async generateQuiz(
    subject: string,
    phase: 'first' | 'second' | 'third',
    grade?: string
  ): Promise<Result<GeneratedQuiz>> {
    try {
      console.log(`🎯 Generando cuestionario: ${subject} - ${phase}${grade ? ` - Grado ${grade}` : ''}`);

      // Obtener configuración para la materia y fase
      const config = this.getQuizConfig(subject, phase);
      if (!config) {
        return failure(new ErrorAPI({ message: `No se encontró configuración para ${subject} - ${phase}` }));
      }

      const subjectRule = SUBJECT_TOPIC_RULES[subject];
      const expectedCount = subjectRule?.totalQuestions || config.questionCount || 15;

      let questions: Question[] = [];

      if (subjectRule) {
        console.log(`🧠 Aplicando reglas por tópico para ${subject}`);
        const topicResult = await this.getQuestionsWithTopicRules(subject, config, grade, subjectRule);
        if (!topicResult.success) {
          console.warn('⚠️ No se pudieron aplicar reglas por tópico, usando búsqueda general', topicResult.error);
          const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount);
          if (!generalResult.success) {
            return failure(generalResult.error);
          }
          questions = generalResult.data;
        } else {
          questions = topicResult.data;
        }
      } else {
        const generalResult = await this.getGeneralQuestions(subject, config, grade, expectedCount);
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
    expectedCount: number
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

    const questions = await this.fetchQuestionsWithFallback(attempts, expectedCount);

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
    rule: SubjectTopicRule
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
      const topicQuestions = await this.fetchQuestionsWithFallback(attempts, rule.perTopicTarget);
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

      const fallbackResult = await this.getGeneralQuestions(subject, config, grade, missing);
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
