import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  addDoc,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { firebaseApp } from '@/services/db'
import { success, failure, Result } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { normalizeError } from '@/errors/handler'

const db = getFirestore(firebaseApp)
const storage = getStorage(firebaseApp)

const AI_TOOLS_COLLECTION = 'AI_Tools'
const AI_TOOLS_ICONS_PATH = 'AI_Tools_icons'

/** Módulos recomendados (áreas Saber 11) */
export const MODULOS_RECOMENDADOS = [
  { value: 'lectura-critica', label: 'Lectura Crítica' },
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'ciencias-sociales', label: 'Ciencias Sociales' },
  { value: 'ciencias-naturales', label: 'Ciencias Naturales (Física, Química, Biología)' },
  { value: 'ingles', label: 'Inglés' },
] as const

export type ModuloRecomendado = (typeof MODULOS_RECOMENDADOS)[number]['value']

/** Nivel sugerido */
export const NIVELES = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
] as const

export type Nivel = (typeof NIVELES)[number]['value']

export interface AIToolData {
  id: string
  nombre: string
  especialidad: string
  modulosRecomendados: string[]
  nivel: Nivel
  urlRedireccion: string
  iconUrl: string | null
  promptsSugeridos: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateAIToolInput {
  nombre: string
  especialidad: string
  modulosRecomendados: string[]
  nivel: Nivel
  urlRedireccion: string
  iconUrl?: string | null
  promptsSugeridos: string[]
  isActive?: boolean
}

export interface UpdateAIToolInput extends Partial<CreateAIToolInput> {}

function parseAIToolDoc(id: string, data: Record<string, unknown>): AIToolData {
  const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? new Date()
  const updatedAt = (data.updatedAt as Timestamp)?.toDate?.() ?? createdAt
  const isActive = data.isActive === undefined ? true : Boolean(data.isActive)
  return {
    id,
    nombre: String(data.nombre ?? ''),
    especialidad: String(data.especialidad ?? ''),
    modulosRecomendados: Array.isArray(data.modulosRecomendados) ? data.modulosRecomendados.map(String) : [],
    nivel: (data.nivel as Nivel) ?? 'intermedio',
    urlRedireccion: String(data.urlRedireccion ?? ''),
    iconUrl: data.iconUrl != null ? String(data.iconUrl) : null,
    promptsSugeridos: Array.isArray(data.promptsSugeridos) ? data.promptsSugeridos.map(String) : [],
    isActive,
    createdAt,
    updatedAt,
  }
}

const MAX_ICON_SIZE_BYTES = 1 * 1024 * 1024 // 1 MB (debe coincidir con storage.rules)
const MAX_ICON_DIMENSION_PX = 800 // Lado máximo para redimensionar (iconos no necesitan más)

/** contentType por extensión (por si file.type viene vacío en algunos navegadores/OS) */
const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Comprime una imagen raster (JPEG/PNG/WEBP) para que no supere maxSizeBytes.
 * Usa Canvas API: redimensiona y reduce calidad hasta cumplir el límite.
 * SVG no se comprime (se devuelve tal cual; si supera tamaño se rechazará después).
 */
async function compressImageForIcon(file: File, maxSizeBytes: number): Promise<File> {
  const contentType = file.type && RASTER_TYPES.includes(file.type) ? file.type : 'image/jpeg'
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return file
  }

  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = objectUrl
  })

  let width = img.width
  let height = img.height
  if (width > MAX_ICON_DIMENSION_PX || height > MAX_ICON_DIMENSION_PX) {
    if (width > height) {
      height = (height * MAX_ICON_DIMENSION_PX) / width
      width = MAX_ICON_DIMENSION_PX
    } else {
      width = (width * MAX_ICON_DIMENSION_PX) / height
      height = MAX_ICON_DIMENSION_PX
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(objectUrl)
    throw new Error('No se pudo obtener el contexto del canvas')
  }
  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(objectUrl)

  let quality = 0.9
  let attempts = 0
  const maxAttempts = 12
  let blob: Blob | null = null

  while (attempts < maxAttempts) {
    blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), contentType, quality)
    })
    if (blob && blob.size <= maxSizeBytes) break
    quality -= 0.08
    attempts++
  }

  if (!blob) throw new Error('No se pudo crear el blob comprimido')
  const compressedFile = new File([blob], file.name, {
    type: contentType,
    lastModified: Date.now(),
  })
  return compressedFile
}

/**
 * Sube el icono de una herramienta IA a Storage y devuelve la URL pública.
 * Si la imagen supera 1 MB, se comprime automáticamente (redimensionado + reducción de calidad).
 * Ruta: AI_Tools_icons/{toolId}/icon.{ext}
 */
export async function uploadAIToolIcon(toolId: string, file: File): Promise<Result<string>> {
  try {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const contentTypeFromExt = ext ? EXT_TO_CONTENT_TYPE[ext] : null
    const contentType = file.type && ALLOWED_CONTENT_TYPES.includes(file.type)
      ? file.type
      : contentTypeFromExt

    if (!contentType) {
      return failure(
        new ErrorAPI({
          message: 'Formato no válido. Use JPEG, PNG, WEBP o SVG (por nombre o extensión).',
          statusCode: 400,
        })
      )
    }

    let fileToUpload = file
    if (file.size > MAX_ICON_SIZE_BYTES) {
      if (contentType === 'image/svg+xml') {
        return failure(
          new ErrorAPI({
            message: `La imagen SVG no puede superar 1 MB (tamaño actual: ${(file.size / 1024).toFixed(1)} KB).`,
            statusCode: 400,
          })
        )
      }
      try {
        fileToUpload = await compressImageForIcon(file, MAX_ICON_SIZE_BYTES)
      } catch (e) {
        console.warn('⚠️ Error al comprimir icono, se intenta subir el original:', e)
      }
      if (fileToUpload.size > MAX_ICON_SIZE_BYTES) {
        return failure(
          new ErrorAPI({
            message: `No se pudo reducir la imagen a menos de 1 MB (quedó en ${(fileToUpload.size / 1024).toFixed(1)} KB). Prueba con otra imagen.`,
            statusCode: 400,
          })
        )
      }
    }

    const outExt = ext || 'png'
    const path = `${AI_TOOLS_ICONS_PATH}/${toolId}/icon.${outExt}`
    const storageRef = ref(storage, path)
    const metadata = { contentType: fileToUpload.type || contentType }
    await uploadBytes(storageRef, fileToUpload, metadata)
    const downloadURL = await getDownloadURL(storageRef)
    return success(downloadURL)
  } catch (e) {
    console.error('❌ Error al subir icono de herramienta IA:', e)
    return failure(new ErrorAPI(normalizeError(e, 'subir icono')))
  }
}

/**
 * Elimina el icono de una herramienta IA de Storage (por URL o por toolId).
 */
export async function deleteAIToolIcon(iconUrlOrToolId: string): Promise<Result<void>> {
  try {
    if (iconUrlOrToolId.startsWith('http')) {
      const url = new URL(iconUrlOrToolId)
      if (!url.pathname.includes('firebasestorage.googleapis.com')) return success(undefined)
      const pathMatch = url.pathname.match(/\/o\/(.+)$/)
      if (!pathMatch?.[1]) return success(undefined)
      const imagePath = decodeURIComponent(pathMatch[1])
      const imageRef = ref(storage, imagePath)
      await deleteObject(imageRef)
    } else {
      const path = `${AI_TOOLS_ICONS_PATH}/${iconUrlOrToolId}`
      const imageRef = ref(storage, path)
      await deleteObject(imageRef)
    }
    return success(undefined)
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'storage/object-not-found') return success(undefined)
    console.error('❌ Error al eliminar icono:', e)
    return failure(new ErrorAPI(normalizeError(e, 'eliminar icono')))
  }
}

class AIToolsService {
  private static instance: AIToolsService

  static getInstance(): AIToolsService {
    if (!AIToolsService.instance) {
      AIToolsService.instance = new AIToolsService()
    }
    return AIToolsService.instance
  }

  /** Lista todas las herramientas IA. Orden: por nombre (A–Z), luego por createdAt (más reciente primero). */
  async getAll(): Promise<Result<AIToolData[]>> {
    try {
      const colRef = collection(db, AI_TOOLS_COLLECTION)
      const snapshot = await getDocs(colRef)
      const list = snapshot.docs.map((d) => parseAIToolDoc(d.id, d.data() as Record<string, unknown>))
      list.sort((a, b) => {
        const byName = a.nombre.localeCompare(b.nombre, 'es')
        if (byName !== 0) return byName
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      return success(list)
    } catch (e) {
      console.error('❌ Error al listar herramientas IA:', e)
      return failure(new ErrorAPI(normalizeError(e, 'listar herramientas IA')))
    }
  }

  /** Comprueba si ya existe una herramienta con el mismo nombre (ignorando mayúsculas). Excluye opcionalmente un id al editar. */
  async existsByName(nombre: string, excludeId?: string): Promise<Result<boolean>> {
    try {
      const res = await this.getAll()
      if (!res.success) return res
      const normalized = nombre.trim().toLowerCase()
      const found = res.data.some(
        (t) => t.nombre.toLowerCase() === normalized && t.id !== excludeId
      )
      return success(found)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'comprobar nombre duplicado')))
    }
  }

  /** Obtiene una herramienta por id */
  async getById(id: string): Promise<Result<AIToolData | null>> {
    try {
      const docRef = doc(db, AI_TOOLS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) return success(null)
      return success(parseAIToolDoc(snap.id, snap.data() as Record<string, unknown>))
    } catch (e) {
      console.error('❌ Error al obtener herramienta IA:', e)
      return failure(new ErrorAPI(normalizeError(e, 'obtener herramienta IA')))
    }
  }

  /** Crea una nueva herramienta IA. El id se genera en Firestore. */
  async create(input: CreateAIToolInput): Promise<Result<AIToolData>> {
    try {
      const colRef = collection(db, AI_TOOLS_COLLECTION)
      const now = Timestamp.now()
      const isActive = input.isActive !== undefined ? input.isActive : true
      const payload = {
        nombre: input.nombre.trim(),
        especialidad: input.especialidad.trim(),
        modulosRecomendados: input.modulosRecomendados,
        nivel: input.nivel,
        urlRedireccion: input.urlRedireccion.trim(),
        iconUrl: input.iconUrl?.trim() || null,
        promptsSugeridos: input.promptsSugeridos.filter((p) => p.trim().length > 0),
        isActive,
        createdAt: now,
        updatedAt: now,
      }
      const docRef = await addDoc(colRef, payload)
      const created: AIToolData = {
        id: docRef.id,
        nombre: payload.nombre,
        especialidad: payload.especialidad,
        modulosRecomendados: payload.modulosRecomendados,
        nivel: payload.nivel,
        urlRedireccion: payload.urlRedireccion,
        iconUrl: payload.iconUrl,
        promptsSugeridos: payload.promptsSugeridos,
        isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      return success(created)
    } catch (e) {
      console.error('❌ Error al crear herramienta IA:', e)
      return failure(new ErrorAPI(normalizeError(e, 'crear herramienta IA')))
    }
  }

  /** Actualiza una herramienta IA existente */
  async update(id: string, input: UpdateAIToolInput): Promise<Result<AIToolData>> {
    try {
      const docRef = doc(db, AI_TOOLS_COLLECTION, id)
      const snap = await getDoc(docRef)
      if (!snap.exists()) {
        return failure(new ErrorAPI({ message: 'Herramienta IA no encontrada', statusCode: 404 }))
      }
      const current = parseAIToolDoc(snap.id, snap.data() as Record<string, unknown>)
      const updated: AIToolData = {
        ...current,
        ...(input.nombre !== undefined && { nombre: input.nombre.trim() }),
        ...(input.especialidad !== undefined && { especialidad: input.especialidad.trim() }),
        ...(input.modulosRecomendados !== undefined && { modulosRecomendados: input.modulosRecomendados }),
        ...(input.nivel !== undefined && { nivel: input.nivel }),
        ...(input.urlRedireccion !== undefined && { urlRedireccion: input.urlRedireccion.trim() }),
        ...(input.iconUrl !== undefined && { iconUrl: input.iconUrl?.trim() || null }),
        ...(input.promptsSugeridos !== undefined && {
          promptsSugeridos: input.promptsSugeridos.filter((p) => p.trim().length > 0),
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      }
      await setDoc(docRef, {
        nombre: updated.nombre,
        especialidad: updated.especialidad,
        modulosRecomendados: updated.modulosRecomendados,
        nivel: updated.nivel,
        urlRedireccion: updated.urlRedireccion,
        iconUrl: updated.iconUrl,
        promptsSugeridos: updated.promptsSugeridos,
        isActive: updated.isActive,
        createdAt: Timestamp.fromDate(updated.createdAt),
        updatedAt: Timestamp.fromDate(updated.updatedAt),
      })
      return success(updated)
    } catch (e) {
      console.error('❌ Error al actualizar herramienta IA:', e)
      return failure(new ErrorAPI(normalizeError(e, 'actualizar herramienta IA')))
    }
  }

  /** Elimina una herramienta IA y opcionalmente su icono en Storage */
  async delete(id: string, options?: { deleteIcon?: boolean }): Promise<Result<void>> {
    try {
      if (options?.deleteIcon) {
        const res = await this.getById(id)
        if (res.success && res.data?.iconUrl) {
          await deleteAIToolIcon(res.data.iconUrl)
        }
      }
      const docRef = doc(db, AI_TOOLS_COLLECTION, id)
      await deleteDoc(docRef)
      return success(undefined)
    } catch (e) {
      console.error('❌ Error al eliminar herramienta IA:', e)
      return failure(new ErrorAPI(normalizeError(e, 'eliminar herramienta IA')))
    }
  }
}

export const aiToolsService = AIToolsService.getInstance()
