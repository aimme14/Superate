import { useAuthContext } from "@/context/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { getUserById } from "@/controllers/user.controller"
import { useInstitution } from "@/hooks/query/useInstitutionQuery"
import { useEffect, useState } from "react"

const Header = () => {
  const { user } = useAuthContext()
  const [institutionId, setInstitutionId] = useState<string | null>(null)

  // Obtener los datos completos del usuario para acceder al institutionId
  const { data: userData } = useQuery({
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
  })

  // Extraer el institutionId del usuario
  useEffect(() => {
    if (userData) {
      // El institutionId puede estar en 'inst', 'institutionId'
      // enrichUserData conserva los campos originales, así que deberían estar disponibles
      const id = (userData as any).inst || (userData as any).institutionId || null
      if (id) {
        setInstitutionId(id)
      }
    } else if (user?.institution) {
      // Si no tenemos userData pero tenemos el nombre de la institución en el contexto,
      // intentamos buscar la institución por nombre (esto es un fallback)
      // Por ahora, dejamos que se muestre el nombre del contexto
      setInstitutionId(null)
    }
  }, [userData, user])

  // Obtener los datos de la institución
  const { data: institution, isLoading: isLoadingInstitution } = useInstitution(
    institutionId || '',
    !!institutionId
  )

  // Determinar qué mostrar: institución del usuario o valores por defecto
  const institutionName = institution?.name || user?.institution || 'Agustina Ferro'
  const institutionLogo = institution?.logo || '/assets/agustina.png'

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        {/* Logo y nombre de la institución a la izquierda */}
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10 flex-shrink-0">
            <img 
              src={institutionLogo} 
              alt={`Logo de ${institutionName}`} 
              className="h-10 w-10 object-contain rounded-md"
              onError={(e) => {
                // Si falla la carga del logo, usar el logo por defecto
                e.currentTarget.src = '/assets/agustina.png'
              }}
            />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            {isLoadingInstitution ? 'Cargando...' : institutionName}
          </span>
        </div>

        {/* Información a la derecha */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-500">Evaluación oficial</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
