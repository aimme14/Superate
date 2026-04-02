/**
 * Verificación en terminal: rutas de fase canónicas, consolidados Web/YT y ejercicios (query).
 * Requiere serviceAccountKey.json en functions/ y acceso a Firestore superate-6c730.
 *
 * Ejecutar: npm run verify:plan (desde functions/)
 * Con datos: VERIFY_STUDENT_ID=uid VERIFY_SUBJECT="Matemáticas" npm run verify:plan
 */

import * as assert from 'assert';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { getStudentDatabase } from '../utils/firestoreHelpers';
import {
  getCanonicalResultsPhaseSubcollection,
  getCanonicalAnswerIAPhaseSubcollection,
  getLegacyResultsPhaseAlternates,
} from '../utils/resultsPhasePath';
import studyPlanService from '../services/studyPlan.service';

function initAdminOnce(): void {
  try {
    admin.app('superate-6c730');
  } catch {
    const credentialsPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(credentialsPath)) {
      const sa = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      admin.initializeApp(
        { credential: admin.credential.cert(sa), projectId: 'superate-6c730' },
        'superate-6c730'
      );
    } else {
      admin.initializeApp({ projectId: 'superate-6c730' }, 'superate-6c730');
    }
  }
}

async function findStudentWithPhase1Results(db: admin.firestore.Firestore): Promise<{
  studentId: string;
  subject: string;
  phaseFolderUsed: string;
} | null> {
  const phaseNamesToTry = [
    getCanonicalResultsPhaseSubcollection('first'),
    ...getLegacyResultsPhaseAlternates('first'),
  ];
  const roots = await db.collection('results').limit(80).get();
  for (const root of roots.docs) {
    const sid = root.id;
    for (const phaseFolder of phaseNamesToTry) {
      const snap = await db.collection('results').doc(sid).collection(phaseFolder).limit(5).get();
      if (snap.empty) continue;
      const subj = (snap.docs[0].data().subject as string) || 'Matemáticas';
      return { studentId: sid, subject: subj, phaseFolderUsed: phaseFolder };
    }
  }
  return null;
}

function assertPhaseNamingMatchesProduct(): void {
  assert.strictEqual(getCanonicalResultsPhaseSubcollection('first'), 'fase I');
  assert.strictEqual(getCanonicalResultsPhaseSubcollection('second'), 'Fase II');
  assert.strictEqual(getCanonicalResultsPhaseSubcollection('third'), 'fase III');
  assert.strictEqual(getCanonicalAnswerIAPhaseSubcollection('first'), 'Fase I');
  assert.strictEqual(getCanonicalAnswerIAPhaseSubcollection('second'), 'Fase II');
  assert.strictEqual(getCanonicalAnswerIAPhaseSubcollection('third'), 'Fase III');
}

async function main(): Promise<void> {
  assertPhaseNamingMatchesProduct();
  console.log('══ Verificación optimizaciones plan de estudio ══\n');
  console.log('0) Aserciones estáticas (helpers vs cliente / saveStudyPlan): ✅ OK\n');

  initAdminOnce();
  const db = getStudentDatabase();

  console.log('1) Rutas canónicas (results / AnswerIA):');
  console.log('   results fase I →', getCanonicalResultsPhaseSubcollection('first'));
  console.log('   AnswerIA Fase I →', getCanonicalAnswerIAPhaseSubcollection('first'));

  const sampleRoots = await db.collection('results').limit(5).get();
  console.log('\n   Diagnóstico: documentos raíz en `results` (muestra):', sampleRoots.size);
  if (!sampleRoots.empty) {
    console.log('   Primeros ids:', sampleRoots.docs.map((d) => d.id).join(', '));
  }

  const envId = process.env.VERIFY_STUDENT_ID?.trim();
  const envSubject = process.env.VERIFY_SUBJECT?.trim() || 'Matemáticas';

  let found: { studentId: string; subject: string; phaseFolderUsed: string } | null = null;
  if (envId) {
    console.log('\n   Usando VERIFY_STUDENT_ID / VERIFY_SUBJECT desde entorno.');
    found = { studentId: envId, subject: envSubject, phaseFolderUsed: '(env)' };
  } else {
    found = await findStudentWithPhase1Results(db);
  }

  if (!found) {
    console.log('\n⚠️ No se encontró ningún estudiante con docs en results/.../[fase I variants] (primeros 80 uids).');
    console.log('   Opcional: VERIFY_STUDENT_ID=uid VERIFY_SUBJECT="Matemáticas" npm run verify:plan');
    console.log('   El resto de comprobaciones se omiten (sin datos de prueba).');
    process.exit(0);
  }

  const { studentId, subject, phaseFolderUsed } = found;
  console.log('\n2) Estudiante de prueba:', studentId);
  console.log('   Carpeta de fase donde hay resultados:', phaseFolderUsed);
  console.log('   Materia (desde primer resultado):', subject);

  console.log('\n3) getStudyPlan (AnswerIA + WebLinks/YoutubeLinks consolidados)...');
  try {
    const plan = await studyPlanService.getStudyPlan(studentId, 'first', subject);
    if (plan) {
      console.log('   ✅ Plan encontrado. study_links:', plan.study_links?.length ?? 0);
      console.log('   ✅ video_resources:', plan.video_resources?.length ?? 0);
      console.log('   ✅ practice_exercises:', plan.practice_exercises?.length ?? 0);
    } else {
      console.log('   ℹ️ Sin plan guardado en AnswerIA para esa materia (esperado si aún no generó plan).');
    }
  } catch (e: unknown) {
    console.error('   ❌ Error:', e);
    process.exit(1);
  }

  console.log('\n4) Llamadas paralelas duplicadas a getStudyPlan (misma materia)...');
  try {
    const [a, b] = await Promise.all([
      studyPlanService.getStudyPlan(studentId, 'first', subject),
      studyPlanService.getStudyPlan(studentId, 'first', subject),
    ]);
    const same =
      (a === null && b === null) ||
      (a && b && JSON.stringify(a.study_links) === JSON.stringify(b.study_links));
    console.log(same ? '   ✅ Dos lecturas coherentes (consolidados memoizados por promesa).' : '   ⚠️ Resultados difieren (revisar).');
  } catch (e: unknown) {
    console.error('   ❌', e);
    process.exit(1);
  }

  console.log('\n✅ Verificación terminada sin errores fatales.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
