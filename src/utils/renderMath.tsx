import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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

