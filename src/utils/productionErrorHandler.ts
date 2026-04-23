/**
 * Sanitiza los errores en producción para no exponer información sensible
 * (API keys, stack traces, credenciales, etc.) en la consola del navegador.
 *
 * Se aplica un override global de console.error al inicio de la aplicación.
 */

const isProd = import.meta.env.PROD;
const CHUNK_RELOAD_KEY = "superate_chunk_reload_once";

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

  const shouldRecoverChunkError = (value: unknown): boolean => {
    const text = value instanceof Error ? value.message : String(value ?? "");
    const normalized = text.toLowerCase();
    return (
      normalized.includes("chunkloaderror") ||
      normalized.includes("loading chunk") ||
      normalized.includes("failed to fetch dynamically imported module") ||
      normalized.includes("importing a module script failed")
    );
  };

  const trySingleChunkRecoveryReload = (): boolean => {
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return false;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  };

  const renderFatalFallback = (): void => {
    const root = document.getElementById("root");
    if (!root) return;
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070d;color:#e4e4e7;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
        <div style="max-width:560px;width:100%;text-align:center;background:#111827;border:1px solid #27272a;border-radius:12px;padding:24px">
          <h1 style="margin:0 0 10px;font-size:22px;color:#fff">No se pudo cargar la aplicación</h1>
          <p style="margin:0 0 18px;line-height:1.45;color:#cbd5e1">Ocurrió un problema al iniciar Supérate.IA. Intenta recargar para continuar.</p>
          <button id="superate-reload-btn" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer">Recargar</button>
        </div>
      </div>
    `;
    const btn = document.getElementById("superate-reload-btn");
    btn?.addEventListener("click", () => window.location.reload());
  };

  window.addEventListener("error", (event) => {
    if (shouldRecoverChunkError(event.error ?? event.message)) {
      if (trySingleChunkRecoveryReload()) return;
      renderFatalFallback();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (shouldRecoverChunkError(event.reason)) {
      event.preventDefault();
      if (trySingleChunkRecoveryReload()) return;
      renderFatalFallback();
    }
  });
}
