/**
 * Recalcula y escribe studentSummaries para un estudiante (backfill / prueba).
 *
 * Uso:
 *   npm run rebuild-student-summary --prefix functions
 *   npm run rebuild-student-summary --prefix functions -- <studentUid>
 *
 * Credenciales (una de):
 * - Archivo functions/serviceAccountKey.json (recomendado en local)
 * - Variable GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de servicio
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_STUDENT_ID = 'Rt25sft2Q4MNtYIko9GlurGO64J3';

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

  const studentId = process.argv[2]?.trim() || DEFAULT_STUDENT_ID;
  console.log(`[rebuildStudentProgressSummary] UID: ${studentId}`);

  const firestore = admin.firestore();
  const ok = await rebuildStudentProgressSummary(studentId, firestore);
  if (!ok) {
    console.error(
      'Fallo: sin institución para el estudiante o error. Revisa userLookup / estudiantes.'
    );
    process.exit(1);
  }
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
