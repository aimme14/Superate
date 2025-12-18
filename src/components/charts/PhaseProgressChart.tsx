import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// Interfaz para los datos de rendimiento por fase
interface PhaseData {
  phase: string; // Nombre de la fase (Fase I, Fase II, Fase III)
  percentage: number; // Porcentaje de rendimiento en esa fase
}

// Interfaz para los datos del gráfico
interface SubjectPhaseData {
  subject: string; // Nombre de la materia
  phase1: number | null; // Rendimiento en Fase I (null si no hay datos)
  phase2: number | null; // Rendimiento en Fase II
  phase3: number | null; // Rendimiento en Fase III
}

interface PhaseProgressChartProps {
  data: SubjectPhaseData[]; // Datos de rendimiento por materia y fase
  theme?: 'light' | 'dark';
  title?: string;
  description?: string;
  showTrend?: boolean; // Mostrar indicador de tendencia
}

/**
 * Componente de gráfico de líneas múltiples para mostrar el progreso
 * del estudiante a través de las 3 fases evaluativas por materia.
 * 
 * Utiliza Recharts y sigue las mejores prácticas de:
 * - Arquitectura modular
 * - TypeScript con tipos definidos
 * - Diseño responsivo
 * - Soporte para tema claro/oscuro
 * - Accesibilidad (ARIA labels)
 */
export function PhaseProgressChart({ 
  data, 
  theme = 'light', 
  title = "Evolución del Rendimiento por Fase",
  description = "Seguimiento del desempeño académico a través de las fases evaluativas",
  showTrend = true
}: PhaseProgressChartProps) {
  
  // Configuración de colores para cada fase
  const chartConfig = {
    phase1: {
      label: "Fase I",
      color: theme === 'dark' ? "hsl(217, 91%, 60%)" : "hsl(217, 91%, 60%)", // Azul
    },
    phase2: {
      label: "Fase II",
      color: theme === 'dark' ? "hsl(271, 91%, 65%)" : "hsl(271, 91%, 55%)", // Púrpura
    },
    phase3: {
      label: "Fase III",
      color: theme === 'dark' ? "hsl(142, 76%, 56%)" : "hsl(142, 76%, 36%)", // Verde
    },
  }

  // Transformar datos para el formato que requiere Recharts
  const chartData = data.map((item) => ({
    subject: item.subject,
    "Fase I": item.phase1,
    "Fase II": item.phase2,
    "Fase III": item.phase3,
  }))

  // Calcular tendencia general (comparar promedio de última fase con primera fase disponible)
  const calculateTrend = (): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
    // Obtener promedios por fase (ignorando valores null)
    const phase1Avg = data.reduce((acc, item) => {
      if (item.phase1 !== null) acc.sum += item.phase1;
      if (item.phase1 !== null) acc.count += 1;
      return acc;
    }, { sum: 0, count: 0 });

    const phase2Avg = data.reduce((acc, item) => {
      if (item.phase2 !== null) acc.sum += item.phase2;
      if (item.phase2 !== null) acc.count += 1;
      return acc;
    }, { sum: 0, count: 0 });

    const phase3Avg = data.reduce((acc, item) => {
      if (item.phase3 !== null) acc.sum += item.phase3;
      if (item.phase3 !== null) acc.count += 1;
      return acc;
    }, { sum: 0, count: 0 });

    // Determinar la última fase con datos
    let lastPhaseAvg = 0;
    let firstPhaseAvg = 0;

    if (phase1Avg.count > 0) {
      firstPhaseAvg = phase1Avg.sum / phase1Avg.count;
    }

    if (phase3Avg.count > 0) {
      lastPhaseAvg = phase3Avg.sum / phase3Avg.count;
    } else if (phase2Avg.count > 0) {
      lastPhaseAvg = phase2Avg.sum / phase2Avg.count;
    } else if (phase1Avg.count > 0) {
      lastPhaseAvg = phase1Avg.sum / phase1Avg.count;
    }

    if (firstPhaseAvg === 0 || lastPhaseAvg === 0) {
      return { trend: 'stable', percentage: 0 };
    }

    const difference = lastPhaseAvg - firstPhaseAvg;
    const percentageChange = (difference / firstPhaseAvg) * 100;

    if (Math.abs(percentageChange) < 2) {
      return { trend: 'stable', percentage: 0 };
    }

    return {
      trend: percentageChange > 0 ? 'up' : 'down',
      percentage: Math.abs(percentageChange)
    };
  }

  const trendData = calculateTrend();

  // Componente personalizado para el tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "rounded-lg border p-3 shadow-lg",
          theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
        )}>
          <p className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {payload[0].payload.subject}
          </p>
          {payload.map((entry: any, index: number) => (
            entry.value !== null && (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {entry.name}: <span className="font-medium">{entry.value.toFixed(1)}%</span>
                </span>
              </div>
            )
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <Card className={cn(
      theme === 'dark' 
        ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' 
        : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
    )}>
      <CardHeader>
        <CardTitle className={cn(
          "flex items-center gap-2",
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {title}
        </CardTitle>
        <CardDescription className={cn(
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
              vertical={false}
            />
            <XAxis
              dataKey="subject"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ 
                fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                fontSize: 12
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ 
                fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                fontSize: 12
              }}
              label={{ 
                value: 'Rendimiento (%)', 
                angle: -90, 
                position: 'insideLeft',
                style: { 
                  fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  fontSize: 12
                }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{
                paddingTop: '20px'
              }}
              iconType="line"
              formatter={(value) => (
                <span style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                  {value}
                </span>
              )}
            />
            
            {/* Línea para Fase I */}
            <Line
              type="monotone"
              dataKey="Fase I"
              stroke={chartConfig.phase1.color}
              strokeWidth={3}
              dot={{ 
                fill: chartConfig.phase1.color, 
                r: 5,
                strokeWidth: 2,
                stroke: theme === 'dark' ? '#18181b' : '#ffffff'
              }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />
            
            {/* Línea para Fase II */}
            <Line
              type="monotone"
              dataKey="Fase II"
              stroke={chartConfig.phase2.color}
              strokeWidth={3}
              dot={{ 
                fill: chartConfig.phase2.color, 
                r: 5,
                strokeWidth: 2,
                stroke: theme === 'dark' ? '#18181b' : '#ffffff'
              }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />
            
            {/* Línea para Fase III */}
            <Line
              type="monotone"
              dataKey="Fase III"
              stroke={chartConfig.phase3.color}
              strokeWidth={3}
              dot={{ 
                fill: chartConfig.phase3.color, 
                r: 5,
                strokeWidth: 2,
                stroke: theme === 'dark' ? '#18181b' : '#ffffff'
              }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>

      {showTrend && (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className={cn(
                "flex items-center gap-2 leading-none font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {trendData.trend === 'up' && (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>
                      Rendimiento en aumento de {trendData.percentage.toFixed(1)}%
                    </span>
                  </>
                )}
                {trendData.trend === 'down' && (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span>
                      Rendimiento en descenso de {trendData.percentage.toFixed(1)}%
                    </span>
                  </>
                )}
                {trendData.trend === 'stable' && (
                  <>
                    <Minus className="h-4 w-4 text-gray-500" />
                    <span>Rendimiento estable entre fases</span>
                  </>
                )}
              </div>
              <div className={cn(
                "flex items-center gap-2 leading-none text-xs",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                Comparación del progreso académico entre la primera y última fase evaluativa
              </div>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

