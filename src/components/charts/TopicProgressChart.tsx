import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// Interfaz para los datos de un tema a través de las fases
interface TopicPhaseData {
  topic: string;          // Nombre del tema
  phase1: number | null;  // Rendimiento en Fase I (null si no hay datos)
  phase2: number | null;  // Rendimiento en Fase II
  phase3: number | null;  // Rendimiento en Fase III
}

interface TopicProgressChartProps {
  subjectName: string;    // Nombre de la materia
  data: TopicPhaseData[]; // Datos de temas por fase
  theme?: 'light' | 'dark';
  showTrend?: boolean;
}

/**
 * Componente de gráfico de líneas múltiples para mostrar el progreso
 * de los TEMAS de una materia a través de las 3 fases evaluativas.
 * 
 * Cada línea representa un tema diferente de la materia.
 * Por ejemplo, en Matemáticas podría haber:
 * - Álgebra (línea 1)
 * - Geometría (línea 2)
 * - Estadística (línea 3)
 * - Cálculo (línea 4)
 */
export function TopicProgressChart({ 
  subjectName,
  data, 
  theme = 'light',
  showTrend = true
}: TopicProgressChartProps) {
  
  // Paleta de colores para las líneas (hasta 12 temas diferentes)
  const colorPalette = [
    theme === 'dark' ? "hsl(217, 91%, 60%)" : "hsl(217, 91%, 50%)",  // Azul
    theme === 'dark' ? "hsl(271, 91%, 65%)" : "hsl(271, 91%, 55%)",  // Púrpura
    theme === 'dark' ? "hsl(142, 76%, 56%)" : "hsl(142, 76%, 46%)",  // Verde
    theme === 'dark' ? "hsl(48, 96%, 53%)" : "hsl(48, 96%, 43%)",    // Amarillo
    theme === 'dark' ? "hsl(0, 84%, 60%)" : "hsl(0, 84%, 50%)",      // Rojo
    theme === 'dark' ? "hsl(24, 95%, 53%)" : "hsl(24, 95%, 43%)",    // Naranja
    theme === 'dark' ? "hsl(280, 87%, 65%)" : "hsl(280, 87%, 55%)",  // Rosa
    theme === 'dark' ? "hsl(189, 94%, 43%)" : "hsl(189, 94%, 33%)",  // Cian
    theme === 'dark' ? "hsl(84, 81%, 44%)" : "hsl(84, 81%, 34%)",    // Lima
    theme === 'dark' ? "hsl(45, 93%, 47%)" : "hsl(45, 93%, 37%)",    // Ámbar
    theme === 'dark' ? "hsl(262, 83%, 58%)" : "hsl(262, 83%, 48%)",  // Índigo
    theme === 'dark' ? "hsl(338, 82%, 60%)" : "hsl(338, 82%, 50%)",  // Fucsia
  ];

  // Transformar datos para el formato que requiere Recharts
  const chartData = [
    {
      phase: "Fase I",
      ...data.reduce((acc, topic) => {
        acc[topic.topic] = topic.phase1;
        return acc;
      }, {} as Record<string, number | null>)
    },
    {
      phase: "Fase II",
      ...data.reduce((acc, topic) => {
        acc[topic.topic] = topic.phase2;
        return acc;
      }, {} as Record<string, number | null>)
    },
    {
      phase: "Fase III",
      ...data.reduce((acc, topic) => {
        acc[topic.topic] = topic.phase3;
        return acc;
      }, {} as Record<string, number | null>)
    }
  ];

  // Calcular tendencia general (comparar promedio de última fase con primera fase)
  const calculateTrend = (): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
    // Calcular promedios por fase (ignorando valores null)
    const calculatePhaseAverage = (phaseKey: 'phase1' | 'phase2' | 'phase3') => {
      const values = data
        .map(topic => topic[phaseKey])
        .filter((val): val is number => val !== null);
      
      if (values.length === 0) return 0;
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    };

    const phase1Avg = calculatePhaseAverage('phase1');
    const phase2Avg = calculatePhaseAverage('phase2');
    const phase3Avg = calculatePhaseAverage('phase3');

    // Determinar la última fase con datos
    let lastPhaseAvg = 0;
    let firstPhaseAvg = 0;

    if (phase1Avg > 0) firstPhaseAvg = phase1Avg;
    
    if (phase3Avg > 0) {
      lastPhaseAvg = phase3Avg;
    } else if (phase2Avg > 0) {
      lastPhaseAvg = phase2Avg;
    } else if (phase1Avg > 0) {
      lastPhaseAvg = phase1Avg;
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
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "rounded-lg border p-3 shadow-lg",
          theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
        )}>
          <p className={cn("font-semibold mb-2 text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              entry.value !== null && entry.value !== undefined && (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className={cn("truncate max-w-[180px]", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    {entry.name}:
                  </span>
                  <span className={cn("font-medium ml-auto", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}%
                  </span>
                </div>
              )
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  // Si no hay datos, mostrar mensaje
  if (data.length === 0 || data.every(topic => topic.phase1 === null && topic.phase2 === null && topic.phase3 === null)) {
    return (
      <div className={cn(
        "text-center py-8",
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      )}>
        <p>No hay datos suficientes para mostrar el progreso de temas en {subjectName}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 5,
            left: -5,
            bottom: 5,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
            vertical={false}
          />
          <XAxis
            dataKey="phase"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ 
              fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
              fontSize: 13
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tick={{ 
              fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
              fontSize: 12
            }}
            label={{ 
              value: '%', 
              angle: -90, 
              position: 'insideLeft',
              style: { 
                fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                fontSize: 13
              }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{
              paddingTop: '8px',
              fontSize: '12px'
            }}
            iconType="line"
            iconSize={12}
            formatter={(value) => (
              <span 
                style={{ 
                  color: theme === 'dark' ? '#d1d5db' : '#374151',
                  fontSize: '11px'
                }}
                className="truncate max-w-[100px] inline-block"
                title={value}
              >
                {value}
              </span>
            )}
          />
          
          {/* Crear una línea por cada tema */}
          {data.map((topic, index) => (
            <Line
              key={topic.topic}
              type="monotone"
              dataKey={topic.topic}
              stroke={colorPalette[index % colorPalette.length]}
              strokeWidth={2}
              dot={{ 
                fill: colorPalette[index % colorPalette.length], 
                r: 3,
                strokeWidth: 1.5,
                stroke: theme === 'dark' ? '#18181b' : '#ffffff'
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {showTrend && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm">
            {trendData.trend === 'up' && (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Tendencia: +{trendData.percentage.toFixed(1)}%
                </span>
              </>
            )}
            {trendData.trend === 'down' && (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Tendencia: -{trendData.percentage.toFixed(1)}%
                </span>
              </>
            )}
            {trendData.trend === 'stable' && (
              <>
                <Minus className="h-4 w-4 text-gray-500" />
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
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

