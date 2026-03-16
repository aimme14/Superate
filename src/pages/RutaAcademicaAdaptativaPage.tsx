import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  BookOpen,
  BookOpen as BookOpenIcon,
  FileText,
  FileCheck,
  Video,
  Calculator,
  FlaskConical,
  Globe,
  Languages,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSimulacros, simulacroDetailKey } from "@/hooks/query/useSimulacros";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import { ESTUDIANTE_SESSION_CACHE } from "@/config/rutaPreparacionCache";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Simulacro } from "@/interfaces/simulacro.interface";
import { SIMULACRO_MATERIAS, isMateriaCon4Secciones } from "@/interfaces/simulacro.interface";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";
import { RutaPreparacionPageSkeleton } from "@/components/student/RutaPreparacionPageSkeleton";

function buildViewerUrl(simulacroId: string, tipo: string): string {
  return `/viewer/pdf?simulacroId=${encodeURIComponent(simulacroId)}&tipo=${tipo}`;
}

const videoLinkClass = (theme: "light" | "dark") =>
  cn(
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
    theme === "dark"
      ? "border border-zinc-500 text-gray-100 hover:bg-zinc-600 hover:border-zinc-400 hover:text-white"
      : "border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
  );

export default function RutaAcademicaAdaptativaPage() {
  const { theme } = useThemeContext();
  const { data: simulacros = [], isLoading: loading, isError, error } = useSimulacros();
  const [selectedMateria, setSelectedMateria] = useState<string | null>(null);

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
    if (loading || isError || orderedMaterias.length === 0) return;
    if (selectedMateria === null || !orderedMaterias.includes(selectedMateria)) {
      setSelectedMateria(orderedMaterias[0]);
    }
  }, [loading, isError, orderedMaterias, selectedMateria]);

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
      "simulacros-completos": GraduationCap,
    };
    return (icons as Record<string, LucideIcon>)[value] ?? BookOpen;
  };

  const selectedList = selectedMateria ? (byMateria.get(selectedMateria) ?? []) : [];
  const visibleIds = useMemo(() => selectedList.map((s) => s.id), [selectedList]);

  const detailQueries = useQueries({
    queries: visibleIds.map((id) => ({
      queryKey: simulacroDetailKey(id),
      queryFn: async (): Promise<Simulacro | null> => {
        const res = await simulacrosService.getById(id);
        if (res.success) return res.data;
        throw new Error(res.error?.message ?? "Error al cargar simulacro");
      },
      enabled: id.length > 0,
      ...ESTUDIANTE_SESSION_CACHE,
    })),
  });

  const detailsById = useMemo(() => {
    const map = new Map<string, Simulacro>();
    visibleIds.forEach((id, index) => {
      const data = detailQueries[index]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [visibleIds, detailQueries]);

  return (
    <div
      className={cn(
        "min-h-screen",
        theme === "dark" ? "bg-zinc-900" : "bg-gray-50"
      )}
    >
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <RutaPreparacionSubNav theme={theme} />
        <div className="mb-5 sm:mb-8">
          <h1
            className={cn(
              "text-xl sm:text-3xl font-bold mb-2 flex flex-wrap items-center gap-2 sm:gap-3 break-words",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
            Ruta Académica Simulacros
          </h1>
          <p
            className={cn(
              "text-sm sm:text-base break-words",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}
          >
            Simulacros creados para brindar una preparación de alta calidad, alineados con la estructura evaluativa del ICFES, orientados a fortalecer competencias clave y maximizar la probabilidad de obtener puntajes altos en la prueba Saber 11°.
          </p>
        </div>

        {loading ? (
          <RutaPreparacionPageSkeleton theme={theme} variant="ruta" />
        ) : isError ? (
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
                {error instanceof Error ? error.message : "Error al cargar simulacros"}
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
            {/* Botones de materias: en móvil más compactos y con wrap */}
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
                      "inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-md font-semibold text-xs sm:text-sm whitespace-nowrap min-h-[44px] sm:min-h-0 transition-colors",
                      theme === "dark"
                        ? isSelected
                          ? "bg-zinc-600 text-white"
                          : "text-gray-300 hover:bg-zinc-700 hover:text-white"
                        : isSelected
                          ? "bg-gray-200 text-gray-900"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
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
                          {isMateriaCon4Secciones(sim.materia) && sim.icfes ? (
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
                            <>
                              {sim.pdfSimulacroUrl && (
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
                                    {sim.pdfSimulacroSeccion2Url ? "Sección 1 - Documento" : "Documento PDF"}
                                  </Link>
                                </Button>
                              )}
                              {sim.pdfSimulacroSeccion2Url && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    to={buildViewerUrl(sim.id, "documento2")}
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
                          )}
                        </div>
                      </div>

                      {/* 2. Hoja de respuestas (sección propia) */}
                      {(isMateriaCon4Secciones(sim.materia)
                        ? (sim.icfes?.seccion1HojaUrl || sim.icfes?.seccion2HojaUrl)
                        : (sim.pdfHojaRespuestasUrl || sim.pdfHojaRespuestasSeccion2Url)) && (
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
                            {isMateriaCon4Secciones(sim.materia) && sim.icfes ? (
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
                              <>
                                {sim.pdfHojaRespuestasUrl && (
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
                                      {sim.pdfHojaRespuestasSeccion2Url ? "Sección 1 - Hoja respuestas" : "Hoja de respuestas"}
                                    </Link>
                                  </Button>
                                )}
                                {sim.pdfHojaRespuestasSeccion2Url && (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link
                                      to={buildViewerUrl(sim.id, "hoja2")}
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
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. Videos: cargados en segundo plano; sección solo si hay videos */}
                      {(() => {
                        const detail = detailsById.get(sim.id);
                        const videos = detail?.videos ?? [];
                        const icfesVideos = detail?.icfesVideos ?? [];
                        const hasVideos = videos.length > 0 || icfesVideos.length > 0;
                        if (!hasVideos) return null;
                        return (
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
                              {videos.map((v) => (
                                <a
                                  key={v.id}
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={videoLinkClass(theme)}
                                >
                                  <Video className="h-4 w-4 flex-shrink-0" />
                                  {v.titulo || "Ver video"}
                                </a>
                              ))}
                              {icfesVideos.map((v) => (
                                <a
                                  key={v.id}
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={videoLinkClass(theme)}
                                >
                                  <Video className="h-4 w-4 flex-shrink-0" />
                                  {v.titulo || "Ver video"}
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
