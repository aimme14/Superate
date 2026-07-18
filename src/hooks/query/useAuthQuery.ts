import { CustomMutation_User, DeleteMutationProps, UpdateMutationProps } from '@/interfaces/hook.interface'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import { QueryOptions } from '@/interfaces/props.interface'
import { RegisterFormProps } from '@/schemas/auth.schema'
import { useAuthContext } from '@/context/AuthContext'
import { currentUserQueryKey } from './useCurrentUser'

// Keys constantes para mejor mantenimiento
const QUERY_KEYS = {
  users: () => ['users'],
  user: (id: string) => ['user', id],
  currentUser: (id: string) => currentUserQueryKey(id),
  search: (query: QueryOptions) => ['users', 'search', query]
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------useQuery--------------------------------------------------*/
/** Hook para obtener todos los usuarios. */
export const useAllUsers = <T>() => {
  const user = useAuthContext()
  return useQuery({
    queryFn: () => user.getAll<T>(),
    queryKey: QUERY_KEYS.users(),
    select: (data) => data || [],
    initialData: [],
    ...ADMIN_LIST_CACHE,
  })
}

/**
 * Hook para obtener un usuario por ID.
 * @param {string} id - Corresponde al id del usuario
 * @param {boolean} enabled - Indica si la consulta debe ejecutarse
 */
export const useUserById = <T>(id: string, enabled: boolean = true) => {
  const user = useAuthContext()
  return useQuery({
    queryKey: QUERY_KEYS.user(id),
    queryFn: () => user.getById<T>(id, enabled),
    select: (data) => data || undefined,
    enabled: Boolean(id) && enabled,
  })
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------useMutation--------------------------------------------------*/
/** Hook personalizado para gestionar mutaciones de usuarios */
export const useUserMutation = (): CustomMutation_User => {
  const { signup, update, delete: deleteUser } = useAuthContext()
  const queryClient = useQueryClient()

  /**
   * Mutation para crear un formato
   * @param {object} data - La data del documento a crear.
   * @returns {Promise<any>} Los datos del formato creado.
   */
  const createMutation = useMutation({
    mutationFn: async (data: RegisterFormProps) => await signup(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() })
  })

  /**
   * Mutation para actualizar un usuario
   * @param {object} data - La data del documento a actualizar.
   * @returns {Promise<any>} Los datos del usuario actualizado.
   */
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: UpdateMutationProps) => await update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.user(variables.id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentUser(variables.id) })
    }
  })

  /**
   * Mutation para eliminar un formato
   * @param {string} _id - Corresponde al uid default del formato.
   * @returns {Promise<any>} Los datos del formato eliminado.
   */
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: DeleteMutationProps) => await deleteUser(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() })
      queryClient.removeQueries({ queryKey: QUERY_KEYS.user(variables.id) })
    }
  })

  return {
    createUser: createMutation.mutateAsync,
    updateUser: updateMutation.mutateAsync,
    deleteUser: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  }
}