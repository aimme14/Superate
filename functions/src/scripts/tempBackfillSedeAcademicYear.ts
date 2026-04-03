/**
 * Migración temporal: asegura sedeId (y academicYear si falta) en estudiantes y profesores.
 * Opcional: reconstruye studentSummaries para propagar campos al resumen.
 *
 * Uso:
 *   npm run temp-backfill-sede --prefix functions
 *   npm run temp-backfill-sede --prefix functions -- --institutionId=<id>
 *   npm run temp-backfill-sede --prefix functions -- --rebuildSummaries=1
 *
 * Credenciales: functions/serviceAccountKey.json o GOOGLE_APPLICATION_CREDENTIALS
 */

import * as admin from 'firebase-admin';
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
    console.log('✅ Firebase Admin: serviceAccountKey.json');
    return;
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  console.log('✅ Firebase Admin: application default credentials');
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();
  const firestore = admin.firestore();

  let onlyInstitutionId: string | undefined;
  let rebuildSummaries = false;
  for (const arg of process.argv.slice(2)) {
    const trimmed = arg.trim();
    if (!trimmed.startsWith('--')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!value) continue;
    const key = rawKey.replace(/^--/, '');
    if (key === 'institutionId') onlyInstitutionId = value;
    if (key === 'rebuildSummaries' && (value === '1' || value === 'true')) rebuildSummaries = true;
  }

  const defaultYear = new Date().getFullYear();
  const instRef = firestore.collection('superate').doc('auth').collection('institutions');
  const institutionDocs: admin.firestore.QueryDocumentSnapshot[] = [];
  if (onlyInstitutionId) {
    const one = await instRef.doc(onlyInstitutionId).get();
    if (one.exists) {
      institutionDocs.push(one as admin.firestore.QueryDocumentSnapshot);
    }
  } else {
    const snap = await instRef.get();
    institutionDocs.push(...snap.docs);
  }

  let updatedStudents = 0;
  let updatedTeachers = 0;
  const studentIdsToRebuild: string[] = [];

  for (const instDoc of institutionDocs) {
    const estudiantesRef = instDoc.ref.collection('estudiantes');
    const estSnap = await estudiantesRef.get();
    let batch = firestore.batch();
    let ops = 0;

    for (const d of estSnap.docs) {
      const data = d.data();
      const patch: Record<string, unknown> = {};
      const campus = data.campusId || data.campus;
      if (typeof campus === 'string' && campus.trim() && !data.sedeId) {
        patch.sedeId = campus.trim();
      }
      if (data.academicYear === undefined || data.academicYear === null || data.academicYear === '') {
        patch.academicYear = defaultYear;
      }
      if (Object.keys(patch).length > 0) {
        batch.update(d.ref, patch);
        ops++;
        updatedStudents++;
        studentIdsToRebuild.push(d.id);
        if (ops >= 450) {
          await batch.commit();
          batch = firestore.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) await batch.commit();

    const profesRef = instDoc.ref.collection('profesores');
    const profSnap = await profesRef.get();
    batch = firestore.batch();
    ops = 0;
    for (const d of profSnap.docs) {
      const data = d.data();
      const campus = data.campusId || data.campus;
      const patch: Record<string, unknown> = {};
      if (typeof campus === 'string' && campus.trim() && !data.sedeId) {
        patch.sedeId = campus.trim();
      }
      if (Object.keys(patch).length > 0) {
        batch.update(d.ref, patch);
        ops++;
        updatedTeachers++;
        if (ops >= 450) {
          await batch.commit();
          batch = firestore.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) await batch.commit();
  }

  console.log(
    `[tempBackfillSedeAcademicYear] Estudiantes actualizados: ${updatedStudents}, profesores: ${updatedTeachers}, instituciones: ${institutionDocs.length}`
  );

  if (rebuildSummaries && studentIdsToRebuild.length > 0) {
    const { rebuildStudentProgressSummary } = await import('../services/studentProgressSummary.service');
    let ok = 0;
    let fail = 0;
    for (const sid of studentIdsToRebuild) {
      try {
        const r = await rebuildStudentProgressSummary(sid, firestore);
        if (r) ok++;
        else fail++;
      } catch (e) {
        fail++;
        console.error(`[rebuild] ${sid}`, e);
      }
    }
    console.log(`[tempBackfillSedeAcademicYear] Rebuild summaries: ok=${ok}, fail=${fail}`);
  } else if (rebuildSummaries) {
    console.log('[tempBackfillSedeAcademicYear] rebuildSummaries=1 pero no hubo estudiantes a actualizar.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
