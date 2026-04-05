/**
 * Asigna shard ∈ [0, 99] a cada documento en collectionGroup('ejercicios') bajo EjerciciosIA
 * que aún no tenga el campo (o sin shard numérico).
 *
 * Costo: 1 lectura por documento + 1 escritura por actualización.
 * Ejecutar una vez desde functions/: npm run backfill:ejercicios-ia-rand
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { getStudentDatabase } from '../utils/firestoreHelpers';
import { EJERCICIOS_IA_SHARD_MAX } from '../services/ejerciciosIA.service';

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

const BATCH_SIZE = 400;

async function main(): Promise<void> {
  console.log('══ Backfill shard en EjerciciosIA/*/.../ejercicios ══\n');
  initAdminOnce();
  const db = getStudentDatabase();

  console.log(
    `Leyendo collectionGroup("ejercicios")... (1 lectura/doc). Shards: 0..${EJERCICIOS_IA_SHARD_MAX - 1}\n`
  );
  const snap = await db.collectionGroup('ejercicios').get();
  console.log(`Total documentos en el group: ${snap.size}`);

  const toUpdate = snap.docs.filter((d) => {
    const s = d.get('shard');
    return typeof s !== 'number' || !Number.isInteger(s);
  });
  console.log(`Sin shard entero (a actualizar): ${toUpdate.length}\n`);

  if (toUpdate.length === 0) {
    console.log('Nada que hacer.');
    return;
  }

  let batch = db.batch();
  let n = 0;
  let batches = 0;
  for (const doc of toUpdate) {
    batch.update(doc.ref, {
      shard: Math.floor(Math.random() * EJERCICIOS_IA_SHARD_MAX),
    });
    n++;
    if (n >= BATCH_SIZE) {
      await batch.commit();
      batches++;
      console.log(`Commit lote ${batches} (${BATCH_SIZE} escrituras)`);
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) {
    await batch.commit();
    batches++;
    console.log(`Commit lote final (${n} escrituras)`);
  }

  console.log(
    `\n✅ Listo. Despliega fieldOverrides para collectionGroup ejercicios + shard si aún no está.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
