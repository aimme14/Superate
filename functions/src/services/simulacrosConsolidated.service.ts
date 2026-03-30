/**
 * Reconstruye documentos denormalizados `Simulacros/consolidado_*` + `Simulacros/consolidado_meta`
 * agrupando simulacros por materia → grado → clave de orden (numeroOrden, con sufijos si hay colisión).
 *
 * No incluye IDs de documentos fuente en el payload; solo campos del documento.
 */

import * as admin from 'firebase-admin';
import { db } from '../config/firebase.config';

const SIMULACROS_COLLECTION = 'Simulacros';

/** Documentos generados por esta consolidación (no son simulacros fuente) */
const RESERVED_ID_META = 'consolidado_meta';
const RESERVED_ID_LEGACY = 'consolidado';

function isReservedSourceId(id: string): boolean {
  if (id === RESERVED_ID_META || id === RESERVED_ID_LEGACY) return true;
  return /^consolidado_\d+$/.test(id);
}

/** ~950 KiB: margen bajo el límite 1 MiB de Firestore (la serialización real puede variar). */
const MAX_SHARD_BYTES = 950_000;

const SCHEMA_VERSION = 1;

export interface RebuildSimulacrosConsolidatedResult {
  success: boolean;
  sourceCount: number;
  totalShards: number;
  shardIds: string[];
  message?: string;
  error?: string;
}

type PlainPayload = Record<string, unknown>;

function cloneFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof admin.firestore.Timestamp) return v;
  if (v instanceof admin.firestore.GeoPoint) return v;
  if (Array.isArray(v)) return v.map(cloneFirestoreValue);
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      o[k] = cloneFirestoreValue(val);
    }
    return o;
  }
  return v;
}

/**
 * Copia todos los campos del documento fuente (sin `id`; Firestore no lo guarda en data).
 */
function simulacroPayloadFromData(data: admin.firestore.DocumentData): PlainPayload {
  const out: PlainPayload = {};
  for (const key of Object.keys(data)) {
    out[key] = cloneFirestoreValue(data[key]);
  }
  return out;
}

/**
 * materia → grado → ordenKey → payload
 */
type NestedTree = Record<string, Record<string, Record<string, PlainPayload>>>;

function makeOrderKey(
  usedKeys: Set<string>,
  numeroOrden: number
): { key: string; hadCollision: boolean } {
  const base = String(Number.isFinite(numeroOrden) ? numeroOrden : 0);
  if (!usedKeys.has(base)) {
    usedKeys.add(base);
    return { key: base, hadCollision: false };
  }
  let i = 2;
  let candidate = `${base}__${i}`;
  while (usedKeys.has(candidate)) {
    i += 1;
    candidate = `${base}__${i}`;
  }
  usedKeys.add(candidate);
  return { key: candidate, hadCollision: true };
}

function getNumeroOrden(data: admin.firestore.DocumentData): number {
  const n = data.numeroOrden;
  if (typeof n === 'number' && !Number.isNaN(n)) return n;
  const p = Number(n);
  return Number.isFinite(p) ? p : 0;
}

function estimateJsonBytes(obj: unknown): number {
  return Buffer.byteLength(
    JSON.stringify(obj, (_k, v) => {
      if (v instanceof admin.firestore.Timestamp) {
        return v.toDate().toISOString();
      }
      return v;
    }),
    'utf8'
  );
}

function buildNestedTree(
  docs: admin.firestore.QueryDocumentSnapshot[]
): { tree: NestedTree; duplicateOrderKeys: number } {
  const tree: NestedTree = {};
  let duplicateOrderKeys = 0;

  const byMateriaGrado = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
  for (const snap of docs) {
    const data = snap.data();
    const materia = String(data.materia ?? 'sin-materia');
    const grado = String(data.grado ?? 'sin-grado');
    const key = `${materia}\0${grado}`;
    if (!byMateriaGrado.has(key)) byMateriaGrado.set(key, []);
    byMateriaGrado.get(key)!.push(snap);
  }

  for (const [, group] of byMateriaGrado) {
    group.sort((a, b) => {
      const na = getNumeroOrden(a.data());
      const nb = getNumeroOrden(b.data());
      if (na !== nb) return na - nb;
      const ta = String(a.data().titulo ?? '');
      const tb = String(b.data().titulo ?? '');
      if (ta !== tb) return ta.localeCompare(tb);
      return a.id.localeCompare(b.id);
    });
  }

  const groupKeys = Array.from(byMateriaGrado.keys()).sort((a, b) => a.localeCompare(b));

  for (const groupKey of groupKeys) {
    const group = byMateriaGrado.get(groupKey)!;
    const used = new Set<string>();
    for (const snap of group) {
      const data = snap.data();
      const materia = String(data.materia ?? 'sin-materia');
      const grado = String(data.grado ?? 'sin-grado');
      const n = getNumeroOrden(data);
      const { key: ordenKey, hadCollision } = makeOrderKey(used, n);
      if (hadCollision) duplicateOrderKeys += 1;

      if (!tree[materia]) tree[materia] = {};
      if (!tree[materia][grado]) tree[materia][grado] = {};
      tree[materia][grado][ordenKey] = simulacroPayloadFromData(data);
    }
  }

  return { tree, duplicateOrderKeys };
}

type FlatEntry = { materia: string; grado: string; ordenKey: string; payload: PlainPayload };

function flattenTree(tree: NestedTree): FlatEntry[] {
  const out: FlatEntry[] = [];
  const materias = Object.keys(tree).sort((a, b) => a.localeCompare(b));
  for (const materia of materias) {
    const grados = Object.keys(tree[materia]).sort((a, b) => a.localeCompare(b));
    for (const grado of grados) {
      const ordenKeys = Object.keys(tree[materia][grado]).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) {
          return na - nb;
        }
        return a.localeCompare(b);
      });
      for (const ordenKey of ordenKeys) {
        out.push({
          materia,
          grado,
          ordenKey,
          payload: tree[materia][grado][ordenKey],
        });
      }
    }
  }
  return out;
}

function rebuildTreeFromEntries(entries: FlatEntry[]): NestedTree {
  const tree: NestedTree = {};
  for (const e of entries) {
    if (!tree[e.materia]) tree[e.materia] = {};
    if (!tree[e.materia][e.grado]) tree[e.materia][e.grado] = {};
    tree[e.materia][e.grado][e.ordenKey] = e.payload;
  }
  return tree;
}

/** ~4 KiB de cabecera por documento shard (schemaVersion, índices, timestamps). */
const SHARD_DOC_OVERHEAD_BYTES = 4096;

function packShards(tree: NestedTree): NestedTree[] {
  const entries = flattenTree(tree);
  if (entries.length === 0) return [];

  const bins: FlatEntry[][] = [];
  let current: FlatEntry[] = [];

  for (const entry of entries) {
    const trial = [...current, entry];
    const trialTree = rebuildTreeFromEntries(trial);
    const size =
      SHARD_DOC_OVERHEAD_BYTES + estimateJsonBytes({ data: trialTree });

    if (current.length > 0 && size > MAX_SHARD_BYTES) {
      bins.push(current);
      current = [entry];
    } else {
      current = trial;
    }
  }
  if (current.length > 0) {
    bins.push(current);
  }

  return bins.map((bin) => rebuildTreeFromEntries(bin));
}

/**
 * Reconstruye consolidado_meta + consolidado_1..N en la colección Simulacros.
 */
export async function rebuildSimulacrosConsolidated(): Promise<RebuildSimulacrosConsolidatedResult> {
  const col = db.collection(SIMULACROS_COLLECTION);
  const snap = await col.get();

  const sourceDocs = snap.docs.filter((d) => !isReservedSourceId(d.id));

  const { tree, duplicateOrderKeys } = buildNestedTree(sourceDocs);

  const shardTrees = packShards(tree);
  const totalShards = shardTrees.length;

  for (let i = 0; i < shardTrees.length; i += 1) {
    const approx = estimateJsonBytes({
      schemaVersion: SCHEMA_VERSION,
      shardIndex: i + 1,
      totalShards: shardTrees.length,
      data: shardTrees[i],
    });
    if (approx + SHARD_DOC_OVERHEAD_BYTES > 1_048_576) {
      throw new Error(
        `El fragmento consolidado_${i + 1} supera el límite de 1 MiB de Firestore. Reduce tamaño de campos o contacta soporte.`
      );
    }
  }

  const metaRef = col.doc(RESERVED_ID_META);
  const prevMeta = await metaRef.get();
  const prevTotalShards =
    prevMeta.exists && typeof prevMeta.data()?.totalShards === 'number'
      ? (prevMeta.data()!.totalShards as number)
      : 0;

  /** Borrar fragmentos anteriores y el doc legado `consolidado` (delete inexistente es seguro en batch). */
  const batchDeletes: string[] = [RESERVED_ID_LEGACY];
  for (let i = 1; i <= prevTotalShards; i += 1) {
    batchDeletes.push(`consolidado_${i}`);
  }

  const shardIds: string[] = [];

  const chunks: Array<{
    ref: admin.firestore.DocumentReference;
    data: admin.firestore.DocumentData;
  }> = [];

  for (let i = 0; i < totalShards; i += 1) {
    const id = `consolidado_${i + 1}`;
    shardIds.push(id);
    chunks.push({
      ref: col.doc(id),
      data: {
        schemaVersion: SCHEMA_VERSION,
        shardIndex: i + 1,
        totalShards,
        data: shardTrees[i],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  }

  chunks.push({
    ref: metaRef,
    data: {
      schemaVersion: SCHEMA_VERSION,
      totalShards,
      shardIds,
      sourceDocumentCount: sourceDocs.length,
      duplicateOrderKeysResolved: duplicateOrderKeys,
      mergeStrategy: 'deepMergeDataAcrossShards',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  const allOps: Array<
    | { type: 'del'; id: string }
    | { type: 'set'; ref: admin.firestore.DocumentReference; data: admin.firestore.DocumentData }
  > = [
    ...batchDeletes.map((id) => ({ type: 'del' as const, id })),
    ...chunks.map((c) => ({ type: 'set' as const, ref: c.ref, data: c.data })),
  ];

  const BATCH = 450;
  for (let i = 0; i < allOps.length; i += BATCH) {
    const batch = db.batch();
    const slice = allOps.slice(i, i + BATCH);
    for (const op of slice) {
      if (op.type === 'del') {
        batch.delete(col.doc(op.id));
      } else {
        batch.set(op.ref, op.data);
      }
    }
    await batch.commit();
  }

  return {
    success: true,
    sourceCount: sourceDocs.length,
    totalShards,
    shardIds,
    message:
      totalShards === 0
        ? 'Sin simulacros fuente: solo se actualizó consolidado_meta (totalShards: 0). Documentos consolidado_* anteriores eliminados.'
        : `OK: ${totalShards} fragmento(s), ${sourceDocs.length} simulacro(s) fuente.`,
  };
}
