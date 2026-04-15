/**
 * Servicio para obtener ejercicios de EjerciciosIA (mini simulacro).
 */

import { CLOUD_FUNCTIONS_HTTP_BASE } from '@/config/cloudFunctions';

export interface EjercicioIA {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

export interface GetRandomEjerciciosParams {
  grade?: string;
  subject?: string;
  limit?: number;
}

export interface GetRandomEjerciciosResult {
  success: boolean;
  data?: EjercicioIA[];
  error?: { message: string };
}

/**
 * Obtiene ejercicios aleatorios desde EjerciciosIA.
 * @param params - grade/subject legacy (backend ya no filtra por estos campos), limit (default 10)
 */
export async function getRandomEjercicios(
  params: GetRandomEjerciciosParams
): Promise<GetRandomEjerciciosResult> {
  const { grade, subject, limit = 10 } = params;

  try {
    const path = `${CLOUD_FUNCTIONS_HTTP_BASE}/getRandomEjerciciosIA`;
    const url =
      path.startsWith('http://') || path.startsWith('https://')
        ? new URL(path)
        : new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (grade) url.searchParams.set('grade', grade);
    if (subject) url.searchParams.set('subject', subject);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: { message: json.error?.message || `Error HTTP ${res.status}` },
      };
    }
    return {
      success: json.success ?? true,
      data: json.data ?? [],
    };
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Error al cargar ejercicios',
      },
    };
  }
}
