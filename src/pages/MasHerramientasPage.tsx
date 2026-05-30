import { ExternalLink, Trophy, BookOpen, Gamepad2, ArrowUpRight, Star, Zap } from "lucide-react";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";
import { Badge } from "@/components/ui/badge";

interface Herramienta {
  id: string;
  nombre: string;
  tagline: string;
  descripcion: string;
  url: string;
  etiquetas: string[];
  destacado?: boolean;
  icono: React.ElementType;
  colorClass: string;
  darkColorClass: string;
}

const HERRAMIENTAS: Herramienta[] = [
  {
    id: "puntaje-nacional",
    nombre: "Puntaje Nacional",
    tagline: "El preuniversitario online más grande de Colombia",
    descripcion:
      "Plataforma gratuita con simulacros completos Saber 11. Regístrate en segundos y accede a mini simulacros personalizables por área, planes de estudio y clases en vivo. Más de 40.000 estudiantes la usan cada año para prepararse con la misma estructura del examen real.",
    url: "https://www.puntajenacional.co/alumnos/landing",
    etiquetas: ["Simulacros completos", "Clases en vivo", "Gratis"],
    destacado: true,
    icono: Trophy,
    colorClass: "from-amber-500 to-orange-500",
    darkColorClass: "from-amber-600 to-orange-600",
  },
  {
    id: "preicfes-net",
    nombre: "PreICFES.net",
    tagline: "Simulacros ilimitados con respuestas inmediatas",
    descripcion:
      "Plataforma gratuita diseñada exclusivamente para la Prueba Saber 11. Regístrate en segundos y accede a simulacros con preguntas aleatorias en cada área evaluada. Al terminar ves tus respuestas correctas y conoces tu nivel de preparación al instante.",
    url: "https://preicfes.net/",
    etiquetas: ["Sin límites", "Respuestas inmediatas", "Por área"],
    icono: BookOpen,
    colorClass: "from-blue-500 to-cyan-500",
    darkColorClass: "from-blue-600 to-cyan-600",
  },
  {
    id: "educaplay",
    nombre: "Educaplay — Simulacro ICFES",
    tagline: "Aprende jugando con preguntas tipo Saber 11",
    descripcion:
      "Simulacro interactivo tipo ICFES dentro de Educaplay, la plataforma de aprendizaje gamificado. Responde preguntas de selección múltiple en formato lúdico, compite con otros estudiantes en el ranking y refuerza tus conocimientos de manera diferente y entretenida.",
    url: "https://es.educaplay.com/recursos-educativos/956106-simulacro_tipo_icfes.html",
    etiquetas: ["Gamificado", "Ranking", "Interactivo"],
    icono: Gamepad2,
    colorClass: "from-purple-500 to-fuchsia-500",
    darkColorClass: "from-purple-600 to-fuchsia-600",
  },
];

export default function MasHerramientasPage() {
  const { theme } = useThemeContext();
  const dark = theme === "dark";

  return (
    <div className={cn("min-h-screen", dark ? "bg-zinc-900" : "bg-gray-50")}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <RutaPreparacionSubNav theme={theme} />

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <Zap className={cn("h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0", dark ? "text-purple-400" : "text-purple-600")} />
            <h1 className={cn("text-[15px] sm:text-[23px] font-bold break-words", dark ? "text-white" : "text-gray-900")}>
              Más Herramientas para el ICFES
            </h1>
          </div>
          <p className={cn("text-sm sm:text-base", dark ? "text-gray-400" : "text-gray-600")}>
            Recursos externos seleccionados para complementar tu preparación para el Saber 11.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {HERRAMIENTAS.map((h) => (
            <HerramientaCard key={h.id} herramienta={h} dark={dark} />
          ))}
        </div>

        <div className={cn("mt-8 rounded-xl border p-4 flex items-start gap-3", dark ? "border-zinc-700 bg-zinc-800/50" : "border-gray-200 bg-white/70")}>
          <Star className={cn("h-5 w-5 flex-shrink-0 mt-0.5", dark ? "text-amber-400" : "text-amber-500")} />
          <p className={cn("text-sm leading-relaxed", dark ? "text-gray-400" : "text-gray-600")}>
            Estas plataformas son <strong>externas y gratuitas</strong>. Al hacer clic serás redirigido a cada sitio.
            Úsalas como complemento a tu plan de estudio en Supérate para maximizar tu puntaje en el Saber 11.
          </p>
        </div>
      </div>
    </div>
  );
}

function HerramientaCard({ herramienta: h, dark }: { herramienta: Herramienta; dark: boolean }) {
  const Icon = h.icono;
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative flex flex-col rounded-xl border transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-lg",
        dark
          ? "border-zinc-700 bg-zinc-800/80 hover:border-zinc-600 hover:shadow-zinc-900/50"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-gray-200/80"
      )}
    >
      {h.destacado && (
        <div className="absolute -top-2.5 left-4">
          <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0.5 shadow-sm">
            ⭐ Más popular
          </Badge>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm", dark ? h.darkColorClass : h.colorClass)}>
              <Icon className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className={cn("font-bold text-base leading-tight", dark ? "text-white" : "text-gray-900")}>{h.nombre}</h2>
              <p className={cn("text-xs mt-0.5 leading-snug", dark ? "text-purple-400" : "text-purple-600")}>{h.tagline}</p>
            </div>
          </div>
          <ArrowUpRight className={cn("h-4 w-4 flex-shrink-0 mt-1 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5", dark ? "text-zinc-500 group-hover:text-zinc-300" : "text-gray-400 group-hover:text-gray-600")} />
        </div>
        <p className={cn("text-sm leading-relaxed flex-1", dark ? "text-gray-300" : "text-gray-600")}>{h.descripcion}</p>
        <div className="flex flex-wrap gap-1.5">
          {h.etiquetas.map((tag) => (
            <span key={tag} className={cn("inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border", dark ? "border-zinc-600 bg-zinc-700/60 text-zinc-300" : "border-gray-200 bg-gray-100 text-gray-600")}>
              {tag}
            </span>
          ))}
        </div>
        <div className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold bg-gradient-to-r text-white", dark ? h.darkColorClass : h.colorClass)}>
          <ExternalLink className="h-4 w-4" />
          Ir a la plataforma
        </div>
      </div>
    </a>
  );
}
