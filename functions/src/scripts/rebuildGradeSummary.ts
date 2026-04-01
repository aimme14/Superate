/**
 * Recalcula y escribe gradeSummary para combinaciones existentes de:
 * institutionId + gradeId + academicYear.
 *
 * Uso:
 *   npm run rebuild-grade-summary --prefix functions
 *   npm run rebuild-grade-summary --prefix functions -- --institutionId=<id>
 *   npm run rebuild-grade-summary --prefix functions -- --academicYear=2026
 *   npm run rebuild-grade-summary --prefix functions -- --gradeId=<id>
 *
 * Credenciales (una de):
 * - Archivo functions/serviceAccountKey.json (recomendado en local)
 * - Variable GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de servicio
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

interface CliOptions {
  institutionId?: string;
  gradeId?: string;
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

function parseCli(): CliOptions {
  const opts: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    const trimmed = arg.trim();
    if (!trimmed.startsWith('--')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!value) continue;
    const key = rawKey.replace(/^--/, '');
    if (key === 'institutionId') opts.institutionId = value;
    if (key === 'gradeId') opts.gradeId = value;
    if (key === 'academicYear') opts.academicYear = value;
  }
  return opts;
}

function parseInstitutionIdFromPath(pathStr: string): string | null {
  const seg = pathStr.split('/');
  // superate/auth/institutions/{institutionId}/studentSummaries/{studentId}
  const idx = seg.findIndex((s) => s === 'institutions');
  if (idx >= 0 && seg[idx + 1]) return seg[idx + 1];
  return null;
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();
  const options = parseCli();
  const firestore = admin.firestore();

  const { rebuildGradeSummary } = await import('../services/gradeSummary.service');

  console.log('[rebuildGradeSummary] Buscando combinaciones en collectionGroup(studentSummaries)...');
  const snap = await firestore.collectionGroup('studentSummaries').get();

  const keys = new Map<
    string,
    { institutionId: string; gradeId: string; academicYear: number | string }
  >();

  for (const doc of snap.docs) {
    const data = doc.data();
    const institutionId =
      (typeof data.institutionId === 'string' && data.institutionId.trim()) ||
      parseInstitutionIdFromPath(doc.ref.path) ||
      '';
    const gradeId = typeof data.gradeId === 'string' ? data.gradeId.trim() : '';
    const academicYear = data.academicYear as number | string | undefined;

    const hasYear =
      typeof academicYear === 'number' ||
      (typeof academicYear === 'string' && academicYear.trim().length > 0);
    if (!institutionId || !gradeId || !hasYear) continue;

    if (options.institutionId && options.institutionId !== institutionId) continue;
    if (options.gradeId && options.gradeId !== gradeId) continue;
    if (options.academicYear && options.academicYear !== String(academicYear)) continue;

    const key = `${institutionId}|${gradeId}|${String(academicYear)}`;
    if (!keys.has(key)) {
      keys.set(key, { institutionId, gradeId, academicYear: academicYear as number | string });
    }
  }

  const contexts = Array.from(keys.values());
  console.log(`[rebuildGradeSummary] Combinaciones encontradas: ${contexts.length}`);
  if (contexts.length === 0) {
    console.log('No hay combinaciones para recalcular con los filtros actuales.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  for (const ctx of contexts) {
    try {
      await rebuildGradeSummary(ctx, firestore);
      successCount += 1;
      console.log(
        `✅ ${successCount}/${contexts.length} -> inst=${ctx.institutionId}, grade=${ctx.gradeId}, year=${ctx.academicYear}`
      );
    } catch (e) {
      errorCount += 1;
      console.error(
        `❌ Error en inst=${ctx.institutionId}, grade=${ctx.gradeId}, year=${ctx.academicYear}`,
        e
      );
    }
  }

  console.log(
    `[rebuildGradeSummary] Finalizado. total=${contexts.length}, ok=${successCount}, fail=${errorCount}`
  );
  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

