import { success, failure, Result, User } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import { RegisterFormProps } from "@/schemas/auth.schema"
import { normalizeError } from "@/errors/handler"
import ErrorAPI from "@/errors"

/**
 * Obtiene todos los usuarios.
 * @returns {Promise<Result<User[]>>} Una lista de usuarios.
 */
export const getUsers = async (): Promise<Result<User[]>> => {
  try {
    const result = await dbService.getAllUsers()
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener lista de usuarios'))) }
}

/**
 * Obtiene un usuario por su id, representa el uid del usuario en cuestión (auth).
 * @param {string} id - El identificador del usuario.
 * @returns {Promise<Result<User>>} Un usuario.
 */
export const getUserById = async (id: string): Promise<Result<User>> => {
  try {
    const result = await dbService.getUserById(id)
    if (!result.success) throw result.error
    
    // Enriquecer los datos del usuario con nombres de institución, sede y grado
    const enrichedUser = await dbService.enrichUserData(result.data)
    if (!enrichedUser.success) {
      console.warn('No se pudieron enriquecer los datos del usuario:', enrichedUser.error)
      return success(result.data) // Retornar datos sin enriquecer si falla
    }
    
    return success(enrichedUser.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener usuario'))) }
}

/**
 * Busca usuarios por nombre.
 * @param {string} query - El término de búsqueda.
 * @returns {Promise<Result<Business[]>>} Una lista de usuarios.
 */
export const getUserByQuery = async (query: string): Promise<Result<User[]>> => {
  try {
    const result = await dbService.getUserByQuery(query)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'buscar usuarios'))) }
}

/**
 * Actualiza un usuario existente.
 * @param {string} id - El identificador del usuario.
 * @param {RegisterFormProps} user - Los datos del usuario a actualizar.
 * @returns {Promise<Result<void>>} Actualiza un usuario.
 */
export const updateUser = async (id: string, user: RegisterFormProps): Promise<Result<void>> => {
  try {
    const result = await dbService.updateUser(id, { ...user })
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario'))) }
}

/**
 * Elimina un usuario existente.
 * @param {string} id - El identificador del usuario.
 * @returns {Promise<Result<void>>} Elimina un usuario.
 */
export const deleteUser = async (id: string): Promise<Result<void>> => {
  try {
    const result = await dbService.deleteUser(id)
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar usuario'))) }
}
/*---------------------------------------------------------------------------------------------------------*/