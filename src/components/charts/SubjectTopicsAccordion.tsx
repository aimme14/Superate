import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { TopicProgressChart } from "./TopicProgressChart"
import { cn } from "@/lib/utils"
import { BookOpen, TrendingUp, TrendingDown, Minus } from "lucide-react"

// Interfaz para los datos de un tema a través de las fases
interface TopicPhaseData {
  topic: string;
  phase1: number | null;
  phase2: number | null;
  phase3: number | null;
}

// Interfaz para los datos de una materia completa
interface SubjectWithTopics {
  subjectName: string;
  topics: TopicPhaseData[];
  averagePerformance: number; // Promedio general de la materia
  trend: 'up' | 'down' | 'stable'; // Tendencia de la materia
}

interface SubjectTopicsAccordionProps {
  subjects: SubjectWithTopics[];
  theme?: 'light' | 'dark';
}

/**
 * Componente acordeón que muestra las materias de forma expandible.
 * Cada materia contiene un gráfico de líneas con sus temas.
 * 
 * Ejemplo:
 * - [>] Matemáticas (85%) ↑
 *   - Gráfico con: Álgebra, Geometría, Estadística, Cálculo
 * - [>] Lenguaje (72%) →
 *   - Gráfico con: Comprensión Lectora, Gramática, etc.
 */
export function SubjectTopicsAccordion({ 
  subjects, 
  theme = 'light' 
}: SubjectTopicsAccordionProps) {
  
  // Función para obtener el color del badge según el rendimiento
  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) {
      return theme === 'dark' 
        ? "bg-green-900/30 text-green-300 border-green-700" 
        : "bg-green-100 text-green-800 border-green-200";
    }
    if (percentage >= 60) {
      return theme === 'dark'
        ? "bg-yellow-900/30 text-yellow-300 border-yellow-700"
        : "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
    return theme === 'dark'
      ? "bg-red-900/30 text-red-300 border-red-700"
      : "bg-red-100 text-red-800 border-red-200";
  };

  // Función para obtener el ícono de tendencia
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
      case 'stable':
        return <Minus className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  if (subjects.length === 0) {
    return (
      <div className={cn(
        "text-center py-8",
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      )}>
        <BookOpen className={cn(
          "h-12 w-12 mx-auto mb-4",
          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
        )} />
        <p>No hay datos de temas disponibles para mostrar</p>
        <p className="text-sm mt-2">
          Completa evaluaciones en al menos 2 fases para ver el seguimiento
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
      {subjects.map((subject) => (
        <Accordion type="single" collapsible defaultValue={subject.subjectName} className="w-full">
          <AccordionItem 
            key={subject.subjectName} 
            value={subject.subjectName}
            className={cn(
              "border rounded-lg overflow-hidden transition-all",
              theme === 'dark' 
                ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800' 
                : 'border-gray-200 bg-white hover:shadow-md'
            )}
          >
          <AccordionTrigger 
            className={cn(
              "px-3 py-2.5 hover:no-underline",
              theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
            )}
          >
            <div className="flex items-center justify-between w-full pr-4">
              {/* Nombre de la materia y número de temas */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
                  theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'
                )}>
                  <BookOpen className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h3 className={cn(
                    "font-semibold text-sm truncate",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {subject.subjectName}
                  </h3>
                  <p className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    {subject.topics.length} tema{subject.topics.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Badges de rendimiento y tendencia */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5",
                    getPerformanceColor(subject.averagePerformance)
                  )}
                >
                  {subject.averagePerformance.toFixed(0)}%
                </Badge>
                <div className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0",
                  theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'
                )}>
                  {getTrendIcon(subject.trend)}
                </div>
              </div>
            </div>
          </AccordionTrigger>
          
          <AccordionContent>
            <div className={cn(
              "px-3 pb-2 pt-1",
              theme === 'dark' ? 'bg-zinc-900/50' : 'bg-gray-50/50'
            )}>
              {/* Gráfico de temas */}
              <TopicProgressChart
                subjectName={subject.subjectName}
                data={subject.topics}
                theme={theme}
                showTrend={true}
              />
            </div>
          </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  );
}

