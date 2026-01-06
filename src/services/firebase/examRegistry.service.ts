import { getFirestore, collection, doc, setDoc, getDoc, getDocs, runTransaction } from 'firebase/firestore'
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

  /**
   * Obtiene datos de uso diario para la gráfica
   * @param {number} days - Número de días a obtener (7 para semana, 30 para mes, 365 para año)
   * @returns {Promise<Result<Array<{date: string, count: number, percentage: number}>>>} - Datos de uso diario
   */
  async getDailyUsage(days: number = 7): Promise<Result<Array<{date: string, count: number, percentage: number}>>> {
    try {
      const registryRef = collection(this.db, this.REGISTRY_COLLECTION)
      const snapshot = await getDocs(registryRef)
      
      // Filtrar solo los registros (excluir el contador)
      const exams = snapshot.docs
        .filter(doc => doc.id !== this.COUNTER_DOC_ID)
        .map(doc => {
          const data = doc.data()
          return {
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
            date: data.timestamp ? new Date(data.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          }
        })

      // Si es vista anual (365 días), agrupar por meses
      if (days === 365) {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setFullYear(endDate.getFullYear() - 1)
        startDate.setMonth(endDate.getMonth())
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)

        // Agrupar por mes
        const monthlyCounts: Record<string, number> = {}
        
        // Inicializar todos los meses del último año con 0
        for (let i = 0; i < 12; i++) {
          const date = new Date(startDate)
          date.setMonth(startDate.getMonth() + i)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthlyCounts[monthKey] = 0
        }

        // Contar exámenes por mes
        exams.forEach(exam => {
          const examDate = new Date(exam.timestamp)
          if (examDate >= startDate && examDate <= endDate) {
            const monthKey = `${examDate.getFullYear()}-${String(examDate.getMonth() + 1).padStart(2, '0')}`
            if (monthlyCounts[monthKey] !== undefined) {
              monthlyCounts[monthKey]++
            }
          }
        })

        // Encontrar el máximo para calcular porcentajes (0-100)
        const maxCount = Math.max(...Object.values(monthlyCounts), 1)

        // Convertir a array y formatear
        const result = Object.entries(monthlyCounts)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([monthKey, count]) => {
            const [year, month] = monthKey.split('-')
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1)
            const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' })
            
            return {
              date: monthName, // Para año: "Ene", "Feb", etc.
              count,
              percentage: Math.round((count / maxCount) * 100)
            }
          })

        return success(result)
      }

      // Para semana y mes, agrupar por día
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - days + 1)
      startDate.setHours(0, 0, 0, 0)

      // Agrupar por día
      const dailyCounts: Record<string, number> = {}
      
      // Inicializar todos los días con 0
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        dailyCounts[dateStr] = 0
      }

      // Contar exámenes por día
      exams.forEach(exam => {
        const examDate = new Date(exam.timestamp)
        if (examDate >= startDate && examDate <= endDate) {
          const dateStr = exam.date
          if (dailyCounts[dateStr] !== undefined) {
            dailyCounts[dateStr]++
          }
        }
      })

      // Encontrar el máximo para calcular porcentajes (0-100)
      const maxCount = Math.max(...Object.values(dailyCounts), 1)

      // Convertir a array y formatear
      const result = Object.entries(dailyCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => {
          const dateObj = new Date(date)
          const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' })
          const dayNumber = dateObj.getDate()
          const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' })
          
          return {
            date: days === 7 
              ? `${dayName} ${dayNumber}` // Para semana: "Lun 15"
              : `${dayNumber} ${monthName}`, // Para mes: "15 Ene"
            count,
            percentage: Math.round((count / maxCount) * 100)
          }
        })

      return success(result)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'obtener uso diario')))
    }
  }
}

export const examRegistryService = ExamRegistryService.getInstance()

