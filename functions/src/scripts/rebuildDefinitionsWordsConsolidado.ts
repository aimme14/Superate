/**
 * Reconstruye documentos consolidados de definitionswords por materia (slug) a partir de:
 *   definitionswords/{materia}/palabras/{id}
 *
 * Salida en la raíz de definitionswords:
 *   definitionswords/consolidado_{materia}[, _2, _3…]
 *   { items: [{ id, palabra, definicion, materia, activa, fechaCreacion, version, ... }], partIndex?, totalParts?, rebuiltAt }
 *
 * Ignora rutas cuyo segmento materia empiece por consolidado_.
 *
 * Uso (desde la carpeta functions):
 *   npm run rebuild-definitionswords-consolidado
 *
 * Credenciales: igual que deleteExamples (serviceAccountKey.json en functions/ o ADC).
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import * as admin from 'firebase-admin'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'

const FIRESTORE_MAX_DOC_BYTES = 1_048_576
const SIZE_SAFETY_MARGIN_BYTES = 72_000
const MAX_CONSOLIDATED_DOC_BYTES =
  FIRESTORE_MAX_DOC_BYTES - SIZE_SAFETY_MARGIN_BYTES

const CONSOLIDADO_ID_PREFIX = 'consolidado_'
const COLLECTION = 'definitionswords'

function initAdmin(): void {
  if (admin.apps.length) return
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json')
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    )
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    })
    console.log('✅ Firebase Admin inicializado con credenciales locales')
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
    console.log('✅ Firebase Admin inicializado con credenciales por defecto')
  }
}

function isTimestamp(v: unknown): v is Timestamp {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Timestamp).toMillis === 'function' &&
    'seconds' in (v as Timestamp)
  )
}

function jsonUtf8Bytes(value: unknown): number {
  const json = JSON.stringify(value, (_key, v) => {
    if (isTimestamp(v)) {
      return { seconds: v.seconds, nanoseconds: v.nanoseconds }
    }
    return v
  })
  return Buffer.byteLength(json, 'utf8')
}

const ESTIMATE_TOTAL_PARTS_FOR_SIZE = 999

function estimateConsolidatedDocBytes(
  items: DocumentData[],
  partIndex: number,
  totalPartsForSize: number = ESTIMATE_TOTAL_PARTS_FOR_SIZE
): number {
  const doc = {
    items,
    partIndex,
    totalParts: totalPartsForSize,
    rebuiltAt: Timestamp.now(),
  }
  return jsonUtf8Bytes(doc)
}

function splitItemsIntoChunks(items: DocumentData[]): DocumentData[][] {
  if (items.length === 0) {
    return [[]]
  }

  const chunks: DocumentData[][] = []
  let current: DocumentData[] = []

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current)
      current = []
    }
  }

  for (const item of items) {
    const tryItems = [...current, item]
    const sizeIfAppend = estimateConsolidatedDocBytes(tryItems, chunks.length)

    if (sizeIfAppend <= MAX_CONSOLIDATED_DOC_BYTES) {
      current.push(item)
      continue
    }

    if (current.length > 0) {
      flush()
      const sizeSingleNew = estimateConsolidatedDocBytes([item], chunks.length)
      if (sizeSingleNew > MAX_CONSOLIDATED_DOC_BYTES) {
        const approx = Math.ceil(sizeSingleNew / 1024)
        throw new Error(
          `Una sola palabra supera el tamaño máximo permitido (~${approx} KiB JSON).`
        )
      }
      current.push(item)
    } else {
      const approx = Math.ceil(sizeIfAppend / 1024)
      throw new Error(
        `Una sola palabra supera el tamaño máximo permitido (~${approx} KiB JSON).`
      )
    }
  }

  flush()
  return chunks
}

function normalizeWordItem(docId: string, data: DocumentData): DocumentData {
  const item: DocumentData = {
    id: docId,
    palabra: data.palabra ?? '',
    definicion: data.definicion ?? '',
    materia: data.materia ?? '',
    activa: data.activa !== false,
    fechaCreacion: data.fechaCreacion ?? null,
    version: typeof data.version === 'number' ? data.version : 1,
  }
  if (data.ejemploIcfes) item.ejemploIcfes = data.ejemploIcfes
  if (data.respuestaEjemploIcfes) {
    item.respuestaEjemploIcfes = data.respuestaEjemploIcfes
  }
  return item
}

function consolidadoDocId(materiaSlug: string, partIndex: number): string {
  if (partIndex === 0) {
    return `${CONSOLIDADO_ID_PREFIX}${materiaSlug}`
  }
  return `${CONSOLIDADO_ID_PREFIX}${materiaSlug}_${partIndex + 1}`
}

async function rebuildDefinitionsWordsConsolidado(): Promise<void> {
  initAdmin()
  const db = admin.firestore()
  const rootCol = db.collection(COLLECTION)

  const byMateria: Record<string, DocumentData[]> = {}

  const palabrasSnap = await db.collectionGroup('palabras').get()
  console.log(`🔎 collectionGroup('palabras'): ${palabrasSnap.docs.length} doc(s)`)

  for (const pDoc of palabrasSnap.docs) {
    const pathSegs = pDoc.ref.path.split('/')
    // definitionswords/{materia}/palabras/{id}
    if (pathSegs.length !== 4) continue
    if (pathSegs[0] !== COLLECTION) continue
    if (pathSegs[2] !== 'palabras') continue

    const materiaSlug = pathSegs[1]
    if (materiaSlug.startsWith(CONSOLIDADO_ID_PREFIX)) {
      continue
    }

    const raw = pDoc.data()
    const item = normalizeWordItem(pDoc.id, raw)
    if (!byMateria[materiaSlug]) {
      byMateria[materiaSlug] = []
    }
    byMateria[materiaSlug].push(item)
  }

  const materiaKeys = Object.keys(byMateria).sort((a, b) =>
    a.localeCompare(b, 'es')
  )
  for (const slug of materiaKeys) {
    byMateria[slug].sort((a, b) => {
      const pa = String(a.palabra ?? '')
      const pb = String(b.palabra ?? '')
      if (pa !== pb) return pa.localeCompare(pb, 'es')
      return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'es')
    })
  }

  const rootSnap = await rootCol.get()
  const existingConsolidados = rootSnap.docs.filter((d) =>
    d.id.startsWith(CONSOLIDADO_ID_PREFIX)
  )

  const ops: Array<{
    kind: 'delete' | 'set'
    ref: DocumentReference
    data?: DocumentData
  }> = []

  for (const d of existingConsolidados) {
    ops.push({ kind: 'delete', ref: d.ref })
  }

  const chunksByMateria: Record<string, DocumentData[][]> = {}
  for (const slug of materiaKeys) {
    chunksByMateria[slug] = splitItemsIntoChunks(byMateria[slug])
  }

  for (const slug of materiaKeys) {
    const chunks = chunksByMateria[slug]
    const totalParts = chunks.length

    for (let i = 0; i < chunks.length; i++) {
      const docId = consolidadoDocId(slug, i)
      ops.push({
        kind: 'set',
        ref: rootCol.doc(docId),
        data: {
          items: chunks[i],
          partIndex: i,
          totalParts,
          rebuiltAt: FieldValue.serverTimestamp(),
        },
      })
    }
  }

  const BATCH_MAX = 500
  for (let i = 0; i < ops.length; i += BATCH_MAX) {
    const slice = ops.slice(i, i + BATCH_MAX)
    const batch = db.batch()
    for (const op of slice) {
      if (op.kind === 'delete') {
        batch.delete(op.ref)
      } else {
        batch.set(op.ref, op.data!)
      }
    }
    await batch.commit()
  }

  for (const slug of materiaKeys) {
    const n = byMateria[slug].length
    const chunks = chunksByMateria[slug]
    const ids = chunks.map((_, i) => consolidadoDocId(slug, i))
    console.log(
      `✅ definitionswords ${slug}: ${n} palabra(s) en ${chunks.length} doc(s) [${ids.join(', ')}]`
    )
  }

  if (materiaKeys.length === 0) {
    console.log('ℹ️ No se encontraron palabras en subcolecciones palabras; solo se eliminaron consolidados previos.')
  }
}

async function main(): Promise<void> {
  await rebuildDefinitionsWordsConsolidado()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
