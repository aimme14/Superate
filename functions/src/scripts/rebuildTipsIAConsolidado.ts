/**
 * Reconstruye la caché de lectura TipsIA/consolidado_* a partir de todos los
 * documentos de tips (excluye IDs que empiezan por consolidado_).
 *
 * Cada documento consolidado tiene la forma:
 *   { items: [...], partIndex, totalParts, rebuiltAt }
 *
 * Los documentos originales no se borran. Rebuild completo: borra consolidado_*
 * anteriores y vuelve a escribir.
 *
 * Uso (desde la carpeta functions):
 *   npm run rebuild-tips-ia-consolidado
 *
 * Si totalParts > 1 en el documento, el cliente debe leer consolidado_1 …
 * consolidado_N y concatenar los arrays `items` en orden.
 *
 * Credenciales: igual que otros scripts (functions/serviceAccountKey.json o ADC).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';
import { getStudentDatabase } from '../utils/firestoreHelpers';

/** Límite oficial de Firestore por documento (bytes). */
const FIRESTORE_MAX_DOC_BYTES = 1_048_576;

/**
 * Margen para metadatos y diferencias entre JSON UTF-8 y codificación interna.
 */
const SIZE_SAFETY_MARGIN_BYTES = 72_000;

const MAX_CONSOLIDATED_DOC_BYTES =
  FIRESTORE_MAX_DOC_BYTES - SIZE_SAFETY_MARGIN_BYTES;

const CONSOLIDADO_ID_PREFIX = 'consolidado_';

function isTimestamp(v: unknown): v is Timestamp {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Timestamp).toMillis === 'function' &&
    'seconds' in (v as Timestamp)
  );
}

/**
 * Tamaño en bytes UTF-8 del JSON (aproxima el payload persistido; con margen global).
 */
function jsonUtf8Bytes(value: unknown): number {
  const json = JSON.stringify(value, (_key, v) => {
    if (isTimestamp(v)) {
      return { seconds: v.seconds, nanoseconds: v.nanoseconds };
    }
    return v;
  });
  return Buffer.byteLength(json, 'utf8');
}

/** Cota superior de dígitos en metadatos al estimar tamaño (varios trozos). */
const ESTIMATE_TOTAL_PARTS_FOR_SIZE = 999;

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
  };
  return jsonUtf8Bytes(doc);
}

/**
 * Parte `items` en varios arrays de forma greedy respetando MAX_CONSOLIDATED_DOC_BYTES.
 */
function splitItemsIntoChunks(items: DocumentData[]): DocumentData[][] {
  if (items.length === 0) {
    return [[]];
  }

  const chunks: DocumentData[][] = [];
  let current: DocumentData[] = [];

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current);
      current = [];
    }
  };

  for (const item of items) {
    const tryItems = [...current, item];
    const sizeIfAppend = estimateConsolidatedDocBytes(
      tryItems,
      chunks.length
    );

    if (sizeIfAppend <= MAX_CONSOLIDATED_DOC_BYTES) {
      current.push(item);
      continue;
    }

    if (current.length > 0) {
      flush();
      const sizeSingleNew = estimateConsolidatedDocBytes(
        [item],
        chunks.length
      );
      if (sizeSingleNew > MAX_CONSOLIDATED_DOC_BYTES) {
        const approx = Math.ceil(sizeSingleNew / 1024);
        throw new Error(
          `Un solo tip supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
        );
      }
      current.push(item);
    } else {
      const approx = Math.ceil(sizeIfAppend / 1024);
      throw new Error(
        `Un solo tip supera el tamaño máximo permitido para un documento (~${approx} KiB JSON). Reduce el contenido o divide el dato manualmente.`
      );
    }
  }

  flush();
  return chunks;
}

async function rebuildTipsIAConsolidado(): Promise<void> {
  const db = getStudentDatabase();
  const col = db.collection('TipsIA');

  const snapshot = await col.get();
  const sourceDocs = snapshot.docs.filter(
    (d) => !d.id.startsWith(CONSOLIDADO_ID_PREFIX)
  );

  /** Solo datos del documento; sin ID autogenerado de Firestore. */
  const items: DocumentData[] = sourceDocs.map((d) => d.data());

  const chunks = splitItemsIntoChunks(items);
  const totalParts = chunks.length;

  const batch = db.batch();
  const existingConsolidados = snapshot.docs.filter((d) =>
    d.id.startsWith(CONSOLIDADO_ID_PREFIX)
  );
  for (const d of existingConsolidados) {
    batch.delete(d.ref);
  }

  const docIdsToWrite = chunks.map(
    (_, i) => `${CONSOLIDADO_ID_PREFIX}${i + 1}`
  );

  for (let i = 0; i < chunks.length; i++) {
    const ref = col.doc(docIdsToWrite[i]);
    batch.set(ref, {
      items: chunks[i],
      partIndex: i,
      totalParts,
      rebuiltAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  const totalItems = items.length;
  console.log(
    `✅ TipsIA consolidado: ${totalItems} tips en ${totalParts} documento(s) (${docIdsToWrite.join(', ')}).`
  );
}

async function main(): Promise<void> {
  await rebuildTipsIAConsolidado();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
