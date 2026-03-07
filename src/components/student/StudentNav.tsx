import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ContactRound,
  NotepadText,
  BarChart2,
  BookOpen,
  Menu,
  Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavRutaPreparacionDropdown } from "./NavRutaPreparacionDropdown";
import { prefetchResultados, prefetchPromedio } from "@/utils/prefetchChunks";
import {
  scheduleRutaPreparacionPrefetch,
  DEFAULT_GRADE_RUTA_PREPARACION,
  runRutaPreparacionPrefetch,
} from "@/utils/rutaPreparacionPrefetch";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/context/AuthContext";
import { STUDENT_HOME, isStudentHomePath } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const RUTA_ACADEMICA_PATH = "/ruta-academica-adaptativa";
const PLAN_ESTUDIO_PATH = "/plan-estudio-ia";

interface NavItemConfig {
  href: string;
  icon: React.ReactNode;
  text: string;
  onPrefetch?: () => void;
}

interface StudentNavProps {
  theme?: "light" | "dark";
  /** Items adicionales a inyectar (ej: "Mi progreso" en ExamAnalyzer) */
  extraItems?: Array<{ href: string; icon: React.ReactNode; text: string; active?: boolean }>;
}

function NavItem({
  href,
  icon,
  text,
  active,
  theme,
  onPrefetch,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
  active: boolean;
  theme: "light" | "dark";
  onPrefetch?: () => void;
}) {
  return (
    <Link
      to={href}
      onMouseEnter={onPrefetch}
      className={cn(
        "flex items-center",
        active
          ? theme === "dark"
            ? "text-red-400 font-medium"
            : "text-red-600 font-medium"
          : theme === "dark"
            ? "text-gray-400 hover:text-gray-200"
            : "text-gray-600 hover:text-gray-900"
      )}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}

/**
 * Navegación compartida para páginas del estudiante.
 * Incluye prefetch de chunks y datos en hover para navegación más rápida.
 */
export function StudentNav({ theme = "light", extraItems = [] }: StudentNavProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  // Prefetch temprano de Ruta de preparación: se programa tras carga del dashboard (idle/delay).
  // Solo se ejecuta una vez por sesión; no compite con la carga inicial.
  useEffect(() => {
    if (!user?.uid) return;
    const cancel = scheduleRutaPreparacionPrefetch(queryClient, {
      grade: DEFAULT_GRADE_RUTA_PREPARACION,
      userId: user.uid,
    });
    return cancel;
  }, [queryClient, user?.uid]);

  const isActive = (href: string, isRutaArea?: boolean) => {
    if (href === STUDENT_HOME) return isStudentHomePath(pathname);
    if (isRutaArea) {
      return pathname === RUTA_ACADEMICA_PATH || pathname === PLAN_ESTUDIO_PATH || pathname === "/simulacros-ia" || pathname === "/simulacros-icfes";
    }
    if (href.includes("#")) {
      const [base] = href.split("#");
      return pathname === base || isStudentHomePath(pathname);
    }
    return pathname === href;
  };

  const standardItems: NavItemConfig[] = [
    {
      href: STUDENT_HOME,
      icon: <Home className="w-5 h-5" />,
      text: "Inicio",
    },
    {
      href: "/informacionPage",
      icon: <ContactRound />,
      text: "Información del estudiante",
    },
    {
      href: "/resultados",
      icon: <NotepadText className="w-5 h-5" />,
      text: "Resultados",
      onPrefetch: () => {
        prefetchResultados();
        if (user?.uid) {
          void queryClient.prefetchQuery({
            queryKey: ["student-evaluations", user.uid],
          });
        }
      },
    },
  ];

  const itemsAfterResultados: NavItemConfig[] = [
    {
      href: "/promedio",
      icon: <BarChart2 className="w-5 h-5" />,
      text: "Desempeño",
      onPrefetch: () => {
        prefetchPromedio();
      },
    },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg text-left w-full transition-colors",
      active
        ? theme === "dark"
          ? "bg-zinc-700 text-red-400 font-medium"
          : "bg-purple-100 text-purple-700 font-medium"
        : theme === "dark"
          ? "text-gray-200 hover:bg-zinc-800"
          : "text-gray-700 hover:bg-gray-100"
    );

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Desktop: oculto en móvil */}
      <nav className="hidden md:flex items-center space-x-8" aria-label="Navegación principal">
        {standardItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            text={item.text}
            active={isActive(item.href)}
            theme={theme}
            onPrefetch={item.onPrefetch}
          />
        ))}
        {extraItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            text={item.text}
            active={item.active ?? isActive(item.href)}
            theme={theme}
          />
        ))}
        {itemsAfterResultados.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            text={item.text}
            active={isActive(item.href)}
            theme={theme}
            onPrefetch={item.onPrefetch}
          />
        ))}
        <NavRutaPreparacionDropdown
          theme={theme}
          onPrefetch={() => {
            runRutaPreparacionPrefetch(queryClient, {
              grade: DEFAULT_GRADE_RUTA_PREPARACION,
            });
          }}
        />
        <NavItem
          href="/dashboard#evaluacion"
          icon={<BookOpen className="w-5 h-5" />}
          text="Presentar prueba"
          active={pathname === "/dashboard"}
          theme={theme}
        />
      </nav>

      {/* Móvil: menú hamburguesa */}
      <div className="flex md:hidden items-center">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú de navegación"
              className={cn(
                theme === "dark" ? "text-gray-300 hover:bg-zinc-800 hover:text-white" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={cn(
              "w-[min(100vw-2rem,320px)] flex flex-col",
              theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white"
            )}
          >
            <SheetHeader>
              <SheetTitle className={cn(theme === "dark" ? "text-white" : "text-gray-900")}>
                Menú
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-6" aria-label="Navegación móvil">
              {standardItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={mobileLinkClass(isActive(item.href))}
                  onClick={closeMobile}
                >
                  {item.icon}
                  <span>{item.text}</span>
                </Link>
              ))}
              {extraItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={mobileLinkClass(item.active ?? isActive(item.href))}
                  onClick={closeMobile}
                >
                  {item.icon}
                  <span>{item.text}</span>
                </Link>
              ))}
              {itemsAfterResultados.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={mobileLinkClass(isActive(item.href))}
                  onClick={closeMobile}
                >
                  {item.icon}
                  <span>{item.text}</span>
                </Link>
              ))}
              <Link
                to={RUTA_ACADEMICA_PATH}
                className={mobileLinkClass(
                  pathname === RUTA_ACADEMICA_PATH ||
                    pathname === PLAN_ESTUDIO_PATH ||
                    pathname === "/simulacros-ia" ||
                    pathname === "/simulacros-icfes"
                )}
                onClick={() => {
                  runRutaPreparacionPrefetch(queryClient, { grade: DEFAULT_GRADE_RUTA_PREPARACION });
                  closeMobile();
                }}
              >
                <Route className="w-5 h-5" />
                <span>Ruta de preparación</span>
              </Link>
              <Link
                to="/dashboard#evaluacion"
                className={mobileLinkClass(pathname === "/dashboard")}
                onClick={closeMobile}
              >
                <BookOpen className="w-5 h-5" />
                <span>Presentar prueba</span>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
