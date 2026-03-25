import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ContactRound,
  NotepadText,
  BarChart2,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { STUDENT_HOME, isStudentHomePath } from "@/constants/routes";
import { useAuthContext } from "@/context/AuthContext";
import { fetchEvaluations } from "@/hooks/query/useStudentEvaluations";
import { ESTUDIANTE_SESSION_CACHE } from "@/config/rutaPreparacionCache";
import {
  prefetchResultados,
  prefetchPromedio,
  prefetchInformacion,
  prefetchRutaAcademica,
  prefetchPlanEstudioIA,
  prefetchSimulacrosIA,
  prefetchSimulacrosICFES,
} from "@/utils/prefetchChunks";
import {
  DEFAULT_GRADE_RUTA_PREPARACION,
  runRutaPreparacionPrefetch,
} from "@/utils/rutaPreparacionPrefetch";

const RUTA_ACADEMICA_PATH = "/ruta-academica-adaptativa";
const PLAN_ESTUDIO_PATH = "/plan-estudio-ia";

type QuickItem = {
  to: string;
  label: string;
  icon: typeof Sparkles;
  isActive: (pathname: string) => boolean;
  onPrefetch?: () => void;
};

function buildQuickItems(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined
): QuickItem[] {
  return [
    {
      to: STUDENT_HOME,
      label: "Inicio",
      icon: Sparkles,
      isActive: (p) => isStudentHomePath(p),
    },
    {
      to: "/informacionPage",
      label: "Información del estudiante",
      icon: ContactRound,
      isActive: (p) => p === "/informacionPage",
      onPrefetch: () => prefetchInformacion(),
    },
    {
      to: "/resultados",
      label: "Resultados",
      icon: NotepadText,
      isActive: (p) => p === "/resultados",
      onPrefetch: () => {
        prefetchResultados();
        if (userId) {
          void queryClient.prefetchQuery({
            queryKey: ["student-evaluations", userId],
            queryFn: () => fetchEvaluations(userId),
            ...ESTUDIANTE_SESSION_CACHE,
          });
        }
      },
    },
    {
      to: "/promedio",
      label: "Desempeño",
      icon: BarChart2,
      isActive: (p) => p === "/promedio",
      onPrefetch: () => prefetchPromedio(),
    },
    {
      to: RUTA_ACADEMICA_PATH,
      label: "Ruta",
      icon: Route,
      isActive: (p) =>
        p === RUTA_ACADEMICA_PATH ||
        p === PLAN_ESTUDIO_PATH ||
        p === "/simulacros-ia" ||
        p === "/simulacros-icfes",
      onPrefetch: () => {
        prefetchRutaAcademica();
        prefetchPlanEstudioIA();
        prefetchSimulacrosIA();
        prefetchSimulacrosICFES();
        runRutaPreparacionPrefetch(queryClient, {
          grade: DEFAULT_GRADE_RUTA_PREPARACION,
        });
      },
    },
  ];
}

interface StudentMobileQuickNavProps {
  theme: "light" | "dark";
}

/**
 * Barra inferior fija (solo móvil) con acceso rápido a las secciones principales del estudiante.
 * Estilo alineado con docente/rector: pill flotante con iconos.
 */
export function StudentMobileQuickNav({ theme }: StudentMobileQuickNavProps) {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const items = buildQuickItems(queryClient, user?.uid);

  if (!isMobile) return null;

  return (
    <div
      className="fixed left-1/2 z-30 -translate-x-1/2"
      style={{
        bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        className={cn(
          "flex max-w-[calc(100vw-1rem)] items-center gap-3.5 rounded-2xl border px-4 py-2.5 shadow-xl backdrop-blur",
          theme === "dark"
            ? "border-zinc-700 bg-zinc-900/90"
            : "border-gray-300 bg-white/90"
        )}
        role="navigation"
        aria-label="Acceso rápido"
      >
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Button
              key={item.to}
              asChild
              type="button"
              size="icon"
              variant="ghost"
              aria-label={item.label}
              title={item.label}
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl",
                active
                  ? theme === "dark"
                    ? "bg-blue-600/30 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                  : theme === "dark"
                    ? "text-zinc-200 hover:bg-zinc-800"
                    : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Link
                to={item.to}
                onPointerEnter={() => item.onPrefetch?.()}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
