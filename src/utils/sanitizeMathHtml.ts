import DOMPurify from 'dompurify'

/**
 * Sanitiza HTML permitiendo elementos y clases de KaTeX necesarias para renderizar ecuaciones
 */
export function sanitizeMathHtml(html: string): string {
  if (!html) return html

  // Configuración de DOMPurify que permite elementos y atributos de KaTeX
  const config = {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mfrac', 'msup', 'msub', 'munderover', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'mspace', 'menclose', 'merror', 'mfenced', 'mphantom', 'mpadded', 'mroot', 'mstyle', 'mmultiscripts', 'mover', 'mprescripts', 'munder', 'munderover', 'none'],
    ADD_ATTR: ['data-latex', 'data-katex', 'class'],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    // Permitir clases CSS de KaTeX
    FORBID_TAGS: [],
    FORBID_ATTR: [],
    // Permitir estilos inline que KaTeX puede necesitar
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: false
  }

  const sanitized = DOMPurify.sanitize(html, config)
  
  // Asegurarse de que los elementos katex mantengan sus clases
  return sanitized
}

