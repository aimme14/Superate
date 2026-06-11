/** Ocultar temporalmente la sección Ruta Académica Simulacros. Cambiar a `true` para restaurarla. */
export const SHOW_RUTA_ACADEMICA_SIMULACROS = true;

export const RUTA_PREPARACION_ENTRY_PATH = SHOW_RUTA_ACADEMICA_SIMULACROS
  ? "/ruta-academica-adaptativa"
  : "/plan-estudio-ia";
