/**
 * Servicio de generación de justificaciones
 * 
 * Orquesta la generación y almacenamiento de justificaciones con IA
 * Maneja procesamiento individual y por lotes (batch)
 */

import { geminiService } from './gemini.service';
import { questionService } from './question.service';
import {
  JustificationGenerationResult,
  BatchProcessingConfig,
  BatchProcessingResult,
  QuestionFilters,
} from '../types/question.types';

/**
 * Servicio principal de justificaciones
 */
class JustificationService {
  /**
   * Genera y guarda justificación para una pregunta
   */
  async generateAndSaveJustification(
    questionId: string,
    force: boolean = false
  ): Promise<JustificationGenerationResult> {
    try {
      // Obtener la pregunta
      const question = await questionService.getQuestionById(questionId);
      
      if (!question) {
        return {
          success: false,
          questionId,
          error: 'Pregunta no encontrada',
        };
      }
      
      // Verificar si ya tiene justificación
      if (question.aiJustification && !force) {
        console.log(`⚠️ Pregunta ${question.code} ya tiene justificación (usa force=true para regenerar)`);
        return {
          success: true,
          questionId,
          justification: question.aiJustification,
        };
      }
      
      // Generar justificación
      const generationData = questionService.questionToGenerationData(question);
      const result = await geminiService.generateQuestionJustification(generationData);
      
      if (!result.success || !result.justification) {
        return result;
      }
      
      // Guardar en Firestore
      await questionService.updateQuestionJustification(questionId, result.justification);
      
      console.log(`✅ Justificación generada y guardada para ${question.code}`);
      
      return result;
    } catch (error: any) {
      console.error(`Error en generateAndSaveJustification:`, error);
      return {
        success: false,
        questionId,
        error: error.message || 'Error desconocido',
      };
    }
  }

  /**
   * Procesa múltiples preguntas en batch
   */
  async processBatch(config: BatchProcessingConfig): Promise<BatchProcessingResult> {
    const startTime = new Date();
    
    const result: BatchProcessingResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startTime,
      endTime: new Date(),
      durationMs: 0,
    };
    
    try {
      console.log('🚀 Iniciando procesamiento batch...');
      console.log('Configuración:', JSON.stringify(config, null, 2));
      
      // Obtener preguntas sin justificación
      const questions = await questionService.getQuestionsWithoutJustification(
        config.batchSize,
        config.filters
      );
      
      console.log(`📊 Encontradas ${questions.length} preguntas sin justificación`);
      
      if (questions.length === 0) {
        console.log('✅ No hay preguntas para procesar');
        result.endTime = new Date();
        result.durationMs = result.endTime.getTime() - startTime.getTime();
        return result;
      }
      
      // Procesar cada pregunta
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        result.totalProcessed++;
        
        try {
          console.log(`[${i + 1}/${questions.length}] Procesando ${question.code}...`);
          
          const generationResult = await this.generateAndSaveJustification(question.id!);
          
          if (generationResult.success) {
            result.successful++;
            console.log(`  ✅ Éxito (${generationResult.processingTimeMs}ms)`);
          } else {
            result.failed++;
            result.errors.push({
              questionId: question.id!,
              questionCode: question.code,
              error: generationResult.error || 'Error desconocido',
            });
            console.log(`  ❌ Error: ${generationResult.error}`);
          }
          
          // Pausa entre preguntas para evitar rate limiting
          if (i < questions.length - 1) {
            await this.delay(config.delayBetweenBatches);
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            questionId: question.id!,
            questionCode: question.code,
            error: error.message || 'Error desconocido',
          });
          console.error(`  ❌ Error procesando ${question.code}:`, error);
        }
      }
      
      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - startTime.getTime();
      
      // Resumen
      console.log('\n📊 RESUMEN DEL PROCESAMIENTO:');
      console.log(`  Total procesadas: ${result.totalProcessed}`);
      console.log(`  Exitosas: ${result.successful}`);
      console.log(`  Fallidas: ${result.failed}`);
      console.log(`  Omitidas: ${result.skipped}`);
      console.log(`  Duración: ${(result.durationMs / 1000).toFixed(2)}s`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ ERRORES:');
        result.errors.forEach(err => {
          console.log(`  - ${err.questionCode}: ${err.error}`);
        });
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Error en procesamiento batch:', error);
      result.endTime = new Date();
      result.durationMs = result.endTime.getTime() - startTime.getTime();
      throw error;
    }
  }

  /**
   * Procesa TODAS las preguntas sin justificación (por lotes)
   */
  async processAllQuestionsWithoutJustification(
    config: Partial<BatchProcessingConfig> = {}
  ): Promise<BatchProcessingResult> {
    const defaultConfig: BatchProcessingConfig = {
      batchSize: 50,
      delayBetweenBatches: 2000, // 2 segundos
      maxRetries: 3,
      filters: {
        withoutJustification: true,
      },
      ...config,
    };
    
    const globalStartTime = new Date();
    
    const globalResult: BatchProcessingResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startTime: globalStartTime,
      endTime: new Date(),
      durationMs: 0,
    };
    
    try {
      console.log('🚀 Iniciando procesamiento COMPLETO de todas las preguntas...');
      
      let hasMore = true;
      let batchNumber = 1;
      
      while (hasMore) {
        console.log(`\n📦 LOTE ${batchNumber}:`);
        
        const batchResult = await this.processBatch(defaultConfig);
        
        // Acumular resultados
        globalResult.totalProcessed += batchResult.totalProcessed;
        globalResult.successful += batchResult.successful;
        globalResult.failed += batchResult.failed;
        globalResult.skipped += batchResult.skipped;
        globalResult.errors.push(...batchResult.errors);
        
        // Verificar si hay más preguntas
        hasMore = batchResult.totalProcessed === defaultConfig.batchSize;
        
        if (hasMore) {
          console.log(`\n⏸️ Pausa de 5 segundos antes del siguiente lote...`);
          await this.delay(5000);
          batchNumber++;
        }
      }
      
      globalResult.endTime = new Date();
      globalResult.durationMs = 
        globalResult.endTime.getTime() - globalStartTime.getTime();
      
      // Resumen global
      console.log('\n\n🎉 PROCESAMIENTO COMPLETO FINALIZADO:');
      console.log(`  Total procesadas: ${globalResult.totalProcessed}`);
      console.log(`  Exitosas: ${globalResult.successful}`);
      console.log(`  Fallidas: ${globalResult.failed}`);
      console.log(`  Tasa de éxito: ${((globalResult.successful / globalResult.totalProcessed) * 100).toFixed(2)}%`);
      console.log(`  Duración total: ${(globalResult.durationMs / 1000 / 60).toFixed(2)} minutos`);
      
      return globalResult;
    } catch (error: any) {
      console.error('❌ Error en procesamiento completo:', error);
      globalResult.endTime = new Date();
      globalResult.durationMs = 
        globalResult.endTime.getTime() - globalStartTime.getTime();
      throw error;
    }
  }

  /**
   * Regenera justificación para una pregunta específica
   */
  async regenerateJustification(questionId: string): Promise<JustificationGenerationResult> {
    try {
      const question = await questionService.getQuestionById(questionId);
      
      if (!question) {
        return {
          success: false,
          questionId,
          error: 'Pregunta no encontrada',
        };
      }
      
      console.log(`🔄 Regenerando justificación para ${question.code}...`);
      
      const generationData = questionService.questionToGenerationData(question);
      const result = await geminiService.generateQuestionJustification(generationData);
      
      if (result.success && result.justification) {
        await questionService.updateQuestionJustification(questionId, result.justification);
        console.log(`✅ Justificación regenerada para ${question.code}`);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error regenerando justificación:', error);
      return {
        success: false,
        questionId,
        error: error.message,
      };
    }
  }

  /**
   * Elimina justificación de una pregunta
   */
  async deleteJustification(questionId: string): Promise<void> {
    try {
      await questionService.deleteQuestionJustification(questionId);
      console.log(`✅ Justificación eliminada de pregunta ${questionId}`);
    } catch (error: any) {
      console.error('Error eliminando justificación:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de justificaciones
   */
  async getStats(filters: QuestionFilters = {}) {
    return questionService.getJustificationStats(filters);
  }

  /**
   * Valida todas las justificaciones existentes
   */
  async validateAllJustifications(filters: QuestionFilters = {}) {
    console.log('🔍 Validando justificaciones existentes...');
    
    const questions = await questionService.getQuestions({
      ...filters,
      withJustification: true,
    });
    
    const validationResults = [];
    
    for (const question of questions) {
      if (question.aiJustification) {
        const validation = await geminiService.validateJustification(
          question,
          question.aiJustification
        );
        
        validationResults.push({
          questionId: question.id,
          questionCode: question.code,
          validation,
        });
      }
    }
    
    // Resumen
    const validCount = validationResults.filter(r => r.validation.isValid).length;
    const invalidCount = validationResults.length - validCount;
    
    console.log(`\n📊 RESUMEN DE VALIDACIÓN:`);
    console.log(`  Total validadas: ${validationResults.length}`);
    console.log(`  Válidas: ${validCount}`);
    console.log(`  Con problemas: ${invalidCount}`);
    
    return {
      total: validationResults.length,
      valid: validCount,
      invalid: invalidCount,
      results: validationResults,
    };
  }

  /**
   * Utilidad: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar instancia singleton
export const justificationService = new JustificationService();

export default justificationService;

