/**
 * Servicio para obtener ejercicios de EjerciciosIA (mini simulacro).
 */

const FUNCTIONS_URL =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  'https://us-central1-superate-ia.cloudfunctions.net';

export interface EjercicioIA {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

export interface GetRandomEjerciciosParams {
  grade: string;
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
 * @param params - grade (ej. "11"), subject opcional (MA, BI, CS...), limit (default 10)
 */
export async function getRandomEjercicios(
  params: GetRandomEjerciciosParams
): Promise<GetRandomEjerciciosResult> {
  const { grade, subject, limit = 10 } = params;
  const url = new URL(`${FUNCTIONS_URL}/getRandomEjerciciosIA`);
  url.searchParams.set('grade', grade);
  if (subject) url.searchParams.set('subject', subject);
  url.searchParams.set('limit', String(limit));

  try {
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
