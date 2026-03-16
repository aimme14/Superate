import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flag,
  Clock,
  FileCheck,
  ClipboardList,
  ZoomIn,
} from "lucide-react";
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
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav";
import { RutaPreparacionPageSkeleton } from "@/components/student/RutaPreparacionPageSkeleton";
import {
  questionService,
  type Question,
  type QuestionOption,
} from "@/services/firebase/question.service";
import {
  getRandomEjercicios,
  type EjercicioIA,
} from "@/services/firebase/ejerciciosIA.service";
import { dbService } from "@/services/firebase/db.service";
import { SUBJECTS_CONFIG, GRADE_CODE_TO_NAME } from "@/utils/subjects.config";
import { SIMULACRO_QUESTIONS_CACHE_MS } from "@/config/rutaPreparacionCache";
import { consumePrefetchedSimulacrosICFES } from "@/utils/simulacrosICFESPrefetch";
import { sanitizeMathHtml } from "@/utils/sanitizeMathHtml";
import { renderMathInHtml } from "@/utils/renderMathInHtml";
import { MathText } from "@/utils/renderMath";

const SECONDS_PER_QUESTION = 90; // 1.5 min por pregunta
const EXERCISES_LIMIT = 10;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Mapea el grado del perfil del usuario al código que usa el banco de preguntas.
 * Ej: "11" -> "1", "10" -> "0"
 */
function mapUserGradeToQuestionBank(gradeInput: string): string {
  const s = String(gradeInput).trim().toLowerCase();
  if (s === "11" || s === "undécimo" || s === "undecimo") return "1";
  if (s === "10" || s === "décimo" || s === "decimo") return "0";
  if (["6", "7", "8", "9"].includes(s)) return s;
  // Formatos como "11°1", "10°2"
  if (s.startsWith("11")) return "1";
  if (s.startsWith("10")) return "0";
  if (s.startsWith("9")) return "9";
  if (s.startsWith("8")) return "8";
  if (s.startsWith("7")) return "7";
  if (s.startsWith("6")) return "6";
  return "1"; // Default undécimo
}

/**
 * Mapea el grado del banco al formato que espera la API de EjerciciosIA.
 * Ej: "1" -> "11", "0" -> "10"
 */
function mapGradeToIAFormat(gradeCode: string): string {
  if (gradeCode === "1") return "11";
  if (gradeCode === "0") return "10";
  return gradeCode;
}

/**
 * Convierte EjercicioIA a Question para que la UI de Simulacros ICFES
 * pueda renderizar preguntas de la IA sin cambios.
 */
function ejercicioIAToQuestion(ex: EjercicioIA, index: number): Question {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
  const correctTrim = ex.correctAnswer?.trim() ?? "";
  let correctIdx = -1;
  const firstChar = correctTrim.toUpperCase().charAt(0);
  if (["A", "B", "C", "D", "E", "F", "G", "H"].includes(firstChar)) {
    correctIdx = letters.indexOf(firstChar as (typeof letters)[number]);
  }
  if (correctIdx < 0 && ex.options?.length) {
    correctIdx = ex.options.findIndex(
      (opt) => (opt ?? "").trim().toLowerCase() === correctTrim.toLowerCase()
    );
  }
  if (correctIdx < 0) correctIdx = 0;

  const options: QuestionOption[] = (ex.options ?? []).map((text, i) => ({
    id: letters[Math.min(i, letters.length - 1)],
    text: text ?? "",
    imageUrl: null,
    isCorrect: i === correctIdx,
  }));

  return {
    id: `ia-en-${index}`,
    code: `IA-IN-${String(index).padStart(3, "0")}`,
    subject: "Inglés",
    subjectCode: "IN",
    topic: ex.topic ?? "Inglés",
    topicCode: "P1",
    grade: "1",
    level: "Medio",
    levelCode: "M",
    questionText: ex.question ?? "",
    answerType: "MCQ",
    options,
    justification: ex.explanation ?? undefined,
    createdBy: "ia",
    createdAt: new Date(),
  };
}

function getCorrectOptionId(options: QuestionOption[]): string | undefined {
  const correct = options?.find((o) => o.isCorrect);
  return correct?.id;
}

function isAnswerCorrect(
  selectedOptionId: string | undefined,
  correctOptionId: string | undefined,
  _options: QuestionOption[]
): boolean {
  if (!selectedOptionId || !correctOptionId) return false;
  return selectedOptionId.trim().toUpperCase() === correctOptionId.trim().toUpperCase();
}

function getOptionDisplayText(option: QuestionOption): string {
  if (option.text && option.text.trim() !== "") return option.text;
  return `Opción ${option.id}`;
}

/**
 * Página Simulacros ICFES.
 * Mini simulacro de 10 preguntas desde el banco (questions), 1.5 min por pregunta.
 * Soporta imágenes en preguntas y opciones.
 */
export default function SimulacrosICFESPage() {
  const { theme } = useThemeContext();
  const { user } = useAuthContext();

  const [mode, setMode] = useState<"setup" | "running" | "finished">("setup");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>(
    {}
  );
  const [timeRemaining, setTimeRemaining] = useState(SECONDS_PER_QUESTION);
  const [studentGrade, setStudentGrade] = useState<string>("1");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const prefetchedRef = useRef<{
    questions: Question[];
    grade: string;
    subject: string;
    fetchedAt: number;
  } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    dbService.getUserById(user.uid).then((res) => {
      if (res.success && res.data) {
        const data = res.data as {
          grade?: string;
          gradeId?: string;
          gradeName?: string;
        };
        const raw = data.gradeName || data.grade || data.gradeId;
        if (raw) {
          const s = String(raw).trim();
          if (GRADE_CODE_TO_NAME[s]) {
            setStudentGrade(mapUserGradeToQuestionBank(s));
          } else if (
            s.toLowerCase().includes("undécimo") ||
            s.toLowerCase().includes("undecimo")
          ) {
            setStudentGrade("1");
          } else if (
            s.toLowerCase().includes("décimo") ||
            s.toLowerCase().includes("decimo")
          ) {
            setStudentGrade("0");
          } else {
            setStudentGrade(mapUserGradeToQuestionBank(s));
          }
        }
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (mode !== "setup" || !studentGrade) return;
    if (subjectFilter === "IN") {
      const gradeIA = mapGradeToIAFormat(studentGrade);
      getRandomEjercicios({
        grade: gradeIA,
        subject: "IN",
        limit: EXERCISES_LIMIT,
      })
        .then((result) => {
          if (result.success && (result.data?.length ?? 0) > 0) {
            prefetchedRef.current = {
              questions: (result.data ?? []).map((ex, i) =>
                ejercicioIAToQuestion(ex, i)
              ),
              grade: studentGrade,
              subject: subjectFilter,
              fetchedAt: Date.now(),
            };
          }
        })
        .catch(() => {});
    } else {
      const subject =
        subjectFilter && subjectFilter !== "all" ? subjectFilter : undefined;
      const filters = { grade: studentGrade, subjectCode: subject };
      questionService
        .getRandomQuestions(filters, EXERCISES_LIMIT)
        .then((result) => {
          if (result.success && (result.data?.length ?? 0) > 0) {
            prefetchedRef.current = {
              questions: result.data ?? [],
              grade: studentGrade,
              subject: subjectFilter,
              fetchedAt: Date.now(),
            };
          }
        })
        .catch(() => {});
    }
  }, [mode, studentGrade, subjectFilter]);

  const fetchQuestions = useCallback(async () => {
    // 1) Consumir prefetch global (tanda "all" cargada al dashboard)
    const globalPrefetched = consumePrefetchedSimulacrosICFES(
      studentGrade,
      subjectFilter
    );
    if (globalPrefetched && globalPrefetched.length > 0) {
      setQuestions(globalPrefetched);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setTimeRemaining(SECONDS_PER_QUESTION);
      setMode("running");
      return;
    }

    // 2) Consumir prefetch local de la página (por materia, al estar en setup)
    const prefetched = prefetchedRef.current;
    const notExpired =
      prefetched &&
      Date.now() - prefetched.fetchedAt < SIMULACRO_QUESTIONS_CACHE_MS;
    const filtersMatch =
      notExpired &&
      prefetched.grade === studentGrade &&
      prefetched.subject === subjectFilter &&
      prefetched.questions.length > 0;

    if (filtersMatch) {
      setQuestions(prefetched.questions);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setTimeRemaining(SECONDS_PER_QUESTION);
      setMode("running");
      prefetchedRef.current = null;
      return;
    }
    if (prefetched && !notExpired) prefetchedRef.current = null;

    setLoading(true);
    setError(null);

    if (subjectFilter === "IN") {
      const gradeIA = mapGradeToIAFormat(studentGrade);
      const result = await getRandomEjercicios({
        grade: gradeIA,
        subject: "IN",
        limit: EXERCISES_LIMIT,
      });
      setLoading(false);
      if (!result.success || !result.data) {
        setError(result.error?.message ?? "Error al cargar ejercicios de inglés");
        return;
      }
      if (result.data.length === 0) {
        setError(
          "No hay ejercicios de inglés disponibles. Intenta de nuevo más tarde."
        );
        return;
      }
      const questionsFromIA = result.data.map((ex, i) =>
        ejercicioIAToQuestion(ex, i)
      );
      setQuestions(questionsFromIA);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setTimeRemaining(SECONDS_PER_QUESTION);
      setMode("running");
      return;
    }

    const filters: Parameters<typeof questionService.getRandomQuestions>[0] = {
      grade: studentGrade,
    };
    if (subjectFilter && subjectFilter !== "all") {
      filters.subjectCode = subjectFilter;
    }
    const result = await questionService.getRandomQuestions(
      filters,
      EXERCISES_LIMIT
    );
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? "Error al cargar preguntas");
      return;
    }
    const data = result.data ?? [];
    if (data.length === 0) {
      setError(
        "No hay preguntas disponibles para los filtros seleccionados. Intenta con otra materia o Al azar."
      );
      return;
    }
    setQuestions(data);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setTimeRemaining(SECONDS_PER_QUESTION);
    setMode("running");
  }, [studentGrade, subjectFilter]);

  const handleStart = () => {
    fetchQuestions();
  };

  const handleFinish = () => {
    setMode("finished");
  };

  const handleVolver = () => {
    setMode("setup");
    setQuestions([]);
    setSelectedAnswers({});
    setError(null);
    setZoomedImage(null);
  };

  useEffect(() => {
    if (mode !== "running" || questions.length === 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (currentIndex < questions.length - 1) {
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
  }, [mode, currentIndex, questions.length]);

  useEffect(() => {
    if (mode === "running" && questions.length > 0) {
      setTimeRemaining(SECONDS_PER_QUESTION);
    }
  }, [currentIndex, mode, questions.length]);

  const currentQuestion = questions[currentIndex];
  const correctCount = questions.reduce(
    (acc, q, i) =>
      acc +
      (isAnswerCorrect(
        selectedAnswers[i],
        getCorrectOptionId(q.options ?? []),
        q.options ?? []
      )
        ? 1
        : 0),
    0
  );

  const themeSafe = theme ?? "light";

  return (
    <div
      className={cn(
        "min-h-screen",
        themeSafe === "dark" ? "bg-zinc-900" : "bg-gray-50"
      )}
    >
      <div className="container mx-auto px-4 py-8">
        <RutaPreparacionSubNav theme={themeSafe} />

        <div className="mb-2">
          <h1
            className={cn(
              "text-3xl font-bold mb-2 flex items-center gap-3",
              themeSafe === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <FileCheck className="h-8 w-8 flex-shrink-0" />
            Simulacros ICFES
          </h1>
          <p
            className={cn(
              themeSafe === "dark" ? "text-gray-400" : "text-gray-600"
            )}
          >
            Practica con 10 preguntas del banco oficial (formularios), alineadas
            con la Prueba Saber 11°. Tienes 1.5 minutos por pregunta.
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
                themeSafe === "dark"
                  ? "bg-zinc-800 border-zinc-700"
                  : "bg-white border-gray-200"
              )}
            >
              <CardContent className="pt-6 space-y-5">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-xl",
                      themeSafe === "dark"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-blue-100 text-blue-600"
                    )}
                  >
                    <ClipboardList
                      className="h-7 w-7"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                  <p
                    className={cn(
                      "text-[0.9375rem] leading-[1.6] text-center tracking-tight",
                      "font-medium max-w-md",
                      themeSafe === "dark" ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    Preguntas ICFES para que practiques, mejores tu velocidad de respuesta y aumentes las probabilidades de un excelente puntaje.
                    Responde en tiempo real y fortalece tus competencias.
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
                        themeSafe === "dark"
                          ? "bg-zinc-800 border-zinc-600"
                          : "bg-white"
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
                  <p
                    className={cn(
                      "text-sm",
                      themeSafe === "dark" ? "text-red-400" : "text-red-600"
                    )}
                  >
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar mini simulacro
                </Button>
              </CardContent>
            </Card>
          </div>
          )
        )}

        {mode === "running" && currentQuestion && (
          <Card
            className={cn(
              themeSafe === "dark"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                    themeSafe === "dark"
                      ? "bg-amber-900/30 text-amber-300"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  <Clock className="h-4 w-4" aria-hidden />
                  <span className="font-mono font-semibold">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    themeSafe === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  )}
                >
                  Pregunta {currentIndex + 1} de {questions.length}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={cn(
                      themeSafe === "dark"
                        ? "bg-blue-700 text-blue-200 hover:bg-blue-700"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                    )}
                  >
                    {currentQuestion.subject} · {currentQuestion.topic}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      themeSafe === "dark"
                        ? "border-zinc-500 text-gray-400"
                        : "border-gray-300 text-gray-600"
                    )}
                  >
                    {currentQuestion.level}
                  </Badge>
                </div>

                {currentQuestion.informativeText && (
                  <div
                    className={cn(
                      "p-4 rounded-lg border text-sm",
                      themeSafe === "dark"
                        ? "bg-zinc-700/50 border-zinc-600 text-gray-300"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    )}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeMathHtml(
                          renderMathInHtml(
                            currentQuestion.informativeText ?? ""
                          )
                        ),
                      }}
                    />
                  </div>
                )}

                {currentQuestion.informativeImages &&
                  currentQuestion.informativeImages.length > 0 && (
                    <div className="space-y-2">
                      {currentQuestion.informativeImages.map((url, idx) => (
                        <div key={idx} className="flex justify-center">
                          <img
                            src={url}
                            alt={`Información ${idx + 1}`}
                            className="max-w-full h-auto max-h-64 rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity object-contain"
                            onClick={() => setZoomedImage(url)}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                <div
                  className={cn(
                    "font-medium text-base leading-relaxed",
                    themeSafe === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: sanitizeMathHtml(
                        renderMathInHtml(
                          currentQuestion.questionText ?? ""
                        )
                      ),
                    }}
                  />
                </div>

                {currentQuestion.questionImages &&
                  currentQuestion.questionImages.length > 0 && (
                    <div className="space-y-2">
                      {currentQuestion.questionImages.map((url, idx) => (
                        <div key={idx} className="flex justify-center">
                          <img
                            src={url}
                            alt={`Pregunta ${idx + 1}`}
                            className="max-w-full h-auto max-h-64 rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity object-contain"
                            onClick={() => setZoomedImage(url)}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                <div className="space-y-2">
                  {(currentQuestion.options ?? []).map((option) => {
                    const isSelected =
                      selectedAnswers[currentIndex] === option.id;
                    const optionBg = isSelected
                      ? themeSafe === "dark"
                        ? "bg-blue-900/30 border-blue-600"
                        : "bg-blue-50 border-blue-200"
                      : themeSafe === "dark"
                        ? "bg-zinc-800/50 border-zinc-600 hover:bg-zinc-700/50"
                        : "bg-white border-gray-200 hover:bg-gray-50";
                    return (
                      <div
                        key={option.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setSelectedAnswers((prev) => ({
                            ...prev,
                            [currentIndex]: option.id,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [currentIndex]: option.id,
                            }));
                          }
                        }}
                        className={cn(
                          "p-3 rounded-lg border transition-colors cursor-pointer",
                          optionBg
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "font-semibold flex-shrink-0",
                              themeSafe === "dark"
                                ? "text-blue-400"
                                : "text-blue-600"
                            )}
                          >
                            {option.id}.
                          </span>
                          <div className="flex-1 min-w-0">
                            {option.text &&
                              option.text.trim() !== "" && (
                                <div
                                  className={cn(
                                    "text-sm",
                                    themeSafe === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-700"
                                  )}
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeMathHtml(
                                      renderMathInHtml(option.text)
                                    ),
                                  }}
                                />
                              )}
                            {option.imageUrl &&
                              option.imageUrl.trim() !== "" && (
                                <div className="mt-2 flex justify-center">
                                  <img
                                    src={option.imageUrl}
                                    alt={`Opción ${option.id}`}
                                    className="max-w-[200px] max-h-[140px] w-auto h-auto rounded-md cursor-zoom-in hover:opacity-90 transition-opacity object-contain"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomedImage(option.imageUrl);
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                            {(!option.text ||
                              option.text.trim() === "") &&
                              (!option.imageUrl ||
                                option.imageUrl.trim() === "") && (
                                <span
                                  className={cn(
                                    "text-sm italic",
                                    themeSafe === "dark"
                                      ? "text-gray-500"
                                      : "text-gray-500"
                                  )}
                                >
                                  {getOptionDisplayText(option)}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={cn(
                    "flex flex-wrap gap-2 pt-4 border-t mt-6",
                    themeSafe === "dark"
                      ? "border-zinc-600"
                      : "border-gray-200"
                  )}
                >
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
                        i >= questions.length - 1 ? i : i + 1
                      )
                    }
                    disabled={currentIndex >= questions.length - 1}
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
            </CardContent>
          </Card>
        )}

        {mode === "finished" && questions.length > 0 && (
          <Card
            className={cn(
              themeSafe === "dark"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-white border-gray-200"
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
                <p
                  className={cn(
                    themeSafe === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  )}
                >
                  Obtuviste {correctCount} de {questions.length} respuestas
                  correctas
                  {correctCount === questions.length ? " ¡Perfecto!" : ""}
                </p>
              </div>

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                {questions.map((q, idx) => {
                  const selectedId = selectedAnswers[idx];
                  const correctId = getCorrectOptionId(q.options ?? []);
                  const correct = isAnswerCorrect(
                    selectedId,
                    correctId,
                    q.options ?? []
                  );
                  const correctOption = (q.options ?? []).find(
                    (o) => o.id === correctId
                  );
                  const selectedOption = (q.options ?? []).find(
                    (o) => o.id === selectedId
                  );
                  const justification =
                    q.aiJustification?.correctAnswerExplanation ??
                    q.justification;

                  return (
                    <div
                      key={q.id ?? idx}
                      className={cn(
                        "p-4 rounded-lg border",
                        themeSafe === "dark"
                          ? "bg-zinc-800/50 border-zinc-600"
                          : "bg-gray-50 border-gray-200"
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
                          {correct ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "font-medium text-sm mb-1",
                              themeSafe === "dark"
                                ? "text-white"
                                : "text-gray-900"
                            )}
                          >
                            {idx + 1}.{" "}
                            <span
                              dangerouslySetInnerHTML={{
                                __html: sanitizeMathHtml(
                                  renderMathInHtml(
                                    q.questionText?.substring(0, 150) ?? ""
                                  )
                                ),
                              }}
                            />
                            {(q.questionText?.length ?? 0) > 150 && "..."}
                          </p>
                          {selectedId ? (
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
                              Tu respuesta:{" "}
                              {selectedOption?.text ? (
                                <span
                                  className="[&_.katex]:text-inherit"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeMathHtml(
                                      renderMathInHtml(selectedOption.text)
                                    ),
                                  }}
                                />
                              ) : (
                                selectedOption
                                  ? `Opción ${selectedOption.id}`
                                  : selectedId
                              )}
                            </p>
                          ) : (
                            <p
                              className={cn(
                                "text-sm",
                                themeSafe === "dark"
                                  ? "text-amber-400"
                                  : "text-amber-700"
                              )}
                            >
                              Sin responder
                            </p>
                          )}
                          {!correct && correctOption && (
                            <p
                              className={cn(
                                "text-sm mt-1",
                                themeSafe === "dark"
                                  ? "text-green-400"
                                  : "text-green-700"
                              )}
                            >
                              Respuesta correcta:{" "}
                              {correctOption.text ? (
                                <span
                                  className="[&_.katex]:text-inherit"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeMathHtml(
                                      renderMathInHtml(correctOption.text)
                                    ),
                                  }}
                                />
                              ) : (
                                `Opción ${correctOption.id}`
                              )}
                            </p>
                          )}
                          {justification && (
                            <div
                              className={cn(
                                "mt-3 p-3 rounded-lg text-sm border-l-4",
                                themeSafe === "dark"
                                  ? "bg-zinc-700/50 border-blue-500 text-gray-300"
                                  : "bg-blue-50 border-blue-400 text-gray-700"
                              )}
                            >
                              <span className="font-medium block mb-1">
                                Justificación:
                              </span>
                              <div className="leading-relaxed [&_.katex]:text-inherit">
                                <MathText text={justification} />
                              </div>
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Volver a inicio
              </Button>
            </CardContent>
          </Card>
        )}

        {mode === "finished" && questions.length === 0 && (
          <Card
            className={cn(
              "max-w-lg",
              themeSafe === "dark"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-white border-gray-200"
            )}
          >
            <CardContent className="pt-6 text-center">
              <p
                className={cn(
                  themeSafe === "dark"
                    ? "text-gray-400"
                    : "text-gray-600"
                )}
              >
                No hay resultados para mostrar.
              </p>
              <Button
                onClick={handleVolver}
                variant="outline"
                className="mt-4"
              >
                Volver a inicio
              </Button>
            </CardContent>
          </Card>
        )}
        {mode === "running" &&
          !currentQuestion &&
          questions.length === 0 &&
          !loading && (
            <Card
              className={cn(
                "max-w-lg",
                themeSafe === "dark"
                  ? "bg-zinc-800 border-zinc-700"
                  : "bg-white border-gray-200"
              )}
            >
              <CardContent className="pt-6 text-center">
                <p
                  className={cn(
                    themeSafe === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  )}
                >
                  No hay preguntas cargadas.
                </p>
                <Button
                  onClick={handleVolver}
                  variant="outline"
                  className="mt-4"
                >
                  Volver a inicio
                </Button>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Modal zoom imagen */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomedImage(null)}
          onKeyDown={(e) => e.key === "Escape" && setZoomedImage(null)}
          role="button"
          tabIndex={0}
        >
          <img
            src={zoomedImage}
            alt="Ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-white text-sm">
            <ZoomIn className="h-4 w-4" />
            Click fuera para cerrar
          </div>
        </div>
      )}
    </div>
  );
}
