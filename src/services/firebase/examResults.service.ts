import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getPhaseName } from '@/utils/firestoreHelpers'
import { examRegistryService } from '@/services/firebase/examRegistry.service'
import { success, failure, Result } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { normalizeError } from '@/errors/handler'

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
  [key: string]: unknown
}

/**
 * Guarda los resultados del examen en Firestore (results/{userId}/{phaseName}/{examId})
 * y registra la prueba en el contador central (examRegistry) para el dashboard del admin.
 *
 * Si el registro en el contador falla, no se revierte la guardada: el examen queda
 * guardado y se registra el error en consola (mejor práctica: no fallar la operación
 * principal por un fallo en el contador).
 *
 * @param userId - ID del estudiante
 * @param examId - ID del examen
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

    const docRef = doc(db, 'results', userId, phaseName, examId)
    const payload = {
      ...examData,
      phase: examData.phase,
      timestamp: Date.now(),
    }

    await setDoc(docRef, payload)

    console.log(
      `[examResults] ✅ Examen guardado: results/${userId}/${phaseName}/${examId}`
    )

    // Registrar en el contador central (no fallar la operación si falla el registro)
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

    return success({ id: `${userId}_${examId}` })
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
