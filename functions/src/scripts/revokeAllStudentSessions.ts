/**
 * Revoca las sesiones (refresh tokens) de todos los estudiantes en Firebase Auth.
 *
 * Efecto: revoca refresh tokens y sube el claim `sessionRev` para que el cliente
 * cierre la sesión en segundos (hook useStudentSessionGuard).
 *
 * Uso:
 *   npm run revoke-student-sessions --prefix functions -- --dryRun
 *   npm run revoke-student-sessions --prefix functions -- --confirm
 *   npm run revoke-student-sessions --prefix functions -- --institutionId=<id> --confirm
 *   npm run revoke-student-sessions --prefix functions -- --studentId=<uid> --confirm
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
  dryRun?: boolean;
  confirm?: boolean;
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserNotFoundError(error: unknown): boolean {
  return (error as { code?: string })?.code === 'auth/user-not-found';
}

function isQuotaError(error: unknown): boolean {
  return (error as { code?: string })?.code === 'auth/quota-exceeded';
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

function parseCliArgs(): CliOptions {
  const opts: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    const trimmed = arg.trim();
    if (trimmed === '--dryRun') {
      opts.dryRun = true;
      continue;
    }
    if (trimmed === '--confirm') {
      opts.confirm = true;
      continue;
    }
    if (!trimmed.startsWith('--')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!value) continue;
    const key = rawKey.replace(/^--/, '');
    if (key === 'studentId') opts.studentId = value;
    if (key === 'institutionId') opts.institutionId = value;
  }
  return opts;
}

async function listStudentUids(
  firestore: admin.firestore.Firestore,
  opts: CliOptions
): Promise<string[]> {
  if (opts.studentId) {
    return [opts.studentId];
  }

  let query: admin.firestore.Query = firestore
    .collection('superate')
    .doc('auth')
    .collection('userLookup')
    .where('role', '==', 'student');

  if (opts.institutionId) {
    query = query.where('institutionId', '==', opts.institutionId);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => doc.id);
}

async function revokeOneStudentSession(
  auth: admin.auth.Auth,
  uid: string
): Promise<void> {
  await auth.revokeRefreshTokens(uid);
  const userRecord = await auth.getUser(uid);
  const existing = (userRecord.customClaims ?? {}) as Record<string, unknown>;
  await auth.setCustomUserClaims(uid, {
    ...existing,
    sessionRev: Date.now(),
  });
}

async function revokeWithRetry(
  auth: admin.auth.Auth,
  uid: string,
  maxAttempts = 4
): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await revokeOneStudentSession(auth, uid);
      return;
    } catch (error) {
      if (isUserNotFoundError(error)) {
        throw error;
      }
      if (!isQuotaError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      const waitMs = 1000 * (attempt + 1);
      console.warn(`⏳ Cuota Auth, reintento ${attempt + 2}/${maxAttempts} para ${uid} en ${waitMs}ms`);
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

async function revokeStudentSessions(
  auth: admin.auth.Auth,
  studentIds: string[],
  dryRun: boolean
): Promise<{ ok: number; fail: number; skipped: number }> {
  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    const batch = studentIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (uid) => {
        if (dryRun) {
          console.log(`[dryRun] Revocaría sesión: ${uid}`);
          return;
        }
        await revokeWithRetry(auth, uid);
        console.log(`✅ Sesión revocada: ${uid}`);
      })
    );

    for (let j = 0; j < results.length; j += 1) {
      const result = results[j];
      const uid = batch[j];
      if (result.status === 'fulfilled') {
        ok += 1;
      } else if (isUserNotFoundError(result.reason)) {
        skipped += 1;
        console.warn(`⚠️  Sin cuenta Auth (userLookup huérfano): ${uid}`);
      } else {
        fail += 1;
        console.error(`❌ Error revocando ${uid}:`, result.reason);
      }
    }

    if (!dryRun && i + BATCH_SIZE < studentIds.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { ok, fail, skipped };
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();

  const opts = parseCliArgs();
  const firestore = admin.firestore();
  const auth = admin.auth();

  if (!opts.dryRun && !opts.confirm) {
    console.error(
      '⚠️  Operación destructiva: agrega --confirm para ejecutar o --dryRun para simular.'
    );
    console.error('');
    console.error('Ejemplos:');
    console.error('  npm run revoke-student-sessions --prefix functions -- --dryRun');
    console.error(
      '  npm run revoke-student-sessions --prefix functions -- --confirm'
    );
    process.exitCode = 1;
    return;
  }

  console.log('[revokeAllStudentSessions] Buscando estudiantes en userLookup...');
  const studentIds = await listStudentUids(firestore, opts);

  console.log(`[revokeAllStudentSessions] Estudiantes encontrados: ${studentIds.length}`);
  if (opts.institutionId) {
    console.log(`   Filtro institución: ${opts.institutionId}`);
  }
  if (opts.dryRun) {
    console.log('   Modo: dryRun (no se revocará ninguna sesión)');
  }

  if (studentIds.length === 0) {
    console.log('No se encontraron estudiantes con los filtros indicados.');
    return;
  }

  const { ok, fail, skipped } = await revokeStudentSessions(
    auth,
    studentIds,
    Boolean(opts.dryRun)
  );

  console.log(
    `[revokeAllStudentSessions] Finalizado. total=${studentIds.length}, ok=${ok}, skipped=${skipped}, fail=${fail}`
  );
  if (!opts.dryRun) {
    console.log(
      'ℹ️  Los estudiantes con la app abierta serán desconectados en ~20 s (o al volver a la pestaña).'
    );
  }
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
