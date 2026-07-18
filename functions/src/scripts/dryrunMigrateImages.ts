/**
 * DRY-RUN de migración de imágenes de preguntas a Storage — READ ONLY. NO escribe nada.
 *
 * Uso:
 *   npm run dryrun-images                 → grado 1, materia IN (Inglés, liviana, buena para pilotar)
 *   npm run dryrun-images -- 1 MA         → grado 1, materia MA
 *
 * Simula qué haría la migración en esa materia: cuántas imágenes base64 movería,
 * cuánto subiría a Storage, y cuánto pesarían los docs DESPUÉS (base64 → URL).
 * No sube ni reescribe nada — solo mide para dimensionar el piloto.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'superate-6c730' });
}
const db = admin.firestore();

function isBase64(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  if (v.startsWith('data:image')) return true;
  return v.length > 5000 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 300));
}
function bytes(v: unknown): number {
  return Buffer.byteLength(String(v ?? ''), 'utf8');
}

async function main(): Promise<void> {
  const grade = process.argv[2] || '1';
  const subject = process.argv[3] || 'IN';

  const snap = await db
    .collection('superate').doc('auth').collection('questions')
    .where('grade', '==', grade)
    .where('subjectCode', '==', subject)
    .get();

  let docsWithImg = 0;
  let totalImgs = 0;
  let base64Bytes = 0;
  let docsBefore = 0;
  let estAfter = 0;
  const URL_EST_BYTES = 120; // una URL de Storage pesa ~120 bytes

  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    let docImgs = 0;
    let docB64 = 0;

    for (const field of ['informativeImages', 'questionImages']) {
      const arr = d[field];
      if (Array.isArray(arr)) {
        arr.forEach((v) => {
          if (isBase64(v)) { docImgs++; docB64 += bytes(v); }
        });
      }
    }
    if (Array.isArray(d.options)) {
      (d.options as Array<Record<string, unknown>>).forEach((o) => {
        if (o && isBase64(o.imageUrl)) { docImgs++; docB64 += bytes(o.imageUrl); }
      });
    }

    if (docImgs > 0) docsWithImg++;
    totalImgs += docImgs;
    base64Bytes += docB64;

    const full = Buffer.byteLength(JSON.stringify(d), 'utf8');
    docsBefore += full;
    estAfter += full - docB64 + docImgs * URL_EST_BYTES;
  });

  console.log(`=== DRY-RUN migración de imágenes — grado ${grade}, materia ${subject} (READ ONLY) ===`);
  console.log('Preguntas en la materia :', snap.size);
  console.log('Preguntas con imágenes  :', docsWithImg);
  console.log('Imágenes base64 a mover :', totalImgs);
  console.log('A subir a Storage       :', (base64Bytes / 1024 / 1024).toFixed(2), 'MB');
  console.log('Peso docs ANTES         :', (docsBefore / 1024 / 1024).toFixed(2), 'MB');
  console.log('Peso docs DESPUÉS (est.):', (estAfter / 1024).toFixed(0), 'KB  → ', (estAfter / snap.size / 1024).toFixed(1), 'KB/pregunta');
  console.log('\n⚠️ NO se escribió ni subió nada. Esto es solo simulación para dimensionar el piloto.');
  process.exit(0);
}

main().catch((e) => {
  console.error('dryrun-images error:', e);
  process.exit(1);
});
