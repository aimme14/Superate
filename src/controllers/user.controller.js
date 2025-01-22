import { databaseService } from "@/services/firebase/database.service"

import { success, failure } from "@/interfaces/db.interface"
import { normalizeError } from "@/errors/handler"
import ErrorAPI from "@/errors"

/**
 * Obtiene todos los negocios.
 * @returns {Promise<Result<User[]>>} Una lista de negocios.
 */
export const getUsers = async () => {
  try {
    const result = await databaseService.getAllUsers()
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener lista de negocios'))) }
}

/**
 * Obtiene un negocio por su id, representa el uid del negocio en cuestión (auth).
 * @param {string} id - El identificador del negocio.
 * @returns {Promise<Result<Business>>} Un negocio.
 */
export const getUserById = async (id) => {
  try {
    const result = await databaseService.getUserById(id)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener negocio'))) }
}

/**
 * Busca negocios por nombre.
 * @param {string} query - El término de búsqueda.
 * @returns {Promise<Result<Business[]>>} Una lista de negocios.
 */
export const getUserByQuery = async (query) => {
  try {
    const result = await databaseService.getUserByQuery(query)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'buscar negocios'))) }
}

/**
 * Actualiza un negocio existente.
 * @param {string} id - El identificador del negocio.
 * @param {BusinessUpdateFormProps} business - Los datos del negocio a actualizar.
 * @returns {Promise<Result<void>>} Actualiza un negocio.
 */
export const updateUser = async (id, user) => {
  try {
    const result = await databaseService.updateUser({ id, ...user })
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar negocio'))) }
}

/**
 * Elimina un negocio existente.
 * @param {string} id - El identificador del negocio.
 * @returns {Promise<Result<void>>} Elimina un negocio.
 */
export const deleteUser = async (id) => {
  try {
    const result = await databaseService.deleteUser(id)
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar negocio'))) }
}
/---------------------------------------------------------------------------------------------------------/