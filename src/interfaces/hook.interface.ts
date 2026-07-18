import { UseMutateAsyncFunction } from "@tanstack/react-query"
import { RegisterFormProps } from "@/schemas/auth.schema"

export interface UpdateMutationProps { id: string; data: Partial<any> }
export interface DeleteMutationProps { id: string }

/*--------------------------------------------------to user--------------------------------------------------*/
/*useMutation*/
export type CustomMutation_User = {
  createUser: UseMutateAsyncFunction<any, Error, RegisterFormProps, unknown>
  updateUser: UseMutateAsyncFunction<any, Error, UpdateMutationProps, unknown>
  deleteUser: UseMutateAsyncFunction<any, Error, DeleteMutationProps, unknown>
  isLoading: boolean
}
/*---------------------------------------------------------------------------------------------------------*/