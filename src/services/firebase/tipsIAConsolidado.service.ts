/**
 * Lectura de TipsIA/consolidado_1 con caché local de Firestore (IndexedDB).
 * Preferencia: caché → red; reintento fuerza servidor.
 */

import {
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getFirestore,
  Timestamp,
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import type { TipICFES } from '@/interfaces/tipsICFES.interface';

const TIPS_IA = 'TipsIA';
const CONSOLIDADO_1 = 'consolidado_1';

function toCreatedAtMs(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v instanceof Timestamp) return v.toMillis();
  return 0;
}

function mapItem(raw: unknown, index: number): TipICFES {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const tip: TipICFES = {
    id: `consolidado-${index}`,
    title: String(o.title ?? ''),
    description: String(o.description ?? ''),
    subject: String(o.subject ?? 'General'),
    topic: String(o.topic ?? 'General'),
    level: String(o.level ?? 'Medio'),
    category: String(o.category ?? 'General'),
    tags: Array.isArray(o.tags) ? o.tags.map((t) => String(t)) : [],
    createdBy: String(o.createdBy ?? ''),
    createdAt: toCreatedAtMs(o.createdAt),
    active: o.active !== false,
  };
  if (typeof o.example === 'string' && o.example.trim()) tip.example = o.example.trim();
  if (typeof o.recommendation === 'string' && o.recommendation.trim()) {
    tip.recommendation = o.recommendation.trim();
  }
  return tip;
}

function dataToTips(data: Record<string, unknown> | undefined): TipICFES[] {
  const items = data?.items;
  if (!Array.isArray(items)) return [];
  return items.map((item, i) => mapItem(item, i));
}

export type FetchTipsIAConsolidadoOptions = {
  /** Si true, ignora caché local y lee solo desde el servidor (p. ej. botón reintentar). */
  forceServer?: boolean;
};

/**
 * Obtiene los tips desde TipsIA/consolidado_1.
 * Sin `forceServer`: intenta `getDocFromCache` (0 lecturas de red si ya está en IndexedDB), si no hay caché usa `getDoc`.
 */
export async function fetchTipsIAConsolidado1(
  options?: FetchTipsIAConsolidadoOptions
): Promise<TipICFES[]> {
  const db = getFirestore(firebaseApp);
  const ref = doc(db, TIPS_IA, CONSOLIDADO_1);

  if (options?.forceServer) {
    const snap = await getDocFromServer(ref);
    if (!snap.exists()) return [];
    return dataToTips(snap.data() as Record<string, unknown>);
  }

  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) {
      return dataToTips(cached.data() as Record<string, unknown>);
    }
  } catch {
    // Sin entrada en caché local: seguir a red
  }

  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return dataToTips(snap.data() as Record<string, unknown>);
}
