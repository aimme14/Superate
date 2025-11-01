declare module 'mathlive'

declare global {
  interface MathfieldElement extends HTMLElement {
    getValue: (format?: string) => string
  }

  namespace JSX {
    interface IntrinsicElements {
      'math-field': any
    }
  }
}

export {}


