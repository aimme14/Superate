import { useAuthContext } from "@/context/AuthContext"
import { useInstitution } from "./useInstitutionQuery"
import { useCurrentUser } from "./useCurrentUser"
import { useEffect, useState, useMemo } from "react"

/**
 * Hook para obtener la información de la institución del usuario autenticado
 * @returns {Object} Objeto con el nombre y logo de la institución, y estado de carga
 */
export const useUserInstitution = () => {
  const { user } = useAuthContext()
  const [institutionId, setInstitutionId] = useState<string | null>(null)

  // Reutiliza el query persistido de AuthContext:
  // - evita una lectura duplicada ('user' vs 'currentUser')
  // - reduce lecturas al recargar gracias a persistencia en localStorage.
  const { data: userData, isLoading: isLoadingUser } = useCurrentUser(user?.uid)

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

  const isAdmin = useMemo(() => userData?.role === 'admin', [userData?.role])

  // Obtener los datos de la institución (los admin no requieren institución en Firestore)
  const { data: institution, isLoading: isLoadingInstitution } = useInstitution(
    institutionId || '',
    Boolean(institutionId) && !isAdmin
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

