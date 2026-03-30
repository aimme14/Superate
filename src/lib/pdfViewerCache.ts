/**
 * Caché persistente de PDFs del visor (IndexedDB).
 * Evita repetir descargas desde Firebase Storage para la misma clave.
 * Se vacía al cerrar sesión (`clearPersistedCache`) o al borrar datos del sitio.
 */

const DB_NAME = 'superate-pdf-viewer-cache'
const DB_VERSION = 1
const STORE = 'blobs'

interface CachedPdfRecord {
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        dbPromise = null
        reject(new Error('indexedDB unavailable'))
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => {
        dbPromise = null
        reject(req.error ?? new Error('indexedDB open failed'))
      }
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      }
    })
  }
  return dbPromise
}

/** Clave estable por simulacro + tipo de PDF. */
export function pdfCacheKeySimulacro(simulacroId: string, tipo: string): string {
  return `s:${simulacroId}:${tipo}`
}

/** Clave por URL completa (si cambia el token de descarga, es otra entrada). */
export function pdfCacheKeyUrl(pdfUrl: string): string {
  return `u:${simpleHash(pdfUrl)}`
}

function simpleHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

export async function getCachedPdfBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(key)
      r.onsuccess = () => {
        const row = r.result as CachedPdfRecord | undefined
        resolve(row?.blob instanceof Blob ? row.blob : null)
      }
      r.onerror = () => reject(r.error)
    })
  } catch {
    return null
  }
}

export async function setCachedPdfBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ blob } satisfies CachedPdfRecord, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // quota, modo privado, idb deshabilitado
  }
}

/** Borra todos los PDFs en caché (logout / limpieza explícita). */
export async function clearPdfViewerCache(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}
