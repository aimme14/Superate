/**
 * Utilidad para agrupar preguntas por texto informativo (comprensión de lectura)
 * en exámenes. Se usa en todas las materias excepto Inglés.
 */

/**
 * Normaliza el texto informativo para usarlo como clave de agrupación:
 * trim + colapsar espacios. Así preguntas con el mismo contenido se agrupan
 * aunque varíe el formato (espacios, saltos de línea).
 */
export function normalizeInformativeTextForGroup(text: string | undefined): string {
  return (text || '').trim().replace(/\s+/g, ' ');
}

export type GroupedQuestionRange = { start: number; end: number };
export type GroupedQuestionsMap = { [startIndex: number]: GroupedQuestionRange };

/**
 * Detecta grupos de preguntas agrupadas (mismo informativeText) para mostrar
 * el mensaje "Las preguntas X a Y se responden con base en la siguiente información".
 * Excluye inglés (subjectCode === 'IN').
 */
export function detectGroupedQuestions(questions: any[]): GroupedQuestionsMap {
  const groups: GroupedQuestionsMap = {};
  const processedIndices = new Set<number>();

  questions.forEach((question, index) => {
    if (processedIndices.has(index) || question.subjectCode === 'IN') {
      return;
    }

    const rawText = question.informativeText && String(question.informativeText).trim() !== '';
    if (!rawText) return;

    const normalizedText = normalizeInformativeTextForGroup(question.informativeText);
    const informativeImages = JSON.stringify(question.informativeImages || []);
    const groupKey = `${normalizedText}_${informativeImages}`;

    const groupIndices: number[] = [];
    questions.forEach((q, idx) => {
      if (processedIndices.has(idx) || q.subjectCode === 'IN') return;
      const qRaw = q.informativeText && String(q.informativeText).trim() !== '';
      if (!qRaw) return;
      const qNorm = normalizeInformativeTextForGroup(q.informativeText);
      const qImages = JSON.stringify(q.informativeImages || []);
      const qGroupKey = `${qNorm}_${qImages}`;
      if (qGroupKey === groupKey) {
        groupIndices.push(idx);
        processedIndices.add(idx);
      }
    });

    if (groupIndices.length > 1) {
      const sortedIndices = groupIndices.sort((a, b) => a - b);
      const startIndex = sortedIndices[0];
      groups[startIndex] = {
        start: startIndex + 1,
        end: sortedIndices[sortedIndices.length - 1] + 1
      };
    }
  });

  return groups;
}
