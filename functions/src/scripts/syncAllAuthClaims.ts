/**
 * Backfill: aplica custom claims a todos los userLookup y users (admin).
 *
 * Uso (desde carpeta functions, tras build):
 *   npm run build && node lib/scripts/syncAllAuthClaims.js
 *
 * Credenciales: GOOGLE_APPLICATION_CREDENTIALS o serviceAccountKey.json en functions/
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
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();
  const { syncClaimsForUid } = await import('../services/authClaims.service');
  const db = admin.firestore();

  const lookupSnap = await db
    .collection('superate')
    .doc('auth')
    .collection('userLookup')
    .get();
  console.log(`userLookup: ${lookupSnap.size} documentos`);
  for (const d of lookupSnap.docs) {
    await syncClaimsForUid(d.id);
    console.log('  OK', d.id);
  }

  const usersSnap = await db.collection('superate').doc('auth').collection('users').get();
  console.log(`users (admin): ${usersSnap.size} documentos`);
  for (const d of usersSnap.docs) {
    await syncClaimsForUid(d.id);
    console.log('  OK', d.id);
  }

  console.log('✅ syncAllAuthClaims terminado');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
