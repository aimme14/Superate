/**
 * Reporte académico IA por fase: lectura Firestore, callables (sin HTTP público) y PDF.
 */
import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Loader2, FileDown, RefreshCw, Sparkles } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { StudentProgressSummaryDoc } from '@/services/studentProgressSummary/fetchEvaluationsFromSummary'
import {
  subscribeResumenActual,
  callGenerateStudentAcademicSummary,
  callGetStudentAcademicSummaryPdfUrl,
  persistedSummaryFromCallableResult,
  getCallableErrorMessage,
  type PersistedSummary,
} from '@/services/studentSummary/studentSummary.service'
import { useToast } from '@/hooks/ui/use-toast'

export type AcademicPhaseKey = 'first' | 'second' | 'third'

type Props = {
  studentId: string
  phase: AcademicPhaseKey
  studentSummary: StudentProgressSummaryDoc | null
  theme: 'light' | 'dark'
  /** Invocado tras generar/regenerar para refrescar datos externos si aplica */
  onReportChanged?: () => void
}

export function AcademicReportSection({
  studentId,
  phase,
  studentSummary,
  theme,
  onReportChanged,
}: Props) {
  const { toast } = useToast()
  const [persisted, setPersisted] = useState<PersistedSummary | null | undefined>(undefined)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)

  useEffect(() => {
    setPersisted(undefined)
    const unsub = subscribeResumenActual(studentId, phase, (data) => {
      setPersisted(data)
    })
    return () => unsub()
  }, [studentId, phase])

  const phaseBlock = studentSummary?.phases?.[phase]
  const submitted = phaseBlock?.submittedCount ?? 0
  const missing = Math.max(0, 7 - submitted)

  const handleGenerate = useCallback(async () => {
    setGenerateBusy(true)
    try {
      const raw = await callGenerateStudentAcademicSummary(studentId, phase, 'ensure')
      const errMsg = getCallableErrorMessage(raw)
      if (errMsg) {
        toast({ title: 'No se pudo generar el reporte', description: errMsg, variant: 'destructive' })
        return
      }
      const extracted = persistedSummaryFromCallableResult(raw)
      if (extracted) setPersisted(extracted)
      else {
        toast({
          title: 'Respuesta inesperada',
          description: 'No se recibió el resumen. Revisa la consola o inténtalo de nuevo.',
          variant: 'destructive',
        })
      }
      onReportChanged?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de red o permisos'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setGenerateBusy(false)
    }
  }, [studentId, phase, onReportChanged, toast])

  const handleRegenerateConfirm = useCallback(async () => {
    setRegenOpen(false)
    setGenerateBusy(true)
    try {
      const raw = await callGenerateStudentAcademicSummary(studentId, phase, 'generate')
      const errMsg = getCallableErrorMessage(raw)
      if (errMsg) {
        toast({ title: 'No se pudo regenerar', description: errMsg, variant: 'destructive' })
        return
      }
      const extracted = persistedSummaryFromCallableResult(raw)
      if (extracted) setPersisted(extracted)
      else {
        toast({
          title: 'Respuesta inesperada',
          description: 'No se recibió el resumen regenerado.',
          variant: 'destructive',
        })
      }
      onReportChanged?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de red o permisos'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setGenerateBusy(false)
    }
  }, [studentId, phase, onReportChanged, toast])

  const handleDownloadPdf = useCallback(async () => {
    setPdfBusy(true)
    try {
      const url = await callGetStudentAcademicSummaryPdfUrl(studentId, phase)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo obtener el PDF'
      toast({ title: 'PDF', description: msg, variant: 'destructive' })
    } finally {
      setPdfBusy(false)
    }
  }, [studentId, phase, toast])

  if (persisted === undefined) {
    return (
      <div className="flex items-center justify-center py-10" aria-busy="true">
        <Loader2 className={cn('h-8 w-8 animate-spin', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')} />
      </div>
    )
  }

  const hasDoc = persisted !== null
  const canOfferGenerate = phaseBlock?.isComplete === true && !hasDoc

  return (
    <div className="relative space-y-4">
      {generateBusy && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg gap-2',
            theme === 'dark' ? 'bg-zinc-900/80' : 'bg-white/85'
          )}
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className={cn('text-sm text-center px-4', theme === 'dark' ? 'text-zinc-200' : 'text-gray-700')}>
            Generando reporte académico, esto puede tomar un momento...
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {hasDoc && (
          <>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={pdfBusy || generateBusy}
              onClick={() => void handleDownloadPdf()}
              className="gap-1.5"
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Descargar PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={generateBusy}
              onClick={() => setRegenOpen(true)}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerar
            </Button>
          </>
        )}
        {canOfferGenerate && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={generateBusy}
            onClick={() => void handleGenerate()}
            className="gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            Generar reporte
          </Button>
        )}
      </div>

      {!hasDoc && phaseBlock && phaseBlock.isComplete !== true && (
        <p className={cn('text-sm', theme === 'dark' ? 'text-amber-200/90' : 'text-amber-800')}>
          Faltan {missing} materias por completar en esta fase.
        </p>
      )}

      {hasDoc && persisted && (
        <ReportBody summary={persisted} theme={theme} />
      )}

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent className={theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : ''}>
          <AlertDialogHeader>
            <AlertDialogTitle className={theme === 'dark' ? 'text-white' : ''}>
              ¿Regenerar reporte académico?
            </AlertDialogTitle>
            <AlertDialogDescription className={theme === 'dark' ? 'text-zinc-400' : ''}>
              ¿Estás seguro? Esto reemplazará el reporte actual y volverá a usar el modelo de IA para esta fase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRegenerateConfirm()}>Regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ReportBody({ summary, theme }: { summary: PersistedSummary; theme: 'light' | 'dark' }) {
  const r = summary.resumen
  const ac = r.analisis_competencial
  const acEntries =
    typeof ac === 'string'
      ? null
      : ac && typeof ac === 'object'
        ? Object.entries(ac as Record<string, string>)
        : null

  return (
    <div className="space-y-6 text-left">
      {r.resumen_general ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Resumen general
          </h3>
          <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', theme === 'dark' ? 'text-zinc-300' : 'text-gray-700')}>
            {r.resumen_general}
          </p>
        </section>
      ) : null}

      {acEntries && acEntries.length > 0 ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Análisis competencial
          </h3>
          <Accordion type="multiple" className="w-full border rounded-md divide-y">
            {acEntries.map(([materia, texto]) => (
              <AccordionItem key={materia} value={materia} className="border-0">
                <AccordionTrigger className={cn('text-sm px-3', theme === 'dark' ? 'text-zinc-100' : '')}>
                  {materia}
                </AccordionTrigger>
                <AccordionContent className={cn('text-sm px-3 pb-3 whitespace-pre-wrap', theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                  {texto}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : typeof ac === 'string' && ac.trim() ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Análisis competencial
          </h3>
          <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', theme === 'dark' ? 'text-zinc-300' : 'text-gray-700')}>
            {ac}
          </p>
        </section>
      ) : null}

      {r.fortalezas_academicas?.length ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Fortalezas académicas
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {r.fortalezas_academicas.map((item, i) => (
              <li key={i} className={cn('text-sm', theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.aspectos_por_mejorar?.length ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Aspectos por mejorar
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            {r.aspectos_por_mejorar.map((item, i) => (
              <li key={i} className={cn('text-sm', theme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.recomendaciones_enfoque_saber11?.length ? (
        <section>
          <h3 className={cn('text-sm font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Recomendaciones enfoque Saber 11
          </h3>
          <ol className="list-decimal pl-5 space-y-1">
            {r.recomendaciones_enfoque_saber11.map((item, i) => (
              <li key={i} className={cn('text-sm', theme === 'dark' ? 'text-zinc-300' : 'text-gray-700')}>
                {item}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
