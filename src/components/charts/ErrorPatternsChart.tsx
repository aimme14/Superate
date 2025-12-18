import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, Brain, FileQuestion } from 'lucide-react';
import { cn } from "@/lib/utils";

interface QuestionDetail {
  questionId: number | string;
  questionText: string;
  userAnswer: string | null;
  correctAnswer: string;
  topic: string;
  isCorrect: boolean;
  answered: boolean;
  timeSpent?: number;
}

interface ErrorPatternsChartProps {
  questionDetails: QuestionDetail[];
  theme?: 'light' | 'dark';
}

interface ErrorPattern {
  type: 'conceptual' | 'procedural' | 'reading' | 'time';
  label: string;
  count: number;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export function ErrorPatternsChart({ questionDetails, theme = 'light' }: ErrorPatternsChartProps) {
  
  // Clasificar errores por tipo
  const classifyErrors = (): ErrorPattern[] => {
    const incorrectQuestions = questionDetails.filter(q => q.answered && !q.isCorrect);
    const totalIncorrect = incorrectQuestions.length;

    if (totalIncorrect === 0) {
      return [];
    }

    // Contadores de cada tipo de error
    let conceptualErrors = 0;
    let proceduralErrors = 0;
    let readingErrors = 0;
    let timeErrors = 0;

    incorrectQuestions.forEach(question => {
      const timeSpent = question.timeSpent || 0;
      
      // Errores por tiempo (muy rápido o muy lento)
      if (timeSpent < 15) {
        timeErrors++; // Respuestas muy rápidas, probablemente sin análisis
      } else if (timeSpent > 180) {
        timeErrors++; // Respuestas muy lentas, posible confusión
      }
      
      // Analizar patrones basados en el tema y comportamiento
      // Si fue muy rápido, probablemente es error de lectura
      if (timeSpent < 20 && timeSpent > 0) {
        readingErrors++;
      } 
      // Si tomó tiempo considerable, puede ser conceptual o procedural
      else if (timeSpent >= 30) {
        // Alternamos entre conceptual y procedural basado en tiempo
        if (timeSpent < 90) {
          proceduralErrors++; // Errores en aplicación/procedimiento
        } else {
          conceptualErrors++; // Errores de comprensión conceptual
        }
      } else {
        // Distribución por defecto
        conceptualErrors++;
      }
    });

    // Normalizar para que sume el total de errores
    const totalClassified = conceptualErrors + proceduralErrors + readingErrors + timeErrors;
    const normalizationFactor = totalIncorrect / Math.max(totalClassified, 1);

    conceptualErrors = Math.round(conceptualErrors * normalizationFactor);
    proceduralErrors = Math.round(proceduralErrors * normalizationFactor);
    readingErrors = Math.round(readingErrors * normalizationFactor);
    timeErrors = totalIncorrect - (conceptualErrors + proceduralErrors + readingErrors);

    const patterns: ErrorPattern[] = [
      {
        type: 'conceptual' as const,
        label: 'Errores Conceptuales',
        count: conceptualErrors,
        percentage: Math.round((conceptualErrors / totalIncorrect) * 100),
        icon: <Brain className="h-5 w-5" />,
        color: 'red',
        description: 'Falta de comprensión de conceptos fundamentales'
      },
      {
        type: 'procedural' as const,
        label: 'Errores Procedimentales',
        count: proceduralErrors,
        percentage: Math.round((proceduralErrors / totalIncorrect) * 100),
        icon: <FileQuestion className="h-5 w-5" />,
        color: 'orange',
        description: 'Errores en la aplicación de procedimientos o métodos'
      },
      {
        type: 'reading' as const,
        label: 'Errores de Lectura',
        count: readingErrors,
        percentage: Math.round((readingErrors / totalIncorrect) * 100),
        icon: <AlertTriangle className="h-5 w-5" />,
        color: 'yellow',
        description: 'Lectura rápida o incomprensión del enunciado'
      },
      {
        type: 'time' as const,
        label: 'Errores de Gestión de Tiempo',
        count: timeErrors,
        percentage: Math.round((timeErrors / totalIncorrect) * 100),
        icon: <Clock className="h-5 w-5" />,
        color: 'blue',
        description: 'Respuestas muy rápidas o excesivamente lentas'
      }
    ];
    
    return patterns.filter(pattern => pattern.count > 0);
  };

  const errorPatterns = classifyErrors();
  const totalErrors = questionDetails.filter(q => q.answered && !q.isCorrect).length;
  const totalQuestions = questionDetails.length;
  const accuracyRate = totalQuestions > 0 ? Math.round(((totalQuestions - totalErrors) / totalQuestions) * 100) : 0;

  if (totalErrors === 0) {
    return (
      <Card className={cn(
        theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
      )}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Brain className={cn("h-12 w-12 mx-auto mb-4 text-green-500")} />
            <p className={cn("text-lg font-semibold mb-2", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
              ¡Excelente! No se detectaron errores
            </p>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Has respondido correctamente todas las preguntas
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getColorClasses = (color: string) => {
    const colors = {
      red: {
        bg: theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50',
        border: 'border-red-500',
        text: theme === 'dark' ? 'text-red-400' : 'text-red-700',
        badge: theme === 'dark' ? 'bg-red-900 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200',
        icon: 'text-red-500'
      },
      orange: {
        bg: theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-50',
        border: 'border-orange-500',
        text: theme === 'dark' ? 'text-orange-400' : 'text-orange-700',
        badge: theme === 'dark' ? 'bg-orange-900 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200',
        icon: 'text-orange-500'
      },
      yellow: {
        bg: theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-50',
        border: 'border-yellow-500',
        text: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700',
        badge: theme === 'dark' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: 'text-yellow-500'
      },
      blue: {
        bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50',
        border: 'border-blue-500',
        text: theme === 'dark' ? 'text-blue-400' : 'text-blue-700',
        badge: theme === 'dark' ? 'bg-blue-900 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200',
        icon: 'text-blue-500'
      }
    };
    return colors[color as keyof typeof colors] || colors.red;
  };

  return (
    <Card className={cn(
      theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
    )}>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Análisis de Patrones de Error
        </CardTitle>
        <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Clasificación detallada de errores y sus causas principales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen General */}
        <div className={cn(
          "p-4 rounded-lg border",
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex justify-between items-center mb-2">
            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Tasa de Precisión General
            </span>
            <span className={cn(
              "text-2xl font-bold",
              accuracyRate >= 70 
                ? 'text-green-500' 
                : accuracyRate >= 50 
                  ? 'text-yellow-500' 
                  : 'text-red-500'
            )}>
              {accuracyRate}%
            </span>
          </div>
          <Progress value={accuracyRate} className="h-2 mb-2" />
          <div className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {totalQuestions - totalErrors} correctas de {totalQuestions} preguntas ({totalErrors} errores)
          </div>
        </div>

        {/* Patrones de Error */}
        <div className="space-y-3">
          <h4 className={cn("text-sm font-semibold mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Distribución de Errores por Tipo
          </h4>
          {errorPatterns.map((pattern) => {
            const colorClasses = getColorClasses(pattern.color);
            return (
              <div key={pattern.type} className={cn(
                "p-4 rounded-lg border-l-4",
                colorClasses.border,
                colorClasses.bg
              )}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={colorClasses.icon}>
                      {pattern.icon}
                    </div>
                    <div>
                      <h5 className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {pattern.label}
                      </h5>
                      <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {pattern.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={colorClasses.badge}>
                    {pattern.percentage}%
                  </Badge>
                </div>
                <div className="mt-2">
                  <Progress 
                    value={pattern.percentage} 
                    className={cn("h-2", theme === 'dark' ? 'bg-zinc-800' : 'bg-white/50')}
                  />
                  <div className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {pattern.count} de {totalErrors} errores
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recomendaciones basadas en patrones */}
        <div className={cn(
          "p-4 rounded-lg border",
          theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
        )}>
          <h4 className={cn(
            "font-medium mb-2",
            theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
          )}>
            Recomendaciones para Mejorar
          </h4>
          <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-800')}>
            {errorPatterns[0] && (
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>
                  {errorPatterns[0].type === 'conceptual' && 'Refuerza los conceptos fundamentales con material de apoyo'}
                  {errorPatterns[0].type === 'procedural' && 'Practica más ejercicios de aplicación paso a paso'}
                  {errorPatterns[0].type === 'reading' && 'Lee con más atención cada enunciado antes de responder'}
                  {errorPatterns[0].type === 'time' && 'Administra mejor tu tiempo: ni muy rápido ni muy lento'}
                </span>
              </li>
            )}
            {accuracyRate < 70 && (
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Dedica más tiempo al estudio y repaso de los temas evaluados</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Analiza cada error para entender por qué fallaste</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

