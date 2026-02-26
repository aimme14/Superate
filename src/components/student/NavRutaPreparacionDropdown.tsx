import { Link, useLocation } from "react-router-dom";
import { Route } from "lucide-react";
import { cn } from "@/lib/utils";

const RUTA_ACADEMICA_PATH = "/ruta-academica-adaptativa";
const PLAN_ESTUDIO_IA_PATH = "/plan-estudio-ia";
const SIMULACROS_IA_PATH = "/simulacros-ia";

interface NavRutaPreparacionDropdownProps {
  theme?: "light" | "dark";
}

/**
 * Enlace principal "Ruta de preparación" en la barra de navegación.
 * Lleva a la sección Ruta Académica Simulacros, donde aparecen
 * los botones internos (Ruta Académica Simulacros, Plan de estudio IA, Simulacros IA).
 */
export function NavRutaPreparacionDropdown({ theme = "light" }: NavRutaPreparacionDropdownProps) {
  const { pathname } = useLocation();
  const isActive =
    pathname === RUTA_ACADEMICA_PATH ||
    pathname === PLAN_ESTUDIO_IA_PATH ||
    pathname === SIMULACROS_IA_PATH;

  return (
    <Link
      to={RUTA_ACADEMICA_PATH}
      className={cn(
        "flex items-center",
        isActive
          ? theme === "dark"
            ? "text-red-400 font-medium"
            : "text-red-600 font-medium"
          : theme === "dark"
            ? "text-gray-400 hover:text-gray-200"
            : "text-gray-600 hover:text-gray-900"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Route className="w-5 h-5 flex-shrink-0 mr-2" aria-hidden />
      <span>Ruta de preparación</span>
    </Link>
  );
}
