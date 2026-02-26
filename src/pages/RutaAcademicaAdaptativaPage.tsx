import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ContactRound,
  NotepadText,
  BarChart2,
  BookOpen,
  FileText,
  FileCheck,
  Loader2,
  BookOpen as BookOpenIcon,
  Video,
  Calculator,
  FlaskConical,
  Globe,
  Languages,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import type { Simulacro } from "@/interfaces/simulacro.interface";
import { SIMULACRO_MATERIAS } from "@/interfaces/simulacro.interface";
import { NavRutaPreparacionDropdown } from "@/components/student/NavRutaPreparacionDropdown";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";

interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
  theme?: "light" | "dark";
}

function NavItem({
  href,
  icon,
  text,
  active = false,
  theme = "light",
}: NavItemProps) {
  return (
    <Link
      to={href}
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

function buildViewerUrl(simulacroId: string, tipo: string): string {
  return `/viewer/pdf?simulacroId=${encodeURIComponent(simulacroId)}&tipo=${tipo}`;
}

export default function RutaAcademicaAdaptativaPage() {
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();
  const [simulacros, setSimulacros] = useState<Simulacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMateria, setSelectedMateria] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    simulacrosService
      .getAllWithVideos()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setSimulacros(res.data);
        } else {
          setError(res.error?.message ?? "Error al cargar simulacros");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Error al cargar simulacros");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byMateria = useMemo(() => {
    const map = new Map<string, Simulacro[]>();
    for (const s of simulacros) {
      const key = s.materia || "otros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return map;
  }, [simulacros]);

  const orderedMaterias = useMemo(() => {
    const values = SIMULACRO_MATERIAS.map((m) => m.value) as readonly string[];
    const present = Array.from(byMateria.keys());
    const ordered = values.filter((v) => present.includes(v));
    const rest = present.filter((p) => !values.includes(p));
    return [...ordered, ...rest] as string[];
  }, [byMateria]);

  useEffect(() => {
    if (loading || error || orderedMaterias.length === 0) return;
    if (selectedMateria === null || !orderedMaterias.includes(selectedMateria)) {
      setSelectedMateria(orderedMaterias[0]);
    }
  }, [loading, error, orderedMaterias, selectedMateria]);

  const getMateriaLabel = (value: string) =>
    value === "icfes" ? "ICFES FILTRADOS" : (SIMULACRO_MATERIAS.find((m) => m.value === value)?.label ?? value);

  const getMateriaIcon = (value: string): LucideIcon => {
    const icons: Record<string, LucideIcon> = {
      matematicas: Calculator,
      "lectura-critica": BookOpen,
      "ciencias-naturales": FlaskConical,
      sociales: Globe,
      ingles: Languages,
      icfes: GraduationCap,
    };
    return (icons as Record<string, LucideIcon>)[value] ?? BookOpen;
  };

  const selectedList = selectedMateria ? (byMateria.get(selectedMateria) ?? []) : [];

  return (
    <div
      className={cn(
        "min-h-screen",
        theme === "dark" ? "bg-zinc-900" : "bg-gray-50"
      )}
    >
      <header
        className={cn(
          "shadow-sm",
          theme === "dark" ? "bg-zinc-800 border-b border-zinc-700" : "bg-white"
        )}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={institutionLogo}
              width="80"
              height="80"
              alt={`Logo de ${institutionName}`}
              className="mr-2"
              onError={(e) => {
                e.currentTarget.src = "/assets/agustina.png";
              }}
            />
            <span
              className={cn(
                "font-bold text-2xl",
                theme === "dark" ? "text-red-400" : "text-red-600"
              )}
            >
              {isLoadingInstitution ? "Cargando..." : institutionName}
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <NavItem
              href="/informacionPage"
              icon={<ContactRound />}
              text="Información del estudiante"
              theme={theme}
            />
            <NavItem
              href="/resultados"
              icon={<NotepadText className="w-5 h-5" />}
              text="Resultados"
              theme={theme}
            />
            <NavItem
              href="/promedio"
              icon={<BarChart2 className="w-5 h-5" />}
              text="Desempeño"
              theme={theme}
            />
            <NavRutaPreparacionDropdown theme={theme} />
            <NavItem
              href="/dashboard#evaluacion"
              icon={<BookOpen className="w-5 h-5" />}
              text="Presentar prueba"
              theme={theme}
            />
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <RutaPreparacionSubNav theme={theme} />
        <div className="mb-8">
          <h1
            className={cn(
              "text-3xl font-bold mb-2 flex items-center gap-3",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <BookOpen className="h-8 w-8 flex-shrink-0" />
            Ruta Académica Simulacros
          </h1>
          <p
            className={cn(
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}
          >
            Simulacros creados para brindar una preparación de alta calidad, alineados con la estructura evaluativa del ICFES, orientados a fortalecer competencias clave y maximizar la probabilidad de obtener puntajes altos en la prueba Saber 11°.
          </p>
        </div>

        {loading ? (
          <Card
            className={cn(
              theme === "dark" ? "bg-zinc-800 border-zinc-700" : ""
            )}
          >
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <Loader2
                className={cn(
                  "h-8 w-8 animate-spin",
                  theme === "dark" ? "text-purple-400" : "text-purple-600"
                )}
              />
              <span
                className={cn(
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                Cargando simulacros...
              </span>
            </CardContent>
          </Card>
        ) : error ? (
          <Card
            className={cn(
              theme === "dark" ? "bg-zinc-800 border-zinc-700" : ""
            )}
          >
            <CardContent className="py-8 text-center">
              <p
                className={cn(
                  theme === "dark" ? "text-red-400" : "text-red-600"
                )}
              >
                {error}
              </p>
            </CardContent>
          </Card>
        ) : simulacros.length === 0 ? (
          <Card
            className={cn(
              theme === "dark" ? "bg-zinc-800 border-zinc-700" : ""
            )}
          >
            <CardContent className="py-12 text-center">
              <BookOpenIcon
                className={cn(
                  "h-12 w-12 mx-auto mb-4",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}
              />
              <p
                className={cn(
                  "text-lg mb-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                )}
              >
                No hay simulacros disponibles en este momento
              </p>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}
              >
                Tu institución podrá publicar simulacros desde el panel de administración.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Botones de materias en fila horizontal */}
            <div
              className={cn(
                "flex flex-wrap gap-2 rounded-lg border p-2",
                theme === "dark"
                  ? "border-zinc-600 bg-zinc-800"
                  : "border-gray-200 bg-white"
              )}
            >
              {orderedMaterias.map((materiaKey) => {
                const label = getMateriaLabel(materiaKey);
                const isSelected = selectedMateria === materiaKey;
                const Icon = getMateriaIcon(materiaKey);
                return (
                  <button
                    key={materiaKey}
                    type="button"
                    onClick={() => setSelectedMateria(materiaKey)}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm whitespace-nowrap transition-colors",
                      theme === "dark"
                        ? isSelected
                          ? "bg-zinc-600 text-white"
                          : "text-gray-300 hover:bg-zinc-700 hover:text-white"
                        : isSelected
                          ? "bg-gray-200 text-gray-900"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Contenido expandido hacia abajo */}
            {selectedMateria && (
              <div
                className={cn(
                  "rounded-lg border overflow-hidden",
                  theme === "dark"
                    ? "border-zinc-600 bg-zinc-800 shadow-lg"
                    : "border-gray-200 bg-white"
                )}
              >
                <div
                  className={cn(
                    "px-4 py-4 border-b",
                    theme === "dark" ? "border-zinc-600" : "border-gray-200"
                  )}
                >
                  <h2
                    className={cn(
                      "font-semibold text-lg",
                      theme === "dark" ? "text-white" : "text-gray-900"
                    )}
                  >
                    {getMateriaLabel(selectedMateria)}
                  </h2>
                </div>
                <ul className="p-4 space-y-3">
                  {selectedList.map((sim) => (
                    <li
                      key={sim.id}
                      className={cn(
                        "rounded-lg border p-4",
                        theme === "dark"
                          ? "border-zinc-500/60 bg-zinc-700/50"
                          : "border-gray-200 bg-gray-50/80"
                      )}
                    >
                      {/* 1. Simulacro: título + documento PDF */}
                      <div>
                        <p
                          className={cn(
                            "font-medium",
                            theme === "dark" ? "text-white" : "text-gray-900"
                          )}
                        >
                          {sim.titulo}
                        </p>
                        <p
                          className={cn(
                            "text-sm mb-3",
                            theme === "dark" ? "text-gray-300" : "text-gray-500"
                          )}
                        >
                          {sim.grado}
                          {sim.comentario ? ` · ${sim.comentario}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {sim.materia === "icfes" && sim.icfes ? (
                            <>
                              {sim.icfes.seccion1DocumentoUrl && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    to={buildViewerUrl(sim.id, "icfes1doc")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "gap-1.5",
                                      theme === "dark" &&
                                        "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                    )}
                                  >
                                    <FileText className="h-4 w-4" />
                                    Sección 1 - Documento
                                  </Link>
                                </Button>
                              )}
                              {sim.icfes.seccion2DocumentoUrl && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    to={buildViewerUrl(sim.id, "icfes2doc")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "gap-1.5",
                                      theme === "dark" &&
                                        "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                    )}
                                  >
                                    <FileText className="h-4 w-4" />
                                    Sección 2 - Documento
                                  </Link>
                                </Button>
                              )}
                            </>
                          ) : (
                            sim.pdfSimulacroUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  to={buildViewerUrl(sim.id, "documento")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "gap-1.5",
                                    theme === "dark" &&
                                      "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                  )}
                                >
                                  <FileText className="h-4 w-4" />
                                  Documento PDF
                                </Link>
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {/* 2. Hoja de respuestas (sección propia) */}
                      {(sim.materia === "icfes"
                        ? (sim.icfes?.seccion1HojaUrl || sim.icfes?.seccion2HojaUrl)
                        : sim.pdfHojaRespuestasUrl) && (
                        <div
                          className={cn(
                            "mt-4 pt-3 border-t",
                            theme === "dark" ? "border-zinc-500/40" : "border-gray-200"
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm font-medium mb-2",
                              theme === "dark" ? "text-gray-300" : "text-gray-600"
                            )}
                          >
                            Hoja de respuestas
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sim.materia === "icfes" && sim.icfes ? (
                              <>
                                {sim.icfes.seccion1HojaUrl && (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link
                                      to={buildViewerUrl(sim.id, "icfes1hoja")}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "gap-1.5",
                                        theme === "dark" &&
                                          "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                      )}
                                    >
                                      <FileCheck className="h-4 w-4" />
                                      Sección 1 - Hoja respuestas
                                    </Link>
                                  </Button>
                                )}
                                {sim.icfes.seccion2HojaUrl && (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link
                                      to={buildViewerUrl(sim.id, "icfes2hoja")}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "gap-1.5",
                                        theme === "dark" &&
                                          "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                      )}
                                    >
                                      <FileCheck className="h-4 w-4" />
                                      Sección 2 - Hoja respuestas
                                    </Link>
                                  </Button>
                                )}
                              </>
                            ) : (
                              sim.pdfHojaRespuestasUrl && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    to={buildViewerUrl(sim.id, "hoja")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "gap-1.5",
                                      theme === "dark" &&
                                        "border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                    )}
                                  >
                                    <FileCheck className="h-4 w-4" />
                                    Hoja de respuestas
                                  </Link>
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. Videos (YouTube u otros) */}
                      {(sim.videos?.length ?? 0) + (sim.icfesVideos?.length ?? 0) > 0 && (
                        <div
                            className={cn(
                              "mt-4 pt-3 border-t",
                              theme === "dark" ? "border-zinc-500/40" : "border-gray-200"
                            )}
                          >
                          <p
                            className={cn(
                              "text-sm font-medium mb-2",
                              theme === "dark" ? "text-gray-300" : "text-gray-600"
                            )}
                          >
                            Videos
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {sim.videos?.map((v) => (
                              <a
                                key={v.id}
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                  theme === "dark"
                                    ? "border border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                    : "border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
                                )}
                              >
                                <Video className="h-4 w-4 flex-shrink-0" />
                                {v.titulo || "Ver video"}
                              </a>
                            ))}
                            {sim.icfesVideos?.map((v) => (
                              <a
                                key={v.id}
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                  theme === "dark"
                                    ? "border border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
                                    : "border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
                                )}
                              >
                                <Video className="h-4 w-4 flex-shrink-0" />
                                {v.titulo || "Ver video"}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
