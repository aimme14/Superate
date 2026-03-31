/**
 * Reconstruye documentos consolidados de WebLinks por materia a partir de la
 * estructura anidada:
 *   WebLinks/{grado}/{materia}/{topic}/links/{id}
 *
 * Por cada materia (BI, CS, FI, IN, LE, MA, QU) se agregan todos los enlaces
 * de todos los grados y topics en una lista plana:
 *   { items: [{ createdAt, materia, title, topic, url }, ...], partIndex?, totalParts?, rebuiltAt }
 *
 * Partición: consolidado_MA, consolidado_MA_2, consolidado_MA_3… si supera ~1 MiB.
 * Al recorrer, se ignoran IDs que empiezan por consolidado_ (incluye salidas previas).
 *
 * Uso (desde la carpeta functions):
 *   npm run rebuild-weblinks-consolidado
 *
 * Credenciales: igual que otros scripts (functions/serviceAccountKey.json o ADC).
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import { getStudentDatabase } from '../utils/firestoreHelpers'

/** Límite oficial de Firestore por documento (bytes). */
const FIRESTORE_MAX_DOC_BYTES = 1_048_576

const SIZE_SAFETY_MARGIN_BYTES = 72_000

const MAX_CONSOLIDATED_DOC_BYTES =
  FIRESTORE_MAX_DOC_BYTES - SIZE_SAFETY_MARGIN_BYTES

const CONSOLIDADO_ID_PREFIX = 'consolidado_'

/** Materias a consolidar (mismo código que rutas WebLinks). */
const SUBJECT_CODES = ['BI', 'CS', 'FI', 'IN', 'LE', 'MA', 'QU'] as const

const WEB_LINKS_COLLECTION = 'WebLinks'

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
          `Un solo enlace supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
        )
      }
      current.push(item)
    } else {
      const approx = Math.ceil(sizeIfAppend / 1024)
      throw new Error(
        `Un solo enlace supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
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

/**
 * Solo los campos acordados; sin ID de documento Firestore.
 */
function normalizeLinkItem(
  data: DocumentData,
  materiaCode: string,
  topicDocId: string
): DocumentData {
  return {
    createdAt: data.createdAt ?? data.savedAt ?? null,
    materia: typeof data.materia === 'string' ? data.materia : materiaCode,
    title: data.title ?? data.name ?? '',
    // Guardar topic como código corto (AL, LC, LE, ...), alineado con el path
    // WebLinks/{grado}/{materia}/{topic}/links/{id}.
    topic: topicDocId,
    url: data.url ?? data.link ?? '',
    description: data.description ?? '',
  }
}

/**
 * Primer trozo: consolidado_MA; siguientes: consolidado_MA_2, consolidado_MA_3…
 */
function consolidadoDocId(materiaCode: string, partIndex: number): string {
  if (partIndex === 0) {
    return `${CONSOLIDADO_ID_PREFIX}${materiaCode}`
  }
  return `${CONSOLIDADO_ID_PREFIX}${materiaCode}_${partIndex + 1}`
}

async function rebuildWebLinksConsolidado(): Promise<void> {
  const db = getStudentDatabase()
  const rootCol = db.collection(WEB_LINKS_COLLECTION)

  const bySubject: Record<string, DocumentData[]> = {}
  for (const code of SUBJECT_CODES) {
    bySubject[code] = []
  }

  // En algunos casos los docs de "grado" en WebLinks no aparecen como documentos
  // con datos (aunque sí existan sus subcolecciones). Para no depender de
  // listCollections()/get() del padre, usamos collectionGroup.
  const linksSnap = await db.collectionGroup('links').get()
  console.log(`🔎 collectionGroup('links'): ${linksSnap.docs.length} doc(s)`)

  for (const linkDoc of linksSnap.docs) {
    const pathSegs = linkDoc.ref.path.split('/')
    // Ej: WebLinks/Undécimo/BI/LC/links/<id>
    if (pathSegs.length < 6) continue
    if (pathSegs[0] !== WEB_LINKS_COLLECTION) continue
    if (pathSegs[4] !== 'links') continue

    const gradoId = pathSegs[1]
    const materiaCode = pathSegs[2]
    const topicCode = pathSegs[3]

    // Respeta la regla: ignorar IDs que empiecen por consolidado_ al recorrer.
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

    const raw = linkDoc.data()
    const item = normalizeLinkItem(raw, materiaCode, topicCode)
    bySubject[materiaCode].push(item)
  }

  // Orden estable para que el consolidado sea determinista.
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

  // Borrado completo de consolidados previos en el root: WebLinks/consolidado_*
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

  // Commit por lotes para no exceder límites del batch.
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

  // Log final con conteos.
  for (const materiaCode of SUBJECT_CODES) {
    const n = bySubject[materiaCode].length
    const chunks = chunksBySubject[materiaCode]
    const ids = chunks.map((_, i) => consolidadoDocId(materiaCode, i))
    console.log(
      `✅ WebLinks ${materiaCode}: ${n} enlace(s) en ${chunks.length} doc(s) [${ids.join(
        ', '
      )}]`
    )
  }
}

async function main(): Promise<void> {
  await rebuildWebLinksConsolidado()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

