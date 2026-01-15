import { useQueryUser, useUserMutation } from "@/hooks/query/useAuthQuery"
import { useFormSubmit } from "@/hooks/core/useFormSubmit"
import { User } from "@/interfaces/context.interface"
import { zodResolver } from "@hookform/resolvers/zod"

import { useAuthContext } from "@/context/AuthContext"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useRegistrationConfig } from "@/hooks/query/useRegistrationConfig"
import { useNotification } from "@/hooks/ui/useNotification"
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
  const { isEnabled: registrationEnabled, isLoading: isLoadingConfig } = useRegistrationConfig()
  const { notifyError } = useNotification()

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
      jornada: undefined,
      representativePhone: '',
      academicYear: new Date().getFullYear(), // Valor por defecto: año actual
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
      jornada: (user as any).jornada || undefined,
      representativePhone: (user as any).representativePhone || '',
      academicYear: (user as any).academicYear || new Date().getFullYear()
    })
  }, [id, user])

  const handleSubmit = useFormSubmit({
    onSubmit: async (data: RegisterFormProps) => {
      // Si es creación de nuevo usuario (no actualización), validar que el registro esté habilitado
      if (!id) {
        // Esperar a que cargue la configuración si aún está cargando
        if (isLoadingConfig) {
          notifyError({
            title: 'Validando configuración',
            message: 'Por favor, espera un momento mientras verificamos la configuración del sistema...',
          })
          return
        }

        // Validar que el registro esté habilitado
        if (!registrationEnabled) {
          notifyError({
            title: 'Registro deshabilitado',
            message: 'El registro de nuevos usuarios está actualmente deshabilitado. Por favor, contacta al administrador del sistema.',
          })
          return
        }
      }

      // Si pasa la validación, proceder con el registro/actualización
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