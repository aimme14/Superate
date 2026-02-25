import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { firebaseApp } from '@/services/db'
import { success, failure, Result } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { normalizeError } from '@/errors/handler'
import type {
  Simulacro,
  SimulacroVideo,
  SimulacroICFES,
  CreateSimulacroInput,
  UpdateSimulacroInput,
  CreateSimulacroVideoInput,
} from '@/interfaces/simulacro.interface'

const db = getFirestore(firebaseApp)
const storage = getStorage(firebaseApp)

const SIMULACROS_COLLECTION = 'Simulacros'
const VIDEOS_SUBCOLLECTION = 'Videos'
const ICFES_SUBCOLLECTION = 'ICFES'
/** Documento placeholder bajo ICFES para que Videos sea subcolección (path con 5 segmentos) */
const ICFES_VIDEOS_PARENT = '_'
const STORAGE_SIMULACROS_PATH = 'Simulacros'
const STORAGE_ICFES_PATH = 'icfes'

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB
const ALLOWED_PDF_TYPES = ['application/pdf']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

function parseIcfes(data: Record<string, unknown>): SimulacroICFES | undefined {
  const s1Doc = data.icfesSeccion1DocumentoUrl
  const s1Hoja = data.icfesSeccion1HojaUrl
  const s2Doc = data.icfesSeccion2DocumentoUrl
  const s2Hoja = data.icfesSeccion2HojaUrl
  if (!s1Doc && !s1Hoja && !s2Doc && !s2Hoja) return undefined
  return {
    seccion1DocumentoUrl: s1Doc != null ? String(s1Doc) : undefined,
    seccion1HojaUrl: s1Hoja != null ? String(s1Hoja) : undefined,
    seccion2DocumentoUrl: s2Doc != null ? String(s2Doc) : undefined,
    seccion2HojaUrl: s2Hoja != null ? String(s2Hoja) : undefined,
  }
}

function parseSimulacroDoc(id: string, data: Record<string, unknown>): Simulacro {
  const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? new Date()
  const icfes = parseIcfes(data)
  return {
    id,
    grado: (data.grado as Simulacro['grado']) ?? '11°',
    materia: String(data.materia ?? ''),
    titulo: String(data.titulo ?? ''),
    formulario: data.formulario != null ? String(data.formulario) : undefined,
    numeroOrden: Number(data.numeroOrden) ?? 0,
    comentario: String(data.comentario ?? ''),
    isActive: data.isActive === undefined ? true : Boolean(data.isActive),
    createdAt,
    pdfSimulacroUrl: String(data.pdfSimulacroUrl ?? ''),
    pdfHojaRespuestasUrl: String(data.pdfHojaRespuestasUrl ?? ''),
    icfes,
  }
}

function parseVideoDoc(id: string, data: Record<string, unknown>): SimulacroVideo {
  const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? new Date()
  return {
    id,
    titulo: String(data.titulo ?? ''),
    descripcion: data.descripcion != null ? String(data.descripcion) : undefined,
    url: String(data.url ?? ''),
    storagePath: data.storagePath != null ? String(data.storagePath) : undefined,
    createdAt,
  }
}

/**
 * Sube el PDF del documento del simulacro a Storage.
 * Ruta: Simulacros/{simulacroId}/documento.pdf
 */
export async function uploadPdfSimulacro(
  simulacroId: string,
  file: File
): Promise<Result<string>> {
  if (!ALLOWED_PDF_TYPES.includes(file.type)) {
    return failure(new ErrorAPI({ message: 'Solo se permiten archivos PDF.', statusCode: 400 }))
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return failure(
      new ErrorAPI({
        message: `El PDF no debe superar ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.`,
        statusCode: 400,
      })
    )
  }
  try {
    const path = `${STORAGE_SIMULACROS_PATH}/${simulacroId}/documento.pdf`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
    const downloadURL = await getDownloadURL(storageRef)
    return success(downloadURL)
  } catch (e) {
    console.error('❌ Error al subir PDF del simulacro:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir PDF del simulacro')))
  }
}

/**
 * Sube el PDF de la hoja de respuestas a Storage.
 * Ruta: Simulacros/{simulacroId}/hoja_respuestas.pdf
 * Relación 1:1 con el simulacro.
 */
export async function uploadPdfHojaRespuestas(
  simulacroId: string,
  file: File
): Promise<Result<string>> {
  if (!ALLOWED_PDF_TYPES.includes(file.type)) {
    return failure(new ErrorAPI({ message: 'Solo se permiten archivos PDF.', statusCode: 400 }))
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return failure(
      new ErrorAPI({
        message: `El PDF no debe superar ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.`,
        statusCode: 400,
      })
    )
  }
  try {
    const path = `${STORAGE_SIMULACROS_PATH}/${simulacroId}/hoja_respuestas.pdf`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
    const downloadURL = await getDownloadURL(storageRef)
    return success(downloadURL)
  } catch (e) {
    console.error('❌ Error al subir PDF hoja de respuestas:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir PDF hoja de respuestas')))
  }
}

/**
 * Sube un video explicativo a Storage y devuelve la URL y la ruta.
 * Ruta: Simulacros/{simulacroId}/videos/{videoId}_{nombreSeguro}.{ext}
 * Recomendación: almacenar los archivos de video en Firebase Storage (no solo URLs externas)
 * para tener control de acceso, consistencia y posibilidad de borrado. La URL se guarda en
 * la subcolección Videos junto con storagePath para poder eliminar el archivo si se borra el video.
 */
export async function uploadVideoSimulacro(
  simulacroId: string,
  videoId: string,
  file: File
): Promise<Result<{ url: string; storagePath: string }>> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !['mp4', 'webm', 'mov'].includes(ext)) {
    return failure(
      new ErrorAPI({ message: 'Solo se permiten videos MP4, WebM o MOV.', statusCode: 400 })
    )
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return failure(
      new ErrorAPI({
        message: `El video no debe superar ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB.`,
        statusCode: 400,
      })
    )
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const path = `${STORAGE_SIMULACROS_PATH}/${simulacroId}/videos/${videoId}_${safeName}`
  try {
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: file.type || 'video/mp4' })
    const url = await getDownloadURL(storageRef)
    return success({ url, storagePath: path })
  } catch (e) {
    console.error('❌ Error al subir video del simulacro:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir video del simulacro')))
  }
}

/**
 * Sube un PDF de Materia ICFES (documento o hoja de respuestas) a Storage.
 * Ruta: Simulacros/{simulacroId}/icfes/documento_seccion1.pdf | hoja_respuestas_seccion1.pdf | documento_seccion2.pdf | hoja_respuestas_seccion2.pdf
 * Máximo 2 documentos y 2 hojas; si se sube uno no es obligatorio el segundo.
 */
export async function uploadIcfesPdf(
  simulacroId: string,
  tipo: 'documento_seccion1' | 'hoja_respuestas_seccion1' | 'documento_seccion2' | 'hoja_respuestas_seccion2',
  file: File
): Promise<Result<string>> {
  if (!ALLOWED_PDF_TYPES.includes(file.type)) {
    return failure(new ErrorAPI({ message: 'Solo se permiten archivos PDF.', statusCode: 400 }))
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return failure(
      new ErrorAPI({
        message: `El PDF no debe superar ${MAX_PDF_SIZE_BYTES / 1024 / 1024} MB.`,
        statusCode: 400,
      })
    )
  }
  try {
    const path = `${STORAGE_SIMULACROS_PATH}/${simulacroId}/${STORAGE_ICFES_PATH}/${tipo}.pdf`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
    const downloadURL = await getDownloadURL(storageRef)
    return success(downloadURL)
  } catch (e) {
    console.error('❌ Error al subir PDF ICFES:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir PDF ICFES')))
  }
}

/**
 * Sube un video de Materia ICFES a Storage.
 * Ruta: Simulacros/{simulacroId}/icfes/videos/{videoId}_{nombre}.{ext}
 */
export async function uploadVideoIcfes(
  simulacroId: string,
  videoId: string,
  file: File
): Promise<Result<{ url: string; storagePath: string }>> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !['mp4', 'webm', 'mov'].includes(ext)) {
    return failure(
      new ErrorAPI({ message: 'Solo se permiten videos MP4, WebM o MOV.', statusCode: 400 })
    )
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return failure(
      new ErrorAPI({
        message: `El video no debe superar ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB.`,
        statusCode: 400,
      })
    )
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const path = `${STORAGE_SIMULACROS_PATH}/${simulacroId}/${STORAGE_ICFES_PATH}/videos/${videoId}_${safeName}`
  try {
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: file.type || 'video/mp4' })
    const url = await getDownloadURL(storageRef)
    return success({ url, storagePath: path })
  } catch (e) {
    console.error('❌ Error al subir video ICFES:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir video ICFES')))
  }
}

/**
 * Elimina un archivo de Storage por su ruta (para limpieza al borrar video o simulacro).
 */
export async function deleteStorageFile(storagePath: string): Promise<Result<void>> {
  try {
    const refObj = ref(storage, storagePath)
    await deleteObject(refObj)
    return success(undefined)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'storage/object-not-found') return success(undefined)
    console.error('❌ Error al eliminar archivo de Storage:', e)
    return failure(new ErrorAPI(normalizeError(e, 'eliminar archivo')))
  }
}

/** Servicio de simulacros (singleton) */
class SimulacrosService {
  private static instance: SimulacrosService

  static getInstance(): SimulacrosService {
    if (!SimulacrosService.instance) {
      SimulacrosService.instance = new SimulacrosService()
    }
    return SimulacrosService.instance
  }

  /** Lista todos los simulacros ordenados por numeroOrden y luego por createdAt. */
  async getAll(): Promise<Result<Simulacro[]>> {
    try {
      const colRef = collection(db, SIMULACROS_COLLECTION)
      const snapshot = await getDocs(colRef)
      const list = snapshot.docs.map((d) =>
        parseSimulacroDoc(d.id, d.data() as Record<string, unknown>)
      )
      list.sort((a, b) => {
        if (a.numeroOrden !== b.numeroOrden) return a.numeroOrden - b.numeroOrden
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      return success(list)
    } catch (e) {
      console.error('❌ Error al listar simulacros:', e)
      return failure(new ErrorAPI(normalizeError(e, 'listar simulacros')))
    }
  }

  /** Lista todos los simulacros activos con sus videos (Videos e ICFES/Videos) para mostrar enlaces. */
  async getAllWithVideos(): Promise<Result<Simulacro[]>> {
    try {
      const listRes = await this.getAll()
      if (!listRes.success) return listRes
      const list = listRes.data.filter((s) => s.isActive !== false)
      for (const sim of list) {
        const videosRef = collection(db, SIMULACROS_COLLECTION, sim.id, VIDEOS_SUBCOLLECTION)
        const videosSnap = await getDocs(query(videosRef, orderBy('createdAt', 'asc')))
        sim.videos = videosSnap.docs.map((d) =>
          parseVideoDoc(d.id, d.data() as Record<string, unknown>)
        )
        const icfesVideosRef = collection(
          db,
          SIMULACROS_COLLECTION,
          sim.id,
          ICFES_SUBCOLLECTION,
          ICFES_VIDEOS_PARENT,
          VIDEOS_SUBCOLLECTION
        )
        const icfesVideosSnap = await getDocs(query(icfesVideosRef, orderBy('createdAt', 'asc')))
        sim.icfesVideos = icfesVideosSnap.docs.map((d) =>
          parseVideoDoc(d.id, d.data() as Record<string, unknown>)
        )
      }
      return success(list)
    } catch (e) {
      console.error('❌ Error al listar simulacros con videos:', e)
      return failure(new ErrorAPI(normalizeError(e, 'listar simulacros con videos')))
    }
  }

  /** Obtiene un simulacro por id, sus videos y los videos de ICFES (subcolección ICFES/Videos). */
  async getById(id: string): Promise<Result<Simulacro | null>> {
    try {
      const docRef = doc(db, SIMULACROS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) return success(null)
      const simulacro = parseSimulacroDoc(snap.id, snap.data() as Record<string, unknown>)
      const videosRef = collection(db, SIMULACROS_COLLECTION, id, VIDEOS_SUBCOLLECTION)
      const videosSnap = await getDocs(query(videosRef, orderBy('createdAt', 'asc')))
      simulacro.videos = videosSnap.docs.map((d) =>
        parseVideoDoc(d.id, d.data() as Record<string, unknown>)
      )
      const icfesVideosRef = collection(
        db,
        SIMULACROS_COLLECTION,
        id,
        ICFES_SUBCOLLECTION,
        ICFES_VIDEOS_PARENT,
        VIDEOS_SUBCOLLECTION
      )
      const icfesVideosSnap = await getDocs(query(icfesVideosRef, orderBy('createdAt', 'asc')))
      simulacro.icfesVideos = icfesVideosSnap.docs.map((d) =>
        parseVideoDoc(d.id, d.data() as Record<string, unknown>)
      )
      return success(simulacro)
    } catch (e) {
      console.error('❌ Error al obtener simulacro:', e)
      return failure(new ErrorAPI(normalizeError(e, 'obtener simulacro')))
    }
  }

  /**
   * Crea un nuevo simulacro. Primero crea el documento con URLs vacías.
   * Si se envían pdfSimulacroFile y pdfHojaRespuestasFile, los sube y actualiza las URLs.
   * Para materia ICFES pueden omitirse y solo usarse los PDFs de las dos secciones.
   * Opcionalmente sube Materia ICFES (hasta 2 documentos + 2 hojas de respuesta + videos).
   */
  async create(
    input: Omit<CreateSimulacroInput, 'pdfSimulacroUrl' | 'pdfHojaRespuestasUrl'> & {
      pdfSimulacroFile?: File
      pdfHojaRespuestasFile?: File
      icfes?: {
        documentoSeccion1File?: File
        hojaSeccion1File?: File
        documentoSeccion2File?: File
        hojaSeccion2File?: File
      }
    }
  ): Promise<Result<Simulacro>> {
    try {
      const now = Timestamp.now()
      const colRef = collection(db, SIMULACROS_COLLECTION)
      const docRef = await addDoc(colRef, {
        grado: input.grado,
        materia: input.materia,
        titulo: input.titulo.trim(),
        numeroOrden: input.numeroOrden,
        comentario: input.comentario.trim(),
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdAt: now,
        pdfSimulacroUrl: '',
        pdfHojaRespuestasUrl: '',
      })
      const id = docRef.id

      const updatePayload: Record<string, unknown> = {}

      if (input.pdfSimulacroFile && input.pdfHojaRespuestasFile) {
        const [pdfSimRes, pdfHojaRes] = await Promise.all([
          uploadPdfSimulacro(id, input.pdfSimulacroFile),
          uploadPdfHojaRespuestas(id, input.pdfHojaRespuestasFile),
        ])
        if (!pdfSimRes.success) {
          await deleteDoc(docRef)
          return pdfSimRes
        }
        if (!pdfHojaRes.success) {
          await deleteDoc(docRef)
          return pdfHojaRes
        }
        updatePayload.pdfSimulacroUrl = pdfSimRes.data
        updatePayload.pdfHojaRespuestasUrl = pdfHojaRes.data
      }

      if (input.icfes) {
        const ic = input.icfes
        if (ic.documentoSeccion1File) {
          const r = await uploadIcfesPdf(id, 'documento_seccion1', ic.documentoSeccion1File)
          if (r.success) updatePayload.icfesSeccion1DocumentoUrl = r.data
        }
        if (ic.hojaSeccion1File) {
          const r = await uploadIcfesPdf(id, 'hoja_respuestas_seccion1', ic.hojaSeccion1File)
          if (r.success) updatePayload.icfesSeccion1HojaUrl = r.data
        }
        if (ic.documentoSeccion2File) {
          const r = await uploadIcfesPdf(id, 'documento_seccion2', ic.documentoSeccion2File)
          if (r.success) updatePayload.icfesSeccion2DocumentoUrl = r.data
        }
        if (ic.hojaSeccion2File) {
          const r = await uploadIcfesPdf(id, 'hoja_respuestas_seccion2', ic.hojaSeccion2File)
          if (r.success) updatePayload.icfesSeccion2HojaUrl = r.data
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDoc(docRef, updatePayload as any)

      const created = parseSimulacroDoc(id, {
        ...input,
        ...updatePayload,
        createdAt: now,
      })
      created.id = id
      created.createdAt = now.toDate()
      return success(created)
    } catch (e) {
      console.error('❌ Error al crear simulacro:', e)
      return failure(new ErrorAPI(normalizeError(e, 'crear simulacro')))
    }
  }

  async update(id: string, input: UpdateSimulacroInput): Promise<Result<Simulacro>> {
    try {
      const docRef = doc(db, SIMULACROS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) {
        return failure(new ErrorAPI({ message: 'Simulacro no encontrado.', statusCode: 404 }))
      }
      const payload: Record<string, unknown> = {}
      if (input.grado !== undefined) payload.grado = input.grado
      if (input.materia !== undefined) payload.materia = input.materia
      if (input.titulo !== undefined) payload.titulo = input.titulo.trim()
      if (input.numeroOrden !== undefined) payload.numeroOrden = input.numeroOrden
      if (input.comentario !== undefined) payload.comentario = input.comentario.trim()
      if (input.isActive !== undefined) payload.isActive = input.isActive
      if (input.pdfSimulacroUrl !== undefined) payload.pdfSimulacroUrl = input.pdfSimulacroUrl
      if (input.pdfHojaRespuestasUrl !== undefined)
        payload.pdfHojaRespuestasUrl = input.pdfHojaRespuestasUrl
      if (input.icfes !== undefined) {
        if (input.icfes.seccion1DocumentoUrl !== undefined)
          payload.icfesSeccion1DocumentoUrl = input.icfes.seccion1DocumentoUrl
        if (input.icfes.seccion1HojaUrl !== undefined)
          payload.icfesSeccion1HojaUrl = input.icfes.seccion1HojaUrl
        if (input.icfes.seccion2DocumentoUrl !== undefined)
          payload.icfesSeccion2DocumentoUrl = input.icfes.seccion2DocumentoUrl
        if (input.icfes.seccion2HojaUrl !== undefined)
          payload.icfesSeccion2HojaUrl = input.icfes.seccion2HojaUrl
      }
      if (Object.keys(payload).length === 0) {
        const current = parseSimulacroDoc(id, snap.data() as Record<string, unknown>)
        return success(current)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDoc(docRef, payload as any)
      const updatedSnap = await getDoc(docRef)
      return success(
        parseSimulacroDoc(id, updatedSnap.data() as Record<string, unknown>)
      )
    } catch (e) {
      console.error('❌ Error al actualizar simulacro:', e)
      return failure(new ErrorAPI(normalizeError(e, 'actualizar simulacro')))
    }
  }

  /** Elimina el simulacro y toda su subcolección de videos. Opcionalmente borra archivos en Storage. */
  async delete(id: string, deleteStorageFiles = true): Promise<Result<void>> {
    try {
      const docRef = doc(db, SIMULACROS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) return success(undefined)

      if (deleteStorageFiles) {
        const videosRef = collection(db, SIMULACROS_COLLECTION, id, VIDEOS_SUBCOLLECTION)
        const videosSnap = await getDocs(videosRef)
        for (const d of videosSnap.docs) {
          const data = d.data() as { storagePath?: string }
          if (data.storagePath) {
            await deleteStorageFile(data.storagePath).catch(() => {})
          }
        }
        const pdfSimPath = `${STORAGE_SIMULACROS_PATH}/${id}/documento.pdf`
        const pdfHojaPath = `${STORAGE_SIMULACROS_PATH}/${id}/hoja_respuestas.pdf`
        await deleteStorageFile(pdfSimPath).catch(() => {})
        await deleteStorageFile(pdfHojaPath).catch(() => {})
        const icfesPdfPaths = [
          `${STORAGE_SIMULACROS_PATH}/${id}/${STORAGE_ICFES_PATH}/documento_seccion1.pdf`,
          `${STORAGE_SIMULACROS_PATH}/${id}/${STORAGE_ICFES_PATH}/hoja_respuestas_seccion1.pdf`,
          `${STORAGE_SIMULACROS_PATH}/${id}/${STORAGE_ICFES_PATH}/documento_seccion2.pdf`,
          `${STORAGE_SIMULACROS_PATH}/${id}/${STORAGE_ICFES_PATH}/hoja_respuestas_seccion2.pdf`,
        ]
        for (const p of icfesPdfPaths) {
          await deleteStorageFile(p).catch(() => {})
        }
        const icfesVideosRef = collection(
          db,
          SIMULACROS_COLLECTION,
          id,
          ICFES_SUBCOLLECTION,
          ICFES_VIDEOS_PARENT,
          VIDEOS_SUBCOLLECTION
        )
        const icfesVideosSnap = await getDocs(icfesVideosRef)
        for (const d of icfesVideosSnap.docs) {
          const data = d.data() as { storagePath?: string }
          if (data.storagePath) await deleteStorageFile(data.storagePath).catch(() => {})
        }
      }

      for (const d of (
        await getDocs(collection(db, SIMULACROS_COLLECTION, id, VIDEOS_SUBCOLLECTION))
      ).docs) {
        await deleteDoc(doc(db, SIMULACROS_COLLECTION, id, VIDEOS_SUBCOLLECTION, d.id))
      }
      const icfesVideosRef = collection(
        db,
        SIMULACROS_COLLECTION,
        id,
        ICFES_SUBCOLLECTION,
        ICFES_VIDEOS_PARENT,
        VIDEOS_SUBCOLLECTION
      )
      for (const d of (await getDocs(icfesVideosRef)).docs) {
        await deleteDoc(
          doc(db, SIMULACROS_COLLECTION, id, ICFES_SUBCOLLECTION, ICFES_VIDEOS_PARENT, VIDEOS_SUBCOLLECTION, d.id)
        )
      }
      await deleteDoc(docRef)
      return success(undefined)
    } catch (e) {
      console.error('❌ Error al eliminar simulacro:', e)
      return failure(new ErrorAPI(normalizeError(e, 'eliminar simulacro')))
    }
  }

  /** Añade un video a la subcolección del simulacro (1:N). */
  async addVideo(
    simulacroId: string,
    input: CreateSimulacroVideoInput
  ): Promise<Result<SimulacroVideo>> {
    try {
      const videosRef = collection(db, SIMULACROS_COLLECTION, simulacroId, VIDEOS_SUBCOLLECTION)
      const docRef = await addDoc(videosRef, {
        titulo: input.titulo.trim(),
        descripcion: input.descripcion?.trim() || null,
        url: input.url,
        storagePath: input.storagePath || null,
        createdAt: Timestamp.now(),
      })
      const snap = await getDoc(docRef)
      const video = parseVideoDoc(snap.id, snap.data() as Record<string, unknown>)
      return success(video)
    } catch (e) {
      console.error('❌ Error al añadir video:', e)
      return failure(new ErrorAPI(normalizeError(e, 'añadir video')))
    }
  }

  /** Elimina un video de la subcolección y opcionalmente el archivo en Storage. */
  async deleteVideo(
    simulacroId: string,
    videoId: string,
    deleteFile = true
  ): Promise<Result<void>> {
    try {
      const videoRef = doc(db, SIMULACROS_COLLECTION, simulacroId, VIDEOS_SUBCOLLECTION, videoId)
      const snap = await getDoc(videoRef)
      if (snap.exists() && deleteFile) {
        const data = snap.data() as { storagePath?: string }
        if (data.storagePath) await deleteStorageFile(data.storagePath).catch(() => {})
      }
      await deleteDoc(videoRef)
      return success(undefined)
    } catch (e) {
      console.error('❌ Error al eliminar video:', e)
      return failure(new ErrorAPI(normalizeError(e, 'eliminar video')))
    }
  }

  /** Añade un video a la subcolección ICFES/_/Videos del simulacro. */
  async addVideoICFES(
    simulacroId: string,
    input: CreateSimulacroVideoInput
  ): Promise<Result<SimulacroVideo>> {
    try {
      const videosRef = collection(
        db,
        SIMULACROS_COLLECTION,
        simulacroId,
        ICFES_SUBCOLLECTION,
        ICFES_VIDEOS_PARENT,
        VIDEOS_SUBCOLLECTION
      )
      const docRef = await addDoc(videosRef, {
        titulo: input.titulo.trim(),
        descripcion: input.descripcion?.trim() || null,
        url: input.url,
        storagePath: input.storagePath || null,
        createdAt: Timestamp.now(),
      })
      const snap = await getDoc(docRef)
      const video = parseVideoDoc(snap.id, snap.data() as Record<string, unknown>)
      return success(video)
    } catch (e) {
      console.error('❌ Error al añadir video ICFES:', e)
      return failure(new ErrorAPI(normalizeError(e, 'añadir video ICFES')))
    }
  }

  /** Elimina un video de ICFES/_/Videos y opcionalmente el archivo en Storage. */
  async deleteVideoICFES(
    simulacroId: string,
    videoId: string,
    deleteFile = true
  ): Promise<Result<void>> {
    try {
      const videoRef = doc(
        db,
        SIMULACROS_COLLECTION,
        simulacroId,
        ICFES_SUBCOLLECTION,
        ICFES_VIDEOS_PARENT,
        VIDEOS_SUBCOLLECTION,
        videoId
      )
      const snap = await getDoc(videoRef)
      if (snap.exists() && deleteFile) {
        const data = snap.data() as { storagePath?: string }
        if (data.storagePath) await deleteStorageFile(data.storagePath).catch(() => {})
      }
      await deleteDoc(videoRef)
      return success(undefined)
    } catch (e) {
      console.error('❌ Error al eliminar video ICFES:', e)
      return failure(new ErrorAPI(normalizeError(e, 'eliminar video ICFES')))
    }
  }

  /** Actualiza solo los PDFs de un simulacro existente (reemplaza archivos en Storage). */
  async updatePdfs(
    id: string,
    pdfSimulacroFile?: File,
    pdfHojaRespuestasFile?: File
  ): Promise<Result<Simulacro>> {
    try {
      const docRef = doc(db, SIMULACROS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) {
        return failure(new ErrorAPI({ message: 'Simulacro no encontrado.', statusCode: 404 }))
      }
      const updates: { pdfSimulacroUrl?: string; pdfHojaRespuestasUrl?: string } = {}
      if (pdfSimulacroFile) {
        const res = await uploadPdfSimulacro(id, pdfSimulacroFile)
        if (!res.success) return res
        updates.pdfSimulacroUrl = res.data
      }
      if (pdfHojaRespuestasFile) {
        const res = await uploadPdfHojaRespuestas(id, pdfHojaRespuestasFile)
        if (!res.success) return res
        updates.pdfHojaRespuestasUrl = res.data
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(docRef, updates)
      }
      const updatedSnap = await getDoc(docRef)
      return success(
        parseSimulacroDoc(id, updatedSnap.data() as Record<string, unknown>)
      )
    } catch (e) {
      console.error('❌ Error al actualizar PDFs:', e)
      return failure(new ErrorAPI(normalizeError(e, 'actualizar PDFs')))
    }
  }
}

export const simulacrosService = SimulacrosService.getInstance()
