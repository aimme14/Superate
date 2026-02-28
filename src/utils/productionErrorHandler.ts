/**
 * Sanitiza los errores en producción para no exponer información sensible
 * (API keys, stack traces, credenciales, etc.) en la consola del navegador.
 *
 * Se aplica un override global de console.error al inicio de la aplicación.
 */

const isProd = import.meta.env.PROD;

/** Patrones que indican información sensible (no exponer en producción) */
const SENSITIVE_PATTERNS = [
  /\bapi[\s_-]?key\b/i,
  /\bAPI[\s_]?KEY\b/,
  /\bkey\s+not\s+valid\b/i,
  /\binvalid\s+(api\s+)?key\b/i,
  /\bcredentials?\b/i,
  /\bsecret\b/i,
  /\bauth\s+failed\b/i,
  /\bfirestore\.googleapis/i,
  /\bgenerativelanguage\.googleapis/i,
  /\bstack\s*trace\b/i,
  /at\s+\S+\s+\(/i, // Stack trace pattern "at fn (file:line)"
  /\.[jt]sx?:\d+:\d+/i, // File paths with line numbers
  /API_KEY_INVALID|API_KEY/i,
];

function isSensitiveString(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeArg(arg: unknown): unknown {
  try {
    if (arg instanceof Error) {
      // No pasar el Error directamente: el navegador imprime stack trace y message
      return `[Error: ${arg.name}]`;
    }

    if (typeof arg === "string") {
      if (isSensitiveString(arg)) {
        return "[Error]";
      }
      return arg;
    }

    if (arg && typeof arg === "object") {
      // Objetos pueden contener mensajes sensibles anidados
      try {
        const str = JSON.stringify(arg);
        if (isSensitiveString(str)) {
          return "[Error]";
        }
      } catch {
        return "[Error]";
      }
    }

    return arg;
  } catch {
    return "[Error]";
  }
}

/**
 * Instala el override de console.error para producción.
 * Debe llamarse lo antes posible (primer import en main.tsx).
 */
export function installProductionErrorHandler(): void {
  if (!isProd) return;

  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    const sanitized = args.map(sanitizeArg);
    originalError("[Superate.IA]", ...sanitized);
  };
}
