import { Link, useLocation } from "react-router-dom";
import { Route, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const RUTA_ACADEMICA_PATH = "/ruta-academica-adaptativa";
const PLAN_ESTUDIO_IA_PATH = "/plan-estudio-ia";

interface RutaPreparacionSubNavProps {
  theme?: "light" | "dark";
}

/**
 * Sub-navegación dentro de la sección Ruta de preparación.
 * Dos botones para alternar entre Ruta Académica adaptativa y Plan de estudio IA.
 */
export function RutaPreparacionSubNav({ theme = "light" }: RutaPreparacionSubNavProps) {
  const { pathname } = useLocation();
  const isRutaAcademicaActive = pathname === RUTA_ACADEMICA_PATH;
  const isPlanEstudioActive = pathname === PLAN_ESTUDIO_IA_PATH;

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
        "flex gap-2 mb-6 p-1 rounded-lg",
        theme === "dark" ? "bg-zinc-800/50" : "bg-gray-100"
      )}
    >
      <Link
        to={RUTA_ACADEMICA_PATH}
        className={buttonClass(isRutaAcademicaActive)}
        aria-current={isRutaAcademicaActive ? "page" : undefined}
      >
        <Route className="w-5 h-5 flex-shrink-0" aria-hidden />
        Ruta Académica adaptativa
      </Link>
      <Link
        to={PLAN_ESTUDIO_IA_PATH}
        className={buttonClass(isPlanEstudioActive)}
        aria-current={isPlanEstudioActive ? "page" : undefined}
      >
        <BookOpen className="w-5 h-5 flex-shrink-0" aria-hidden />
        Plan de estudio IA
      </Link>
    </div>
  );
}
