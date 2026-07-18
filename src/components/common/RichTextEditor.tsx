import { useMemo, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import { logger } from '@/utils/logger'
import ReactQuill from 'react-quill'
import Quill from 'quill'
import 'react-quill/dist/quill.snow.css'
import { MathEditor } from './MathEditor'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Función para convertir números a superíndices Unicode
function numeroASuperindice(num: string): string {
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ'
  }
  return num.split('').map(d => superscripts[d] || d).join('')
}

// Función para convertir números a subíndices Unicode
function numeroASubindice(num: string): string {
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
    'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
    'v': 'ᵥ', 'x': 'ₓ'
  }
  return num.split('').map(d => subscripts[d] || d).join('')
}

// Función para convertir LaTeX a Unicode (fallback cuando KaTeX no funciona)
function convertirLatexAUnicode(latex: string): string {
  let resultado = latex
  
  // Primero, manejar logaritmos: \log, \ln, \lg deben procesarse antes de otras conversiones
  resultado = resultado.replace(/\\log(?![a-zA-Z])/g, 'log')
  resultado = resultado.replace(/\\ln(?![a-zA-Z])/g, 'ln')
  resultado = resultado.replace(/\\lg(?![a-zA-Z])/g, 'lg')
  
  // Manejar fracciones: \frac{a}{b} -> a/b (formato visual mejorado)
  resultado = resultado.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_match, num, den) => {
    // Limpiar el numerador y denominador de comandos LaTeX
    const numerador = convertirLatexAUnicode(num).trim()
    const denominador = convertirLatexAUnicode(den).trim()
    // Usar formato de fracción visual: numerador/denominador
    return `${numerador}⁄${denominador}` // Usar el carácter de fracción Unicode
  })
  
  // Manejar fracciones sin llaves: \frac ab -> a/b
  resultado = resultado.replace(/\\frac\s+([^\s{}]+)\s+([^\s{}]+)/g, (_match, num, den) => {
    const numerador = convertirLatexAUnicode(num).trim()
    const denominador = convertirLatexAUnicode(den).trim()
    return `${numerador}⁄${denominador}`
  })
  
  // Manejar raíces cuadradas: \sqrt{x} -> √x
  resultado = resultado.replace(/\\sqrt\{([^}]+)\}/g, (_match, contenido) => {
    const contenidoLimpio = convertirLatexAUnicode(contenido)
    return `√${contenidoLimpio}`
  })
  resultado = resultado.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (_match, indice, contenido) => {
    const contenidoLimpio = convertirLatexAUnicode(contenido)
    return `√[${indice}]${contenidoLimpio}`
  })
  resultado = resultado.replace(/\\sqrt(\d+)/g, '√$1')
  
  // Manejar superíndices: x^{abc} -> xᵃᵇᶜ o x^2 -> x²
  resultado = resultado.replace(/\^\{([^}]+)\}/g, (_match, contenido) => {
    // Si es un número, convertir a superíndice
    if (/^\d+$/.test(contenido)) {
      return numeroASuperindice(contenido)
    }
    // Si contiene letras y números, convertir cada carácter
    return contenido.split('').map((c: string) => {
      if (/\d/.test(c)) return numeroASuperindice(c)
      if (/[a-z]/.test(c)) {
        const letras: Record<string, string> = {
          'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
          'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
          'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
          'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
          'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ'
        }
        return letras[c] || c
      }
      return c
    }).join('')
  })
  resultado = resultado.replace(/\^(\d+)/g, (_match, num) => numeroASuperindice(num))
  resultado = resultado.replace(/\^([a-z])/g, (_match, letra) => {
    const letras: Record<string, string> = {
      'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
      'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
      'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
      'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
      'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ'
    }
    return letras[letra] || `^${letra}`
  })
  
  // Manejar subíndices: x_{abc} -> xₐᵦᶜ o x_2 -> x₂
  resultado = resultado.replace(/_\{([^}]+)\}/g, (_match, contenido) => {
    // Si es un número, convertir a subíndice
    if (/^\d+$/.test(contenido)) {
      return numeroASubindice(contenido)
    }
    // Si contiene letras y números, convertir cada carácter
    return contenido.split('').map((c: string) => {
      if (/\d/.test(c)) return numeroASubindice(c)
      return numeroASubindice(c)
    }).join('')
  })
  resultado = resultado.replace(/_(\d+)/g, (_match, num) => numeroASubindice(num))
  resultado = resultado.replace(/_([a-z])/g, (_match, letra) => numeroASubindice(letra))
  
  // Conversiones de símbolos y letras griegas
  const conversiones: Record<string, string> = {
    // Letras griegas
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
    '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
    '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\varrho': 'ϱ',
    '\\sigma': 'σ', '\\varsigma': 'ς', '\\tau': 'τ', '\\upsilon': 'υ',
    '\\phi': 'φ', '\\varphi': 'ϕ', '\\chi': 'χ', '\\psi': 'ψ',
    '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
    '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
    // Símbolos matemáticos
    '\\infty': '∞', '\\pm': '±', '\\mp': '∓', '\\times': '×',
    '\\div': '÷', '\\cdot': '·', '\\ast': '∗', '\\star': '⋆',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
    '\\equiv': '≡', '\\propto': '∝', '\\sim': '∼', '\\simeq': '≃',
    '\\cong': '≅', '\\asymp': '≍', '\\doteq': '≐', '\\models': '⊨',
    '\\prec': '≺', '\\succ': '≻', '\\preceq': '≼', '\\succeq': '≽',
    '\\ll': '≪', '\\gg': '≫', '\\subset': '⊂', '\\supset': '⊃',
    '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\ni': '∋',
    '\\notin': '∉', '\\cap': '∩', '\\cup': '∪', '\\sqcap': '⊓',
    '\\sqcup': '⊔', '\\vee': '∨', '\\wedge': '∧', '\\setminus': '∖',
    '\\wr': '≀', '\\diamond': '⋄', '\\bigtriangleup': '△',
    '\\bigtriangledown': '▽', '\\triangleleft': '◁', '\\triangleright': '▷',
    '\\lhd': '⊲', '\\rhd': '⊳', '\\unlhd': '⊴', '\\unrhd': '⊵',
    '\\oplus': '⊕', '\\ominus': '⊖', '\\otimes': '⊗', '\\oslash': '⊘',
    '\\odot': '⊙', '\\bigcirc': '○', '\\dagger': '†', '\\ddagger': '‡',
    '\\amalg': '⨿', '\\angle': '∠', '\\measuredangle': '∡',
    '\\sphericalangle': '∢', '\\degree': '°', '\\prime': '′',
    '\\doubleprime': '″', '\\ell': 'ℓ', '\\hbar': 'ℏ',
    '\\imath': 'ı', '\\jmath': 'ȷ', '\\partial': '∂', '\\nabla': '∇',
    '\\surd': '√', '\\sqrt': '√', '\\sum': '∑', '\\prod': '∏',
    '\\coprod': '∐', '\\int': '∫', '\\oint': '∮', '\\iint': '∬',
    '\\iiint': '∭', '\\iiiint': '⨌', '\\idotsint': '∫⋯∫',
    '\\bigcap': '⋂', '\\bigcup': '⋃', '\\bigsqcup': '⨆',
    '\\bigvee': '⋁', '\\bigwedge': '⋀', '\\bigodot': '⨀',
    '\\bigotimes': '⨂', '\\bigoplus': '⨁', '\\biguplus': '⨄',
    // Operadores
    '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan', '\\cot': 'cot',
    '\\sec': 'sec', '\\csc': 'csc', '\\arcsin': 'arcsin', '\\arccos': 'arccos',
    '\\arctan': 'arctan', '\\sinh': 'sinh', '\\cosh': 'cosh', '\\tanh': 'tanh',
    '\\coth': 'coth', '\\log': 'log', '\\ln': 'ln', '\\lg': 'lg',
    '\\exp': 'exp', '\\lim': 'lim', '\\limsup': 'lim sup', '\\liminf': 'lim inf',
    '\\sup': 'sup', '\\inf': 'inf', '\\max': 'max', '\\min': 'min',
    '\\det': 'det', '\\dim': 'dim', '\\ker': 'ker', '\\deg': 'deg',
    '\\hom': 'hom', '\\arg': 'arg', '\\gcd': 'gcd', '\\Pr': 'Pr',
    // Puntos suspensivos
    '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
    '\\dots': '…', '\\dotsc': '…', '\\dotsb': '⋯', '\\dotsm': '⋯',
    '\\dotsi': '⋯', '\\dotso': '…',
    // Flechas
    '\\leftarrow': '←', '\\Leftarrow': '⇐', '\\rightarrow': '→',
    '\\Rightarrow': '⇒', '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔',
    '\\mapsto': '↦', '\\hookleftarrow': '↩', '\\hookrightarrow': '↪',
    '\\leftharpoonup': '↼', '\\leftharpoondown': '↽', '\\rightharpoonup': '⇀',
    '\\rightharpoondown': '⇁', '\\rightleftharpoons': '⇌', '\\longleftarrow': '⟵',
    '\\Longleftarrow': '⟸', '\\longrightarrow': '⟶', '\\Longrightarrow': '⟹',
    '\\longleftrightarrow': '⟷', '\\Longleftrightarrow': '⟺', '\\longmapsto': '⟼',
    '\\uparrow': '↑', '\\Uparrow': '⇑', '\\downarrow': '↓', '\\Downarrow': '⇓',
    '\\updownarrow': '↕', '\\Updownarrow': '⇕', '\\nearrow': '↗',
    '\\searrow': '↘', '\\swarrow': '↙', '\\nwarrow': '↖',
    // Cuantificadores
    '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄', '\\empty': '∅',
    '\\emptyset': '∅', '\\varnothing': '∅', '\\triangle': '△',
    // Conjuntos
    '\\mathbb{N}': 'ℕ', '\\mathbb{Z}': 'ℤ', '\\mathbb{Q}': 'ℚ',
    '\\mathbb{R}': 'ℝ', '\\mathbb{C}': 'ℂ', '\\mathbb{P}': 'ℙ',
    '\\mathbb{F}': '𝔽', '\\mathbb{A}': '𝔸',
    // Otros
    '\\Im': 'ℑ', '\\Re': 'ℜ', '\\wp': '℘',
    '\\top': '⊤', '\\bot': '⊥', '\\vdash': '⊢', '\\dashv': '⊣',
    '\\lVert': '‖', '\\rVert': '‖', '\\lceil': '⌈',
    '\\rceil': '⌉', '\\lfloor': '⌊', '\\rfloor': '⌋'
  }
  
  // Aplicar conversiones básicas (después de fracciones y raíces)
  // Ordenar por longitud descendente para evitar reemplazos parciales
  const conversionesOrdenadas = Object.entries(conversiones).sort((a, b) => b[0].length - a[0].length)
  
  for (const [key, value] of conversionesOrdenadas) {
    // Crear regex que coincida con el comando completo pero no con comandos más largos
    const regex = new RegExp(key.replace(/\\/g, '\\\\') + '(?![a-zA-Z])', 'g')
    resultado = resultado.replace(regex, value)
  }
  
  // Limpiar cualquier comando LaTeX que no se haya convertido (barras invertidas seguidas de letras)
  // Esto captura comandos como \rho, \alpha, etc. que no están en la lista
  resultado = resultado.replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (_match, comando) => {
    // Si el comando no se convirtió, intentar convertirlo a minúsculas o eliminarlo
    // Para letras griegas comunes que puedan faltar
    const letrasGriegas: Record<string, string> = {
      'rho': 'ρ', 'Rho': 'Ρ', 'sigma': 'σ', 'Sigma': 'Σ',
      'tau': 'τ', 'Tau': 'Τ', 'upsilon': 'υ', 'Upsilon': 'Υ',
      'phi': 'φ', 'Phi': 'Φ', 'chi': 'χ', 'Chi': 'Χ',
      'psi': 'ψ', 'Psi': 'Ψ', 'omega': 'ω', 'Omega': 'Ω'
    }
    return letrasGriegas[comando] || letrasGriegas[comando.toLowerCase()] || ''
  })
  
  // Limpiar comandos LaTeX que no tienen representación visual
  resultado = resultado.replace(/\\left/g, '')
  resultado = resultado.replace(/\\right/g, '')
  resultado = resultado.replace(/\\,/g, '')
  resultado = resultado.replace(/\\;/g, '')
  resultado = resultado.replace(/\\!/g, '')
  resultado = resultado.replace(/\\:/g, '')
  resultado = resultado.replace(/\\quad/g, ' ')
  resultado = resultado.replace(/\\qquad/g, '  ')
  resultado = resultado.replace(/\\hspace\{[^}]+\}/g, ' ')
  resultado = resultado.replace(/\\vspace\{[^}]+\}/g, '')
  
  // Limpiar llaves vacías o innecesarias
  resultado = resultado.replace(/\{\}/g, '')
  
  // Limpiar barras invertidas sueltas que no son comandos válidos
  resultado = resultado.replace(/\\(?![a-zA-Z])/g, '')
  
  // Limpiar espacios extra pero mantener espacios entre palabras
  resultado = resultado.replace(/\s+/g, ' ').trim()
  
  // Eliminar caracteres de control y caracteres invisibles
  resultado = resultado.replace(/[\u200B-\u200D\uFEFF]/g, '')
  
  return resultado
}

// Función para detectar y convertir texto LaTeX en el contenido
function detectarYConvertirLatexEnTexto(html: string): string {
  // Crear un elemento temporal para procesar el HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Buscar texto que contenga patrones LaTeX pero no esté dentro de elementos de fórmula
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text
      const text = textNode.textContent || ''
      const parent = textNode.parentElement
      
      // Solo procesar si no está dentro de un elemento de fórmula
      if (parent && !parent.closest('[data-latex]') && !parent.closest('.katex') && !parent.closest('.math-unicode')) {
        // Detectar cualquier patrón LaTeX (comandos que empiezan con \)
        if (text.includes('\\') || text.includes('^') || text.includes('_') || text.includes('\\frac')) {
          textNodes.push(textNode)
        }
      }
    }
  }
  
  // Convertir los nodos de texto encontrados
  textNodes.forEach(textNode => {
    const text = textNode.textContent || ''
    // Convertir todo el texto LaTeX a Unicode
    const converted = convertirLatexAUnicode(text)
    if (converted !== text) {
      textNode.textContent = converted
    }
  })
  
  return tempDiv.innerHTML
}

// Crear un Blot personalizado para fórmulas matemáticas
// Usamos Embed para que funcione con insertEmbed
// Asegurar que registramos en la misma instancia de Quill que usa ReactQuill
const QuillLib: any = (ReactQuill as any)?.Quill || Quill
const Embed: any = QuillLib.import('blots/embed')

class MathFormulaBlot extends Embed {
  static blotName = 'mathFormula'
  static tagName = 'span'
  static className = 'katex-formula'

  static create(value: string | { latex: string; displayMode?: boolean }) {
    const node = super.create()
    
    // Manejar tanto string como objeto con latex y displayMode
    let latex: string
    let displayMode = false
    
    if (typeof value === 'string') {
      latex = value
    } else if (value && typeof value === 'object') {
      latex = value.latex || ''
      displayMode = value.displayMode || false
    } else {
      latex = ''
    }
    
    if (!latex) {
      return node
    }
    
    node.setAttribute('data-latex', latex)
    node.setAttribute('contenteditable', 'false')
    node.classList.add('katex-formula')
    
    if (displayMode) {
      node.classList.add('katex-display')
      node.style.display = 'inline-block'
      node.style.textAlign = 'center'
      node.style.margin = '0.5em 0'
    }
    
    // Renderizar la fórmula con KaTeX INMEDIATAMENTE usando render() directamente
    let renderizadoExitoso = false
    
    // Intentar con KaTeX primero
    if (katex && typeof katex.render === 'function') {
      try {
        // Limpiar el contenido del nodo antes de renderizar
        node.innerHTML = ''
        
        // Usar katex.render() para renderizar directamente en el elemento DOM
        katex.render(latex, node, {
          throwOnError: false,
          displayMode: displayMode,
          strict: false,
        })
        
        // Verificar que el renderizado fue exitoso
        const hasKaTeX = node.querySelector('.katex') !== null
        if (hasKaTeX && node.innerHTML.trim() !== '') {
          renderizadoExitoso = true
        }
      } catch (error) {
        logger.warn('Error renderizando con KaTeX:', error)
      }
    }
    
    // Si KaTeX falló, usar conversión a Unicode como fallback
    if (!renderizadoExitoso) {
      try {
        const unicodeText = convertirLatexAUnicode(latex)
        node.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
        renderizadoExitoso = true
      } catch (error) {
        logger.warn('Error en conversión Unicode:', error)
        node.textContent = latex
      }
    }
    
    // Si aún no se renderizó, mostrar el LaTeX original
    if (!renderizadoExitoso) {
      node.textContent = latex
      return node
    }
    
    // Asegurarse de que todos los elementos de KaTeX se muestren correctamente
    // Forzar que los elementos críticos tengan display correcto
    setTimeout(() => {
      const katexElements = node.querySelectorAll('.katex')
      katexElements.forEach((katexEl: Element) => {
        const htmlEl = katexEl as HTMLElement
        if (htmlEl.style) {
          htmlEl.style.display = displayMode ? 'block' : 'inline-block'
        }
      })
      
      // Asegurar que fracciones, raíces, etc. se muestren
      const criticalElements = node.querySelectorAll('.frac-line, .vlist-t, .vlist, .msupsub')
      criticalElements.forEach((el: Element) => {
        const htmlEl = el as HTMLElement
        if (htmlEl.style) {
          htmlEl.style.display = 'inline-block'
        }
      })
    }, 0)
    
    return node
  }

  static value(node: HTMLElement) {
    const latex = node.getAttribute('data-latex') || ''
    const displayMode = node.classList.contains('katex-display')
    return { latex, displayMode }
  }
}

// Registrar el Blot como formato embed ANTES de que se use
// Asegurarse de que no esté ya registrado
try {
  if (QuillLib?.imports && QuillLib.imports['formats/mathFormula']) {
    delete QuillLib.imports['formats/mathFormula']
  }
  // Registrar directamente la clase (Parchment la registra con blotName)
  QuillLib.register(MathFormulaBlot, true)
  // Compatibilidad: también exponer bajo la ruta de formato
  QuillLib.register({ 'formats/mathFormula': MathFormulaBlot }, true)
} catch (error) {
  logger.error('Error registrando MathFormulaBlot:', error)
}

export type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  theme?: 'light' | 'dark'
  simplifiedToolbar?: boolean // Si es true, quita listas y selector de fuente
  minimalToolbar?: boolean // Si es true, solo muestra subíndice y superíndice
}

export type RichTextEditorRef = {
  insertText: (text: string) => void
  insertHTML: (html: string) => void
  insertMathFormula: (latex: string, displayMode?: boolean) => void
}

const baseToolbar = [
  [{ font: [] }, { size: [] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ script: 'sub' }, { script: 'super' }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['math']
]

// Toolbar simplificado sin listas, selector de fuente, tamaño, color y alineación (para opciones de respuesta)
const simplifiedToolbarConfig = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ script: 'sub' }, { script: 'super' }],
  ['math']
]

// Toolbar mínimo solo con subíndice, superíndice y fórmulas matemáticas
const minimalToolbarConfig = [
  [{ script: 'sub' }, { script: 'super' }],
  ['math']
]

const baseFormats = [
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'script',
  'color',
  'background',
  'align',
  'list',
  'mathFormula' // Añadir el formato personalizado
]

// Formatos simplificados sin font, size, list, color, background y align (para opciones de respuesta)
const simplifiedFormats = [
  'bold',
  'italic',
  'underline',
  'strike',
  'script',
  'mathFormula'
]

// Formatos mínimos solo con script (subíndice y superíndice) y fórmulas matemáticas
const minimalFormats = [
  'script',
  'mathFormula'
]

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder, className, theme = 'light', simplifiedToolbar = false, minimalToolbar = false }, ref) => {
    const quillRef = useRef<ReactQuill | null>(null)
    const [mathEditorOpen, setMathEditorOpen] = useState(false)

    const insertHTML = (html: string) => {
      const quill = quillRef.current?.getEditor()
      if (quill) {
        const range = quill.getSelection()
        const index = range ? range.index : quill.getLength() - 1
        
        // Insertar el HTML
        quill.clipboard.dangerouslyPasteHTML(index, html)
        
        // Mover el cursor después del contenido insertado
        const length = quill.getLength()
        quill.setSelection(length - 1)
        
        // Disparar el evento onChange
        const newHtml = quill.root.innerHTML
        onChange(newHtml)
      }
    }

    const insertMathFormula = (latex: string, displayMode?: boolean) => {
      const quill = quillRef.current?.getEditor()
      if (!quill) {
        logger.error('Quill no está disponible')
        return
      }

      
      // Obtener la posición actual del cursor
      const range = quill.getSelection(true)
      const index = range ? range.index : quill.getLength() - 1
      
      // Usar insertEmbed con el Blot personalizado - este es el método más confiable
      try {
        const formulaData = { latex, displayMode: displayMode || false }
        quill.insertEmbed(index, 'mathFormula', formulaData, 'user')
        
        // Inmediatamente después de insertar, forzar renderizado
        const forceRenderAndProtect = () => {
          const root = quill.root
          const mathElements = root.querySelectorAll('[data-latex]')
          
          mathElements.forEach((el) => {
            const elLatex = el.getAttribute('data-latex')
            if (elLatex === latex) {
              // Verificar si tiene KaTeX o Unicode renderizado correctamente
              const hasKaTeX = el.querySelector('.katex') !== null
              const hasUnicode = el.querySelector('.math-unicode') !== null
              const hasValidContent = el.innerHTML && 
                                    (el.innerHTML.includes('katex') || el.innerHTML.includes('math-unicode')) && 
                                    el.innerHTML.includes('<span')
              
              // Si no está renderizado o parece ser texto plano, renderizarlo
              if ((!hasKaTeX && !hasUnicode) || !hasValidContent || el.innerHTML.trim() === '' || el.textContent === latex) {
                try {
                  const isDisplay = displayMode || 
                                   el.classList.contains('katex-display') || 
                                   el.tagName === 'DIV'
                  
                  // Guardar la posición en el DOM antes de modificar
                  const parent = el.parentNode
                  const nextSibling = el.nextSibling
                  
                  const htmlElForForceRender = el as HTMLElement
                  let renderizadoExitoso = false
                  
                  // Intentar con KaTeX primero
                  if (katex && typeof katex.render === 'function') {
                    try {
                      htmlElForForceRender.innerHTML = ''
                      katex.render(latex, htmlElForForceRender, {
                        throwOnError: false,
                        displayMode: isDisplay,
                        strict: false,
                      })
                      
                      const hasRenderedKaTeX = el.querySelector('.katex') !== null
                      if (hasRenderedKaTeX && el.innerHTML.trim() !== '') {
                        renderizadoExitoso = true
                      }
                    } catch (katexError) {
                      logger.warn('Error renderizando con KaTeX en forceRender:', katexError)
                    }
                  }
                  
                  // Si KaTeX falló, usar conversión a Unicode como fallback
                  if (!renderizadoExitoso) {
                    try {
                      const unicodeText = convertirLatexAUnicode(latex)
                      htmlElForForceRender.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
                      renderizadoExitoso = true
                    } catch (unicodeError) {
                      logger.warn('Error en conversión Unicode en forceRender:', unicodeError)
                    }
                  }
                  
                  if (renderizadoExitoso) {
                    el.classList.add('katex-formula')
                    el.setAttribute('contenteditable', 'false')
                    el.setAttribute('data-latex', latex) // Asegurar que el atributo esté presente
                    if (isDisplay) {
                      el.classList.add('katex-display')
                    }
                    
                    // Si Quill eliminó el elemento, volver a insertarlo
                    if (!parent || !parent.contains(el)) {
                      if (nextSibling && nextSibling.parentNode) {
                        nextSibling.parentNode.insertBefore(el, nextSibling)
                      } else if (parent) {
                        parent.appendChild(el)
                      }
                    }
                    
                    // Forzar que los estilos se apliquen (solo si es KaTeX)
                    if (el.querySelector('.katex')) {
                      const katexEl = el.querySelector('.katex')
                      if (katexEl) {
                        const htmlEl = katexEl as HTMLElement
                        htmlEl.style.display = isDisplay ? 'block' : 'inline-block'
                      }
                      
                      // Asegurar que elementos críticos se muestren
                      const criticalElements = el.querySelectorAll('.frac-line, .vlist-t, .vlist, .sqrt, .msupsub')
                      criticalElements.forEach((criticalEl: Element) => {
                        const htmlEl = criticalEl as HTMLElement
                        if (htmlEl.style) {
                          htmlEl.style.display = 'inline-block'
                        }
                      })
                    }
                  } else {
                    // Si falla el renderizado, mostrar el LaTeX como texto
                    el.textContent = latex
                  }
                } catch (error) {
                  logger.error('Error re-renderizando fórmula:', error, 'LaTeX:', latex)
                  el.textContent = latex
                }
              }
            }
          })
          
          // Actualizar el estado
          const newHtml = quill.root.innerHTML
          onChange(newHtml)
          
          // Mover cursor
          const newLength = quill.getLength()
          quill.setSelection(Math.min(index + 1, newLength - 1), 'user')
        }
        
        // Ejecutar inmediatamente y múltiples veces
        setTimeout(forceRenderAndProtect, 0)
        setTimeout(forceRenderAndProtect, 10)
        setTimeout(forceRenderAndProtect, 50)
        setTimeout(forceRenderAndProtect, 100)
        setTimeout(forceRenderAndProtect, 200)
        setTimeout(forceRenderAndProtect, 500)
        
      } catch (embedError) {
        logger.error('Error insertando fórmula con insertEmbed:', embedError)
        // Fallback: intentar con HTML directo usando katex.render() o Unicode
        try {
          // Crear un contenedor temporal para renderizar
          const tempContainer = document.createElement(displayMode ? 'div' : 'span')
          tempContainer.className = 'katex-formula'
          tempContainer.setAttribute('data-latex', latex)
          tempContainer.setAttribute('contenteditable', 'false')
          
          let renderizadoExitoso = false
          
          // Intentar con KaTeX primero
          if (katex && typeof katex.render === 'function') {
            try {
              katex.render(latex, tempContainer, {
                throwOnError: false,
                displayMode: displayMode || false,
                strict: false,
              })
              
              const hasKaTeX = tempContainer.querySelector('.katex') !== null
              if (hasKaTeX && tempContainer.innerHTML.trim() !== '') {
                renderizadoExitoso = true
              }
            } catch (katexError) {
              logger.warn('Error renderizando con KaTeX en fallback:', katexError)
            }
          }
          
          // Si KaTeX falló, usar conversión a Unicode
          if (!renderizadoExitoso) {
            try {
              const unicodeText = convertirLatexAUnicode(latex)
              tempContainer.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
              renderizadoExitoso = true
            } catch (unicodeError) {
              logger.warn('Error en conversión Unicode en fallback:', unicodeError)
            }
          }
          
          if (renderizadoExitoso) {
            if (displayMode) {
              tempContainer.classList.add('katex-display')
            }
            
            // Insertar el HTML renderizado
            quill.clipboard.dangerouslyPasteHTML(index, tempContainer.outerHTML, 'user')
            
            setTimeout(() => {
              const newHtml = quill.root.innerHTML
              onChange(newHtml)
            }, 100)
          } else {
            throw new Error('No se pudo renderizar la fórmula')
          }
        } catch (htmlError) {
          logger.error('Error en fallback HTML:', htmlError)
          insertText(`$${latex}$`)
        }
      }
    }

    const insertText = (text: string) => {
      const quill = quillRef.current?.getEditor()
      if (quill) {
        // Obtener la posición actual del cursor o usar el final si no hay selección
        const range = quill.getSelection()
        const index = range ? range.index : quill.getLength() - 1
        
        // Insertar el texto
        quill.insertText(index, text, 'user')
        
        // Mover el cursor después del texto insertado
        quill.setSelection(index + text.length)
        
        // Disparar el evento onChange manualmente para actualizar el estado
        const html = quill.root.innerHTML
        onChange(html)
      }
    }


    useImperativeHandle(ref, () => ({
      insertText: insertText,
      insertHTML: insertHTML,
      insertMathFormula: insertMathFormula
    }))

    const modules = useMemo(() => {
      let toolbarConfig = baseToolbar
      if (minimalToolbar) {
        toolbarConfig = minimalToolbarConfig
      } else if (simplifiedToolbar) {
        toolbarConfig = simplifiedToolbarConfig
      }
      
      return {
        toolbar: {
          container: toolbarConfig,
          handlers: {
            math: () => {
              setMathEditorOpen(true)
            }
          }
        },
        clipboard: { 
          matchVisual: false,
          // Deshabilitar la sanitización de HTML para preservar fórmulas
          sanitize: false
        }
      }
    }, [simplifiedToolbar, minimalToolbar])

    // Efecto para renderizar fórmulas cuando se carga el contenido y protegerlas
    useEffect(() => {
      const quill = quillRef.current?.getEditor()
      if (!quill) return

      // Función para renderizar una fórmula individual
      const renderFormula = (el: Element): boolean => {
        const latex = el.getAttribute('data-latex')
        if (!latex) return false

        // Verificar si ya tiene contenido renderizado de KaTeX
        const hasKaTeX = el.querySelector('.katex') || 
                        el.classList.contains('katex') ||
                        (el.innerHTML && el.innerHTML.includes('katex') && el.innerHTML.includes('<span'))
        
        // Si no tiene KaTeX renderizado o el contenido está vacío, renderizar
        if (!hasKaTeX || el.innerHTML.trim() === '' || el.textContent === latex) {
          try {
            // Determinar si es modo display basado en el elemento o la clase
            const htmlEl = el as HTMLElement
            const isDisplay = el.classList.contains('katex-display') || 
                             el.tagName === 'DIV' ||
                             (htmlEl.style && htmlEl.style.display === 'block')
            
            let renderizadoExitoso = false
            
            // Intentar con KaTeX primero
            if (katex && typeof katex.render === 'function') {
              try {
                // Limpiar el contenido y renderizar directamente con katex.render()
                htmlEl.innerHTML = ''
                katex.render(latex, htmlEl, {
                  throwOnError: false,
                  displayMode: isDisplay,
                  strict: false,
                })
                
                // Verificar que el renderizado fue exitoso
                const hasRenderedKaTeX = el.querySelector('.katex') !== null
                if (hasRenderedKaTeX && el.innerHTML.trim() !== '') {
                  renderizadoExitoso = true
                }
              } catch (katexError) {
                logger.warn('Error renderizando con KaTeX:', katexError)
              }
            }
            
            // Si KaTeX falló, usar conversión a Unicode como fallback
            if (!renderizadoExitoso) {
              try {
                const unicodeText = convertirLatexAUnicode(latex)
                htmlEl.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
                renderizadoExitoso = true
              } catch (unicodeError) {
                logger.warn('Error en conversión Unicode:', unicodeError)
              }
            }
            
            if (renderizadoExitoso) {
              el.classList.add('katex-formula')
              el.setAttribute('contenteditable', 'false')
              if (isDisplay) {
                el.classList.add('katex-display')
              }
              
              // Asegurarse de que todos los elementos críticos se muestren (solo si es KaTeX)
              if (el.querySelector('.katex')) {
                setTimeout(() => {
                  const katexElements = el.querySelectorAll('.katex')
                  katexElements.forEach((katexEl: Element) => {
                    const htmlEl = katexEl as HTMLElement
                    if (htmlEl.style) {
                      htmlEl.style.display = isDisplay ? 'block' : 'inline-block'
                    }
                  })
                  
                  // Asegurar que fracciones, raíces, superíndices, subíndices se muestren
                  const criticalElements = el.querySelectorAll('.frac-line, .vlist-t, .vlist, .vlist-r, .sqrt, .msupsub, .mord, .mop, .mbin, .mrel')
                  criticalElements.forEach((criticalEl: Element) => {
                    const htmlEl = criticalEl as HTMLElement
                    if (htmlEl.style) {
                      htmlEl.style.display = 'inline-block'
                    }
                  })
                }, 0)
              }
              
              return true
            } else {
              logger.warn('No se pudo renderizar la fórmula:', latex)
              el.textContent = latex
              return false
            }
          } catch (error) {
            logger.error('Error renderizando fórmula:', error, 'LaTeX:', latex)
            // Si falla, mostrar el LaTeX como texto
            el.textContent = latex
            return false
          }
        }
        return false
      }

      // Función para renderizar todas las fórmulas
      const renderFormulas = () => {
        const root = quill.root
        const mathElements = root.querySelectorAll('[data-latex]')
        let needsUpdate = false
        
        mathElements.forEach((el) => {
          if (renderFormula(el)) {
            needsUpdate = true
          }
        })
        
        // Si se actualizó algo, disparar onChange
        if (needsUpdate) {
          setTimeout(() => {
            const newHtml = quill.root.innerHTML
            onChange(newHtml)
          }, 10)
        }
      }

      // MutationObserver más agresivo para proteger las fórmulas
      let renderTimeout: NodeJS.Timeout | null = null
      const observer = new MutationObserver(() => {
        // Cancelar timeout anterior si existe
        if (renderTimeout) {
          clearTimeout(renderTimeout)
        }
        
        // Ejecutar renderizado después de un breve delay
        renderTimeout = setTimeout(() => {
          let needsRender = false
          
          // Buscar todas las fórmulas y verificar que estén renderizadas
          const allMathElements = quill.root.querySelectorAll('[data-latex]')
          allMathElements.forEach((el) => {
            const latex = el.getAttribute('data-latex')
            if (latex) {
              const hasKaTeX = el.querySelector('.katex') !== null
              
              // Si no tiene KaTeX o el contenido parece ser texto plano, renderizar
              if (!hasKaTeX || 
                  el.innerHTML.trim() === '' || 
                  el.textContent === latex ||
                  (el.innerHTML && !el.innerHTML.includes('katex'))) {
                if (renderFormula(el)) {
                  needsRender = true
                }
              }
            }
          })
          
          if (needsRender) {
            const newHtml = quill.root.innerHTML
            onChange(newHtml)
          }
        }, 50)
      })
      
      // Observar cambios en el editor de Quill de manera más agresiva
      observer.observe(quill.root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-latex', 'contenteditable', 'class'],
        characterData: true, // Observar cambios en el contenido de texto también
        characterDataOldValue: true
      })
      
      // Ejecutar renderizado inicial
      setTimeout(renderFormulas, 0)
      setTimeout(renderFormulas, 100)
      setTimeout(renderFormulas, 300)
      
      // Limpiar observer al desmontar
      return () => {
        observer.disconnect()
      }
    }, [value, onChange])

    // Añadir estilos personalizados para los botones de la toolbar y fórmulas
    useMemo(() => {
      const styleId = `rich-text-editor-math-toolbar-styles-${theme}`
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
      
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        ${theme === 'dark' ? `
        .ql-toolbar {
          background-color: #27272a !important;
          border-color: #3f3f46 !important;
        }
        .ql-toolbar .ql-stroke {
          stroke: #e4e4e7 !important;
        }
        .ql-toolbar .ql-fill {
          fill: #e4e4e7 !important;
        }
        .ql-toolbar button:hover,
        .ql-toolbar button:focus,
        .ql-toolbar button.ql-active {
          background-color: #3f3f46 !important;
        }
        .ql-toolbar .ql-picker-label {
          color: #e4e4e7 !important;
        }
        .ql-toolbar .ql-picker-options {
          background-color: #27272a !important;
          border-color: #3f3f46 !important;
        }
        .ql-toolbar .ql-picker-item {
          color: #e4e4e7 !important;
        }
        .ql-toolbar .ql-picker-item:hover {
          background-color: #3f3f46 !important;
        }
        .ql-container {
          background-color: #18181b !important;
          color: #e4e4e7 !important;
        }
        .ql-editor {
          background-color: #18181b !important;
          color: #e4e4e7 !important;
        }
        .ql-editor.ql-blank::before {
          color: #71717a !important;
        }
        .ql-snow .ql-stroke {
          stroke: #e4e4e7 !important;
        }
        .ql-snow .ql-fill {
          fill: #e4e4e7 !important;
        }
        .ql-snow .ql-picker {
          color: #e4e4e7 !important;
        }
        ` : ''}
        .ql-toolbar .ql-math::before {
          content: "f(x)";
          font-weight: bold;
          font-size: 14px;
        }
        .ql-toolbar .ql-calc::before {
          content: "∑";
          font-weight: bold;
          font-size: 14px;
        }
        .ql-toolbar button.ql-math {
          width: 28px;
          height: 24px;
        }
        .ql-toolbar button.ql-calc {
          width: 28px;
          height: 24px;
        }
        .ql-toolbar button.ql-math:hover::before {
          opacity: 0.7;
        }
        .ql-toolbar button.ql-calc:hover::before {
          opacity: 0.7;
        }
        /* Estilos para fórmulas matemáticas */
        .ql-editor .katex-formula {
          display: inline-block !important;
          margin: 0 2px;
          vertical-align: middle;
          position: relative;
        }
        .ql-editor .katex-formula.katex-display {
          display: block !important;
          margin: 1em 0;
          text-align: center;
        }
        /* Estilos críticos para KaTeX - asegurar que todos los elementos se muestren */
        .ql-editor .katex {
          font-size: 1.25em !important;
          line-height: 1.2 !important;
          display: inline-block !important;
          vertical-align: middle !important;
        }
        .ql-editor .katex-display .katex {
          font-size: 1.4em !important;
          line-height: 1.25 !important;
          display: block !important;
        }
        /* Proteger elementos de KaTeX de ser modificados */
        .ql-editor .katex-formula * {
          pointer-events: none;
        }
        /* Asegurar que las fracciones, raíces, superíndices y subíndices se muestren */
        .ql-editor .katex .frac-line {
          display: inline-block !important;
          border-bottom-style: solid !important;
          border-bottom-width: 0.04em !important;
          min-height: 0.04em !important;
        }
        .ql-editor .katex .vlist-t {
          display: inline-block !important;
          vertical-align: baseline !important;
        }
        .ql-editor .katex .vlist {
          display: inline-block !important;
          vertical-align: baseline !important;
        }
        .ql-editor .katex .vlist-r {
          display: block !important;
        }
        .ql-editor .katex .sqrt {
          display: inline-block !important;
        }
        .ql-editor .katex .sqrt > .vlist-t {
          display: inline-block !important;
        }
        .ql-editor .katex .msupsub {
          display: inline-block !important;
        }
        .ql-editor .katex .mord {
          display: inline-block !important;
        }
        .ql-editor .katex .mop {
          display: inline-block !important;
        }
        .ql-editor .katex .mbin {
          display: inline-block !important;
        }
        .ql-editor .katex .mrel {
          display: inline-block !important;
        }
        .ql-editor .katex .mopen,
        .ql-editor .katex .mclose {
          display: inline-block !important;
        }
        /* Asegurar que las fórmulas no se puedan editar directamente */
        .ql-editor .katex-formula[contenteditable="false"] {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
        /* Prevenir que Quill modifique el contenido de KaTeX */
        .ql-editor .katex-formula {
          white-space: normal !important;
        }
        /* Estilos para fórmulas renderizadas con Unicode */
        .ql-editor .math-unicode {
          font-family: 'Times New Roman', 'STIX Two Math', 'Cambria Math', serif !important;
          font-style: italic !important;
          display: inline-block !important;
          margin: 0 2px !important;
          vertical-align: middle !important;
          white-space: nowrap !important;
        }
        .ql-editor .katex-formula .math-unicode {
          font-size: 1.1em !important;
        }
        /* Estilos para fracciones Unicode */
        .ql-editor .math-unicode {
          font-variant-numeric: normal !important;
        }
        /* Asegurar que el carácter de fracción se vea bien */
        .ql-editor .math-unicode::before,
        .ql-editor .math-unicode::after {
          content: none !important;
        }
      `
      document.head.appendChild(style)
      
      return () => {
        const existingStyle = document.getElementById(styleId)
        if (existingStyle) {
          document.head.removeChild(existingStyle)
        }
      }
    }, [theme])

    // Wrapper para onChange que restaura fórmulas antes de guardar
    const handleChange = (html: string) => {
      // Si no hay Quill disponible, llamar onChange directamente
      const quill = quillRef.current?.getEditor()
      if (!quill) {
        onChange(html)
        return
      }
      
      // Primero, detectar y convertir texto LaTeX en el contenido
      const processedHtml = detectarYConvertirLatexEnTexto(html)
      
      // Crear un elemento temporal para procesar el HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = processedHtml
      
      // Buscar todas las fórmulas y asegurar que estén renderizadas
      const mathElements = tempDiv.querySelectorAll('[data-latex]')
      let needsUpdate = false
      
      mathElements.forEach((el) => {
        const latex = el.getAttribute('data-latex')
        if (latex) {
          // Verificar si está renderizado
          const hasKaTeX = el.querySelector('.katex') !== null
          const hasUnicode = el.querySelector('.math-unicode') !== null
          const hasValidContent = (el.innerHTML && 
                                (el.innerHTML.includes('katex') || el.innerHTML.includes('math-unicode')) && 
                                el.innerHTML.includes('<span'))
          
          // Si no está renderizado o es texto plano, renderizarlo
          if ((!hasKaTeX && !hasUnicode) || !hasValidContent || el.innerHTML.trim() === '' || el.textContent === latex) {
            try {
              const isDisplay = el.classList.contains('katex-display') || el.tagName === 'DIV'
              const htmlElForOnChange = el as HTMLElement
              let renderizadoExitoso = false
              
              // Intentar con KaTeX primero
              if (katex && typeof katex.render === 'function') {
                try {
                  htmlElForOnChange.innerHTML = ''
                  katex.render(latex, htmlElForOnChange, {
                    throwOnError: false,
                    displayMode: isDisplay,
                    strict: false,
                  })
                  
                  const hasRenderedKaTeX = el.querySelector('.katex') !== null
                  if (hasRenderedKaTeX && el.innerHTML.trim() !== '') {
                    renderizadoExitoso = true
                  }
                } catch (katexError) {
                  logger.warn('Error renderizando con KaTeX en onChange:', katexError)
                }
              }
              
              // Si KaTeX falló, usar conversión a Unicode como fallback
              if (!renderizadoExitoso) {
                try {
                  const unicodeText = convertirLatexAUnicode(latex)
                  htmlElForOnChange.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
                  renderizadoExitoso = true
                } catch (unicodeError) {
                  logger.warn('Error en conversión Unicode en onChange:', unicodeError)
                }
              }
              
              if (renderizadoExitoso) {
                el.classList.add('katex-formula')
                el.setAttribute('contenteditable', 'false')
                if (isDisplay) {
                  el.classList.add('katex-display')
                }
                needsUpdate = true
              } else {
                el.textContent = latex
              }
            } catch (error) {
              logger.error('Error renderizando fórmula en onChange:', error)
              el.textContent = latex
            }
          }
        }
      })
      
      // Si se actualizó algo, usar el HTML procesado
      const finalHtml = needsUpdate ? tempDiv.innerHTML : processedHtml
      
      // Actualizar el DOM de Quill si es necesario
      if (needsUpdate) {
        setTimeout(() => {
          const quillRoot = quill.root
          const quillMathElements = quillRoot.querySelectorAll('[data-latex]')
          quillMathElements.forEach((el) => {
            const latex = el.getAttribute('data-latex')
            if (latex) {
              const hasKaTeX = el.querySelector('.katex') !== null
              const hasUnicode = el.querySelector('.math-unicode') !== null
              if ((!hasKaTeX && !hasUnicode) || el.innerHTML.trim() === '' || el.textContent === latex) {
                try {
                  const isDisplay = el.classList.contains('katex-display') || el.tagName === 'DIV'
                  const htmlElForDOMUpdate = el as HTMLElement
                  let renderizadoExitoso = false
                  
                  // Intentar con KaTeX primero
                  if (katex && typeof katex.render === 'function') {
                    try {
                      htmlElForDOMUpdate.innerHTML = ''
                      katex.render(latex, htmlElForDOMUpdate, {
                        throwOnError: false,
                        displayMode: isDisplay,
                        strict: false,
                      })
                      
                      const hasRenderedKaTeX = el.querySelector('.katex') !== null
                      if (hasRenderedKaTeX && el.innerHTML.trim() !== '') {
                        renderizadoExitoso = true
                      }
                    } catch (katexError) {
                      logger.warn('Error renderizando con KaTeX en DOM:', katexError)
                    }
                  }
                  
                  // Si KaTeX falló, usar conversión a Unicode como fallback
                  if (!renderizadoExitoso) {
                    try {
                      const unicodeText = convertirLatexAUnicode(latex)
                      htmlElForDOMUpdate.innerHTML = `<span class="math-unicode" style="font-family: 'Times New Roman', serif; font-style: italic;">${unicodeText}</span>`
                      renderizadoExitoso = true
                    } catch (unicodeError) {
                      logger.warn('Error en conversión Unicode en DOM:', unicodeError)
                    }
                  }
                  
                  if (renderizadoExitoso) {
                    el.classList.add('katex-formula')
                    el.setAttribute('contenteditable', 'false')
                    if (isDisplay) {
                      el.classList.add('katex-display')
                    }
                  } else {
                    el.textContent = latex
                  }
                } catch (error) {
                  logger.error('Error renderizando en DOM:', error)
                  el.textContent = latex
                }
              }
            }
          })
        }, 0)
      }
      
      // Llamar al onChange con el HTML procesado
      onChange(finalHtml)
    }

    return (
      <>
        <style>{`
          /* Cambiar el color del cursor de texto (caret) a negro para que sea visible en fondos blancos */
          .ql-editor {
            caret-color: #000000 !important;
          }
          
          /* Para modo oscuro, usar color blanco */
          .dark .ql-editor {
            caret-color: #ffffff !important;
          }
          
          /* Asegurar que el cursor sea visible en todos los casos */
          .ql-editor:focus {
            caret-color: #000000 !important;
          }
          
          .dark .ql-editor:focus {
            caret-color: #ffffff !important;
          }
          
          /* También cambiar el color de selección de texto para mejor visibilidad */
          .ql-editor ::selection {
            background-color: rgba(0, 123, 255, 0.3) !important;
            color: inherit !important;
          }
          
          .ql-editor ::-moz-selection {
            background-color: rgba(0, 123, 255, 0.3) !important;
            color: inherit !important;
          }
        `}</style>
        <div className={className}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            modules={modules}
            formats={minimalToolbar ? minimalFormats : (simplifiedToolbar ? simplifiedFormats : baseFormats)}
          />
          
          <MathEditor
            open={mathEditorOpen}
            onOpenChange={setMathEditorOpen}
            onInsert={insertMathFormula}
          />
        </div>
      </>
    )
  }
)

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
