/**
 * URL base de Cloud Functions HTTP unificada (`superateHttp`).
 * Rutas: `${CLOUD_FUNCTIONS_HTTP_BASE}/getStudyPlan`, `/health`, etc.
 *
 * En desarrollo, por defecto se usa ruta relativa `/superateHttp` y Vite hace proxy
 * al proyecto en la nube (evita errores de CORS desde localhost).
 * Desactivar: `VITE_USE_FUNCTIONS_PROXY=false` en `.env`.
 */
const DEFAULT_CLOUD_FUNCTIONS_ORIGIN =
  'https://us-central1-superate-6c730.cloudfunctions.net';

function resolveCloudFunctionsBaseUrl(): string {
  const useProxy =
    import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_PROXY !== 'false';
  if (useProxy) {
    return '';
  }
  return import.meta.env.VITE_CLOUD_FUNCTIONS_URL || DEFAULT_CLOUD_FUNCTIONS_ORIGIN;
}

export const CLOUD_FUNCTIONS_BASE_URL = resolveCloudFunctionsBaseUrl();

export const CLOUD_FUNCTIONS_HTTP_BASE = CLOUD_FUNCTIONS_BASE_URL
  ? `${CLOUD_FUNCTIONS_BASE_URL}/superateHttp`
  : '/superateHttp';
