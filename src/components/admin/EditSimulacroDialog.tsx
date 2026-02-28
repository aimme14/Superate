import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  simulacrosService,
  uploadIcfesPdf,
} from '@/services/firebase/simulacros.service'
import { useSimulacroDetails, simulacroDetailKey } from '@/hooks/query/useSimulacros'
import { useNotification } from '@/hooks/ui/useNotification'
import {
  SIMULACRO_GRADOS,
  SIMULACRO_MATERIAS,
  isMateriaCon4Secciones,
  type Simulacro,
  type SimulacroGrado,
  type SimulacroMateria,
  type SimulacroVideo,
} from '@/interfaces/simulacro.interface'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Loader2, FileText } from 'lucide-react'

interface VideoRow {
  id: string
  titulo: string
  descripcion: string
  url: string
}

function generateVideoRowId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

interface EditSimulacroDialogProps {
  simulacro: Simulacro | null
  theme: 'light' | 'dark'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditSimulacroDialog({
  simulacro,
  theme,
  open,
  onOpenChange,
  onSuccess,
}: EditSimulacroDialogProps) {
  const { notifySuccess, notifyError } = useNotification()
  const queryClient = useQueryClient()
  const { data: details, isLoading: loadingDetails } = useSimulacroDetails(
    simulacro?.id ?? null,
    open && !!simulacro
  )
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    grado: '11°' as SimulacroGrado,
    materia: SIMULACRO_MATERIAS[0].value as SimulacroMateria,
    titulo: '',
    numeroOrden: 0,
    comentario: '',
    isActive: true,
  })
  const [pdfSimulacroFile, setPdfSimulacroFile] = useState<File | null>(null)
  const [pdfHojaRespuestasFile, setPdfHojaRespuestasFile] = useState<File | null>(null)
  const [pdfSimulacroSeccion2File, setPdfSimulacroSeccion2File] = useState<File | null>(null)
  const [pdfHojaRespuestasSeccion2File, setPdfHojaRespuestasSeccion2File] = useState<File | null>(null)
  const [icfesDoc1File, setIcfesDoc1File] = useState<File | null>(null)
  const [icfesHoja1File, setIcfesHoja1File] = useState<File | null>(null)
  const [icfesDoc2File, setIcfesDoc2File] = useState<File | null>(null)
  const [icfesHoja2File, setIcfesHoja2File] = useState<File | null>(null)
  const [videoRows, setVideoRows] = useState<VideoRow[]>([])
  const [icfesVideoRows, setIcfesVideoRows] = useState<VideoRow[]>([])
  const pdfSimulacroRef = useRef<HTMLInputElement>(null)
  const pdfHojaRef = useRef<HTMLInputElement>(null)
  const pdfSimulacroSeccion2Ref = useRef<HTMLInputElement>(null)
  const pdfHojaSeccion2Ref = useRef<HTMLInputElement>(null)
  const icfesDoc1Ref = useRef<HTMLInputElement>(null)
  const icfesHoja1Ref = useRef<HTMLInputElement>(null)
  const icfesDoc2Ref = useRef<HTMLInputElement>(null)
  const icfesHoja2Ref = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setPdfSimulacroFile(null)
    setPdfHojaRespuestasFile(null)
    setPdfSimulacroSeccion2File(null)
    setPdfHojaRespuestasSeccion2File(null)
    setIcfesDoc1File(null)
    setIcfesHoja1File(null)
    setIcfesDoc2File(null)
    setIcfesHoja2File(null)
    setVideoRows([])
    setIcfesVideoRows([])
    if (pdfSimulacroRef.current) pdfSimulacroRef.current.value = ''
    if (pdfHojaRef.current) pdfHojaRef.current.value = ''
    if (pdfSimulacroSeccion2Ref.current) pdfSimulacroSeccion2Ref.current.value = ''
    if (pdfHojaSeccion2Ref.current) pdfHojaSeccion2Ref.current.value = ''
    if (icfesDoc1Ref.current) icfesDoc1Ref.current.value = ''
    if (icfesHoja1Ref.current) icfesHoja1Ref.current.value = ''
    if (icfesDoc2Ref.current) icfesDoc2Ref.current.value = ''
    if (icfesHoja2Ref.current) icfesHoja2Ref.current.value = ''
  }, [])

  useEffect(() => {
    if (simulacro && open) {
      setForm({
        grado: simulacro.grado,
        materia: simulacro.materia as SimulacroMateria,
        titulo: simulacro.titulo,
        numeroOrden: simulacro.numeroOrden,
        comentario: simulacro.comentario ?? '',
        isActive: simulacro.isActive,
      })
      resetForm()
    }
  }, [simulacro, open, resetForm])

  const addVideoRow = () => {
    setVideoRows((prev) => [
      ...prev,
      { id: generateVideoRowId(), titulo: '', descripcion: '', url: '' },
    ])
  }
  const updateVideoRow = (id: string, patch: Partial<VideoRow>) => {
    setVideoRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  const removeVideoRow = (id: string) => {
    setVideoRows((prev) => prev.filter((r) => r.id !== id))
  }
  const addIcfesVideoRow = () => {
    setIcfesVideoRows((prev) => [
      ...prev,
      { id: generateVideoRowId(), titulo: '', descripcion: '', url: '' },
    ])
  }
  const updateIcfesVideoRow = (id: string, patch: Partial<VideoRow>) => {
    setIcfesVideoRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  const removeIcfesVideoRow = (id: string) => {
    setIcfesVideoRows((prev) => prev.filter((r) => r.id !== id))
  }

  const invalidateDetail = useCallback(() => {
    if (simulacro) {
      void queryClient.invalidateQueries({ queryKey: simulacroDetailKey(simulacro.id) })
    }
  }, [queryClient, simulacro])

  const handleDeleteVideo = async (videoId: string, isIcfes: boolean) => {
    if (!simulacro) return
    const res = isIcfes
      ? await simulacrosService.deleteVideoICFES(simulacro.id, videoId)
      : await simulacrosService.deleteVideo(simulacro.id, videoId)
    if (res.success) {
      notifySuccess({ message: 'Video eliminado.' })
      invalidateDetail()
      onSuccess()
    } else {
      notifyError({ message: res.error.message })
    }
  }

  const handleSubmit = async () => {
    if (!simulacro || !form.titulo.trim()) {
      notifyError({ message: 'El título es obligatorio.' })
      return
    }
    const isMateriaCon4 = isMateriaCon4Secciones(form.materia)

    setSaving(true)
    try {
      const updatePayload = {
        grado: form.grado,
        materia: form.materia,
        titulo: form.titulo.trim(),
        numeroOrden: form.numeroOrden,
        comentario: form.comentario.trim(),
        isActive: form.isActive,
      }
      const updateRes = await simulacrosService.update(simulacro.id, updatePayload)
      if (!updateRes.success) {
        notifyError({ message: updateRes.error.message })
        setSaving(false)
        return
      }

      if (!isMateriaCon4 && (pdfSimulacroFile || pdfHojaRespuestasFile || pdfSimulacroSeccion2File || pdfHojaRespuestasSeccion2File)) {
        const pdfRes = await simulacrosService.updatePdfs(
          simulacro.id,
          pdfSimulacroFile ?? undefined,
          pdfHojaRespuestasFile ?? undefined,
          pdfSimulacroSeccion2File ?? undefined,
          pdfHojaRespuestasSeccion2File ?? undefined
        )
        if (!pdfRes.success) {
          notifyError({ message: pdfRes.error.message })
          setSaving(false)
          return
        }
      }

      if (isMateriaCon4) {
        const currentIcfes = simulacro.icfes ?? {}
        const icfesUpdate: Record<string, string> = {
          seccion1DocumentoUrl: currentIcfes.seccion1DocumentoUrl ?? '',
          seccion1HojaUrl: currentIcfes.seccion1HojaUrl ?? '',
          seccion2DocumentoUrl: currentIcfes.seccion2DocumentoUrl ?? '',
          seccion2HojaUrl: currentIcfes.seccion2HojaUrl ?? '',
        }
        if (icfesDoc1File) {
          const r = await uploadIcfesPdf(simulacro.id, 'documento_seccion1', icfesDoc1File)
          if (r.success) icfesUpdate.seccion1DocumentoUrl = r.data
          else {
            notifyError({ message: r.error.message })
            setSaving(false)
            return
          }
        }
        if (icfesHoja1File) {
          const r = await uploadIcfesPdf(simulacro.id, 'hoja_respuestas_seccion1', icfesHoja1File)
          if (r.success) icfesUpdate.seccion1HojaUrl = r.data
          else {
            notifyError({ message: r.error.message })
            setSaving(false)
            return
          }
        }
        if (icfesDoc2File) {
          const r = await uploadIcfesPdf(simulacro.id, 'documento_seccion2', icfesDoc2File)
          if (r.success) icfesUpdate.seccion2DocumentoUrl = r.data
          else {
            notifyError({ message: r.error.message })
            setSaving(false)
            return
          }
        }
        if (icfesHoja2File) {
          const r = await uploadIcfesPdf(simulacro.id, 'hoja_respuestas_seccion2', icfesHoja2File)
          if (r.success) icfesUpdate.seccion2HojaUrl = r.data
          else {
            notifyError({ message: r.error.message })
            setSaving(false)
            return
          }
        }
        await simulacrosService.update(simulacro.id, {
          icfes: {
            seccion1DocumentoUrl: icfesUpdate.seccion1DocumentoUrl || undefined,
            seccion1HojaUrl: icfesUpdate.seccion1HojaUrl || undefined,
            seccion2DocumentoUrl: icfesUpdate.seccion2DocumentoUrl || undefined,
            seccion2HojaUrl: icfesUpdate.seccion2HojaUrl || undefined,
          },
        })
      }

      if (!isMateriaCon4) {
        for (const row of videoRows) {
          if (!row.url.trim() || !row.titulo.trim()) continue
          const addRes = await simulacrosService.addVideo(simulacro.id, {
            titulo: row.titulo.trim(),
            descripcion: row.descripcion.trim() || undefined,
            url: row.url.trim(),
          })
          if (!addRes.success) {
            notifyError({ message: `No se pudo añadir el video "${row.titulo}".` })
          }
        }
      }

      if (isMateriaCon4) {
        for (const row of icfesVideoRows) {
          if (!row.url.trim() || !row.titulo.trim()) continue
          const addRes = await simulacrosService.addVideoICFES(simulacro.id, {
            titulo: row.titulo.trim(),
            descripcion: row.descripcion.trim() || undefined,
            url: row.url.trim(),
          })
          if (!addRes.success) {
            notifyError({ message: `No se pudo añadir el video ICFES "${row.titulo}".` })
          }
        }
      }

      notifySuccess({ message: 'Simulacro actualizado correctamente.' })
      invalidateDetail()
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      notifyError({ message: 'Error inesperado al actualizar.' })
    }
    setSaving(false)
  }

  if (!simulacro) return null

  const existingVideos = details?.videos ?? []
  const existingIcfesVideos = details?.icfesVideos ?? []
  const isMateriaCon4 = isMateriaCon4Secciones(form.materia)

  const inputCls = theme === 'dark'
    ? 'bg-zinc-700/80 border-zinc-600 text-white placeholder:text-gray-500 focus-visible:ring-teal-500'
    : 'border-gray-300'
  const labelCls = theme === 'dark' ? 'text-gray-200' : 'text-gray-700'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-2xl max-h-[90vh] flex flex-col gap-0 p-5 sm:p-6',
          theme === 'dark'
            ? 'bg-zinc-800 border-zinc-600 shadow-xl shadow-black/30'
            : 'bg-white border-gray-200 shadow-xl'
        )}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className={cn('text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Editar simulacro
          </DialogTitle>
          <DialogDescription
            className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}
          >
            Modifica los datos del simulacro. Puedes reemplazar los PDFs subiendo nuevos archivos.
          </DialogDescription>
        </DialogHeader>
        {loadingDetails ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-2 -mr-2 max-h-[58vh]">
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className={cn('text-sm', labelCls)}>Grado</Label>
                  <Select
                    value={form.grado}
                    onValueChange={(v) => setForm((p) => ({ ...p, grado: v as SimulacroGrado }))}
                  >
                    <SelectTrigger className={cn('h-9', inputCls)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIMULACRO_GRADOS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className={cn('text-sm', labelCls)}>Materia</Label>
                  <Select
                    value={form.materia}
                    onValueChange={(v) => setForm((p) => ({ ...p, materia: v as SimulacroMateria }))}
                  >
                    <SelectTrigger className={cn('h-9', inputCls)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIMULACRO_MATERIAS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-1 col-span-2">
                  <Label className={cn('text-sm', labelCls)}>Orden</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.numeroOrden}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, numeroOrden: parseInt(e.target.value, 10) || 0 }))
                    }
                    className={cn('h-9', inputCls)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={cn('text-sm', labelCls)}>Título</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: Simulacro Matemáticas - Primer periodo"
                  className={cn('h-9', inputCls)}
                />
              </div>

              {/* PDFs: materias normales (no ICFES ni Simulacros completos) */}
              {!isMateriaCon4 && (
                <div
                  className={cn(
                    'rounded-lg border-2 p-3 space-y-3',
                    theme === 'dark'
                      ? 'border-teal-500/50 bg-teal-950/20'
                      : 'border-teal-200 bg-teal-50/50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={cn(
                        'text-sm font-semibold flex items-center gap-1.5',
                        theme === 'dark' ? 'text-teal-300' : 'text-teal-800'
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Reemplazar PDFs (opcional)
                    </h4>
                    <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      Hasta 2 documentos + 2 hojas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className={cn('text-xs', labelCls)}>Doc 1</Label>
                      <div
                        className={cn(
                          'relative rounded-md border-2 border-dashed p-2 min-h-[44px] transition-colors',
                          theme === 'dark'
                            ? 'border-zinc-600 hover:border-teal-500/70 bg-zinc-800/80'
                            : 'border-gray-300 hover:border-teal-400 bg-gray-50'
                        )}
                      >
                        <Input
                          ref={pdfSimulacroRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setPdfSimulacroFile(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {pdfSimulacroFile ? (
                          <p className="text-xs text-teal-500 dark:text-teal-400 font-medium truncate">
                            {pdfSimulacroFile.name}
                          </p>
                        ) : (
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Clic</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={cn('text-xs', labelCls)}>Hoja 1</Label>
                      <div
                        className={cn(
                          'relative rounded-md border-2 border-dashed p-2 min-h-[44px] transition-colors',
                          theme === 'dark'
                            ? 'border-zinc-600 hover:border-teal-500/70 bg-zinc-800/80'
                            : 'border-gray-300 hover:border-teal-400 bg-gray-50'
                        )}
                      >
                        <Input
                          ref={pdfHojaRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setPdfHojaRespuestasFile(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {pdfHojaRespuestasFile ? (
                          <p className="text-xs text-teal-500 dark:text-teal-400 font-medium truncate">
                            {pdfHojaRespuestasFile.name}
                          </p>
                        ) : (
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Clic</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={cn('text-xs', labelCls)}>Doc 2</Label>
                      <div
                        className={cn(
                          'relative rounded-md border-2 border-dashed p-2 min-h-[44px] transition-colors',
                          theme === 'dark'
                            ? 'border-zinc-600 hover:border-teal-500/70 bg-zinc-800/80'
                            : 'border-gray-300 hover:border-teal-400 bg-gray-50'
                        )}
                      >
                        <Input
                          ref={pdfSimulacroSeccion2Ref}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setPdfSimulacroSeccion2File(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {pdfSimulacroSeccion2File ? (
                          <p className="text-xs text-teal-500 dark:text-teal-400 font-medium truncate">
                            {pdfSimulacroSeccion2File.name}
                          </p>
                        ) : (
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Clic</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className={cn('text-xs', labelCls)}>Hoja 2</Label>
                      <div
                        className={cn(
                          'relative rounded-md border-2 border-dashed p-2 min-h-[44px] transition-colors',
                          theme === 'dark'
                            ? 'border-zinc-600 hover:border-teal-500/70 bg-zinc-800/80'
                            : 'border-gray-300 hover:border-teal-400 bg-gray-50'
                        )}
                      >
                        <Input
                          ref={pdfHojaSeccion2Ref}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setPdfHojaRespuestasSeccion2File(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {pdfHojaRespuestasSeccion2File ? (
                          <p className="text-xs text-teal-500 dark:text-teal-400 font-medium truncate">
                            {pdfHojaRespuestasSeccion2File.name}
                          </p>
                        ) : (
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Clic</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PDFs: ICFES o Simulacros completos (4 secciones) */}
              {isMateriaCon4 && (
                <div
                  className={cn(
                    'rounded-lg border-2 p-3 space-y-3',
                    theme === 'dark'
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : 'border-amber-200 bg-amber-50/50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={cn(
                        'text-sm font-semibold flex items-center gap-1.5',
                        theme === 'dark' ? 'text-amber-300' : 'text-amber-900'
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Reemplazar PDFs {form.materia === 'simulacros-completos' ? '(opcional)' : 'ICFES (opcional)'}
                    </h4>
                    <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      Solo si deseas cambiar
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { ref: icfesDoc1Ref, label: 'Doc 1', file: icfesDoc1File, set: setIcfesDoc1File },
                      { ref: icfesHoja1Ref, label: 'Hoja 1', file: icfesHoja1File, set: setIcfesHoja1File },
                      { ref: icfesDoc2Ref, label: 'Doc 2', file: icfesDoc2File, set: setIcfesDoc2File },
                      { ref: icfesHoja2Ref, label: 'Hoja 2', file: icfesHoja2File, set: setIcfesHoja2File },
                    ].map(({ ref: r, label, file, set }) => (
                      <div key={label} className="space-y-1">
                        <Label className={cn('text-xs', labelCls)}>{label}</Label>
                        <div
                          className={cn(
                            'relative rounded-md border-2 border-dashed p-2 min-h-[44px] transition-colors',
                            theme === 'dark'
                              ? 'border-zinc-600 hover:border-amber-500/70 bg-zinc-800/80'
                              : 'border-gray-300 hover:border-amber-400 bg-gray-50'
                          )}
                        >
                          <Input
                            ref={r}
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => set(e.target.files?.[0] ?? null)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                          {file ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium truncate">{file.name}</p>
                          ) : (
                            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Clic</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className={cn('text-sm', labelCls)}>Comentario</Label>
                <Textarea
                  value={form.comentario}
                  onChange={(e) => setForm((p) => ({ ...p, comentario: e.target.value }))}
                  placeholder="Describe el enfoque..."
                  rows={2}
                  className={cn('min-h-[60px] resize-none', inputCls)}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <Checkbox
                  id="edit-active"
                  checked={form.isActive}
                  onCheckedChange={(c) => setForm((p) => ({ ...p, isActive: c === true }))}
                />
                <Label htmlFor="edit-active" className={cn('text-sm cursor-pointer', labelCls)}>
                  Estado activo (visible para usuarios)
                </Label>
              </div>

              {/* Videos: materias normales */}
              {!isMateriaCon4 && (
                <div
                  className={cn(
                    'rounded-lg border p-3 space-y-3',
                    theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h4 className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : '')}>
                      Videos explicativos
                    </h4>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addVideoRow}>
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir video
                    </Button>
                  </div>
                  {existingVideos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Videos existentes:</p>
                      {existingVideos.map((v) => (
                        <VideoItem
                          key={v.id}
                          video={v}
                          theme={theme}
                          onDelete={() => handleDeleteVideo(v.id, false)}
                        />
                      ))}
                    </div>
                  )}
                  {videoRows.map((row) => (
                    <VideoRowEdit
                      key={row.id}
                      row={row}
                      theme={theme}
                      onUpdate={(patch) => updateVideoRow(row.id, patch)}
                      onRemove={() => removeVideoRow(row.id)}
                    />
                  ))}
                </div>
              )}

              {/* Videos: ICFES o Simulacros completos */}
              {isMateriaCon4 && (
                <div
                  className={cn(
                    'rounded-lg border p-3 space-y-3',
                    theme === 'dark' ? 'border-amber-700/50 bg-amber-950/20' : 'border-amber-200 bg-amber-50/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h4 className={cn('text-sm font-medium', theme === 'dark' ? 'text-amber-200' : 'text-amber-900')}>
                      Videos {form.materia === 'simulacros-completos' ? 'explicativos' : 'ICFES'}
                    </h4>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addIcfesVideoRow}>
                      <Plus className="h-4 w-4 mr-1" />
                      Añadir video
                    </Button>
                  </div>
                  {existingIcfesVideos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Videos existentes:</p>
                      {existingIcfesVideos.map((v) => (
                        <VideoItem
                          key={v.id}
                          video={v}
                          theme={theme}
                          onDelete={() => handleDeleteVideo(v.id, true)}
                        />
                      ))}
                    </div>
                  )}
                  {icfesVideoRows.map((row) => (
                    <VideoRowEdit
                      key={row.id}
                      row={row}
                      theme={theme}
                      onUpdate={(patch) => updateIcfesVideoRow(row.id, patch)}
                      onRemove={() => removeIcfesVideoRow(row.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        <DialogFooter
          className={cn(
            'mt-3 pt-3 border-t gap-2 sm:gap-0',
            theme === 'dark' ? 'border-zinc-700/50' : 'border-gray-200'
          )}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className={cn(
              theme === 'dark'
                ? 'border-zinc-600 text-gray-200 hover:bg-zinc-700 hover:text-white'
                : ''
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || loadingDetails}
            className="bg-teal-600 hover:bg-teal-500 text-white font-medium shadow-md"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VideoItem({
  video,
  theme,
  onDelete,
}: {
  video: SimulacroVideo
  theme: 'light' | 'dark'
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-1.5 rounded border gap-2',
        theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{video.titulo}</p>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate block"
        >
          {video.url}
        </a>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function VideoRowEdit({
  row,
  theme,
  onUpdate,
  onRemove,
}: {
  row: VideoRow
  theme: 'light' | 'dark'
  onUpdate: (patch: Partial<VideoRow>) => void
  onRemove: () => void
}) {
  const inputCls = theme === 'dark' ? 'bg-zinc-700 border-zinc-600 h-8 text-sm' : 'h-8 text-sm'
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-2 rounded border',
        theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200'
      )}
    >
      <div className="md:col-span-3 space-y-0.5">
        <Label className="text-xs">Título</Label>
        <Input
          value={row.titulo}
          onChange={(e) => onUpdate({ titulo: e.target.value })}
          placeholder="Ej: Preguntas 1-10"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 space-y-0.5">
        <Label className="text-xs">Descripción</Label>
        <Input
          value={row.descripcion}
          onChange={(e) => onUpdate({ descripcion: e.target.value })}
          placeholder="Opcional"
          className={inputCls}
        />
      </div>
      <div className="md:col-span-3 space-y-0.5">
        <Label className="text-xs">URL YouTube</Label>
        <Input
          type="url"
          value={row.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://youtube.com/..."
          className={inputCls}
        />
      </div>
      <div className="md:col-span-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
