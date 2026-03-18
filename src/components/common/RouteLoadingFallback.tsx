import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fallback dentro del área principal (navbar/layout visible).
 * Mejora la percepción de fluidez frente a un spinner a pantalla completa.
 */
export function PageRouteFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col items-center justify-center min-h-[50vh] px-4 py-8",
        className
      )}
      aria-busy="true"
      aria-label="Cargando contenido"
    >
      <div className="w-full max-w-lg space-y-4">
        <div className="h-9 w-2/3 max-w-xs rounded-lg bg-muted animate-pulse mx-auto" />
        <div className="h-3.5 w-full rounded-md bg-muted/80 animate-pulse" />
        <div className="h-3.5 w-11/12 rounded-md bg-muted/60 animate-pulse mx-auto" />
        <div className="h-32 w-full rounded-xl bg-muted/50 animate-pulse" />
        <div className="flex justify-center pt-2">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

/** Contenido bajo el header fijo del estudiante (mantiene cabecera visible). */
export function StudentOutletFallback() {
  return (
    <div
      className="container mx-auto px-3 py-6 md:px-4 md:py-8"
      aria-busy="true"
      aria-label="Cargando sección"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-10 rounded-lg bg-muted animate-pulse max-w-md" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border/50 bg-card/50 animate-pulse"
          />
        ))}
        <div className="flex justify-center pt-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

/** Rutas mínimas (ej. visor PDF en pestaña propia). */
export function MinimalRouteFallback() {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center bg-background"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

type LazyBoundaryVariant = "page" | "student" | "minimal";

function fallbackForVariant(variant: LazyBoundaryVariant): ReactNode {
  switch (variant) {
    case "student":
      return <StudentOutletFallback />;
    case "minimal":
      return <MinimalRouteFallback />;
    default:
      return <PageRouteFallback />;
  }
}

/**
 * Suspense local por ruta: el layout (Root/Student) permanece visible mientras carga el chunk.
 */
export function LazyRouteBoundary({
  children,
  variant = "page",
}: {
  children: ReactNode;
  variant?: LazyBoundaryVariant;
}) {
  return <Suspense fallback={fallbackForVariant(variant)}>{children}</Suspense>;
}
