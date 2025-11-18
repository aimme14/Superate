import RegisterSection from "@/sections/register/RegisterSection"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

const RegisterPage = () => {
  const { theme } = useThemeContext()
  const { isAuth } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => { if (isAuth) navigate('/dashboard') }, [isAuth])

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