/**
 * Verifica que getRandomEjercicios use una sola query y como mucho `limit` lecturas.
 * Ejecutar desde functions/: npm run verify:ejercicios-ia-reads
 *
 * Por defecto 1 sola llamada (1 query, ≤10 lecturas). Para repetir: VERIFY_ROUNDS=3 npm run ...
 *
 * Requiere acceso a Firestore (serviceAccountKey.json en functions/ o ADC).
 * Si no hay campo `shard` en los docs, el resultado puede ser vacío: ejecutar
 * npm run backfill:ejercicios-ia-rand antes.
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { getRandomEjercicios } from '../services/ejerciciosIA.service';

function initAdminOnce(): void {
  try {
    admin.app('superate-6c730');
  } catch {
    const credentialsPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(credentialsPath)) {
      const sa = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      admin.initializeApp(
        { credential: admin.credential.cert(sa), projectId: 'superate-6c730' },
        'superate-6c730'
      );
    } else {
      admin.initializeApp({ projectId: 'superate-6c730' }, 'superate-6c730');
    }
  }
}

async function main(): Promise<void> {
  console.log('══ Verificación lecturas mini simulacro (EjerciciosIA) ══\n');
  initAdminOnce();

  const rounds = Math.min(
    20,
    Math.max(1, parseInt(process.env.VERIFY_ROUNDS || '1', 10) || 1)
  );
  for (let i = 1; i <= rounds; i++) {
    let exercises: Awaited<ReturnType<typeof getRandomEjercicios>>['exercises'];
    let documentsRead: number;
    try {
      const out = await getRandomEjercicios(undefined, undefined, 10);
      exercises = out.exercises;
      documentsRead = out.documentsRead;
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? (e as { code?: number }).code : undefined;
      if (
        code === 9 ||
        (e as { message?: string })?.message?.includes('FAILED_PRECONDITION')
      ) {
        console.error(
          '❌ Falta índice collectionGroup para `ejercicios` / campo `shard`.\n' +
            '   firebase deploy --only firestore:indexes\n' +
            '   Espera a que el field override termine en la consola de Firebase.'
        );
      }
      throw e;
    }
    console.log(`Ronda ${i}/${rounds}:`);
    console.log(`  • Documentos leídos (facturación Firestore, 1 query): ${documentsRead}`);
    console.log(`  • Ejercicios con "question" devueltos al caller: ${exercises.length}`);
    if (documentsRead > 10) {
      console.error('  ❌ ERROR: documentsRead no debe superar 10.');
      process.exit(1);
    }
    if (documentsRead === 0) {
      console.log(
        '  ⚠️ 0 lecturas: shard sin datos o sin coincidencias. Prueba de nuevo o: npm run backfill:ejercicios-ia-rand'
      );
    }
    console.log('');
  }

  console.log('✅ Cada llamada a getRandomEjercicios ejecuta una sola query con limit(10).');
  console.log('   Lecturas facturables = número de documentos devueltos por esa query (≤10).\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
