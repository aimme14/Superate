import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Cliente Gemini para el navegador.
 *
 * **Seguridad y costos:** `VITE_GEMINI_API_KEY` queda expuesta en el bundle del cliente.
 * Cualquiera puede extraerla. Para producción robusta, migrar llamadas a Cloud Functions
 * con clave solo en servidor, límites por usuario y autenticación.
 *
 * Métodos expuestos: solo los usados por la app (`generateRecommendations`, `generateImprovementRoute`).
 */

class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

  private constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ VITE_GEMINI_API_KEY no está configurada. Las funciones de IA no estarán disponibles.');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
      this.model = this.genAI.getGenerativeModel({ model: modelName });
      console.log(`✅ Servicio de Gemini AI inicializado con modelo: ${modelName}`);
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

  isAvailable(): boolean {
    return this.model !== null && this.genAI !== null;
  }

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
    if (!this.isAvailable() || !this.model) {
      return {
        success: false,
        error: 'Servicio de IA no disponible. Verifica la configuración de VITE_GEMINI_API_KEY',
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
${analysisData.subjects
  .map(
    (subject) => `
- ${subject.name}: ${subject.percentage}%
  Fortalezas: ${subject.strengths.join(', ') || 'Ninguna identificada'}
  Debilidades: ${subject.weaknesses.join(', ') || 'Ninguna identificada'}
`
  )
  .join('')}

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

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        recommendations: parsed.recommendations || [],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido al generar recomendaciones';
      console.error('Error al generar recomendaciones con Gemini:', error);
      return {
        success: false,
        error: message,
      };
    }
  }

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
    if (!this.isAvailable() || !this.model) {
      return {
        success: false,
        error: 'Servicio de IA no disponible',
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
${analysisData.topicPerformance
  .map(
    (tp) => `
- ${tp.topic}: ${tp.percentage.toFixed(1)}% (${tp.correct}/${tp.total} correctas)
`
  )
  .join('')}

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
        route: parsed,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido al generar ruta de mejoramiento';
      console.error('Error al generar ruta de mejoramiento con Gemini:', error);
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const geminiService = GeminiService.getInstance();
export default geminiService;
