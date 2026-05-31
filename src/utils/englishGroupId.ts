import type { Question } from '@/services/firebase/question.service';
import { extractMatchingGroupId } from '@/utils/matchingColumns';
import { normalizeInformativeTextForGroup } from '@/utils/quizGroupedQuestions';

/** ID único para un ejercicio agrupado de Inglés (lectura, cloze, matching). */
export function generateEnglishGroupId(
  topicCode: string,
  levelCode: string,
  grade: string,
): string {
  return `${topicCode}_${levelCode}_${grade}_${Date.now()}`;
}

export function matchingInformativeTextPrefix(englishGroupId: string): string {
  return `MATCHING_COLUMNS_${englishGroupId}`;
}

/** Deriva englishGroupId de una pregunta existente (campo explícito o matching legacy). */
export function resolveEnglishGroupIdFromQuestion(
  question: Pick<Question, 'englishGroupId' | 'informativeText'> | null | undefined,
): string | undefined {
  if (!question) return undefined;
  if (question.englishGroupId?.trim()) return question.englishGroupId.trim();

  const info = question.informativeText;
  if (!info?.includes('MATCHING_COLUMNS_')) return undefined;

  const raw = extractMatchingGroupId(info);
  if (raw.startsWith('MATCHING_COLUMNS_')) {
    return raw.slice('MATCHING_COLUMNS_'.length);
  }
  return raw.replace(/^MATCHING_COLUMNS_/, '');
}

/** Clave de agrupación: prioriza englishGroupId; fallback legacy. */
export function resolveEnglishGroupKey(
  question: Pick<
    Question,
    'englishGroupId' | 'informativeText' | 'subjectCode' | 'topicCode' | 'grade' | 'levelCode' | 'informativeImages'
  >,
): string {
  if (question.englishGroupId?.trim()) {
    return `gid:${question.englishGroupId.trim()}`;
  }

  const info = question.informativeText ?? '';
  if (info.includes('MATCHING_COLUMNS_')) {
    return `matching:${extractMatchingGroupId(info)}`;
  }

  const text = normalizeInformativeTextForGroup(question.informativeText);
  const images = JSON.stringify(question.informativeImages ?? []);
  if (text) {
    return `info:${text}::${images}_${question.topicCode}_${question.grade}_${question.levelCode}`;
  }

  return `solo:${question.topicCode || 'unknown'}_${question.grade}_${question.levelCode}`;
}

/** ID de grupo para el examen: campo explícito → matching legacy → clave legacy. */
export function getEnglishExamGroupId(
  question: Pick<
    Question,
    'englishGroupId' | 'informativeText' | 'subjectCode' | 'topicCode' | 'grade' | 'levelCode' | 'informativeImages'
  >,
): string {
  if (question.englishGroupId?.trim()) return question.englishGroupId.trim();
  const fromMatching = resolveEnglishGroupIdFromQuestion(question);
  if (fromMatching) return fromMatching;
  return resolveEnglishGroupKey(question);
}

/** Agrupa preguntas IN en arrays (un ejercicio por entrada). */
export function groupQuestionsByExamGroupId(questions: Question[]): Question[][] {
  const map = new Map<string, Question[]>();
  for (const q of questions) {
    const id = getEnglishExamGroupId(q);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(q);
  }
  return [...map.values()];
}
