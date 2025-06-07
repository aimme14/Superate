import { z } from "zod"

/*--------------------------------------------------loginSchema--------------------------------------------------*/
export const loginSchema = z.object({
  email: z.string().email("Correo electronico invalido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
})

/*--------------------------------------------------registerSchema--------------------------------------------------*/
export const registerSchema = z.object({
  role: z.string().min(1, "El tipo de documento es requerido"),
  userdoc: z.string().min(10, "El documento debe tener al menos 10 caracteres"),
  username: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Correo electronico invalido"),
  inst: z.string().min(1, "La institución educativa es requerida"),
  grade: z.string().min(1, "El grado es requerido"),
})
/*--------------------------------------------------registerSchema--------------------------------------------------*/
export const forgotPasswordSchema = z.object({
  email: z.string().email("Correo electronico invalido"),
})
/*---------------------------------------------------------------------------------------------------------*/

export type LoginFormProps = z.infer<typeof loginSchema>
export type RegisterFormProps = z.infer<typeof registerSchema>
export type ForgotPasswordFormProps = z.infer<typeof forgotPasswordSchema>