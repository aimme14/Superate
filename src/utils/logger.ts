/**
 * Utilidad de logging configurable.
 * En producción: solo errores, y estos pasan por el sanitizador (productionErrorHandler).
 * En desarrollo: todos los niveles sin sanitizar.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Solo en desarrollo */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /** Solo en desarrollo */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /** Solo en desarrollo */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /** Solo en desarrollo */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /** Siempre (errores críticos para depuración en producción) */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
