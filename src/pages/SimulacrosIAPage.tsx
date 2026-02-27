import { useState, useEffect, useCallback } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flag,
  Clock,
  Loader2,
  Bot,
  ClipboardList,
} from "lucide-react";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { useThemeContext } from "@/context/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentNav } from "@/components/student/StudentNav";
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";
import { getRandomEjercicios, type EjercicioIA } from "@/services/firebase/ejerciciosIA.service";
import { dbService } from "@/services/firebase/db.service";
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME } from "@/utils/subjects.config";
import { MathText } from "@/utils/renderMath";

const SECONDS_PER_QUESTION = 60;
const DEFAULT_GRADE = "11";
const EXERCISES_LIMIT = 10;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
 * Ejercicios desde EjerciciosIA, 1.5 min por pregunta, filtro por materia.
 */
export default function SimulacrosIAPage() {
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();
  const { user } = useAuthContext();

  const [mode, setMode] = useState<"setup" | "running" | "finished">("setup");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [exercises, setExercises] = useState<EjercicioIA[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(SECONDS_PER_QUESTION);
  const [studentGrade, setStudentGrade] = useState<string>(DEFAULT_GRADE);

  useEffect(() => {
    if (!user?.uid) return;
    dbService.getUserById(user.uid).then((res) => {
      if (res.success && res.data) {
        const data = res.data as { grade?: string; gradeId?: string; gradeName?: string };
        const raw = data.gradeName || data.grade || data.gradeId;
        if (raw) {
          const s = String(raw).trim();
          if (GRADE_CODE_TO_NAME[s]) setStudentGrade(s);
          else if (s === "Undécimo" || s === "undecimo" || s.toLowerCase().includes("undécimo")) setStudentGrade("11");
          else if (s === "Décimo" || s === "decimo" || s.toLowerCase().includes("décimo")) setStudentGrade("10");
          else setStudentGrade(s);
        }
      }
    });
  }, [user?.uid]);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    const subject = subjectFilter && subjectFilter !== "all" ? subjectFilter : undefined;
    const result = await getRandomEjercicios({
      grade: studentGrade,
      subject,
      limit: EXERCISES_LIMIT,
    });
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.error?.message ?? "Error al cargar ejercicios");
      return;
    }
    if (result.data.length === 0) {
      setError("No hay ejercicios disponibles para los filtros seleccionados. Intenta con otra materia o Al azar.");
      return;
    }
    setExercises(result.data);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setTimeRemaining(SECONDS_PER_QUESTION);
    setMode("running");
  }, [studentGrade, subjectFilter]);

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

  const currentExercise = exercises[currentIndex];
  const correctCount = exercises.reduce(
    (acc, ex, i) =>
      acc + (isAnswerCorrect(selectedAnswers[i], ex.correctAnswer, ex.options || []) ? 1 : 0),
    0
  );

  const themeSafe = theme ?? "light";

  return (
    <div className={cn("min-h-screen", themeSafe === "dark" ? "bg-zinc-900" : "bg-gray-50")}>
      <header
        className={cn(
          "shadow-sm",
          themeSafe === "dark" ? "bg-zinc-800 border-b border-zinc-700" : "bg-white"
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
                themeSafe === "dark" ? "text-red-400" : "text-red-600"
              )}
            >
              {isLoadingInstitution ? "Cargando..." : institutionName}
            </span>
          </div>
          <StudentNav theme={themeSafe} />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <RutaPreparacionSubNav theme={themeSafe} />

        <div className="mb-2">
          <h1
            className={cn(
              "text-3xl font-bold mb-2 flex items-center gap-3",
              themeSafe === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <Bot className="h-8 w-8 flex-shrink-0" />
            Simulacros IA
          </h1>
          <p className={cn(themeSafe === "dark" ? "text-gray-400" : "text-gray-600")}>
            Practica con 10 preguntas generadas por IA. Tienes 1 minuto por pregunta.
          </p>
        </div>

        {mode === "setup" && (
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
                <div>
                  <label
                    className={cn(
                      "block text-sm font-medium mb-2",
                      themeSafe === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                >
                  Filtrar por materia
                </label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger
                    className={cn(
                      themeSafe === "dark"
                        ? "bg-zinc-700 border-zinc-600 text-white"
                        : "bg-white border-gray-300"
                    )}
                  >
                    <SelectValue placeholder="Selecciona una materia" />
                  </SelectTrigger>
                  <SelectContent
                    className={cn(
                      themeSafe === "dark" ? "bg-zinc-800 border-zinc-600" : "bg-white"
                    )}
                  >
                    <SelectItem value="all">Al azar</SelectItem>
                    {SUBJECTS_CONFIG.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cargando ejercicios...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar mini simulacro
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          </div>
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
                    <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
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
                    className={themeSafe === "dark" ? "border-zinc-600" : ""}
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
                    className={themeSafe === "dark" ? "border-zinc-600" : ""}
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
              themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <h3
                  className={cn(
                    "text-xl font-semibold mb-2",
                    themeSafe === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  Simulacro finalizado
                </h3>
                <p className={cn(themeSafe === "dark" ? "text-gray-400" : "text-gray-600")}>
                  Obtuviste {correctCount} de {exercises.length} respuestas correctas
                  {correctCount === exercises.length ? " ¡Perfecto!" : ""}
                </p>
              </div>

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                {exercises.map((ex, idx) => {
                  const selected = selectedAnswers[idx];
                  const correct = isAnswerCorrect(selected, ex.correctAnswer, ex.options || []);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-4 rounded-lg border",
                        themeSafe === "dark" ? "bg-zinc-800/50 border-zinc-600" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                            correct
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : "bg-red-500/20 text-red-600 dark:text-red-400"
                          )}
                        >
                          {correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "font-medium text-sm mb-1",
                              themeSafe === "dark" ? "text-white" : "text-gray-900"
                            )}
                          >
                            {idx + 1}. <MathText text={ex.question} />
                          </p>
                          {selected ? (
                            <p
                              className={cn(
                                "text-sm",
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
                            <p className={cn("text-sm", themeSafe === "dark" ? "text-amber-400" : "text-amber-700")}>
                              Sin responder
                            </p>
                          )}
                          {!correct && ex.correctAnswer && (
                            <p
                              className={cn(
                                "text-sm mt-1",
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
                          {ex.explanation && (
                            <div
                              className={cn(
                                "mt-3 p-3 rounded-lg text-sm border-l-4",
                                themeSafe === "dark"
                                  ? "bg-zinc-700/50 border-purple-500 text-gray-300"
                                  : "bg-purple-50 border-purple-400 text-gray-700"
                              )}
                            >
                              <span className="font-medium block mb-1">Justificación:</span>
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
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Volver a inicio
              </Button>
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
