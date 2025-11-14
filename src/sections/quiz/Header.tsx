import { useUserInstitution } from "@/hooks/query/useUserInstitution"

const Header = () => {
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution()

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="w-full px-2 py-2 flex items-center justify-between">
        {/* Logo y nombre de la institución a la izquierda */}
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10 flex-shrink-0">
            <img 
              src={institutionLogo} 
              alt={`Logo de ${institutionName}`} 
              className="h-10 w-10 object-contain rounded-md"
              onError={(e) => {
                // Si falla la carga del logo, usar el logo por defecto
                e.currentTarget.src = institutionLogo || '/assets/agustina.png'
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
