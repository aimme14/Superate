import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";
import { BookOpen } from 'lucide-react';

interface SubjectData {
  name: string;
  percentage: number;
}

interface PhaseData {
  phase: 'phase1' | 'phase2' | 'phase3';
  subjects: SubjectData[];
}

interface SubjectsProgressChartProps {
  phase1Data: PhaseData | null;
  phase2Data: PhaseData | null;
  phase3Data: PhaseData | null;
  theme?: 'light' | 'dark';
}

// Colores para las líneas (uno por materia)
const COLORS = [
  'hsl(217, 91%, 60%)',  // Azul
  'hsl(271, 91%, 60%)',  // Púrpura
  'hsl(142, 76%, 45%)',  // Verde
  'hsl(48, 96%, 53%)',   // Amarillo
  'hsl(0, 84%, 60%)',    // Rojo
  'hsl(24, 95%, 53%)',   // Naranja
  'hsl(189, 85%, 51%)',  // Cyan
];

export function SubjectsProgressChart({ 
  phase1Data, 
  phase2Data, 
  phase3Data, 
  theme = 'light' 
}: SubjectsProgressChartProps) {
  
  // Obtener todas las materias únicas
  const allSubjects = new Set<string>();
  [phase1Data, phase2Data, phase3Data].forEach(phaseData => {
    if (phaseData) {
      phaseData.subjects.forEach(subject => allSubjects.add(subject.name));
    }
  });

  const subjectsList = Array.from(allSubjects);

  // Preparar datos para el gráfico
  const chartData = [
    {
      fase: 'Fase I',
      ...subjectsList.reduce((acc, subjectName) => {
        const subject = phase1Data?.subjects.find(s => s.name === subjectName);
        acc[subjectName] = subject ? subject.percentage : null;
        return acc;
      }, {} as Record<string, number | null>)
    },
    {
      fase: 'Fase II',
      ...subjectsList.reduce((acc, subjectName) => {
        const subject = phase2Data?.subjects.find(s => s.name === subjectName);
        acc[subjectName] = subject ? subject.percentage : null;
        return acc;
      }, {} as Record<string, number | null>)
    },
    {
      fase: 'Fase III',
      ...subjectsList.reduce((acc, subjectName) => {
        const subject = phase3Data?.subjects.find(s => s.name === subjectName);
        acc[subjectName] = subject ? subject.percentage : null;
        return acc;
      }, {} as Record<string, number | null>)
    }
  ];

  // Calcular promedio actual (última fase con datos)
  const currentAverage = phase3Data 
    ? phase3Data.subjects.reduce((sum, s) => sum + s.percentage, 0) / (phase3Data.subjects.length || 1)
    : phase2Data 
      ? phase2Data.subjects.reduce((sum, s) => sum + s.percentage, 0) / (phase2Data.subjects.length || 1)
      : phase1Data 
        ? phase1Data.subjects.reduce((sum, s) => sum + s.percentage, 0) / (phase1Data.subjects.length || 1)
        : 0;

  // Tooltip personalizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "p-3 rounded-lg shadow-lg border",
          theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
        )}>
          <p className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                {entry.name}:
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value ? `${entry.value.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (subjectsList.length === 0) {
    return (
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para generar el gráfico
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
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <div>
              <CardTitle className={cn("text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Evolución por Materia
              </CardTitle>
              <CardDescription className={cn("text-xs mt-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {subjectsList.length} materias evaluadas
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <Badge 
              variant="outline" 
              className={cn(
                "text-sm font-bold",
                currentAverage >= 70 
                  ? theme === 'dark' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'
                  : currentAverage >= 60
                    ? theme === 'dark' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : theme === 'dark' ? 'bg-red-900 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200'
              )}
            >
              {currentAverage.toFixed(0)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {/* Gráfico de Líneas */}
        <div className="w-full h-[310px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme === 'dark' ? '#444' : '#e5e7eb'}
              />
              <XAxis 
                dataKey="fase" 
                tick={{ 
                  fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  fontSize: 11
                }}
                stroke={theme === 'dark' ? '#444' : '#d1d5db'}
              />
              <YAxis 
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ 
                  fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  fontSize: 11
                }}
                stroke={theme === 'dark' ? '#444' : '#d1d5db'}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ 
                  fontSize: '10px',
                  paddingTop: '10px'
                }}
                iconSize={8}
              />
              {subjectsList.map((subjectName, index) => (
                <Line
                  key={subjectName}
                  type="monotone"
                  dataKey={subjectName}
                  name={subjectName.length > 20 ? subjectName.substring(0, 20) + '...' : subjectName}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

