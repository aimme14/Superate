/**
 * Servicio para analizar resultados de Fase I con IA
 * Genera análisis consolidados y detallados de todos los resultados de Fase I
 */

import { 
  collection, 
  getDocs, 
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { geminiService } from '@/services/ai/gemini.service';
import { getPhaseName } from '@/utils/firestoreHelpers';

/**
 * Análisis consolidado de Fase I generado por IA
 */
export interface Phase1ConsolidatedAnalysis {
  studentId: string;
  overallSummary: {
    totalExams: number;
    averageScore: number;
    bestSubject: string;
    worstSubject: string;
    overallTrend: 'improving' | 'stable' | 'declining';
  };
  subjectAnalyses: Array<{
    subject: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    aiInsights: string;
  }>;
  aiGeneratedSummary: {
    summary: string;
    keyFindings: string[];
    actionPlan: string;
    motivation: string;
  };
  analyzedAt: string;
}

/**
 * Análisis detallado de un examen específico de Fase I
 */
export interface Phase1ExamAnalysis {
  examId: string;
  subject: string;
  score: number;
  aiAnalysis: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    detailedFeedback: string;
  };
  analyzedAt: string;
}

class Phase1AIAnalysisService {
  private static instance: Phase1AIAnalysisService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!Phase1AIAnalysisService.instance) {
      Phase1AIAnalysisService.instance = new Phase1AIAnalysisService();
    }
    return Phase1AIAnalysisService.instance;
  }

  /**
   * Obtiene todos los resultados de Fase I de un estudiante
   */
  private async getPhase1Results(studentId: string): Promise<any[]> {
    try {
      const phase1Name = getPhaseName('first');
      const phase1Ref = collection(this.db, 'results', studentId, phase1Name);
      const phase1Snap = await getDocs(phase1Ref);
      
      const results: any[] = [];
      phase1Snap.docs.forEach(doc => {
        const data = doc.data();
        results.push({
          ...data,
          examId: doc.id,
        });
      });

      return results;
    } catch (error) {
      console.error('Error obteniendo resultados Fase I:', error);
      return [];
    }
  }

  /**
   * Analiza un examen específico de Fase I con IA
   */
  async analyzePhase1Exam(
    studentId: string,
    examId: string
  ): Promise<Result<Phase1ExamAnalysis>> {
    try {
      console.log(`🔍 Analizando examen Fase I: ${examId} para estudiante ${studentId}`);

      const phase1Name = getPhaseName('first');
      const examRef = doc(this.db, 'results', studentId, phase1Name, examId);
      const examSnap = await getDoc(examRef);

      if (!examSnap.exists()) {
        return failure(new ErrorAPI({ 
          message: 'No se encontró el examen especificado' 
        }));
      }

      const examData = examSnap.data();
      const questionDetails = examData.questionDetails || [];
      const subject = examData.subject || 'Desconocida';
      const score = examData.score?.overallPercentage || examData.score?.percentage || 0;

      // Analizar por temas
      const topicMap: Record<string, { correct: number; total: number }> = {};
      questionDetails.forEach((q: any) => {
        const topic = q.topic || 'Sin tema';
        if (!topicMap[topic]) {
          topicMap[topic] = { correct: 0, total: 0 };
        }
        topicMap[topic].total++;
        if (q.isCorrect) topicMap[topic].correct++;
      });

      const topicPerformance = Object.entries(topicMap).map(([topic, stats]) => ({
        topic,
        percentage: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        correct: stats.correct,
        total: stats.total,
      }));

      const strengths = topicPerformance
        .filter(tp => tp.percentage >= 70)
        .map(tp => tp.topic);
      
      const weaknesses = topicPerformance
        .filter(tp => tp.percentage < 60)
        .map(tp => tp.topic);

      // Generar análisis con IA
      const aiAnalysisResult = await this.generateExamAIAnalysis(
        subject,
        score,
        topicPerformance,
        strengths,
        weaknesses,
        questionDetails.length
      );

      const analysis: Phase1ExamAnalysis = {
        examId,
        subject,
        score,
        aiAnalysis: aiAnalysisResult.success ? aiAnalysisResult.data : {
          summary: `Puntuación: ${score.toFixed(1)}%`,
          strengths,
          weaknesses,
          recommendations: [],
          detailedFeedback: '',
        },
        analyzedAt: new Date().toISOString(),
      };

      // Guardar análisis
      const analysisId = `${studentId}_${examId}_analysis`;
      const analysisRef = doc(
        collection(this.db, 'superate', 'auth', 'phase1ExamAnalyses'),
        analysisId
      );
      await setDoc(analysisRef, {
        ...analysis,
        analyzedAt: Timestamp.now(),
      });

      console.log(`✅ Análisis de examen completado`);
      return success(analysis);
    } catch (e) {
      console.error('❌ Error analizando examen Fase I:', e);
      return failure(new ErrorAPI(normalizeError(e, 'analizar examen Fase I')));
    }
  }

  /**
   * Genera análisis consolidado de todos los resultados de Fase I con IA
   */
  async generateConsolidatedAnalysis(
    studentId: string
  ): Promise<Result<Phase1ConsolidatedAnalysis>> {
    try {
      console.log(`🔍 Generando análisis consolidado Fase I para ${studentId}`);

      const results = await this.getPhase1Results(studentId);
      
      if (results.length === 0) {
        return failure(new ErrorAPI({ 
          message: 'No se encontraron resultados de Fase I' 
        }));
      }

      // Agrupar por materia
      const subjectMap: Record<string, any[]> = {};
      results.forEach(result => {
        const subject = result.subject || 'Desconocida';
        if (!subjectMap[subject]) {
          subjectMap[subject] = [];
        }
        subjectMap[subject].push(result);
      });

      // Calcular estadísticas por materia
      const subjectAnalyses = Object.entries(subjectMap).map(([subject, exams]) => {
        const scores = exams.map(e => e.score?.overallPercentage || e.score?.percentage || 0);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Analizar temas de todos los exámenes de esta materia
        const topicMap: Record<string, { correct: number; total: number }> = {};
        exams.forEach(exam => {
          const questionDetails = exam.questionDetails || [];
          questionDetails.forEach((q: any) => {
            const topic = q.topic || 'Sin tema';
            if (!topicMap[topic]) {
              topicMap[topic] = { correct: 0, total: 0 };
            }
            topicMap[topic].total++;
            if (q.isCorrect) topicMap[topic].correct++;
          });
        });

        const topicPerformance = Object.entries(topicMap).map(([topic, stats]) => ({
          topic,
          percentage: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        }));

        const strengths = topicPerformance
          .filter(tp => tp.percentage >= 70)
          .map(tp => tp.topic);
        
        const weaknesses = topicPerformance
          .filter(tp => tp.percentage < 60)
          .map(tp => tp.topic);

        return {
          subject,
          score: averageScore,
          strengths,
          weaknesses,
          recommendations: [],
          aiInsights: '',
        };
      });

      // Calcular estadísticas generales
      const allScores = results.map(r => r.score?.overallPercentage || r.score?.percentage || 0);
      const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      
      const sortedSubjects = [...subjectAnalyses].sort((a, b) => b.score - a.score);
      const bestSubject = sortedSubjects[0]?.subject || '';
      const worstSubject = sortedSubjects[sortedSubjects.length - 1]?.subject || '';

      // Determinar tendencia
      const sortedByDate = results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const firstHalf = sortedByDate.slice(0, Math.ceil(sortedByDate.length / 2));
      const secondHalf = sortedByDate.slice(Math.ceil(sortedByDate.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, r) => sum + (r.score?.overallPercentage || r.score?.percentage || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + (r.score?.overallPercentage || r.score?.percentage || 0), 0) / secondHalf.length;
      
      const trend = secondAvg > firstAvg + 2 ? 'improving' : 
                   secondAvg < firstAvg - 2 ? 'declining' : 'stable';

      // Generar análisis con IA
      const aiSummaryResult = await this.generateConsolidatedAISummary(
        subjectAnalyses,
        averageScore,
        bestSubject,
        worstSubject,
        trend,
        results.length
      );

      const analysis: Phase1ConsolidatedAnalysis = {
        studentId,
        overallSummary: {
          totalExams: results.length,
          averageScore,
          bestSubject,
          worstSubject,
          overallTrend: trend,
        },
        subjectAnalyses: aiSummaryResult.success 
          ? aiSummaryResult.data.subjectAnalyses 
          : subjectAnalyses,
        aiGeneratedSummary: aiSummaryResult.success
          ? aiSummaryResult.data.summary
          : {
              summary: `Has completado ${results.length} exámenes de Fase I con un promedio de ${averageScore.toFixed(1)}%`,
              keyFindings: [],
              actionPlan: 'Continúa practicando y revisa las áreas de mejora identificadas.',
              motivation: '¡Sigue así!',
            },
        analyzedAt: new Date().toISOString(),
      };

      // Guardar análisis
      const analysisId = `${studentId}_phase1_consolidated`;
      const analysisRef = doc(
        collection(this.db, 'superate', 'auth', 'phase1ConsolidatedAnalyses'),
        analysisId
      );
      await setDoc(analysisRef, {
        ...analysis,
        analyzedAt: Timestamp.now(),
      });

      console.log(`✅ Análisis consolidado completado`);
      return success(analysis);
    } catch (e) {
      console.error('❌ Error generando análisis consolidado:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar análisis consolidado')));
    }
  }

  /**
   * Genera análisis de un examen específico con IA
   */
  private async generateExamAIAnalysis(
    subject: string,
    score: number,
    topicPerformance: Array<{ topic: string; percentage: number; correct: number; total: number }>,
    strengths: string[],
    weaknesses: string[],
    totalQuestions: number
  ): Promise<Result<{
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    detailedFeedback: string;
  }>> {
    try {
      if (!geminiService.isAvailable()) {
        return success({
          summary: `Puntuación: ${score.toFixed(1)}% en ${subject}`,
          strengths,
          weaknesses,
          recommendations: [],
          detailedFeedback: '',
        });
      }

      const prompt = `Eres un tutor educativo experto. Analiza el resultado de un examen de Fase I y proporciona feedback detallado y constructivo.

Materia: ${subject}
Puntuación: ${score.toFixed(1)}%
Total de preguntas: ${totalQuestions}

Rendimiento por tema:
${topicPerformance.map(tp => `- ${tp.topic}: ${tp.percentage.toFixed(1)}% (${tp.correct}/${tp.total} correctas)`).join('\n')}

Fortalezas identificadas: ${strengths.join(', ') || 'Ninguna'}
Debilidades identificadas: ${weaknesses.join(', ') || 'Ninguna'}

Genera un análisis completo en formato JSON:
{
  "summary": "Resumen ejecutivo del desempeño (2-3 oraciones)",
  "strengths": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
  "weaknesses": ["Debilidad 1", "Debilidad 2"],
  "recommendations": ["Recomendación específica 1", "Recomendación específica 2", "Recomendación específica 3"],
  "detailedFeedback": "Feedback detallado y motivador sobre el desempeño (párrafo completo)"
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return success({
          summary: `Puntuación: ${score.toFixed(1)}%`,
          strengths,
          weaknesses,
          recommendations: [],
          detailedFeedback: '',
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
          summary: parsed.summary || text,
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : strengths,
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : weaknesses,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          detailedFeedback: parsed.detailedFeedback || '',
        });
      }

      return success({
        summary: text,
        strengths,
        weaknesses,
        recommendations: [],
        detailedFeedback: '',
      });
    } catch (e) {
      console.error('❌ Error generando análisis de examen con IA:', e);
      return success({
        summary: `Puntuación: ${score.toFixed(1)}%`,
        strengths,
        weaknesses,
        recommendations: [],
        detailedFeedback: '',
      });
    }
  }

  /**
   * Genera resumen consolidado con IA
   */
  private async generateConsolidatedAISummary(
    subjectAnalyses: Array<{ subject: string; score: number; strengths: string[]; weaknesses: string[] }>,
    averageScore: number,
    bestSubject: string,
    worstSubject: string,
    trend: 'improving' | 'stable' | 'declining',
    totalExams: number
  ): Promise<Result<{
    subjectAnalyses: Array<{ subject: string; score: number; strengths: string[]; weaknesses: string[]; recommendations: string[]; aiInsights: string }>;
    summary: { summary: string; keyFindings: string[]; actionPlan: string; motivation: string };
  }>> {
    try {
      if (!geminiService.isAvailable()) {
        return success({
          subjectAnalyses: subjectAnalyses.map(sa => ({
            ...sa,
            recommendations: [],
            aiInsights: '',
          })),
          summary: {
            summary: `Has completado ${totalExams} exámenes con un promedio de ${averageScore.toFixed(1)}%`,
            keyFindings: [],
            actionPlan: 'Continúa practicando',
            motivation: '¡Sigue así!',
          },
        });
      }

      const prompt = `Eres un tutor educativo experto. Analiza el rendimiento consolidado de un estudiante en la Fase I y genera un análisis completo y motivador.

Resumen general:
- Total de exámenes: ${totalExams}
- Puntuación promedio: ${averageScore.toFixed(1)}%
- Mejor materia: ${bestSubject}
- Materia con más desafíos: ${worstSubject}
- Tendencia general: ${trend === 'improving' ? 'Mejorando' : trend === 'declining' ? 'Declinando' : 'Estable'}

Rendimiento por materia:
${subjectAnalyses.map(sa => `
- ${sa.subject}: ${sa.score.toFixed(1)}%
  Fortalezas: ${sa.strengths.join(', ') || 'Ninguna'}
  Debilidades: ${sa.weaknesses.join(', ') || 'Ninguna'}
`).join('')}

Genera un análisis completo en formato JSON:
{
  "summary": {
    "summary": "Resumen ejecutivo del rendimiento general (2-3 párrafos)",
    "keyFindings": ["Hallazgo clave 1", "Hallazgo clave 2", "Hallazgo clave 3"],
    "actionPlan": "Plan de acción general y recomendaciones (párrafo completo)",
    "motivation": "Mensaje motivador personalizado (1-2 oraciones)"
  },
  "subjectAnalyses": [
    {
      "subject": "Nombre de la materia",
      "score": ${subjectAnalyses[0]?.score || 0},
      "strengths": ["Fortaleza 1", "Fortaleza 2"],
      "weaknesses": ["Debilidad 1", "Debilidad 2"],
      "recommendations": ["Recomendación específica 1", "Recomendación específica 2"],
      "aiInsights": "Insight detallado sobre esta materia (párrafo completo)"
    }
  ]
}

Sé específico, constructivo y motivador. Responde SOLO con el JSON, sin texto adicional.`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return success({
          subjectAnalyses: subjectAnalyses.map(sa => ({
            ...sa,
            recommendations: [],
            aiInsights: '',
          })),
          summary: {
            summary: `Has completado ${totalExams} exámenes`,
            keyFindings: [],
            actionPlan: 'Continúa practicando',
            motivation: '¡Sigue así!',
          },
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
          subjectAnalyses: parsed.subjectAnalyses || subjectAnalyses.map(sa => ({
            ...sa,
            recommendations: [],
            aiInsights: '',
          })),
          summary: parsed.summary || {
            summary: text,
            keyFindings: [],
            actionPlan: '',
            motivation: '',
          },
        });
      }

      return success({
        subjectAnalyses: subjectAnalyses.map(sa => ({
          ...sa,
          recommendations: [],
          aiInsights: '',
        })),
        summary: {
          summary: text,
          keyFindings: [],
          actionPlan: '',
          motivation: '',
        },
      });
    } catch (e) {
      console.error('❌ Error generando resumen consolidado con IA:', e);
      return success({
        subjectAnalyses: subjectAnalyses.map(sa => ({
          ...sa,
          recommendations: [],
          aiInsights: '',
        })),
        summary: {
          summary: `Has completado ${totalExams} exámenes`,
          keyFindings: [],
          actionPlan: 'Continúa practicando',
          motivation: '¡Sigue así!',
        },
      });
    }
  }

  /**
   * Obtiene análisis consolidado existente o genera uno nuevo
   */
  async getOrGenerateConsolidatedAnalysis(
    studentId: string
  ): Promise<Result<Phase1ConsolidatedAnalysis>> {
    try {
      // Intentar obtener análisis existente
      const analysisId = `${studentId}_phase1_consolidated`;
      const analysisRef = doc(
        collection(this.db, 'superate', 'auth', 'phase1ConsolidatedAnalyses'),
        analysisId
      );
      const analysisSnap = await getDoc(analysisRef);

      if (analysisSnap.exists()) {
        const data = analysisSnap.data() as Phase1ConsolidatedAnalysis;
        // Verificar si necesita actualización (más de 1 día de antigüedad)
        const analyzedAt = data.analyzedAt;
        const daysSinceAnalysis = (Date.now() - new Date(analyzedAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAnalysis < 1) {
          return success(data);
        }
      }

      // Generar nuevo análisis
      return await this.generateConsolidatedAnalysis(studentId);
    } catch (e) {
      console.error('❌ Error obteniendo análisis consolidado:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener análisis consolidado')));
    }
  }

  /**
   * Obtiene análisis de un examen específico
   */
  async getExamAnalysis(
    studentId: string,
    examId: string
  ): Promise<Result<Phase1ExamAnalysis>> {
    try {
      const analysisId = `${studentId}_${examId}_analysis`;
      const analysisRef = doc(
        collection(this.db, 'superate', 'auth', 'phase1ExamAnalyses'),
        analysisId
      );
      const analysisSnap = await getDoc(analysisRef);

      if (analysisSnap.exists()) {
        const data = analysisSnap.data() as Phase1ExamAnalysis;
        return success(data);
      }

      // Si no existe, generar nuevo análisis
      return await this.analyzePhase1Exam(studentId, examId);
    } catch (e) {
      console.error('❌ Error obteniendo análisis de examen:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener análisis de examen')));
    }
  }
}

export const phase1AIAnalysisService = Phase1AIAnalysisService.getInstance();
export default phase1AIAnalysisService;



