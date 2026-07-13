/**
 * Helpers de autenticación para las rutas HTTP de Cloud Functions (`superateHttp`).
 *
 * Centraliza el envío de `Authorization: Bearer <idToken>` reutilizando el mismo
 * patrón que ya usa `studentSummary.service.ts`. Objetivo: que el cliente empiece
 * a mandar el token ANTES de que el backend lo exija, sin romper compatibilidad.
 *
 * `getAuthHeaders()` es tolerante por defecto: si no hay sesión, NO lanza y devuelve
 * solo `Content-Type`. Así, mientras el backend siga aceptando peticiones sin token,
 * nada se rompe. Cuando el backend exija Bearer, la sesión ya estará presente para
 * los flujos autenticados (estudiante/admin logueado).
 */

import { authService } from '@/services/firebase/auth.service';

interface GetAuthHeadersOptions {
  /** Si es true, lanza cuando no hay sesión (para endpoints ya protegidos). Default: false. */
  required?: boolean;
  /** Fuerza refresco del ID token (para recoger custom claims recién actualizados). Default: false. */
  forceRefresh?: boolean;
}

/**
 * Devuelve los headers para un fetch a `superateHttp`, incluyendo el Bearer token
 * si hay un usuario autenticado.
 */
export async function getAuthHeaders(
  options: GetAuthHeadersOptions = {}
): Promise<HeadersInit> {
  const { required = false, forceRefresh = false } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const user = authService.auth.currentUser;
  if (!user) {
    if (required) {
      throw new Error('Debes iniciar sesión para realizar esta acción.');
    }
    return headers;
  }

  const idToken = await user.getIdToken(forceRefresh);
  headers.Authorization = `Bearer ${idToken}`;
  return headers;
}
