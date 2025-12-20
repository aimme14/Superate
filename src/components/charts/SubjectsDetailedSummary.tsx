import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SubjectAnalysis {
  name: string;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  percentage: number;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
}

interface TopicAnalysis {
  name: string;
  percentage: number;
  correct: number;
  total: number;
}

interface SubjectWithTopics {
  name: string;
  percentage: number;
  topics: TopicAnalysis[];
  strengths: string[];
  weaknesses: string[];
  neutrals: string[];
}

interface SubjectsDetailedSummaryProps {
  subjects: SubjectAnalysis[];
  subjectsWithTopics?: SubjectWithTopics[];
  theme?: 'light' | 'dark';
}

export function SubjectsDetailedSummary({ subjects, subjectsWithTopics, theme = 'light' }: SubjectsDetailedSummaryProps) {
  
  // Función para generar resumen general del estudiante
  const generateGeneralSummary = (): string => {
    if (subjects.length === 0) return '';

    const totalQuestions = subjects.reduce((sum, s) => sum + s.total, 0);
    const totalCorrect = subjects.reduce((sum, s) => sum + s.correct, 0);
    const averagePercentage = subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length;
    
    const strongSubjects = subjects.filter(s => s.percentage >= 70);
    const weakSubjects = subjects.filter(s => s.percentage < 60);
    const moderateSubjects = subjects.filter(s => s.percentage >= 60 && s.percentage < 70);

    let summary = `El estudiante ha completado un total de ${totalQuestions} preguntas, respondiendo correctamente ${totalCorrect} de ellas, lo que representa un promedio general de ${averagePercentage.toFixed(1)}%. `;

    if (averagePercentage >= 70) {
      summary += `Su desempeño es satisfactorio, demostrando un buen nivel de comprensión en la mayoría de las áreas evaluadas. `;
    } else if (averagePercentage >= 60) {
      summary += `Su desempeño es aceptable, aunque presenta oportunidades de mejora en varias materias. `;
    } else {
      summary += `Su desempeño actual requiere atención, siendo necesario reforzar significativamente los conocimientos en múltiples áreas. `;
    }

    if (strongSubjects.length > 0) {
      summary += `Destaca especialmente en ${strongSubjects.length} materia${strongSubjects.length > 1 ? 's' : ''}, `;
    }
    
    if (moderateSubjects.length > 0) {
      summary += `presenta un nivel intermedio en ${moderateSubjects.length} materia${moderateSubjects.length > 1 ? 's' : ''}, `;
    }

    if (weakSubjects.length > 0) {
      summary += `y necesita reforzar ${weakSubjects.length} materia${weakSubjects.length > 1 ? 's' : ''} donde su rendimiento está por debajo del 60%. `;
    } else {
      summary += `y mantiene un rendimiento consistente en todas las materias evaluadas. `;
    }

    if (averagePercentage >= 70) {
      summary += `Se recomienda continuar con el ritmo de estudio actual y profundizar en los temas avanzados.`;
    } else if (averagePercentage >= 60) {
      summary += `Se sugiere dedicar tiempo adicional al repaso de conceptos fundamentales y aumentar la práctica con ejercicios variados.`;
    } else {
      summary += `Es crucial implementar un plan de estudio intensivo, buscar apoyo académico adicional y establecer metas de mejora a corto plazo.`;
    }

    return summary;
  };

  // Función para generar resumen detallado de una materia
  const generateSubjectSummary = (subject: SubjectAnalysis): string => {
    const { name, percentage, correct, total, strengths, weaknesses } = subject;
    
    // Buscar información de temas si está disponible
    const subjectWithTopics = subjectsWithTopics?.find(s => s.name === name);
    
    // Determinar nivel de desempeño
    let performanceLevel = '';
    let performanceDescription = '';
    
    if (percentage >= 80) {
      performanceLevel = 'excelente';
      performanceDescription = 'Ha demostrado un dominio sobresaliente de los contenidos evaluados';
    } else if (percentage >= 70) {
      performanceLevel = 'bueno';
      performanceDescription = 'Ha alcanzado un nivel satisfactorio en el dominio de los contenidos';
    } else if (percentage >= 60) {
      performanceLevel = 'aceptable';
      performanceDescription = 'Ha logrado comprender los conceptos básicos, aunque requiere reforzar algunos aspectos';
    } else if (percentage >= 50) {
      performanceLevel = 'insuficiente';
      performanceDescription = 'Presenta dificultades significativas que requieren atención inmediata';
    } else {
      performanceLevel = 'crítico';
      performanceDescription = 'Necesita un plan de intervención urgente para mejorar su comprensión';
    }

    // Construir el resumen
    let summary = `En ${name}, el estudiante obtuvo un rendimiento ${performanceLevel} con ${correct} respuestas correctas de ${total} preguntas (${percentage.toFixed(1)}%). `;
    
    summary += `${performanceDescription}. `;

    // Agregar análisis por temas si está disponible
    if (subjectWithTopics && subjectWithTopics.topics.length > 0) {
      const strongTopics = subjectWithTopics.topics.filter(t => t.percentage >= 70);
      const weakTopics = subjectWithTopics.topics.filter(t => t.percentage < 60);
      const moderateTopics = subjectWithTopics.topics.filter(t => t.percentage >= 60 && t.percentage < 70);

      summary += `Al analizar por temas evaluados, `;

      if (strongTopics.length > 0) {
        summary += `demuestra dominio en ${strongTopics.length} tema${strongTopics.length > 1 ? 's' : ''} (${strongTopics.slice(0, 2).map(t => t.name).join(', ')}${strongTopics.length > 2 ? ', entre otros' : ''}). `;
      }

      if (weakTopics.length > 0) {
        summary += `Sin embargo, requiere refuerzo significativo en ${weakTopics.length} tema${weakTopics.length > 1 ? 's' : ''}: ${weakTopics.slice(0, 2).map(t => t.name).join(' y ')}${weakTopics.length > 2 ? ', entre otros' : ''}. `;
      }

      if (moderateTopics.length > 0 && strongTopics.length === 0 && weakTopics.length === 0) {
        summary += `presenta un nivel intermedio en todos los temas evaluados, sugiriendo una comprensión general que puede mejorarse con práctica adicional. `;
      }
    } else {
      // Agregar fortalezas si existen (cuando no hay info de temas)
      if (strengths.length > 0) {
        summary += `Entre sus fortalezas destacan: ${strengths.slice(0, 2).join(' y ')}. `;
      }

      // Agregar debilidades y recomendaciones
      if (weaknesses.length > 0) {
        summary += `Sin embargo, presenta oportunidades de mejora en: ${weaknesses.slice(0, 2).join(' y ')}. `;
      }
    }

    if (percentage < 70) {
      summary += `Se recomienda dedicar tiempo adicional al estudio de los temas con menor rendimiento, practicar con ejercicios similares y buscar apoyo en recursos complementarios. `;
    }

    // Agregar mensaje motivacional según el rendimiento
    if (percentage >= 70) {
      summary += `Con constancia y práctica continua, podrá mantener y mejorar aún más su desempeño en esta área del conocimiento.`;
    } else if (percentage >= 50) {
      summary += `Con esfuerzo dedicado y una estrategia de estudio adecuada, tiene potencial para alcanzar mejores resultados en futuras evaluaciones.`;
    } else {
      summary += `Es fundamental establecer un plan de estudio estructurado y buscar apoyo académico para superar las dificultades identificadas.`;
    }

    return summary;
  };

  // Determinar el ícono de tendencia según el porcentaje
  const getTrendIcon = (percentage: number) => {
    if (percentage >= 70) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (percentage >= 60) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  if (subjects.length === 0) {
    return (
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para generar el resumen
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const generalSummary = generateGeneralSummary();

  return (
    <div className="space-y-6">
      {/* Resumen General del Estudiante */}
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardHeader className="pb-3">
          <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <BookOpen className="h-5 w-5 text-purple-500" />
            Resumen General de Desempeño
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn(
            "text-sm leading-relaxed text-justify",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            {generalSummary}
          </p>
        </CardContent>
      </Card>

      {/* Análisis Detallado por Materia */}
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardHeader className="pb-3">
          <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <BookOpen className="h-5 w-5 text-blue-500" />
            Análisis Detallado por Materia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
          {subjects.map((subject) => (
            <div 
              key={subject.name}
              className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-gray-50 border-gray-200'
              )}
            >
              {/* Header de la materia */}
              <div className="flex items-center gap-2 mb-3">
                {getTrendIcon(subject.percentage)}
                <h3 className={cn("font-semibold text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {subject.name}
                </h3>
              </div>

              {/* Resumen detallado */}
              <p className={cn(
                "text-sm leading-relaxed text-justify",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {generateSubjectSummary(subject)}
              </p>

              {/* Estadística rápida */}
              <div className={cn(
                "mt-3 pt-3 border-t flex items-center justify-between text-xs",
                theme === 'dark' ? 'border-zinc-700 text-gray-400' : 'border-gray-200 text-gray-500'
              )}>
                <span>
                  Respuestas correctas: <span className="font-semibold">{subject.correct}/{subject.total}</span>
                </span>
                <span>
                  Puntuación: <span className="font-semibold">{subject.score}/{subject.maxScore}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

