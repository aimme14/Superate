import { Link } from "react-router-dom";
import { Route, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavRutaPreparacionDropdownProps {
  theme?: "light" | "dark";
}

/**
 * Botón "Ruta de preparación" con menú desplegable.
 * Incluye la opción "Ruta Académica adaptativa".
 */
export function NavRutaPreparacionDropdown({ theme = "light" }: NavRutaPreparacionDropdownProps) {
  const triggerClass = cn(
    "flex items-center gap-2 outline-none",
    theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-haspopup="menu" aria-expanded="false">
          <Route className="w-5 h-5 flex-shrink-0" />
          <span>Ruta de preparación</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          theme === "dark"
            ? "bg-zinc-800 border-zinc-600 text-gray-200"
            : "bg-white border-gray-200"
        )}
      >
        <DropdownMenuItem asChild>
          <Link
            to="/ruta-academica-adaptativa"
            className={cn(
              "flex items-center cursor-pointer",
              theme === "dark" ? "focus:bg-zinc-700 focus:text-white" : ""
            )}
          >
            Ruta Académica adaptativa
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
