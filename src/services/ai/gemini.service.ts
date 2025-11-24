import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Servicio para interactuar con Google Gemini 3.0 Pro
 * Genera análisis educativos y recomendaciones personalizadas
 */
class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  private constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ VITE_GEMINI_API_KEY no está configurada. Las funciones de IA no estarán disponibles.');
      return;
    }

    
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Usar Gemini 2.0 Flash (experimental) - equivalente a Gemini 3.0 Pro
      // También puedes usar 'gemini-1.5-pro' para un modelo más estable
      const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash-exp';
      this.model = this.genAI.getGenerativeModel({ model: modelName });
      console.log(`✅ Servicio de Gemini AI inicializado correctamente con modelo: ${modelName}`);
    } catch (error) {
      console.error('❌ Error al inicializar Gemini AI:', error);
    }
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Verifica si el servicio está disponible
   */
  isAvailable(): boolean {
    return this.model !== null && this.genAI !== null;
  }

  /**
   * Genera recomendaciones personalizadas basadas en el análisis de rendimiento del estudiante
   */
  async generateRecommendations(analysisData: {
    subjects: Array<{
      name: string;
      percentage: number;
      strengths: string[];
      weaknesses: string[];
    }>;
    overall: {
      averagePercentage: number;
      score: number;
    };
    patterns: {
      strongestArea: string;
      weakestArea: string;
      timeManagement: string;
    };
  }): Promise<{
    success: boolean;
    recommendations?: Array<{
      priority: string;
      subject: string;
      topic: string;
      resources: string[];
      timeEstimate: string;
      explanation: string;
    }>;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible. Verifica la configuración de VITE_GEMINI_API_KEY'
      };
    }

    try {
      const prompt = `Eres un tutor educativo experto. Analiza el rendimiento académico del estudiante y genera recomendaciones personalizadas y accionables.

Datos del estudiante:
- Promedio general: ${analysisData.overall.averagePercentage}%
- Puntaje: ${analysisData.overall.score}
- Área más fuerte: ${analysisData.patterns.strongestArea}
- Área más débil: ${analysisData.patterns.weakestArea}
- Gestión de tiempo: ${analysisData.patterns.timeManagement}

Rendimiento por materias:
${analysisData.subjects.map(subject => `
- ${subject.name}: ${subject.percentage}%
  Fortalezas: ${subject.strengths.join(', ') || 'Ninguna identificada'}
  Debilidades: ${subject.weaknesses.join(', ') || 'Ninguna identificada'}
`).join('')}

Genera recomendaciones específicas y prácticas en formato JSON con esta estructura:
{
  "recommendations": [
    {
      "priority": "Alta|Media|Baja",
      "subject": "Nombre de la materia",
      "topic": "Tópico específico a mejorar",
      "resources": ["Recurso 1", "Recurso 2", "Recurso 3"],
      "timeEstimate": "X semanas",
      "explanation": "Explicación detallada de por qué esta recomendación y cómo implementarla"
    }
  ]
}

Enfócate en:
1. Las áreas con menor rendimiento (prioridad alta)
2. Recursos específicos y accionables
3. Tiempos realistas de mejora
4. Explicaciones claras y motivadoras

Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        recommendations: parsed.recommendations || []
      };
    } catch (error: any) {
      console.error('Error al generar recomendaciones con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar recomendaciones'
      };
    }
  }

  /**
   * Genera un análisis detallado del rendimiento académico
   */
  async generateAnalysis(analysisData: {
    subjects: Array<{
      name: string;
      percentage: number;
      correct: number;
      total: number;
    }>;
    overall: {
      averagePercentage: number;
      score: number;
      questionsAnswered: number;
      totalQuestions: number;
    };
    patterns: {
      timeManagement: string;
      errorTypes: string[];
    };
  }): Promise<{
    success: boolean;
    analysis?: {
      summary: string;
      strengths: string[];
      weaknesses: string[];
      insights: string[];
      actionPlan: string;
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const prompt = `Eres un analista educativo experto. Analiza el rendimiento académico y proporciona insights profundos.

Datos del análisis:
- Promedio general: ${analysisData.overall.averagePercentage}%
- Preguntas respondidas: ${analysisData.overall.questionsAnswered}/${analysisData.overall.totalQuestions}
- Gestión de tiempo: ${analysisData.patterns.timeManagement}
- Tipos de errores comunes: ${analysisData.patterns.errorTypes.join(', ') || 'Ninguno identificado'}

Rendimiento por materias:
${analysisData.subjects.map(subject => `
- ${subject.name}: ${subject.percentage}% (${subject.correct}/${subject.total} correctas)
`).join('')}

Genera un análisis completo en formato JSON:
{
  "summary": "Resumen ejecutivo del rendimiento (2-3 oraciones)",
  "strengths": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
  "weaknesses": ["Debilidad 1", "Debilidad 2"],
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "actionPlan": "Plan de acción general (párrafo corto)"
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        analysis: parsed
      };
    } catch (error: any) {
      console.error('Error al generar análisis con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar análisis'
      };
    }
  }

  /**
   * Genera feedback personalizado para una pregunta específica
   */
  async generateQuestionFeedback(
    question: string,
    studentAnswer: string,
    correctAnswer: string,
    subject: string
  ): Promise<{
    success: boolean;
    feedback?: {
      isCorrect: boolean;
      explanation: string;
      tips: string[];
      relatedConcepts: string[];
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const prompt = `Eres un tutor educativo. Proporciona feedback detallado y educativo sobre esta pregunta.

Materia: ${subject}
Pregunta: ${question}
Respuesta del estudiante: ${studentAnswer}
Respuesta correcta: ${correctAnswer}

Genera feedback en formato JSON:
{
  "isCorrect": ${studentAnswer === correctAnswer},
  "explanation": "Explicación detallada de la respuesta correcta y por qué",
  "tips": ["Tip 1", "Tip 2", "Tip 3"],
  "relatedConcepts": ["Concepto relacionado 1", "Concepto relacionado 2"]
}

Sé educativo, claro y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        feedback: parsed
      };
    } catch (error: any) {
      console.error('Error al generar feedback con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar feedback'
      };
    }
  }

  /**
   * Genera sugerencias de mejora para rectores/coordinadores
   */
  async generateInstitutionalInsights(stats: {
    totalStudents: number;
    totalTeachers: number;
    averagePerformance: number;
    campusOverview: Array<{
      name: string;
      average: number;
      students: number;
    }>;
  }): Promise<{
    success: boolean;
    insights?: {
      summary: string;
      strengths: string[];
      opportunities: string[];
      recommendations: string[];
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const prompt = `Eres un consultor educativo experto. Analiza las estadísticas institucionales y proporciona insights estratégicos.

Estadísticas institucionales:
- Total estudiantes: ${stats.totalStudents}
- Total docentes: ${stats.totalTeachers}
- Promedio institucional: ${stats.averagePerformance}%

Rendimiento por sede:
${stats.campusOverview.map(campus => `
- ${campus.name}: ${campus.average}% (${campus.students} estudiantes)
`).join('')}

Genera insights estratégicos en formato JSON:
{
  "summary": "Resumen ejecutivo del estado institucional (2-3 oraciones)",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "opportunities": ["Oportunidad 1", "Oportunidad 2", "Oportunidad 3"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"]
}

Sé estratégico, específico y accionable. Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        insights: parsed
      };
    } catch (error: any) {
      console.error('Error al generar insights institucionales con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar insights'
      };
    }
  }

  /**
   * Genera una ruta de mejoramiento personalizada basada en el análisis de Fase 1
   */
  async generateImprovementRoute(analysisData: {
    studentId: string;
    subject: string;
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    primaryWeakness: string;
    topicPerformance: Array<{
      topic: string;
      percentage: number;
      correct: number;
      total: number;
    }>;
  }): Promise<{
    success: boolean;
    route?: {
      primaryFocus: string;
      resources: Array<{
        type: 'video' | 'quiz' | 'exercise' | 'material' | 'reading';
        title: string;
        description: string;
        url?: string;
        topic: string;
        priority: 'high' | 'medium' | 'low';
      }>;
      studyPlan: Array<{
        week: number;
        topics: string[];
        activities: string[];
        goals: string[];
      }>;
      estimatedTime: string;
      description: string;
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const prompt = `Eres un tutor educativo experto. Genera una ruta de mejoramiento personalizada y detallada para un estudiante.

Datos del estudiante:
- Materia: ${analysisData.subject}
- Puntuación general: ${analysisData.overallScore.toFixed(1)}%
- Fortalezas: ${analysisData.strengths.join(', ') || 'Ninguna identificada'}
- Debilidades: ${analysisData.weaknesses.join(', ') || 'Ninguna identificada'}
- Debilidad principal: ${analysisData.primaryWeakness}

Rendimiento por tema:
${analysisData.topicPerformance.map(tp => `
- ${tp.topic}: ${tp.percentage.toFixed(1)}% (${tp.correct}/${tp.total} correctas)
`).join('')}

Genera una ruta de mejoramiento completa en formato JSON:
{
  "primaryFocus": "Tema principal a trabajar",
  "resources": [
    {
      "type": "video|quiz|exercise|material|reading",
      "title": "Título del recurso",
      "description": "Descripción detallada",
      "url": "URL opcional",
      "topic": "Tema relacionado",
      "priority": "high|medium|low"
    }
  ],
  "studyPlan": [
    {
      "week": 1,
      "topics": ["Tema 1", "Tema 2"],
      "activities": ["Actividad 1", "Actividad 2"],
      "goals": ["Meta 1", "Meta 2"]
    }
  ],
  "estimatedTime": "X semanas",
  "description": "Descripción general de la ruta de mejoramiento (párrafo completo)"
}

Enfócate en:
1. La debilidad principal (${analysisData.primaryWeakness})
2. Recursos específicos y accionables
3. Un plan de estudio semanal realista
4. Metas claras y alcanzables

Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        route: parsed
      };
    } catch (error: any) {
      console.error('Error al generar ruta de mejoramiento con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar ruta de mejoramiento'
      };
    }
  }

  /**
   * Analiza el avance entre Fase 1 y Fase 2
   */
  async analyzePhaseProgress(progressData: {
    subject: string;
    phase1Score: number;
    phase2Score: number;
    improvement: number;
    weaknessImprovement: Array<{
      topic: string;
      phase1Percentage: number;
      phase2Percentage: number;
      improvement: number;
    }>;
  }): Promise<{
    success: boolean;
    analysis?: {
      summary: string;
      hasImproved: boolean;
      improvementAreas: string[];
      persistentWeaknesses: string[];
      recommendations: string[];
      motivation: string;
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const prompt = `Eres un analista educativo. Analiza el progreso de un estudiante entre dos fases evaluativas.

Materia: ${progressData.subject}
Puntuación Fase 1: ${progressData.phase1Score.toFixed(1)}%
Puntuación Fase 2: ${progressData.phase2Score.toFixed(1)}%
Mejora general: ${progressData.improvement > 0 ? '+' : ''}${progressData.improvement.toFixed(1)}%

Mejoras por tema:
${progressData.weaknessImprovement.map(wi => `
- ${wi.topic}: 
  Fase 1: ${wi.phase1Percentage.toFixed(1)}%
  Fase 2: ${wi.phase2Percentage.toFixed(1)}%
  Mejora: ${wi.improvement > 0 ? '+' : ''}${wi.improvement.toFixed(1)}%
`).join('')}

Genera un análisis completo en formato JSON:
{
  "summary": "Resumen ejecutivo del progreso (2-3 oraciones)",
  "hasImproved": true|false,
  "improvementAreas": ["Área 1", "Área 2"],
  "persistentWeaknesses": ["Debilidad 1", "Debilidad 2"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "motivation": "Mensaje motivador personalizado (1-2 oraciones)"
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        analysis: parsed
      };
    } catch (error: any) {
      console.error('Error al analizar progreso con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al analizar progreso'
      };
    }
  }

  /**
   * Genera diagnóstico final ICFES con recomendaciones
   */
  async generateICFESDiagnosis(diagnosisData: {
    subject: string;
    icfesScore: number;
    percentage: number;
    topicScores: Array<{
      topic: string;
      score: number;
      percentage: number;
    }>;
    phase1Score?: number;
    phase2Score?: number;
  }): Promise<{
    success: boolean;
    diagnosis?: {
      overallDiagnosis: string;
      scoreInterpretation: string;
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
      nextSteps: string[];
    };
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Servicio de IA no disponible'
      };
    }

    try {
      const progressContext = diagnosisData.phase1Score && diagnosisData.phase2Score
        ? `
Progreso a través de las fases:
- Fase 1: ${diagnosisData.phase1Score.toFixed(1)}%
- Fase 2: ${diagnosisData.phase2Score.toFixed(1)}%
- Fase 3 (ICFES): ${diagnosisData.percentage.toFixed(1)}%
`
        : '';

      const prompt = `Eres un evaluador experto en pruebas ICFES. Genera un diagnóstico final completo y recomendaciones.

Materia: ${diagnosisData.subject}
Puntaje ICFES: ${diagnosisData.icfesScore}/500
Porcentaje: ${diagnosisData.percentage.toFixed(1)}%
${progressContext}
Puntajes por tema:
${diagnosisData.topicScores.map(ts => `
- ${ts.topic}: ${ts.score}/500 (${ts.percentage.toFixed(1)}%)
`).join('')}

Genera un diagnóstico completo en formato JSON:
{
  "overallDiagnosis": "Diagnóstico general detallado (2-3 párrafos)",
  "scoreInterpretation": "Interpretación del puntaje ICFES (1 párrafo)",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "weaknesses": ["Debilidad 1", "Debilidad 2"],
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"],
  "nextSteps": ["Paso siguiente 1", "Paso siguiente 2"]
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        diagnosis: parsed
      };
    } catch (error: any) {
      console.error('Error al generar diagnóstico ICFES con Gemini:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar diagnóstico ICFES'
      };
    }
  }
}

export const geminiService = GeminiService.getInstance();
export default geminiService;

