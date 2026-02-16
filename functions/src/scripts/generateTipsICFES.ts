/**
 * Script batch: genera tips ICFES con Gemini y los guarda en Firestore (TipsIA).
 *
 * Usa la misma base de datos que el resto del backend (superate-6c730) vía
 * getStudentDatabase() dentro de generateAndSaveTips.
 *
 * Uso:
 *   npm run build
 *   node lib/scripts/generateTipsICFES.js
 *
 * Opciones (env o argumentos):
 *   BATCH_SIZE=50       total de tips a generar (por lotes de 10)
 *   DRY_RUN=true        solo valida con IA, no escribe en Firestore
 *   CATEGORIES=Estrategia,Tiempo,...  categorías a repartir (opcional)
 *
 * Ejemplo con argumentos:
 *   node lib/scripts/generateTipsICFES.js --batch-size=30 --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env desde functions/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { generateAndSaveTips, TIP_CATEGORIES } from '../services/tipsICFES.service';

const DELAY_BETWEEN_BATCHES_MS = 3500; // Respetar rate limiting de Gemini
const TIPS_PER_REQUEST = 10;

function parseArgs(): { batchSize: number; dryRun: boolean; categories: string[] } {
  const args = process.argv.slice(2);
  let batchSize = parseInt(process.env.BATCH_SIZE || '20', 10) || 20;
  let dryRun = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  let categories: string[] = process.env.CATEGORIES
    ? process.env.CATEGORIES.split(',').map((s) => s.trim()).filter(Boolean)
    : [...TIP_CATEGORIES];

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      batchSize = parseInt(arg.split('=')[1], 10) || batchSize;
    } else if (arg.startsWith('--categories=')) {
      categories = arg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  return { batchSize, dryRun, categories };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { batchSize, dryRun, categories } = parseArgs();

  console.log('📚 Generación de Tips ICFES');
  console.log('   Batch size:', batchSize);
  console.log('   Dry run:', dryRun);
  console.log('   Categorías:', categories.join(', '));
  console.log('');

  if (dryRun) {
    const result = await generateAndSaveTips({
      count: Math.min(TIPS_PER_REQUEST, batchSize),
      categories,
      dryRun: true,
    });
    console.log('✅ Dry run completado. Skipped:', result.skipped);
    return;
  }

  let totalSaved = 0;
  const iterations = Math.ceil(batchSize / TIPS_PER_REQUEST);

  for (let i = 0; i < iterations; i++) {
    const count = i === iterations - 1 && batchSize % TIPS_PER_REQUEST
      ? batchSize % TIPS_PER_REQUEST
      : TIPS_PER_REQUEST;
    console.log(`   Lote ${i + 1}/${iterations} (generando ${count} tips)...`);
    try {
      const result = await generateAndSaveTips({ count, categories });
      totalSaved += result.saved;
      console.log(`   ✅ Guardados: ${result.saved}, omitidos: ${result.skipped}`);
      if (i < iterations - 1) {
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    } catch (err: any) {
      console.error(`   ❌ Error en lote ${i + 1}:`, err.message);
      throw err;
    }
  }

  console.log('');
  console.log(`✅ Total tips guardados en TipsIA: ${totalSaved}`);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
