import { 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  query,
  where,
  Timestamp,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { PhaseType } from '@/interfaces/phase.interface';

/**
 * Historial de desempeño por fase
 */
export interface PerformanceHistory {
  studentId: string;
  subject: string;
  phase: PhaseType;
  score: number; // Porcentaje 0-100
  icfesScore?: number; // Puntaje ICFES 0-500 (solo Fase 3)
  completedAt: string;
  topicPerformance: Array<{
    topic: string;
    percentage: number;
  }>;
}

/**
 * Datos para gráficas comparativas
 */
export interface ChartData {
  labels: string[]; // Fases o fechas
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

/**
 * Indicadores de progreso
 */
export interface ProgressIndicators {
  studentId: string;
  subject: string;
  standardizedScore: number; // Puntaje estandarizado 0-500
  improvementIndex: number; // Índice de mejora porcentual
  variability: number; // Variabilidad de respuestas (desviación estándar)
  trend: 'improving' | 'stable' | 'declining';
  phaseComparisons: Array<{
    phase: PhaseType;
    score: number;
    improvement?: number;
  }>;
}

/**
 * Servicio para rastrear progreso y generar datos para gráficas
 */
class ProgressTrackingService {
  private static instance: ProgressTrackingService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!ProgressTrackingService.instance) {
      ProgressTrackingService.instance = new ProgressTrackingService();
    }
    return ProgressTrackingService.instance;
  }

  /**
   * Obtiene una referencia a una colección en superate/auth
   */
  private getCollection(name: string) {
    return collection(this.db, 'superate', 'auth', name);
  }

  /**
   * Guarda el historial de desempeño de una fase
   */
  async savePerformanceHistory(
    studentId: string,
    subject: string,
    phase: PhaseType,
    score: number,
    icfesScore?: number,
    topicPerformance?: Array<{ topic: string; percentage: number }>
  ): Promise<Result<PerformanceHistory>> {
    try {
      const historyId = `${studentId}_${subject}_${phase}`;
      const historyRef = doc(this.getCollection('performanceHistory'), historyId);

      const history: PerformanceHistory = {
        studentId,
        subject,
        phase,
        score,
        icfesScore,
        completedAt: new Date().toISOString(),
        topicPerformance: topicPerformance || [],
      };

      await setDoc(historyRef, {
        ...history,
        completedAt: Timestamp.now(),
      });

      console.log(`✅ Historial de desempeño guardado: ${studentId} - ${subject} - ${phase}`);
      return success(history);
    } catch (e) {
      console.error('❌ Error guardando historial:', e);
      return failure(new ErrorAPI(normalizeError(e, 'guardar historial de desempeño')));
    }
  }

  /**
   * Obtiene el historial completo de un estudiante en una materia
   */
  async getStudentHistory(
    studentId: string,
    subject: string
  ): Promise<Result<PerformanceHistory[]>> {
    try {
      const q = query(
        this.getCollection('performanceHistory'),
        where('studentId', '==', studentId),
        where('subject', '==', subject)
      );

      const querySnapshot = await getDocs(q);
      const history: PerformanceHistory[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        history.push({
          studentId: data.studentId,
          subject: data.subject,
          phase: data.phase,
          score: data.score,
          icfesScore: data.icfesScore,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
          topicPerformance: data.topicPerformance || [],
        });
      });

      // Ordenar por fase
      const phaseOrder: PhaseType[] = ['first', 'second', 'third'];
      history.sort((a, b) => phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase));

      return success(history);
    } catch (e) {
      console.error('❌ Error obteniendo historial:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener historial de desempeño')));
    }
  }

  /**
   * Genera datos para gráficas comparativas (antes/después)
   */
  async generateChartData(
    studentId: string,
    subject: string
  ): Promise<Result<ChartData>> {
    try {
      const historyResult = await this.getStudentHistory(studentId, subject);
      
      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      const history = historyResult.data;

      if (history.length === 0) {
        return success({
          labels: [],
          datasets: [],
        });
      }

      const labels = history.map(h => {
        const phaseNames: Record<PhaseType, string> = {
          first: 'Fase 1',
          second: 'Fase 2',
          third: 'Fase 3',
        };
        return phaseNames[h.phase];
      });

      const scores = history.map(h => h.score);
      const icfesScores = history
        .filter(h => h.icfesScore !== undefined)
        .map(h => h.icfesScore! / 5); // Convertir a porcentaje para comparar

      const datasets = [
        {
          label: 'Puntaje (%)',
          data: scores,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
        },
      ];

      if (icfesScores.length > 0) {
        datasets.push({
          label: 'Puntaje ICFES (normalizado)',
          data: icfesScores,
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgba(16, 185, 129, 1)',
        });
      }

      return success({
        labels,
        datasets,
      });
    } catch (e) {
      console.error('❌ Error generando datos de gráfica:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar datos de gráfica')));
    }
  }

  /**
   * Calcula indicadores de progreso
   */
  async calculateProgressIndicators(
    studentId: string,
    subject: string
  ): Promise<Result<ProgressIndicators>> {
    try {
      const historyResult = await this.getStudentHistory(studentId, subject);
      
      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      const history = historyResult.data;

      if (history.length === 0) {
        return success({
          studentId,
          subject,
          standardizedScore: 0,
          improvementIndex: 0,
          variability: 0,
          trend: 'stable',
          phaseComparisons: [],
        });
      }

      const scores = history.map(h => h.score);
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      
      // Calcular variabilidad (desviación estándar)
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const variability = Math.sqrt(variance);

      // Calcular índice de mejora
      let improvementIndex = 0;
      if (history.length >= 2) {
        const firstScore = history[0].score;
        const lastScore = history[history.length - 1].score;
        improvementIndex = lastScore - firstScore;
      }

      // Determinar tendencia
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (history.length >= 2) {
        const firstScore = history[0].score;
        const lastScore = history[history.length - 1].score;
        if (lastScore > firstScore + 5) {
          trend = 'improving';
        } else if (lastScore < firstScore - 5) {
          trend = 'declining';
        }
      }

      // Calcular puntaje estandarizado (usar el último si hay ICFES, sino promedio)
      const lastPhase = history[history.length - 1];
      const standardizedScore = lastPhase.icfesScore || (mean * 5);

      // Comparaciones por fase
      const phaseComparisons = history.map((h, index) => {
        const improvement = index > 0 
          ? h.score - history[index - 1].score 
          : undefined;
        return {
          phase: h.phase,
          score: h.score,
          improvement,
        };
      });

      return success({
        studentId,
        subject,
        standardizedScore: Math.round(standardizedScore),
        improvementIndex: Math.round(improvementIndex * 10) / 10,
        variability: Math.round(variability * 10) / 10,
        trend,
        phaseComparisons,
      });
    } catch (e) {
      console.error('❌ Error calculando indicadores:', e);
      return failure(new ErrorAPI(normalizeError(e, 'calcular indicadores de progreso')));
    }
  }

  /**
   * Genera datos para gráfica de progreso por tema
   */
  async generateTopicProgressChart(
    studentId: string,
    subject: string
  ): Promise<Result<{
    topics: string[];
    phase1Data: number[];
    phase2Data: number[];
    phase3Data?: number[];
  }>> {
    try {
      const historyResult = await this.getStudentHistory(studentId, subject);
      
      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      const history = historyResult.data;

      // Obtener todos los temas únicos
      const allTopics = new Set<string>();
      history.forEach(h => {
        h.topicPerformance.forEach(tp => allTopics.add(tp.topic));
      });

      const topics = Array.from(allTopics);
      const phase1Data: number[] = [];
      const phase2Data: number[] = [];
      const phase3Data: number[] = [];

      const phase1 = history.find(h => h.phase === 'first');
      const phase2 = history.find(h => h.phase === 'second');
      const phase3 = history.find(h => h.phase === 'third');

      topics.forEach(topic => {
        phase1Data.push(phase1?.topicPerformance.find(tp => tp.topic === topic)?.percentage || 0);
        phase2Data.push(phase2?.topicPerformance.find(tp => tp.topic === topic)?.percentage || 0);
        phase3Data.push(phase3?.topicPerformance.find(tp => tp.topic === topic)?.percentage || 0);
      });

      return success({
        topics,
        phase1Data,
        phase2Data,
        phase3Data: phase3 ? phase3Data : undefined,
      });
    } catch (e) {
      console.error('❌ Error generando gráfica de temas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar gráfica de progreso por tema')));
    }
  }
}

export const progressTrackingService = ProgressTrackingService.getInstance();
export default progressTrackingService;

