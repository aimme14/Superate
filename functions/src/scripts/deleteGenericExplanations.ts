/**
 * Script para eliminar justificaciones genéricas de la base de datos
 * 
 * Elimina el campo aiJustification de las preguntas que tienen
 * explicaciones genéricas en las respuestas incorrectas, para poder
 * regenerarlas correctamente.
 */

import * as admin from 'firebase-admin';
import { questionService } from '../services/question.service';
import { QuestionFilters } from '../types/question.types';
import { db } from '../config/firebase.config';

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
        normalizedExplanation.length < 100) {
      return true;
    }
  }
  
  return false;
}

/**
 * Elimina justificaciones genéricas de la base de datos
 */
async function deleteGenericExplanations() {
  console.log('🔍 Buscando y eliminando justificaciones genéricas...\n');
  
  try {
    // Obtener todas las preguntas con justificaciones
    const filters: QuestionFilters = {
      withJustification: true,
    };
    
    console.log('📥 Obteniendo todas las preguntas con justificaciones...');
    const allQuestions = await questionService.getQuestions(filters);
    console.log(`✅ Se obtuvieron ${allQuestions.length} preguntas con justificaciones\n`);
    
    // Identificar preguntas con explicaciones genéricas
    const questionsToUpdate = new Set<string>();
    
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
          if (question.id) {
            questionsToUpdate.add(question.id);
          }
          break; // Solo necesitamos saber que tiene al menos una explicación genérica
        }
      }
    }
    
    console.log(`\n✅ Análisis completado\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Mostrar resumen antes de eliminar
    console.log(`📊 RESUMEN:`);
    console.log(`   Total de preguntas analizadas: ${allQuestions.length}`);
    console.log(`   Preguntas con explicaciones genéricas encontradas: ${questionsToUpdate.size}\n`);
    
    if (questionsToUpdate.size === 0) {
      console.log('✅ No se encontraron preguntas con explicaciones genéricas.\n');
      console.log('═══════════════════════════════════════════════════════════════');
      process.exit(0);
      return;
    }
    
    // Confirmar antes de eliminar (a menos que se use --force)
    const forceDelete = process.argv.includes('--force');
    
    if (!forceDelete) {
      console.log('⚠️  ADVERTENCIA: Este script eliminará el campo aiJustification de las preguntas identificadas.');
      console.log(`   Se eliminarán las justificaciones de ${questionsToUpdate.size} preguntas.\n`);
      console.log('   Para proceder sin confirmación, ejecuta con --force\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('❌ Operación cancelada. Usa --force para proceder automáticamente.\n');
      process.exit(0);
      return;
    }
    
    // Eliminar el campo aiJustification de las preguntas identificadas
    console.log('🗑️  Eliminando campo aiJustification de las preguntas...\n');
    
    const questionIds = Array.from(questionsToUpdate);
    let deleted = 0;
    let errors = 0;
    
    // Procesar en lotes para no sobrecargar Firestore
    const batchSize = 10;
    for (let i = 0; i < questionIds.length; i += batchSize) {
      const batch = questionIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (questionId) => {
          try {
            const questionRef = db.doc(`superate/auth/questions/${questionId}`);
            await questionRef.update({
              aiJustification: admin.firestore.FieldValue.delete(),
            });
            deleted++;
            
            if (deleted % 10 === 0) {
              console.log(`   Eliminadas ${deleted}/${questionIds.length} justificaciones...`);
            }
          } catch (error: any) {
            errors++;
            console.error(`   ❌ Error al eliminar justificación de pregunta ${questionId}:`, error.message);
          }
        })
      );
      
      // Pequeña pausa entre lotes para no sobrecargar
      if (i + batchSize < questionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Proceso completado\n`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`📊 RESUMEN FINAL:`);
    console.log(`   Total de preguntas analizadas: ${allQuestions.length}`);
    console.log(`   Preguntas con explicaciones genéricas: ${questionsToUpdate.size}`);
    console.log(`   Justificaciones eliminadas exitosamente: ${deleted}`);
    console.log(`   Errores: ${errors}\n`);
    
    if (deleted > 0) {
      console.log('✅ Las justificaciones genéricas han sido eliminadas.');
      console.log('   Ahora puedes regenerar las justificaciones usando el script de generación.\n');
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
console.log('🚀 Iniciando eliminación de justificaciones genéricas...\n');
deleteGenericExplanations();
