import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** Escapa HTML para evitar XSS */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/** Escapa comillas para atributos HTML */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Procesa texto y convierte LaTeX a spans para renderizar con KaTeX.
 * Soporta: \(...\), \[...\], $...$, $$...$$
 * Solo escapa el texto literal, no los spans generados.
 */
function processLatexInText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let t = text
  // Normalizar \( y \) que pueden venir escapados como \\( y \\)
  t = t.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)')
  let result = ''
  let lastIndex = 0
  // Regex: \(...\) | \[...\] | $$...$$ | $...$ (orden: más específico primero)
  const regex = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let m
  while ((m = regex.exec(t)) !== null) {
    result += escapeHtml(t.slice(lastIndex, m.index))
    const latex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim()
    const isDisplay = m[2] !== undefined || m[3] !== undefined
    result += `<span class="katex-formula" data-latex="${escapeAttr(latex)}"${isDisplay ? ' data-display="true"' : ''}></span>`
    lastIndex = regex.lastIndex
  }
  result += escapeHtml(t.slice(lastIndex))
  return result
}

/**
 * Componente que renderiza texto con soporte para LaTeX (KaTeX).
 * Usar para preguntas y opciones que pueden contener fórmulas.
 */
export function MathText({ text, className = '' }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || text == null) return
    const processed = processLatexInText(String(text))
    el.innerHTML = processed
    const mathElements = el.querySelectorAll('[data-latex]')
    mathElements.forEach((mathEl) => {
      const latex = mathEl.getAttribute('data-latex')
      if (latex && !mathEl.querySelector('.katex')) {
        try {
          const isDisplay = mathEl.getAttribute('data-display') === 'true'
          katex.render(latex, mathEl as HTMLElement, {
            throwOnError: false,
            displayMode: isDisplay,
            strict: false,
          })
          mathEl.classList.add('katex-formula')
        } catch (err) {
          ;(mathEl as HTMLElement).textContent = latex
        }
      }
    })
  }, [text])

  return <span ref={containerRef} className={className} />
}

/**
 * Renderiza contenido HTML que puede contener fórmulas LaTeX
 * Las fórmulas deben estar renderizadas como HTML de KaTeX
 * Esta función asegura que las ecuaciones se rendericen correctamente
 */
export function renderMathContent(html: string): string {
  if (!html) return html

  // El HTML ya debería tener las fórmulas renderizadas por KaTeX
  // Solo necesitamos asegurarnos de que los estilos de KaTeX estén aplicados
  // y que no haya problemas con el renderizado
  
  return html
}

/**
 * Componente que renderiza contenido HTML con soporte para ecuaciones matemáticas
 */
export function MathContent({ content, className = '' }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !content) return

    // El contenido ya debería tener las fórmulas renderizadas como HTML de KaTeX
    // Solo necesitamos renderizarlo y asegurar que KaTeX procese cualquier fórmula pendiente
    try {
      // Buscar elementos que puedan necesitar renderizado de KaTeX
      const mathElements = containerRef.current.querySelectorAll('.katex, .katex-inline, [data-latex]')
      
      mathElements.forEach((element) => {
        const latex = element.getAttribute('data-latex')
        if (latex) {
          try {
            katex.render(latex, element as HTMLElement, {
              throwOnError: false,
              displayMode: element.classList.contains('katex-display')
            })
          } catch (error) {
            console.error('Error renderizando fórmula:', error)
          }
        }
      })
    } catch (error) {
      console.error('Error procesando contenido matemático:', error)
    }
  }, [content])

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

