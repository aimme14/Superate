import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Star, TrendingUp, AlertTriangle } from 'lucide-react';

interface SubjectAnalysis {
  name: string;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  percentage: number;
}

interface StrengthsRadarChartProps {
  subjects: SubjectAnalysis[];
  theme?: 'light' | 'dark';
}

export function StrengthsRadarChart({ subjects, theme = 'light' }: StrengthsRadarChartProps) {
  
  // Preparar datos para el radar chart
  const radarData = subjects.map(subject => ({
    subject: subject.name.length > 12 ? subject.name.substring(0, 12) + '...' : subject.name,
    fullName: subject.name,
    rendimiento: subject.percentage,
    meta: 70, // Meta mínima esperada
  }));

  // Configuración del chart
  const chartConfig = {
    rendimiento: {
      label: "Tu Rendimiento",
      color: theme === 'dark' ? "hsl(217, 91%, 60%)" : "hsl(217, 91%, 60%)",
    },
    meta: {
      label: "Meta (70%)",
      color: theme === 'dark' ? "hsl(142, 76%, 36%)" : "hsl(142, 76%, 36%)",
    },
  } satisfies ChartConfig;

  if (subjects.length === 0) {
    return (
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Star className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para generar el gráfico de radar
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
    )}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <Star className="h-5 w-5 text-yellow-500" />
          Radar de Fortalezas y Debilidades
        </CardTitle>
        <CardDescription className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Análisis comparativo del rendimiento por materia
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        {/* Gráfico de Radar */}
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[280px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <Tooltip content={<ChartTooltipContent />} />
              <PolarAngleAxis 
                dataKey="subject"
                tick={{ 
                  fill: theme === 'dark' ? '#9ca3af' : '#4b5563',
                  fontSize: 11
                }}
              />
              <PolarGrid 
                stroke={theme === 'dark' ? '#444' : '#ccc'}
                strokeDasharray="3 3"
              />
              <Radar
                dataKey="meta"
                stroke="hsl(142, 76%, 36%)"
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.15}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{
                  r: 3,
                  fillOpacity: 0.8,
                }}
              />
              <Radar
                dataKey="rendimiento"
                stroke="hsl(217, 91%, 60%)"
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.6}
                strokeWidth={2}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Resumen: Mejor y Peor materia */}
        <div className={cn("flex items-center justify-between mt-3 pt-3 border-t text-xs", theme === 'dark' ? 'border-zinc-700' : 'border-gray-200')}>
          {/* Materia más fuerte */}
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Mejor:
            </span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {subjects.length > 0 ? 
                subjects.reduce((prev, current) => (prev.percentage > current.percentage) ? prev : current).name.split(' ')[0]
                : 'N/A'
              }
            </span>
          </div>

          {/* Separador */}
          <span className={cn("text-gray-400", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')}>•</span>

          {/* Materia más débil */}
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              A mejorar:
            </span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {subjects.length > 0 ? 
                subjects.reduce((prev, current) => (prev.percentage < current.percentage) ? prev : current).name.split(' ')[0]
                : 'N/A'
              }
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

