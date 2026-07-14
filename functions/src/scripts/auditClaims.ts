/**
 * AUDITORÍA DE CUSTOM CLAIMS — READ ONLY. No escribe absolutamente nada.
 *
 * Uso:
 *   npm run audit-claims                 → audita TODOS los usuarios (resumen + casos "vacío con datos sanos")
 *   npm run audit-claims -- <uid>        → detalle de UN usuario (esto es A0; ej. el uid de Zamira)
 *
 * Clasifica cada usuario según sus custom claims persistentes (los de Auth, no el JWT):
 *   - OK       → tiene claimsRev y active:true
 *   - INACTIVO → tiene claimsRev y active:false (denegado / dado de baja)
 *   - VACIO    → sin claimsRev (el blocking lo pisó con {}, o nunca se seteó)
 * Y cruza con userLookup para detectar el "caso Zamira": datos sanos pero claims vacíos.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'superate-6c730' });
}
const auth = admin.auth();
const db = admin.firestore();

interface Claims {
  role?: string;
  active?: boolean;
  institutionId?: string;
  institutionActive?: boolean;
  claimsRev?: number;
  [k: string]: unknown;
}

function classify(claims: Claims | undefined): 'OK' | 'INACTIVO' | 'VACIO' {
  if (!claims || Object.keys(claims).length === 0 || claims.claimsRev == null) {
    return 'VACIO';
  }
  return claims.active === true ? 'OK' : 'INACTIVO';
}

async function loadUserLookups(): Promise<Map<string, { institutionId?: string; role?: string }>> {
  const snap = await db.collection('superate').doc('auth').collection('userLookup').get();
  const map = new Map<string, { institutionId?: string; role?: string }>();
  snap.forEach((d) => {
    const data = d.data() as { institutionId?: string; role?: string };
    map.set(d.id, { institutionId: data.institutionId, role: data.role });
  });
  return map;
}

async function auditOne(uid: string): Promise<void> {
  const user = await auth.getUser(uid);
  const claims = (user.customClaims || {}) as Claims;
  const lookupSnap = await db.doc(`superate/auth/userLookup/${uid}`).get();
  const lookup = lookupSnap.exists ? (lookupSnap.data() as Claims) : null;
  const healthy = !!lookup && !!lookup.institutionId && !!lookup.role;

  console.log('=== A0 · Detalle de usuario (READ ONLY) ===');
  console.log('uid:', uid, '| email:', user.email);
  console.log('customClaims (persistentes en Auth):', JSON.stringify(claims));
  console.log('clasificación:', classify(claims));
  console.log('userLookup:', lookup ? JSON.stringify(lookup) : 'NO EXISTE');
  console.log('datos sanos (lookup con institutionId + role):', healthy);
  if (classify(claims) === 'VACIO' && healthy) {
    console.log('>>> CASO ZAMIRA CONFIRMADO: datos sanos pero claims persistentes vacíos <<<');
  }
}

async function auditAll(): Promise<void> {
  const lookups = await loadUserLookups();
  let total = 0;
  const counts = { OK: 0, INACTIVO: 0, VACIO: 0 };
  const zamiraCases: Array<{ uid: string; email?: string; role?: string; inst?: string }> = [];

  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      total++;
      const claims = (u.customClaims || {}) as Claims;
      const cls = classify(claims);
      counts[cls]++;
      const lk = lookups.get(u.uid);
      const healthy = !!lk && !!lk.institutionId && !!lk.role;
      if (cls === 'VACIO' && healthy) {
        zamiraCases.push({ uid: u.uid, email: u.email, role: lk!.role, inst: lk!.institutionId });
      }
    }
    pageToken = res.pageToken;
  } while (pageToken);

  console.log('=== A4 · Auditoría de claims (READ ONLY) ===');
  console.log('Total usuarios Auth:', total);
  console.log('  OK (claimsRev + active:true) :', counts.OK);
  console.log('  INACTIVO (claimsRev + false) :', counts.INACTIVO);
  console.log('  VACÍO (sin claimsRev)        :', counts.VACIO);
  console.log('');
  console.log('CASOS "ZAMIRA" (VACÍO + datos sanos en userLookup):', zamiraCases.length);
  const byInst: Record<string, number> = {};
  for (const c of zamiraCases) byInst[c.inst || '?'] = (byInst[c.inst || '?'] || 0) + 1;
  console.log('  por institución:', JSON.stringify(byInst));
  console.table(zamiraCases.slice(0, 50));
  if (zamiraCases.length > 50) console.log(`  ...y ${zamiraCases.length - 50} más (recorté a 50)`);
}

async function main(): Promise<void> {
  const uid = process.argv[2];
  if (uid) {
    await auditOne(uid);
  } else {
    await auditAll();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('audit-claims error:', e);
  process.exit(1);
});
