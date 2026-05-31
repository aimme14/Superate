import type { Question } from '@/services/firebase/question.service';
import { getCombinedItems } from '@/components/admin/questionBank/questionBankUtils';
import { resolveEnglishGroupIdFromQuestion } from '@/utils/englishGroupId';

export function getCreatedAtMillis(q: Pick<Question, 'createdAt'>): number {
  const c = q.createdAt;
  if (c instanceof Date) return c.getTime();
  if (c && typeof (c as { toDate?: () => Date }).toDate === 'function') {
    return (c as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export function classifyEnglishQuestionType(
  q: Pick<Question, 'informativeText' | 'questionText'>,
): 'matching' | 'cloze' | 'reading' | 'other' {
  const info = q.informativeText ?? '';
  const qt = q.questionText ?? '';
  if (info.includes('MATCHING_COLUMNS_')) return 'matching';
  if (qt.includes('completar el hueco') || /\[\d+\]/.test(info)) return 'cloze';
  if (info.trim()) return 'reading';
  return 'other';
}

/** ID determinista para cloze/lectura legacy (re-ejecutable). */
export function deterministicEnglishGroupId(group: Question[]): string {
  const oldest = [...group].sort((a, b) => getCreatedAtMillis(a) - getCreatedAtMillis(b))[0];
  const ts = getCreatedAtMillis(oldest);
  if (!ts) {
    throw new Error(`Grupo sin createdAt válido: ${oldest.code || oldest.id}`);
  }
  return `${oldest.topicCode}_${oldest.levelCode}_${oldest.grade}_m${ts}`;
}

/** Resuelve el englishGroupId objetivo para un grupo completo. */
export function resolveTargetEnglishGroupId(group: Question[]): string {
  const withField = group.find((q) => q.englishGroupId?.trim());
  if (withField?.englishGroupId) return withField.englishGroupId.trim();

  const fromMatching = resolveEnglishGroupIdFromQuestion(group[0]);
  if (fromMatching) return fromMatching;

  return deterministicEnglishGroupId(group);
}

export interface MigrationUpdateRow {
  id: string;
  code: string;
  topicCode: string;
  type: string;
  currentEnglishGroupId?: string;
  targetEnglishGroupId: string;
}

export interface MigrationConflictRow {
  id: string;
  code: string;
  currentEnglishGroupId: string;
  targetEnglishGroupId: string;
  issue: string;
}

export interface MigrationPlan {
  totalInQuestions: number;
  groupsProcessed: number;
  toUpdate: MigrationUpdateRow[];
  alreadyOk: number;
  conflicts: MigrationConflictRow[];
  skippedUngrouped: number;
  groupSummaries: Array<{
    targetEnglishGroupId: string;
    count: number;
    type: string;
    topicCode: string;
    codes: string[];
  }>;
}

/** Planifica migración usando la misma agrupación del banco de preguntas (admin). */
export function planEnglishGroupIdMigration(questions: Question[]): MigrationPlan {
  const inQuestions = questions.filter((q) => q.subjectCode === 'IN');
  const items = getCombinedItems(inQuestions, inQuestions);
  const groupItems = items.filter((item) => item.type === 'group');

  const toUpdate: MigrationUpdateRow[] = [];
  let alreadyOk = 0;
  const conflicts: MigrationConflictRow[] = [];
  const groupSummaries: MigrationPlan['groupSummaries'] = [];

  for (const entry of groupItems) {
    if (entry.type !== 'group') continue;
    const group = entry.groupQuestions;
    if (group.length === 0) continue;

    const targetId = resolveTargetEnglishGroupId(group);
    const type = classifyEnglishQuestionType(group[0]);

    groupSummaries.push({
      targetEnglishGroupId: targetId,
      count: group.length,
      type,
      topicCode: group[0].topicCode,
      codes: group.map((q) => q.code),
    });

    for (const q of group) {
      if (!q.id) continue;
      const current = q.englishGroupId?.trim();

      if (current === targetId) {
        alreadyOk++;
        continue;
      }

      if (current && current !== targetId) {
        conflicts.push({
          id: q.id,
          code: q.code,
          currentEnglishGroupId: current,
          targetEnglishGroupId: targetId,
          issue: 'englishGroupId distinto al del resto del grupo',
        });
        continue;
      }

      toUpdate.push({
        id: q.id,
        code: q.code,
        topicCode: q.topicCode,
        type,
        targetEnglishGroupId: targetId,
      });
    }
  }

  const groupedIds = new Set(
    groupItems.flatMap((e) => (e.type === 'group' ? e.groupQuestions.map((q) => q.id) : [])),
  );
  const skippedUngrouped = inQuestions.filter((q) => q.id && !groupedIds.has(q.id)).length;

  return {
    totalInQuestions: inQuestions.length,
    groupsProcessed: groupItems.length,
    toUpdate,
    alreadyOk,
    conflicts,
    skippedUngrouped,
    groupSummaries,
  };
}

export function printMigrationPlan(plan: MigrationPlan, dryRun: boolean) {
  console.log(`\n=== MIGRACIÓN englishGroupId ${dryRun ? '(DRY-RUN)' : '(APLICANDO)'} ===\n`);
  console.log(`Preguntas IN cargadas:     ${plan.totalInQuestions}`);
  console.log(`Grupos a procesar:         ${plan.groupsProcessed}`);
  console.log(`Docs a actualizar:         ${plan.toUpdate.length}`);
  console.log(`Ya correctos:              ${plan.alreadyOk}`);
  console.log(`Sin agrupar (sin campo):   ${plan.skippedUngrouped} — MC suelta / lectura única`);
  console.log(`Conflictos:                ${plan.conflicts.length}`);

  if (plan.groupSummaries.length > 0) {
    console.log('\n--- Grupos (primeros 12) ---');
    plan.groupSummaries.slice(0, 12).forEach((g, i) => {
      console.log(
        `[${i + 1}] ${g.targetEnglishGroupId} | ${g.type} | ${g.topicCode} | ${g.count} doc(s) | ${g.codes.join(', ')}`,
      );
    });
    if (plan.groupSummaries.length > 12) {
      console.log(`… +${plan.groupSummaries.length - 12} grupos más`);
    }
  }

  if (plan.conflicts.length > 0) {
    console.log('\n⚠️ CONFLICTOS (no se modificarán automáticamente):');
    console.table(plan.conflicts.slice(0, 20));
  }

  if (plan.toUpdate.length > 0) {
    console.log('\n--- Muestra de actualizaciones (primeras 15) ---');
    console.table(
      plan.toUpdate.slice(0, 15).map((u) => ({
        code: u.code,
        type: u.type,
        topicCode: u.topicCode,
        englishGroupId: u.targetEnglishGroupId,
      })),
    );
  }

  if (dryRun && plan.toUpdate.length > 0) {
    console.log(
      '\nPara aplicar:\n' +
        "  import('/src/scripts/migrateEnglishGroupIds.ts').then(m => m.run({ dryRun: false }))",
    );
  }

  console.log('\n=== FIN ===\n');
}

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 400;

export async function applyMigrationPlan(
  plan: MigrationPlan,
): Promise<{ ok: number; failed: number; errors: string[] }> {
  const { questionService } = await import('@/services/firebase/question.service');
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < plan.toUpdate.length; i += BATCH_SIZE) {
    const batch = plan.toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        const result = await questionService.updateQuestion(row.id, {
          englishGroupId: row.targetEnglishGroupId,
        });
        if (result.success) {
          ok++;
        } else {
          failed++;
          errors.push(`${row.code}: ${result.error?.message || 'error'}`);
        }
      }),
    );
    if (i + BATCH_SIZE < plan.toUpdate.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { ok, failed, errors };
}
