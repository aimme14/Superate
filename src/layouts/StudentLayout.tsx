import { Outlet } from "react-router-dom";
import { useThemeContext } from "@/context/ThemeContext";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { StudentNav } from "@/components/student/StudentNav";
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
    <div className={cn("min-h-screen", themeSafe === "dark" ? "bg-zinc-900" : "bg-gray-50")}>
      <header
        className={cn(
          "shadow-sm sticky top-0 z-10",
          themeSafe === "dark" ? "bg-zinc-800 border-b border-zinc-700" : "bg-white"
        )}
      >
        <div className="container mx-auto px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center min-w-0 flex-1">
            <img
              src={institutionLogo}
              width={80}
              height={80}
              alt={`Logo de ${institutionName}`}
              className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 mr-2 flex-shrink-0 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/assets/agustina.png";
              }}
            />
            <span
              className={cn(
                "font-bold text-[0.79rem] md:text-xl lg:text-2xl truncate",
                themeSafe === "dark" ? "text-red-400" : "text-red-600"
              )}
            >
              {isLoadingInstitution ? "Cargando..." : institutionName}
            </span>
          </div>
          <StudentNav theme={themeSafe} />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
