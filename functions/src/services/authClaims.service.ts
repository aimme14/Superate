/**
 * Sincroniza custom claims de Firebase Auth con Firestore (users, userLookup, institución, rol).
 * Las reglas usan request.auth.token.* cuando claimsRev está presente; si no, fallback legacy.
 * campusId / gradeId / jornada vienen del doc de rol (profesores, estudiantes, etc.) para evitar lecturas extra.
 */

import { auth, db } from '../config/firebase.config';

const ROLE_TO_COLLECTION: Record<string, string> = {
  rector: 'rectores',
  principal: 'coordinadores',
  teacher: 'profesores',
  student: 'estudiantes',
};

/** Versión de esquema de claims en el token (subir si cambian campos obligatorios). */
export const CLAIMS_SCHEMA_REV = 2;

export interface SuperateAuthClaims {
  role: string;
  admin: boolean;
  active: boolean;
  institutionId: string;
  institutionActive: boolean;
  /** Sede; vacío si el rol no aplica o no está definido */
  campusId: string;
  /** Grado; vacío si el rol no aplica o no está definido */
  gradeId: string;
  /** p. ej. mañana | tarde | única; vacío si no aplica */
  jornada: string;
  /** Entero; si está en el token, las reglas pueden usar claims sin lecturas extra */
  claimsRev: number;
}

function scopeFromMemberDoc(data: FirebaseFirestore.DocumentData | undefined): {
  campusId: string;
  gradeId: string;
  jornada: string;
} {
  if (!data) {
    return { campusId: '', gradeId: '', jornada: '' };
  }
  const campusRaw = data.campusId ?? data.campus ?? data.sedeId;
  const campusId =
    typeof campusRaw === 'string' && campusRaw.trim() ? campusRaw.trim() : '';
  const gradeRaw = data.gradeId ?? data.grade;
  const gradeId =
    typeof gradeRaw === 'string' && gradeRaw.trim() ? gradeRaw.trim() : '';
  const jornada =
    typeof data.jornada === 'string' && data.jornada.trim() ? data.jornada.trim() : '';
  return { campusId, gradeId, jornada };
}

async function setDeniedClaims(uid: string): Promise<void> {
  const claims: SuperateAuthClaims = {
    role: 'student',
    admin: false,
    active: false,
    institutionId: '',
    institutionActive: false,
    campusId: '',
    gradeId: '',
    jornada: '',
    claimsRev: CLAIMS_SCHEMA_REV,
  };
  await auth.setCustomUserClaims(uid, claims as unknown as { [key: string]: unknown });
}

/**
 * Calcula claims desde Firestore (misma lógica que sync, sin escribir).
 * - Admin en `superate/auth/users/{uid}` con role admin.
 * - Resto vía userLookup + doc jerárquico + institución.
 * @returns `null` si no hay usuario reconocible en ninguna estructura (beforeSignIn: no bloquear).
 */
export async function computeSuperateClaims(uid: string): Promise<SuperateAuthClaims | null> {
  const usersSnap = await db.doc(`superate/auth/users/${uid}`).get();
  if (usersSnap.exists) {
    const d = usersSnap.data() as { role?: string; isActive?: boolean } | undefined;
    if (d?.role === 'admin') {
      const ok = d.isActive === true;
      return {
        role: 'admin',
        admin: true,
        active: ok,
        institutionId: '',
        institutionActive: true,
        campusId: '',
        gradeId: '',
        jornada: '',
        claimsRev: CLAIMS_SCHEMA_REV,
      };
    }
  }

  const lookupSnap = await db.doc(`superate/auth/userLookup/${uid}`).get();
  if (!lookupSnap.exists) {
    return null;
  }

  const lookup = lookupSnap.data() as { institutionId?: string; role?: string };
  const institutionId = typeof lookup.institutionId === 'string' ? lookup.institutionId.trim() : '';
  const role = typeof lookup.role === 'string' ? lookup.role.trim() : '';
  if (!institutionId || !role) {
    return null;
  }

  const coll = ROLE_TO_COLLECTION[role];
  if (!coll) {
    return null;
  }

  const institutionSnap = await db.doc(`superate/auth/institutions/${institutionId}`).get();
  const institutionActive = institutionSnap.exists && institutionSnap.data()?.isActive === true;

  const roleSnap = await db.doc(
    `superate/auth/institutions/${institutionId}/${coll}/${uid}`
  ).get();
  const memberActive = roleSnap.exists && roleSnap.data()?.isActive === true;

  const active = memberActive === true && institutionActive === true;

  const scope = scopeFromMemberDoc(roleSnap.data());

  return {
    role,
    admin: false,
    active,
    institutionId,
    institutionActive,
    campusId: scope.campusId,
    gradeId: scope.gradeId,
    jornada: scope.jornada,
    claimsRev: CLAIMS_SCHEMA_REV,
  };
}

/**
 * Recalcula y aplica custom claims para un uid a partir de Firestore.
 * Si no hay datos válidos, aplica claims denegados (scripts / triggers).
 */
export async function syncClaimsForUid(uid: string): Promise<void> {
  try {
    const computed = await computeSuperateClaims(uid);
    if (computed === null) {
      await setDeniedClaims(uid);
      return;
    }
    await auth.setCustomUserClaims(uid, computed as unknown as { [key: string]: unknown });
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
