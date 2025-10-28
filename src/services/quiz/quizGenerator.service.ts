import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { SUBJECTS_CONFIG } from '@/utils/subjects.config';
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
      questionCount: 20,
      timeLimit: 50,
      level: 'Medio'
    },
    third: {
      questionCount: 25,
      timeLimit: 60,
      level: 'Difícil'
    }
  },
  'Lenguaje': {
    first: {
      questionCount: 15,
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 18,
      timeLimit: 45,
      level: 'Medio'
    },
    third: {
      questionCount: 22,
      timeLimit: 55,
      level: 'Difícil'
    }
  },
  'Ciencias Sociales': {
    first: {
      questionCount: 16,
      timeLimit: 40,
      level: 'Fácil'
    },
    second: {
      questionCount: 18,
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
      questionCount: 14,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 16,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 18,
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Quimica': {
    first: {
      questionCount: 14,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 16,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 18,
      timeLimit: 45,
      level: 'Difícil'
    }
  },
  'Física': {
    first: {
      questionCount: 14,
      timeLimit: 35,
      level: 'Fácil'
    },
    second: {
      questionCount: 16,
      timeLimit: 40,
      level: 'Medio'
    },
    third: {
      questionCount: 18,
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

      // Crear filtros para obtener preguntas
      const filters: QuestionFilters = {
        subject: subject,
        level: config.level,
        grade: grade,
        limit: (config.questionCount || 15) * 2 // Obtener más preguntas para tener variedad
      };

      console.log('🔍 Filtros aplicados:', {
        subject: filters.subject,
        level: filters.level,
        grade: filters.grade,
        limit: filters.limit,
        config: config
      });

      // Obtener preguntas aleatorias del banco
      const questionsResult = await questionService.getRandomQuestions(filters, config.questionCount || 15);
      if (!questionsResult.success) {
        return failure(questionsResult.error);
      }

      const questions = questionsResult.data;

      // Verificar que tenemos suficientes preguntas
      const expectedCount = config.questionCount || 15;
      if (questions.length < expectedCount) {
        console.warn(`⚠️ Solo se encontraron ${questions.length} preguntas de ${expectedCount} solicitadas`);
        console.warn(`📊 Filtros aplicados:`, filters);
        console.warn(`📊 Configuración:`, config);
      }

      // Si no hay preguntas suficientes, intentar con filtros más flexibles
      if (questions.length === 0) {
        console.log(`🔄 No se encontraron preguntas con filtros estrictos, intentando con filtros flexibles...`);
        
        // Intentar sin filtro de grado
        const flexibleFilters: QuestionFilters = {
          subject: subject,
          level: config.level,
          limit: (config.questionCount || 15) * 2
        };
        
        const flexibleResult = await questionService.getRandomQuestions(flexibleFilters, config.questionCount || 15);
        if (flexibleResult.success && flexibleResult.data.length > 0) {
          console.log(`✅ Se encontraron ${flexibleResult.data.length} preguntas con filtros flexibles`);
          questions.push(...flexibleResult.data);
        } else {
          console.error(`❌ No se encontraron preguntas ni siquiera con filtros flexibles`);
          return failure(new ErrorAPI({ 
            message: `No hay suficientes preguntas de ${subject} disponibles en el banco de datos para la fase ${phase}` 
          }));
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
        questions: questions,
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
