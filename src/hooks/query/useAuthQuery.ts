import { CustomMutation_User, DeleteMutationProps, QueryReact_User, UpdateMutationProps } from '@/interfaces/hook.interface'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { QueryOptions } from '@/interfaces/props.interface'
import { RegisterFormProps } from '@/schemas/auth.schema'
import { useAuthContext } from '@/context/AuthContext'

// Keys constantes para mejor mantenimiento
const QUERY_KEYS = {
  users: () => ['users'],
  user: (id: string) => ['user', id],
  search: (query: QueryOptions) => ['users', 'search', query]
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------useQuery--------------------------------------------------*/
/** Hook personalizado para gestionar consultas de usuarios */
export const useQueryUser = (): QueryReact_User => {
  const user = useAuthContext()

  /** Obtener todos los usuarios */
  const fetchAllUsers = <T>() => useQuery({
    queryFn: () => user.getAll<T>(),
    queryKey: QUERY_KEYS.users(),
    select: (data) => data || [],
    initialData: []
  })

  /**
   * Obtener usuario por ID
   * @param {string} id - Corresponde al id del usuario
   * @param {boolean} enabled - Indica si la consulta debe ejecutarse
   */
  const fetchUserById = <T>(id: string, enabled: boolean = true) => useQuery({
    queryKey: QUERY_KEYS.user(id),
    queryFn: () => user.getById<T>(id, enabled),
    select: (data) => data || undefined,
    enabled: Boolean(id) && enabled
  })

  /**
   * Buscar usuario por término
   * @param {object} query - Elementos de busqueda
   * @param {boolean} enabled - Indica si la consulta debe ejecutarse
   */
  //const fetchUserByQuery = (query: QueryOptions, enabled: boolean = true) => useQuery({ //disabled temporally
  //  queryFn: () => user.getByQuery<T>(query, enabled),
  //  queryKey: QUERY_KEYS.search(query),
  //  enabled: Boolean(query) && enabled,
  //  select: (data) => data || [],
  //})

  return {
    fetchAllUsers,
    fetchUserById
  }
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