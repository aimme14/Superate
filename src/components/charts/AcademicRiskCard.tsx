import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";

interface AcademicRiskCardProps {
  weakSubjectsCount: number; // Materias con < 60%
  averagePercentage: number;
  securityIssues: number;
  luckPercentage: number;
  completionRate: number;
  theme?: 'light' | 'dark';
}

export function AcademicRiskCard({
  weakSubjectsCount,
  averagePercentage,
  securityIssues,
  luckPercentage,
  completionRate,
  theme = 'light'
}: AcademicRiskCardProps) {
  
  // Calcular nivel de riesgo (0-100, donde 100 es excelente)
  const calculateRiskScore = (): number => {
    let score = 0;
    
    // Peso 40%: Rendimiento académico promedio
    score += (averagePercentage / 100) * 40;
    
    // Peso 25%: Tasa de completitud
    score += (completionRate / 100) * 25;
    
    // Peso 15%: Penalización por materias débiles
    const weaknessPenalty = Math.max(0, 15 - (weakSubjectsCount * 5));
    score += weaknessPenalty;
    
    // Peso 10%: Penalización por suerte (respuestas rápidas sin análisis)
    const luckPenalty = Math.max(0, 10 - (luckPercentage / 10));
    score += luckPenalty;
    
    // Peso 10%: Penalización por problemas de seguridad
    const securityPenalty = Math.max(0, 10 - (securityIssues * 3));
    score += securityPenalty;
    
    return Math.round(Math.min(100, Math.max(0, score)));
  };

  const riskScore = calculateRiskScore();

  // Determinar nivel de riesgo
  const getRiskLevel = (): 'high' | 'medium' | 'low' => {
    if (riskScore >= 75) return 'low';
    if (riskScore >= 50) return 'medium';
    return 'high';
  };

  const riskLevel = getRiskLevel();

  // Configuración de colores y textos según nivel de riesgo
  const riskConfig = {
    low: {
      color: 'green',
      bgClass: theme === 'dark' ? 'bg-green-900/30 border-green-700' : 'bg-gradient-to-br from-green-50 to-emerald-50',
      textClass: theme === 'dark' ? 'text-green-400' : 'text-green-700',
      badgeClass: theme === 'dark' ? 'bg-green-900 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200',
      icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
      label: 'Excelente Preparación',
      description: 'Tu nivel de preparación es muy bueno. ¡Sigue así!'
    },
    medium: {
      color: 'yellow',
      bgClass: theme === 'dark' ? 'bg-yellow-900/30 border-yellow-700' : 'bg-gradient-to-br from-yellow-50 to-amber-50',
      textClass: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700',
      badgeClass: theme === 'dark' ? 'bg-yellow-900 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: <AlertCircle className="h-8 w-8 text-yellow-500" />,
      label: 'Requiere Atención',
      description: 'Necesitas reforzar algunas áreas para mejorar tu desempeño.'
    },
    high: {
      color: 'red',
      bgClass: theme === 'dark' ? 'bg-red-900/30 border-red-700' : 'bg-gradient-to-br from-red-50 to-rose-50',
      textClass: theme === 'dark' ? 'text-red-400' : 'text-red-700',
      badgeClass: theme === 'dark' ? 'bg-red-900 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200',
      icon: <AlertTriangle className="h-8 w-8 text-red-500" />,
      label: 'Requiere Intervención Urgente',
      description: 'Es importante que refuerces tus conocimientos cuanto antes.'
    }
  };

  const config = riskConfig[riskLevel];

  // Generar alertas específicas
  const generateAlerts = (): string[] => {
    const alerts: string[] = [];
    
    if (weakSubjectsCount >= 3) {
      alerts.push(`${weakSubjectsCount} materias con rendimiento crítico (< 60%)`);
    }
    
    if (averagePercentage < 60) {
      alerts.push('Promedio general por debajo del 60%');
    }
    
    if (completionRate < 70) {
      alerts.push('Baja tasa de completitud de evaluaciones');
    }
    
    if (luckPercentage > 40) {
      alerts.push('Alto porcentaje de respuestas sin análisis adecuado');
    }
    
    if (securityIssues > 2) {
      alerts.push('Múltiples incidentes de seguridad detectados');
    }

    if (alerts.length === 0) {
      alerts.push('No hay alertas críticas en este momento');
    }
    
    return alerts;
  };

  const alerts = generateAlerts();

  // Generar recomendaciones
  const generateRecommendations = (): string[] => {
    const recommendations: string[] = [];
    
    if (weakSubjectsCount > 0) {
      recommendations.push('Dedica más tiempo a las materias con menor rendimiento');
    }
    
    if (luckPercentage > 30) {
      recommendations.push('Tómate más tiempo para analizar cada pregunta');
    }
    
    if (completionRate < 80) {
      recommendations.push('Completa todas las evaluaciones disponibles');
    }
    
    if (averagePercentage < 70) {
      recommendations.push('Repasa los temas fundamentales de cada materia');
    }

    if (recommendations.length === 0) {
      recommendations.push('Mantén tu ritmo de estudio actual');
      recommendations.push('Enfócate en consolidar tus conocimientos');
    }
    
    return recommendations;
  };

  const recommendations = generateRecommendations();

  return (
    <Card className={cn(
      'border-2 shadow-lg',
      config.bgClass,
      theme === 'dark' ? 'bg-zinc-800/80' : ''
    )}>
      <CardHeader>
        <CardTitle className={cn(
          "flex items-center gap-3",
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {config.icon}
          <div>
            <div className="text-xl">Diagnóstico de Preparación Académica</div>
            <div className={cn("text-sm font-normal mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {config.description}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Principal */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Nivel de Preparación
            </span>
            <div className="flex items-center gap-2">
              <span className={cn("text-3xl font-bold", config.textClass)}>
                {riskScore}
              </span>
              <span className={cn("text-lg", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                / 100
              </span>
            </div>
          </div>
          <Progress 
            value={riskScore} 
            className={cn("h-3", theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')}
          />
          <Badge variant="outline" className={cn("text-sm", config.badgeClass)}>
            {config.label}
          </Badge>
        </div>

        {/* Métricas Clave */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn(
            "p-3 rounded-lg border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-white/50 border-gray-200'
          )}>
            <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Promedio
            </div>
            <div className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {averagePercentage.toFixed(1)}%
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-lg border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-white/50 border-gray-200'
          )}>
            <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Completitud
            </div>
            <div className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {completionRate.toFixed(0)}%
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-lg border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-white/50 border-gray-200'
          )}>
            <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Áreas Débiles
            </div>
            <div className={cn(
              "text-lg font-bold",
              weakSubjectsCount >= 3 
                ? 'text-red-500' 
                : weakSubjectsCount > 0 
                  ? 'text-yellow-500' 
                  : 'text-green-500'
            )}>
              {weakSubjectsCount}
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-lg border",
            theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-white/50 border-gray-200'
          )}>
            <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Análisis
            </div>
            <div className={cn(
              "text-lg font-bold",
              luckPercentage < 20 
                ? 'text-green-500' 
                : luckPercentage <= 40 
                  ? 'text-yellow-500' 
                  : 'text-orange-500'
            )}>
              {100 - luckPercentage}%
            </div>
          </div>
        </div>

        {/* Alertas */}
        <div className={cn(
          "p-4 rounded-lg border-l-4",
          riskLevel === 'high' 
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
            : riskLevel === 'medium'
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-green-500 bg-green-50 dark:bg-green-900/20'
        )}>
          <div className={cn(
            "font-medium mb-2 flex items-center gap-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            <AlertTriangle className="h-4 w-4" />
            Alertas Identificadas
          </div>
          <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            {alerts.map((alert, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recomendaciones */}
        <div className={cn(
          "p-4 rounded-lg border",
          theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
        )}>
          <div className={cn(
            "font-medium mb-2 flex items-center gap-2",
            theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
          )}>
            <TrendingUp className="h-4 w-4" />
            Recomendaciones Prioritarias
          </div>
          <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-blue-200' : 'text-blue-800')}>
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

