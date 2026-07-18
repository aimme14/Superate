/**
 * MEDICIÓN DEL BANCO DE PREGUNTAS — READ ONLY. No escribe nada.
 *
 * Uso:
 *   npm run measure-questions
 *
 * Agrupa las preguntas por (grado, materia), cuenta y estima el peso del pool
 * (JSON.stringify) para verificar si cada pool entra en el límite de 1 MiB de Firestore.
 * Marca en rojo cualquier grupo que supere el margen seguro (~800 KB).
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'superate-6c730' });
}
const db = admin.firestore();

const SAFE_LIMIT_BYTES = 800 * 1024; // 800 KB (margen bajo el 1 MiB de Firestore)

interface Group {
  count: number;
  bytes: number;
}

async function main(): Promise<void> {
  const snap = await db.collection('superate').doc('auth').collection('questions').get();
  const groups = new Map<string, Group>();
  let total = 0;

  snap.forEach((doc) => {
    total++;
    const d = doc.data() as { grade?: string; subjectCode?: string; subject?: string };
    const grade = d.grade ?? '?';
    const subject = d.subjectCode ?? d.subject ?? '?';
    const key = `${grade} · ${subject}`;
    const bytes = Buffer.byteLength(JSON.stringify(d), 'utf8');
    const g = groups.get(key) ?? { count: 0, bytes: 0 };
    g.count++;
    g.bytes += bytes;
    groups.set(key, g);
  });

  const rows = [...groups.entries()]
    .map(([key, g]) => ({
      pool: key,
      preguntas: g.count,
      KB: Math.round(g.bytes / 1024),
      estado: g.bytes > SAFE_LIMIT_BYTES ? '⚠️ PARTICIONAR' : 'OK',
    }))
    .sort((a, b) => b.KB - a.KB);

  console.log('=== Banco de preguntas — medición (READ ONLY) ===');
  console.log('Total preguntas:', total, '| Pools (grado·materia):', groups.size);
  console.table(rows);
  const overflow = rows.filter((r) => r.estado !== 'OK');
  console.log(
    overflow.length
      ? `⚠️ ${overflow.length} pool(s) superan ~800 KB → hay que particionar esos.`
      : '✅ Todos los pools entran cómodos en 1 MiB.'
  );
  process.exit(0);
}

main().catch((e) => {
  console.error('measure-questions error:', e);
  process.exit(1);
});
