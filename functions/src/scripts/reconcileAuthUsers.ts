/**
 * Reconciliación de userLookup con la estructura jerárquica Firestore.
 *
 * Fase 1 (siempre, solo Firestore): por cada doc en institutions/{id}/{rol}/{uid},
 * asegura superate/auth/userLookup/{uid} con institutionId + role.
 *
 * Fase 2 (opcional, Firebase Auth): lista usuarios Auth y reporta huérfanos/ambiguos.
 * Requiere permisos en Identity Toolkit; si falla, se omite sin error fatal.
 *
 * Uso (desde functions):
 *   npm run build && node lib/scripts/reconcileAuthUsers.js
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

type Role = 'rector' | 'principal' | 'teacher' | 'student';
type RoleCollection = 'rectores' | 'coordinadores' | 'profesores' | 'estudiantes';

type FoundRoleDoc = {
  institutionId: string;
  role: Role;
  collection: RoleCollection;
};

const ROLE_MAP: Array<{ collection: RoleCollection; role: Role }> = [
  { collection: 'rectores', role: 'rector' },
  { collection: 'coordinadores', role: 'principal' },
  { collection: 'profesores', role: 'teacher' },
  { collection: 'estudiantes', role: 'student' },
];

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

async function findHierarchicalDocs(uid: string, db: admin.firestore.Firestore): Promise<FoundRoleDoc[]> {
  const institutionsSnap = await db
    .collection('superate')
    .doc('auth')
    .collection('institutions')
    .get();

  const found: FoundRoleDoc[] = [];
  for (const institution of institutionsSnap.docs) {
    const institutionId = institution.id;
    for (const roleEntry of ROLE_MAP) {
      const ref = db
        .collection('superate')
        .doc('auth')
        .collection('institutions')
        .doc(institutionId)
        .collection(roleEntry.collection)
        .doc(uid);
      const snap = await ref.get();
      if (snap.exists) {
        found.push({
          institutionId,
          role: roleEntry.role,
          collection: roleEntry.collection,
        });
      }
    }
  }
  return found;
}

/**
 * Fase 1: recorre todos los docs jerárquicos y crea userLookup si falta.
 */
async function reconcileLookupsFromFirestore(db: admin.firestore.Firestore): Promise<number> {
  const institutionsSnap = await db
    .collection('superate')
    .doc('auth')
    .collection('institutions')
    .get();

  let created = 0;
  for (const institution of institutionsSnap.docs) {
    const institutionId = institution.id;
    for (const roleEntry of ROLE_MAP) {
      const colRef = db
        .collection('superate')
        .doc('auth')
        .collection('institutions')
        .doc(institutionId)
        .collection(roleEntry.collection);
      const snap = await colRef.get();
      for (const d of snap.docs) {
        const uid = d.id;
        const lookupRef = db.doc(`superate/auth/userLookup/${uid}`);
        const lookupSnap = await lookupRef.get();
        if (!lookupSnap.exists) {
          await lookupRef.set(
            {
              institutionId,
              role: roleEntry.role,
              updatedAt: new Date().toISOString(),
              updatedBy: 'reconcile-auth-users-script-firestore',
            },
            { merge: true }
          );
          created++;
          console.log(`🛠️ userLookup creado: ${uid} -> ${roleEntry.role} (${institutionId})`);
        }
      }
    }
  }
  return created;
}

async function main(): Promise<void> {
  ensureFirebaseAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  console.log('\n--- Fase 1: userLookup desde docs jerárquicos (solo Firestore) ---\n');
  const createdFromHierarchy = await reconcileLookupsFromFirestore(db);
  console.log(`\n✅ Lookups creados en fase 1: ${createdFromHierarchy}\n`);

  let totalAuthUsers = 0;
  let alreadyHealthy = 0;
  let createdLookup = 0;
  let admins = 0;
  let orphanUsers = 0;
  let ambiguousUsers = 0;

  const orphanReport: Array<{ uid: string; email: string | null }> = [];
  const ambiguousReport: Array<{ uid: string; email: string | null; matches: FoundRoleDoc[] }> = [];

  console.log('--- Fase 2: análisis vía Firebase Auth (opcional) ---\n');

  try {
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;

      for (const user of page.users) {
        totalAuthUsers++;
        const uid = user.uid;

        const adminSnap = await db.doc(`superate/auth/users/${uid}`).get();
        if (adminSnap.exists && adminSnap.data()?.role === 'admin') {
          admins++;
          alreadyHealthy++;
          continue;
        }

        const lookupRef = db.doc(`superate/auth/userLookup/${uid}`);
        const lookupSnap = await lookupRef.get();
        if (lookupSnap.exists) {
          const data = lookupSnap.data() as { institutionId?: string; role?: Role };
          if (data?.institutionId && data?.role) {
            let collectionName: RoleCollection = 'estudiantes';
            if (data.role === 'rector') collectionName = 'rectores';
            else if (data.role === 'principal') collectionName = 'coordinadores';
            else if (data.role === 'teacher') collectionName = 'profesores';

            const roleDoc = await db
              .doc(`superate/auth/institutions/${data.institutionId}/${collectionName}/${uid}`)
              .get();
            if (roleDoc.exists) {
              alreadyHealthy++;
              continue;
            }
          }
        }

        const found = await findHierarchicalDocs(uid, db);
        if (found.length === 1) {
          const doc = found[0];
          await lookupRef.set(
            {
              institutionId: doc.institutionId,
              role: doc.role,
              updatedAt: new Date().toISOString(),
              updatedBy: 'reconcile-auth-users-script',
            },
            { merge: true }
          );
          createdLookup++;
          console.log(`🛠️ userLookup creado (Auth pass): ${uid} -> ${doc.role} (${doc.institutionId})`);
          continue;
        }

        if (found.length > 1) {
          ambiguousUsers++;
          ambiguousReport.push({
            uid,
            email: user.email ?? null,
            matches: found,
          });
          console.warn(`⚠️ Ambiguo (${uid}): múltiples docs jerárquicos`);
          continue;
        }

        orphanUsers++;
        orphanReport.push({ uid, email: user.email ?? null });
        console.warn(`❌ Huérfano (${uid}) email=${user.email ?? 'sin email'}`);
      }
    } while (pageToken);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      '⚠️ Fase 2 omitida (Auth API): revisa IAM Service Usage Consumer o espera propagación.\n',
      msg
    );
  }

  const reportDir = path.resolve(__dirname, '../../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `reconcile-auth-users-${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        summary: {
          lookupsCreatedPhase1: createdFromHierarchy,
          totalAuthUsers,
          alreadyHealthy,
          admins,
          createdLookupPhase2: createdLookup,
          orphanUsers,
          ambiguousUsers,
        },
        orphanReport,
        ambiguousReport,
      },
      null,
      2
    )
  );

  console.log('\n===== RESUMEN =====');
  console.log(`Lookups creados (fase 1): ${createdFromHierarchy}`);
  if (totalAuthUsers > 0) {
    console.log(`Auth users:        ${totalAuthUsers}`);
    console.log(`Ya saludables:     ${alreadyHealthy}`);
    console.log(`Admins:            ${admins}`);
    console.log(`Lookups creados (fase 2): ${createdLookup}`);
    console.log(`Huérfanos:         ${orphanUsers}`);
    console.log(`Ambiguos:          ${ambiguousUsers}`);
  } else {
    console.log('(Fase 2 no ejecutada o sin datos de Auth)');
  }
  console.log(`📄 Reporte: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
