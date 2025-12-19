import { useQueryUser, useUserMutation } from "@/hooks/query/useAuthQuery"
import { useFormSubmit } from "@/hooks/core/useFormSubmit"
import { User } from "@/interfaces/context.interface"
import { zodResolver } from "@hookform/resolvers/zod"

import { useAuthContext } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import {
  loginSchema, LoginFormProps,
  registerSchema, RegisterFormProps,
  forgotPasswordSchema, ForgotPasswordFormProps,
} from "@/schemas/auth.schema"

/*--------------------------------------------------login form--------------------------------------------------*/
/** Hook personalizado para manejar el formulario de inicio de sesión */
export const useLoginForm = () => {
  const { signin } = useAuthContext()
  const methods = useForm<LoginFormProps>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  })
  const onSubmit = methods.handleSubmit(async (data: LoginFormProps) => await signin(data))
  return { methods, onSubmit }
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------forgotPassword form--------------------------------------------------*/
/** Hook personalizado para manejar el formulario de recuperación de contraseña */
export const useForgotPasswordForm = () => {
  const { sendResetPassword } = useAuthContext()
  const methods = useForm<ForgotPasswordFormProps>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit',
  })
  const onSubmit = methods.handleSubmit(async (data: ForgotPasswordFormProps) => await sendResetPassword(data.email))
  return { methods, onSubmit }
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------user form--------------------------------------------------*/
/**
 * Hook personalizado para manejar el formulario de creación o actualización de usuarios
 * @param id - ID del usuario a actualizar, si no se proporciona, la request corresponde a crear
 * @param to - Contexto del formulario usuario, actualmente manejados: company, client, engineer, admin
 * @param onSuccess - Función a ejecutar cuando el formulario se envía correctamente
 */
export const useUserForm = (id?: string, onSuccess?: () => void) => {
  const { createUser, updateUser } = useUserMutation()
  const queryUser = useQueryUser()

  const { data: user } = queryUser.fetchUserById<User>(id as string, !!id)

  const methods = useForm<RegisterFormProps>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'student' as const,
      userdoc: '',
      email: '',
      username: '',
      inst: '',
      campus: '',
      grade: '',
      representativePhone: '',
    },
    mode: "onChange",
  })

  useEffect(() => {
    id && user && methods.reset({ 
      role: 'student' as const,
      userdoc: user.userdoc || '',
      email: user.email,
      username: user.displayName || '',
      inst: user.institution || '',
      campus: user.campus || '',
      grade: user.grade || '',
      representativePhone: (user as any).representativePhone || ''
    })
  }, [id, user])

  const handleSubmit = useFormSubmit({
    onSubmit: async (data: RegisterFormProps) => {
      id
        ? (updateUser({ id, data }))
        : (createUser(data))
      methods.reset()
    },
    onSuccess
  }, methods)

  return {
    methods,
    ...handleSubmit
  }
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------client flow--------------------------------------------------*/
/**
 * Hook personalizado para manejar el formulario de creación de nuevo cliente
 * @param onSuccess - Función a ejecutar cuando el formulario se envía correctamente
 */
export const useClientFlow = (onSuccess?: () => void) => {
  const [currentStep, setCurrentStep] = useState<'client' | 'headquarter' | 'office'>('client')
  const { signup: createUser } = useAuthContext()

  const methods = useForm<RegisterFormProps>({
    resolver: zodResolver(registerSchema),
    defaultValues: {},
    mode: "onChange"
  })

  const handleSubmit = useFormSubmit({
    onSubmit: async (data: RegisterFormProps) => {
      await createUser(data)
      methods.reset()
    },
    onSuccess
  }, methods)

  return {
    methods,
    currentStep,
    setCurrentStep,
    ...handleSubmit,
    options: { headquarter: { cities: [] } }
  }
}
/*---------------------------------------------------------------------------------------------------------*/