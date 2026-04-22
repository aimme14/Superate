/**
 * PDF.js: worker servido con el propio build (Vite), sin unpkg ni tercera capa de red.
 * Debe importarse antes de renderizar <Document> de react-pdf.
 */
import { pdfjs } from 'react-pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjs }
