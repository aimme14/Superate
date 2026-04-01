/**
 * Recalcula y escribe institutionSummary (una o varias instituciones/años).
 *
 * Uso:
 *   npm run rebuild-institution-summary --prefix functions
 *   npm run rebuild-institution-summary --prefix functions -- --institutionId=<id>
 *   npm run rebuild-institution-summary --prefix functions -- --institutionId=<id> --academicYear=2026
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

interface CliOptions {
  institutionId?: string;
  academicYear?: string;
}

function ensureFirebaseAdmin(): void {
  if (admin.apps.length > 0) return;

  const keyPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as {
      project_id?: string;
    };
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log('✅ Firebase Admin: serviceAccountKey.json');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  console.log('✅ Firebase Admin: application default credentials');
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();

  const { rebuildInstitutionSummary } = await import('../services/institutionSummary.service');
  const firestore = admin.firestore();

  const opts: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    const trimmed = arg.trim();
    if (!trimmed.startsWith('--')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!value) continue;
    const key = rawKey.replace(/^--/, '');
    if (key === 'institutionId') opts.institutionId = value;
    if (key === 'academicYear') opts.academicYear = value;
  }

  console.log('[rebuildInstitutionSummary] Buscando combinaciones institutionId + academicYear...');
  const gradeSnap = await firestore.collectionGroup('gradeSummary').get();
  const contexts = new Map<string, { institutionId: string; academicYear: string | number }>();
  for (const doc of gradeSnap.docs) {
    const data = doc.data();
    const institutionId = typeof data.institutionId === 'string' ? data.institutionId.trim() : '';
    const academicYear = data.academicYear as string | number | undefined;
    const hasYear =
      typeof academicYear === 'number' ||
      (typeof academicYear === 'string' && academicYear.trim().length > 0);
    if (!institutionId || !hasYear) continue;
    if (opts.institutionId && institutionId !== opts.institutionId) continue;
    if (opts.academicYear && String(academicYear) !== opts.academicYear) continue;
    const key = `${institutionId}|${String(academicYear)}`;
    contexts.set(key, { institutionId, academicYear });
  }

  const list = Array.from(contexts.values());
  console.log(`[rebuildInstitutionSummary] Contextos a procesar: ${list.length}`);
  if (list.length === 0) {
    console.log('No se encontraron gradeSummary con los filtros indicados.');
    return;
  }

  let okCount = 0;
  let failCount = 0;
  for (const context of list) {
    try {
      const ok = await rebuildInstitutionSummary(context, firestore);
      if (ok) okCount += 1;
      else failCount += 1;
    } catch (e) {
      failCount += 1;
      console.error('[rebuildInstitutionSummary] Error', context, e);
    }
  }

  console.log(`[rebuildInstitutionSummary] Finalizado. total=${list.length}, ok=${okCount}, fail=${failCount}`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
