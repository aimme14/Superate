import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { simulacrosService } from '@/services/firebase/simulacros.service'

// Worker de PDF.js (sin esto el PDF no carga)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

/** Tipos de PDF que se pueden abrir en el visor (por ID de simulacro + tipo) */
const PDF_TIPO_KEYS = [
  'documento',
  'hoja',
  'documento2',
  'hoja2',
  'icfes1doc',
  'icfes1hoja',
  'icfes2doc',
  'icfes2hoja',
] as const
type PdfTipo = (typeof PDF_TIPO_KEYS)[number]

function getPdfUrlFromSimulacro(
  data: {
    pdfSimulacroUrl?: string
    pdfHojaRespuestasUrl?: string
    pdfSimulacroSeccion2Url?: string
    pdfHojaRespuestasSeccion2Url?: string
    icfes?: Record<string, string | undefined>
  },
  tipo: PdfTipo
): string | null {
  switch (tipo) {
    case 'documento':
      return data.pdfSimulacroUrl || null
    case 'hoja':
      return data.pdfHojaRespuestasUrl || null
    case 'documento2':
      return data.pdfSimulacroSeccion2Url || null
    case 'hoja2':
      return data.pdfHojaRespuestasSeccion2Url || null
    case 'icfes1doc':
      return data.icfes?.seccion1DocumentoUrl || null
    case 'icfes1hoja':
      return data.icfes?.seccion1HojaUrl || null
    case 'icfes2doc':
      return data.icfes?.seccion2DocumentoUrl || null
    case 'icfes2hoja':
      return data.icfes?.seccion2HojaUrl || null
    default:
      return null
  }
}

export default function ViewerPdfPage() {
  const [searchParams] = useSearchParams()
  const simulacroId = searchParams.get('simulacroId')
  const tipo = searchParams.get('tipo') as PdfTipo | null
  const urlParam = searchParams.get('url')

  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loadingFetch, setLoadingFetch] = useState(true)

  const pdfUrl = useMemo(() => {
    if (urlParam) {
      try {
        return decodeURIComponent(urlParam)
      } catch {
        return urlParam
      }
    }
    return null
  }, [urlParam])

  // Si tenemos simulacroId + tipo, obtener la URL desde Firestore (evita URLs largas/truncadas en la barra)
  useEffect(() => {
    if (simulacroId && tipo && PDF_TIPO_KEYS.includes(tipo)) {
      setLoadingFetch(true)
      setError(null)
      setPdfBlob(null)
      simulacrosService
        .getById(simulacroId)
        .then((res) => {
          if (!res.success || !res.data) {
            setError('Simulacro no encontrado.')
            return
          }
          const url = getPdfUrlFromSimulacro(
            {
              pdfSimulacroUrl: res.data.pdfSimulacroUrl,
              pdfHojaRespuestasUrl: res.data.pdfHojaRespuestasUrl,
              pdfSimulacroSeccion2Url: res.data.pdfSimulacroSeccion2Url,
              pdfHojaRespuestasSeccion2Url: res.data.pdfHojaRespuestasSeccion2Url,
              icfes: res.data.icfes
                ? {
                    seccion1DocumentoUrl: res.data.icfes.seccion1DocumentoUrl,
                    seccion1HojaUrl: res.data.icfes.seccion1HojaUrl,
                    seccion2DocumentoUrl: res.data.icfes.seccion2DocumentoUrl,
                    seccion2HojaUrl: res.data.icfes.seccion2HojaUrl,
                  }
                : undefined,
            },
            tipo
          )
          if (!url) {
            setError('Este PDF no está disponible para este simulacro.')
            return
          }
          return fetch(url, { mode: 'cors' })
        })
        .then((fetchRes) => {
          if (!fetchRes) return
          if (!fetchRes.ok) throw new Error(`Error ${fetchRes.status}`)
          return fetchRes.blob()
        })
        .then((blob) => {
          if (blob) {
            setPdfBlob(blob)
            setError(null)
          }
        })
        .catch((err) => {
          const msg = err?.message ?? ''
          if (msg.includes('400')) {
            setError('El servidor rechazó la petición (400). Revisa el archivo en Firebase Storage.')
          } else if (msg.includes('403') || msg.includes('CORS')) {
            setError('No se pudo cargar el PDF. Comprueba permisos (CORS) del bucket.')
          } else {
            setError('No se pudo cargar el PDF. Comprueba la conexión.')
          }
        })
        .finally(() => setLoadingFetch(false))
      return
    }
    if (pdfUrl) {
      setLoadingFetch(true)
      setError(null)
      setPdfBlob(null)
      fetch(pdfUrl, { mode: 'cors' })
        .then((res) => {
          if (!res.ok) throw new Error(`Error ${res.status}`)
          return res.blob()
        })
        .then((blob) => {
          setPdfBlob(blob)
          setError(null)
        })
        .catch((err) => {
          const msg = err?.message ?? ''
          if (msg.includes('400')) setError('El servidor rechazó la petición (400).')
          else if (msg.includes('403') || msg.includes('CORS')) setError('No se pudo cargar el PDF (permisos/CORS).')
          else setError('No se pudo cargar el PDF.')
        })
        .finally(() => setLoadingFetch(false))
      return
    }
    setLoadingFetch(false)
    if (!simulacroId || !tipo) setError('Falta el enlace al documento. Usa el listado de simulacros.')
  }, [simulacroId, tipo, pdfUrl])

  const file = useMemo(() => (pdfBlob ? pdfBlob : null), [pdfBlob])

  useEffect(() => {
    if (!simulacroId && !tipo && !urlParam) setError('Falta la URL o el documento. Usa el listado de simulacros.')
  }, [simulacroId, tipo, urlParam])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
  }

  const onDocumentLoadError = () => {
    setError('No se pudo cargar el PDF. Comprueba la URL o los permisos (CORS).')
  }

  if (!simulacroId && !tipo && !urlParam) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center text-gray-600">
          <p className="font-medium">Falta el enlace al documento.</p>
          <p className="text-sm mt-1">Abre el PDF desde el listado de simulacros.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.close()}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  if (error && !pdfBlob && !loadingFetch) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center text-red-600 max-w-md">
          <p className="font-medium">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.close()}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  if (loadingFetch || !pdfBlob) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center text-gray-500">Cargando documento…</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barra mínima: solo navegación, zoom y cerrar. Sin descargar ni imprimir */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 min-w-[80px] text-center">
            {pageNumber} / {numPages || '–'}
          </span>
          <Button
            variant="secondary"
            size="icon"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="secondary"
              size="icon"
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="secondary"
              size="icon"
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-200" onClick={() => window.close()}>
          <X className="h-4 w-4 mr-1" />
          Cerrar
        </Button>
      </div>

      {/* Contenido: solo el PDF */}
      <div className="flex-1 overflow-auto flex justify-center p-4">
        {error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center py-16 text-gray-500">
                Preparando páginas…
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer
              className={cn('shadow')}
            />
          </Document>
        )}
      </div>
    </div>
  )
}
