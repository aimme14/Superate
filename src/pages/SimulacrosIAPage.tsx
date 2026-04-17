import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flag,
  Clock,
  Bot,
  ClipboardList,
  BookOpen,
  Sparkles,
  Timer,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";
import { RutaPreparacionPageSkeleton } from "@/components/student/RutaPreparacionPageSkeleton";
import { getRandomEjercicios, type EjercicioIA } from "@/services/firebase/ejerciciosIA.service";
import { MathText } from "@/utils/renderMath";

const SECONDS_PER_QUESTION = 60;
const EXERCISES_LIMIT = 10;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTodayShort(date: Date = new Date()): string {
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Etiqueta legible para tiempo total del simulacro (valor fijo en resultados). */
function formatTotalDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}

function isAnswerCorrect(
  selected: string | undefined,
  correctAnswer: string,
  options: string[]
): boolean {
  if (!selected) return false;
  const sel = selected.trim();
  const corr = correctAnswer.trim();
  if (sel === corr) return true;
  const letter = corr.toUpperCase().charAt(0);
  if (["A", "B", "C", "D"].includes(letter)) {
    const idx = letter.charCodeAt(0) - 65;
    if (options[idx] && options[idx].trim() === sel) return true;
    if (sel.toUpperCase().startsWith(letter + ")") || sel.toUpperCase().startsWith(letter + "."))
      return true;
  }
  return false;
}

/**
 * Página Simulacros IA con mini simulacro de 10 preguntas.
 * Ejercicios desde EjerciciosIA, 1 minuto por pregunta.
 */
export default function SimulacrosIAPage() {
  const { theme } = useThemeContext();

  const [mode, setMode] = useState<"setup" | "running" | "finished">("setup");
  const [exercises, setExercises] = useState<EjercicioIA[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(SECONDS_PER_QUESTION);
  const [showJustifications, setShowJustifications] = useState(false);
  const [totalElapsedSec, setTotalElapsedSec] = useState<number | null>(null);
  const runStartedAtRef = useRef<number | null>(null);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRandomEjercicios({
        limit: EXERCISES_LIMIT,
      });
      if (!result.success || !result.data) {
        setError(result.error?.message ?? "Error al cargar ejercicios");
        return;
      }
      if (result.data.length === 0) {
        setError("No hay ejercicios disponibles en este momento. Intenta de nuevo.");
        return;
      }
      setExercises(result.data);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setTimeRemaining(SECONDS_PER_QUESTION);
      setTotalElapsedSec(null);
      setMode("running");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStart = () => {
    fetchExercises();
  };

  const handleFinish = () => {
    setMode("finished");
  };

  const handleVolver = () => {
    setMode("setup");
    setExercises([]);
    setSelectedAnswers({});
    setError(null);
    setTotalElapsedSec(null);
    runStartedAtRef.current = null;
  };

  useEffect(() => {
    if (mode !== "running" || exercises.length === 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (currentIndex < exercises.length - 1) {
            setCurrentIndex((i) => i + 1);
          } else {
            setMode("finished");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, currentIndex, exercises.length]);

  useEffect(() => {
    if (mode === "running" && exercises.length > 0) {
      setTimeRemaining(SECONDS_PER_QUESTION);
    }
  }, [currentIndex, mode, exercises.length]);

  useEffect(() => {
    if (mode === "running" && exercises.length > 0) {
      runStartedAtRef.current = Date.now();
    }
  }, [mode, exercises.length]);

  useEffect(() => {
    if (mode === "finished") {
      setShowJustifications(false);
      if (runStartedAtRef.current != null) {
        setTotalElapsedSec(Math.max(0, Math.round((Date.now() - runStartedAtRef.current) / 1000)));
      } else {
        setTotalElapsedSec(null);
      }
    }
  }, [mode]);

  const currentExercise = exercises[currentIndex];
  const correctCount = exercises.reduce(
    (acc, ex, i) =>
      acc + (isAnswerCorrect(selectedAnswers[i], ex.correctAnswer, ex.options || []) ? 1 : 0),
    0
  );
  const totalQuestions = exercises.length;
  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const incorrectCount = totalQuestions - correctCount;

  const themeSafe = theme ?? "light";

  return (
    <div className={cn("min-h-screen", themeSafe === "dark" ? "bg-zinc-900" : "bg-gray-50")}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <RutaPreparacionSubNav theme={themeSafe} />

        <div className="mb-2">
          <h1
            className={cn(
              "text-[15px] sm:text-[23px] font-bold mb-2 flex flex-wrap items-center gap-2 sm:gap-3 break-words",
              themeSafe === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <Bot className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
            Simulacros IA
          </h1>
          <p className={cn("text-sm sm:text-base break-words", themeSafe === "dark" ? "text-gray-400" : "text-gray-600")}>
            Practica con 10 preguntas generadas por IA. Tienes 1 minuto por pregunta.
          </p>
        </div>

        {mode === "setup" && (
          loading ? (
            <RutaPreparacionPageSkeleton theme={themeSafe} variant="simulacros-setup" />
          ) : (
          <div className="flex flex-col items-center -mt-1 pb-12">
            <Card
              className={cn(
                "max-w-lg w-full mx-auto",
                themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
              )}
            >
              <CardContent className="pt-6 space-y-5">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-xl",
                      themeSafe === "dark" ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
                    )}
                  >
                    <ClipboardList className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <p
                    className={cn(
                      "text-[0.9375rem] leading-[1.6] text-center tracking-tight",
                      "font-medium max-w-md",
                      themeSafe === "dark" ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    Formulario inteligente desarrollado con Inteligencia Artificial, diseñado para potenciar la velocidad y precisión en la toma de decisiones por pregunta. Su enfoque entrena la capacidad de respuesta rápida bajo presión, optimizando el tiempo de resolución y fortaleciendo el rendimiento en evaluaciones de alta exigencia.
                  </p>
                </div>
              {error && (
                <p className={cn("text-sm", themeSafe === "dark" ? "text-red-400" : "text-red-600")}>
                  {error}
                </p>
              )}

              <Button
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar mini simulacro
              </Button>
            </CardContent>
          </Card>
          </div>
          )
        )}

        {mode === "running" && currentExercise && (
          <Card
            className={cn(
              themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                      themeSafe === "dark" ? "bg-amber-900/30 text-amber-300" : "bg-amber-100 text-amber-800"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="font-mono font-semibold tabular-nums">
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      themeSafe === "dark" ? "text-gray-400" : "text-gray-600"
                    )}
                  >
                    Pregunta {currentIndex + 1} de {exercises.length}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    className={cn(
                      themeSafe === "dark" ? "border-zinc-600 text-gray-300" : "",
                      "focus-visible:ring-0 focus-visible:ring-offset-0",
                      "hover:bg-transparent hover:border-inherit hover:text-inherit",
                      "dark:hover:bg-transparent dark:hover:border-zinc-600 dark:hover:text-gray-300"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentIndex((i) =>
                        i >= exercises.length - 1 ? i : i + 1
                      )
                    }
                    disabled={currentIndex >= exercises.length - 1}
                    className={cn(
                      themeSafe === "dark" ? "border-zinc-600 text-gray-300" : "",
                      "focus-visible:ring-0 focus-visible:ring-offset-0",
                      "hover:bg-transparent hover:border-inherit hover:text-inherit",
                      "dark:hover:bg-transparent dark:hover:border-zinc-600 dark:hover:text-gray-300"
                    )}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleFinish}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Flag className="h-4 w-4 mr-1" />
                    Finalizar simulacro
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Badge
                  className={cn(
                    "mb-2",
                    themeSafe === "dark" ? "bg-purple-700 text-purple-200 hover:bg-purple-700" : "bg-purple-100 text-purple-700 hover:bg-purple-100"
                  )}
                >
                  {currentExercise.topic}
                </Badge>
                <p
                  className={cn(
                    "font-medium text-base leading-relaxed",
                    themeSafe === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  <MathText text={currentExercise.question} />
                </p>
                <div className="space-y-2">
                  {currentExercise.options?.map((option, optIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === option;
                    return (
                      <div
                        key={optIdx}
                        onClick={() =>
                          setSelectedAnswers((prev) => ({
                            ...prev,
                            [currentIndex]: option,
                          }))
                        }
                        className={cn(
                          "p-3 rounded-lg border transition-colors cursor-pointer",
                          isSelected
                            ? themeSafe === "dark"
                              ? "bg-blue-900/30 border-blue-600"
                              : "bg-blue-50 border-blue-200"
                            : themeSafe === "dark"
                              ? "bg-zinc-800/50 border-zinc-600 hover:bg-zinc-700/50"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <MathText
                          text={option}
                          className={cn(
                            "font-medium",
                            isSelected
                              ? themeSafe === "dark"
                                ? "text-blue-300"
                                : "text-blue-700"
                              : themeSafe === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "finished" && exercises.length > 0 && (
          <Card
            className={cn(
              "overflow-hidden border-0 shadow-lg",
              themeSafe === "dark"
                ? "bg-zinc-900 ring-1 ring-fuchsia-500/25 shadow-fuchsia-950/40"
                : "bg-white ring-1 ring-violet-200 shadow-violet-200/50"
            )}
          >
            <CardContent className="p-0 space-y-0">
              <div
                className={cn(
                  "relative overflow-hidden border-b",
                  themeSafe === "dark"
                    ? "border-white/10 bg-gradient-to-br from-violet-950/80 via-zinc-900 to-cyan-950/70"
                    : "border-violet-100/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50"
                )}
              >
                <div
                  className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-fuchsia-500/35 blur-2xl sm:h-44 sm:w-44 sm:blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-cyan-400/25 blur-2xl sm:h-36 sm:w-36 sm:blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-2xl sm:h-32 sm:w-64 sm:blur-3xl"
                  aria-hidden
                />

                <div className="relative z-10 px-3 pt-3 pb-4 sm:px-7 sm:pt-6 sm:pb-6">
                  <div className="mb-3 flex flex-col items-stretch gap-2 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm sm:h-10 sm:w-10 sm:rounded-xl",
                          themeSafe === "dark"
                            ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"
                            : "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"
                        )}
                      >
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
                      </span>
                      <div>
                        <h3
                          className={cn(
                            "text-base font-bold tracking-tight sm:text-xl",
                            themeSafe === "dark" ? "text-white" : "text-gray-900"
                          )}
                        >
                          Simulacro finalizado
                        </h3>
                        <p className={cn("text-[11px] leading-snug sm:text-sm", themeSafe === "dark" ? "text-violet-200/90" : "text-violet-700/90")}>
                          Resumen de tu intento
                        </p>
                      </div>
                    </div>
                    {totalElapsedSec != null && (
                      <div className="flex w-full flex-col items-center gap-0.5 sm:w-auto sm:items-end">
                        <div
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums leading-tight sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs",
                            themeSafe === "dark"
                              ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                              : "border-amber-300 bg-amber-100 text-amber-900"
                          )}
                        >
                          <Timer className="h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5" aria-hidden />
                          <span>Tiempo total: {formatTotalDuration(totalElapsedSec)}</span>
                        </div>
                        <span
                          className={cn(
                            "text-[10px] tabular-nums leading-none sm:text-[11px]",
                            themeSafe === "dark" ? "text-amber-200/60" : "text-amber-900/70"
                          )}
                        >
                          {formatTodayShort()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12 sm:gap-5 items-stretch">
                    <div
                      className={cn(
                        "sm:col-span-5 flex flex-col items-center justify-center rounded-xl border p-3.5 sm:rounded-2xl sm:p-6",
                        themeSafe === "dark"
                          ? "border-white/10 bg-black/25"
                          : "border-white/80 bg-white/70 shadow-sm"
                      )}
                    >
                      <p
                        className={cn(
                          "text-[0.65rem] font-bold uppercase tracking-[0.12em] mb-1 sm:mb-2 sm:text-[0.7rem] sm:tracking-[0.2em]",
                          themeSafe === "dark" ? "text-fuchsia-300/90" : "text-fuchsia-600"
                        )}
                      >
                        Puntaje
                      </p>
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span
                          className={cn(
                            "text-4xl font-black tabular-nums tracking-tight bg-clip-text text-transparent sm:text-6xl",
                            themeSafe === "dark"
                              ? "bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200"
                              : "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600"
                          )}
                        >
                          {scorePercent}
                        </span>
                        <span
                          className={cn(
                            "text-lg font-bold pb-0.5 sm:pb-1 sm:text-2xl",
                            themeSafe === "dark" ? "text-violet-200/80" : "text-violet-500/90"
                          )}
                        >
                          /100
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-7 flex flex-col gap-2 justify-center sm:gap-2.5">
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 sm:gap-3 sm:rounded-xl sm:px-4 sm:py-2.5",
                          themeSafe === "dark"
                            ? "border-emerald-400/35 bg-emerald-500/10"
                            : "border-emerald-200 bg-emerald-50/90"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10 sm:rounded-lg",
                            themeSafe === "dark" ? "bg-emerald-500/25 text-emerald-300" : "bg-emerald-500 text-white shadow-sm"
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[10px] font-semibold uppercase tracking-wide sm:text-xs", themeSafe === "dark" ? "text-emerald-300/90" : "text-emerald-800")}>
                            Correctas
                          </p>
                          <p className={cn("text-xl font-black tabular-nums leading-none sm:text-2xl", themeSafe === "dark" ? "text-emerald-200" : "text-emerald-700")}>
                            {correctCount}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 sm:gap-3 sm:rounded-xl sm:px-4 sm:py-2.5",
                          themeSafe === "dark"
                            ? "border-rose-400/35 bg-rose-500/10"
                            : "border-rose-200 bg-rose-50/90"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10 sm:rounded-lg",
                            themeSafe === "dark" ? "bg-rose-500/25 text-rose-300" : "bg-rose-500 text-white shadow-sm"
                          )}
                        >
                          <XCircle className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-xs", themeSafe === "dark" ? "text-rose-300/90" : "text-rose-800")}>
                            <span className="sm:hidden">Sin acertar</span>
                            <span className="hidden sm:inline">Incorrectas o sin responder</span>
                          </p>
                          <p className={cn("text-xl font-black tabular-nums leading-none sm:text-2xl", themeSafe === "dark" ? "text-rose-200" : "text-rose-700")}>
                            {incorrectCount}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-5">
                    <div
                      className={cn(
                        "mb-1 flex justify-between text-[0.6rem] font-bold uppercase tracking-wider sm:mb-1.5 sm:text-[0.65rem]",
                        themeSafe === "dark" ? "text-zinc-500" : "text-gray-500"
                      )}
                    >
                      <span className="text-emerald-600 dark:text-emerald-400">Aciertos</span>
                      <span className="text-rose-600 dark:text-rose-400">Resto</span>
                    </div>
                    <div
                      className={cn(
                        "h-2.5 w-full rounded-full overflow-hidden flex ring-1 sm:h-3.5",
                        themeSafe === "dark" ? "bg-zinc-950/80 ring-white/10" : "bg-gray-200 ring-black/5"
                      )}
                      role="img"
                      aria-label={`${correctCount} correctas, ${incorrectCount} incorrectas o sin responder`}
                    >
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${scorePercent}%` }} />
                      <div className="h-full bg-gradient-to-r from-rose-500 to-orange-500" style={{ width: `${100 - scorePercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-3 pt-4 pb-5 sm:space-y-6 sm:px-6 sm:pt-5 sm:pb-6">
              <div
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border px-3 py-2.5 sm:gap-3 sm:rounded-xl sm:px-4 sm:py-3",
                  themeSafe === "dark"
                    ? "border-violet-500/30 bg-gradient-to-r from-violet-950/40 to-fuchsia-950/30"
                    : "border-violet-200 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/80"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen
                    className={cn(
                      "h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5",
                      themeSafe === "dark" ? "text-purple-400" : "text-purple-600"
                    )}
                    aria-hidden
                  />
                  <Label
                    htmlFor="sim-ia-justificaciones"
                    className={cn(
                      "text-xs font-medium cursor-pointer leading-snug sm:text-sm",
                      themeSafe === "dark" ? "text-gray-200" : "text-gray-800"
                    )}
                  >
                    Mostrar justificaciones
                  </Label>
                </div>
                <Switch
                  id="sim-ia-justificaciones"
                  checked={showJustifications}
                  onCheckedChange={setShowJustifications}
                  className={cn(
                    "data-[state=checked]:bg-purple-600 shrink-0",
                    themeSafe === "dark" ? "data-[state=unchecked]:bg-zinc-600" : ""
                  )}
                />
              </div>

              <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1.5 sm:max-h-[65vh] sm:space-y-4 sm:pr-2">
                {exercises.map((ex, idx) => {
                  const selected = selectedAnswers[idx];
                  const correct = isAnswerCorrect(selected, ex.correctAnswer, ex.options || []);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg border sm:p-4",
                        themeSafe === "dark" ? "bg-zinc-800/50 border-zinc-600" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div
                          className={cn(
                            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center sm:w-8 sm:h-8",
                            correct
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : "bg-red-500/20 text-red-600 dark:text-red-400"
                          )}
                        >
                          {correct ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "font-medium text-[13px] leading-snug mb-0.5 sm:mb-1 sm:text-sm",
                              themeSafe === "dark" ? "text-white" : "text-gray-900"
                            )}
                          >
                            {idx + 1}. <MathText text={ex.question} />
                          </p>
                          {selected ? (
                            <p
                              className={cn(
                                "text-xs sm:text-sm",
                                correct
                                  ? themeSafe === "dark"
                                    ? "text-green-400"
                                    : "text-green-700"
                                  : themeSafe === "dark"
                                    ? "text-red-400"
                                    : "text-red-700"
                              )}
                            >
                              Tu respuesta: <MathText text={selected} />
                            </p>
                          ) : (
                            <p className={cn("text-xs sm:text-sm", themeSafe === "dark" ? "text-amber-400" : "text-amber-700")}>
                              Sin responder
                            </p>
                          )}
                          {!correct && ex.correctAnswer && (
                            <p
                              className={cn(
                                "text-xs mt-0.5 sm:mt-1 sm:text-sm",
                                themeSafe === "dark" ? "text-green-400" : "text-green-700"
                              )}
                            >
                              Respuesta correcta:{" "}
                              <MathText
                                text={(() => {
                                  const letter = ex.correctAnswer.trim().toUpperCase().charAt(0);
                                  if (["A", "B", "C", "D"].includes(letter) && ex.options?.length) {
                                    const letterIdx = letter.charCodeAt(0) - 65;
                                    return ex.options[letterIdx] ?? ex.correctAnswer;
                                  }
                                  return ex.correctAnswer;
                                })()}
                              />
                            </p>
                          )}
                          {ex.explanation && showJustifications && (
                            <div
                              className={cn(
                                "mt-2 p-2.5 rounded-md text-xs border-l-[3px] sm:mt-3 sm:p-3 sm:rounded-lg sm:text-sm sm:border-l-4",
                                themeSafe === "dark"
                                  ? "bg-zinc-700/50 border-purple-500 text-gray-300"
                                  : "bg-purple-50 border-purple-400 text-gray-700"
                              )}
                            >
                              <span className="font-medium block mb-0.5 sm:mb-1">Justificación:</span>
                              <p className="leading-relaxed">
                                <MathText text={ex.explanation} />
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleVolver}
                className="w-full h-10 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md sm:h-11 sm:text-base"
              >
                Volver a inicio
              </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evitar pantalla en blanco: fallbacks */}
        {mode === "finished" && exercises.length === 0 && (
          <Card
            className={cn(
              "max-w-lg",
              themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6 text-center">
              <p className={cn(themeSafe === "dark" ? "text-gray-400" : "text-gray-600")}>
                No hay resultados para mostrar.
              </p>
              <Button onClick={handleVolver} variant="outline" className="mt-4">
                Volver a inicio
              </Button>
            </CardContent>
          </Card>
        )}
        {mode === "running" && !currentExercise && exercises.length === 0 && !loading && (
          <Card
            className={cn(
              "max-w-lg",
              themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6 text-center">
              <p className={cn(themeSafe === "dark" ? "text-gray-400" : "text-gray-600")}>
                No hay preguntas cargadas.
              </p>
              <Button onClick={handleVolver} variant="outline" className="mt-4">
                Volver a inicio
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
