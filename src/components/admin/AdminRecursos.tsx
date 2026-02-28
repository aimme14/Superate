import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Plus,
  Link as LinkIcon,
  Youtube,
  Trash2,
  Loader2,
  ExternalLink,
  Filter,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/ui/useNotification'
import { SUBJECTS_CONFIG, getSubjectByCode, GRADE_CODE_TO_NAME } from '@/utils/subjects.config'
import {
  type ResourceType,
  type WebLink,
  type YoutubeLink,
  type ResourcePath,
} from '@/services/firebase/resources.service'
import { useResources, useResourcesMutations } from '@/hooks/query/useResources'

const GRADES = Object.entries(GRADE_CODE_TO_NAME).map(([, name]) => ({ value: name, label: name }))

interface AdminRecursosProps {
  theme: 'light' | 'dark'
}

export default function AdminRecursos({ theme }: AdminRecursosProps) {
  const { notifySuccess, notifyError } = useNotification()
  const [tipo, setTipo] = useState<ResourceType>('web')
  const [grado, setGrado] = useState<string>('')
  const [materiaCode, setMateriaCode] = useState<string>('')
  const [topicCode, setTopicCode] = useState<string>('')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [filterGrado, setFilterGrado] = useState<string>('all')
  const [filterMateria, setFilterMateria] = useState<string>('all')
  const [filterTopic, setFilterTopic] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<{ type: ResourceType; path: ResourcePath } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<WebLink | YoutubeLink | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const selectedSubject = getSubjectByCode(materiaCode)
  const topicOptions = selectedSubject?.topics ?? []

  const filters = {
    ...(filterGrado !== 'all' && { grado: filterGrado }),
    ...(filterMateria !== 'all' && { materiaCode: filterMateria }),
    ...(filterTopic !== 'all' && { topicCode: filterTopic }),
  }
  const { data: resourcesData, isLoading: loading } = useResources(filters)
  const webLinks = resourcesData?.webLinks ?? []
  const youtubeLinks = resourcesData?.youtubeLinks ?? []
  const {
    createWebLink: createWebLinkMutation,
    createYoutubeLink: createYoutubeLinkMutation,
    deleteWebLink: deleteWebLinkMutation,
    deleteYoutubeLink: deleteYoutubeLinkMutation,
    updateWebLink: updateWebLinkMutation,
    updateYoutubeLink: updateYoutubeLinkMutation,
  } = useResourcesMutations()

  const handleMateriaChange = (code: string) => {
    setMateriaCode(code)
    setTopicCode('')
  }

  const handleAdd = async () => {
    if (!grado || !materiaCode || !topicCode || !url.trim()) {
      notifyError({ message: 'Completa tipo, grado, materia, tema y URL.' })
      return
    }
    const subject = getSubjectByCode(materiaCode)
    const topic = subject?.topics.find((t) => t.code === topicCode)
    if (!subject || !topic) {
      notifyError({ message: 'Materia o tema no válidos.' })
      return
    }
    if (tipo === 'youtube') {
      const ytMatch = url.trim().match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
      if (!ytMatch) {
        notifyError({ message: 'URL de YouTube no válida. Usa enlaces de youtube.com o youtu.be' })
        return
      }
    }
    setAdding(true)
    try {
      if (tipo === 'web') {
        await createWebLinkMutation.mutateAsync({
          grado,
          materia: subject.name,
          materiaCode: subject.code,
          topic: topic.name,
          topicCode: topic.code,
          url: url.trim(),
          title: title.trim() || undefined,
        })
        notifySuccess({ message: 'Enlace web agregado.' })
        setUrl('')
        setTitle('')
      } else {
        await createYoutubeLinkMutation.mutateAsync({
          grado,
          materia: subject.name,
          materiaCode: subject.code,
          topic: topic.name,
          topicCode: topic.code,
          url: url.trim(),
          title: title.trim() || undefined,
        })
        notifySuccess({ message: 'Video de YouTube agregado.' })
        setUrl('')
        setTitle('')
      }
    } catch (e) {
      notifyError({ message: e instanceof Error ? e.message : 'Error al agregar recurso.' })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'web') {
        await deleteWebLinkMutation.mutateAsync(deleteTarget.path)
      } else {
        await deleteYoutubeLinkMutation.mutateAsync(deleteTarget.path)
      }
      notifySuccess({ message: deleteTarget.type === 'web' ? 'Enlace web eliminado.' : 'Video eliminado.' })
      setDeleteTarget(null)
    } catch (e) {
      notifyError({ message: e instanceof Error ? e.message : 'Error al eliminar.' })
    } finally {
      setDeleting(false)
    }
  }

  const openLink = (u: string) => {
    const href = u.startsWith('http') ? u : `https://${u}`
    window.open(href, '_blank')
  }

  const openEdit = (link: WebLink | YoutubeLink) => {
    setEditTarget(link)
    setEditUrl(link.url)
    setEditTitle(link.title ?? '')
  }

  const handleSaveEdit = async () => {
    if (!editTarget || !editUrl.trim()) {
      notifyError({ message: 'La URL es obligatoria.' })
      return
    }
    if (editTarget.tipo === 'youtube') {
      const ytMatch = editUrl.trim().match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
      if (!ytMatch) {
        notifyError({ message: 'URL de YouTube no válida. Usa enlaces de youtube.com o youtu.be' })
        return
      }
    }
    const path: ResourcePath = {
      grado: editTarget.grado,
      materiaCode: editTarget.materiaCode,
      topicCode: editTarget.topicCode,
      id: editTarget.id,
    }
    const data = { url: editUrl.trim(), title: editTitle.trim() }
    setSavingEdit(true)
    try {
      if (editTarget.tipo === 'web') {
        await updateWebLinkMutation.mutateAsync({ path, data })
      } else {
        await updateYoutubeLinkMutation.mutateAsync({ path, data })
      }
      notifySuccess({
        message: editTarget.tipo === 'web' ? 'Enlace web actualizado.' : 'Video de YouTube actualizado.',
      })
      setEditTarget(null)
    } catch (e) {
      notifyError({ message: e instanceof Error ? e.message : 'Error al actualizar.' })
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Agregar recurso
          </CardTitle>
          <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Sitios web o videos de YouTube por grado, materia y tema. Se guardan en WebLinks y YoutubeLinks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Tipo de recurso</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as ResourceType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="web" id="tipo-web" />
                <Label htmlFor="tipo-web" className="flex items-center gap-2 cursor-pointer font-normal">
                  <LinkIcon className="h-4 w-4" />
                  Sitio web
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="youtube" id="tipo-youtube" />
                <Label htmlFor="tipo-youtube" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Youtube className="h-4 w-4" />
                  Video YouTube
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Grado</Label>
              <Select value={grado} onValueChange={setGrado}>
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Seleccionar grado" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Materia</Label>
              <Select value={materiaCode} onValueChange={handleMateriaChange}>
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Seleccionar materia" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS_CONFIG.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Tema</Label>
              <Select value={topicCode} onValueChange={setTopicCode} disabled={!materiaCode}>
                <SelectTrigger className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Seleccionar tema" />
                </SelectTrigger>
                <SelectContent>
                  {topicOptions.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>
              URL {tipo === 'youtube' ? '(YouTube)' : ''}
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={tipo === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://...'}
              className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>
          <div className="space-y-2">
            <Label className={cn(theme === 'dark' ? 'text-gray-300' : '')}>Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Guía de álgebra"
              className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}
            />
          </div>
          <Button onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar recurso
          </Button>
        </CardContent>
      </Card>

      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Recursos guardados
              </CardTitle>
              <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Enlaces web y videos por grado, materia y tema
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 opacity-70" />
              <Select value={filterGrado} onValueChange={setFilterGrado}>
                <SelectTrigger className={cn('w-[140px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grados</SelectItem>
                  {GRADES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterMateria} onValueChange={setFilterMateria}>
                <SelectTrigger className={cn('w-[160px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Materia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {SUBJECTS_CONFIG.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className={cn('w-[200px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los temas</SelectItem>
                  {SUBJECTS_CONFIG.flatMap((s) =>
                    s.topics.map((t) => (
                      <SelectItem key={`${s.code}-${t.code}`} value={t.code}>
                        {s.name} – {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {webLinks.length > 0 && (
                <div>
                  <h4 className={cn('font-semibold mb-3 flex items-center gap-2', theme === 'dark' ? 'text-white' : '')}>
                    <LinkIcon className="h-4 w-4" />
                    Sitios web ({webLinks.length})
                  </h4>
                  <ul className="space-y-2">
                    {webLinks.map((link) => (
                      <li
                        key={link.id}
                        className={cn(
                          'flex items-center justify-between gap-2 p-3 rounded-lg border',
                          theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : '')}>
                            {link.title || link.url}
                          </p>
                          <p className={cn('text-xs truncate', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {link.grado} · {link.materia} · {link.topic}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openLink(link.url)} title="Abrir">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(link)}
                            title="Editar"
                            aria-label="Editar recurso"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'web',
                                path: {
                                  grado: link.grado,
                                  materiaCode: link.materiaCode,
                                  topicCode: link.topicCode,
                                  id: link.id,
                                },
                              })
                            }
                            className="text-red-500 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {youtubeLinks.length > 0 && (
                <div>
                  <h4 className={cn('font-semibold mb-3 flex items-center gap-2', theme === 'dark' ? 'text-white' : '')}>
                    <Youtube className="h-4 w-4" />
                    Videos YouTube ({youtubeLinks.length})
                  </h4>
                  <ul className="space-y-2">
                    {youtubeLinks.map((link) => (
                      <li
                        key={link.id}
                        className={cn(
                          'flex items-center justify-between gap-2 p-3 rounded-lg border',
                          theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : '')}>
                            {link.title || link.url}
                          </p>
                          <p className={cn('text-xs truncate', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {link.grado} · {link.materia} · {link.topic}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openLink(link.url)} title="Abrir">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(link)}
                            title="Editar"
                            aria-label="Editar recurso"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'youtube',
                                path: {
                                  grado: link.grado,
                                  materiaCode: link.materiaCode,
                                  topicCode: link.topicCode,
                                  id: link.id,
                                },
                              })
                            }
                            className="text-red-500 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {webLinks.length === 0 && youtubeLinks.length === 0 && (
                <p className={cn('text-center py-8', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay recursos con los filtros seleccionados. Agrega enlaces web o videos de YouTube arriba.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent
          className={cn(
            theme === 'dark'
              ? 'bg-zinc-900 border-zinc-600 text-white shadow-xl shadow-black/40'
              : 'bg-white border-gray-200 shadow-xl'
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                theme === 'dark' ? 'text-white' : 'text-gray-900',
                'text-xl font-semibold'
              )}
            >
              Editar recurso
            </DialogTitle>
            <DialogDescription
              className={cn(
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
                'text-sm leading-relaxed'
              )}
            >
              Modifica la URL o el título. Grado, materia y tema no se pueden cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                className={cn(
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700',
                  'font-medium'
                )}
              >
                URL
              </Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder={editTarget?.tipo === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://...'}
                className={cn(
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500 focus-visible:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus-visible:ring-blue-500'
                )}
              />
            </div>
            <div className="space-y-2">
              <Label
                className={cn(
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700',
                  'font-medium'
                )}
              >
                Título (opcional)
              </Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ej: Guía de álgebra"
                className={cn(
                  theme === 'dark'
                    ? 'bg-zinc-800 border-zinc-600 text-gray-100 placeholder:text-gray-500 focus-visible:ring-blue-500 focus-visible:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus-visible:ring-blue-500'
                )}
              />
            </div>
          </div>
          <DialogFooter
            className={cn(
              'gap-2 sm:gap-0',
              theme === 'dark' ? 'border-t border-zinc-700 pt-4' : 'border-t border-gray-200 pt-4'
            )}
          >
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={savingEdit}
              className={cn(
                theme === 'dark'
                  ? 'border-zinc-600 text-gray-200 hover:bg-zinc-800 hover:text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className={cn(
                'min-w-[140px]',
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500'
                  : 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500'
              )}
            >
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar recurso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El enlace se eliminará de la lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
