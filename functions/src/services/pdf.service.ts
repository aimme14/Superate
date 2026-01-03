/**
 * Servicio de Generación de PDFs
 * 
 * Genera PDFs de resúmenes académicos usando PDFKit
 */

import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import PDFDocument from 'pdfkit';
import { storage } from '../config/firebase.config';
import { PersistedSummary } from './studentSummary.service';

/**
 * Opciones para generar PDF
 */
interface PDFGenerationOptions {
  studentName: string;
  studentId: string;
  institutionName?: string;
  phase: 'first' | 'second' | 'third';
  summary: PersistedSummary;
}

/**
 * Resultado de generación de PDF
 */
interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  downloadUrl?: string;
  error?: string;
}

/**
 * Servicio de generación de PDFs
 */
class PDFService {
  /**
   * Genera un PDF del resumen académico
   */
  async generateSummaryPDF(options: PDFGenerationOptions): Promise<PDFGenerationResult> {
    try {
      const { studentName, studentId, institutionName, phase, summary } = options;

      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      // Buffer para almacenar el PDF
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {});

      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('Resumen Académico', { align: 'center' });
      doc.moveDown(0.5);
      
      const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III';
      doc.fontSize(16).font('Helvetica').text(phaseName, { align: 'center' });
      doc.moveDown(1);

      // Información del estudiante
      doc.fontSize(12).font('Helvetica-Bold').text('Información del Estudiante');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nombre: ${studentName}`);
      doc.text(`Identificación: ${studentId}`);
      if (institutionName) {
        doc.text(`Institución: ${institutionName}`);
      }
      doc.text(`Fecha: ${new Date(summary.fecha).toLocaleDateString('es-CO')}`);
      doc.moveDown(1);

      // Resumen general
      if (summary.resumen.resumen_general) {
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen General');
        doc.fontSize(10).font('Helvetica');
        doc.text(summary.resumen.resumen_general, {
          align: 'justify',
        });
        doc.moveDown(1);
      }

      // Análisis competencial
      if (summary.resumen.analisis_competencial) {
        doc.fontSize(12).font('Helvetica-Bold').text('Análisis Competencial');
        doc.fontSize(10).font('Helvetica');
        
        if (typeof summary.resumen.analisis_competencial === 'string') {
          doc.text(summary.resumen.analisis_competencial, {
            align: 'justify',
          });
        } else {
          // Si es un objeto por materias
          Object.entries(summary.resumen.analisis_competencial).forEach(([materia, analisis]) => {
            doc.font('Helvetica-Bold').text(materia + ':', { continued: false });
            doc.font('Helvetica').text(analisis, {
              align: 'justify',
            });
            doc.moveDown(0.5);
          });
        }
        doc.moveDown(1);
      }

      // Fortalezas académicas
      if (summary.resumen.fortalezas_academicas && summary.resumen.fortalezas_academicas.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Fortalezas Académicas');
        doc.fontSize(10).font('Helvetica');
        summary.resumen.fortalezas_academicas.forEach((fortaleza: string) => {
          doc.text(`• ${fortaleza}`, {
            indent: 20,
          });
        });
        doc.moveDown(1);
      }

      // Aspectos por mejorar
      if (summary.resumen.aspectos_por_mejorar && summary.resumen.aspectos_por_mejorar.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Aspectos por Mejorar');
        doc.fontSize(10).font('Helvetica');
        summary.resumen.aspectos_por_mejorar.forEach((aspecto: string) => {
          doc.text(`• ${aspecto}`, {
            indent: 20,
          });
        });
        doc.moveDown(1);
      }

      // Recomendaciones
      if (summary.resumen.recomendaciones_enfoque_saber11 && 
          summary.resumen.recomendaciones_enfoque_saber11.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Recomendaciones para Saber 11');
        doc.fontSize(10).font('Helvetica');
        summary.resumen.recomendaciones_enfoque_saber11.forEach((recomendacion: string) => {
          doc.text(`• ${recomendacion}`, {
            indent: 20,
          });
        });
        doc.moveDown(1);
      }

      // Métricas globales si están disponibles
      if (summary.metricasGlobales) {
        doc.fontSize(12).font('Helvetica-Bold').text('Métricas Globales');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Promedio General: ${summary.metricasGlobales.promedioGeneral.toFixed(2)}%`);
        doc.text(`Nivel de Desempeño: ${summary.metricasGlobales.nivelGeneralDesempeno}`);
        
        if (summary.metricasGlobales.materiasFuertes.length > 0) {
          doc.text(`Materias Fuertes: ${summary.metricasGlobales.materiasFuertes.join(', ')}`);
        }
        
        if (summary.metricasGlobales.materiasDebiles.length > 0) {
          doc.text(`Materias a Mejorar: ${summary.metricasGlobales.materiasDebiles.join(', ')}`);
        }
        doc.moveDown(1);
      }

      // Pie de página
      doc.fontSize(8).font('Helvetica').text(
        `Generado el ${new Date().toLocaleString('es-CO')} - Sistema Supérate`,
        { align: 'center' }
      );

      // Finalizar documento
      doc.end();

      // Esperar a que el documento termine de generarse
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });

      return {
        success: true,
        pdfBuffer,
      };
    } catch (error: any) {
      console.error('Error generando PDF:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido al generar PDF',
      };
    }
  }

  /**
   * Sube el PDF a Firebase Storage y retorna la URL pública
   */
  async uploadPDFToStorage(
    pdfBuffer: Buffer,
    studentId: string,
    phase: 'first' | 'second' | 'third',
    filename?: string
  ): Promise<string> {
    try {
      const phaseName = phase === 'first' ? 'fase1' : phase === 'second' ? 'fase2' : 'fase3';
      const timestamp = Date.now();
      const pdfFilename = filename || `resumen_${phaseName}_${studentId}_${timestamp}.pdf`;
      const filePath = `pdfs/${studentId}/${pdfFilename}`;

      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      // Subir el archivo
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Hacer el archivo público
      await file.makePublic();

      // Obtener URL pública
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      return publicUrl;
    } catch (error: any) {
      console.error('Error subiendo PDF a Storage:', error);
      throw new Error(`Error subiendo PDF: ${error.message}`);
    }
  }

  /**
   * Genera PDF y lo sube a Storage, retornando la URL pública
   */
  async generateAndUploadPDF(options: PDFGenerationOptions): Promise<PDFGenerationResult> {
    try {
      // Generar PDF
      const pdfResult = await this.generateSummaryPDF(options);

      if (!pdfResult.success || !pdfResult.pdfBuffer) {
        return {
          success: false,
          error: pdfResult.error || 'Error generando PDF',
        };
      }

      // Subir a Storage
      const downloadUrl = await this.uploadPDFToStorage(
        pdfResult.pdfBuffer,
        options.studentId,
        options.phase
      );

      return {
        success: true,
        pdfBuffer: pdfResult.pdfBuffer,
        downloadUrl,
      };
    } catch (error: any) {
      console.error('Error en generateAndUploadPDF:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido',
      };
    }
  }
}

// Exportar instancia singleton
export const pdfService = new PDFService();
export type { PDFGenerationOptions, PDFGenerationResult };

