/**
 * INSPECCIÓN DE TAMAÑO DE PREGUNTAS — READ ONLY. No escribe nada.
 *
 * Uso:
 *   npm run inspect-question                 → grado 1, materia FI (la más pesada)
 *   npm run inspect-question -- 1 MA         → grado 1, materia MA
 *
 * Toma unas pocas preguntas de esa materia y muestra el peso CAMPO POR CAMPO,
 * marcando si hay imágenes base64 embebidas (data:image o strings base64 largas),
 * a nivel top-level y dentro de `options[]`. Así confirmamos qué infla el doc.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'superate-6c730' });
}
const db = admin.firestore();

function sizeKB(v: unknown): number {
  return Math.round((Buffer.byteLength(JSON.stringify(v ?? null), 'utf8') / 1024) * 10) / 10;
}

function isBase64Image(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  if (v.startsWith('data:image')) return true;
  // string larga que parece base64 pura
  return v.length > 5000 && /^[A-Za-z0-9+/=\s]+$/.test(v.slice(0, 300));
}

async function main(): Promise<void> {
  const grade = process.argv[2] || '1';
  const subject = process.argv[3] || 'FI';

  const snap = await db
    .collection('superate').doc('auth').collection('questions')
    .where('grade', '==', grade)
    .where('subjectCode', '==', subject)
    .limit(3)
    .get();

  console.log(`=== Inspección de tamaño — grado ${grade}, materia ${subject} (${snap.size} preguntas) ===`);

  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    console.log(`\n📄 ${doc.id} — total ${sizeKB(d)} KB`);

    const fields = Object.entries(d)
      .map(([campo, v]) => ({
        campo,
        KB: sizeKB(v),
        tipo: isBase64Image(v) ? '🖼️ base64 image' : Array.isArray(v) ? 'array' : typeof v,
      }))
      .sort((a, b) => b.KB - a.KB);
    console.table(fields.slice(0, 10));

    // Revisar imágenes embebidas dentro de options[]
    if (Array.isArray(d.options)) {
      (d.options as Array<Record<string, unknown>>).forEach((opt, i) => {
        Object.entries(opt || {}).forEach(([k, v]) => {
          if (isBase64Image(v)) {
            console.log(`   → options[${i}].${k}: 🖼️ base64 embebido (${sizeKB(v)} KB)`);
          }
        });
      });
    }
  });

  process.exit(0);
}

main().catch((e) => {
  console.error('inspect-question error:', e);
  process.exit(1);
});
