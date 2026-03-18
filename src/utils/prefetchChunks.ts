/**
 * Prefetch de chunks (mismos módulos que React.lazy) para navegación más fluida.
 * Solo descarga JS en caché del navegador; no altera datos ni React Query.
 */

export function prefetchHome(): void {
  void import("@/pages/HomePage");
}

export function prefetchLogin(): void {
  void import("@/pages/LoginPage");
}

export function prefetchRegister(): void {
  void import("@/pages/RegisterPage");
}

export function prefetchAbout(): void {
  void import("@/sections/about/page");
}

export function prefetchDashboard(): void {
  void import("@/pages/dashboard");
}

export function prefetchQuiz(): void {
  void import("@/pages/Quiz");
}

export function prefetchInformacion(): void {
  void import("@/pages/informacion");
}

export function prefetchResultados(): void {
  void import("@/pages/resultados");
}

export function prefetchPromedio(): void {
  void import("@/pages/promedio");
}

export function prefetchRutaAcademica(): void {
  void import("@/pages/RutaAcademicaAdaptativaPage");
}

export function prefetchPlanEstudioIA(): void {
  void import("@/pages/PlanEstudioIAPage");
}

export function prefetchSimulacrosIA(): void {
  void import("@/pages/SimulacrosIAPage");
}

export function prefetchSimulacrosICFES(): void {
  void import("@/pages/SimulacrosICFESPage");
}

export function prefetchTeacherDashboard(): void {
  void import("@/pages/dashboard/teacher/TeacherDashboard");
}

export function prefetchPrincipalDashboard(): void {
  void import("@/pages/dashboard/principal/PrincipalDashboard");
}

export function prefetchRectorDashboard(): void {
  void import("@/pages/dashboard/rector/RectorDashboard");
}

export function prefetchAdminDashboard(): void {
  void import("@/pages/dashboard/admin/AdminDashboard");
}

export function prefetchNewDashboard(): void {
  void import("@/pages/dashboard/NewDashboard");
}

/** Prefetch según href del menú lateral (invitado o rutas conocidas). */
export function prefetchChunkForSidebarHref(href: string): void {
  switch (href) {
    case "/":
      prefetchHome();
      break;
    case "/auth/login":
      prefetchLogin();
      break;
    case "/auth/register":
      prefetchRegister();
      break;
    case "/about":
      prefetchAbout();
      break;
    case "/dashboard":
      prefetchDashboard();
      break;
    default:
      break;
  }
}

/** Panel + quiz: al acercarse a “Presentar prueba”. */
export function prefetchDashboardAndQuiz(): void {
  prefetchDashboard();
  prefetchQuiz();
}
