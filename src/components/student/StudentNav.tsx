import { Link, useLocation } from "react-router-dom";
import {
  ContactRound,
  NotepadText,
  BarChart2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavRutaPreparacionDropdown } from "./NavRutaPreparacionDropdown";
import { prefetchResultados, prefetchPromedio } from "@/utils/prefetchChunks";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/context/AuthContext";

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

  const isActive = (href: string, isRutaArea?: boolean) => {
    if (isRutaArea) {
      return pathname === RUTA_ACADEMICA_PATH || pathname === PLAN_ESTUDIO_PATH || pathname === "/simulacros-ia";
    }
    if (href.includes("#")) {
      const [base] = href.split("#");
      return pathname === base || pathname === "/new-dashboard";
    }
    return pathname === href;
  };

  const standardItems: NavItemConfig[] = [
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

  return (
    <nav className="hidden md:flex items-center space-x-8">
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
          void queryClient.prefetchQuery({ queryKey: ["simulacros", "with-videos"] });
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
  );
}
