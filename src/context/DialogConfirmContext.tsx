import { DialogConfig, DialogConfirmContext } from '@/interfaces/context.interface'
import { createContext, useContext, useState } from 'react'
import { Props } from '@/interfaces/props.interface'

const DialogConfirm = createContext<DialogConfirmContext>(undefined)

/**
 * Hook personalizado para acceder al contexto de confirmación de acciones.
 * @throws {Error} Si se intenta usar fuera del ActionConfirmProvider.
 */
export const useDialogConfirmContext = () => {
  const context = useContext(DialogConfirm)
  if (!context) throw new Error('useDialogConfirm must be used within a DialogConfirmProvider')
  return context
}

/**
 * Proveedor del contexto de confirmación de acciones.
 * @param {Props} props - Las propiedades del componente.
 * @returns {JSX.Element} Elemento JSX que envuelve a los hijos con el contexto de confirmación de acciones.
 */
export const DialogConfirmProvider = ({ children }: Props): JSX.Element => {
  const [currentAction, setCurrentAction] = useState<DialogConfig>(null)
  const [show, setShow] = useState(false)

  const handleConfirm = async () => {
    try { await currentAction?.action() }
    finally { setShow(false); setCurrentAction(null) }
  }

  const confirmAction = (config: DialogConfig) => {
    setCurrentAction(config)
    setShow(true)
  }

  return (
    <DialogConfirm.Provider value={{
      description: currentAction?.description || '¿Estás seguro?',
      isDestructive: currentAction?.isDestructive || false,
      title: currentAction?.title || 'Confirmación',
      handleConfirm,
      confirmAction,
      setShow,
      show,
    }}>
      {children}
    </DialogConfirm.Provider>
  )
}