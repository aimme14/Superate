/**
 * Servicio de Generación de PDFs
 *
 * Reporte académico del estudiante (dashboard docente): encabezado SUPERATE.IA + logo,
 * KPIs, barras (Desempeño por materia), resumen general, diagnóstico por materia,
 * análisis competencial global, síntesis, fortalezas/mejoras y recomendaciones.
 */

import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { storage } from '../config/firebase.config';
import { PersistedSummary } from './studentSummary.service';

type PDFDoc = InstanceType<typeof PDFDocument>;

interface PDFGenerationOptions {
  studentName: string;
  studentId: string;
  institutionName?: string;
  phase: 'first' | 'second' | 'third';
  summary: PersistedSummary;
}

interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  downloadUrl?: string;
  error?: string;
}

const SUBJECT_ORDER = [
  'Matemáticas',
  'Lenguaje',
  'Ciencias Sociales',
  'Biologia',
  'Quimica',
  'Física',
  'Inglés',
] as const;

const COL = {
  headerBg: '#12151c',
  gold: '#d4af37',
  brandBlue: '#1e40af',
  textOnDark: '#f4f4f5',
  textMuted: '#a1a1aa',
  body: '#27272a',
  subtle: '#71717a',
  barTrack: '#e4e4e7',
  cardBg: '#fafafa',
  cardBorder: '#d4d4d8',
  white: '#ffffff',
};

function phaseLabelShort(phase: 'first' | 'second' | 'third'): string {
  if (phase === 'first') return 'Fase I';
  if (phase === 'second') return 'Fase II';
  return 'Fase III';
}

/** Subtítulo descriptivo (sin repetir el número de fase; va junto a “Fase del reporte”). */
function phaseReportSubtitle(phase: 'first' | 'second' | 'third'): string {
  if (phase === 'first') return 'Diagnóstico de habilidades académicas';
  if (phase === 'second') return 'Fortalecimiento de competencias';
  return 'Simulacro tipo ICFES';
}

function barColorForScore(p: number): string {
  if (p >= 70) return '#059669';
  if (p >= 60) return '#2563eb';
  if (p >= 40) return '#d97706';
  return '#dc2626';
}

function truncateText(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type SubjectRow = { materia: string; puntaje: number; nivel: string };

function buildSubjectRows(summary: PersistedSummary): SubjectRow[] {
  const mg = summary.metricasGlobales;
  if (mg?.resumenPorMateria && mg.resumenPorMateria.length > 0) {
    return mg.resumenPorMateria.map((r) => ({
      materia: r.materia,
      puntaje: r.puntaje,
      nivel: String(r.nivel),
    }));
  }
  if (!mg) return [];

  const byMateria = new Map<string, number[]>();
  const push = (materia: string, puntaje: number) => {
    const arr = byMateria.get(materia) ?? [];
    arr.push(puntaje);
    byMateria.set(materia, arr);
  };
  for (const t of mg.temasFuertes) push(t.materia, t.puntaje);
  for (const t of mg.temasDebiles) push(t.materia, t.puntaje);
  for (const t of mg.debilidadesLeves) push(t.materia, t.puntaje);
  for (const t of mg.debilidadesEstructurales) push(t.materia, t.puntaje);

  const rows: SubjectRow[] = [];
  const promedio = mg.promedioGeneral;
  for (const name of SUBJECT_ORDER) {
    const pts = byMateria.get(name);
    if (pts && pts.length > 0) {
      const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
      rows.push({
        materia: name,
        puntaje: Math.round(avg * 10) / 10,
        nivel: avg >= 70 ? 'Alto' : avg >= 60 ? 'Medio' : avg >= 40 ? 'Básico' : 'Bajo',
      });
    } else {
      rows.push({ materia: name, puntaje: Math.round(promedio * 10) / 10, nivel: String(mg.nivelGeneralDesempeno) });
    }
  }
  return rows;
}

/** Compara nombres de materia ignorando mayúsculas y tildes (Biología vs Biologia). */
function sameMateriaName(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  return n(a) === n(b);
}

function notaForEje(puntaje: number): string {
  if (puntaje >= 70) return 'Fuerte';
  if (puntaje >= 60) return 'Medio';
  return 'A reforzar';
}

/**
 * Ejes/temas evaluados por materia: prioriza `ejesEvaluados` (todos los ejes, incl. 60–69%).
 * Resúmenes antiguos sin ese campo usan solo fuertes/débiles (puede faltar el tercer eje).
 */
function ejesForMateria(
  summary: PersistedSummary,
  materia: string
): { tema: string; puntaje: number; nota: string }[] {
  const mg = summary.metricasGlobales;
  if (!mg) return [];

  const completos = mg.ejesEvaluados?.filter((e) => sameMateriaName(e.materia, materia)) ?? [];
  if (completos.length > 0) {
    const seen = new Map<string, { tema: string; puntaje: number; nota: string }>();
    for (const e of completos) {
      const key = e.tema.trim().toLowerCase();
      const prev = seen.get(key);
      if (!prev || e.puntaje < prev.puntaje) {
        seen.set(key, {
          tema: e.tema.trim(),
          puntaje: e.puntaje,
          nota: notaForEje(e.puntaje),
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.tema.localeCompare(b.tema, 'es'));
  }

  const map = new Map<string, { puntaje: number; nota: string }>();
  const add = (tema: string, puntaje: number, nota: string) => {
    const prev = map.get(tema);
    if (!prev || puntaje < prev.puntaje) map.set(tema, { puntaje, nota });
  };
  for (const t of mg.temasFuertes) {
    if (sameMateriaName(t.materia, materia)) add(t.tema, t.puntaje, 'Fuerte');
  }
  for (const t of mg.temasDebiles) {
    if (sameMateriaName(t.materia, materia)) add(t.tema, t.puntaje, 'A reforzar');
  }
  for (const t of mg.debilidadesLeves) {
    if (sameMateriaName(t.materia, materia)) add(t.tema, t.puntaje, 'Debilidad leve');
  }
  for (const t of mg.debilidadesEstructurales) {
    if (sameMateriaName(t.materia, materia)) add(t.tema, t.puntaje, 'Prioritario');
  }
  return [...map.entries()]
    .map(([tema, v]) => ({ tema, puntaje: v.puntaje, nota: v.nota }))
    .sort((a, b) => a.tema.localeCompare(b.tema, 'es'));
}

function analisisPorMateria(summary: PersistedSummary): Record<string, string> {
  const ac = summary.resumen.analisis_competencial;
  if (ac && typeof ac === 'object' && !Array.isArray(ac)) {
    return ac as Record<string, string>;
  }
  return {};
}

class Layout {
  doc: PDFDoc;
  y: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly contentW: number;

  constructor(doc: PDFDoc) {
    this.doc = doc;
    const m = doc.page.margins;
    this.marginLeft = m.left;
    this.marginRight = m.right;
    this.marginTop = m.top;
    this.marginBottom = m.bottom;
    this.contentW = doc.page.width - m.left - m.right;
    this.y = m.top;
  }

  pageBottom(): number {
    return this.doc.page.height - this.marginBottom;
  }

  ensureSpace(h: number): void {
    if (this.y + h > this.pageBottom()) {
      this.doc.addPage();
      this.y = this.marginTop;
    }
  }

  lineGap(gap = 6): void {
    this.y += gap;
  }
}

class PDFService {
  async generateSummaryPDF(options: PDFGenerationOptions): Promise<PDFGenerationResult> {
    try {
      const { studentName, institutionName, phase, summary } = options;

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      const L = new Layout(doc);
      const mg = summary.metricasGlobales;
      const subjectRows = buildSubjectRows(summary);
      const acBySubject = analisisPorMateria(summary);
      const acGlobalString =
        typeof summary.resumen.analisis_competencial === 'string'
          ? summary.resumen.analisis_competencial.trim()
          : '';

      this.drawHeader(L, phase);
      L.lineGap(8);

      const ctx = summary.contextoAcademico;
      const fechaPub = new Date(summary.fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      this.drawStudentStrip(L, {
        phaseShort: phaseLabelShort(phase),
        phaseLong: phaseReportSubtitle(phase),
        studentName,
        institutionName: institutionName?.trim() || '—',
        sede: ctx?.sede?.trim() || '—',
        grado: ctx?.grado?.trim() || '—',
        jornada: ctx?.jornada?.trim() || '—',
        fechaPublicacion: fechaPub.toUpperCase(),
      });
      L.lineGap(8);

      this.drawKpiRow(L, summary, subjectRows);
      L.lineGap(10);

      this.drawProgressSection(L, subjectRows);
      L.lineGap(8);

      if (summary.resumen.resumen_general?.trim()) {
        L.ensureSpace(44);
        this.drawSectionTitle(L, 'Resumen general');
        L.doc.font('Helvetica').fontSize(8.5).fillColor(COL.body);
        L.ensureSpace(28);
        L.doc.text(summary.resumen.resumen_general, L.marginLeft, L.y, {
          width: L.contentW,
          align: 'justify',
          lineGap: 1,
        });
        L.y = L.doc.y + 8;
      }

      const orderedSubjects =
        subjectRows.length > 0
          ? [...subjectRows].sort((a, b) => b.puntaje - a.puntaje).map((r) => r.materia)
          : SUBJECT_ORDER.filter((m) => acBySubject[m]);

      for (const materia of orderedSubjects.length > 0 ? orderedSubjects : [...SUBJECT_ORDER]) {
        const row = subjectRows.find((r) => r.materia === materia);
        const texto = acBySubject[materia] ?? '';
        const topics = ejesForMateria(summary, materia);
        if (!row && !texto && topics.length === 0) continue;
        this.drawSubjectCard(L, {
          materia,
          puntaje: row?.puntaje ?? mg?.promedioGeneral ?? 0,
          nivel: row?.nivel ?? String(mg?.nivelGeneralDesempeno ?? '—'),
          texto,
          topics,
        });
      }

      if (acGlobalString) {
        L.ensureSpace(44);
        this.drawSectionTitle(L, 'Análisis competencial');
        L.doc.font('Helvetica').fontSize(8.5).fillColor(COL.body);
        L.ensureSpace(28);
        L.doc.text(acGlobalString, L.marginLeft, L.y, {
          width: L.contentW,
          align: 'justify',
          lineGap: 1,
        });
        L.y = L.doc.y + 8;
      }

      if (summary.resumen.sintesis_institucional?.trim()) {
        L.ensureSpace(44);
        this.drawSectionTitle(L, 'Síntesis institucional');
        const t = summary.resumen.sintesis_institucional;
        L.doc.font('Helvetica').fontSize(8.5).fillColor(COL.body);
        L.ensureSpace(28);
        L.doc.text(t, L.marginLeft, L.y, { width: L.contentW, align: 'justify', lineGap: 1 });
        L.y = L.doc.y + 8;
      }

      this.drawTwoColumnStrengths(L, summary);
      this.drawNumberedRecommendations(L, summary);

      L.ensureSpace(22);
      L.doc
        .fontSize(7)
        .fillColor(COL.subtle)
        .font('Helvetica')
        .text(`Generado el ${new Date().toLocaleString('es-CO')} · Supérate`, L.marginLeft, L.y, {
          width: L.contentW,
          align: 'center',
        });

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });

      return { success: true, pdfBuffer };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido al generar PDF';
      console.error('Error generando PDF:', error);
      return { success: false, error: message };
    }
  }

  /** Logo negro de marca (`logo_tematica_negra.png`); no usar variante blanca en PDF sobre fondo claro. */
  private resolvePdfLogoPath(): string | null {
    const candidates = [
      path.join(__dirname, '..', 'assets', 'superate-ia-logo.png'),
      path.join(__dirname, '..', '..', 'public', 'assets', 'logo_tematica_negra.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  /**
   * Encabezado predefinido: líneas azules, logo SUPERATE.IA a la izquierda,
   * títulos centrados en el área de texto y fase del reporte.
   */
  private drawHeader(L: Layout, phase: 'first' | 'second' | 'third'): void {
    const { doc } = L;
    const x = L.marginLeft;
    const w = L.contentW;
    const blue = COL.brandBlue;
    const yTop = L.y;
    const lineW = 3;

    doc.moveTo(x, yTop).lineTo(x + w, yTop).lineWidth(lineW).strokeColor(blue).stroke();

    const padY = 8;
    const logoH = 48;
    const logoX = x + 6;
    const logoY = yTop + padY;
    const gapAfterLogo = 12;
    const textLeft = logoX + logoH + gapAfterLogo;
    const textW = Math.max(120, w - (textLeft - x) - 8);

    const logoPath = this.resolvePdfLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, logoX, logoY, { height: logoH });
      } catch (e) {
        console.warn('[pdf] No se pudo incrustar el logo:', e);
      }
    }

    const textTop = logoY + 4;
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#000000');
    doc.text('SUPERATE.IA', textLeft, textTop, { width: textW, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(8.8).fillColor(blue);
    doc.text('REPORTE DE RESULTADOS ESTUDIANTE', textLeft, textTop + 20, {
      width: textW,
      align: 'center',
    });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(blue);
    doc.text(phaseLabelShort(phase).toUpperCase(), textLeft, textTop + 36, {
      width: textW,
      align: 'center',
    });

    const contentBottom = Math.max(logoY + logoH, textTop + 52) + 6;
    const yBottom = contentBottom;
    doc
      .moveTo(x, yBottom)
      .lineTo(x + w, yBottom)
      .lineWidth(lineW)
      .strokeColor(blue)
      .stroke();

    L.y = yBottom + 8;
  }

  private drawStudentStrip(
    L: Layout,
    p: {
      phaseShort: string;
      phaseLong: string;
      studentName: string;
      institutionName: string;
      sede: string;
      grado: string;
      jornada: string;
      fechaPublicacion: string;
    }
  ): void {
    const { doc } = L;
    const x = L.marginLeft;
    const w = L.contentW;
    const pad = 8;
    const leftX = x + pad;
    const rightX = x + w / 2 + 4;
    const colW = w / 2 - pad - 14;
    const innerW = w - pad * 2;

    const phaseTitle = `Fase del reporte: ${p.phaseShort}`;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COL.brandBlue);
    const phaseTitleH = doc.heightOfString(phaseTitle, { width: innerW });
    doc.font('Helvetica').fontSize(7.5).fillColor('#111827');
    const phaseDescH = doc.heightOfString(p.phaseLong, { width: innerW });
    const phaseH = phaseTitleH + 2 + phaseDescH;
    const rowGap = 9;
    const h = pad * 2 + phaseH + 4 + rowGap * 3;

    L.ensureSpace(h + 6);

    doc.save();
    doc.lineWidth(0.75);
    doc.roundedRect(x, L.y, w, h, 4).fillAndStroke(COL.white, '#d1d5db');

    let yy = L.y + pad;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COL.brandBlue);
    doc.text(phaseTitle, leftX, yy, { width: innerW });
    yy = doc.y + 2;
    doc.font('Helvetica').fontSize(7.5).fillColor('#374151');
    doc.text(p.phaseLong, leftX, yy, { width: innerW });
    yy = doc.y + 6;

    doc.font('Helvetica').fontSize(7.5).fillColor('#111827');
    doc.text(`Apellidos y nombres: ${p.studentName.toUpperCase()}`, leftX, yy, { width: colW });
    doc.text(`Fecha de publicación: ${p.fechaPublicacion}`, rightX, yy, { width: colW });
    yy += rowGap;

    doc.text(`Institución educativa: ${p.institutionName}`, leftX, yy, { width: colW });
    doc.text(`Sede: ${p.sede}`, rightX, yy, { width: colW });
    yy += rowGap;

    doc.text(`Grado: ${p.grado}`, leftX, yy, { width: colW });
    doc.text(`Jornada: ${p.jornada}`, rightX, yy, { width: colW });

    doc.restore();
    L.y += h + 4;
  }

  private drawKpiRow(L: Layout, summary: PersistedSummary, subjectRows: SubjectRow[]): void {
    const mg = summary.metricasGlobales;
    const imp =
      mg?.patronesGlobalesTiempo != null
        ? `${mg.patronesGlobalesTiempo.porcentajeImpulsividad.toFixed(1)}%`
        : 'N/D';
    const promedio = mg ? `${mg.promedioGeneral.toFixed(1)}%` : '—';
    const nMaterias = String(summary.metadata?.materiasAnalizadas ?? subjectRows.length ?? 0);
    const nivel = mg ? String(mg.nivelGeneralDesempeno) : '—';

    const items: { label: string; value: string; hint?: string }[] = [
      { label: 'Promedio general', value: promedio, hint: 'Sobre 100%' },
      { label: 'Materias analizadas', value: nMaterias, hint: 'de 7 posibles' },
      { label: 'Impulsividad', value: imp, hint: 'Resp. rápidas incorrectas' },
      { label: 'Nivel global', value: truncateText(nivel, 20), hint: 'Escala ICFES' },
    ];

    L.ensureSpace(56);
    const gap = 6;
    const n = items.length;
    const cardW = (L.contentW - gap * (n - 1)) / n;
    const cardH = 48;
    let cx = L.marginLeft;

    for (const it of items) {
      L.doc.save();
      L.doc.lineWidth(0.6);
      L.doc.roundedRect(cx, L.y, cardW, cardH, 5).fillAndStroke(COL.white, COL.cardBorder);
      L.doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(COL.subtle)
        .text(it.label.toUpperCase(), cx + 6, L.y + 6, { width: cardW - 12 });
      L.doc.font('Helvetica-Bold').fontSize(13).fillColor(COL.headerBg).text(it.value, cx + 6, L.y + 19, {
        width: cardW - 12,
      });
      if (it.hint) {
        L.doc.font('Helvetica').fontSize(6).fillColor(COL.subtle).text(it.hint, cx + 6, L.y + 36, {
          width: cardW - 12,
        });
      }
      L.doc.restore();
      cx += cardW + gap;
    }
    L.y += cardH + 4;
  }

  private drawProgressSection(L: Layout, subjectRows: SubjectRow[]): void {
    if (subjectRows.length === 0) return;
    L.ensureSpace(24);
    this.drawSectionTitle(L, 'Desempeño por materia');
    L.lineGap(4);

    const labelW = 118;
    const barX = L.marginLeft + labelW;
    const barW = L.contentW - labelW - 36;

    for (const row of subjectRows) {
      L.ensureSpace(18);
      const color = barColorForScore(row.puntaje);
      L.doc.font('Helvetica').fontSize(8).fillColor(COL.body);
      L.doc.text(truncateText(row.materia, 22), L.marginLeft, L.y + 2, { width: labelW - 4 });

      L.doc.rect(barX, L.y + 3, barW, 8).fill(COL.barTrack);
      const fillW = Math.max(0, (barW * Math.min(100, row.puntaje)) / 100);
      if (fillW > 0) {
        L.doc.rect(barX, L.y + 3, fillW, 8).fill(color);
      }
      L.doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COL.body)
        .text(`${row.puntaje.toFixed(0)}%`, barX + barW + 6, L.y + 2, { width: 30, align: 'right' });

      L.y += 17;
    }
    L.lineGap(2);
  }

  private drawSectionTitle(L: Layout, title: string): void {
    L.ensureSpace(18);
    L.doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COL.headerBg).text(title, L.marginLeft, L.y);
    L.doc
      .moveTo(L.marginLeft, L.y + 13)
      .lineTo(L.marginLeft + L.contentW, L.y + 13)
      .lineWidth(0.75)
      .strokeColor(COL.gold)
      .stroke();
    L.y += 19;
  }

  private drawSubjectCard(
    L: Layout,
    p: { materia: string; puntaje: number; nivel: string; texto: string; topics: { tema: string; puntaje: number; nota: string }[] }
  ): void {
    const x = L.marginLeft;
    const w = L.contentW;
    const pad = 9;
    const circleR = 24;
    const textX = x + pad * 2 + circleR * 2 + 8;
    const textW = w - (textX - x) - pad;

    const colEjeW = w * 0.54;
    const colPctW = 32;
    const colNivelW = Math.max(48, w - pad * 2 - colEjeW - colPctW - 10);

    const materiaLineH = 12;
    let analysisH = 0;
    if (p.texto?.trim()) {
      L.doc.font('Helvetica').fontSize(8.5);
      analysisH = L.doc.heightOfString(p.texto, { width: textW, align: 'justify' });
    }

    /** Alturas relativas al borde superior de la tarjeta (sin depender aún de `cardTop`). */
    const relCircleBottom = pad + circleR * 2 + 6;
    const relAfterTitle = pad + materiaLineH + 5;
    const relTextBlockEnd = p.texto?.trim() ? relAfterTitle + analysisH + 8 : relAfterTitle + 3;
    const relTableStart = Math.max(relTextBlockEnd, relCircleBottom + 6);

    L.doc.font('Helvetica').fontSize(7.5);
    let tableContentH = 0;
    if (p.topics.length > 0) {
      tableContentH = 16;
      for (const t of p.topics) {
        const hEje = L.doc.heightOfString(t.tema, { width: colEjeW, align: 'left' });
        const hNivel = L.doc.heightOfString(t.nota, { width: colNivelW, align: 'left' });
        tableContentH += Math.max(hEje, hNivel, 10) + 5;
      }
    }

    const innerFromTop = p.topics.length > 0 ? relTableStart + tableContentH : relTextBlockEnd;
    const cardH = innerFromTop + pad + 10;
    const safeCardH = Math.max(cardH, pad * 2 + circleR * 2 + pad + 6);

    L.ensureSpace(safeCardH + 10);

    const cardTop = L.y;
    const circleCx = x + pad + circleR;
    const circleCy = cardTop + pad + circleR;
    const textAfterTitleY = cardTop + relAfterTitle;
    const tableStartY = cardTop + relTableStart;

    L.doc.lineWidth(0.55);
    L.doc.roundedRect(x, cardTop, w, safeCardH, 5).fillAndStroke(COL.cardBg, COL.cardBorder);

    const scoreVal = Number.isFinite(p.puntaje) ? Math.round(p.puntaje) : 0;
    const ring = barColorForScore(Number.isFinite(p.puntaje) ? p.puntaje : 0);
    L.doc.circle(circleCx, circleCy, circleR + 2).lineWidth(2.2).strokeColor(ring).stroke();
    L.doc.circle(circleCx, circleCy, circleR).fill(COL.white);
    L.doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COL.headerBg)
      .text(String(scoreVal), circleCx - circleR, circleCy - 7, {
        width: circleR * 2,
        align: 'center',
      });
    L.doc.font('Helvetica').fontSize(6.5).fillColor(COL.subtle).text('%', circleCx - 10, circleCy + 5, {
      width: 20,
      align: 'center',
    });
    L.doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(COL.subtle)
      .text(truncateText(p.nivel, 22), circleCx - circleR, circleCy + 14, {
        width: circleR * 2,
        align: 'center',
      });

    L.doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COL.headerBg).text(p.materia, textX, cardTop + pad, {
      width: textW,
    });
    if (p.texto?.trim()) {
      L.doc.font('Helvetica').fontSize(8.5).fillColor(COL.body);
      L.doc.text(p.texto, textX, textAfterTitleY, { width: textW, align: 'justify', lineGap: 0.5 });
    }

    let tableBottom = tableStartY;
    if (p.topics.length > 0) {
      const col1 = x + pad;
      const col2 = col1 + colEjeW + 4;
      const col3 = col2 + colPctW + 4;
      let rowY = tableStartY;

      L.doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COL.headerBg);
      L.doc.text('Ejes temáticos evaluados', col1, rowY, { width: w - pad * 2 });
      rowY += 11;

      L.doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COL.subtle);
      L.doc.text('Eje', col1, rowY, { width: colEjeW });
      L.doc.text('%', col2, rowY, { width: colPctW });
      L.doc.text('Nivel', col3, rowY, { width: colNivelW });
      rowY += 8;
      L.doc.moveTo(col1, rowY).lineTo(x + w - pad, rowY).strokeColor(COL.cardBorder).lineWidth(0.35).stroke();
      rowY += 4;

      L.doc.font('Helvetica').fontSize(7.5).fillColor(COL.body);
      for (const t of p.topics) {
        const rowStart = rowY;
        L.doc.text(t.tema, col1, rowY, { width: colEjeW, align: 'left', lineGap: 0.5 });
        const yAfterEje = L.doc.y;
        L.doc.text(String(Math.round(t.puntaje)), col2, rowStart, { width: colPctW, lineGap: 0 });
        const yAfterPct = L.doc.y;
        L.doc.text(t.nota, col3, rowStart, { width: colNivelW, align: 'left', lineGap: 0.5 });
        const yAfterNivel = L.doc.y;
        rowY = Math.max(yAfterEje, yAfterPct, yAfterNivel) + 5;
      }
      tableBottom = rowY;
    }

    let finalBottom = cardTop + safeCardH;
    if (p.topics.length > 0) {
      finalBottom = Math.max(finalBottom, tableBottom + pad);
    }
    if (p.texto?.trim()) {
      finalBottom = Math.max(finalBottom, L.doc.y + 4);
    }
    L.y = finalBottom + 8;
  }

  private drawTwoColumnStrengths(L: Layout, summary: PersistedSummary): void {
    const fort = summary.resumen.fortalezas_academicas ?? [];
    const mej = summary.resumen.aspectos_por_mejorar ?? [];
    if (fort.length === 0 && mej.length === 0) return;

    L.ensureSpace(30);
    this.drawSectionTitle(L, 'Fortalezas y oportunidades de mejora');
    L.lineGap(4);

    const gap = 8;
    const colW = (L.contentW - gap) / 2;
    const leftX = L.marginLeft;
    const rightX = L.marginLeft + colW + gap;

    const measureCol = (items: string[]): number => {
      if (items.length === 0) return 0;
      L.doc.font('Helvetica').fontSize(7.5);
      let h = 20;
      for (const line of items) {
        h += L.doc.heightOfString(`• ${line}`, { width: colW - 14 }) + 2;
      }
      return h + 8;
    };

    const hLeft = fort.length ? measureCol(fort) : 0;
    const hRight = mej.length ? measureCol(mej) : 0;
    const boxH = Math.max(hLeft, hRight, 32);

    L.ensureSpace(boxH + 8);
    const y0 = L.y;

    const drawBox = (
      x: number,
      title: string,
      items: string[],
      bg: string,
      border: string
    ): void => {
      L.doc.lineWidth(0.45);
      L.doc.roundedRect(x, y0, colW, boxH, 4).fillAndStroke(bg, border);
      L.doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COL.headerBg).text(title, x + 6, y0 + 6, {
        width: colW - 12,
      });
      let ly = y0 + 19;
      L.doc.font('Helvetica').fontSize(7.5).fillColor(COL.body);
      for (const line of items) {
        L.doc.text(`• ${line}`, x + 6, ly, { width: colW - 12, align: 'left' });
        ly = L.doc.y + 1;
      }
    };

    if (fort.length > 0) {
      drawBox(leftX, 'Fortalezas', fort, '#ecfdf5', '#10b981');
    } else {
      L.doc.lineWidth(0.35);
      L.doc.roundedRect(leftX, y0, colW, boxH, 4).fillAndStroke('#f4f4f5', COL.cardBorder);
    }

    if (mej.length > 0) {
      drawBox(rightX, 'Aspectos por mejorar', mej, '#fffbeb', '#f59e0b');
    } else {
      L.doc.lineWidth(0.35);
      L.doc.roundedRect(rightX, y0, colW, boxH, 4).fillAndStroke('#f4f4f5', COL.cardBorder);
    }

    L.y = y0 + boxH + 6;
  }

  private drawNumberedRecommendations(L: Layout, summary: PersistedSummary): void {
    const rec = summary.resumen.recomendaciones_enfoque_saber11 ?? [];
    if (rec.length === 0) return;
    L.ensureSpace(32);
    this.drawSectionTitle(L, 'Recomendaciones (enfoque Saber 11)');
    L.lineGap(2);
    L.doc.font('Helvetica').fontSize(8.5).fillColor(COL.body);
    let i = 1;
    for (const r of rec) {
      const block = `${i}. ${r}`;
      L.ensureSpace(22);
      L.doc.text(block, L.marginLeft + 2, L.y, {
        width: L.contentW - 4,
        align: 'left',
        lineGap: 0.5,
      });
      L.y = L.doc.y + 4;
      i += 1;
    }
    L.lineGap(4);
  }

  static canonicalSummaryPdfPath(
    studentId: string,
    phase: 'first' | 'second' | 'third'
  ): string {
    return `pdfs/${studentId}/resumen_${phase}_${studentId}.pdf`;
  }

  async deleteCanonicalPdfIfExists(
    studentId: string,
    phase: 'first' | 'second' | 'third'
  ): Promise<void> {
    const filePath = PDFService.canonicalSummaryPdfPath(studentId, phase);
    const file = storage.bucket().file(filePath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete({ ignoreNotFound: true });
    }
  }

  async getCanonicalPdfPublicUrlIfExists(
    studentId: string,
    phase: 'first' | 'second' | 'third'
  ): Promise<string | null> {
    const filePath = PDFService.canonicalSummaryPdfPath(studentId, phase);
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  }

  async uploadPdfBufferToPath(pdfBuffer: Buffer, filePath: string): Promise<string> {
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=86400',
      },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  }

  async generateAndUploadPDF(options: PDFGenerationOptions): Promise<PDFGenerationResult> {
    try {
      const pdfResult = await this.generateSummaryPDF(options);

      if (!pdfResult.success || !pdfResult.pdfBuffer) {
        return {
          success: false,
          error: pdfResult.error || 'Error generando PDF',
        };
      }

      const filePath = PDFService.canonicalSummaryPdfPath(options.studentId, options.phase);
      const downloadUrl = await this.uploadPdfBufferToPath(pdfResult.pdfBuffer, filePath);

      return {
        success: true,
        pdfBuffer: pdfResult.pdfBuffer,
        downloadUrl,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error en generateAndUploadPDF:', error);
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const pdfService = new PDFService();
export type { PDFGenerationOptions, PDFGenerationResult };
