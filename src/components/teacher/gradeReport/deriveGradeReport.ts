import type { GradePhaseSummary, GradeSummaryDoc, GradeTopicSummary } from '@/services/teacher/gradeSummary.service'
import { displayNameFromSubjectSlug } from '@/services/teacher/gradeSummary.service'

/** Umbral en puntos porcentuales: variaciones menores se consideran estables. */
export const GRADE_REPORT_STABILITY_THRESHOLD = 2

export const GRADE_REPORT_SCOPE_LABEL = 'Grado completo' as const

const PHASE_ORDER = ['first', 'second', 'third'] as const
export type GradeReportPhaseKey = (typeof PHASE_ORDER)[number]

const PHASE_LABEL: Record<GradeReportPhaseKey, string> = {
  first: 'Fase I',
  second: 'Fase II',
  third: 'Fase III',
}

const EMPTY_PHASE: GradePhaseSummary = {
  studentsComplete: 0,
  completionRate: 0,
  avgScore: null,
  weakestSubject: null,
  strongestSubject: null,
  subjects: {},
}

export interface GradeReportPhaseRow {
  key: GradeReportPhaseKey
  label: string
  hasData: boolean
  avgScore: number | null
  completionRate: number
  strongestSubjectDisplay: string
  weakestSubjectDisplay: string
  strongestTopic: string
  weakestTopic: string
}

export interface GradeReportImprovementTransition {
  from: string
  to: string
  delta: number
  trend: 'up' | 'down' | 'stable'
}

export interface GradeReportImprovementIndex {
  available: boolean
  transitions: GradeReportImprovementTransition[]
  /** Cuando hay datos en fases no adyacentes sin la intermedia (p. ej. I y III sin II). */
  gapWarning: string | null
}

/** Opciones para mostrar nombre de grado humano cuando el documento solo trae IDs. */
export interface DeriveGradeReportOptions {
  /** Nombre del grado desde el perfil del docente (ej. desde useTeacherDashboardStats). */
  teacherGradeDisplayName?: string | null
}

/** Ponderación alineada con el ranking docente / análisis Icfes (máx. 500 si las 7 áreas están evaluadas). */
export const GRADE_REPORT_MAX_SCORE = 500

export interface GradeReportSubjectRow {
  subjectDisplay: string
  avgPct: number | null
  strongestTopic: string | null
  weakestTopic: string | null
}

export interface GradeReport {
  scopeLabel: typeof GRADE_REPORT_SCOPE_LABEL
  gradeName: string
  academicYear: string | number
  totalStudents: number
  phases: GradeReportPhaseRow[]
  improvementIndex: GradeReportImprovementIndex
  /** Media simple de avgScore solo en fases con datos; null si ninguna tiene datos. */
  overallAvg: number | null
  /**
   * Promedio del puntaje sobre 500 entre fases con datos (misma lógica que sumar por materia en cada fase).
   */
  overallScoreOutOf500: number | null
  /** Detalle por materia de la última fase con información (ejes = temas del banco). */
  subjectRows: GradeReportSubjectRow[]
  /** Basada en la última fase con datos (estado más reciente). */
  narrative: string
}

export function phaseHasReportData(phase: GradePhaseSummary): boolean {
  return phase.avgScore != null && phase.studentsComplete > 0
}

/** Evita mostrar IDs de Firestore u otras claves técnicas como nombre de grado. */
export function looksLikeTechnicalId(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  if (v.includes('/')) return true
  if (v.length >= 24 && !v.includes(' ')) return true
  return false
}

function isDisplayableGradeLabel(value: string | undefined | null): boolean {
  const v = value?.trim() ?? ''
  if (!v) return false
  if (/^grado$/i.test(v)) return false
  if (looksLikeTechnicalId(v)) return false
  return true
}

/**
 * Prioridad: nombre en el resumen institucional → nombre del docente → etiqueta neutra (nunca gradeId crudo).
 */
export function resolveGradeDisplayName(
  summary: GradeSummaryDoc,
  options?: DeriveGradeReportOptions
): string {
  const fromSummary = summary.gradeName?.trim()
  if (fromSummary && isDisplayableGradeLabel(fromSummary)) return fromSummary

  const fromTeacher = options?.teacherGradeDisplayName?.trim()
  if (fromTeacher && isDisplayableGradeLabel(fromTeacher)) return fromTeacher

  return 'Grado asignado'
}

function subjectDisplayFromSlug(slug: string | null): string {
  if (!slug || !slug.trim()) return '—'
  return displayNameFromSubjectSlug(slug.trim())
}

/** Biología, Química y Física comparten 100 pts; el resto 100 pts c/u → máx. 500. */
const NATURALES_FOR_SCORE = ['Biologia', 'Quimica', 'Física']

function pointsFromSubjectPct(displaySubject: string, pct: number): number {
  return NATURALES_FOR_SCORE.includes(displaySubject)
    ? (pct / 100) * (100 / 3)
    : (pct / 100) * 100
}

/** Puntaje 0–500 a partir de los promedios por materia agregados en una fase. */
function computePhaseScoreOutOf500(phase: GradePhaseSummary): number | null {
  let total = 0
  let any = false
  for (const [slug, sub] of Object.entries(phase.subjects || {})) {
    if (sub.avgPct == null || !Number.isFinite(sub.avgPct)) continue
    const display = subjectDisplayFromSlug(slug)
    if (display === '—') continue
    any = true
    total += pointsFromSubjectPct(display, sub.avgPct)
  }
  return any ? Math.round(total * 10) / 10 : null
}

function subjectRowsFromPhase(phase: GradePhaseSummary): GradeReportSubjectRow[] {
  const rows: GradeReportSubjectRow[] = Object.entries(phase.subjects || {}).map(([slug, sub]) => ({
    subjectDisplay: subjectDisplayFromSlug(slug),
    avgPct: sub.avgPct,
    strongestTopic: sub.strongestTopic,
    weakestTopic: sub.weakestTopic,
  }))
  rows.sort((a, b) => {
    const pa = a.avgPct ?? -1
    const pb = b.avgPct ?? -1
    if (pb !== pa) return pb - pa
    return a.subjectDisplay.localeCompare(b.subjectDisplay, 'es')
  })
  return rows.filter((r) => r.subjectDisplay !== '—')
}

/** Empate en pct: orden lexicográfico del nombre del tema. */
function pickTopicByMetric(
  topics: Record<string, GradeTopicSummary>,
  mode: 'max' | 'min'
): string | null {
  const entries = Object.entries(topics).filter(([, t]) => t.pct != null)
  if (entries.length === 0) return null
  entries.sort((a, b) => {
    const pa = a[1].pct ?? 0
    const pb = b[1].pct ?? 0
    if (pa !== pb) return mode === 'max' ? pb - pa : pa - pb
    return a[0].localeCompare(b[0], 'es')
  })
  return entries[0]?.[0] ?? null
}

/** Regla documentada: tema recomendado = mismo criterio que gradeSummary por materia (strongest/weakest topic). */
function strongestTopicForPhase(phase: GradePhaseSummary): string {
  const slug = phase.strongestSubject
  if (!slug) return '—'
  const sub = phase.subjects[slug]
  if (!sub) return '—'
  if (sub.strongestTopic) return sub.strongestTopic
  const picked = pickTopicByMetric(sub.topics, 'max')
  return picked ?? '—'
}

function weakestTopicForPhase(phase: GradePhaseSummary): string {
  const slug = phase.weakestSubject
  if (!slug) return '—'
  const sub = phase.subjects[slug]
  if (!sub) return '—'
  if (sub.weakestTopic) return sub.weakestTopic
  const picked = pickTopicByMetric(sub.topics, 'min')
  return picked ?? '—'
}

function buildAdjacentTransitions(
  gradePhases: Record<string, GradePhaseSummary>
): { transitions: GradeReportImprovementTransition[]; gapWarning: string | null } {
  const transitions: GradeReportImprovementTransition[] = []

  const pair = (from: GradeReportPhaseKey, to: GradeReportPhaseKey) => {
    const pf = gradePhases[from] ?? EMPTY_PHASE
    const pt = gradePhases[to] ?? EMPTY_PHASE
    if (!phaseHasReportData(pf) || !phaseHasReportData(pt)) return
    const a = pf.avgScore
    const b = pt.avgScore
    if (a == null || b == null) return
    const delta = Math.round((b - a) * 10) / 10
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (delta > GRADE_REPORT_STABILITY_THRESHOLD) trend = 'up'
    else if (delta < -GRADE_REPORT_STABILITY_THRESHOLD) trend = 'down'
    transitions.push({
      from: PHASE_LABEL[from],
      to: PHASE_LABEL[to],
      delta,
      trend,
    })
  }

  pair('first', 'second')
  pair('second', 'third')

  const has = (k: GradeReportPhaseKey) => phaseHasReportData(gradePhases[k] ?? EMPTY_PHASE)
  let gapWarning: string | null = null
  if (has('first') && !has('second') && has('third')) {
    gapWarning =
      'Hay información en la primera y la tercera fase, pero no en la segunda; no se calcula evolución entre fases no consecutivas.'
  }

  return { transitions, gapWarning }
}

function buildNarrative(report: Omit<GradeReport, 'narrative'>): string {
  const lastWithData = [...report.phases].reverse().find((p) => p.hasData)
  const best = lastWithData?.strongestSubjectDisplay ?? '—'
  const weak = lastWithData?.weakestSubjectDisplay ?? '—'

  const scorePhrase =
    report.overallScoreOutOf500 != null
      ? `un puntaje global orientativo de ${report.overallScoreOutOf500} sobre ${GRADE_REPORT_MAX_SCORE}`
      : null

  const pctPhrase =
    report.overallAvg != null
      ? `un porcentaje de acierto en las preguntas del ${Math.round(report.overallAvg)}%`
      : null

  let metrics =
    scorePhrase && pctPhrase
      ? `${scorePhrase} y ${pctPhrase}`
      : scorePhrase ?? pctPhrase ?? null

  if (!metrics) {
    metrics =
      'datos insuficientes para sintetizar puntaje global y porcentaje de aciertos en el resumen agregado'
  }

  return `${GRADE_REPORT_SCOPE_LABEL}: el grado ${report.gradeName} (${report.academicYear}) registra ${metrics}. Según la última fase con información, el área de mayor desempeño es ${best} y la que más se beneficiaría de refuerzo es ${weak}.`
}

export function deriveGradeReport(
  summary: GradeSummaryDoc | null | undefined,
  options?: DeriveGradeReportOptions
): GradeReport | null {
  if (!summary) return null

  const gradeName = resolveGradeDisplayName(summary, options)

  const phases: GradeReportPhaseRow[] = PHASE_ORDER.map((key) => {
    const phase = summary.phases[key] ?? EMPTY_PHASE
    const hasData = phaseHasReportData(phase)
    return {
      key,
      label: PHASE_LABEL[key],
      hasData,
      avgScore: hasData && phase.avgScore != null ? phase.avgScore : null,
      completionRate: phase.completionRate ?? 0,
      strongestSubjectDisplay: subjectDisplayFromSlug(phase.strongestSubject),
      weakestSubjectDisplay: subjectDisplayFromSlug(phase.weakestSubject),
      strongestTopic: hasData ? strongestTopicForPhase(phase) : '—',
      weakestTopic: hasData ? weakestTopicForPhase(phase) : '—',
    }
  })

  const withData = phases.filter((p) => p.hasData && p.avgScore != null)
  let overallAvg: number | null = null
  if (withData.length > 0) {
    const sum = withData.reduce((s, p) => s + (p.avgScore as number), 0)
    overallAvg = Math.round((sum / withData.length) * 10) / 10
  }

  const phasesWithSummary = PHASE_ORDER.map((k) => summary.phases[k] ?? EMPTY_PHASE).filter((ph) =>
    phaseHasReportData(ph)
  )
  const scores500 = phasesWithSummary.map((ph) => computePhaseScoreOutOf500(ph)).filter(
    (x): x is number => x != null && Number.isFinite(x)
  )
  let overallScoreOutOf500: number | null = null
  if (scores500.length > 0) {
    overallScoreOutOf500 =
      Math.round(((scores500.reduce((a, b) => a + b, 0) / scores500.length) as number) * 10) / 10
  }

  const lastPhaseBlock = [...PHASE_ORDER].reverse().map((k) => summary.phases[k] ?? EMPTY_PHASE).find((ph) =>
    phaseHasReportData(ph)
  )
  const subjectRows = lastPhaseBlock ? subjectRowsFromPhase(lastPhaseBlock) : []

  const { transitions, gapWarning } = buildAdjacentTransitions(summary.phases)

  const improvementIndex: GradeReportImprovementIndex = {
    available: transitions.length > 0,
    transitions,
    gapWarning,
  }

  const base: Omit<GradeReport, 'narrative'> = {
    scopeLabel: GRADE_REPORT_SCOPE_LABEL,
    gradeName,
    academicYear: summary.academicYear,
    totalStudents: summary.totalStudents ?? 0,
    phases,
    improvementIndex,
    overallAvg,
    overallScoreOutOf500,
    subjectRows,
  }

  return {
    ...base,
    narrative: buildNarrative(base),
  }
}
