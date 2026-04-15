import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopicPhaseData {
  topic: string
  phase1: number | null
  phase2: number | null
  phase3: number | null
}

interface TopicProgressChartProps {
  subjectName: string
  data: TopicPhaseData[]
  theme?: "light" | "dark"
  showTrend?: boolean
}

const PHASE_KEYS = ["Fase I", "Fase II", "Fase III"] as const

const PHASE_BAR_COLORS: Record<(typeof PHASE_KEYS)[number], string> = {
  "Fase I": "hsl(217, 91%, 55%)",
  "Fase II": "hsl(271, 91%, 58%)",
  "Fase III": "hsl(142, 71%, 45%)",
}

/**
 * Barras agrupadas por eje/tema: en el eje X cada tema; tres barras (Fase I, II, III)
 * para comparar el avance del salón en ese eje entre fases.
 */
export function TopicProgressChart({
  subjectName,
  data,
  theme = "light",
  showTrend = true,
}: TopicProgressChartProps) {
  const chartData = data.map((t) => ({
    eje: t.topic,
    "Fase I": t.phase1,
    "Fase II": t.phase2,
    "Fase III": t.phase3,
  }))

  const calculateTrend = (): {
    trend: "up" | "down" | "stable"
    percentage: number
  } => {
    const calculatePhaseAverage = (phaseKey: "phase1" | "phase2" | "phase3") => {
      const values = data
        .map((topic) => topic[phaseKey])
        .filter((val): val is number => val !== null)

      if (values.length === 0) return 0
      return values.reduce((sum, val) => sum + val, 0) / values.length
    }

    const phase1Avg = calculatePhaseAverage("phase1")
    const phase2Avg = calculatePhaseAverage("phase2")
    const phase3Avg = calculatePhaseAverage("phase3")

    let lastPhaseAvg = 0
    let firstPhaseAvg = 0

    if (phase1Avg > 0) firstPhaseAvg = phase1Avg

    if (phase3Avg > 0) {
      lastPhaseAvg = phase3Avg
    } else if (phase2Avg > 0) {
      lastPhaseAvg = phase2Avg
    } else if (phase1Avg > 0) {
      lastPhaseAvg = phase1Avg
    }

    if (firstPhaseAvg === 0 || lastPhaseAvg === 0) {
      return { trend: "stable", percentage: 0 }
    }

    const difference = lastPhaseAvg - firstPhaseAvg
    const percentageChange = (difference / firstPhaseAvg) * 100

    if (Math.abs(percentageChange) < 2) {
      return { trend: "stable", percentage: 0 }
    }

    return {
      trend: percentageChange > 0 ? "up" : "down",
      percentage: Math.abs(percentageChange),
    }
  }

  const trendData = calculateTrend()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const ejeNombre = typeof label === "string" ? label : ""
    return (
      <div
        className={cn(
          "rounded-lg border p-3 shadow-lg max-w-xs",
          theme === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
        )}
      >
        <p
          className={cn(
            "font-semibold mb-2 text-sm",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}
        >
          {ejeNombre}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const v = entry.value
            const display =
              v != null && typeof v === "number" ? `${v.toFixed(1)}%` : "Sin dato"
            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className={cn(theme === "dark" ? "text-gray-300" : "text-gray-600")}>
                  {entry.name}:
                </span>
                <span
                  className={cn(
                    "font-medium ml-auto",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  {display}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (
    data.length === 0 ||
    data.every(
      (topic) =>
        topic.phase1 === null && topic.phase2 === null && topic.phase3 === null
    )
  ) {
    return (
      <div
        className={cn(
          "text-center py-8",
          theme === "dark" ? "text-gray-400" : "text-gray-500"
        )}
      >
        <p>No hay datos suficientes para mostrar el progreso de temas en {subjectName}</p>
      </div>
    )
  }

  const angledTicks = data.length > 2

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={angledTicks ? 300 : 280}>
        <BarChart
          data={chartData}
          margin={{
            top: 8,
            right: 8,
            left: 4,
            bottom: angledTicks ? 8 : 4,
          }}
          barCategoryGap="18%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme === "dark" ? "#374151" : "#e5e7eb"}
            vertical={false}
          />
          <XAxis
            dataKey="eje"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            interval={0}
            angle={angledTicks ? -28 : 0}
            textAnchor={angledTicks ? "end" : "middle"}
            height={angledTicks ? 72 : 40}
            tick={{
              fill: theme === "dark" ? "#9ca3af" : "#6b7280",
              fontSize: 11,
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            width={36}
            tick={{
              fill: theme === "dark" ? "#9ca3af" : "#6b7280",
              fontSize: 12,
            }}
            label={{
              value: "%",
              angle: -90,
              position: "insideLeft",
              style: {
                fill: theme === "dark" ? "#9ca3af" : "#6b7280",
                fontSize: 12,
              },
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Legend
            wrapperStyle={{
              paddingTop: "8px",
              fontSize: "11px",
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
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {showTrend && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm">
            {trendData.trend === "up" && (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span
                  className={cn(
                    "font-medium",
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Tendencia: +{trendData.percentage.toFixed(1)}%
                </span>
              </>
            )}
            {trendData.trend === "down" && (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span
                  className={cn(
                    "font-medium",
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Tendencia: -{trendData.percentage.toFixed(1)}%
                </span>
              </>
            )}
            {trendData.trend === "stable" && (
              <>
                <Minus className="h-4 w-4 text-gray-500" />
                <span
                  className={cn(
                    "font-medium",
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  )}
                >
                  Tendencia: Estable
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
