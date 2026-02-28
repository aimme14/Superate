/**
 * Utilidad de logging configurable.
 * En producción solo se muestran errores; en desarrollo se muestran todos los niveles.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Solo en desarrollo */
  debug: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  },

  /** Solo en desarrollo */
  log: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },

  /** Solo en desarrollo */
  info: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },

  /** Solo en desarrollo */
  warn: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  },

  /** Siempre (errores críticos para depuración en producción) */
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};
