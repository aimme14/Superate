/**
 * Reconstruye documentos consolidados de YoutubeLinks por materia a partir de:
 *   YoutubeLinks/{grado}/{materia}/{topic}/videos/{id}
 *
 * Por cada materia (BI, CS, FI, IN, LE, MA, QU) se agregan todos los videos
 * de todos los grados y topics en una lista plana:
 *   { items: [...], partIndex?, totalParts?, rebuiltAt }
 *
 * Cada item incluye: topic (código corto), title, url, description, channelTitle,
 * videoId, duration, language, materia, createdAt cuando exista.
 *
 * Partición: consolidado_MA, consolidado_MA_2, consolidado_MA_3… si supera ~1 MiB.
 * Ignora paths cuyo segmento empiece por consolidado_ al recorrer.
 *
 * Uso (desde la carpeta functions):
 *   npm run rebuild-youtubelinks-consolidado
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import { getStudentDatabase } from '../utils/firestoreHelpers'

const FIRESTORE_MAX_DOC_BYTES = 1_048_576
const SIZE_SAFETY_MARGIN_BYTES = 72_000
const MAX_CONSOLIDATED_DOC_BYTES =
  FIRESTORE_MAX_DOC_BYTES - SIZE_SAFETY_MARGIN_BYTES

const CONSOLIDADO_ID_PREFIX = 'consolidado_'
const SUBJECT_CODES = ['BI', 'CS', 'FI', 'IN', 'LE', 'MA', 'QU'] as const
const YOUTUBE_LINKS_COLLECTION = 'YoutubeLinks'

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
          `Un solo video supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
        )
      }
      current.push(item)
    } else {
      const approx = Math.ceil(sizeIfAppend / 1024)
      throw new Error(
        `Un solo video supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
      )
    }
  }

  flush()
  return chunks
}

function createdAtMillis(data: DocumentData): number {
  const c = data.createdAt
  if (isTimestamp(c)) {
    return c.toMillis()
  }
  return 0
}

function normalizeVideoItem(
  data: DocumentData,
  materiaCode: string,
  topicCode: string
): DocumentData {
  const videoId =
    typeof data.videoId === 'string' ? data.videoId : String(data.videoId ?? '')
  const url =
    typeof data.url === 'string' && data.url.trim()
      ? data.url
      : videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : ''

  return {
    createdAt: data.createdAt ?? data.savedAt ?? null,
    materia: typeof data.materia === 'string' ? data.materia : materiaCode,
    title: data.título || data.title || '',
    url,
    description: data.description ?? '',
    channelTitle: data.canal || data.channelTitle || '',
    videoId,
    duration: data.duración || data.duration || '',
    language: data.idioma || data.language || 'es',
    topic: topicCode,
  }
}

function consolidadoDocId(materiaCode: string, partIndex: number): string {
  if (partIndex === 0) {
    return `${CONSOLIDADO_ID_PREFIX}${materiaCode}`
  }
  return `${CONSOLIDADO_ID_PREFIX}${materiaCode}_${partIndex + 1}`
}

async function rebuildYoutubeLinksConsolidado(): Promise<void> {
  const db = getStudentDatabase()
  const rootCol = db.collection(YOUTUBE_LINKS_COLLECTION)

  const bySubject: Record<string, DocumentData[]> = {}
  for (const code of SUBJECT_CODES) {
    bySubject[code] = []
  }

  const videosSnap = await db.collectionGroup('videos').get()
  console.log(`🔎 collectionGroup('videos'): ${videosSnap.docs.length} doc(s)`)

  for (const vidDoc of videosSnap.docs) {
    const pathSegs = vidDoc.ref.path.split('/')
    // YoutubeLinks/{grado}/{materia}/{topic}/videos/<id>
    if (pathSegs.length < 6) continue
    if (pathSegs[0] !== YOUTUBE_LINKS_COLLECTION) continue
    if (pathSegs[4] !== 'videos') continue

    const gradoId = pathSegs[1]
    const materiaCode = pathSegs[2]
    const topicCode = pathSegs[3]

    if (
      gradoId.startsWith(CONSOLIDADO_ID_PREFIX) ||
      materiaCode.startsWith(CONSOLIDADO_ID_PREFIX) ||
      topicCode.startsWith(CONSOLIDADO_ID_PREFIX)
    ) {
      continue
    }

    if (
      !SUBJECT_CODES.includes(materiaCode as (typeof SUBJECT_CODES)[number])
    ) {
      continue
    }

    const raw = vidDoc.data()
    const item = normalizeVideoItem(raw, materiaCode, topicCode)
    if (!item.url && !item.videoId) continue
    bySubject[materiaCode].push(item)
  }

  for (const code of SUBJECT_CODES) {
    bySubject[code].sort((a, b) => {
      const ta = String(a.topic ?? '')
      const tb = String(b.topic ?? '')
      if (ta !== tb) return ta.localeCompare(tb, 'es')
      const titleA = String(a.title ?? '')
      const titleB = String(b.title ?? '')
      if (titleA !== titleB) return titleA.localeCompare(titleB, 'es')
      return createdAtMillis(a) - createdAtMillis(b)
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

  const chunksBySubject: Record<string, DocumentData[][]> = {}
  for (const materiaCode of SUBJECT_CODES) {
    chunksBySubject[materiaCode] = splitItemsIntoChunks(bySubject[materiaCode])
  }

  for (const materiaCode of SUBJECT_CODES) {
    const chunks = chunksBySubject[materiaCode]
    const totalParts = chunks.length

    for (let i = 0; i < chunks.length; i++) {
      const docId = consolidadoDocId(materiaCode, i)
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

  for (const materiaCode of SUBJECT_CODES) {
    const n = bySubject[materiaCode].length
    const chunks = chunksBySubject[materiaCode]
    const ids = chunks.map((_, i) => consolidadoDocId(materiaCode, i))
    console.log(
      `✅ YoutubeLinks ${materiaCode}: ${n} video(s) en ${chunks.length} doc(s) [${ids.join(', ')}]`
    )
  }
}

async function main(): Promise<void> {
  await rebuildYoutubeLinksConsolidado()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
