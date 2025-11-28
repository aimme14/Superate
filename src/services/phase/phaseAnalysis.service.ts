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
import { SUBJECTS_CONFIG } from '@/utils/subjects.config';

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
      const questionDetails = examResult.questionDetails || [];
      const totalQuestions = questionDetails.length;
      const correctAnswers = questionDetails.filter((q: any) => q.isCorrect).length;
      const overallScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      // Agrupar por tema/tópico
      const topicMap: Record<string, { correct: number; incorrect: number; total: number }> = {};

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
          isWeakness: percentage < 60, // Considerar debilidad si menos del 60%
        };
      });

      // Identificar fortalezas y debilidades
      const strengths = topicPerformance
        .filter(tp => tp.percentage >= 70)
        .map(tp => tp.topic);

      const weaknesses = topicPerformance
        .filter(tp => tp.isWeakness)
        .map(tp => tp.topic);

      // Identificar la debilidad principal
      // Prioridad: 1) Menor porcentaje, 2) Más errores totales, 3) Más preguntas totales
      let primaryWeakness = '';
      if (topicPerformance.length > 0) {
        const weaknesses = topicPerformance.filter(tp => tp.isWeakness);
        if (weaknesses.length > 0) {
          // Ordenar por: menor porcentaje primero, luego más errores, luego más preguntas
          const sorted = weaknesses.sort((a, b) => {
            // Primero por porcentaje (menor es peor)
            if (a.percentage !== b.percentage) {
              return a.percentage - b.percentage;
            }
            // Si hay empate en porcentaje, por más errores
            if (b.incorrect !== a.incorrect) {
              return b.incorrect - a.incorrect;
            }
            // Si hay empate en errores, por más preguntas totales
            return b.total - a.total;
          });
          primaryWeakness = sorted[0].topic;
        } else {
          // Si no hay debilidades claras (< 60%), usar el tema con menor porcentaje
          const sorted = [...topicPerformance].sort((a, b) => {
            if (a.percentage !== b.percentage) {
              return a.percentage - b.percentage;
            }
            return b.incorrect - a.incorrect;
          });
          primaryWeakness = sorted[0].topic;
        }
      }

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

      // Verificar que hay una debilidad principal identificada
      if (!analysis.primaryWeakness || analysis.primaryWeakness === '') {
        return failure(new ErrorAPI({ 
          message: 'No se pudo identificar una debilidad principal en el análisis de Fase 1.' 
        }));
      }

      // Obtener todos los temas de la materia desde SUBJECTS_CONFIG
      const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
      const allTopics = subjectConfig?.topics?.map(t => t.name) || [];
      
      // Si solo hay 1 tema en la materia, no se puede personalizar
      if (allTopics.length <= 1) {
        return failure(new ErrorAPI({ 
          message: `La materia ${subject} solo tiene 1 tema. No se puede personalizar la distribución.` 
        }));
      }

      // Calcular distribución
      const primaryWeaknessCount = Math.floor(totalQuestions * 0.5); // 50% para debilidad principal
      const remainingCount = totalQuestions - primaryWeaknessCount;
      
      // Obtener otros temas (excluyendo la debilidad principal)
      // Priorizar temas que aparecieron en el análisis, pero incluir todos los temas de la materia
      const topicsFromAnalysis = analysis.topicPerformance
        .filter(tp => tp.topic !== analysis.primaryWeakness)
        .map(tp => tp.topic);
      
      // Agregar temas de la materia que no aparecieron en el análisis
      const otherTopics = [...new Set([...topicsFromAnalysis, ...allTopics])]
        .filter(topic => topic !== analysis.primaryWeakness);

      // Si no hay otros temas, usar distribución estándar
      if (otherTopics.length === 0) {
        return failure(new ErrorAPI({ 
          message: 'No se encontraron otros temas para distribuir las preguntas.' 
        }));
      }

      const distribution: Phase2QuestionDistribution = {
        subject,
        primaryWeakness: analysis.primaryWeakness,
        otherTopics,
        totalQuestions,
        primaryWeaknessCount,
        otherTopicsCount: remainingCount,
      };

      // Guardar distribución
      const distributionId = `${studentId}_${subject}_phase2`;
      const distributionRef = doc(this.getCollection('phase2Distributions'), distributionId);
      await setDoc(distributionRef, {
        ...distribution,
        createdAt: Timestamp.now(),
      });

      console.log(`✅ Distribución Fase 2 generada: ${primaryWeaknessCount} preguntas de ${analysis.primaryWeakness}, ${remainingCount} distribuidas`);
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
   * Calcula el puntaje ICFES (0-500) para Fase 3
   */
  calculateICFESScore(percentage: number): number {
    // Escala ICFES: 0-500
    // Mapeo lineal: 0% = 0, 100% = 500
    return Math.round(percentage * 5);
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
   * Usa SUBJECTS_CONFIG para obtener el código correcto
   */
  private getTopicCode(topic: string, subject: string): string {
    // Buscar la materia en SUBJECTS_CONFIG
    const subjectConfig = SUBJECTS_CONFIG.find(s => s.name === subject);
    if (!subjectConfig || !subjectConfig.topics) {
      // Fallback: usar primeras 2 letras del tema en mayúsculas
      return topic.substring(0, 2).toUpperCase();
    }

    // Buscar el tema en la configuración de la materia
    const topicConfig = subjectConfig.topics.find(t => 
      t.name.toLowerCase() === topic.toLowerCase() ||
      t.name === topic
    );

    if (topicConfig) {
      return topicConfig.code;
    }

    // Si no se encuentra exacto, intentar búsqueda parcial (para casos como "Álgebra y Cálculo" vs "Álgebra")
    const partialMatch = subjectConfig.topics.find(t => 
      topic.toLowerCase().includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(topic.toLowerCase())
    );

    if (partialMatch) {
      return partialMatch.code;
    }

    // Fallback: usar primeras 2 letras del tema en mayúsculas
    return topic.substring(0, 2).toUpperCase();
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

