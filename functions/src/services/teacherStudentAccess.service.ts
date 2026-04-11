/**
 * Autorización docente → estudiante: una sola lectura a studentSummaries/{studentId}
 * bajo la institución del token (custom claims).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../config/firebase.config';
import type { StudentProgressSummaryDoc } from '../types/studentProgressSummary.types';
import { normalizeJornada } from './studentProgressSummary.service';

/**
 * Comprueba que el usuario autenticado sea docente activo y que institución, sede,
 * grado y jornada (claims) coincidan con el documento denormalizado del estudiante.
 * `campusId` en el token se compara con `sedeId` en Firestore.
 */
export async function assertTeacherCanAccessStudent(
  auth: CallableRequest['auth'],
  studentId: string
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const token = auth.token as Record<string, unknown>;
  const role = typeof token.role === 'string' ? token.role.trim() : '';
  if (role !== 'teacher') {
    throw new HttpsError(
      'permission-denied',
      'Solo docentes pueden solicitar el resumen académico de un estudiante.'
    );
  }
  if (token.active !== true) {
    throw new HttpsError('permission-denied', 'Cuenta inactiva.');
  }

  const institutionId =
    typeof token.institutionId === 'string' ? token.institutionId.trim() : '';
  const campusId = typeof token.campusId === 'string' ? token.campusId.trim() : '';
  const gradeId = typeof token.gradeId === 'string' ? token.gradeId.trim() : '';
  const jornadaRaw = typeof token.jornada === 'string' ? token.jornada : '';

  if (!institutionId) {
    throw new HttpsError('permission-denied', 'Sin institución en el token.');
  }

  const ref = db.doc(
    `superate/auth/institutions/${institutionId}/studentSummaries/${studentId}`
  );
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError(
      'permission-denied',
      'No se encontró el estudiante en tu institución o aún no hay datos de progreso.'
    );
  }

  const d = snap.data() as Partial<StudentProgressSummaryDoc>;
  if (d.institutionId !== institutionId) {
    throw new HttpsError('permission-denied', 'La institución no coincide.');
  }

  const docSede = typeof d.sedeId === 'string' ? d.sedeId.trim() : '';
  if (docSede !== campusId) {
    throw new HttpsError('permission-denied', 'La sede no coincide.');
  }

  const docGrade = typeof d.gradeId === 'string' ? d.gradeId.trim() : '';
  if (docGrade !== gradeId) {
    throw new HttpsError('permission-denied', 'El grado no coincide.');
  }

  const normDoc = normalizeJornada(d.jornada);
  const normTok = normalizeJornada(jornadaRaw);
  if (normDoc !== normTok) {
    throw new HttpsError('permission-denied', 'La jornada no coincide.');
  }
}
