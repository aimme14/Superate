/**
 * Sección "Herramientas IA" del plan de estudio.
 * Muestra tarjetas con la información de cada herramienta y un bloque expandible
 * con los prompts sugeridos (similar a Tips para Romperla en el ICFES).
 */

import { useState, useCallback } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AIToolData } from '@/services/firebase/aiTools.service'
import { MODULOS_RECOMENDADOS, NIVELES } from '@/services/firebase/aiTools.service'
import { ExternalLink, Sparkles, Copy, Check } from 'lucide-react'

const COPIED_RESET_MS = 2000

export interface HerramientasIASectionProps {
  tools: AIToolData[]
  theme: 'light' | 'dark'
}

function getModuloLabel(value: string): string {
  const found = MODULOS_RECOMENDADOS.find((m) => m.value === value)
  return found?.label ?? value
}

function getNivelLabel(value: string): string {
  const found = NIVELES.find((n) => n.value === value)
  return found?.label ?? value
}

export function HerramientasIASection({ tools, theme }: HerramientasIASectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null)

  const handleCopyPrompt = useCallback((key: string, text: string) => {
    const toCopy = text.trim() || ''
    if (!toCopy) return
    navigator.clipboard.writeText(toCopy).then(() => {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), COPIED_RESET_MS)
    })
  }, [])

  const cardBorderClass = theme === 'dark' ? 'border-zinc-600 bg-zinc-800/40' : 'border-gray-200 bg-gray-50/80'
  const titleClass = cn('font-semibold', theme === 'dark' ? 'text-zinc-100' : 'text-gray-900')
  const descClass = cn('text-sm', theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')
  const promptTriggerClass = cn(
    'py-2 px-3 hover:no-underline text-sm',
    theme === 'dark' ? 'text-teal-300 hover:bg-teal-500/15' : 'text-primary hover:bg-primary/10'
  )
  const promptContentClass = cn(
    'text-sm rounded-md p-3 font-mono whitespace-pre-wrap break-words',
    theme === 'dark' ? 'bg-zinc-900/80 text-zinc-300 border border-zinc-600' : 'bg-gray-100 text-gray-800 border border-gray-200'
  )

  if (tools.length === 0) return null

  return (
    <section aria-labelledby="herramientas-ia-heading" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {tools.map((tool) => (
          <Card key={tool.id} className={cn('overflow-hidden border', cardBorderClass)}>
            <CardHeader className="pb-2">
              <div className="flex gap-3">
                {tool.iconUrl ? (
                  <img
                    src={tool.iconUrl}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10 self-start"
                  />
                ) : (
                  <div
                    className={cn(
                      'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl self-start',
                      theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Sparkles className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn(titleClass, "leading-tight")}>{tool.nombre}</h3>
                    {tool.urlRedireccion && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        asChild
                      >
                        <a
                          href={tool.urlRedireccion}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ir a la herramienta"
                          aria-label="Ir a la herramienta"
                          className={cn(
                            theme === 'dark' ? 'border-teal-500/40 text-teal-300 hover:bg-teal-500/15' : ''
                          )}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {tool.especialidad && (
                    <div>
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          expandedDescId !== tool.id && 'line-clamp-3',
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                        )}
                      >
                        {tool.especialidad}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpandedDescId((id) => (id === tool.id ? null : tool.id))}
                        className={cn(
                          'mt-1 text-xs font-medium underline-offset-2 hover:underline',
                          theme === 'dark' ? 'text-teal-400 hover:text-teal-300' : 'text-primary hover:underline'
                        )}
                      >
                        {expandedDescId === tool.id ? 'Ver menos' : 'Ver más'}
                      </button>
                    </div>
                  )}
                  {tool.modulosRecomendados.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tool.modulosRecomendados.map((mod) => (
                        <Badge
                          key={mod}
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            theme === 'dark' ? 'bg-teal-500/15 text-teal-200 border-teal-500/30' : 'bg-primary/10 text-primary border-primary/20'
                          )}
                        >
                          {getModuloLabel(mod)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>
                    Nivel: {getNivelLabel(tool.nivel)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {tool.promptsSugeridos.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="prompts" className="border-0">
                    <AccordionTrigger className={cn('rounded-lg', promptTriggerClass)}>
                      Ver prompts sugeridos ({tool.promptsSugeridos.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-1">
                        {tool.promptsSugeridos.map((prompt, idx) => {
                          const copyKey = `${tool.id}-${idx}`
                          const isCopied = copiedKey === copyKey
                          const promptText = prompt.trim() || ''
                          return (
                            <div key={idx} className={descClass}>
                              <div className="flex items-center justify-between gap-2">
                                {tool.promptsSugeridos.length > 1 ? (
                                  <span className={cn('font-medium', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                                    Prompt {idx + 1}:
                                  </span>
                                ) : (
                                  <span />
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                                  onClick={() => handleCopyPrompt(copyKey, promptText)}
                                  disabled={!promptText || isCopied}
                                  aria-label={isCopied ? 'Copiado' : 'Copiar prompt'}
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      Copiar
                                    </>
                                  )}
                                </Button>
                              </div>
                              <pre className={cn('mt-1', promptContentClass)}>
                                {promptText || '(Sin texto)'}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
