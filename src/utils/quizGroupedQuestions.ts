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
 * Detecta grupos de preguntas agrupadas (mismo informativeText/imagen/contexto) para mostrar
 * el aviso: "Las siguientes preguntas (X a Y) se responden con base en el mismo texto / información."
 * Aplica a: Matemáticas, Lenguaje, Ciencias Naturales (Biología, Química, Física), Ciencias Sociales.
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

/**
 * Agrupa preguntas de Inglés por texto informativo compartido (mismo pasaje / cloze).
 * Preserva el orden del examen según la primera aparición de cada grupo.
 */
export function buildEnglishGroups(
  questions: Array<{ topicCode?: string; topic?: string; informativeText?: string; informativeImages?: unknown[]; englishGroupId?: string }>
): number[][] {
  if (questions.length === 0) return [];

  const visited = new Set<number>();
  const groups: number[][] = [];

  const groupKey = (q: typeof questions[0]) => {
    if (q.englishGroupId?.trim()) {
      return `gid:${q.englishGroupId.trim()}`;
    }
    const text = normalizeInformativeTextForGroup(q.informativeText);
    const images = JSON.stringify(q.informativeImages ?? []);
    if (
      q.informativeText &&
      typeof q.informativeText === 'string' &&
      q.informativeText.includes('MATCHING_COLUMNS_')
    ) {
      const id = q.informativeText.includes('|')
        ? q.informativeText.split('|')[0]
        : q.informativeText;
      return `matching:${id}`;
    }
    if (text) return `info:${text}::${images}`;
    return `topic:${q.topicCode || q.topic || 'unknown'}`;
  };

  for (let i = 0; i < questions.length; i++) {
    if (visited.has(i)) continue;
    const key = groupKey(questions[i]);
    const group: number[] = [];

    questions.forEach((q, j) => {
      if (visited.has(j)) return;
      if (groupKey(q) === key) {
        group.push(j);
        visited.add(j);
      }
    });

    group.sort((a, b) => a - b);
    groups.push(group);
  }

  return groups;
}

export interface GroupValidationResult {
  /** true si todas las preguntas agrupadas están consecutivas */
  isValid: boolean;
  /** Grupos que violan la regla de consecutividad (indices intercalados) */
  violations: Array<{
    groupKey: string;
    indices: number[];
    expectedRange: { start: number; end: number };
  }>;
  /** Mensaje descriptivo del resultado */
  message: string;
}

/**
 * Valida que las preguntas agrupadas (mismo informativeText/contexto) estén
 * presentadas de forma consecutiva, sin intercalar preguntas de otro contexto.
 *
 * @param questions - Array de preguntas a validar
 * @param excludeSubjectCode - Código de materia a excluir (ej: 'IN' para Inglés)
 * @returns Resultado de validación con detalles de violaciones
 */
export function validateGroupedQuestionsConsecutive(
  questions: Array<{ informativeText?: string; informativeImages?: unknown[]; subjectCode?: string }>,
  excludeSubjectCode = 'IN'
): GroupValidationResult {
  const violations: GroupValidationResult['violations'] = [];
  const processedIndices = new Set<number>();

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    if (processedIndices.has(index) || question.subjectCode === excludeSubjectCode) continue;

    const rawText = question.informativeText && String(question.informativeText).trim() !== '';
    if (!rawText) continue;

    const normalizedText = normalizeInformativeTextForGroup(question.informativeText);
    const informativeImages = JSON.stringify(question.informativeImages || []);
    const groupKey = `${normalizedText}_${informativeImages}`;

    const groupIndices: number[] = [];
    questions.forEach((q, idx) => {
      if (processedIndices.has(idx) || q.subjectCode === excludeSubjectCode) return;
      const qRaw = q.informativeText && String(q.informativeText).trim() !== '';
      if (!qRaw) return;
      const qNorm = normalizeInformativeTextForGroup(q.informativeText);
      const qImages = JSON.stringify(q.informativeImages || []);
      if (`${qNorm}_${qImages}` === groupKey) {
        groupIndices.push(idx);
        processedIndices.add(idx);
      }
    });

    if (groupIndices.length > 1) {
      const sortedIndices = [...groupIndices].sort((a, b) => a - b);
      const minIdx = sortedIndices[0];
      const maxIdx = sortedIndices[sortedIndices.length - 1];
      const expectedConsecutive = maxIdx - minIdx + 1;

      if (sortedIndices.length !== expectedConsecutive) {
        violations.push({
          groupKey: groupKey.slice(0, 50) + (groupKey.length > 50 ? '...' : ''),
          indices: sortedIndices,
          expectedRange: { start: minIdx + 1, end: maxIdx + 1 }
        });
      }
    }
  }

  const isValid = violations.length === 0;
  const message = isValid
    ? 'Todas las preguntas agrupadas están correctamente consecutivas.'
    : `Se encontraron ${violations.length} grupo(s) con preguntas intercaladas.`;

  return { isValid, violations, message };
}
