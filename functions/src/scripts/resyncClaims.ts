/**
 * Re-sincroniza custom claims directamente (sin cola Firestore).
 * Útil cuando las credenciales locales no pueden escribir _syncClaimsQueue.
 *
 * Uso:
 *   npm run resync-claims -- <uid> [uid2 ...]
 *   npm run resync-claims -- --zamira
 *
 * Requiere credenciales con Firebase Auth Admin + lectura Firestore (GOOGLE_APPLICATION_CREDENTIALS).
 */
import { auth, db } from '../config/firebase.config';
import { syncClaimsForUid } from '../services/authClaims.service';

interface Claims {
  claimsRev?: number;
  active?: boolean;
  [k: string]: unknown;
}

function classify(claims: Claims | undefined): 'OK' | 'INACTIVO' | 'VACIO' {
  if (!claims || Object.keys(claims).length === 0 || claims.claimsRev == null) {
    return 'VACIO';
  }
  return claims.active === true ? 'OK' : 'INACTIVO';
}

async function findZamiraUids(): Promise<string[]> {
  const lookupSnap = await db.collection('superate').doc('auth').collection('userLookup').get();
  const healthy = new Set<string>();
  lookupSnap.forEach((d) => {
    const data = d.data() as { institutionId?: string; role?: string };
    if (data.institutionId && data.role) {
      healthy.add(d.id);
    }
  });

  const zamira: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      const claims = (u.customClaims || {}) as Claims;
      if (classify(claims) === 'VACIO' && healthy.has(u.uid)) {
        zamira.push(u.uid);
      }
    }
    pageToken = res.pageToken;
  } while (pageToken);

  return zamira;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let uids: string[];

  if (args.length === 0) {
    console.error('Uso: npm run resync-claims -- <uid> [uid2 ...]');
    console.error('     npm run resync-claims -- --zamira');
    process.exit(1);
  }

  if (args[0] === '--zamira') {
    uids = await findZamiraUids();
    console.log(`Casos Zamira detectados: ${uids.length}`);
    if (uids.length === 0) {
      console.log('Nada que sincronizar.');
      process.exit(0);
    }
  } else {
    uids = args;
  }

  for (const uid of uids) {
    const id = uid.trim();
    if (!id) continue;
    console.log('Sincronizando:', id);
    await syncClaimsForUid(id);
    const user = await auth.getUser(id);
    console.log('  → claims:', JSON.stringify(user.customClaims ?? {}));
  }

  console.log(`Listo. ${uids.length} uid(s) procesados.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('resync-claims error:', e);
  process.exit(1);
});
