import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { simulacrosService } from '@/services/firebase/simulacros.service'
import { useNotification } from '@/hooks/ui/useNotification'
import {
  SIMULACRO_GRADOS,
  SIMULACRO_MATERIAS,
  type Simulacro,
  type SimulacroGrado,
  type SimulacroMateria,
  type SimulacroVideo,
} from '@/interfaces/simulacro.interface'
import { cn } from '@/lib/utils'
import {
  ClipboardList,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Video,
  ExternalLink,
} from 'lucide-react'

interface AdminSimulacrosProps {
  theme: 'light' | 'dark'
}

interface VideoRow {
  id: string
  titulo: string
  descripcion: string
  url: string
}

const emptyForm: {
  grado: SimulacroGrado
  materia: SimulacroMateria
  titulo: string
  numeroOrden: number
  comentario: string
  isActive: boolean
} = {
  grado: '11°',
  materia: SIMULACRO_MATERIAS[0].value,
  titulo: '',
  numeroOrden: 0,
  comentario: '',
  isActive: true,
}

function generateVideoRowId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function AdminSimulacros({ theme }: AdminSimulacrosProps) {
  const { notifySuccess, notifyError } = useNotification()
  const [simulacros, setSimulacros] = useState<Simulacro[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoadedOnce, setListLoadedOnce] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [pdfSimulacroFile, setPdfSimulacroFile] = useState<File | null>(null)
  const [pdfHojaRespuestasFile, setPdfHojaRespuestasFile] = useState<File | null>(null)
  const [videoRows, setVideoRows] = useState<VideoRow[]>([])
  const [icfesDocumentoSeccion1, setIcfesDocumentoSeccion1] = useState<File | null>(null)
  const [icfesHojaSeccion1, setIcfesHojaSeccion1] = useState<File | null>(null)
  const [icfesDocumentoSeccion2, setIcfesDocumentoSeccion2] = useState<File | null>(null)
  const [icfesHojaSeccion2, setIcfesHojaSeccion2] = useState<File | null>(null)
  const [icfesVideoRows, setIcfesVideoRows] = useState<VideoRow[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Simulacro | null>(null)
  const [deleting, setDeleting] = useState(false)
  const pdfSimulacroRef = useRef<HTMLInputElement>(null)
  const pdfHojaRef = useRef<HTMLInputElement>(null)
  const icfesDoc1Ref = useRef<HTMLInputElement>(null)
  const icfesHoja1Ref = useRef<HTMLInputElement>(null)
  const icfesDoc2Ref = useRef<HTMLInputElement>(null)
  const icfesHoja2Ref = useRef<HTMLInputElement>(null)

  const loadSimulacros = useCallback(async () => {
    setLoading(true)
    const res = await simulacrosService.getAll()
    if (res.success) {
      setSimulacros(res.data)
      setListLoadedOnce(true)
    } else {
      notifyError({ message: res.error.message })
    }
    setLoading(false)
  }, [notifyError])

  const resetForm = useCallback(() => {
    setForm(emptyForm)
    setPdfSimulacroFile(null)
    setPdfHojaRespuestasFile(null)
    setVideoRows([])
    setIcfesDocumentoSeccion1(null)
    setIcfesHojaSeccion1(null)
    setIcfesDocumentoSeccion2(null)
    setIcfesHojaSeccion2(null)
    setIcfesVideoRows([])
    if (pdfSimulacroRef.current) pdfSimulacroRef.current.value = ''
    if (pdfHojaRef.current) pdfHojaRef.current.value = ''
    if (icfesDoc1Ref.current) icfesDoc1Ref.current.value = ''
    if (icfesHoja1Ref.current) icfesHoja1Ref.current.value = ''
    if (icfesDoc2Ref.current) icfesDoc2Ref.current.value = ''
    if (icfesHoja2Ref.current) icfesHoja2Ref.current.value = ''
  }, [])

  const handleSubmit = async () => {
    if (!form.titulo.trim()) {
      notifyError({ message: 'El título del simulacro es obligatorio.' })
      return
    }
    const isMateriaIcfes = form.materia === 'icfes'
    if (!isMateriaIcfes) {
      if (!pdfSimulacroFile) {
        notifyError({ message: 'Debes subir el PDF del simulacro.' })
        return
      }
      if (!pdfHojaRespuestasFile) {
        notifyError({ message: 'Debes subir el PDF de la hoja de respuestas.' })
        return
      }
    } else {
      const hasIcfesFile =
        icfesDocumentoSeccion1 ||
        icfesHojaSeccion1 ||
        icfesDocumentoSeccion2 ||
        icfesHojaSeccion2
      if (!hasIcfesFile) {
        notifyError({
          message: 'En materia ICFES debes subir al menos un PDF (documento u hoja de respuestas) en alguna sección.',
        })
        return
      }
    }

    setSaving(true)
    try {
      const icfesInput =
        form.materia === 'icfes' &&
        (icfesDocumentoSeccion1 ||
          icfesHojaSeccion1 ||
          icfesDocumentoSeccion2 ||
          icfesHojaSeccion2)
          ? {
              documentoSeccion1File: icfesDocumentoSeccion1 ?? undefined,
              hojaSeccion1File: icfesHojaSeccion1 ?? undefined,
              documentoSeccion2File: icfesDocumentoSeccion2 ?? undefined,
              hojaSeccion2File: icfesHojaSeccion2 ?? undefined,
            }
          : undefined

      const nextOrden =
        simulacros.length === 0
          ? 1
          : Math.max(0, ...simulacros.map((s) => s.numeroOrden)) + 1

      const createPayload = {
        grado: form.grado,
        materia: form.materia,
        titulo: form.titulo.trim(),
        numeroOrden: nextOrden,
        comentario: form.comentario.trim(),
        isActive: form.isActive,
        ...(isMateriaIcfes
          ? {}
          : {
              pdfSimulacroFile: pdfSimulacroFile!,
              pdfHojaRespuestasFile: pdfHojaRespuestasFile!,
            }),
        icfes: icfesInput,
      }
      const createRes = await simulacrosService.create(createPayload)
      if (!createRes.success) {
        notifyError({ message: createRes.error.message })
        setSaving(false)
        return
      }
      const simulacroId = createRes.data.id

      if (!isMateriaIcfes) {
        for (let i = 0; i < videoRows.length; i++) {
          const row = videoRows[i]
          if (!row.url.trim() || !row.titulo.trim()) continue
          const addRes = await simulacrosService.addVideo(simulacroId, {
            titulo: row.titulo.trim(),
            descripcion: row.descripcion.trim() || undefined,
            url: row.url.trim(),
          })
          if (!addRes.success) {
            notifyError({ message: `No se pudo guardar el video "${row.titulo}".` })
          }
        }
      }

      if (form.materia === 'icfes') {
        for (let i = 0; i < icfesVideoRows.length; i++) {
          const row = icfesVideoRows[i]
          if (!row.url.trim() || !row.titulo.trim()) continue
          const addRes = await simulacrosService.addVideoICFES(simulacroId, {
            titulo: row.titulo.trim(),
            descripcion: row.descripcion.trim() || undefined,
            url: row.url.trim(),
          })
          if (!addRes.success) {
            notifyError({ message: `No se pudo guardar el video ICFES "${row.titulo}".` })
          }
        }
      }

      notifySuccess({ message: 'Simulacro creado correctamente.' })
      resetForm()
      void loadSimulacros()
    } catch (e) {
      notifyError({ message: 'Error inesperado al crear el simulacro.' })
    }
    setSaving(false)
  }

  const handleDelete = async (s: Simulacro) => {
    setDeleteTarget(s)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await simulacrosService.delete(deleteTarget.id, true)
    if (res.success) {
      notifySuccess({ message: 'Simulacro eliminado.' })
      setSimulacros((prev) => prev.filter((x) => x.id !== deleteTarget.id))
      setDeleteTarget(null)
    } else {
      notifyError({ message: res.error.message })
    }
    setDeleting(false)
  }

  const addVideoRow = () => {
    setVideoRows((prev) => [
      ...prev,
      {
        id: generateVideoRowId(),
        titulo: '',
        descripcion: '',
        url: '',
      },
    ])
  }

  const updateVideoRow = (id: string, patch: Partial<VideoRow>) => {
    setVideoRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  }

  const removeVideoRow = (id: string) => {
    setVideoRows((prev) => prev.filter((r) => r.id !== id))
  }

  const addIcfesVideoRow = () => {
    setIcfesVideoRows((prev) => [
      ...prev,
      {
        id: generateVideoRowId(),
        titulo: '',
        descripcion: '',
        url: '',
      },
    ])
  }

  const updateIcfesVideoRow = (id: string, patch: Partial<VideoRow>) => {
    setIcfesVideoRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  }

  const removeIcfesVideoRow = (id: string) => {
    setIcfesVideoRows((prev) => prev.filter((r) => r.id !== id))
  }

  const materiaLabel = (value: string) =>
    SIMULACRO_MATERIAS.find((m) => m.value === value)?.label ?? value

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                theme === 'dark' ? 'bg-teal-600/20 text-teal-400' : 'bg-primary/10 text-primary'
              )}
            >
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Simulacros
              </CardTitle>
              <CardDescription>
                Gestión integral de simulacros tipo Saber 11 alineados con la estructura del ICFES
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Formulario de creación */}
      <Card
        className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}
        ref={undefined}
      >
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Crear simulacro
          </CardTitle>
          <CardDescription>
            Completa los datos y sube el PDF del simulacro y el PDF de la hoja de respuestas (obligatorios). Opcionalmente añade videos explicativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
              <Select
                value={form.grado}
                onValueChange={(v) => setForm((prev) => ({ ...prev, grado: v as SimulacroGrado }))}
              >
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
            <div className="space-y-2">
              <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Materia</Label>
              <Select
                value={form.materia}
                onValueChange={(v) => setForm((prev) => ({ ...prev, materia: v as SimulacroMateria }))}
              >
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
          </div>

          <div className="space-y-2">
            <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Título del simulacro</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ej: Simulacro Matemáticas - Primer periodo"
              className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>

          <div className="space-y-2">
            <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
              Comentario descriptivo del enfoque del simulacro
            </Label>
            <Textarea
              value={form.comentario}
              onChange={(e) => setForm((prev) => ({ ...prev, comentario: e.target.value }))}
              placeholder="Describe el enfoque o bloques de preguntas que cubre..."
              rows={3}
              className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="simulacro-active"
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked === true }))
              }
            />
            <Label
              htmlFor="simulacro-active"
              className={cn('cursor-pointer', theme === 'dark' ? 'text-gray-300' : '')}
            >
              Estado activo (visible para usuarios)
            </Label>
          </div>

          {/* PDFs obligatorios: solo cuando la materia no es ICFES */}
          {form.materia !== 'icfes' && (
          <div className={cn('rounded-lg border p-4 space-y-4', theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50/50')}>
            <h4 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Archivos PDF obligatorios
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  Subir PDF del simulacro
                </Label>
                <Input
                  ref={pdfSimulacroRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfSimulacroFile(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {pdfSimulacroFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {pdfSimulacroFile.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  Subir PDF de hoja de respuestas asociada
                </Label>
                <Input
                  ref={pdfHojaRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfHojaRespuestasFile(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {pdfHojaRespuestasFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {pdfHojaRespuestasFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Videos explicativos: solo para materias distintas de ICFES */}
          {form.materia !== 'icfes' && (
          <div className={cn('rounded-lg border p-4 space-y-4', theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50/50')}>
            <div className="flex items-center justify-between">
              <h4 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Videos explicativos (opcional)
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addVideoRow}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir video
              </Button>
            </div>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Pueden explicar bloques de preguntas (ej: preguntas 1–10, 11–20). Cada video: título, descripción opcional y URL de YouTube. Se muestran en orden de creación.
            </p>
            {videoRows.length === 0 ? (
              <p className={cn('text-sm italic', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                No hay videos añadidos. Opcional.
              </p>
            ) : (
              <div className="space-y-3">
                {videoRows.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      'grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 rounded-lg border',
                      theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200'
                    )}
                  >
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={row.titulo}
                        onChange={(e) => updateVideoRow(row.id, { titulo: e.target.value })}
                        placeholder="Ej: Preguntas 1-10"
                        className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-xs">Descripción (opcional)</Label>
                      <Input
                        value={row.descripcion}
                        onChange={(e) => updateVideoRow(row.id, { descripcion: e.target.value })}
                        placeholder="Breve descripción"
                        className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-xs">URL de YouTube</Label>
                      <Input
                        type="url"
                        value={row.url}
                        onChange={(e) => updateVideoRow(row.id, { url: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVideoRow(row.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Solo cuando la materia es ICFES: dos secciones (2 documentos PDF + 2 hojas de respuesta), videos */}
          {form.materia === 'icfes' && (
          <div className={cn('rounded-lg border p-4 space-y-4', theme === 'dark' ? 'border-amber-700/50 bg-amber-950/20' : 'border-amber-200 bg-amber-50/50')}>
            <h4 className={cn('font-medium', theme === 'dark' ? 'text-amber-200' : 'text-amber-900')}>
              Materia ICFES – Dos secciones
            </h4>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Hasta 2 PDFs de documento y 2 PDFs de hoja de respuestas. Si subes solo uno no pasa nada; se validan hasta dos archivos por tipo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  ICFES – Documento sección 1 (PDF)
                </Label>
                <Input
                  ref={icfesDoc1Ref}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setIcfesDocumentoSeccion1(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {icfesDocumentoSeccion1 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {icfesDocumentoSeccion1.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  ICFES – Hoja de respuestas sección 1 (PDF)
                </Label>
                <Input
                  ref={icfesHoja1Ref}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setIcfesHojaSeccion1(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {icfesHojaSeccion1 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {icfesHojaSeccion1.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  ICFES – Documento sección 2 (PDF)
                </Label>
                <Input
                  ref={icfesDoc2Ref}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setIcfesDocumentoSeccion2(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {icfesDocumentoSeccion2 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {icfesDocumentoSeccion2.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  ICFES – Hoja de respuestas sección 2 (PDF)
                </Label>
                <Input
                  ref={icfesHoja2Ref}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setIcfesHojaSeccion2(e.target.files?.[0] ?? null)}
                  className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
                />
                {icfesHojaSeccion2 && (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> {icfesHojaSeccion2.name}
                  </p>
                )}
              </div>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
                  Videos explicativos ICFES
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addIcfesVideoRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir video ICFES
                </Button>
              </div>
              {icfesVideoRows.length === 0 ? (
                <p className={cn('text-sm italic', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  Opcional.
                </p>
              ) : (
                <div className="space-y-3">
                  {icfesVideoRows.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        'grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 rounded-lg border',
                        theme === 'dark' ? 'border-zinc-600 bg-zinc-800' : 'border-gray-200'
                      )}
                    >
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-xs">Título</Label>
                        <Input
                          value={row.titulo}
                          onChange={(e) => updateIcfesVideoRow(row.id, { titulo: e.target.value })}
                          placeholder="Ej: Preguntas 1-10"
                          className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-xs">Descripción (opcional)</Label>
                        <Input
                          value={row.descripcion}
                          onChange={(e) => updateIcfesVideoRow(row.id, { descripcion: e.target.value })}
                          placeholder="Breve descripción"
                          className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-xs">URL de YouTube</Label>
                        <Input
                          type="url"
                          value={row.url}
                          onChange={(e) => updateIcfesVideoRow(row.id, { url: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className={cn('text-sm', theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : '')}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIcfesVideoRow(row.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear simulacro'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Listado */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Listado de simulacros
              </CardTitle>
              <CardDescription>
                El más reciente primero. Fecha de creación asignada automáticamente.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadSimulacros} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !listLoadedOnce ? (
            <div className={cn('text-center py-8', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              <p className="mb-3">Haz clic en &quot;Actualizar&quot; para cargar el listado de simulacros.</p>
              <Button variant="outline" onClick={loadSimulacros} disabled={loading}>
                Actualizar listado
              </Button>
            </div>
          ) : simulacros.length === 0 ? (
            <p className={cn('text-center py-8', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay simulacros. Crea uno con el formulario de arriba.
            </p>
          ) : (
            <div className="space-y-4">
              {[...simulacros]
                .sort((a, b) => {
                  const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as string).getTime()
                  const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as string).getTime()
                  return tb - ta
                })
                .map((s) => (
                <SimulacroCard
                  key={s.id}
                  simulacro={s}
                  theme={theme}
                  materiaLabel={materiaLabel}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar simulacro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el simulacro &quot;{deleteTarget?.titulo}&quot; y sus archivos (PDFs y videos) en Storage. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SimulacroCard({
  simulacro,
  theme,
  materiaLabel,
  onDelete,
}: {
  simulacro: Simulacro
  theme: 'light' | 'dark'
  materiaLabel: (value: string) => string
  onDelete: () => void
}) {
  const [videos, setVideos] = useState<SimulacroVideo[]>([])
  const [icfesVideos, setIcfesVideos] = useState<SimulacroVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [videosLoaded, setVideosLoaded] = useState(false)

  const loadVideos = useCallback(async () => {
    if (videosLoaded) return
    setLoadingVideos(true)
    const res = await simulacrosService.getById(simulacro.id)
    if (res.success && res.data) {
      if (res.data.videos) setVideos(res.data.videos)
      if (res.data.icfesVideos) setIcfesVideos(res.data.icfesVideos)
    }
    setVideosLoaded(true)
    setLoadingVideos(false)
  }, [simulacro.id, videosLoaded])

  const created = simulacro.createdAt instanceof Date
    ? simulacro.createdAt
    : new Date(simulacro.createdAt)

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50/50'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {simulacro.titulo}
            </span>
            <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {simulacro.grado} · {materiaLabel(simulacro.materia)} · Orden {simulacro.numeroOrden}
            </span>
            {!simulacro.isActive && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                Inactivo
              </span>
            )}
          </div>
          {simulacro.comentario && (
            <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {simulacro.comentario}
            </p>
          )}
          <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
            Creado: {created.toLocaleDateString('es-CO', { dateStyle: 'medium' })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {/* 1. Simulacro: solo documento PDF */}
        <div className="flex flex-wrap gap-2 mt-3">
          {simulacro.materia === 'icfes' && simulacro.icfes ? (
            <>
              {simulacro.icfes.seccion1DocumentoUrl && (
                <a
                  href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=icfes1doc`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                    theme === 'dark'
                      ? 'border-amber-600/50 text-amber-400 hover:bg-zinc-700'
                      : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Sección 1 - Documento
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {simulacro.icfes.seccion2DocumentoUrl && (
                <a
                  href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=icfes2doc`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                    theme === 'dark'
                      ? 'border-amber-600/50 text-amber-400 hover:bg-zinc-700'
                      : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Sección 2 - Documento
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            simulacro.pdfSimulacroUrl && (
              <a
                href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=documento`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                  theme === 'dark'
                    ? 'border-zinc-600 text-teal-400 hover:bg-zinc-700'
                    : 'border-gray-300 text-primary hover:bg-gray-100'
                )}
              >
                <FileText className="h-4 w-4" />
                PDF simulacro
                <ExternalLink className="h-3 w-3" />
              </a>
            )
          )}
        </div>

        {/* 2. Hoja de respuestas (sección propia) */}
        {(simulacro.materia === 'icfes'
          ? (simulacro.icfes?.seccion1HojaUrl || simulacro.icfes?.seccion2HojaUrl)
          : simulacro.pdfHojaRespuestasUrl) && (
          <div
            className={cn(
              'mt-4 pt-3 border-t',
              theme === 'dark' ? 'border-zinc-600/50' : 'border-gray-200'
            )}
          >
            <p className={cn('text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Hoja de respuestas
            </p>
            <div className="flex flex-wrap gap-2">
              {simulacro.materia === 'icfes' && simulacro.icfes ? (
                <>
                  {simulacro.icfes.seccion1HojaUrl && (
                    <a
                      href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=icfes1hoja`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                        theme === 'dark'
                          ? 'border-amber-600/50 text-amber-400 hover:bg-zinc-700'
                          : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Sección 1 - Hoja respuestas
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {simulacro.icfes.seccion2HojaUrl && (
                    <a
                      href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=icfes2hoja`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                        theme === 'dark'
                          ? 'border-amber-600/50 text-amber-400 hover:bg-zinc-700'
                          : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Sección 2 - Hoja respuestas
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                simulacro.pdfHojaRespuestasUrl && (
                  <a
                    href={`/viewer/pdf?simulacroId=${encodeURIComponent(simulacro.id)}&tipo=hoja`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1 text-sm px-2 py-1 rounded border',
                      theme === 'dark'
                        ? 'border-zinc-600 text-teal-400 hover:bg-zinc-700'
                        : 'border-gray-300 text-primary hover:bg-gray-100'
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    Hoja de respuestas
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )
              )}
            </div>
          </div>
        )}

        {/* 3. Videos explicativos */}
      <div className={cn('mt-4 pt-3 border-t', theme === 'dark' ? 'border-zinc-600/50' : 'border-gray-200')}>
        <p className={cn('text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
          Videos
        </p>
        <button
          type="button"
          onClick={loadVideos}
          className={cn(
            'text-sm font-medium flex items-center gap-1',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}
        >
          <Video className="h-4 w-4" />
          {videosLoaded ? `Videos explicativos (${videos.length + icfesVideos.length})` : 'Cargar videos explicativos'}
        </button>
        {loadingVideos && (
          <Loader2 className="h-4 w-4 animate-spin inline ml-1" />
        )}
        {!loadingVideos && videos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {videos.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-sm">
                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {v.titulo}
                    </span>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
            </ul>
        )}
        {(simulacro.icfes || (videosLoaded && icfesVideos.length > 0)) && (
          <div className="mt-2 pt-2 border-t border-zinc-600/30">
            <button
              type="button"
              onClick={loadVideos}
              className={cn(
                'text-sm font-medium flex items-center gap-1',
                theme === 'dark' ? 'text-amber-300/90' : 'text-amber-700'
              )}
            >
              <Video className="h-4 w-4" />
              Videos ICFES{videosLoaded ? ` (${icfesVideos.length})` : ''}
            </button>
            {!loadingVideos && icfesVideos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {icfesVideos.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 text-sm">
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {v.titulo}
                      </span>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
