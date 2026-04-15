import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

interface SubjectData {
  name: string;
  percentage: number;
}

interface PhaseData {
  phase: "phase1" | "phase2" | "phase3";
  subjects: SubjectData[];
}

interface SubjectsProgressChartProps {
  phase1Data: PhaseData | null;
  phase2Data: PhaseData | null;
  phase3Data: PhaseData | null;
  theme?: "light" | "dark";
}

const PHASE_KEYS = ["Fase I", "Fase II", "Fase III"] as const;

/** Un color por fase (misma leyenda en todas las materias) */
const PHASE_BAR_COLORS: Record<(typeof PHASE_KEYS)[number], string> = {
  "Fase I": "hsl(217, 91%, 55%)",
  "Fase II": "hsl(271, 91%, 58%)",
  "Fase III": "hsl(142, 71%, 45%)",
};

export function SubjectsProgressChart({
  phase1Data,
  phase2Data,
  phase3Data,
  theme = "light",
}: SubjectsProgressChartProps) {
  const allSubjects = new Set<string>();
  [phase1Data, phase2Data, phase3Data].forEach((phaseData) => {
    if (phaseData) {
      phaseData.subjects.forEach((subject) => allSubjects.add(subject.name));
    }
  });

  const subjectsList = Array.from(allSubjects).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  const chartData = subjectsList.map((subjectName) => ({
    materia: subjectName,
    "Fase I":
      phase1Data?.subjects.find((s) => s.name === subjectName)?.percentage ??
      null,
    "Fase II":
      phase2Data?.subjects.find((s) => s.name === subjectName)?.percentage ??
      null,
    "Fase III":
      phase3Data?.subjects.find((s) => s.name === subjectName)?.percentage ??
      null,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const fullName = typeof label === "string" ? label : "";
    return (
      <div
        className={cn(
          "p-3 rounded-lg shadow-lg border max-w-xs",
          theme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"
        )}
      >
        <p
          className={cn(
            "font-semibold mb-2",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}
        >
          {fullName}
        </p>
        {payload.map((entry: any, index: number) => {
          const v = entry.value;
          const display =
            v != null && typeof v === "number" ? `${v.toFixed(1)}%` : "Sin dato";
          return (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={cn(theme === "dark" ? "text-gray-300" : "text-gray-700")}
              >
                {entry.name}:
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {display}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (subjectsList.length === 0) {
    return (
      <Card
        className={cn(
          theme === "dark"
            ? "bg-zinc-800/80 border-zinc-700/50 shadow-lg"
            : "bg-white/90 border-gray-200 shadow-md backdrop-blur-sm"
        )}
      >
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BookOpen
              className={cn(
                "h-12 w-12 mx-auto mb-4",
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              )}
            />
            <p
              className={cn(
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              No hay datos disponibles para generar el gráfico
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        theme === "dark"
          ? "bg-zinc-800/80 border-zinc-700/50 shadow-lg"
          : "bg-white/90 border-gray-200 shadow-md backdrop-blur-sm"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <div>
            <CardTitle
              className={cn(
                "text-base",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              Evolución por Materia
            </CardTitle>
            <CardDescription
              className={cn(
                "text-xs mt-0.5",
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              )}
            >
              Tres barras por materia (Fase I, II y III) para comparar tu avance
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="w-full h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
              barCategoryGap="18%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === "dark" ? "#444" : "#e5e7eb"}
              />
              <XAxis
                dataKey="materia"
                tick={{
                  fill: theme === "dark" ? "#9ca3af" : "#6b7280",
                  fontSize: 10,
                }}
                stroke={theme === "dark" ? "#444" : "#d1d5db"}
                interval={0}
                angle={subjectsList.length > 4 ? -32 : 0}
                textAnchor={subjectsList.length > 4 ? "end" : "middle"}
                height={subjectsList.length > 4 ? 68 : 36}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{
                  fill: theme === "dark" ? "#9ca3af" : "#6b7280",
                  fontSize: 11,
                }}
                stroke={theme === "dark" ? "#444" : "#d1d5db"}
                width={36}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  paddingTop: "8px",
                }}
                iconType="square"
                iconSize={10}
              />
              {PHASE_KEYS.map((phaseKey) => (
                <Bar
                  key={phaseKey}
                  dataKey={phaseKey}
                  name={phaseKey}
                  fill={PHASE_BAR_COLORS[phaseKey]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
