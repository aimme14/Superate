/**
 * URL base de Cloud Functions HTTP unificada (`superateHttp`).
 * Rutas: `${CLOUD_FUNCTIONS_HTTP_BASE}/getStudyPlan`, `/health`, etc.
 */
export const CLOUD_FUNCTIONS_BASE_URL =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  'https://us-central1-superate-6c730.cloudfunctions.net';

export const CLOUD_FUNCTIONS_HTTP_BASE = `${CLOUD_FUNCTIONS_BASE_URL}/superateHttp`;
