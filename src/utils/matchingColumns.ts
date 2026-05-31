import type { Question } from '@/services/firebase/question.service';

const MATCHING_PREFIX = 'MATCHING_COLUMNS_';

export function isMatchingColumnsQuestion(
  question: Pick<Question, 'subjectCode' | 'informativeText'>,
): boolean {
  return (
    question.subjectCode === 'IN' &&
    typeof question.informativeText === 'string' &&
    question.informativeText.includes(MATCHING_PREFIX)
  );
}

export function isMatchingColumnsGroup(
  questions: Pick<Question, 'subjectCode' | 'informativeText'>[],
): boolean {
  return questions.some(isMatchingColumnsQuestion);
}

/** Texto real del usuario (sin el ID interno MATCHING_COLUMNS_...). */
export function extractMatchingText(informativeText: string | undefined | null): string {
  if (!informativeText) return '';
  if (informativeText.includes('|')) {
    return informativeText.split('|').slice(1).join('|').trim();
  }
  return '';
}

/** ID interno de agrupación — no mostrar al estudiante. */
export function extractMatchingGroupId(informativeText: string | undefined | null): string {
  if (!informativeText) return '';
  if (informativeText.includes('|')) return informativeText.split('|')[0];
  return informativeText;
}

/** Clave de agrupación para matching (mismo ID interno = mismo ejercicio). */
export function matchingGroupKey(
  question: Pick<Question, 'informativeText' | 'topicCode' | 'grade' | 'levelCode'>,
): string {
  return `${extractMatchingGroupId(question.informativeText)}_${question.topicCode}_${question.grade}_${question.levelCode}`;
}

/** Un ejercicio de columnas debe tener al menos 2 ítems y compartir el mismo ID de grupo. */
export function isMatchingColumnsGroupComplete(
  group: Pick<Question, 'informativeText'>[],
): boolean {
  if (group.length < 2) return false;
  const id = extractMatchingGroupId(group[0].informativeText);
  if (!id) return false;
  return group.every((q) => extractMatchingGroupId(q.informativeText) === id);
}

export function getMatchingInstructionText(informativeText: string | undefined): string {
  const userText = extractMatchingText(informativeText);
  if (userText) return userText;
  return 'Lea las descripciones de la columna izquierda y seleccione la respuesta correcta en la columna derecha.';
}

export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}
