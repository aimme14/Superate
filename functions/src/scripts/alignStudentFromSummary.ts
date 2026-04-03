/**
 * Alinea el documento estudiantes/{uid} con los metadatos de studentSummaries/{uid}
 * (jornada, sedeId, gradeId, academicYear) y opcionalmente recalcula el summary.
 *
 * Uso:
 *   npm run align-student-from-summary --prefix functions -- --institutionId=X --studentId=Y
 */

import * as admin from 'firebase-admin';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
    return;
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();
  const firestore = admin.firestore();

  let institutionId = '';
  let studentId = '';
  for (const arg of process.argv.slice(2)) {
    const t = arg.trim();
    if (!t.startsWith('--')) continue;
    const [k, ...rest] = t.split('=');
    const v = rest.join('=').trim();
    const key = k.replace(/^--/, '');
    if (key === 'institutionId') institutionId = v;
    if (key === 'studentId') studentId = v;
  }

  if (!institutionId || !studentId) {
    console.error('Uso: --institutionId=<id> --studentId=<uid>');
    process.exit(1);
  }

  const sumRef = firestore.doc(
    `superate/auth/institutions/${institutionId}/studentSummaries/${studentId}`
  );
  const stRef = firestore.doc(
    `superate/auth/institutions/${institutionId}/estudiantes/${studentId}`
  );

  const sumSnap = await sumRef.get();
  const stSnap = await stRef.get();
  if (!sumSnap.exists) {
    console.error('No existe studentSummaries');
    process.exit(1);
  }
  if (!stSnap.exists) {
    console.error('No existe estudiantes');
    process.exit(1);
  }

  const s = sumSnap.data()!;
  const patch: Record<string, unknown> = {};

  if (s.academicYear !== undefined && s.academicYear !== null) {
    patch.academicYear =
      typeof s.academicYear === 'number' ? s.academicYear : parseInt(String(s.academicYear), 10);
  }
  if (s.gradeId) {
    patch.gradeId = s.gradeId;
    patch.grade = s.gradeId;
  }
  if (s.sedeId) {
    patch.sedeId = s.sedeId;
    patch.campusId = s.sedeId;
    patch.campus = s.sedeId;
  }
  if (s.jornada === 'mañana' || s.jornada === 'tarde') {
    patch.jornada = s.jornada;
  }
  if (s.gradeName && typeof s.gradeName === 'string') {
    patch.gradeName = s.gradeName;
  }

  await stRef.update(patch);
  console.log('✅ estudiantes actualizado:', JSON.stringify(patch));

  // Rebuild en subproceso para no cargar firebase.config del servicio (doble init Firestore).
  const rebuildJs = path.resolve(__dirname, 'rebuildStudentProgressSummary.js');
  try {
    execFileSync(process.execPath, [rebuildJs, `--studentId=${studentId}`], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..'),
      env: process.env,
    });
    console.log('✅ studentSummaries recalculado (subproceso)');
  } catch (e) {
    console.error('⚠️ Falló rebuild en subproceso; ejecuta manualmente: npm run rebuild-student-summary --prefix functions -- --studentId=' + studentId);
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
