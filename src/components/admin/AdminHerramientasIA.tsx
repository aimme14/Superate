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
import {
  aiToolsService,
  MODULOS_RECOMENDADOS,
  NIVELES,
  uploadAIToolIcon,
  deleteAIToolIcon,
  type AIToolData,
  type Nivel,
} from '@/services/firebase/aiTools.service'
import { useNotification } from '@/hooks/ui/useNotification'
import { useAITools, useInvalidateAITools } from '@/hooks/query/useAITools'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  ImagePlus,
  Pencil,
  X,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'

interface AdminHerramientasIAProps {
  theme: 'light' | 'dark'
}

const emptyForm = {
  nombre: '',
  especialidad: '',
  modulosRecomendados: [] as string[],
  nivel: 'intermedio' as Nivel,
  urlRedireccion: '',
  promptsSugeridos: [''],
  isActive: true,
}

/** Timeout para subida de icono (ms). Si se supera, se muestra aviso y el botón deja de cargar. */
const ICON_UPLOAD_TIMEOUT_MS = 25_000

export default function AdminHerramientasIA({ theme }: AdminHerramientasIAProps) {
  const { notifySuccess, notifyError } = useNotification()
  const { data: tools = [], isLoading: loading, refetch } = useAITools()
  const invalidateAITools = useInvalidateAITools()
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AIToolData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const formCardRef = useRef<HTMLDivElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)
  /** Ref del archivo de icono para no perderlo al enviar (el estado puede ir por detrás) */
  const iconFileRef = useRef<File | null>(null)

  const resetForm = useCallback(() => {
    setForm(emptyForm)
    setEditingId(null)
    setIconFile(null)
    setIconPreview(null)
    iconFileRef.current = null
    if (iconInputRef.current) iconInputRef.current.value = ''
  }, [])

  const handleEdit = (tool: AIToolData) => {
    setEditingId(tool.id)
    setForm({
      nombre: tool.nombre,
      especialidad: tool.especialidad,
      modulosRecomendados: [...tool.modulosRecomendados],
      nivel: tool.nivel,
      urlRedireccion: tool.urlRedireccion,
      promptsSugeridos:
        tool.promptsSugeridos.length > 0 ? [...tool.promptsSugeridos] : [''],
      isActive: tool.isActive,
    })
    setIconPreview(tool.iconUrl || null)
    setIconFile(null)
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleModulo = (value: string) => {
    setForm((prev) => ({
      ...prev,
      modulosRecomendados: prev.modulosRecomendados.includes(value)
        ? prev.modulosRecomendados.filter((m) => m !== value)
        : [...prev.modulosRecomendados, value],
    }))
  }

  const addPrompt = () => {
    setForm((prev) => ({ ...prev, promptsSugeridos: [...prev.promptsSugeridos, ''] }))
  }

  const updatePrompt = (index: number, text: string) => {
    setForm((prev) => {
      const next = [...prev.promptsSugeridos]
      next[index] = text
      return { ...prev, promptsSugeridos: next }
    })
  }

  const removePrompt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      promptsSugeridos: prev.promptsSugeridos.filter((_, i) => i !== index),
    }))
  }

  const onIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    iconFileRef.current = file
    setIconFile(file)
    const reader = new FileReader()
    reader.onload = () => setIconPreview(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const hasFormChanges = useCallback(() => {
    if (editingId) {
      const t = tools.find((x) => x.id === editingId)
      if (!t) return true
      return (
        form.nombre !== t.nombre ||
        form.especialidad !== t.especialidad ||
        form.nivel !== t.nivel ||
        form.urlRedireccion !== t.urlRedireccion ||
        JSON.stringify([...form.modulosRecomendados].sort()) !== JSON.stringify([...t.modulosRecomendados].sort()) ||
        JSON.stringify(form.promptsSugeridos) !== JSON.stringify(t.promptsSugeridos) ||
        form.isActive !== t.isActive ||
        !!iconFile ||
        (!!t.iconUrl && !iconPreview)
      )
    }
    return (
      form.nombre.trim() !== '' ||
      form.especialidad.trim() !== '' ||
      form.urlRedireccion.trim() !== '' ||
      form.modulosRecomendados.length > 0 ||
      form.promptsSugeridos.some((p) => p.trim() !== '') ||
      !form.isActive ||
      !!iconFile
    )
  }, [editingId, form, tools, iconFile, iconPreview])

  const handleCancelClick = () => {
    if (hasFormChanges()) setShowCancelConfirm(true)
    else resetForm()
  }

  const handleSubmit = async () => {
    if (!form.nombre.trim()) {
      notifyError({ message: 'El nombre es obligatorio.' })
      return
    }
    if (!form.urlRedireccion.trim()) {
      notifyError({ message: 'La URL de redirección es obligatoria.' })
      return
    }

    const nameTrimmed = form.nombre.trim()
    const existsRes = await aiToolsService.existsByName(nameTrimmed, editingId ?? undefined)
    if (existsRes.success && existsRes.data) {
      notifyError({ message: 'Ya existe una herramienta con ese nombre. Use otro nombre o edite la existente.' })
      return
    }

    const prompts = form.promptsSugeridos.filter((p) => p.trim().length > 0)

    setSaving(true)
    try {
      if (editingId) {
        const currentTool = tools.find((t) => t.id === editingId)
        let iconUrl: string | null = null
        if (iconFile) {
          const uploadRes = await uploadAIToolIcon(editingId, iconFile)
          if (uploadRes.success) iconUrl = uploadRes.data
          else {
            notifyError({ message: uploadRes.error.message })
            setSaving(false)
            return
          }
        } else if (iconPreview) {
          iconUrl = currentTool?.iconUrl ?? null
        } else if (currentTool?.iconUrl) {
          await deleteAIToolIcon(currentTool.iconUrl)
          iconUrl = null
        }

        const updateRes = await aiToolsService.update(editingId, {
          nombre: nameTrimmed,
          especialidad: form.especialidad.trim(),
          modulosRecomendados: form.modulosRecomendados,
          nivel: form.nivel,
          urlRedireccion: form.urlRedireccion.trim(),
          iconUrl,
          promptsSugeridos: prompts,
          isActive: form.isActive,
        })
        if (updateRes.success) {
          notifySuccess({ message: 'Herramienta IA actualizada.' })
          resetForm()
          invalidateAITools()
        } else {
          notifyError({ message: updateRes.error.message })
        }
      } else {
        const createRes = await aiToolsService.create({
          nombre: nameTrimmed,
          especialidad: form.especialidad.trim(),
          modulosRecomendados: form.modulosRecomendados,
          nivel: form.nivel,
          urlRedireccion: form.urlRedireccion.trim(),
          iconUrl: null,
          promptsSugeridos: prompts,
          isActive: form.isActive,
        })
        if (!createRes.success) {
          notifyError({ message: createRes.error.message })
          setSaving(false)
          return
        }
        const newId = createRes.data.id
        const fileToUpload = iconFileRef.current ?? iconFile
        if (fileToUpload) {
          const uploadAndSaveIcon = (async () => {
            const uploadRes = await uploadAIToolIcon(newId, fileToUpload)
            if (!uploadRes.success) return { ok: false as const, error: uploadRes.error.message }
            const url = uploadRes.data
            if (!url || typeof url !== 'string') return { ok: false as const, error: 'URL del icono no válida' }
            const updateRes = await aiToolsService.update(newId, { iconUrl: url })
            if (!updateRes.success) return { ok: false as const, error: updateRes.error?.message ?? 'No se pudo guardar la URL del icono' }
            return { ok: true as const }
          })()
          const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
            setTimeout(() => resolve({ timeout: true }), ICON_UPLOAD_TIMEOUT_MS)
          )
          const result = await Promise.race([uploadAndSaveIcon, timeoutPromise])
          if (result && 'timeout' in result) {
            notifyError({
              message: 'Herramienta creada. El icono no se subió a tiempo; edita la herramienta y sube el icono de nuevo.',
            })
          } else if (result && !result.ok) {
            notifyError({
              message: `Herramienta creada, pero ${result.error}. Edita la herramienta y sube el icono de nuevo.`,
            })
          }
        }
        notifySuccess({ message: 'Herramienta IA creada.' })
        resetForm()
        invalidateAITools()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await aiToolsService.delete(deleteTarget.id, { deleteIcon: true })
      if (res.success) {
        notifySuccess({ message: 'Herramienta IA eliminada.' })
        setDeleteTarget(null)
        invalidateAITools()
        if (editingId === deleteTarget.id) resetForm()
      } else {
        notifyError({ message: res.error.message })
      }
    } finally {
      setDeleting(false)
    }
  }

  const openUrl = (url: string) => {
    const href = url.startsWith('http') ? url : `https://${url}`
    window.open(href, '_blank')
  }

  const isDark = theme === 'dark'

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
          Centro de Herramientas IA
        </h2>
        <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
          Agregue herramientas de IA con nombre, especialidad, módulos recomendados, nivel, enlace y prompts para Saber 11. Se almacenan en Firestore (AI_Tools).
        </p>
      </div>

      {/* Formulario agregar / editar */}
      <Card ref={formCardRef} className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(isDark ? 'text-white' : 'text-gray-900')}>
            {editingId ? 'Editar herramienta IA' : 'Agregar herramienta IA'}
          </CardTitle>
          <CardDescription className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>
            Nombre, especialidad, módulos recomendados, nivel, URL de redirección (botón «Abrir IA»), icono y prompts sugeridos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(isDark ? 'text-gray-300' : '')}>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre de la herramienta"
                className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isDark ? 'text-gray-300' : '')}>Nivel sugerido</Label>
              <Select value={form.nivel} onValueChange={(v) => setForm((p) => ({ ...p, nivel: v as Nivel }))}>
                <SelectTrigger className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELES.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className={cn(isDark ? 'text-gray-300' : '')}>Especialidad / Enfoque</Label>
            <Textarea
              value={form.especialidad}
              onChange={(e) => setForm((p) => ({ ...p, especialidad: e.target.value }))}
              placeholder='Ej: Recomendada para Biología por su capacidad de analizar imágenes...'
              rows={3}
              className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>

          <div className="space-y-2">
            <Label className={cn(isDark ? 'text-gray-300' : '')}>Módulos recomendados</Label>
            <div className="flex flex-wrap gap-4">
              {MODULOS_RECOMENDADOS.map((m) => (
                <div key={m.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`mod-${m.value}`}
                    checked={form.modulosRecomendados.includes(m.value)}
                    onCheckedChange={() => toggleModulo(m.value)}
                  />
                  <Label
                    htmlFor={`mod-${m.value}`}
                    className={cn('text-sm font-normal cursor-pointer', isDark ? 'text-gray-300' : '')}
                  >
                    {m.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className={cn(isDark ? 'text-gray-300' : '')}>URL de redirección (botón «Abrir IA») *</Label>
            <Input
              value={form.urlRedireccion}
              onChange={(e) => setForm((p) => ({ ...p, urlRedireccion: e.target.value }))}
              placeholder="https://..."
              type="url"
              className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v === true }))}
            />
            <Label htmlFor="isActive" className={cn('text-sm font-normal cursor-pointer', isDark ? 'text-gray-300' : '')}>
              Herramienta visible (activa) para estudiantes
            </Label>
          </div>

          <div className="space-y-2">
            <Label className={cn(isDark ? 'text-gray-300' : '')}>Icono (una sola imagen)</Label>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="cursor-pointer">
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={onIconChange}
                />
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                    isDark ? 'border-zinc-600 bg-zinc-800 text-gray-300 hover:bg-zinc-700' : 'border-gray-300 bg-white hover:bg-gray-50'
                  )}
                >
                  <ImagePlus className="h-4 w-4" />
                  Subir imagen
                </span>
              </label>
              {iconPreview && (
                <div className="relative inline-block">
                  <img
                    src={iconPreview}
                    alt="Vista previa icono"
                    className="h-12 w-12 object-contain rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIconPreview(null)
                      setIconFile(null)
                    }}
                    className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className={cn(isDark ? 'text-gray-300' : '')}>Prompts sugeridos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPrompt}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {form.promptsSugeridos.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={p}
                    onChange={(e) => updatePrompt(i, e.target.value)}
                    placeholder="Ej: Explica este concepto para preparar Saber 11..."
                    rows={2}
                    className={cn('flex-1', isDark ? 'bg-zinc-800 border-zinc-700' : '')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePrompt(i)}
                    disabled={form.promptsSugeridos.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Guardar cambios' : 'Crear herramienta'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={handleCancelClick}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Listado */}
      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className={cn(isDark ? 'text-white' : 'text-gray-900')}>
                Herramientas guardadas
              </CardTitle>
              <CardDescription className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>
                Listado en Firestore: AI_Tools/{'{IAid}'} · Orden por nombre
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={loading}
                className={cn(isDark ? 'border-zinc-600 bg-zinc-800 hover:bg-zinc-700' : '')}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Actualizar listado
              </Button>
              <Select value={filterActive} onValueChange={(v) => setFilterActive(v as 'all' | 'active' | 'inactive')}>
                <SelectTrigger className={cn('w-[140px]', isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Solo activas</SelectItem>
                  <SelectItem value="inactive">Solo inactivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}>
              Cargando...
            </div>
          ) : (() => {
            const filtered = tools.filter(
              (t) =>
                filterActive === 'all' ||
                (filterActive === 'active' && t.isActive) ||
                (filterActive === 'inactive' && !t.isActive)
            )
            return filtered.length === 0 ? (
              <p className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}>
                {tools.length === 0
                  ? 'No hay herramientas IA registradas. Use el formulario de arriba para agregar una.'
                  : 'No hay herramientas que coincidan con el filtro.'}
              </p>
            ) : (
            <ul className="space-y-3">
              {filtered.map((tool) => (
                <li
                  key={tool.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                    isDark ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                  )}
                >
                  {tool.iconUrl ? (
                    <img src={tool.iconUrl} alt="" className="h-10 w-10 object-contain rounded" />
                  ) : (
                    <div
                      className={cn(
                        'h-10 w-10 rounded flex items-center justify-center',
                        isDark ? 'bg-zinc-700' : 'bg-gray-200'
                      )}
                    >
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {tool.nombre}
                      </p>
                      {tool.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                          <Eye className="h-3 w-3" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <EyeOff className="h-3 w-3" /> Inactiva
                        </span>
                      )}
                    </div>
                    <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      {tool.especialidad || '—'} · Nivel: {NIVELES.find((n) => n.value === tool.nivel)?.label ?? tool.nivel}
                    </p>
                    {tool.modulosRecomendados.length > 0 && (
                      <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                        Módulos: {tool.modulosRecomendados.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openUrl(tool.urlRedireccion)}
                      title="Abrir IA"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(tool)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(tool)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            )
          })()}
        </CardContent>
      </Card>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className={cn(isDark ? 'border-zinc-700' : '')}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tiene cambios sin guardar. Si cancela, se perderán. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver al formulario</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetForm()
                setShowCancelConfirm(false)
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className={cn(isDark ? 'border-zinc-700' : '')}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar herramienta IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleteTarget?.nombre}» y su icono de Storage. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
