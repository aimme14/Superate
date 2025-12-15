/**
 * Servicio de Preguntas para Backend
 * 
 * Maneja todas las operaciones CRUD de preguntas en Firestore
 * desde el backend con Firebase Admin
 */

import {
  questionsCollection,
  questionDocument,
} from '../config/firebase.config';
import {
  Question,
  QuestionFilters,
  AIJustification,
  QuestionGenerationData,
  JustificationStats,
} from '../types/question.types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Servicio principal de preguntas
 */
class QuestionService {
  /**
   * Obtiene una pregunta por su ID
   */
  async getQuestionById(questionId: string): Promise<Question | null> {
    try {
      const doc = await questionDocument(questionId).get();
      
      if (!doc.exists) {
        console.log(`⚠️ Pregunta ${questionId} no encontrada`);
        return null;
      }
      
      const data = doc.data();
      const question: Question = {
        ...data,
        id: doc.id,
        createdAt: data?.createdAt?.toDate() || new Date(),
        aiJustification: data?.aiJustification ? {
          ...data.aiJustification,
          generatedAt: data.aiJustification.generatedAt?.toDate() || new Date(),
        } : undefined,
      } as Question;
      
      return question;
    } catch (error) {
      console.error(`❌ Error obteniendo pregunta ${questionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene una pregunta por su código
   */
  async getQuestionByCode(code: string): Promise<Question | null> {
    try {
      const snapshot = await questionsCollection()
        .where('code', '==', code)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        console.log(`⚠️ Pregunta con código ${code} no encontrada`);
        return null;
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      const question: Question = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        aiJustification: data.aiJustification ? {
          ...data.aiJustification,
          generatedAt: data.aiJustification.generatedAt?.toDate() || new Date(),
        } : undefined,
      } as Question;
      
      return question;
    } catch (error) {
      console.error(`❌ Error obteniendo pregunta por código ${code}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene preguntas con filtros
   */
  async getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
    try {
      let query = questionsCollection() as any;
      
      // Aplicar filtros básicos (que soportan índices de Firestore)
      if (filters.subject) {
        query = query.where('subject', '==', filters.subject);
      }
      if (filters.subjectCode) {
        query = query.where('subjectCode', '==', filters.subjectCode);
      }
      if (filters.topic) {
        query = query.where('topic', '==', filters.topic);
      }
      if (filters.topicCode) {
        query = query.where('topicCode', '==', filters.topicCode);
      }
      if (filters.grade) {
        query = query.where('grade', '==', filters.grade);
      }
      if (filters.level) {
        query = query.where('level', '==', filters.level);
      }
      if (filters.levelCode) {
        query = query.where('levelCode', '==', filters.levelCode);
      }
      
      // NO aplicar filtro de justificación en Firestore (no funciona bien con campos undefined)
      // Lo haremos en el cliente después de obtener los datos
      
      // Aplicar límite solo si NO estamos filtrando por justificación
      // (necesitamos obtener más para luego filtrar en cliente)
      if (filters.limit && !filters.withJustification && !filters.withoutJustification) {
        query = query.limit(filters.limit);
      }
      
      const snapshot = await query.get();
      
      let questions: Question[] = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          aiJustification: data.aiJustification ? {
            ...data.aiJustification,
            generatedAt: data.aiJustification.generatedAt?.toDate() || new Date(),
          } : undefined,
        } as Question;
      });
      
      // FILTRAR EN CLIENTE por existencia de justificación
      if (filters.withJustification !== undefined) {
        if (filters.withJustification) {
          // Solo preguntas CON justificación
          questions = questions.filter(q => q.aiJustification !== undefined);
          console.log(`🔍 Filtradas ${questions.length} preguntas CON justificación`);
        }
      }
      
      if (filters.withoutJustification !== undefined) {
        if (filters.withoutJustification) {
          // Solo preguntas SIN justificación
          questions = questions.filter(q => !q.aiJustification);
          console.log(`🔍 Filtradas ${questions.length} preguntas SIN justificación`);
        }
      }
      
      // Aplicar límite después del filtrado en cliente
      if (filters.limit) {
        questions = questions.slice(0, filters.limit);
      }
      
      return questions;
    } catch (error) {
      console.error('❌ Error obteniendo preguntas:', error);
      throw error;
    }
  }

  /**
   * Obtiene preguntas sin justificación
   */
  async getQuestionsWithoutJustification(
    limit: number = 50,
    filters: QuestionFilters = {}
  ): Promise<Question[]> {
    const questionsFilters: QuestionFilters = {
      ...filters,
      withoutJustification: true,
      limit,
    };
    
    return this.getQuestions(questionsFilters);
  }

  /**
   * Actualiza la justificación de una pregunta
   */
  async updateQuestionJustification(
    questionId: string,
    justification: AIJustification
  ): Promise<void> {
    try {
      // Preparar los datos para Firestore
      const justificationData = {
        ...justification,
        generatedAt: FieldValue.serverTimestamp(),
      };
      
      await questionDocument(questionId).update({
        aiJustification: justificationData,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Justificación actualizada para pregunta ${questionId}`);
    } catch (error) {
      console.error(`❌ Error actualizando justificación de ${questionId}:`, error);
      throw error;
    }
  }

  /**
   * Elimina la justificación de una pregunta
   */
  async deleteQuestionJustification(questionId: string): Promise<void> {
    try {
      await questionDocument(questionId).update({
        aiJustification: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Justificación eliminada de pregunta ${questionId}`);
    } catch (error) {
      console.error(`❌ Error eliminando justificación de ${questionId}:`, error);
      throw error;
    }
  }

  /**
   * Convierte una pregunta a datos de generación
   */
  questionToGenerationData(question: Question): QuestionGenerationData {
    return {
      questionId: question.id || '',
      questionCode: question.code,
      subject: question.subject,
      topic: question.topic,
      level: question.level,
      questionText: question.questionText,
      informativeText: question.informativeText,
      informativeImages: question.informativeImages,
      questionImages: question.questionImages,
      options: question.options,
    };
  }

  /**
   * Obtiene estadísticas de justificaciones
   */
  async getJustificationStats(filters: QuestionFilters = {}): Promise<JustificationStats> {
    try {
      console.log('📊 Obteniendo estadísticas de justificaciones...');
      
      // Obtener todas las preguntas (sin filtro de justificación)
      const allQuestions = await this.getQuestions({
        ...filters,
        withJustification: undefined,
        withoutJustification: undefined,
        limit: undefined,
      });
      
      const stats: JustificationStats = {
        total: allQuestions.length,
        withJustification: 0,
        withoutJustification: 0,
        bySubject: {},
        byLevel: {},
        byGrade: {},
        averageConfidence: 0,
      };
      
      let totalConfidence = 0;
      let confidenceCount = 0;
      
      allQuestions.forEach(question => {
        const hasJustification = !!question.aiJustification;
        
        if (hasJustification) {
          stats.withJustification++;
          
          // Calcular confianza promedio
          if (question.aiJustification?.confidence) {
            totalConfidence += question.aiJustification.confidence;
            confidenceCount++;
          }
        } else {
          stats.withoutJustification++;
        }
        
        // Estadísticas por materia
        if (!stats.bySubject[question.subject]) {
          stats.bySubject[question.subject] = { total: 0, withJustification: 0 };
        }
        stats.bySubject[question.subject].total++;
        if (hasJustification) {
          stats.bySubject[question.subject].withJustification++;
        }
        
        // Estadísticas por nivel
        if (!stats.byLevel[question.level]) {
          stats.byLevel[question.level] = { total: 0, withJustification: 0 };
        }
        stats.byLevel[question.level].total++;
        if (hasJustification) {
          stats.byLevel[question.level].withJustification++;
        }
        
        // Estadísticas por grado
        if (!stats.byGrade[question.grade]) {
          stats.byGrade[question.grade] = { total: 0, withJustification: 0 };
        }
        stats.byGrade[question.grade].total++;
        if (hasJustification) {
          stats.byGrade[question.grade].withJustification++;
        }
      });
      
      // Calcular confianza promedio
      if (confidenceCount > 0) {
        stats.averageConfidence = totalConfidence / confidenceCount;
      }
      
      console.log('✅ Estadísticas calculadas:', {
        total: stats.total,
        conJustificación: stats.withJustification,
        sinJustificación: stats.withoutJustification,
        porcentaje: `${((stats.withJustification / stats.total) * 100).toFixed(2)}%`,
      });
      
      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Verifica si una pregunta tiene justificación
   */
  async hasJustification(questionId: string): Promise<boolean> {
    try {
      const question = await this.getQuestionById(questionId);
      return !!question?.aiJustification;
    } catch (error) {
      console.error(`❌ Error verificando justificación de ${questionId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene el conteo total de preguntas
   */
  async getTotalCount(filters: QuestionFilters = {}): Promise<number> {
    try {
      const questions = await this.getQuestions({
        ...filters,
        limit: undefined,
      });
      return questions.length;
    } catch (error) {
      console.error('❌ Error obteniendo conteo total:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const questionService = new QuestionService();

export default questionService;

