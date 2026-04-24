import { useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GradeSummaryDoc } from '@/services/teacher/gradeSummary.service'
import { deriveGradeReport } from './deriveGradeReport'
import { GradeReportCard } from './GradeReportCard'
import './gradeReportPrint.css'
import { cn } from '@/lib/utils'

interface GradeReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gradeSummary: GradeSummaryDoc | null | undefined
  theme?: 'light' | 'dark'
  /** Nombre del grado desde el perfil docente (evita mostrar gradeId del documento). */
  teacherGradeDisplayName?: string | null
  /** Línea opcional: sede · institución. */
  metaLine?: string | null
}

export function GradeReportModal({
  open,
  onOpenChange,
  gradeSummary,
  theme = 'light',
  teacherGradeDisplayName,
  metaLine,
}: GradeReportModalProps) {
  const report = useMemo(
    () =>
      deriveGradeReport(gradeSummary ?? null, {
        teacherGradeDisplayName: teacherGradeDisplayName ?? undefined,
      }),
    [gradeSummary, teacherGradeDisplayName]
  )

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.classList.add('grade-report-print-root-active')
    return () => {
      root.classList.remove('grade-report-print-root-active')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-grade-report-print-container=""
        className={cn(
          'max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-0 p-0 gap-0 shadow-2xl sm:rounded-2xl',
          theme === 'dark'
            ? 'border border-zinc-700/80 bg-zinc-950 text-zinc-100 ring-1 ring-white/5'
            : 'bg-slate-50 ring-1 ring-black/5'
        )}
      >
        <DialogHeader className={cn('sr-only grade-report-no-print px-6 pt-6 pb-2')}>
          <DialogTitle>Informe del grado</DialogTitle>
          <DialogDescription>
            Resumen institucional del grado según datos agregados en el sistema.
          </DialogDescription>
        </DialogHeader>
        <div className={cn('p-4 sm:p-6', theme === 'dark' ? 'bg-zinc-950' : '')}>
          {!report ? (
            <p className={cn('text-sm', theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
              No hay resumen del grado disponible. Use &quot;Actualizar resumen del grado&quot; en el panel del docente
              y vuelva a intentar.
            </p>
          ) : (
            <GradeReportCard report={report} theme={theme} showPrintButton metaLine={metaLine ?? undefined} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
