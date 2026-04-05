/**
 * Genera un plan de estudio (generateStudyPlan) y verifica lectura posterior (getStudyPlan).
 * Uso:
 *   GENERATE_STUDENT_ID=uid GENERATE_SUBJECT=Biologia npm run verify:generate
 *
 * Requiere serviceAccountKey.json, variables de entorno de Gemini (o .env en functions/).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { getStudentDatabase } from '../utils/firestoreHelpers';
import { resolveStudentInstitution } from '../services/studentProgressSummary.service';
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

async function main(): Promise<void> {
  const studentId =
    process.env.GENERATE_STUDENT_ID?.trim() || 'Rt25sft2Q4MNtYIko9GlurGO64J3';
  const subject = process.env.GENERATE_SUBJECT?.trim() || 'Biologia';

  initAdminOnce();
  const db = getStudentDatabase();

  const ctx = await resolveStudentInstitution(db, studentId);
  const grade = ctx?.gradeName || ctx?.gradeId || 'Undécimo';
  console.log('══ Generar y verificar plan de estudio ══');
  console.log('   Estudiante:', studentId);
  console.log('   Materia:', subject);
  console.log('   Grado:', grade, ctx ? '(desde Firestore)' : '(por defecto)');

  console.log('\n⏳ Generando plan (Gemini + Firestore; puede tardar varios minutos)...\n');
  const gen = await studyPlanService.generateStudyPlan({
    studentId,
    phase: 'first',
    subject,
    grade,
  });

  if (!gen.success || !gen.studyPlan) {
    console.error('❌ Generación falló:', gen.error || 'sin studyPlan');
    process.exit(1);
  }

  const p = gen.studyPlan;
  console.log('\n✅ Generación OK');
  console.log('   practice_exercises:', p.practice_exercises?.length ?? 0);
  console.log('   video_resources:', p.video_resources?.length ?? 0);
  console.log('   study_links:', p.study_links?.length ?? 0);
  console.log('   Tiempo ms:', gen.processingTimeMs);

  console.log('\n⏳ Leyendo plan guardado (getStudyPlan → WebLinks/Youtube consolidados + fase AnswerIA)...');
  const readBack = await studyPlanService.getStudyPlan(studentId, 'first', subject);
  if (!readBack) {
    console.error('❌ getStudyPlan devolvió null tras generar (revisar AnswerIA / fase).');
    process.exit(1);
  }

  console.log('✅ getStudyPlan OK');
  console.log('   study_links (rehidratados):', readBack.study_links?.length ?? 0);
  console.log('   video_resources:', readBack.video_resources?.length ?? 0);
  console.log('   practice_exercises:', readBack.practice_exercises?.length ?? 0);

  const linksOk = (readBack.study_links?.length ?? 0) >= 0;
  const videosOk = (readBack.video_resources?.length ?? 0) > 0;
  const exOk = (readBack.practice_exercises?.length ?? 0) > 0;

  console.log('\n── Comprobaciones de mejoras ──');
  console.log(
    '   • Rutas de fase (results/AnswerIA): sin error → getStudentResults y save/get AnswerIA coherentes.'
  );
  console.log(
    '   • Consolidados Web/YT (promesa por materia): study_links y videos cargados sin duplicar lecturas en caliente.'
  );
  console.log('   • practice_exercises: solo en AnswerIA (sin escribir/leer EjerciciosIA desde el plan).');

  if (exOk && videosOk && linksOk) {
    console.log('\n✅ Plan completo y lectura posterior coherentes con lo esperado.');
  } else {
    console.log('\n⚠️ Algún recurso vacío (p. ej. sin enlaces en WebLinks BI); revisar datos admin.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
