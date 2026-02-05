import {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
  Timestamp,
  addDoc,
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

/** Path para eliminar: necesitamos grado, materiaCode, topicCode e id del documento */
export interface ResourcePath {
  grado: string;
  materiaCode: string;
  topicCode: string;
  id: string;
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
        materia: data.materia,
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
        materia: data.materia,
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
}

export const resourcesService = ResourcesService.getInstance();
