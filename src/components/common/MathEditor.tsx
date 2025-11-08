import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface MathEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (latex: string, displayMode?: boolean) => void
}

export function MathEditor({ open, onOpenChange, onInsert }: MathEditorProps) {
  const [latex, setLatex] = useState('')
  const [displayMode, setDisplayMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLatex('')
      setDisplayMode(false)
      setError(null)
    }
  }, [open])

  const previewHtml = useMemo(() => {
    if (!latex.trim()) {
      setError(null)
      return ''
    }

    try {
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode,
        strict: false,
      })
      setError(null)
      return html
    } catch (err) {
      console.warn('Error renderizando LaTeX en el editor:', err)
      setError('No se pudo renderizar la fórmula. Verifica la sintaxis o intenta nuevamente.')
      return ''
    }
  }, [latex, displayMode])

  const handleInsert = () => {
    if (!latex.trim()) {
      setError('Ingresa una expresión en LaTeX antes de insertar.')
      return
    }

    onInsert(latex.trim(), displayMode)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insertar fórmula matemática</DialogTitle>
          <DialogDescription>
            Escribe la expresión en formato LaTeX. Puedes vista previa la fórmula antes de insertarla en el editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="latex-input">Expresión LaTeX</Label>
            <Textarea
              id="latex-input"
              value={latex}
              onChange={(event) => setLatex(event.target.value)}
              placeholder="Ejemplo: \frac{a^2 + b^2}{c^2}"
              rows={4}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="display-mode"
              checked={displayMode}
              onCheckedChange={setDisplayMode}
            />
            <Label htmlFor="display-mode" className="cursor-pointer">
              Mostrar en modo bloque (centrado)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Vista previa</Label>
            <div className="min-h-[80px] rounded-md border bg-muted/30 p-4">
              {previewHtml ? (
                <div
                  className={displayMode ? 'katex-display text-center' : 'katex-formula inline-block'}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  La vista previa aparecerá aquí cuando escribas una expresión válida.
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleInsert}>Insertar fórmula</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

