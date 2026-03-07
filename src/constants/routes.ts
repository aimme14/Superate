/**
 * Rutas centralizadas para la app.
 * Una sola ruta "home" para el estudiante: /dashboard.
 */

/** Ruta única de inicio para el estudiante (dashboard con módulos). */
export const STUDENT_HOME = "/dashboard";

/** Rutas que se consideran "inicio" para marcar el ítem activo (legacy + canonical). */
export const STUDENT_HOME_ALIASES: string[] = [STUDENT_HOME, "/new-dashboard"];

/** Rutas donde se muestra StudentNav (menú propio del estudiante). En móvil no se muestra el SidebarTrigger del Navbar para evitar dos menús. */
export const ROUTES_WITH_STUDENT_NAV: string[] = [
  STUDENT_HOME,
  "/new-dashboard",
  "/informacionPage",
  "/resultados",
  "/promedio",
  "/ruta-academica-adaptativa",
  "/plan-estudio-ia",
  "/simulacros-ia",
  "/simulacros-icfes",
];

export function isStudentHomePath(pathname: string): boolean {
  return STUDENT_HOME_ALIASES.includes(pathname);
}

export function hasStudentNav(pathname: string): boolean {
  return ROUTES_WITH_STUDENT_NAV.includes(pathname);
}
