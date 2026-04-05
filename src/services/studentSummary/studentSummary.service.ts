/**
 * Servicio de Resumen Académico del Estudiante (Frontend)
 * 
 * Consume el servicio de resumen académico desde Cloud Functions
 */

import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { CLOUD_FUNCTIONS_HTTP_BASE } from '@/config/cloudFunctions';

/**
 * Resumen académico generado por IA
 */
export interface AcademicSummary {
  resumen_general: string;
  analisis_competencial: string;
  fortalezas_academicas: string[];
  aspectos_por_mejorar: string[];
  recomendaciones_enfoque_saber11: string[];
}

/**
 * Resumen persistido en Firestore
 */
export interface PersistedSummary {
  studentId: string;
  phase: 'first' | 'second' | 'third';
  fecha: string;
  version: string;
  fuente: string;
  resumen: AcademicSummary;
  metadata: {
    materiasAnalizadas: number;
    modeloIA: string;
  };
  contextoAcademico?: {
    grado?: string;
    nivel?: string;
    institutionId?: string;
    sedeId?: string;
    gradeId?: string;
  };
  metricasGlobales?: {
    promedioGeneral: number;
    materiasFuertes: string[];
    materiasDebiles: string[];
    temasFuertes: { materia: string; tema: string; puntaje: number }[];
    temasDebiles: { materia: string; tema: string; puntaje: number }[];
    nivelGeneralDesempeno: string;
  };
}

/**
 * Respuesta de la API
 */
interface APIResponse {
  success: boolean;
  data?: PersistedSummary;
  error?: { message: string };
  metadata?: {
    processingTime?: number;
    timestamp?: string;
  };
}

/**
 * Servicio de Resumen Académico
 */
class StudentSummaryService {
  private static instance: StudentSummaryService;

  static getInstance(): StudentSummaryService {
    if (!StudentSummaryService.instance) {
      StudentSummaryService.instance = new StudentSummaryService();
    }
    return StudentSummaryService.instance;
  }

  /**
   * Genera el resumen académico para un estudiante en una fase específica
   */
  async generateSummary(studentId: string, phase: 'first' | 'second' | 'third', force: boolean = false): Promise<Result<PersistedSummary>> {
    try {
      const url = `${CLOUD_FUNCTIONS_HTTP_BASE}/studentSummary`;
      const body = force
        ? { studentId, phase, mode: 'generate' as const }
        : { studentId, phase, mode: 'ensure' as const };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error HTTP: ${response.status}`);
      }

      const data: APIResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Error generando resumen');
      }

      const payload = data.data as PersistedSummary | { summary?: PersistedSummary } | undefined;
      if (payload && 'resumen_general' in payload) {
        return success(payload as PersistedSummary);
      }
      const nested = payload as { summary?: PersistedSummary } | undefined;
      if (nested?.summary) {
        return success(nested.summary);
      }
      throw new Error(data.error?.message || 'Error generando resumen');
    } catch (e) {
      console.error('Error generando resumen académico:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar resumen académico')));
    }
  }

  /**
   * Obtiene el resumen académico vigente de un estudiante para una fase específica
   */
  async getSummary(studentId: string, phase: 'first' | 'second' | 'third'): Promise<Result<PersistedSummary | null>> {
    try {
      const url = `${CLOUD_FUNCTIONS_HTTP_BASE}/getStudentSummary?studentId=${encodeURIComponent(studentId)}&phase=${phase}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error HTTP: ${response.status}`);
      }

      const data: APIResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Error obteniendo resumen');
      }

      return success(data.data || null);
    } catch (e) {
      console.error('Error obteniendo resumen académico:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener resumen académico')));
    }
  }
}

export const studentSummaryService = StudentSummaryService.getInstance();

export default studentSummaryService;

