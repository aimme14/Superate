import type { Question } from '@/services/firebase/question.service';
import { isMatchingColumnsGroup, isMatchingColumnsGroupComplete } from '@/utils/matchingColumns';

const CLOZE_PATTERN = /completar el hueco/i;
const GAP_IN_QUESTION = /hueco\s*\[(\d+)\]/i;

export function isClozeTestQuestion(question: Pick<Question, 'questionText'>): boolean {
  return !!(question.questionText && CLOZE_PATTERN.test(question.questionText));
}

export function isClozeTestGroup(questions: Pick<Question, 'questionText'>[]): boolean {
  return questions.some(isClozeTestQuestion);
}

export function extractGapNumberFromQuestion(question: Pick<Question, 'questionText'>): number | null {
  const match = question.questionText?.match(GAP_IN_QUESTION);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function buildClozeGapQuestionMap(questions: Question[]): Map<number, Question> {
  const map = new Map<number, Question>();
  questions.forEach((question) => {
    const gapNum = extractGapNumberFromQuestion(question);
    if (gapNum != null) map.set(gapNum, question);
  });
  return map;
}

export type ClozePart =
  | { type: 'text'; content: string }
  | { type: 'gap'; gapNum: number };

/** Divide el HTML del cloze en segmentos de texto y marcadores [N]. */
export function parseClozeParts(clozeHtml: string): ClozePart[] {
  if (!clozeHtml.trim()) return [];

  const gapNumbers = extractGapNumbersFromText(clozeHtml);
  if (gapNumbers.length === 0) return [{ type: 'text', content: clozeHtml }];

  const parts: ClozePart[] = [];
  let remainingText = clozeHtml;

  gapNumbers.forEach((gapNum) => {
    const gapMarker = `[${gapNum}]`;
    const splitIndex = remainingText.indexOf(gapMarker);
    if (splitIndex === -1) return;
    if (splitIndex > 0) {
      parts.push({ type: 'text', content: remainingText.substring(0, splitIndex) });
    }
    parts.push({ type: 'gap', gapNum });
    remainingText = remainingText.substring(splitIndex + gapMarker.length);
  });

  if (remainingText) parts.push({ type: 'text', content: remainingText });
  return parts;
}

export function extractGapNumbersFromText(text: string): number[] {
  const matches = text.match(/\[(\d+)\]/g) || [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[\[\]]/g, ''), 10)))].sort((a, b) => a - b);
}

export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/** Un grupo de inglés está completo: cloze (todos los huecos) o matching (≥2 ítems del mismo ID). */
export function isEnglishGroupComplete(group: Pick<Question, 'questionText' | 'informativeText' | 'subjectCode'>[]): boolean {
  if (group.length === 0) return false;
  if (isMatchingColumnsGroup(group)) {
    return isMatchingColumnsGroupComplete(group);
  }
  if (!isClozeTestGroup(group)) return true;

  const gapNumbers = extractGapNumbersFromText(group[0].informativeText || '');
  if (gapNumbers.length === 0) return group.length > 0;

  const covered = new Set<number>();
  group.forEach((q) => {
    const n = extractGapNumberFromQuestion(q);
    if (n != null) covered.add(n);
  });
  return gapNumbers.every((n) => covered.has(n));
}

/** Convierte bloques HTML en flujo legible para cloze inline (evita <p> que rompen el layout). */
export function clozeHtmlForInlineDisplay(html: string): string {
  return html
    .replace(/<p[^>]*>/gi, '<span class="block mb-3 last:mb-0">')
    .replace(/<\/p>/gi, '</span>')
    .replace(/<br\s*\/?>/gi, ' ');
}
