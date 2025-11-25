import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  Timestamp,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { 
  Phase1Analysis,
  TopicPerformance,
  Phase2QuestionDistribution,
  ProgressAnalysis,
  Phase3ICFESResult,
  PhaseComparison
} from '@/interfaces/phase.interface';
import { geminiService } from '@/services/ai/gemini.service';

/**
 * Servicio para analizar resultados de fases y generar distribuciones de preguntas personalizadas
 */
class PhaseAnalysisService {
  private static instance: PhaseAnalysisService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!PhaseAnalysisService.instance) {
      PhaseAnalysisService.instance = new PhaseAnalysisService();
    }
    return PhaseAnalysisService.instance;
  }

  /**
   * Obtiene una referencia a una colección en superate/auth
   */
  private getCollection(name: string) {
    return collection(this.db, 'superate', 'auth', name);
  }

  /**
   * Analiza los resultados de la Fase 1 para un estudiante y materia específica
   */
  async analyzePhase1Results(
    studentId: string,
    subject: string,
    examResult: any
  ): Promise<Result<Phase1Analysis>> {
    try {
      console.log(`🔍 Analizando resultados Fase 1 para ${studentId} en ${subject}`);

      // Extraer información del resultado del examen
      let questionDetails = examResult.questionDetails || [];
      
      // Si no hay questionDetails, intentar construir desde answers
      if (questionDetails.length === 0 && examResult.answers) {
        console.log('⚠️ No hay questionDetails, intentando construir desde answers');
        // No podemos construir questionDetails sin las preguntas originales
        // En este caso, usaremos el score si está disponible
      }

      const totalQuestions = questionDetails.length;
      const correctAnswers = questionDetails.filter((q: any) => q.isCorrect).length;
      
      // Calcular overallScore: puede venir en examResult.score.overallPercentage o calcularlo
      let overallScore = 0;
      if (examResult.score) {
        if (typeof examResult.score === 'object' && examResult.score.overallPercentage !== undefined) {
          overallScore = examResult.score.overallPercentage;
        } else if (typeof examResult.score === 'number') {
          overallScore = examResult.score;
        }
      }
      
      // Si no hay score, calcularlo desde questionDetails
      if (overallScore === 0 && totalQuestions > 0) {
        overallScore = (correctAnswers / totalQuestions) * 100;
      }

      // Agrupar por tema/tópico
      const topicMap: Record<string, { correct: number; incorrect: number; total: number }> = {};

      if (questionDetails.length > 0) {
        questionDetails.forEach((question: any) => {
          const topic = question.topic || 'Sin tema';
          if (!topicMap[topic]) {
            topicMap[topic] = { correct: 0, incorrect: 0, total: 0 };
          }
          topicMap[topic].total++;
          if (question.isCorrect) {
            topicMap[topic].correct++;
          } else {
            topicMap[topic].incorrect++;
          }
        });
      } else {
        // Si no hay questionDetails, crear un tema genérico con el score general
        console.warn('⚠️ No hay questionDetails disponibles, usando score general');
        const estimatedTotal = totalQuestions || 10; // Valor por defecto si no hay totalQuestions
        topicMap['General'] = {
          correct: Math.round((overallScore / 100) * estimatedTotal),
          incorrect: Math.round(((100 - overallScore) / 100) * estimatedTotal),
          total: estimatedTotal
        };
      }

      // Umbrales configurables para clasificación
      const STRENGTH_THRESHOLD = 80; // Fortaleza si >= 80%
      const WEAKNESS_THRESHOLD = 50; // Debilidad si <= 50%
      // const RISK_THRESHOLD_LOW = 50; // Área en riesgo si entre 50% y 70%
      // const RISK_THRESHOLD_HIGH = 70; // Área en riesgo si entre 50% y 70%

      // Convertir a array de TopicPerformance
      const topicPerformance: TopicPerformance[] = Object.entries(topicMap).map(([topic, stats]) => {
        const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        return {
          topic,
          topicCode: this.getTopicCode(topic, subject),
          correct: stats.correct,
          incorrect: stats.incorrect,
          total: stats.total,
          percentage,
          isWeakness: percentage <= WEAKNESS_THRESHOLD, // Considerar debilidad si <= 50%
        };
      });

      // Identificar fortalezas (>= 80%) y debilidades (<= 50%)
      const strengths = topicPerformance
        .filter(tp => tp.percentage >= STRENGTH_THRESHOLD)
        .map(tp => tp.topic);

      const weaknesses = topicPerformance
        .filter(tp => tp.isWeakness)
        .map(tp => tp.topic);

      // Identificar áreas en riesgo (entre 50% y 70%)
      // const riskAreas = topicPerformance
      //   .filter(tp => tp.percentage > RISK_THRESHOLD_LOW && tp.percentage < RISK_THRESHOLD_HIGH)
      //   .map(tp => tp.topic);

      // Identificar la debilidad principal (la que tiene más errores)
      const primaryWeakness = topicPerformance
        .filter(tp => tp.isWeakness)
        .sort((a, b) => b.incorrect - a.incorrect)[0]?.topic || '';

      // Generar plan de mejoramiento con IA
      const improvementPlanResult = await this.generateImprovementPlan(
        studentId,
        subject,
        primaryWeakness,
        topicPerformance,
        overallScore
      );

      const analysis: Phase1Analysis = {
        studentId,
        subject,
        overallScore,
        topicPerformance,
        strengths,
        weaknesses,
        primaryWeakness,
        improvementPlan: improvementPlanResult.success ? improvementPlanResult.data : undefined,
        analyzedAt: new Date().toISOString(),
      };

      // Guardar análisis en Firebase
      const analysisId = `${studentId}_${subject}_phase1`;
      const analysisRef = doc(this.getCollection('phase1Analyses'), analysisId);
      await setDoc(analysisRef, {
        ...analysis,
        analyzedAt: Timestamp.now(),
      });

      console.log(`✅ Análisis Fase 1 completado para ${studentId} en ${subject}`);
      return success(analysis);
    } catch (e) {
      console.error('❌ Error analizando resultados Fase 1:', e);
      return failure(new ErrorAPI(normalizeError(e, 'analizar resultados Fase 1')));
    }
  }

  /**
   * Analiza en profundidad los detalles de cada pregunta
   * Genera explicaciones de por qué la respuesta correcta es correcta y por qué las incorrectas son incorrectas
   */
  async analyzeQuestionDetails(
    questionDetails: Array<{
      questionId: string;
      questionText: string;
      userAnswer: string | null;
      correctAnswer: string;
      topic: string;
      isCorrect: boolean;
      options?: Array<{ id: string; text: string | null; isCorrect: boolean }>;
    }>,
    subject: string
  ): Promise<Result<Array<{
    questionId: string;
    correctExplanation: string; // Por qué la respuesta correcta es correcta
    incorrectExplanations: Record<string, string>; // Por qué cada alternativa incorrecta es incorrecta
    errorPattern?: string; // Patrón de error identificado
    studentReasoning?: string; // Posible razonamiento del estudiante
  }>>> {
    try {
      console.log(`🔍 Analizando detalles de ${questionDetails.length} preguntas para ${subject}`);

      if (!geminiService.isAvailable()) {
        console.warn('⚠️ Servicio de IA no disponible, generando explicaciones básicas');
        // Fallback a explicaciones básicas
        const basicAnalysis = questionDetails.map(q => ({
          questionId: q.questionId,
          correctExplanation: `La respuesta correcta es ${q.correctAnswer} porque es la opción válida para esta pregunta.`,
          incorrectExplanations: {} as Record<string, string>,
        }));
        return success(basicAnalysis);
      }

      const analyses = [];

      // Analizar cada pregunta individualmente
      for (const question of questionDetails) {
        try {
          const optionsText = question.options?.map(opt => 
            `${opt.id}: ${opt.text || 'Sin texto'}`
          ).join('\n') || 'Opciones no disponibles';

          const prompt = `Eres un experto en educación con maestría y doctorado en análisis de preguntas académicas. Analiza esta pregunta en profundidad.

Materia: ${subject}
Tema: ${question.topic}
Pregunta: ${question.questionText}

Opciones:
${optionsText}

Respuesta correcta: ${question.correctAnswer}
Respuesta del estudiante: ${question.userAnswer || 'No respondida'}
¿Es correcta?: ${question.isCorrect ? 'Sí' : 'No'}

Genera un análisis profundo en formato JSON:
{
  "correctExplanation": "Explicación detallada paso a paso de por qué la respuesta correcta (${question.correctAnswer}) es la correcta. Incluye el razonamiento, conceptos aplicados, y procedimientos necesarios.",
  "incorrectExplanations": {
    "A": "Explicación detallada de por qué la opción A es incorrecta (si aplica)",
    "B": "Explicación detallada de por qué la opción B es incorrecta (si aplica)",
    "C": "Explicación detallada de por qué la opción C es incorrecta (si aplica)",
    "D": "Explicación detallada de por qué la opción D es incorrecta (si aplica)"
  },
  "errorPattern": "Patrón de error identificado si el estudiante respondió incorrectamente (ej: 'Error en cálculo aritmético', 'Confusión de conceptos', 'Interpretación errónea del enunciado')",
  "studentReasoning": "Posible razonamiento que llevó al estudiante a su respuesta (si es incorrecta) o confirmación de su razonamiento correcto (si es correcta)"
}

Sé específico, educativo y detallado. Explica conceptos, procedimientos y razonamientos. Responde SOLO con el JSON, sin texto adicional.`;

          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!apiKey) {
            throw new Error('API key no disponible');
          }

          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            analyses.push({
              questionId: question.questionId,
              correctExplanation: parsed.correctExplanation || 'Explicación no disponible',
              incorrectExplanations: parsed.incorrectExplanations || {},
              errorPattern: parsed.errorPattern,
              studentReasoning: parsed.studentReasoning,
            });
          } else {
            // Fallback si no se puede parsear
            analyses.push({
              questionId: question.questionId,
              correctExplanation: `La respuesta correcta es ${question.correctAnswer}.`,
              incorrectExplanations: {} as Record<string, string>,
            });
          }
        } catch (error) {
          console.error(`❌ Error analizando pregunta ${question.questionId}:`, error);
          // Continuar con la siguiente pregunta
          analyses.push({
            questionId: question.questionId,
            correctExplanation: `La respuesta correcta es ${question.correctAnswer}.`,
            incorrectExplanations: {} as Record<string, string>,
          });
        }
      }

      console.log(`✅ Análisis de ${analyses.length} preguntas completado`);
      return success(analyses);
    } catch (e) {
      console.error('❌ Error analizando detalles de preguntas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'analizar detalles de preguntas')));
    }
  }

  /**
   * Genera un plan de mejoramiento usando IA
   */
  private async generateImprovementPlan(
    studentId: string,
    subject: string,
    primaryWeakness: string,
    topicPerformance: TopicPerformance[],
    overallScore: number
  ): Promise<Result<any>> {
    try {
      if (!geminiService.isAvailable()) {
        console.warn('⚠️ Servicio de IA no disponible, omitiendo plan de mejoramiento');
        return failure(new ErrorAPI({ message: 'Servicio de IA no disponible' }));
      }

      const strengths = topicPerformance.filter(tp => !tp.isWeakness).map(tp => tp.topic);
      const weaknesses = topicPerformance.filter(tp => tp.isWeakness).map(tp => tp.topic);

      // Usar el método completo de generación de ruta de mejoramiento
      const routeResult = await geminiService.generateImprovementRoute({
        studentId,
        subject,
        overallScore,
        strengths,
        weaknesses,
        primaryWeakness,
        topicPerformance: topicPerformance.map(tp => ({
          topic: tp.topic,
          percentage: tp.percentage,
          correct: tp.correct,
          total: tp.total,
        })),
      });

      if (!routeResult.success || !routeResult.route) {
        // Fallback a método simple si el completo falla
        const analysisData = {
          subjects: [{
            name: subject,
            percentage: overallScore,
            strengths,
            weaknesses,
          }],
          overall: {
            averagePercentage: overallScore,
            score: 0,
          },
          patterns: {
            strongestArea: topicPerformance.sort((a, b) => b.percentage - a.percentage)[0]?.topic || '',
            weakestArea: primaryWeakness,
            timeManagement: 'Normal',
          },
        };

        const result = await geminiService.generateRecommendations(analysisData);

        if (!result.success || !result.recommendations) {
          return failure(new ErrorAPI({ message: 'No se pudieron generar recomendaciones' }));
        }

        const primaryRecommendation = result.recommendations.find(r => 
          r.subject === subject && r.topic === primaryWeakness
        ) || result.recommendations[0];

        const improvementPlan = {
          studentId,
          subject,
          primaryWeakness,
          resources: primaryRecommendation.resources.map((resource, index) => ({
            type: this.inferResourceType(resource),
            title: resource,
            description: `Recurso de apoyo para ${primaryWeakness}`,
            topic: primaryWeakness,
            priority: index === 0 ? 'high' as const : 'medium' as const,
          })),
          estimatedTime: primaryRecommendation.timeEstimate,
          description: primaryRecommendation.explanation,
          generatedAt: new Date().toISOString(),
        };

        return success(improvementPlan);
      }

      // Usar la ruta completa generada
      const improvementPlan = {
        studentId,
        subject,
        primaryWeakness,
        resources: routeResult.route.resources,
        studyPlan: routeResult.route.studyPlan,
        estimatedTime: routeResult.route.estimatedTime,
        description: routeResult.route.description,
        generatedAt: new Date().toISOString(),
      };

      return success(improvementPlan);
    } catch (e) {
      console.error('❌ Error generando plan de mejoramiento:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar plan de mejoramiento')));
    }
  }

  /**
   * Genera la distribución de preguntas para Fase 2 basada en el análisis de Fase 1
   */
  async generatePhase2Distribution(
    studentId: string,
    subject: string,
    totalQuestions: number
  ): Promise<Result<Phase2QuestionDistribution>> {
    try {
      console.log(`📊 Generando distribución Fase 2 para ${studentId} en ${subject}`);

      // Obtener análisis de Fase 1
      const analysisId = `${studentId}_${subject}_phase1`;
      const analysisRef = doc(this.getCollection('phase1Analyses'), analysisId);
      const analysisSnap = await getDoc(analysisRef);

      if (!analysisSnap.exists()) {
        return failure(new ErrorAPI({ 
          message: 'No se encontró análisis de Fase 1. Debes completar la Fase 1 primero.' 
        }));
      }

      const analysis = analysisSnap.data() as Phase1Analysis;

      // Identificar todas las debilidades (no solo la principal)
      const weaknesses = analysis.topicPerformance
        .filter(tp => tp.isWeakness)
        .sort((a, b) => b.incorrect - a.incorrect); // Ordenar por cantidad de errores

      const strengths = analysis.topicPerformance
        .filter(tp => !tp.isWeakness)
        .map(tp => tp.topic);

      // Calcular distribución proporcional de debilidades
      const weaknessesCount = Math.floor(totalQuestions * 0.5); // 50% para debilidades
      const strengthsCount = totalQuestions - weaknessesCount; // 50% para fortalezas

      // Si hay múltiples debilidades, distribuir proporcionalmente según errores
      let weaknessDistribution: Array<{ topic: string; count: number }> = [];
      
      if (weaknesses.length === 0) {
        // Si no hay debilidades, usar todos los temas
        const allTopics = analysis.topicPerformance.map(tp => tp.topic);
        const perTopic = Math.floor(strengthsCount / allTopics.length);
        weaknessDistribution = allTopics.map(topic => ({ topic, count: perTopic }));
      } else if (weaknesses.length === 1) {
        // Solo una debilidad, usar todo el 50%
        weaknessDistribution = [{ topic: weaknesses[0].topic, count: weaknessesCount }];
      } else {
        // Múltiples debilidades: distribuir proporcionalmente según errores
        const totalErrors = weaknesses.reduce((sum, w) => sum + w.incorrect, 0);
        
        weaknessDistribution = weaknesses.map(weakness => {
          const proportion = totalErrors > 0 ? weakness.incorrect / totalErrors : 1 / weaknesses.length;
          return {
            topic: weakness.topic,
            count: Math.floor(weaknessesCount * proportion)
          };
        });

        // Ajustar para asegurar que sume exactamente weaknessesCount
        const currentSum = weaknessDistribution.reduce((sum, d) => sum + d.count, 0);
        const difference = weaknessesCount - currentSum;
        if (difference > 0 && weaknessDistribution.length > 0) {
          // Agregar la diferencia a la debilidad principal
          weaknessDistribution[0].count += difference;
        }
      }

      // Distribuir el 50% restante equitativamente entre fortalezas
      const perStrengthCount = strengths.length > 0 
        ? Math.floor(strengthsCount / strengths.length)
        : 0;
      const strengthDistribution = strengths.map(topic => ({
        topic,
        count: perStrengthCount
      }));

      // Ajustar para asegurar que sume exactamente strengthsCount
      const currentStrengthSum = strengthDistribution.reduce((sum, d) => sum + d.count, 0);
      const strengthDifference = strengthsCount - currentStrengthSum;
      if (strengthDifference > 0 && strengthDistribution.length > 0) {
        strengthDistribution[0].count += strengthDifference;
      }

      // Mantener compatibilidad con interfaz existente
      const primaryWeakness = weaknesses.length > 0 ? weaknesses[0].topic : '';
      const otherTopics = [...weaknesses.slice(1).map(w => w.topic), ...strengths];

      const distribution: Phase2QuestionDistribution = {
        subject,
        primaryWeakness,
        otherTopics,
        totalQuestions,
        primaryWeaknessCount: weaknessesCount,
        otherTopicsCount: strengthsCount,
        // Agregar distribución detallada
        weaknessDistribution,
        strengthDistribution,
      } as Phase2QuestionDistribution & { 
        weaknessDistribution: Array<{ topic: string; count: number }>;
        strengthDistribution: Array<{ topic: string; count: number }>;
      };

      // Guardar distribución
      const distributionId = `${studentId}_${subject}_phase2`;
      const distributionRef = doc(this.getCollection('phase2Distributions'), distributionId);
      await setDoc(distributionRef, {
        ...distribution,
        createdAt: Timestamp.now(),
      });

      console.log(`✅ Distribución Fase 2 generada: ${weaknessesCount} preguntas en debilidades, ${strengthsCount} en fortalezas`);
      return success(distribution);
    } catch (e) {
      console.error('❌ Error generando distribución Fase 2:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar distribución Fase 2')));
    }
  }

  /**
   * Analiza el progreso entre Fase 1 y Fase 2
   */
  async analyzeProgress(
    studentId: string,
    subject: string,
    phase1Result: any,
    phase2Result: any
  ): Promise<Result<ProgressAnalysis>> {
    try {
      console.log(`📈 Analizando progreso para ${studentId} en ${subject}`);

      const phase1Score = phase1Result.score?.percentage || 0;
      const phase2Score = phase2Result.score?.percentage || 0;
      const improvement = phase2Score - phase1Score;
      const hasImproved = improvement > 0;

      // Analizar mejoras por tema
      const phase1Details = phase1Result.questionDetails || [];
      const phase2Details = phase2Result.questionDetails || [];

      const phase1TopicMap: Record<string, { correct: number; total: number }> = {};
      const phase2TopicMap: Record<string, { correct: number; total: number }> = {};

      phase1Details.forEach((q: any) => {
        const topic = q.topic || 'Sin tema';
        if (!phase1TopicMap[topic]) {
          phase1TopicMap[topic] = { correct: 0, total: 0 };
        }
        phase1TopicMap[topic].total++;
        if (q.isCorrect) phase1TopicMap[topic].correct++;
      });

      phase2Details.forEach((q: any) => {
        const topic = q.topic || 'Sin tema';
        if (!phase2TopicMap[topic]) {
          phase2TopicMap[topic] = { correct: 0, total: 0 };
        }
        phase2TopicMap[topic].total++;
        if (q.isCorrect) phase2TopicMap[topic].correct++;
      });

      const weaknessImprovement = Object.keys(phase1TopicMap)
        .filter(topic => phase2TopicMap[topic])
        .map(topic => {
          const phase1Pct = phase1TopicMap[topic].total > 0
            ? (phase1TopicMap[topic].correct / phase1TopicMap[topic].total) * 100
            : 0;
          const phase2Pct = phase2TopicMap[topic].total > 0
            ? (phase2TopicMap[topic].correct / phase2TopicMap[topic].total) * 100
            : 0;
          return {
            topic,
            phase1Percentage: phase1Pct,
            phase2Percentage: phase2Pct,
            improvement: phase2Pct - phase1Pct,
          };
        })
        .filter(wi => wi.improvement !== 0);

      // Generar insights con IA
      const insightsResult = await this.generateProgressInsights(
        subject,
        phase1Score,
        phase2Score,
        weaknessImprovement
      );

      const analysis: ProgressAnalysis = {
        studentId,
        subject,
        phase1Score,
        phase2Score,
        improvement,
        hasImproved,
        weaknessImprovement,
        insights: insightsResult.success ? insightsResult.data : [],
        analyzedAt: new Date().toISOString(),
      };

      // Guardar análisis
      const analysisId = `${studentId}_${subject}_progress`;
      const analysisRef = doc(this.getCollection('progressAnalyses'), analysisId);
      await setDoc(analysisRef, {
        ...analysis,
        analyzedAt: Timestamp.now(),
      });

      console.log(`✅ Análisis de progreso completado: ${hasImproved ? 'Mejora' : 'Sin mejora'}`);
      return success(analysis);
    } catch (e) {
      console.error('❌ Error analizando progreso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'analizar progreso')));
    }
  }

  /**
   * Genera insights de progreso usando IA
   */
  private async generateProgressInsights(
    subject: string,
    phase1Score: number,
    phase2Score: number,
    weaknessImprovement: Array<{ topic: string; improvement: number }>
  ): Promise<Result<string[]>> {
    try {
      if (!geminiService.isAvailable()) {
        return success([
          `Tu puntuación en ${subject} ${phase2Score > phase1Score ? 'mejoró' : 'se mantuvo'} de ${phase1Score.toFixed(1)}% a ${phase2Score.toFixed(1)}%.`,
        ]);
      }

      const prompt = `Analiza el progreso académico de un estudiante y genera insights motivadores y constructivos.

Materia: ${subject}
Puntuación Fase 1: ${phase1Score.toFixed(1)}%
Puntuación Fase 2: ${phase2Score.toFixed(1)}%
Mejora: ${(phase2Score - phase1Score).toFixed(1)}%

Mejoras por tema:
${weaknessImprovement.map(wi => `- ${wi.topic}: ${wi.improvement > 0 ? '+' : ''}${wi.improvement.toFixed(1)}%`).join('\n')}

Genera 3-5 insights en formato JSON array de strings:
["Insight 1", "Insight 2", "Insight 3"]

Sé específico, motivador y constructivo. Responde SOLO con el JSON array, sin texto adicional.`;

      // Usar el modelo de Gemini directamente
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return success(['Análisis de progreso completado.']);
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]);
        return success(Array.isArray(insights) ? insights : [text]);
      }

      return success([text]);
    } catch (e) {
      console.error('❌ Error generando insights:', e);
      return success(['Análisis de progreso completado.']);
    }
  }

  /**
   * Calcula el puntaje ICFES (0-500) para una materia individual
   * Para materias del bloque de Naturales, el puntaje se ajusta después
   */
  calculateICFESScore(percentage: number): number {
    // Escala ICFES: 0-500
    // Mapeo lineal: 0% = 0, 100% = 500
    return Math.round(percentage * 5);
  }

  /**
   * Calcula el puntaje ICFES final combinando todas las materias
   * Maneja el bloque de Naturales (Biología + Física + Química = 100 puntos total)
   * Otras materias: 100 puntos cada una
   */
  calculateFinalICFESScore(subjectScores: Array<{
    subject: string;
    percentage: number;
  }>): {
    totalScore: number; // Puntaje total ICFES (0-500)
    subjectScores: Array<{
      subject: string;
      score: number; // Puntaje ICFES de esta materia (0-500 o proporcional para Naturales)
      percentage: number;
      maxPossible: number; // Puntaje máximo posible para esta materia
    }>;
    naturalSciencesScore?: number; // Puntaje combinado de Naturales (0-100)
  } {
    const NATURAL_SCIENCES = ['Biologia', 'Física', 'Quimica'];
    const NATURAL_SCIENCES_TOTAL = 100; // 100 puntos totales para el bloque
    const OTHER_SUBJECTS_SCORE = 100; // 100 puntos cada una

    const naturalSciences: Array<{ subject: string; percentage: number }> = [];
    const otherSubjects: Array<{ subject: string; percentage: number }> = [];

    // Separar materias de Naturales y otras
    subjectScores.forEach(score => {
      if (NATURAL_SCIENCES.includes(score.subject)) {
        naturalSciences.push(score);
      } else {
        otherSubjects.push(score);
      }
    });

    // Calcular puntaje de Naturales (100 puntos totales repartidos equitativamente)
    let naturalSciencesScore = 0;
    const naturalSciencesDetailed: Array<{ subject: string; score: number; percentage: number; maxPossible: number }> = [];

    if (naturalSciences.length > 0) {
      const pointsPerSubject = NATURAL_SCIENCES_TOTAL / naturalSciences.length; // 33.33 cada una si son 3
      
      naturalSciences.forEach(ns => {
        const subjectScore = (ns.percentage / 100) * pointsPerSubject;
        naturalSciencesScore += subjectScore;
        naturalSciencesDetailed.push({
          subject: ns.subject,
          score: Math.round(subjectScore * 5), // Convertir a escala 0-500 para esta materia
          percentage: ns.percentage,
          maxPossible: Math.round(pointsPerSubject * 5) // Máximo posible en escala 0-500
        });
      });
    }

    // Calcular puntaje de otras materias (100 puntos cada una)
    const otherSubjectsDetailed: Array<{ subject: string; score: number; percentage: number; maxPossible: number }> = [];
    let otherSubjectsTotal = 0;

    otherSubjects.forEach(subject => {
      const subjectScore = (subject.percentage / 100) * OTHER_SUBJECTS_SCORE;
      otherSubjectsTotal += subjectScore;
      otherSubjectsDetailed.push({
        subject: subject.subject,
        score: this.calculateICFESScore(subject.percentage), // Escala 0-500
        percentage: subject.percentage,
        maxPossible: 500 // Máximo 500 para otras materias
      });
    });

    // Puntaje total ICFES (0-500)
    const totalScore = Math.round((naturalSciencesScore + otherSubjectsTotal) * 5);

    return {
      totalScore,
      subjectScores: [...naturalSciencesDetailed, ...otherSubjectsDetailed],
      naturalSciencesScore: naturalSciences.length > 0 ? Math.round(naturalSciencesScore * 5) : undefined
    };
  }

  /**
   * Genera resultado final de Fase 3 con diagnóstico ICFES
   */
  async generatePhase3Result(
    studentId: string,
    subject: string,
    examResult: any
  ): Promise<Result<Phase3ICFESResult>> {
    try {
      console.log(`🎯 Generando resultado ICFES para ${studentId} en ${subject}`);

      const questionDetails = examResult.questionDetails || [];
      const totalQuestions = questionDetails.length;
      const correctAnswers = questionDetails.filter((q: any) => q.isCorrect).length;
      const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      const icfesScore = this.calculateICFESScore(percentage);

      // Calcular puntajes por tema
      const topicMap: Record<string, { correct: number; total: number }> = {};
      questionDetails.forEach((q: any) => {
        const topic = q.topic || 'Sin tema';
        if (!topicMap[topic]) {
          topicMap[topic] = { correct: 0, total: 0 };
        }
        topicMap[topic].total++;
        if (q.isCorrect) topicMap[topic].correct++;
      });

      const topicScores = Object.entries(topicMap).map(([topic, stats]) => {
        const topicPercentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
        return {
          topic,
          score: this.calculateICFESScore(topicPercentage),
          percentage: topicPercentage,
        };
      });

      // Generar diagnóstico final con IA
      const diagnosisResult = await this.generateFinalDiagnosis(
        subject,
        icfesScore,
        percentage,
        topicScores
      );

      const result: Phase3ICFESResult = {
        studentId,
        subject,
        icfesScore,
        percentage,
        topicScores,
        overallDiagnosis: diagnosisResult.success ? diagnosisResult.data.diagnosis : '',
        recommendations: diagnosisResult.success ? diagnosisResult.data.recommendations : [],
        completedAt: new Date().toISOString(),
      };

      // Guardar resultado
      const resultId = `${studentId}_${subject}_phase3`;
      const resultRef = doc(this.getCollection('phase3Results'), resultId);
      await setDoc(resultRef, {
        ...result,
        completedAt: Timestamp.now(),
      });

      console.log(`✅ Resultado ICFES generado: ${icfesScore}/500 (${percentage.toFixed(1)}%)`);
      return success(result);
    } catch (e) {
      console.error('❌ Error generando resultado Fase 3:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar resultado Fase 3')));
    }
  }

  /**
   * Genera diagnóstico final usando IA
   */
  private async generateFinalDiagnosis(
    subject: string,
    icfesScore: number,
    percentage: number,
    topicScores: Array<{ topic: string; score: number; percentage: number }>
  ): Promise<Result<{ diagnosis: string; recommendations: string[] }>> {
    try {
      if (!geminiService.isAvailable()) {
        return success({
          diagnosis: `Puntaje ICFES: ${icfesScore}/500 (${percentage.toFixed(1)}%). ${icfesScore >= 300 ? 'Buen rendimiento' : 'Necesita mejorar'}.`,
          recommendations: ['Continúa practicando', 'Revisa los temas con menor puntaje'],
        });
      }

      const prompt = `Genera un diagnóstico final y recomendaciones para un estudiante que presentó el simulacro ICFES.

Materia: ${subject}
Puntaje ICFES: ${icfesScore}/500
Porcentaje: ${percentage.toFixed(1)}%

Puntajes por tema:
${topicScores.map(ts => `- ${ts.topic}: ${ts.score}/500 (${ts.percentage.toFixed(1)}%)`).join('\n')}

Genera un diagnóstico y recomendaciones en formato JSON:
{
  "diagnosis": "Diagnóstico completo y detallado (2-3 párrafos)",
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"]
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return success({
          diagnosis: `Puntaje ICFES: ${icfesScore}/500.`,
          recommendations: [],
        });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return success({
          diagnosis: parsed.diagnosis || text,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        });
      }

      return success({
        diagnosis: text,
        recommendations: [],
      });
    } catch (e) {
      console.error('❌ Error generando diagnóstico:', e);
      return success({
        diagnosis: `Puntaje ICFES: ${icfesScore}/500.`,
        recommendations: [],
      });
    }
  }

  /**
   * Genera comparativo entre las tres fases
   */
  async generatePhaseComparison(
    studentId: string,
    subject: string
  ): Promise<Result<PhaseComparison>> {
    try {
      // Obtener resultados de exámenes
      const resultsRef = doc(this.getCollection('results'), studentId);
      const resultsSnap = await getDoc(resultsRef);
      const results = resultsSnap.exists() ? resultsSnap.data() : {};

      // Buscar exámenes por fase y materia
      let phase1Result: any = null;
      let phase2Result: any = null;
      let phase3Result: any = null;

      Object.values(results).forEach((exam: any) => {
        if (exam.subject === subject && exam.phase === 'first') {
          phase1Result = exam;
        } else if (exam.subject === subject && exam.phase === 'second') {
          phase2Result = exam;
        } else if (exam.subject === subject && exam.phase === 'third') {
          phase3Result = exam;
        }
      });

      if (!phase1Result || !phase2Result || !phase3Result) {
        return failure(new ErrorAPI({ 
          message: 'No se encontraron resultados completos de las tres fases' 
        }));
      }

      // Obtener resultado ICFES de Fase 3
      const phase3ICFESId = `${studentId}_${subject}_phase3`;
      const phase3ICFESRef = doc(this.getCollection('phase3Results'), phase3ICFESId);
      const phase3ICFESSnap = await getDoc(phase3ICFESRef);
      const phase3ICFES = phase3ICFESSnap.exists() ? phase3ICFESSnap.data() as Phase3ICFESResult : null;

      const phase1Score = phase1Result.score?.percentage || 0;
      const phase2Score = phase2Result.score?.percentage || 0;
      const phase3Score = phase3ICFES?.percentage || phase3Result.score?.percentage || 0;
      const phase3ICFESScore = phase3ICFES?.icfesScore || this.calculateICFESScore(phase3Score);

      const totalImprovement = phase3Score - phase1Score;
      const trend = totalImprovement > 5 ? 'improving' : totalImprovement < -5 ? 'declining' : 'stable';

      const comparison: PhaseComparison = {
        studentId,
        subject,
        phase1: {
          score: phase1Score,
          percentage: phase1Score,
          completedAt: phase1Result.endTime || new Date().toISOString(),
        },
        phase2: {
          score: phase2Score,
          percentage: phase2Score,
          completedAt: phase2Result.endTime || new Date().toISOString(),
          improvement: phase2Score - phase1Score,
        },
        phase3: {
          icfesScore: phase3ICFESScore,
          percentage: phase3Score,
          completedAt: phase3Result.endTime || new Date().toISOString(),
        },
        overallProgress: {
          trend,
          totalImprovement,
          finalDiagnosis: phase3ICFES?.overallDiagnosis || 'Diagnóstico no disponible',
        },
      };

      return success(comparison);
    } catch (e) {
      console.error('❌ Error generando comparativo:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar comparativo de fases')));
    }
  }

  /**
   * Obtiene el código de tema basado en el nombre y materia
   */
  private getTopicCode(topic: string, subject: string): string {
    // Mapeo básico de temas a códigos
    const topicCodeMap: Record<string, Record<string, string>> = {
      'Matemáticas': {
        'Álgebra': 'AL',
        'Geometría': 'GE',
        'Estadística': 'ES',
        'Cálculo': 'CA',
      },
      'Lenguaje': {
        'Lectura': 'LE',
        'Escritura': 'ES',
        'Gramática': 'GR',
      },
      // Agregar más mapeos según sea necesario
    };

    return topicCodeMap[subject]?.[topic] || topic.substring(0, 2).toUpperCase();
  }

  /**
   * Infiere el tipo de recurso basado en el nombre
   */
  private inferResourceType(resource: string): 'video' | 'quiz' | 'exercise' | 'material' | 'reading' {
    const lower = resource.toLowerCase();
    if (lower.includes('video') || lower.includes('vídeo') || lower.includes('youtube')) {
      return 'video';
    }
    if (lower.includes('cuestionario') || lower.includes('quiz') || lower.includes('test')) {
      return 'quiz';
    }
    if (lower.includes('ejercicio') || lower.includes('práctica') || lower.includes('practice')) {
      return 'exercise';
    }
    if (lower.includes('lectura') || lower.includes('reading') || lower.includes('artículo')) {
      return 'reading';
    }
    return 'material';
  }
}

export const phaseAnalysisService = PhaseAnalysisService.getInstance();
export default phaseAnalysisService;

