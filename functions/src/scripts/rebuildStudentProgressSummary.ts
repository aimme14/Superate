/**
 * Recalcula y escribe studentSummaries (uno o muchos estudiantes).
 *
 * Uso:
 *   npm run rebuild-student-summary --prefix functions
 *   npm run rebuild-student-summary --prefix functions -- --studentId=<uid>
 *   npm run rebuild-student-summary --prefix functions -- --institutionId=<id>
 *   npm run rebuild-student-summary --prefix functions -- --gradeId=<id> --academicYear=2026
 *
 * Si no se pasa studentId, toma los IDs existentes en collectionGroup(studentSummaries).
 *
 * Credenciales (una de):
 * - Archivo functions/serviceAccountKey.json (recomendado en local)
 * - Variable GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de servicio
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

interface CliOptions {
  studentId?: string;
  institutionId?: string;
  gradeId?: string;
  academicYear?: string;
}

/**
 * Inicializa Admin ANTES de importar firebase.config / servicios que lo cargan.
 */
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

  const { rebuildStudentProgressSummary } = await import(
    '../services/studentProgressSummary.service'
  );
  const firestore = admin.firestore();

  const opts: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    const trimmed = arg.trim();
    if (!trimmed.startsWith('--')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!value) continue;
    const key = rawKey.replace(/^--/, '');
    if (key === 'studentId') opts.studentId = value;
    if (key === 'institutionId') opts.institutionId = value;
    if (key === 'gradeId') opts.gradeId = value;
    if (key === 'academicYear') opts.academicYear = value;
  }

  let studentIds: string[] = [];
  if (opts.studentId) {
    studentIds = [opts.studentId];
  } else {
    console.log('[rebuildStudentProgressSummary] Buscando estudiantes en collectionGroup(studentSummaries)...');
    const summarySnap = await firestore.collectionGroup('studentSummaries').get();
    const ids = new Set<string>();
    for (const doc of summarySnap.docs) {
      const data = doc.data();
      if (opts.institutionId && data.institutionId !== opts.institutionId) continue;
      if (opts.gradeId && data.gradeId !== opts.gradeId) continue;
      if (opts.academicYear && String(data.academicYear) !== opts.academicYear) continue;
      ids.add(doc.id);
    }
    studentIds = Array.from(ids);
  }

  console.log(`[rebuildStudentProgressSummary] Estudiantes a procesar: ${studentIds.length}`);
  if (studentIds.length === 0) {
    console.log('No se encontraron estudiantes con los filtros indicados.');
    return;
  }

  let okCount = 0;
  let failCount = 0;
  for (const studentId of studentIds) {
    try {
      const ok = await rebuildStudentProgressSummary(studentId, firestore);
      if (ok) {
        okCount += 1;
      } else {
        failCount += 1;
      }
    } catch (e) {
      failCount += 1;
      console.error(`[rebuildStudentProgressSummary] Error student=${studentId}`, e);
    }
  }

  console.log(
    `[rebuildStudentProgressSummary] Finalizado. total=${studentIds.length}, ok=${okCount}, fail=${failCount}`
  );
  if (failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
