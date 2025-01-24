import { databaseService } from "@/services/firebase/database.service"

import { success, failure } from "@/interfaces/db.interface"
import { normalizeError } from "@/errors/handler"
import ErrorAPI from "@/errors"

/**
 * Obtiene todas las pruebas.
 * @returns {Promise<Result<User[]>>} Una lista de pruebas.
 */
export const getTest = async () => {
  try {
    const result = await databaseService.getAllUsers()
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener lista de negocios'))) }
}

/**
 * Define una prueba
 * @param {string} id - El identificador de la prueba.
 * @returns {Promise<Result<Business>>} Una prueba.
 */
export const setTest = async (data) => {
  try {
    const result = await databaseService.setTest(data)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener prueba'))) }
}

export const getTestState = async () => {
  try {
    const result = await databaseService.getTestState()
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener estado de pruebas')))
  }
}

export const toggleTest = async (testNumber) => {
  try {
    const result = await databaseService.toggleTest(testNumber)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'cambiar estado de prueba')))
  }
}