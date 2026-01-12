import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TopicData {
  name: string;
  percentage: number;
  correct: number;
  total: number;
}

interface SubjectWithTopics {
  name: string;
  percentage: number;
  topics: TopicData[];
}

interface TopicsHeatmapProps {
  subjectsWithTopics: SubjectWithTopics[];
  theme?: 'light' | 'dark';
}

export function TopicsHeatmap({ subjectsWithTopics, theme = 'light' }: TopicsHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{subject: string, topic: string} | null>(null);

  // Función para obtener el color según el porcentaje
  const getHeatColor = (percentage: number): string => {
    if (percentage >= 80) return theme === 'dark' ? 'bg-green-500' : 'bg-green-500';
    if (percentage >= 70) return theme === 'dark' ? 'bg-green-600' : 'bg-green-400';
    if (percentage >= 60) return theme === 'dark' ? 'bg-yellow-600' : 'bg-yellow-400';
    if (percentage >= 50) return theme === 'dark' ? 'bg-orange-600' : 'bg-orange-400';
    if (percentage >= 40) return theme === 'dark' ? 'bg-red-600' : 'bg-red-400';
    return theme === 'dark' ? 'bg-red-700' : 'bg-red-500';
  };

  // Función para obtener el ícono de tendencia
  const getTrendIcon = (percentage: number) => {
    if (percentage >= 70) return <TrendingUp className="h-3 w-3" />;
    if (percentage >= 60) return <Minus className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  // Obtener todos los temas únicos (para las columnas)
  const allTopics = Array.from(
    new Set(subjectsWithTopics.flatMap(subject => subject.topics.map(topic => topic.name)))
  );

  if (subjectsWithTopics.length === 0 || allTopics.length === 0) {
    return (
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos suficientes para generar el mapa de calor
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
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <div className="h-5 w-5 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded"></div>
          Mapa de Calor por Temas
        </CardTitle>
        <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Visualización del rendimiento en cada tema por materia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-gray-200 dark:border-zinc-700">
          <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Leyenda:
          </span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>≥80% Excelente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded"></div>
            <span className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>60-79% Bueno</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-400 rounded"></div>
            <span className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>50-59% Regular</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className={cn("text-xs", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>&lt;50% Deficiente</span>
          </div>
        </div>

        {/* Mapa de calor por materia */}
        <div className="space-y-6">
          {subjectsWithTopics.map((subject) => (
            <div key={subject.name} className={cn(
              "p-4 rounded-lg border",
              theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-gray-50 border-gray-200'
            )}>
              <div className="flex items-center justify-between mb-3">
                <h4 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {subject.name}
                </h4>
                <Badge 
                  variant="outline" 
                  className={cn(
                    subject.percentage >= 70 
                      ? theme === 'dark' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'
                      : subject.percentage >= 60
                        ? theme === 'dark' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : theme === 'dark' ? 'bg-red-900 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200'
                  )}
                >
                  {subject.percentage}% promedio
                </Badge>
              </div>

              {/* Grid de temas */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {subject.topics.map((topic) => {
                  const isHovered = hoveredCell?.subject === subject.name && hoveredCell?.topic === topic.name;
                  return (
                    <div
                      key={topic.name}
                      className={cn(
                        "relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200",
                        "border-2 border-transparent hover:border-white hover:scale-105 hover:z-10",
                        getHeatColor(topic.percentage)
                      )}
                      onMouseEnter={() => setHoveredCell({ subject: subject.name, topic: topic.name })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="p-3 h-24 flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                          <span className="text-white text-xs font-medium line-clamp-2 flex-1">
                            {topic.name}
                          </span>
                          <span className="text-white ml-1">
                            {getTrendIcon(topic.percentage)}
                          </span>
                        </div>
                        <div className="text-white">
                          <div className="text-lg font-bold">{topic.percentage}%</div>
                          <div className="text-[10px] opacity-90">{topic.correct}/{topic.total}</div>
                        </div>
                      </div>

                      {/* Tooltip al hacer hover */}
                      {isHovered && (
                        <div className={cn(
                          "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg shadow-lg z-20 whitespace-nowrap",
                          theme === 'dark' ? 'bg-zinc-900 border border-zinc-700' : 'bg-white border border-gray-200'
                        )}>
                          <div className={cn("text-xs font-semibold mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {topic.name}
                          </div>
                          <div className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            Rendimiento: {topic.percentage}%
                          </div>
                          <div className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            Correctas: {topic.correct} de {topic.total}
                          </div>
                          {/* Flecha del tooltip */}
                          <div className={cn(
                            "absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent",
                            theme === 'dark' ? 'border-t-zinc-900' : 'border-t-white'
                          )}></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumen de la materia */}
              <div className={cn(
                "mt-3 pt-3 border-t",
                theme === 'dark' ? 'border-zinc-700' : 'border-gray-300'
              )}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      <span className="font-medium text-green-500">
                        {subject.topics.filter(t => t.percentage >= 65).length}
                      </span> fortalezas
                    </div>
                    <div className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      <span className="font-medium text-yellow-500">
                        {subject.topics.filter(t => t.percentage >= 50 && t.percentage < 65).length}
                      </span> en progreso
                    </div>
                    <div className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      <span className="font-medium text-red-500">
                        {subject.topics.filter(t => t.percentage < 50).length}
                      </span> a mejorar
                    </div>
                  </div>
                  <div className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {subject.topics.length} temas evaluados
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen Global */}
        <div className={cn(
          "p-4 rounded-lg border mt-4",
          theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
        )}>
          <h4 className={cn(
            "font-medium mb-2",
            theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
          )}>
            Resumen Global
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
                Total de Temas
              </div>
              <div className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-blue-900')}>
                {subjectsWithTopics.reduce((sum, s) => sum + s.topics.length, 0)}
              </div>
            </div>
            <div>
              <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
                Fortalezas
              </div>
              <div className="text-lg font-bold text-green-500">
                {subjectsWithTopics.reduce((sum, s) => sum + s.topics.filter(t => t.percentage >= 65).length, 0)}
              </div>
            </div>
            <div>
              <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
                En Progreso
              </div>
              <div className="text-lg font-bold text-yellow-500">
                {subjectsWithTopics.reduce((sum, s) => sum + s.topics.filter(t => t.percentage >= 50 && t.percentage < 65).length, 0)}
              </div>
            </div>
            <div>
              <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-700')}>
                A Mejorar
              </div>
              <div className="text-lg font-bold text-red-500">
                {subjectsWithTopics.reduce((sum, s) => sum + s.topics.filter(t => t.percentage < 60).length, 0)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

