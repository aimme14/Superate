/**
 * Prefetch de chunks de páginas lazy para navegación más rápida.
 * Llamar en onMouseEnter de los links para cargar el código antes del click.
 */

export function prefetchResultados(): void {
  void import("@/pages/resultados");
}

export function prefetchPromedio(): void {
  void import("@/pages/promedio");
}
