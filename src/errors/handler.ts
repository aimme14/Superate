import { Result, success, failure } from '@/interfaces/db.interface'
import HandlerErrorsFB from '@/errors/firebase.error'
import { FirebaseError } from 'firebase/app'
import ErrorAPI from '@/errors'

/*--------------------------------------------------handlers--------------------------------------------------*/
/**
 * Maneja operaciones asíncronas de los servicios, devolviendo un Result<T> (success o failure).
 * @param {Function} operation - La operación asíncrona a ejecutar.
 * @param {string} context - Representa el contexto en el que ocurrió el error, suele referirse a la operación.
 * @returns {Promise<Result<T>>} - Un resultado que puede ser exitoso o fallido.
 */
export const handlerService = async <T>(operation: () => Promise<T>, context: string): Promise<Result<T>> => {
  try { return success(await operation()) }
  catch (e) { return failure(normalizeError(e, context)) }
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
/**
 * Justifica el error en formato de ErrorAPI.
 * Normaliza nuestro "e" unknown a nuestro ErrorAPI.
 * @param {unknown} e - El error a normalizar, puede ser de tipo FirebaseError.
 * @param {string} context - Representa el contexto en el que ocurrió el error, suele referirse a la operación.
 * @returns {ErrorAPI} - El error normalizado al formato de ErrorAPI, si pertenece a ninguna instancia, se crea uno nuevo.
 * @example if (!result.success) throw new ErrorAPI({ message: 'Error de prueba', statusCode: 500 })
 */
export const normalizeError = (e: unknown, context: string): ErrorAPI => {
  if (e instanceof FirebaseError) return HandlerErrorsFB(e)
  if (e instanceof ErrorAPI) return e
  return new ErrorAPI({ message: `Error al ${context}: ${e instanceof Error ? e.message : String(e)}` })
}
/*---------------------------------------------------------------------------------------------------------*/