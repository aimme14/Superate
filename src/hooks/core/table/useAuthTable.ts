import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useUserMutation } from "@/hooks/query/useAuthQuery"
import { useQueryUser } from "@/hooks/query/useAuthQuery"
import { User } from "@/interfaces/context.interface"

/*--------------------------------------------------user table--------------------------------------------------*/
/** Hook principal que orquesta los sub-hooks de usuarios para la tabla */
export const useUserTable = () => {
  const [onDelete, setOnDelete] = useState<User | undefined>(undefined)
  const { deleteUser: _delete } = useUserMutation()
  const isProcessing = useRef<boolean>(false)

  const { data: users } = useQueryUser().fetchAllUsers<User>()

  /**
   * Función que se ejecuta cuando se elimina un usuario
   * @param {User} user - Usuario a eliminar, contiene referencias
   */
  const deleteUser = useCallback(async (user: User) => {
    if (isProcessing.current) return
    isProcessing.current = true
    await _delete({ id: user.uid }).finally(() => { setOnDelete(undefined); isProcessing.current = false })
  }, [_delete])

  /** just one useEffect */
  useEffect(() => { onDelete && deleteUser(onDelete) }, [onDelete, deleteUser])

  return {
    users: useMemo(() => users, [users]),
    handleDelete: (user: User) => setOnDelete(user)
  }
}
/*---------------------------------------------------------------------------------------------------------*/