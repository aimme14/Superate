/**
 * Script para buscar preguntas con explicaciones genéricas en respuestas incorrectas
 * 
 * Busca explicaciones que contengan frases genéricas como:
 * "La opción X es incorrecta porque no corresponde a la respuesta correcta"
 * o variaciones similares
 */

import * as admin from 'firebase-admin';
import { questionService } from '../services/question.service';
import { QuestionFilters } from '../types/question.types';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Patrones genéricos a buscar en las explicaciones
 */
const GENERIC_PATTERNS = [
  /no corresponde a la respuesta correcta/i,
  /es incorrecta porque no corresponde/i,
  /no es la respuesta correcta/i,
  /es incorrecta porque no es la respuesta/i,
  /no corresponde a la opción correcta/i,
  /es incorrecta porque no es la opción correcta/i,
  /no es la opción correcta/i,
  /no es correcta porque no corresponde/i,
  /es incorrecta porque no corresponde a la opción correcta/i,
  /no corresponde a la correcta/i,
];

/**
 * Verifica si una explicación contiene patrones genéricos
 */
function hasGenericExplanation(explanation: string): boolean {
  if (!explanation || typeof explanation !== 'string') {
    return false;
  }
  
  const normalizedExplanation = explanation.trim().toLowerCase();
  
  // Verificar cada patrón
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(explanation)) {
      return true;
    }
  }
  
  // Verificar también variaciones comunes
  const genericPhrases = [
    'no corresponde a la respuesta',
    'no es la respuesta',
    'no corresponde a la opción',
    'no es la opción',
    'es incorrecta porque no',
  ];
  
  for (const phrase of genericPhrases) {
    if (normalizedExplanation.includes(phrase) && 
        normalizedExplanation.length < 100) { // Explicaciones muy cortas con estas frases son sospechosas
      return true;
    }
  }
  
  return false;
}

/**
 * Busca preguntas con explicaciones genéricas
 */
async function findGenericExplanations() {
  console.log('🔍 Buscando preguntas con explicaciones genéricas en respuestas incorrectas...\n');
  
  try {
    // Obtener todas las preguntas con justificaciones
    const filters: QuestionFilters = {
      withJustification: true,
    };
    
    console.log('📥 Obteniendo todas las preguntas con justificaciones...');
    const allQuestions = await questionService.getQuestions(filters);
    console.log(`✅ Se obtuvieron ${allQuestions.length} preguntas con justificaciones\n`);
    
    const questionsWithGenericExplanations: Array<{
      question: any;
      optionId: string;
      explanation: string;
      matchedPattern: string;
    }> = [];
    
    // Revisar cada pregunta
    console.log('🔎 Analizando explicaciones...\n');
    let processed = 0;
    
    for (const question of allQuestions) {
      processed++;
      if (processed % 100 === 0) {
        console.log(`   Procesadas ${processed}/${allQuestions.length} preguntas...`);
      }
      
      if (!question.aiJustification?.incorrectAnswersExplanation) {
        continue;
      }
      
      // Revisar cada explicación de respuesta incorrecta
      for (const incorrectExplanation of question.aiJustification.incorrectAnswersExplanation) {
        if (!incorrectExplanation.explanation) {
          continue;
        }
        
        // Verificar si tiene patrón genérico
        if (hasGenericExplanation(incorrectExplanation.explanation)) {
          // Encontrar qué patrón coincidió
          let matchedPattern = '';
          for (const pattern of GENERIC_PATTERNS) {
            if (pattern.test(incorrectExplanation.explanation)) {
              matchedPattern = pattern.toString();
              break;
            }
          }
          
          questionsWithGenericExplanations.push({
            question: {
              id: question.id,
              code: question.code,
              subject: question.subject,
              topic: question.topic,
              grade: question.grade,
              level: question.level,
            },
            optionId: incorrectExplanation.optionId,
            explanation: incorrectExplanation.explanation,
            matchedPattern: matchedPattern || 'Patrón genérico detectado',
          });
        }
      }
    }
    
    console.log(`\n✅ Análisis completado\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Mostrar resumen
    console.log(`📊 RESUMEN:`);
    console.log(`   Total de preguntas analizadas: ${allQuestions.length}`);
    console.log(`   Preguntas con explicaciones genéricas: ${questionsWithGenericExplanations.length}`);
    console.log(`   Porcentaje: ${((questionsWithGenericExplanations.length / allQuestions.length) * 100).toFixed(2)}%\n`);
    
    // Agrupar por pregunta (una pregunta puede tener múltiples explicaciones genéricas)
    const uniqueQuestions = new Set(questionsWithGenericExplanations.map(item => item.question.id));
    console.log(`   Preguntas únicas afectadas: ${uniqueQuestions.size}\n`);
    
    // Mostrar detalles
    if (questionsWithGenericExplanations.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('📋 DETALLES DE PREGUNTAS CON EXPLICACIONES GENÉRICAS:\n');
      
      // Agrupar por pregunta
      const groupedByQuestion = new Map<string, typeof questionsWithGenericExplanations>();
      
      for (const item of questionsWithGenericExplanations) {
        const questionId = item.question.id;
        if (!groupedByQuestion.has(questionId)) {
          groupedByQuestion.set(questionId, []);
        }
        groupedByQuestion.get(questionId)!.push(item);
      }
      
      let index = 1;
      for (const [questionId, items] of groupedByQuestion.entries()) {
        const firstItem = items[0];
        console.log(`${index}. PREGUNTA: ${firstItem.question.code}`);
        console.log(`   ID: ${questionId}`);
        console.log(`   Materia: ${firstItem.question.subject} - ${firstItem.question.topic}`);
        console.log(`   Grado: ${firstItem.question.grade} | Nivel: ${firstItem.question.level}`);
        console.log(`   🔗 URL Firebase Console:`);
        console.log(`      https://console.firebase.google.com/project/superate-6c730/firestore/data/~2Fsuperate~2Fauth~2Fquestions~2F${questionId}`);
        console.log(`   📍 Ubicación en Firestore:`);
        console.log(`      superate/auth/questions/${questionId}/aiJustification/incorrectAnswersExplanation`);
        console.log(`   ❌ Explicaciones genéricas encontradas: ${items.length}`);
        
        for (const item of items) {
          console.log(`\n      Opción ${item.optionId}:`);
          console.log(`      "${item.explanation}"`);
          console.log(`      Patrón detectado: ${item.matchedPattern}`);
        }
        
        console.log('\n' + '─'.repeat(80) + '\n');
        index++;
      }
      
      // Exportar a JSON si se solicita
      const exportJson = process.argv.includes('--json');
      if (exportJson) {
        const fs = require('fs');
        const path = require('path');
        const outputPath = path.join(__dirname, '../../generic-explanations-report.json');
        
        const report = {
          summary: {
            totalQuestionsAnalyzed: allQuestions.length,
            questionsWithGenericExplanations: questionsWithGenericExplanations.length,
            uniqueQuestionsAffected: uniqueQuestions.size,
            percentage: ((questionsWithGenericExplanations.length / allQuestions.length) * 100).toFixed(2) + '%',
          },
          details: Array.from(groupedByQuestion.entries()).map(([questionId, items]) => ({
            questionId,
            code: items[0].question.code,
            subject: items[0].question.subject,
            topic: items[0].question.topic,
            grade: items[0].question.grade,
            level: items[0].question.level,
            firestorePath: `superate/auth/questions/${questionId}/aiJustification/incorrectAnswersExplanation`,
            genericExplanations: items.map(item => ({
              optionId: item.optionId,
              explanation: item.explanation,
              matchedPattern: item.matchedPattern,
            })),
          })),
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Reporte exportado a: ${outputPath}\n`);
      }
    } else {
      console.log('✅ No se encontraron preguntas con explicaciones genéricas.\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Ejecutar el script
console.log('🚀 Iniciando búsqueda de explicaciones genéricas...\n');
findGenericExplanations();
