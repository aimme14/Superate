/**
 * Sincroniza custom claims de Firebase Auth con Firestore (users, userLookup, institución, rol).
 * Las reglas usan request.auth.token.* cuando claimsRev está presente; si no, fallback legacy.
 */

import { auth, db } from '../config/firebase.config';

const ROLE_TO_COLLECTION: Record<string, string> = {
  rector: 'rectores',
  principal: 'coordinadores',
  teacher: 'profesores',
  student: 'estudiantes',
};

export interface SuperateAuthClaims {
  role: string;
  admin: boolean;
  active: boolean;
  institutionId: string;
  institutionActive: boolean;
  /** Entero; si está en el token, las reglas pueden usar claims sin lecturas extra */
  claimsRev: number;
}

async function setDeniedClaims(uid: string): Promise<void> {
  const claims: SuperateAuthClaims = {
    role: 'student',
    admin: false,
    active: false,
    institutionId: '',
    institutionActive: false,
    claimsRev: Date.now(),
  };
  await auth.setCustomUserClaims(uid, claims as unknown as { [key: string]: unknown });
}

/**
 * Recalcula y aplica custom claims para un uid a partir de Firestore.
 */
export async function syncClaimsForUid(uid: string): Promise<void> {
  try {
    const usersSnap = await db.doc(`superate/auth/users/${uid}`).get();
    if (usersSnap.exists) {
      const d = usersSnap.data() as { role?: string; isActive?: boolean } | undefined;
      if (d?.role === 'admin') {
        const ok = d.isActive === true;
        const claims: SuperateAuthClaims = {
          role: 'admin',
          admin: true,
          active: ok,
          institutionId: '',
          institutionActive: true,
          claimsRev: Date.now(),
        };
        await auth.setCustomUserClaims(uid, claims as unknown as { [key: string]: unknown });
        return;
      }
    }

    const lookupSnap = await db.doc(`superate/auth/userLookup/${uid}`).get();
    if (!lookupSnap.exists) {
      await setDeniedClaims(uid);
      return;
    }

    const lookup = lookupSnap.data() as { institutionId?: string; role?: string };
    const institutionId = typeof lookup.institutionId === 'string' ? lookup.institutionId.trim() : '';
    const role = typeof lookup.role === 'string' ? lookup.role.trim() : '';
    if (!institutionId || !role) {
      await setDeniedClaims(uid);
      return;
    }

    const coll = ROLE_TO_COLLECTION[role];
    if (!coll) {
      await setDeniedClaims(uid);
      return;
    }

    const institutionSnap = await db.doc(`superate/auth/institutions/${institutionId}`).get();
    const institutionActive = institutionSnap.exists && institutionSnap.data()?.isActive === true;

    const roleSnap = await db.doc(
      `superate/auth/institutions/${institutionId}/${coll}/${uid}`
    ).get();
    const memberActive = roleSnap.exists && roleSnap.data()?.isActive === true;

    const active = memberActive === true && institutionActive === true;

    const claims: SuperateAuthClaims = {
      role,
      admin: false,
      active,
      institutionId,
      institutionActive,
      claimsRev: Date.now(),
    };
    await auth.setCustomUserClaims(uid, claims as unknown as { [key: string]: unknown });
  } catch (e) {
    console.error('[syncClaimsForUid]', uid, e);
    throw e;
  }
}

/**
 * Actualiza claims de todos los usuarios cuyo userLookup apunta a esta institución.
 * Usar cuando cambia isActive de la institución o tras borrado.
 */
export async function syncClaimsForInstitutionMembers(institutionId: string): Promise<void> {
  const snap = await db
    .collection('superate')
    .doc('auth')
    .collection('userLookup')
    .where('institutionId', '==', institutionId)
    .get();

  const uids = snap.docs.map((d) => d.id);
  const chunk = 25;
  for (let i = 0; i < uids.length; i += chunk) {
    const part = uids.slice(i, i + chunk);
    await Promise.all(part.map((uid) => syncClaimsForUid(uid)));
  }
}
