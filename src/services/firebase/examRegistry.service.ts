import { getFirestore, collection, doc, setDoc, getDoc, runTransaction } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { getPhaseName } from '@/utils/firestoreHelpers'
import { success, failure, Result } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { normalizeError } from '@/errors/handler'

/**
 * Interfaz para el registro de una prueba presentada
 */
export interface ExamRegistry {
  number: number
  subject: string
  phase: string // 'Fase I', 'Fase II', 'Fase III'
  timestamp: Date
  userId?: string
  examId?: string
}

/**
 * Servicio para registrar pruebas presentadas en el sistema
 */
class ExamRegistryService {
  private static instance: ExamRegistryService
  private db = getFirestore(firebaseApp)
  private readonly COUNTER_DOC_ID = 'examCounter'
  private readonly REGISTRY_COLLECTION = 'examRegistry'

  private constructor() {}

  static getInstance(): ExamRegistryService {
    if (!ExamRegistryService.instance) {
      ExamRegistryService.instance = new ExamRegistryService()
    }
    return ExamRegistryService.instance
  }

  /**
   * Obtiene el siguiente número de prueba usando un contador atómico
   * @returns {Promise<Result<number>>} - El siguiente número de prueba
   */
  async getNextExamNumber(): Promise<Result<number>> {
    try {
      const counterRef = doc(this.db, this.REGISTRY_COLLECTION, this.COUNTER_DOC_ID)

      const result = await runTransaction(this.db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef)
        
        let currentCount = 0
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count || 0
        }

        const nextCount = currentCount + 1
        
        // Actualizar el contador
        transaction.set(counterRef, { count: nextCount }, { merge: true })
        
        return nextCount
      })

      return success(result)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'obtener siguiente número de prueba')))
    }
  }

  /**
   * Registra una nueva prueba presentada
   * @param {string} subject - Nombre de la materia
   * @param {string | 'first' | 'second' | 'third'} phase - Fase del examen
   * @param {string} userId - ID del usuario que presentó la prueba (opcional)
   * @param {string} examId - ID del examen (opcional)
   * @returns {Promise<Result<ExamRegistry>>} - El registro de la prueba
   */
  async registerExam(
    subject: string,
    phase: string | 'first' | 'second' | 'third',
    userId?: string,
    examId?: string
  ): Promise<Result<ExamRegistry>> {
    try {
      // Obtener el siguiente número de prueba
      const numberResult = await this.getNextExamNumber()
      if (!numberResult.success) {
        throw numberResult.error
      }

      // Normalizar el nombre de la fase
      const phaseName = getPhaseName(phase)

      // Crear el registro
      const registry: ExamRegistry = {
        number: numberResult.data,
        subject: subject.trim(),
        phase: phaseName,
        timestamp: new Date(),
        userId: userId,
        examId: examId
      }

      // Guardar el registro en Firestore
      const registryRef = doc(collection(this.db, this.REGISTRY_COLLECTION))
      await setDoc(registryRef, {
        ...registry,
        timestamp: registry.timestamp.toISOString()
      })

      console.log(`✅ Prueba registrada: #${registry.number} - ${registry.subject} - ${registry.phase}`)

      return success(registry)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'registrar prueba')))
    }
  }

  /**
   * Obtiene el total de pruebas registradas
   * @returns {Promise<Result<number>>} - Total de pruebas registradas
   */
  async getTotalExams(): Promise<Result<number>> {
    try {
      const counterRef = doc(this.db, this.REGISTRY_COLLECTION, this.COUNTER_DOC_ID)
      const counterDoc = await getDoc(counterRef)
      
      if (counterDoc.exists()) {
        const count = counterDoc.data().count || 0
        return success(count)
      }
      
      return success(0)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'obtener total de pruebas')))
    }
  }
}

export const examRegistryService = ExamRegistryService.getInstance()

