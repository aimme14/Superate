import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pi, Infinity, Divide, Minus, Plus, Sigma, Radical, Asterisk } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
// Importar estilos de MathLive (usando el export correcto del package.json)
import 'mathlive/fonts.css'

// Cargar MathLive dinámicamente
if (typeof window !== 'undefined') {
  import('mathlive').then((mathlive) => {
    if (!customElements.get('math-field')) {
      customElements.define('math-field', mathlive.MathfieldElement)
    }
  })
}

interface MathEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (latex: string, displayMode?: boolean) => void
}

export function MathEditor({ open, onOpenChange, onInsert }: MathEditorProps) {
  const [latex, setLatex] = useState('')
  const [displayMode, setDisplayMode] = useState(false)
  const mathfieldRef = useRef<any>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Prevenir que los clics en el teclado virtual cierren el diálogo
    const handleClick = (e: MouseEvent) => {
      if (!open) return
      const target = e.target as HTMLElement
      // Verificar si el clic está en el teclado virtual de MathLive
      if (target.closest('.ML__keyboard') || 
          target.closest('.ML__virtual-keyboard') ||
          target.closest('.MLK__keyboard') ||
          target.closest('.ML__popover') ||
          target.closest('[data-latex]')) {
        e.stopPropagation()
      }
    }

    if (open && typeof window !== 'undefined') {
      document.addEventListener('click', handleClick, true)
      
      import('mathlive').then((mathlive) => {
        if (!customElements.get('math-field')) {
          customElements.define('math-field', mathlive.MathfieldElement)
        }
        
        // Esperar a que el elemento esté en el DOM
        setTimeout(() => {
          if (mathfieldRef.current) {
            const mfe = mathfieldRef.current as any
            if (mfe && typeof mfe.setOptions === 'function') {
              mfe.setOptions({
                virtualKeyboardMode: 'manual',
                smartFence: true,
                smartSuperscript: true,
              })
              mfe.focus()
            }
          }
        }, 100)
      })
    } else if (!open) {
      // Limpiar cuando se cierra
      setLatex('')
      setDisplayMode(false)
    }

    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [open])

  useEffect(() => {
    if (previewRef.current && latex) {
      try {
        katex.render(latex, previewRef.current, {
          throwOnError: false,
          displayMode,
        })
      } catch (error) {
        console.error('Error renderizando preview:', error)
      }
    }
  }, [latex, displayMode])

  const handleInsert = () => {
    if (mathfieldRef.current) {
      const mfe = mathfieldRef.current as any
      if (mfe && typeof mfe.getValue === 'function') {
        const latexValue = mfe.getValue('latex')
        if (latexValue) {
          onInsert(latexValue, displayMode)
          // Limpiar el editor
          setLatex('')
          if (typeof mfe.setValue === 'function') {
            mfe.setValue('')
          }
          onOpenChange(false)
        }
      } else if (latex) {
        // Fallback: usar el estado si MathLive no está disponible
        onInsert(latex, displayMode)
        setLatex('')
        onOpenChange(false)
      }
    } else if (latex) {
      // Fallback: usar el estado si el ref no está disponible
      onInsert(latex, displayMode)
      setLatex('')
      onOpenChange(false)
    }
  }

  const insertSymbol = (symbol: string) => {
    if (mathfieldRef.current) {
      const mfe = mathfieldRef.current as any
      if (mfe && typeof mfe.insert === 'function') {
        mfe.insert(symbol)
        mfe.focus()
      }
    }
  }

  const quickInsert = (template: string) => {
    if (mathfieldRef.current) {
      const mfe = mathfieldRef.current as any
      if (mfe && typeof mfe.setValue === 'function') {
        mfe.setValue(template)
        mfe.focus()
        // Seleccionar el placeholder para que el usuario pueda escribir
        const length = mfe.getValue('latex').length
        mfe.selectRange([length - 1, length])
      }
    }
  }

  const symbolButtons = [
    { label: 'π', value: '\\pi', icon: Pi },
    { label: '∞', value: '\\infty', icon: Infinity },
    { label: '∑', value: '\\sum', icon: Sigma },
    { label: '√', value: '\\sqrt', icon: Radical },
    { label: '÷', value: '\\div', icon: Divide },
    { label: '×', value: '\\times', icon: Asterisk },
    { label: '±', value: '\\pm' },
    { label: '≤', value: '\\leq' },
    { label: '≥', value: '\\geq' },
    { label: '≠', value: '\\neq' },
    { label: '≈', value: '\\approx' },
    { label: '∠', value: '\\angle' },
    { label: '°', value: '^\\circ' },
    { label: 'α', value: '\\alpha' },
    { label: 'β', value: '\\beta' },
    { label: 'θ', value: '\\theta' },
    { label: 'λ', value: '\\lambda' },
    { label: 'Δ', value: '\\Delta' },
  ]

  const functionButtons = [
    { label: 'sin', value: '\\sin' },
    { label: 'cos', value: '\\cos' },
    { label: 'tan', value: '\\tan' },
    { label: 'log', value: '\\log' },
    { label: 'ln', value: '\\ln' },
    { label: 'exp', value: '\\exp' },
    { label: 'lim', value: '\\lim' },
    { label: '∫', value: '\\int' },
  ]

  const templates = [
    { label: 'Fracción', value: '\\frac{a}{b}' },
    { label: 'Raíz cuadrada', value: '\\sqrt{x}' },
    { label: 'Raíz n-ésima', value: '\\sqrt[n]{x}' },
    { label: 'Potencia', value: 'x^{n}' },
    { label: 'Subíndice', value: 'x_{n}' },
    { label: 'Integral', value: '\\int_{a}^{b} \\, dx' },
    { label: 'Sumatoria', value: '\\sum_{i=1}^{n} a_{i}' },
    { label: 'Límite', value: '\\lim_{x \\to \\infty}' },
    { label: 'Matriz 2x2', value: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevenir que el diálogo se cierre cuando se hace clic en el teclado virtual de MathLive
          const target = e.target as HTMLElement
          if (target.closest('.ML__keyboard') || target.closest('.ML__virtual-keyboard')) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editor de Fórmulas Matemáticas
          </DialogTitle>
          <DialogDescription>
            Escribe o edita fórmulas matemáticas usando el editor. Puedes usar el teclado o los botones de ayuda.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="symbols">Símbolos</TabsTrigger>
            <TabsTrigger value="templates">Plantillas</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Escribe tu fórmula:</label>
                <div className="flex items-center gap-2">
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={displayMode}
                      onChange={(e) => setDisplayMode(e.target.checked)}
                      className="rounded"
                    />
                    Modo bloque (centrado)
                  </label>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <math-field
                  ref={mathfieldRef}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    fontSize: '20px',
                  }}
                  onInput={(evt: any) => {
                    try {
                      const value = evt.target?.getValue?.('latex') || ''
                      setLatex(value)
                    } catch (error) {
                      console.error('Error obteniendo valor de MathLive:', error)
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vista previa:</label>
              <div
                ref={previewRef}
                className={`border rounded-lg p-4 bg-white dark:bg-gray-800 min-h-[80px] flex items-center justify-center ${
                  displayMode ? 'text-center' : ''
                }`}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertSymbol('+')}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Suma
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertSymbol('-')}
                className="flex items-center gap-1"
              >
                <Minus className="h-4 w-4" />
                Resta
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertSymbol('\\times')}
                className="flex items-center gap-1"
              >
                <Asterisk className="h-4 w-4" />
                Multiplicar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertSymbol('\\div')}
                className="flex items-center gap-1"
              >
                <Divide className="h-4 w-4" />
                Dividir
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="symbols" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Símbolos Comunes</h3>
              <div className="grid grid-cols-6 gap-2">
                {symbolButtons.map((symbol) => {
                  const Icon = symbol.icon
                  return (
                    <Button
                      key={symbol.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(symbol.value)}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                      title={symbol.value}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                      <span className="text-lg">{symbol.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Funciones</h3>
              <div className="grid grid-cols-4 gap-2">
                {functionButtons.map((func) => (
                  <Button
                    key={func.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertSymbol(func.value + '\\left(')}
                    className="flex items-center justify-center"
                  >
                    {func.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Plantillas de Fórmulas</h3>
              <p className="text-sm text-muted-foreground">
                Haz clic en una plantilla para insertarla. Puedes editar los valores después.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {templates.map((template) => (
                  <Button
                    key={template.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => quickInsert(template.value)}
                    className="flex flex-col items-start h-auto py-3 text-left"
                  >
                    <span className="font-medium">{template.label}</span>
                    <span className="text-xs text-muted-foreground mt-1">{template.value}</span>
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleInsert} disabled={!latex}>
            Insertar Fórmula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

