/**
 * Script para ver las justificaciones generadas
 * 
 * Muestra las últimas justificaciones generadas con su ubicación en Firestore
 */

import * as admin from 'firebase-admin';
import { questionService } from '../services/question.service';
import { QuestionFilters } from '../types/question.types';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Muestra las justificaciones generadas recientemente
 */
async function viewRecentJustifications(limit: number = 10) {
  console.log('🔍 Buscando preguntas con justificaciones generadas...\n');
  
  try {
    const filters: QuestionFilters = {
      withJustification: true,
      limit: limit,
    };
    
    const questions = await questionService.getQuestions(filters);
    
    if (questions.length === 0) {
      console.log('⚠️ No se encontraron preguntas con justificaciones');
      return;
    }
    
    console.log(`📊 Encontradas ${questions.length} preguntas con justificación:\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    questions.forEach((question, index) => {
      console.log(`${index + 1}. PREGUNTA: ${question.code}`);
      console.log(`   Materia: ${question.subject} - ${question.topic}`);
      console.log(`   Nivel: ${question.level}`);
      console.log(`   
📍 Ubicación en Firestore:`);
      console.log(`   superate/auth/questions/${question.id}/aiJustification`);
      console.log(`   
🔗 URL Firebase Console:`);
      console.log(`   https://console.firebase.google.com/project/superate-6c730/firestore/data/~2Fsuperate~2Fauth~2Fquestions~2F${question.id}`);
      
      if (question.aiJustification) {
        const justif = question.aiJustification;
        console.log(`   
✅ Justificación:`);
        console.log(`   - Generado: ${justif.generatedAt}`);
        console.log(`   - Modelo: ${justif.generatedBy}`);
        console.log(`   - Confianza: ${(justif.confidence * 100).toFixed(1)}%`);
        console.log(`   - Dificultad: ${justif.perceivedDifficulty}`);
        console.log(`   - Conceptos clave: ${justif.keyConcepts.length}`);
        
        console.log(`   
📝 Explicación de respuesta correcta (preview):`);
        const preview = justif.correctAnswerExplanation.substring(0, 150);
        console.log(`   "${preview}..."`);
        
        console.log(`   
❌ Explicaciones de incorrectas: ${justif.incorrectAnswersExplanation.length} opciones`);
      }
      
      console.log('\n' + '─'.repeat(80) + '\n');
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n✅ Total mostrado: ${questions.length} preguntas con justificación`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Parsear argumentos
const limit = parseInt(process.argv[2]) || 10;

console.log(`🔍 Mostrando últimas ${limit} preguntas con justificación\n`);
viewRecentJustifications(limit);

