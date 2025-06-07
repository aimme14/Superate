import { create } from 'zustand'

interface LoadingState {
  start: (text?: string) => void
  show: (text?: string) => void
  hide: () => void
  end: () => void
  activeRequests: number
  isLoading: boolean
  text: string
}

export const useLoadingScreen = create<LoadingState>((set, get) => ({
  isLoading: false,
  activeRequests: 0,
  text: 'Cargando...',
  show: (text = 'Cargando...') => {
    const { activeRequests } = get()
    set({ text, isLoading: true, activeRequests: Math.max(1, activeRequests) })
  },
  hide: () => {
    const { activeRequests } = get()
    if (activeRequests === 0) set({ isLoading: false, text: '' })
  },
  start: (text = 'Cargando...') => {
    const { activeRequests } = get()
    const newCount = activeRequests + 1
    set({ isLoading: true, activeRequests: newCount, text: activeRequests === 0 ? text : get().text })
  },
  end: () => {
    const { activeRequests } = get()
    const newCount = Math.max(0, activeRequests - 1)
    set({ isLoading: newCount > 0, activeRequests: newCount, text: newCount > 0 ? get().text : '' })
  }
}))

/**
 * Hook para manejar operaciones asíncronas con estado de carga
 * @param message Mensaje a mostrar durante la carga
 * @returns Función wrapper para manejar la operación con loading
 */
export const useLoading = () => {
  const { start, end } = useLoadingScreen()

  const handler = async <T,>(message: string, operation: () => Promise<T>) => {
    start(message)
    try { return await operation() }
    finally { end() }
  }

  return { handler }
}