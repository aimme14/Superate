import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getPhaseName, getAllPhases } from '@/utils/firestoreHelpers'
import { examRegistryService } from '@/services/firebase/examRegistry.service'
import { success, failure, Result } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { normalizeError } from '@/errors/handler'
import { subjectLabelToSlug } from '@/utils/subjectResultDocId'

const db = getFirestore(firebaseApp)

/** Fase del examen para el registro (first | second | third) */
export type ExamPhase = 'first' | 'second' | 'third'

/**
 * Datos mínimos del examen para guardar y registrar.
 * phase debe ser first | second | third (o string equivalente).
 * subject o examTitle para el registro en el contador.
 */
export interface ExamResultData {
  phase: ExamPhase | string
  subject?: string
  examTitle?: string
  examId?: string
  [key: string]: unknown
}

/**
 * ID del documento en Firestore: slug de materia (máx. 7 por fase) o examId si no hay slug.
 */
export function resolveExamResultDocId(params: {
  subject?: string
  examTitle?: string
  examId: string
}): string {
  const slug = subjectLabelToSlug(params.subject || params.examTitle || '')
  if (slug) return slug
  return params.examId
}

/**
 * Busca un resultado ya guardado por id de cuestionario y/o materia.
 * Compatible con docs antiguos (id = examId del quiz) y nuevos (id = slug de materia).
 */
export async function fetchExamResultDocument(
  userId: string,
  quizExamId: string,
  phase?: 'first' | 'second' | 'third',
  opts?: { subject?: string; examTitle?: string }
): Promise<DocumentData | null> {
  const resolved = resolveExamResultDocId({
    subject: opts?.subject,
    examTitle: opts?.examTitle,
    examId: quizExamId,
  })

  const tryPhase = async (phaseFolderName: string): Promise<DocumentData | null> => {
    const r1 = doc(db, 'results', userId, phaseFolderName, resolved)
    const s1 = await getDoc(r1)
    if (s1.exists()) return s1.data() ?? null
    if (resolved !== quizExamId) {
      const r2 = doc(db, 'results', userId, phaseFolderName, quizExamId)
      const s2 = await getDoc(r2)
      if (s2.exists()) return s2.data() ?? null
    }
    const col = collection(db, 'results', userId, phaseFolderName)
    const snap = await getDocs(col)
    for (const d of snap.docs) {
      const data = d.data()
      if (data?.examId === quizExamId) return data
    }
    return null
  }

  if (phase) {
    const phaseName = getPhaseName(phase)
    const data = await tryPhase(phaseName)
    if (data) return data
  } else {
    for (const phaseFolderName of getAllPhases()) {
      const data = await tryPhase(phaseFolderName)
      if (data) return data
    }
  }

  // Compatibilidad legacy: antes se guardaba en results/{userId} como objeto plano.
  // En reglas actuales esa ruta puede estar denegada; no debe romper la carga del quiz.
  try {
    const oldDocRef = doc(db, 'results', userId)
    const oldDocSnap = await getDoc(oldDocRef)
    if (oldDocSnap.exists()) {
      const raw = oldDocSnap.data() as Record<string, unknown>
      const entry = raw[quizExamId]
      if (entry && typeof entry === 'object') return entry as DocumentData
    }
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'permission-denied') {
      console.warn('[examResults] Lectura legacy results/{userId} denegada por reglas. Se omite fallback legacy.')
    } else {
      throw error
    }
  }
  return null
}

/**
 * Elimina otros documentos de la misma fase que correspondan a la misma materia (slug),
 * tras guardar en `storageDocId` (p. ej. intentos viejos con id = examId del quiz).
 */
async function removeObsoleteSameSubjectDocs(
  userId: string,
  phaseName: string,
  storageDocId: string,
  examData: ExamResultData
): Promise<void> {
  const slug = subjectLabelToSlug(
    (examData.subject as string) || (examData.examTitle as string) || ''
  )
  if (!slug) return

  const phaseCol = collection(db, 'results', userId, phaseName)
  const snap = await getDocs(phaseCol)
  const toDelete = snap.docs.filter((d) => {
    if (d.id === storageDocId) return false
    const otherSlug = subjectLabelToSlug(
      (d.data()?.subject as string) || (d.data()?.examTitle as string) || ''
    )
    return otherSlug === slug
  })
  await Promise.all(toDelete.map((d) => deleteDoc(d.ref)))
}

/**
 * Guarda los resultados del examen en Firestore (results/{userId}/{phaseName}/{docId})
 * con docId = slug de materia cuando aplica (un solo documento por materia y fase).
 * y registra la prueba en el contador central (examRegistry) para el dashboard del admin.
 *
 * @param userId - ID del estudiante
 * @param examId - ID del cuestionario (quiz); se guarda también en el campo examId del payload
 * @param examData - Datos del examen (phase, subject o examTitle, y el resto que se guarda)
 * @returns Result con success y id compuesto, o failure si falla la guardada
 */
export async function saveExamResultsAndRegister(
  userId: string,
  examId: string,
  examData: ExamResultData
): Promise<Result<{ id: string }>> {
  try {
    const phase = normalizePhase(examData.phase)
    const phaseName = getPhaseName(phase)

    const storageDocId = resolveExamResultDocId({
      subject: examData.subject as string | undefined,
      examTitle: examData.examTitle as string | undefined,
      examId,
    })

    const payload = {
      ...examData,
      examId,
      phase: examData.phase,
      timestamp: Date.now(),
    }

    const docRef = doc(db, 'results', userId, phaseName, storageDocId)
    await setDoc(docRef, payload)

    await removeObsoleteSameSubjectDocs(userId, phaseName, storageDocId, examData)

    console.log(
      `[examResults] ✅ Examen guardado: results/${userId}/${phaseName}/${storageDocId} (quizId=${examId})`
    )

    const subject =
      (examData.subject || examData.examTitle || 'Sin materia') as string
    try {
      const registryResult = await examRegistryService.registerExam(
        subject,
        phase,
        userId,
        examId
      )
      if (registryResult.success) {
        console.log(
          `[examResults] ✅ Prueba registrada: #${registryResult.data.number} - ${subject} - ${phaseName}`
        )
      } else {
        console.warn(
          '[examResults] ⚠️ No se pudo registrar la prueba en el contador:',
          registryResult.error
        )
      }
    } catch (err) {
      console.error('[examResults] ❌ Error al registrar prueba:', err)
    }

    return success({ id: `${userId}_${storageDocId}` })
  } catch (e) {
    console.error('[examResults] ❌ Error al guardar examen:', e)
    return failure(new ErrorAPI(normalizeError(e, 'guardar resultados del examen')))
  }
}

/**
 * Normaliza el valor de fase a first | second | third para registerExam.
 */
function normalizePhase(phase: string | undefined): ExamPhase {
  if (!phase) return 'first'
  const p = String(phase).toLowerCase()
  if (p === 'second' || p === '2') return 'second'
  if (p === 'third' || p === '3') return 'third'
  return 'first'
}
