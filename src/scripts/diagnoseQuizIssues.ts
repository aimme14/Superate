/**
 * Script de diagnóstico para problemas con cuestionarios
 * Ejecutar desde la consola del navegador para diagnosticar problemas
 */

import { questionService } from '@/services/firebase/question.service';
import { quizGeneratorService } from '@/services/quiz/quizGenerator.service';

export const diagnoseQuizIssues = async () => {
  console.log('🔍 Iniciando diagnóstico de cuestionarios...');
  
  try {
    // 1. Verificar estadísticas del banco de preguntas
    console.log('\n📊 1. Verificando estadísticas del banco de preguntas...');
    const statsResult = await questionService.getQuestionStats();
    
    if (statsResult.success) {
      const stats = statsResult.data;
      console.log('✅ Estadísticas obtenidas:', stats);
      
      // Verificar específicamente Lenguaje
      const lenguajeCount = stats.bySubject['Lenguaje'] || 0;
      console.log(`📚 Preguntas de Lenguaje disponibles: ${lenguajeCount}`);
      
      if (lenguajeCount === 0) {
        console.error('❌ PROBLEMA: No hay preguntas de Lenguaje en el banco de datos');
        return;
      }
      
      if (lenguajeCount < 15) {
        console.warn(`⚠️ ADVERTENCIA: Solo hay ${lenguajeCount} preguntas de Lenguaje (mínimo recomendado: 15)`);
      }
    } else {
      console.error('❌ Error obteniendo estadísticas:', statsResult.error);
    }

    // 2. Probar generación de cuestionario de Lenguaje
    console.log('\n🎯 2. Probando generación de cuestionario de Lenguaje...');
    
    const testConfigs = [
      { subject: 'Lenguaje', phase: 'first' as const, grade: '1' },
      { subject: 'Lenguaje', phase: 'first' as const, grade: '0' },
      { subject: 'Lenguaje', phase: 'first' as const, grade: undefined },
    ];

    for (const config of testConfigs) {
      console.log(`\n🧪 Probando: ${config.subject} - ${config.phase} - Grado ${config.grade || 'todos'}`);
      
      const quizResult = await quizGeneratorService.generateQuiz(
        config.subject,
        config.phase,
        config.grade
      );
      
      if (quizResult.success) {
        const quiz = quizResult.data;
        console.log(`✅ Éxito: ${quiz.questions.length} preguntas generadas`);
        console.log(`📝 Título: ${quiz.title}`);
        console.log(`⏱️ Tiempo límite: ${quiz.timeLimit} minutos`);
      } else {
        console.error(`❌ Error: ${quizResult.error.message}`);
      }
    }

    // 3. Verificar preguntas específicas de Lenguaje
    console.log('\n🔍 3. Verificando preguntas específicas de Lenguaje...');
    
    const lenguajeQuestionsResult = await questionService.getFilteredQuestions({
      subject: 'Lenguaje',
      limit: 5
    });
    
    if (lenguajeQuestionsResult.success) {
      const questions = lenguajeQuestionsResult.data;
      console.log(`✅ Se encontraron ${questions.length} preguntas de Lenguaje`);
      
      if (questions.length > 0) {
        console.log('📋 Ejemplo de pregunta:');
        const sample = questions[0];
        console.log({
          id: sample.id,
          code: sample.code,
          topic: sample.topic,
          level: sample.level,
          grade: sample.grade,
          hasText: !!sample.questionText,
          hasImages: !!(sample.questionImages && sample.questionImages.length > 0),
          optionsCount: sample.options.length
        });
      }
    } else {
      console.error('❌ Error obteniendo preguntas de Lenguaje:', lenguajeQuestionsResult.error);
    }

    // 4. Verificar configuración de cuestionarios
    console.log('\n⚙️ 4. Verificando configuración de cuestionarios...');
    const configs = quizGeneratorService.getAvailableConfigurations();
    console.log('📋 Configuraciones disponibles:', configs);
    
    const lenguajeConfig = configs['Lenguaje'];
    if (lenguajeConfig) {
      console.log('✅ Configuración de Lenguaje encontrada:', lenguajeConfig);
    } else {
      console.error('❌ PROBLEMA: No hay configuración para Lenguaje');
    }

    console.log('\n✅ Diagnóstico completado');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
};

// Función para ejecutar desde la consola del navegador
(window as any).diagnoseQuizIssues = diagnoseQuizIssues;

console.log('💡 Para ejecutar el diagnóstico, escribe en la consola: diagnoseQuizIssues()');
