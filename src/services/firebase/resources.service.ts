import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  Timestamp,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  documentId,
  QueryConstraint,
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config';
import { SUBJECTS_CONFIG } from '@/utils/subjects.config';

const db = getFirestore(firebaseApp);

/** Rutas raíz (misma que planes de estudio): WebLinks/{grado}/{materia}/{topic}/links, YoutubeLinks/{grado}/{materia}/{topic}/videos */
const WEBLINKS_ROOT = 'WebLinks';
const YOUTUBELINKS_ROOT = 'YoutubeLinks';
const LINKS_SUBCOLLECTION = 'links';
const VIDEOS_SUBCOLLECTION = 'videos';

export type ResourceType = 'web' | 'youtube';

export interface WebLink {
  id: string;
  tipo: 'web';
  grado: string;
  materia: string;
  materiaCode: string;
  topic: string;
  topicCode: string;
  url: string;
  title?: string;
  createdAt: Date;
}

export interface YoutubeLink {
  id: string;
  tipo: 'youtube';
  grado: string;
  materia: string;
  materiaCode: string;
  topic: string;
  topicCode: string;
  url: string;
  title?: string;
  createdAt: Date;
}

export type Resource = WebLink | YoutubeLink;

export interface CreateWebLinkData {
  grado: string;
  materia: string;
  materiaCode: string;
  topic: string;
  topicCode: string;
  url: string;
  title?: string;
}

export interface CreateYoutubeLinkData {
  grado: string;
  materia: string;
  materiaCode: string;
  topic: string;
  topicCode: string;
  url: string;
  title?: string;
}

export interface ResourceFilters {
  grado?: string;
  materiaCode?: string;
  topicCode?: string;
}

export interface ResourceCursor {
  createdAtMillis: number;
  id: string;
}

export interface PaginatedResources<T extends Resource> {
  items: T[];
  nextCursor?: ResourceCursor;
  hasMore: boolean;
}

/** Path para eliminar o actualizar: grado, materiaCode, topicCode e id del documento */
export interface ResourcePath {
  grado: string;
  materiaCode: string;
  topicCode: string;
  id: string;
}

/** Datos editables de un recurso (solo URL y título) */
export interface UpdateResourceData {
  url?: string;
  title?: string;
}

const GRADES = Object.values(GRADE_CODE_TO_NAME);

function parseLinkDoc(
  id: string,
  data: Record<string, unknown>,
  tipo: ResourceType,
  path: { grado: string; materiaCode: string; topicCode: string }
): Resource {
  const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? new Date();
  const base = {
    id,
    grado: path.grado,
    materia: String(data.materia ?? path.materiaCode),
    materiaCode: path.materiaCode,
    topic: String(data.topic ?? path.topicCode),
    topicCode: path.topicCode,
    url: String(data.url ?? ''),
    title: data.title != null ? String(data.title) : undefined,
    createdAt,
  };
  if (tipo === 'youtube') {
    return { ...base, tipo: 'youtube' } as YoutubeLink;
  }
  return { ...base, tipo: 'web' } as WebLink;
}

/**
 * Servicio para gestionar enlaces web y de YouTube en Firestore.
 * Rutas (raíz, igual que planes de estudio): WebLinks/{grado}/{materia}/{topic}/links, YoutubeLinks/{grado}/{materia}/{topic}/videos
 */
class ResourcesService {
  private static instance: ResourcesService;

  static getInstance(): ResourcesService {
    if (!ResourcesService.instance) {
      ResourcesService.instance = new ResourcesService();
    }
    return ResourcesService.instance;
  }

  /**
   * Crea un enlace web.
   * Ruta: WebLinks/{grado}/{materiaCode}/{topicCode}/links/{docId}
   */
  async createWebLink(data: CreateWebLinkData): Promise<Result<WebLink>> {
    try {
      const linksColRef = collection(
        db,
        WEBLINKS_ROOT,
        data.grado,
        data.materiaCode,
        data.topicCode,
        LINKS_SUBCOLLECTION
      );
      const docRef = await addDoc(linksColRef, {
        grado: data.grado,
        materiaCode: data.materiaCode,
        materia: data.materia,
        topicCode: data.topicCode,
        topic: data.topic,
        url: data.url.trim(),
        title: data.title?.trim() || null,
        createdAt: Timestamp.now(),
      });
      const created: WebLink = {
        id: docRef.id,
        tipo: 'web',
        grado: data.grado,
        materia: data.materia,
        materiaCode: data.materiaCode,
        topic: data.topic,
        topicCode: data.topicCode,
        url: data.url.trim(),
        title: data.title?.trim(),
        createdAt: new Date(),
      };
      return success(created);
    } catch (e) {
      console.error('❌ Error al crear enlace web:', e);
      return failure(new ErrorAPI(normalizeError(e, 'crear enlace web')));
    }
  }

  /**
   * Crea un enlace de YouTube.
   * Ruta: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos/{docId}
   */
  async createYoutubeLink(data: CreateYoutubeLinkData): Promise<Result<YoutubeLink>> {
    try {
      const videosColRef = collection(
        db,
        YOUTUBELINKS_ROOT,
        data.grado,
        data.materiaCode,
        data.topicCode,
        VIDEOS_SUBCOLLECTION
      );
      const docRef = await addDoc(videosColRef, {
        grado: data.grado,
        materiaCode: data.materiaCode,
        materia: data.materia,
        topicCode: data.topicCode,
        topic: data.topic,
        url: data.url.trim(),
        title: data.title?.trim() || null,
        createdAt: Timestamp.now(),
      });
      const created: YoutubeLink = {
        id: docRef.id,
        tipo: 'youtube',
        grado: data.grado,
        materia: data.materia,
        materiaCode: data.materiaCode,
        topic: data.topic,
        topicCode: data.topicCode,
        url: data.url.trim(),
        title: data.title?.trim(),
        createdAt: new Date(),
      };
      return success(created);
    } catch (e) {
      console.error('❌ Error al crear enlace YouTube:', e);
      return failure(new ErrorAPI(normalizeError(e, 'crear enlace YouTube')));
    }
  }

  /**
   * Lista enlaces web recorriendo WebLinks/{grado}/{materia}/{topic}/links.
   * Filtros aplicados en memoria.
   */
  async getWebLinks(filters?: ResourceFilters): Promise<Result<WebLink[]>> {
    try {
      const list: WebLink[] = [];
      for (const grado of GRADES) {
        if (filters?.grado && filters.grado !== grado) continue;
        for (const subject of SUBJECTS_CONFIG) {
          if (filters?.materiaCode && filters.materiaCode !== subject.code) continue;
          for (const topic of subject.topics) {
            if (filters?.topicCode && filters.topicCode !== topic.code) continue;
            const linksColRef = collection(
              db,
              WEBLINKS_ROOT,
              grado,
              subject.code,
              topic.code,
              LINKS_SUBCOLLECTION
            );
            const snapshot = await getDocs(linksColRef);
            snapshot.docs.forEach((d) => {
              const item = parseLinkDoc(
                d.id,
                d.data() as Record<string, unknown>,
                'web',
                { grado, materiaCode: subject.code, topicCode: topic.code }
              ) as WebLink;
              list.push({ ...item, materia: subject.name, topic: topic.name });
            });
          }
        }
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return success(list);
    } catch (e) {
      console.error('❌ Error al listar enlaces web:', e);
      return failure(new ErrorAPI(normalizeError(e, 'listar enlaces web')));
    }
  }

  async getWebLinksPaginated(
    filters?: ResourceFilters,
    pageSize: number = 10,
    cursor?: ResourceCursor
  ): Promise<Result<PaginatedResources<WebLink>>> {
    try {
      const constraints = this.buildQueryConstraints(filters, pageSize, cursor);
      const q = query(collectionGroup(db, LINKS_SUBCOLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return parseLinkDoc(d.id, data, 'web', {
          grado: String(data.grado ?? ''),
          materiaCode: String(data.materiaCode ?? ''),
          topicCode: String(data.topicCode ?? ''),
        }) as WebLink;
      });
      const last = snapshot.docs[snapshot.docs.length - 1];
      const hasMore = snapshot.docs.length === pageSize;
      return success({
        items,
        hasMore,
        nextCursor: hasMore
          ? {
              createdAtMillis: ((last.data().createdAt as Timestamp)?.toMillis?.() ?? Date.now()),
              id: last.id,
            }
          : undefined,
      });
    } catch (e) {
      console.error('❌ Error al listar enlaces web paginados:', e);
      return failure(new ErrorAPI(normalizeError(e, 'listar enlaces web paginados')));
    }
  }

  /**
   * Lista enlaces de YouTube recorriendo YoutubeLinks/{grado}/{materia}/{topic}/videos.
   */
  async getYoutubeLinks(filters?: ResourceFilters): Promise<Result<YoutubeLink[]>> {
    try {
      const list: YoutubeLink[] = [];
      for (const grado of GRADES) {
        if (filters?.grado && filters.grado !== grado) continue;
        for (const subject of SUBJECTS_CONFIG) {
          if (filters?.materiaCode && filters.materiaCode !== subject.code) continue;
          for (const topic of subject.topics) {
            if (filters?.topicCode && filters.topicCode !== topic.code) continue;
            const videosColRef = collection(
              db,
              YOUTUBELINKS_ROOT,
              grado,
              subject.code,
              topic.code,
              VIDEOS_SUBCOLLECTION
            );
            const snapshot = await getDocs(videosColRef);
            snapshot.docs.forEach((d) => {
              const item = parseLinkDoc(
                d.id,
                d.data() as Record<string, unknown>,
                'youtube',
                { grado, materiaCode: subject.code, topicCode: topic.code }
              ) as YoutubeLink;
              list.push({ ...item, materia: subject.name, topic: topic.name });
            });
          }
        }
      }
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return success(list);
    } catch (e) {
      console.error('❌ Error al listar enlaces YouTube:', e);
      return failure(new ErrorAPI(normalizeError(e, 'listar enlaces YouTube')));
    }
  }

  async getYoutubeLinksPaginated(
    filters?: ResourceFilters,
    pageSize: number = 10,
    cursor?: ResourceCursor
  ): Promise<Result<PaginatedResources<YoutubeLink>>> {
    try {
      const constraints = this.buildQueryConstraints(filters, pageSize, cursor);
      const q = query(collectionGroup(db, VIDEOS_SUBCOLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return parseLinkDoc(d.id, data, 'youtube', {
          grado: String(data.grado ?? ''),
          materiaCode: String(data.materiaCode ?? ''),
          topicCode: String(data.topicCode ?? ''),
        }) as YoutubeLink;
      });
      const last = snapshot.docs[snapshot.docs.length - 1];
      const hasMore = snapshot.docs.length === pageSize;
      return success({
        items,
        hasMore,
        nextCursor: hasMore
          ? {
              createdAtMillis: ((last.data().createdAt as Timestamp)?.toMillis?.() ?? Date.now()),
              id: last.id,
            }
          : undefined,
      });
    } catch (e) {
      console.error('❌ Error al listar enlaces YouTube paginados:', e);
      return failure(new ErrorAPI(normalizeError(e, 'listar enlaces YouTube paginados')));
    }
  }

  private buildQueryConstraints(
    filters: ResourceFilters | undefined,
    pageSize: number,
    cursor?: ResourceCursor
  ): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];
    if (filters?.grado) constraints.push(where('grado', '==', filters.grado));
    if (filters?.materiaCode) constraints.push(where('materiaCode', '==', filters.materiaCode));
    if (filters?.topicCode) constraints.push(where('topicCode', '==', filters.topicCode));
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(orderBy(documentId(), 'desc'));
    if (cursor) {
      constraints.push(startAfter(Timestamp.fromMillis(cursor.createdAtMillis), cursor.id));
    }
    constraints.push(limit(pageSize));
    return constraints;
  }

  /**
   * Elimina un enlace web.
   * Ruta: WebLinks/{grado}/{materiaCode}/{topicCode}/links/{id}
   */
  async deleteWebLink(path: ResourcePath): Promise<Result<void>> {
    try {
      const docRef = doc(
        db,
        WEBLINKS_ROOT,
        path.grado,
        path.materiaCode,
        path.topicCode,
        LINKS_SUBCOLLECTION,
        path.id
      );
      await deleteDoc(docRef);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al eliminar enlace web:', e);
      return failure(new ErrorAPI(normalizeError(e, 'eliminar enlace web')));
    }
  }

  /**
   * Elimina un enlace de YouTube.
   * Ruta: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos/{id}
   */
  async deleteYoutubeLink(path: ResourcePath): Promise<Result<void>> {
    try {
      const docRef = doc(
        db,
        YOUTUBELINKS_ROOT,
        path.grado,
        path.materiaCode,
        path.topicCode,
        VIDEOS_SUBCOLLECTION,
        path.id
      );
      await deleteDoc(docRef);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al eliminar enlace YouTube:', e);
      return failure(new ErrorAPI(normalizeError(e, 'eliminar enlace YouTube')));
    }
  }

  /**
   * Actualiza un enlace web (solo URL y/o título).
   * Ruta: WebLinks/{grado}/{materiaCode}/{topicCode}/links/{id}
   */
  async updateWebLink(path: ResourcePath, data: UpdateResourceData): Promise<Result<void>> {
    try {
      const docRef = doc(
        db,
        WEBLINKS_ROOT,
        path.grado,
        path.materiaCode,
        path.topicCode,
        LINKS_SUBCOLLECTION,
        path.id
      );
      const updates: Record<string, string | null> = {};
      if (data.url !== undefined) updates.url = data.url.trim();
      if (data.title !== undefined) updates.title = data.title.trim() || null;
      if (Object.keys(updates).length === 0) return success(undefined);
      await updateDoc(docRef, updates);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al actualizar enlace web:', e);
      return failure(new ErrorAPI(normalizeError(e, 'actualizar enlace web')));
    }
  }

  /**
   * Actualiza un enlace de YouTube (solo URL y/o título).
   * Ruta: YoutubeLinks/{grado}/{materiaCode}/{topicCode}/videos/{id}
   */
  async updateYoutubeLink(path: ResourcePath, data: UpdateResourceData): Promise<Result<void>> {
    try {
      const docRef = doc(
        db,
        YOUTUBELINKS_ROOT,
        path.grado,
        path.materiaCode,
        path.topicCode,
        VIDEOS_SUBCOLLECTION,
        path.id
      );
      const updates: Record<string, string | null> = {};
      if (data.url !== undefined) updates.url = data.url.trim();
      if (data.title !== undefined) updates.title = data.title.trim() || null;
      if (Object.keys(updates).length === 0) return success(undefined);
      await updateDoc(docRef, updates);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al actualizar enlace YouTube:', e);
      return failure(new ErrorAPI(normalizeError(e, 'actualizar enlace YouTube')));
    }
  }
}

export const resourcesService = ResourcesService.getInstance();
