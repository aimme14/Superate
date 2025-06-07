import { UseMutateAsyncFunction, UseQueryResult } from "@tanstack/react-query"
import { RegisterFormProps } from "@/schemas/auth.schema"

export interface UpdateMutationProps { id: string; data: Partial<any> }
export interface DeleteMutationProps { id: string }

/*--------------------------------------------------to user--------------------------------------------------*/
/*useQuery and useMutation*/
export type QueryReact_User = {
  fetchAllUsers: <T>() => UseQueryResult<T[], Error>
  fetchUserById: <T>(id: string, enabled?: boolean) => UseQueryResult<T | undefined, Error>
  // fetchUserByQuery: <T>(query: QueryOptions, enabled?: boolean) => UseQueryResult<T[], Error>
}
export type CustomMutation_User = {
  createUser: UseMutateAsyncFunction<any, Error, RegisterFormProps, unknown>
  updateUser: UseMutateAsyncFunction<any, Error, UpdateMutationProps, unknown>
  deleteUser: UseMutateAsyncFunction<any, Error, DeleteMutationProps, unknown>
  isLoading: boolean
}
/*---------------------------------------------------------------------------------------------------------*/