/**
 * Encola sincronización de custom claims para deduplicar trabajo cuando
 * varios documentos relacionados con el mismo uid cambian seguido.
 */
import * as admin from 'firebase-admin';
import { db } from '../config/firebase.config';

const QUEUE_DOC = (uid: string) =>
  `superate/auth/_syncClaimsQueue/${uid}`;

export async function scheduleClaimsSync(uid: string): Promise<void> {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) {
    return;
  }
  await db.doc(QUEUE_DOC(id)).set(
    {
      enqueuedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
