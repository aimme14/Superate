import { Outlet } from "react-router-dom";
import { useThemeContext } from "@/context/ThemeContext";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { StudentNav } from "@/components/student/StudentNav";
import { StudentMobileQuickNav } from "@/components/student/StudentMobileQuickNav";
import { cn } from "@/lib/utils";

/**
 * Layout persistente para rutas del estudiante (Resultados, Desempeño, Ruta de preparación, etc.).
 * Renderiza una sola vez el encabezado (logo + institución + StudentNav) y el contenido via Outlet.
 * Evita que el header se remonte al cambiar de sección.
 */
export default function StudentLayout() {
  const { theme } = useThemeContext();
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const themeSafe = theme ?? "light";

  return (
    <div
      className={cn("min-h-screen", themeSafe === "dark" ? "bg-zinc-900" : "bg-gray-50")}
    >
      <header
        className={cn(
          "shadow-sm sticky top-0 z-10",
          themeSafe === "dark" ? "bg-zinc-800 border-b border-zinc-700" : "bg-white"
        )}
      >
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center min-w-0 overflow-hidden">
            <img
              src={institutionLogo}
              width={80}
              height={80}
              alt={`Logo de ${institutionName}`}
              className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 mr-2 shrink-0 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/assets/agustina.png";
              }}
            />
            <span
              className={cn(
                "font-bold text-sm sm:text-base lg:text-xl xl:text-2xl truncate",
                themeSafe === "dark" ? "text-red-400" : "text-red-600"
              )}
            >
              {isLoadingInstitution ? "Cargando..." : institutionName}
            </span>
          </div>
          <div className="shrink-0">
            <StudentNav theme={themeSafe} />
          </div>
        </div>
      </header>
      <Outlet />
      <StudentMobileQuickNav theme={themeSafe} />
    </div>
  );
}
