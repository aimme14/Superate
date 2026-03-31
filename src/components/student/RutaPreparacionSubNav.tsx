import { Link, useLocation } from "react-router-dom";
import { Pencil, BookOpen, Zap, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const RUTA_ACADEMICA_PATH = "/ruta-academica-adaptativa";
const PLAN_ESTUDIO_IA_PATH = "/plan-estudio-ia";
const SIMULACROS_IA_PATH = "/simulacros-ia";
const SIMULACROS_ICFES_PATH = "/simulacros-icfes";

interface RutaPreparacionSubNavProps {
  theme?: "light" | "dark";
}

/**
 * Sub-navegación dentro de la sección Ruta de preparación.
 * Botones para alternar entre Ruta Académica Simulacros, Plan de estudio IA, Simulacros IA y Simulacros ICFES.
 */
export function RutaPreparacionSubNav({ theme = "light" }: RutaPreparacionSubNavProps) {
  const { pathname } = useLocation();

  const isRutaAcademicaActive = pathname === RUTA_ACADEMICA_PATH;
  const isPlanEstudioActive = pathname === PLAN_ESTUDIO_IA_PATH;
  const isSimulacrosIAActive = pathname === SIMULACROS_IA_PATH;
  const isSimulacrosICFESActive = pathname === SIMULACROS_ICFES_PATH;

  const buttonClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
      active
        ? theme === "dark"
          ? "bg-zinc-700 text-white"
          : "bg-purple-100 text-purple-700"
        : theme === "dark"
          ? "text-gray-400 hover:bg-zinc-800 hover:text-gray-200"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    );

  return (
    <div
      className={cn(
        "flex flex-row flex-nowrap sm:flex-wrap gap-2 mb-4 sm:mb-6 p-2 sm:p-1 rounded-lg",
        theme === "dark" ? "bg-zinc-800/50" : "bg-gray-100"
      )}
    >
      <Link
        to={RUTA_ACADEMICA_PATH}
        className={cn(buttonClass(isRutaAcademicaActive), "flex-1 sm:flex-none min-h-[44px] sm:min-h-0 justify-center sm:justify-start")}
        aria-current={isRutaAcademicaActive ? "page" : undefined}
        aria-label="Ruta Académica Simulacros"
      >
        <Pencil className="w-5 h-5 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">Ruta Académica Simulacros</span>
      </Link>
      <Link
        to={PLAN_ESTUDIO_IA_PATH}
        className={cn(buttonClass(isPlanEstudioActive), "flex-1 sm:flex-none min-h-[44px] sm:min-h-0 justify-center sm:justify-start")}
        aria-current={isPlanEstudioActive ? "page" : undefined}
        aria-label="Plan de estudio IA"
      >
        <BookOpen className="w-5 h-5 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">Plan de estudio IA</span>
      </Link>
      <Link
        to={SIMULACROS_IA_PATH}
        className={cn(buttonClass(isSimulacrosIAActive), "flex-1 sm:flex-none min-h-[44px] sm:min-h-0 justify-center sm:justify-start")}
        aria-current={isSimulacrosIAActive ? "page" : undefined}
        aria-label="Simulacros IA"
      >
        <Zap className="w-5 h-5 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">Simulacros IA</span>
      </Link>
      <Link
        to={SIMULACROS_ICFES_PATH}
        className={cn(buttonClass(isSimulacrosICFESActive), "flex-1 sm:flex-none min-h-[44px] sm:min-h-0 justify-center sm:justify-start")}
        aria-current={isSimulacrosICFESActive ? "page" : undefined}
        aria-label="Simulacros ICFES"
      >
        <FileCheck className="w-5 h-5 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">Simulacros ICFES</span>
      </Link>
    </div>
  );
}
