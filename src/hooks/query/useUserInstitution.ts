import { useAuthContext } from "@/context/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { getUserById } from "@/controllers/user.controller"
import { useInstitution } from "./useInstitutionQuery"
import { useEffect, useState } from "react"

/**
 * Hook para obtener la información de la institución del usuario autenticado
 * @returns {Object} Objeto con el nombre y logo de la institución, y estado de carga
 */
export const useUserInstitution = () => {
  const { user } = useAuthContext()
  const [institutionId, setInstitutionId] = useState<string | null>(null)

  // Obtener los datos completos del usuario para acceder al institutionId
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null
      const result = await getUserById(user.uid)
      if (result.success) {
        return result.data
      }
      return null
    },
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000, // 5 min - usuario cambia poco, evita refetch al navegar
  })

  // Extraer el institutionId del usuario
  useEffect(() => {
    if (userData) {
      // El institutionId puede estar en 'inst', 'institutionId'
      const id = (userData as any).inst || (userData as any).institutionId || null
      if (id) {
        setInstitutionId(id)
      } else {
        setInstitutionId(null)
      }
    } else {
      setInstitutionId(null)
    }
  }, [userData])

  // Obtener los datos de la institución
  const { data: institution, isLoading: isLoadingInstitution } = useInstitution(
    institutionId || '',
    !!institutionId
  )

  // Validar que la institución esté activa
  const isInstitutionActive = institution ? institution.isActive === true : true

  // Determinar qué mostrar: institución del usuario o valores por defecto
  const institutionName = institution?.name || user?.institution || 'Colegio'
  const institutionLogo = institution?.logo || '/assets/agustina.png'

  return {
    institutionName,
    institutionLogo,
    institution,
    isInstitutionActive,
    isLoading: isLoadingUser || isLoadingInstitution,
  }
}

