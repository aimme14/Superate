/**
 * Script temporal: detecta preguntas duplicadas en el banco.
 *
 * Criterio de duplicado (contenido idéntico):
 *   - informativeText
 *   - questionText
 *   - options (id, text, imageUrl, isCorrect)
 *
 * Uso:
 *   npm run temp-find-duplicate-questions
 *   npm run temp-find-duplicate-questions -- --delete   # elimina duplicados (conserva el más antiguo)
 *
 * Reporte JSON: functions/reports/duplicate-questions-report.json
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { questionsCollection } from '../config/firebase.config';
import { Question, QuestionOption } from '../types/question.types';

const BATCH_SIZE = 500;
const REPORT_DIR = path.resolve(__dirname, '../../reports');

interface QuestionSummary {
  id: string;
  code: string;
  subject: string;
  topic: string;
  grade: string;
  level: string;
  createdAt: string;
  hasAiJustification: boolean;
}

interface DuplicateGroup {
  fingerprint: string;
  count: number;
  informativeTextPreview: string;
  questionTextPreview: string;
  optionsPreview: string;
  keep: QuestionSummary;
  remove: QuestionSummary[];
}

/** Normaliza texto para comparación estable (espacios, saltos de línea). */
function normalizeText(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

/** Huella de opciones: ordenadas por id, incluye texto, imagen y correcta. */
function fingerprintOptions(options: QuestionOption[] | undefined): string {
  if (!options?.length) return '';

  return [...options]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((opt) => [
      opt.id,
      normalizeText(opt.text),
      opt.imageUrl ?? '',
      opt.isCorrect ? '1' : '0',
    ].join(':'))
    .join('|');
}

/** Huella de contenido completo de la pregunta. */
function buildContentFingerprint(question: Question): string {
  return [
    normalizeText(question.informativeText),
    normalizeText(question.questionText),
    fingerprintOptions(question.options),
  ].join('\u241E'); // separador poco probable en texto real
}

function preview(text: string | undefined, max = 120): string {
  const normalized = normalizeText(text);
  if (!normalized) return '(vacío)';
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

function toSummary(question: Question): QuestionSummary {
  return {
    id: question.id ?? '',
    code: question.code,
    subject: question.subject,
    topic: question.topic,
    grade: question.grade,
    level: question.level,
    createdAt: question.createdAt?.toISOString?.() ?? String(question.createdAt),
    hasAiJustification: Boolean(question.aiJustification),
  };
}

/** Conserva: más antigua; desempate por justificación IA y código menor. */
function pickKeeper(questions: Question[]): Question {
  return [...questions].sort((a, b) => {
    const timeA = a.createdAt?.getTime?.() ?? 0;
    const timeB = b.createdAt?.getTime?.() ?? 0;
    if (timeA !== timeB) return timeA - timeB;

    const justA = a.aiJustification ? 1 : 0;
    const justB = b.aiJustification ? 1 : 0;
    if (justA !== justB) return justB - justA;

    return a.code.localeCompare(b.code);
  })[0];
}

async function fetchAllQuestions(): Promise<Question[]> {
  const results: Question[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  console.log('📥 Descargando preguntas de Firestore…');

  while (true) {
    let query = questionsCollection()
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      results.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() ?? new Date(0),
        aiJustification: data.aiJustification
          ? {
              ...data.aiJustification,
              generatedAt: data.aiJustification.generatedAt?.toDate?.() ?? new Date(),
            }
          : undefined,
      } as Question);
    }

    process.stdout.write(`\r   ${results.length} preguntas cargadas…`);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < BATCH_SIZE) break;
  }

  console.log(`\n✅ Total: ${results.length} preguntas\n`);
  return results;
}

function findDuplicateGroups(questions: Question[]): DuplicateGroup[] {
  const buckets = new Map<string, Question[]>();

  for (const question of questions) {
    const key = buildContentFingerprint(question);
    const group = buckets.get(key);
    if (group) {
      group.push(question);
    } else {
      buckets.set(key, [question]);
    }
  }

  const groups: DuplicateGroup[] = [];

  for (const [fingerprint, members] of buckets) {
    if (members.length < 2) continue;

    const keeper = pickKeeper(members);
    const remove = members.filter((q) => q.id !== keeper.id);

    groups.push({
      fingerprint,
      count: members.length,
      informativeTextPreview: preview(keeper.informativeText),
      questionTextPreview: preview(keeper.questionText),
      optionsPreview: preview(
        (keeper.options ?? [])
          .map((o) => `${o.id}) ${o.text ?? o.imageUrl ?? '(sin texto)'}`)
          .join(' | ')
      ),
      keep: toSummary(keeper),
      remove: remove.map(toSummary),
    });
  }

  groups.sort((a, b) => b.count - a.count || a.keep.code.localeCompare(b.keep.code));
  return groups;
}

async function deleteDuplicates(groups: DuplicateGroup[]): Promise<number> {
  const idsToDelete = groups.flatMap((g) => g.remove.map((q) => q.id));
  if (!idsToDelete.length) return 0;

  console.log(`\n🗑️  Eliminando ${idsToDelete.length} preguntas duplicadas…`);

  let deleted = 0;
  const batchLimit = 400;

  for (let i = 0; i < idsToDelete.length; i += batchLimit) {
    const chunk = idsToDelete.slice(i, i + batchLimit);
    const batch = admin.firestore().batch();

    for (const id of chunk) {
      batch.delete(questionsCollection().doc(id));
    }

    await batch.commit();
    deleted += chunk.length;
    process.stdout.write(`\r   ${deleted}/${idsToDelete.length} eliminadas…`);
  }

  console.log('\n✅ Eliminación completada\n');
  return deleted;
}

function writeReport(groups: DuplicateGroup[], totalQuestions: number): string {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const duplicateCount = groups.reduce((sum, g) => sum + g.remove.length, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    totalQuestions,
    duplicateGroups: groups.length,
    duplicateDocumentsToRemove: duplicateCount,
    groups,
  };

  const reportPath = path.join(REPORT_DIR, 'duplicate-questions-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

function printConsoleReport(groups: DuplicateGroup[]): void {
  if (!groups.length) {
    console.log('🎉 No se encontraron preguntas duplicadas con el criterio de contenido.');
    return;
  }

  const toRemove = groups.reduce((sum, g) => sum + g.remove.length, 0);
  console.log(`⚠️  ${groups.length} grupos de duplicados (${toRemove} documentos eliminables)\n`);
  console.log('═'.repeat(90));

  groups.forEach((group, index) => {
    console.log(`\n${index + 1}. GRUPO (${group.count} copias)`);
    console.log(`   Texto informativo: ${group.informativeTextPreview}`);
    console.log(`   Pregunta:          ${group.questionTextPreview}`);
    console.log(`   Opciones:          ${group.optionsPreview}`);
    console.log(`   ✅ CONSERVAR: ${group.keep.code} (${group.keep.id}) — ${group.keep.subject}/${group.keep.topic}`);
    group.remove.forEach((q) => {
      console.log(`   ❌ DUPLICADO:  ${q.code} (${q.id}) — ${q.subject}/${q.topic}`);
    });
  });

  console.log('\n' + '═'.repeat(90));
}

async function main(): Promise<void> {
  const shouldDelete = process.argv.includes('--delete');

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const questions = await fetchAllQuestions();
  const groups = findDuplicateGroups(questions);
  const reportPath = writeReport(groups, questions.length);

  printConsoleReport(groups);
  console.log(`\n📄 Reporte detallado: ${reportPath}`);

  if (shouldDelete && groups.length > 0) {
    const deleted = await deleteDuplicates(groups);
    console.log(`Eliminados ${deleted} documentos duplicados.`);
  } else if (groups.length > 0) {
    console.log('\n💡 Modo solo lectura. Para eliminar duplicados (conservando el más antiguo):');
    console.log('   npm run temp-find-duplicate-questions -- --delete');
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Error:', message);

  if (message.includes('default credentials')) {
    console.error(`
Para ejecutar este script necesitas credenciales de Admin SDK:

  1. Firebase Console → Configuración → Cuentas de servicio → Generar clave privada
  2. Guarda el JSON (no lo subas a git)
  3. En PowerShell:
       $env:GOOGLE_APPLICATION_CREDENTIALS="ruta\\al\\archivo.json"
       npm run temp-find-duplicate-questions

  O bien: gcloud auth application-default login
`);
  }

  process.exit(1);
});
