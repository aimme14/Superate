import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Pencil, BookOpen, Zap, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import { dbService } from "@/services/firebase/db.service";
import { GRADE_CODE_TO_NAME } from "@/utils/subjects.config";
import { prefetchSimulacrosIA } from "@/utils/simulacrosIAPrefetch";
import { DEFAULT_GRADE_RUTA_PREPARACION } from "@/utils/rutaPreparacionPrefetch";

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
 * El grado se resuelve en segundo plano; la UI y el prefetch en hover no esperan (usan grado por defecto).
 */
export function RutaPreparacionSubNav({ theme = "light" }: RutaPreparacionSubNavProps) {
  const { pathname } = useLocation();
  const { user } = useAuthContext();
  const gradeRef = useRef<string>(DEFAULT_GRADE_RUTA_PREPARACION);

  // Carga del grado en segundo plano: no bloquea render ni hover. Al actualizar el ref,
  // se dispara un prefetch con el grado real por si difiere del por defecto.
  useEffect(() => {
    if (!user?.uid) return;
    dbService.getUserById(user.uid).then((res) => {
      if (!res.success || !res.data) return;
      const data = res.data as { grade?: string; gradeId?: string; gradeName?: string };
      const raw = data.gradeName || data.grade || data.gradeId;
      if (!raw) return;
      const s = String(raw).trim();
      let newGrade: string;
      if (GRADE_CODE_TO_NAME[s]) {
        newGrade = s === "1" ? "11" : s === "0" ? "10" : s;
      } else if (s.toLowerCase().includes("undécimo") || s.toLowerCase().includes("undecimo")) {
        newGrade = "11";
      } else if (s.toLowerCase().includes("décimo") || s.toLowerCase().includes("decimo")) {
        newGrade = "10";
      } else {
        newGrade = s;
      }
      const previousGrade = gradeRef.current;
      gradeRef.current = newGrade;
      if (previousGrade !== newGrade) {
        prefetchSimulacrosIA(newGrade, "all");
      }
    });
  }, [user?.uid]);

  // Hover nunca espera al grado: usa ref (por defecto "11" hasta que getUserById resuelva).
  const handleSimulacrosIAHover = () => {
    prefetchSimulacrosIA(gradeRef.current, "all");
  };
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
        "flex gap-2 mb-6 p-1 rounded-lg",
        theme === "dark" ? "bg-zinc-800/50" : "bg-gray-100"
      )}
    >
      <Link
        to={RUTA_ACADEMICA_PATH}
        className={buttonClass(isRutaAcademicaActive)}
        aria-current={isRutaAcademicaActive ? "page" : undefined}
      >
        <Pencil className="w-5 h-5 flex-shrink-0" aria-hidden />
        Ruta Académica Simulacros
      </Link>
      <Link
        to={PLAN_ESTUDIO_IA_PATH}
        className={buttonClass(isPlanEstudioActive)}
        aria-current={isPlanEstudioActive ? "page" : undefined}
      >
        <BookOpen className="w-5 h-5 flex-shrink-0" aria-hidden />
        Plan de estudio IA
      </Link>
      <Link
        to={SIMULACROS_IA_PATH}
        className={buttonClass(isSimulacrosIAActive)}
        aria-current={isSimulacrosIAActive ? "page" : undefined}
        onMouseEnter={handleSimulacrosIAHover}
      >
        <Zap className="w-5 h-5 flex-shrink-0" aria-hidden />
        Simulacros IA
      </Link>
      <Link
        to={SIMULACROS_ICFES_PATH}
        className={buttonClass(isSimulacrosICFESActive)}
        aria-current={isSimulacrosICFESActive ? "page" : undefined}
      >
        <FileCheck className="w-5 h-5 flex-shrink-0" aria-hidden />
        Simulacros ICFES
      </Link>
    </div>
  );
}
