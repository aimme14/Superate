import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Printer, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { GRADE_REPORT_MAX_SCORE, GRADE_REPORT_SCOPE_LABEL, type GradeReport } from './deriveGradeReport'

interface GradeReportCardProps {
  report: GradeReport
  theme?: 'light' | 'dark'
  /** Si false, oculta el botón de impresión (p. ej. cuando el padre ya tiene uno). */
  showPrintButton?: boolean
  /** Texto opcional bajo el título (sede, institución). */
  metaLine?: string
  className?: string
}

export function GradeReportCard({
  report,
  theme = 'light',
  showPrintButton = true,
  metaLine,
  className,
}: GradeReportCardProps) {
  const dark = theme === 'dark'

  const handlePrint = () => {
    // Doble rAF: deja aplicar estilos de impresión / layout antes del compositor de PDF (Chromium).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  return (
    <div id="grade-report-print-root" className={cn('grade-report-sheet', className)}>
      <Card
        className={cn(
          'overflow-hidden rounded-2xl border shadow-lg print:shadow-none print:border-gray-300',
          dark
            ? 'border-zinc-700/90 bg-zinc-900 text-zinc-100'
            : 'border-slate-200/90 bg-white text-slate-900 shadow-slate-200/50'
        )}
      >
        <div
          className={cn(
            'grade-report-doc-header relative border-b overflow-hidden',
            dark ? 'border-zinc-700/80' : 'border-slate-200/90'
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-4 px-5 pb-5 pt-5 sm:flex-row sm:items-start sm:justify-between',
              dark
                ? 'bg-gradient-to-br from-zinc-900/98 via-zinc-900 to-blue-950/30'
                : 'bg-gradient-to-br from-slate-50/90 via-white to-sky-50/25'
            )}
          >
            <div className="min-w-0 flex-1 space-y-2">
                <p
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.2em]',
                    dark ? 'text-blue-300/90' : 'text-blue-700'
                  )}
                >
                  Informe institucional
                </p>
                <CardTitle className={cn('text-2xl font-bold tracking-tight sm:text-[1.65rem]', dark ? 'text-white' : 'text-slate-900')}>
                  {report.gradeName}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'border font-medium',
                      dark ? 'border-zinc-600/80 bg-zinc-800/80 text-zinc-200' : 'border-slate-200 bg-white text-slate-700'
                    )}
                  >
                    {GRADE_REPORT_SCOPE_LABEL}
                  </Badge>
                </div>
                {metaLine ? (
                  <p className={cn('text-sm', dark ? 'text-zinc-400' : 'text-slate-600')}>{metaLine}</p>
                ) : null}
                <p className={cn('text-xs', dark ? 'text-zinc-500' : 'text-slate-500')}>
                  Año lectivo {report.academicYear} · Estudiantes en el resumen: {report.totalStudents}
                </p>
            </div>
            {showPrintButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className={cn(
                  'grade-report-no-print shrink-0 print:hidden',
                  dark ? 'border-zinc-500/80 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-100' : 'border-slate-300 bg-white hover:bg-slate-50'
                )}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Imprimir / Guardar como PDF
              </Button>
            )}
          </div>
        </div>

        <CardContent className={cn('space-y-8 px-5 pb-6 pt-7', dark ? '' : '')}>
          {/* Resumen general */}
          <section className="grade-report-section">
            <SectionHeading dark={dark}>Resumen general</SectionHeading>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 print:grid-cols-3">
              <div
                className={cn(
                  'grade-report-kpi-card rounded-xl px-4 py-4 shadow-sm ring-1 sm:col-span-1 print:break-inside-avoid',
                  dark ? 'border border-zinc-700/80 bg-zinc-800/40 ring-white/5' : 'border border-slate-100 bg-white ring-slate-900/5'
                )}
              >
                <p className={cn('text-xs mb-1 font-medium', dark ? 'text-zinc-400' : 'text-slate-500')}>
                  Porcentaje de acierto (sobre 100)
                </p>
                <p className={cn('text-3xl font-bold tabular-nums tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
                  {report.overallAvg != null ? `${report.overallAvg}%` : '—'}
                </p>
              </div>
              <div
                className={cn(
                  'grade-report-kpi-card rounded-xl px-4 py-4 shadow-sm ring-1 print:break-inside-avoid',
                  dark ? 'border border-zinc-700/80 bg-zinc-800/40 ring-white/5' : 'border border-slate-100 bg-white ring-slate-900/5'
                )}
              >
                <p className={cn('text-xs mb-1 font-medium', dark ? 'text-zinc-400' : 'text-slate-500')}>
                  Puntaje global (sobre {GRADE_REPORT_MAX_SCORE})
                </p>
                <p className={cn('text-3xl font-bold tabular-nums tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
                  {report.overallScoreOutOf500 != null ? (
                    <>
                      {report.overallScoreOutOf500}
                      <span className={cn('text-lg font-semibold opacity-70')}>/ {GRADE_REPORT_MAX_SCORE}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div
                className={cn(
                  'grade-report-kpi-card rounded-xl px-4 py-4 shadow-sm ring-1 print:break-inside-avoid',
                  dark ? 'border border-zinc-700/80 bg-zinc-800/40 ring-white/5' : 'border border-slate-100 bg-white ring-slate-900/5'
                )}
              >
                <p className={cn('text-xs mb-1 font-medium', dark ? 'text-zinc-400' : 'text-slate-500')}>
                  Fases con información
                </p>
                <p className={cn('text-3xl font-bold tabular-nums tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
                  {report.phases.filter((p) => p.hasData).length} / 3
                </p>
              </div>
            </div>

            {report.subjectRows.length > 0 && (
              <div
                className={cn(
                  'grade-report-subjects-block mt-5 overflow-hidden rounded-xl border text-sm',
                  dark ? 'border-zinc-700/90 bg-zinc-800/20' : 'border-slate-200 bg-white'
                )}
              >
                <p
                  className={cn(
                    'border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide',
                    dark ? 'border-zinc-700 bg-zinc-800/40 text-zinc-300' : 'border-slate-100 bg-slate-50 text-slate-600'
                  )}
                >
                  Materias y ejes (última fase con datos)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-xs sm:text-sm">
                    <thead>
                      <tr className={cn('border-b', dark ? 'border-zinc-700 text-zinc-400' : 'border-slate-200 text-slate-600')}>
                        <th className="px-3 py-2 font-semibold">Materia</th>
                        <th className="px-3 py-2 font-semibold tabular-nums">% acierto</th>
                        <th className="hidden px-3 py-2 font-semibold sm:table-cell print:table-cell">Eje fuerte</th>
                        <th className="hidden px-3 py-2 font-semibold md:table-cell print:table-cell">Eje a reforzar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.subjectRows.map((row) => (
                        <tr
                          key={row.subjectDisplay}
                          className={cn('border-b last:border-0', dark ? 'border-zinc-700/80' : 'border-slate-100')}
                        >
                          <td className={cn('px-3 py-2 font-medium', dark ? 'text-zinc-100' : 'text-slate-900')}>
                            {row.subjectDisplay}
                          </td>
                          <td className={cn('px-3 py-2 tabular-nums', dark ? 'text-zinc-200' : 'text-slate-800')}>
                            {row.avgPct != null ? `${Math.round(row.avgPct * 10) / 10}%` : '—'}
                          </td>
                          <td className={cn('hidden px-3 py-2 sm:table-cell print:table-cell', dark ? 'text-zinc-400' : 'text-slate-600')}>
                            {row.strongestTopic ?? '—'}
                          </td>
                          <td className={cn('hidden px-3 py-2 md:table-cell print:table-cell', dark ? 'text-zinc-400' : 'text-slate-600')}>
                            {row.weakestTopic ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Por fase */}
          <section className="grade-report-section">
            <SectionHeading dark={dark}>Desempeño por fase</SectionHeading>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 print:grid-cols-3">
              {report.phases.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    'phase-card rounded-xl border p-4 transition-colors min-h-[148px] print:break-inside-avoid',
                    dark
                      ? 'border-zinc-700/90 bg-zinc-800/25 hover:bg-zinc-800/40'
                      : 'border-slate-200 bg-white shadow-sm hover:border-slate-300',
                    !p.hasData && (dark ? 'opacity-75' : 'opacity-85')
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        dark ? 'bg-blue-600/30 text-blue-200' : 'bg-blue-100 text-blue-800'
                      )}
                      aria-hidden
                    >
                      {p.key === 'first' ? 'I' : p.key === 'second' ? 'II' : 'III'}
                    </span>
                    <span className={cn('text-sm font-semibold', dark ? 'text-zinc-100' : 'text-slate-900')}>{p.label}</span>
                  </div>
                  {!p.hasData ? (
                    <p className={cn('text-xs leading-snug', dark ? 'text-zinc-500' : 'text-slate-500')}>
                      Sin datos suficientes (actualice el resumen del grado si corresponde).
                    </p>
                  ) : (
                    <>
                      <p className={cn('tabular-nums text-xl font-semibold', dark ? 'text-white' : 'text-slate-900')}>{p.avgScore}%</p>
                      <p className={cn('text-xs', dark ? 'text-zinc-400' : 'text-gray-600')}>
                        Completitud: {Math.round(p.completionRate)}%
                      </p>
                      <div className={cn('text-xs space-y-1 pt-1', dark ? 'text-zinc-300' : 'text-gray-700')}>
                        <p>
                          <span className="opacity-70">Fortaleza:</span> {p.strongestSubjectDisplay}
                          {p.strongestTopic !== '—' && (
                            <span className={cn(dark ? 'text-zinc-500' : 'text-gray-500')}>
                              {' '}
                              (tema: {p.strongestTopic})
                            </span>
                          )}
                        </p>
                        <p>
                          <span className="opacity-70">A refuerzo:</span> {p.weakestSubjectDisplay}
                          {p.weakestTopic !== '—' && (
                            <span className={cn(dark ? 'text-zinc-500' : 'text-gray-500')}>
                              {' '}
                              (tema: {p.weakestTopic})
                            </span>
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Índice de mejora */}
          <section className="grade-report-section">
            <SectionHeading dark={dark}>Evolución entre fases consecutivas</SectionHeading>
            {report.improvementIndex.gapWarning && (
              <p
                className={cn(
                  'grade-report-evolution-item text-sm rounded-lg border px-3 py-2 mb-3 print:break-inside-avoid',
                  dark ? 'border-amber-900/50 bg-amber-950/30 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900'
                )}
              >
                {report.improvementIndex.gapWarning}
              </p>
            )}
            {!report.improvementIndex.available ? (
              <p className={cn('text-sm', dark ? 'text-zinc-400' : 'text-gray-600')}>
                Se necesitan al menos dos fases consecutivas con datos (por ejemplo Fase I y Fase II) para comparar
                evolución. Si solo hay una fase con información, complete evaluaciones en las siguientes fases.
              </p>
            ) : (
              <ul className="space-y-2">
                {report.improvementIndex.transitions.map((t) => (
                  <li
                    key={`${t.from}-${t.to}`}
                    className={cn(
                      'grade-report-evolution-item flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm print:break-inside-avoid',
                      dark ? 'border-zinc-700 bg-zinc-800/40' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <span className="font-medium">
                      {t.from} → {t.to}
                    </span>
                    <TrendIcon trend={t.trend} dark={dark} />
                    <span className="tabular-nums">
                      {t.delta > 0 ? '+' : ''}
                      {t.delta} puntos
                    </span>
                    <span className={cn('text-xs', dark ? 'text-zinc-400' : 'text-gray-600')}>
                      ({trendLabel(t.trend)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Narrativa */}
          <section className="grade-report-section">
            <SectionHeading dark={dark}>Narrativa</SectionHeading>
            <p
              className={cn(
                'grade-report-narrative-block text-sm leading-relaxed rounded-xl border px-4 py-4 print:break-inside-avoid',
                dark ? 'border-zinc-700/90 bg-zinc-800/35 text-zinc-200' : 'border-slate-200 bg-slate-50/90 text-slate-800'
              )}
            >
              {report.narrative}
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}

function SectionHeading({ children, dark }: { children: ReactNode; dark: boolean }) {
  return (
    <h3
      className={cn(
        'mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]',
        dark ? 'text-zinc-400' : 'text-slate-500'
      )}
    >
      <span className={cn('h-3 w-1 shrink-0 rounded-full', dark ? 'bg-blue-500' : 'bg-blue-600')} aria-hidden />
      {children}
    </h3>
  )
}

function TrendIcon({ trend, dark }: { trend: 'up' | 'down' | 'stable'; dark: boolean }) {
  const cls = dark ? 'text-zinc-300' : 'text-gray-700'
  if (trend === 'up') return <TrendingUp className={cn('h-4 w-4 text-emerald-500')} aria-hidden />
  if (trend === 'down') return <TrendingDown className={cn('h-4 w-4 text-red-500')} aria-hidden />
  return <Minus className={cn('h-4 w-4', cls)} aria-hidden />
}

function trendLabel(t: 'up' | 'down' | 'stable'): string {
  if (t === 'up') return 'mejora respecto a la fase anterior'
  if (t === 'down') return 'descenso respecto a la fase anterior'
  return 'desempeño estable'
}
