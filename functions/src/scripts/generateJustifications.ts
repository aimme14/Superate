/**
 * Script para generar justificaciones de forma masiva
 * 
 * Este script se puede ejecutar manualmente para procesar
 * todas las preguntas sin justificación
 * 
 * Uso:
 *   npm run generate-justifications
 */

import * as admin from 'firebase-admin';
import { justificationService } from '../services/justification.service';
import { QuestionFilters } from '../types/question.types';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Configuración del script
 */
interface ScriptConfig {
  batchSize?: number;
  delayBetweenBatches?: number;
  filters?: QuestionFilters;
  dryRun?: boolean; // Si es true, solo muestra lo que haría sin ejecutar
}

/**
 * Ejecuta el script de generación de justificaciones
 */
async function runScript(config: ScriptConfig = {}) {
  const defaultConfig: ScriptConfig = {
    batchSize: 10, // Por defecto procesa 10 preguntas por lote
    delayBetweenBatches: 2000,
    dryRun: false,
    filters: {},
    ...config,
  };

  console.log('🚀 Iniciando script de generación de justificaciones');
  console.log('⚙️ Configuración:', JSON.stringify(defaultConfig, null, 2));
  console.log('');

  if (defaultConfig.dryRun) {
    console.log('⚠️ MODO DRY RUN: No se generarán justificaciones reales\n');
  }

  try {
    const startTime = Date.now();

    if (defaultConfig.dryRun) {
      // En modo dry run, solo mostrar estadísticas
      console.log('📊 Obteniendo estadísticas...');
      const stats = await justificationService.getStats(defaultConfig.filters);
      
      console.log('\n📈 ESTADÍSTICAS ACTUALES:');
      console.log(`  Total de preguntas: ${stats.total}`);
      console.log(`  Con justificación: ${stats.withJustification} (${((stats.withJustification / stats.total) * 100).toFixed(2)}%)`);
      console.log(`  Sin justificación: ${stats.withoutJustification} (${((stats.withoutJustification / stats.total) * 100).toFixed(2)}%)`);
      
      if (stats.averageConfidence) {
        console.log(`  Confianza promedio: ${(stats.averageConfidence * 100).toFixed(2)}%`);
      }
      
      console.log('\n📚 Por Materia:');
      Object.entries(stats.bySubject).forEach(([subject, data]) => {
        const percentage = ((data.withJustification / data.total) * 100).toFixed(2);
        console.log(`  ${subject}: ${data.withJustification}/${data.total} (${percentage}%)`);
      });
      
      console.log('\n📊 Por Nivel:');
      Object.entries(stats.byLevel).forEach(([level, data]) => {
        const percentage = ((data.withJustification / data.total) * 100).toFixed(2);
        console.log(`  ${level}: ${data.withJustification}/${data.total} (${percentage}%)`);
      });
      
      console.log('\n🎓 Por Grado:');
      Object.entries(stats.byGrade).forEach(([grade, data]) => {
        const percentage = ((data.withJustification / data.total) * 100).toFixed(2);
        const gradeName = getGradeName(grade);
        console.log(`  ${gradeName}: ${data.withJustification}/${data.total} (${percentage}%)`);
      });
      
      console.log('\n✅ Dry run completado');
    } else {
      // Procesar un solo lote de preguntas (por defecto 10) y detenerse
      const batchSize = defaultConfig.batchSize || 10;
      const delay = defaultConfig.delayBetweenBatches || 2000;
      
      console.log(`\n📦 Procesando lote de ${batchSize} preguntas...\n`);
      
      const result = await justificationService.processBatch({
        batchSize: batchSize,
        delayBetweenBatches: delay,
        maxRetries: 3,
        filters: defaultConfig.filters || {},
      });

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;

      console.log('\n\n═══════════════════════════════════════');
      console.log('🎉 LOTE COMPLETADO');
      console.log('═══════════════════════════════════════');
      console.log(`📊 Total procesadas: ${result.totalProcessed}`);
      console.log(`✅ Exitosas: ${result.successful}`);
      console.log(`❌ Fallidas: ${result.failed}`);
      console.log(`⏭️ Omitidas: ${result.skipped}`);
      
      if (result.totalProcessed > 0) {
        console.log(`📈 Tasa de éxito: ${((result.successful / result.totalProcessed) * 100).toFixed(2)}%`);
        console.log(`⏱️ Duración total: ${(durationSeconds / 60).toFixed(2)} minutos (${durationSeconds.toFixed(2)}s)`);
        console.log(`⚡ Promedio por pregunta: ${(durationSeconds / result.totalProcessed).toFixed(2)} segundos`);
      }
      
      console.log('═══════════════════════════════════════\n');

      if (result.errors.length > 0) {
        console.log('❌ ERRORES ENCONTRADOS:');
        result.errors.forEach((err, index) => {
          console.log(`  ${index + 1}. ${err.questionCode}: ${err.error}`);
        });
        console.log('');
      }

      // Mostrar estadísticas finales
      console.log('📊 Obteniendo estadísticas actuales...');
      const finalStats = await justificationService.getStats(defaultConfig.filters);
      console.log(`  Total con justificación: ${finalStats.withJustification}/${finalStats.total} (${((finalStats.withJustification / finalStats.total) * 100).toFixed(2)}%)`);
      console.log(`  Total sin justificación: ${finalStats.withoutJustification}`);
      
      console.log('\n⏸️  PROCESAMIENTO DETENIDO');
      console.log('💡 Para procesar el siguiente lote, ejecuta el comando nuevamente:');
      console.log(`   npm run generate-justifications -- --batch-size ${batchSize}\n`);
    }

    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Convierte el código de grado a nombre legible
 */
function getGradeName(grade: string): string {
  const gradeMap: Record<string, string> = {
    '6': 'Sexto',
    '7': 'Séptimo',
    '8': 'Octavo',
    '9': 'Noveno',
    '0': 'Décimo',
    '1': 'Undécimo',
  };
  return gradeMap[grade] || grade;
}

/**
 * Parsea los argumentos de línea de comandos
 */
function parseArguments(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: ScriptConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--delay':
        config.delayBetweenBatches = parseInt(args[++i], 10);
        break;
      case '--subject':
        config.filters = config.filters || {};
        config.filters.subject = args[++i];
        break;
      case '--level':
        config.filters = config.filters || {};
        config.filters.level = args[++i];
        break;
      case '--grade':
        config.filters = config.filters || {};
        config.filters.grade = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

/**
 * Muestra la ayuda del script
 */
function printHelp() {
  console.log(`
Script de Generación de Justificaciones con IA

⚠️ IMPORTANTE: Este script procesa UN SOLO LOTE y se detiene.
   Ejecuta el comando nuevamente para procesar el siguiente lote.

USO:
  npm run generate-justifications [opciones]

OPCIONES:
  --dry-run              Solo muestra estadísticas sin generar justificaciones
  --batch-size <n>       Número de preguntas por lote (default: 10)
  --delay <ms>           Milisegundos entre requests (default: 2000)
  --subject <materia>    Filtrar por materia (ej: "Matemáticas")
  --level <nivel>        Filtrar por nivel (ej: "Fácil", "Medio", "Difícil")
  --grade <grado>        Filtrar por grado (ej: "6", "7", "8", "9", "0", "1")
  --help                 Muestra esta ayuda

EJEMPLOS:
  # Ver estadísticas sin generar
  npm run generate-justifications -- --dry-run

  # Procesar un lote de 10 preguntas (default)
  npm run generate-justifications

  # Procesar un lote de 20 preguntas
  npm run generate-justifications -- --batch-size 20

  # Procesar solo para Matemáticas (10 preguntas)
  npm run generate-justifications -- --subject Matemáticas

  # Procesar para nivel Fácil con lotes de 15
  npm run generate-justifications -- --level Fácil --batch-size 15

  # Procesar para grado Décimo con delay de 3 segundos
  npm run generate-justifications -- --grade 0 --delay 3000
  `);
}

// Ejecutar el script
if (require.main === module) {
  const config = parseArguments();
  runScript(config);
}

export { runScript };

