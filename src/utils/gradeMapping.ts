import { GRADE_MAPPING } from '@/utils/subjects.config';

/**
 * Etiquetas explícitas de UI → código canónico del banco
 * (6–9 literal, 10→0 Décimo, 11→1 Undécimo).
 * Para cargar preguntas del estudiante usar `gradeLabelToBankCode` /
 * `bankGradeForStudentQuestions` (Décimo comparte Undécimo).
 */
const EXPLICIT_LABEL_TO_CODE: Record<string, string> = {
  '6°': '6',
  '6°1': '6',
  '6°2': '6',
  '6°3': '6',
  '7°': '7',
  '7°1': '7',
  '7°2': '7',
  '7°3': '7',
  '8°': '8',
  '8°1': '8',
  '8°2': '8',
  '8°3': '8',
  '9°': '9',
  '9°1': '9',
  '9°2': '9',
  '9°3': '9',
  '10°': '0',
  '10°1': '0',
  '10°2': '0',
  '10°3': '0',
  '11°': '1',
  '11°1': '1',
  '11°2': '1',
  '11°3': '1',
  Sexto: '6',
  Séptimo: '7',
  Octavo: '8',
  Noveno: '9',
  Décimo: '0',
  Undécimo: '1',
  '0': '0',
  '10': '0',
  '1': '1',
  '11': '1',
};

function schoolYearToBankCode(year: number): string | undefined {
  if (year === 6) return '6';
  if (year === 7) return '7';
  if (year === 8) return '8';
  if (year === 9) return '9';
  if (year === 10) return '0';
  if (year === 11) return '1';
  return undefined;
}

/**
 * Código de grado al consultar el banco para el estudiante.
 * Décimo (`0`) usa las mismas preguntas que Undécimo (`1`).
 */
export function bankGradeForStudentQuestions(
  bankCode: string | undefined | null
): string | undefined {
  if (bankCode == null) return undefined;
  const c = String(bankCode).trim();
  if (!c) return undefined;
  if (c === '0') return '1';
  return c;
}

/**
 * Convierte el grado del perfil del estudiante al código usado al cargar preguntas.
 * Acepta formatos habituales en colegios colombianos: `11°1`, `11-1`, `Undécimo`, etc.
 * Décimo se resuelve al banco de Undécimo (`1`).
 */
export function gradeLabelToBankCode(gradeLabel: string | undefined | null): string | undefined {
  if (gradeLabel == null) return undefined;
  const raw = String(gradeLabel).trim();
  if (!raw) return undefined;

  let code: string | undefined;

  if (EXPLICIT_LABEL_TO_CODE[raw]) {
    code = EXPLICIT_LABEL_TO_CODE[raw];
  } else {
    const lower = raw.toLowerCase();
    const byName = Object.entries(GRADE_MAPPING).find(([name]) => name.toLowerCase() === lower);
    if (byName) {
      code = byName[1];
    } else {
      const hyphen = raw.match(/^(\d{1,2})\s*[-–]\s*\d+\s*$/);
      if (hyphen) {
        code = schoolYearToBankCode(parseInt(hyphen[1], 10));
      } else {
        const firstNum = raw.match(/\d+/);
        if (firstNum) {
          code = schoolYearToBankCode(parseInt(firstNum[0], 10));
        }
      }
    }
  }

  return bankGradeForStudentQuestions(code);
}
