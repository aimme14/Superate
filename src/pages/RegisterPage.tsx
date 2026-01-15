import RegisterSection from "@/sections/register/RegisterSection"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useRegistrationConfig } from "@/hooks/query/useRegistrationConfig"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

const RegisterPage = () => {
  const { theme } = useThemeContext()
  const { isAuth } = useAuthContext()
  const navigate = useNavigate()
  const { isEnabled: registrationEnabled, isLoading } = useRegistrationConfig()

  useEffect(() => { 
    if (isAuth) navigate('/dashboard') 
  }, [isAuth, navigate])

  useEffect(() => {
    if (!isLoading && !registrationEnabled) {
      // Redirigir a home si el registro está deshabilitado
      navigate('/', { replace: true })
    }
  }, [registrationEnabled, isLoading, navigate])

  // Mostrar mensaje mientras carga
  if (isLoading) {
    return (
      <div className={cn(
        "flex justify-center items-center",
        "px-4 py-4",
        "w-full flex-1",
        "relative"
      )}>
        <div className={cn("text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  // Si el registro está deshabilitado, mostrar mensaje (aunque se redirigirá)
  if (!registrationEnabled) {
    return (
      <div className={cn(
        "flex justify-center items-start",
        "px-4 py-4",
        "w-full flex-1",
        "relative"
      )}>
        <Alert variant="destructive" className="max-w-md mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Registro deshabilitado</AlertTitle>
          <AlertDescription>
            El registro de nuevos usuarios está actualmente deshabilitado. Por favor, contacta al administrador del sistema.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex justify-center items-start",
      "px-4 py-4",
      "w-full flex-1",
      "relative"
    )}>
      <RegisterSection theme={theme} id={undefined} />
    </div>
  )
}

export default RegisterPage