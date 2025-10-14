import { z } from "zod"

/*--------------------------------------------------loginSchema--------------------------------------------------*/
export const loginSchema = z.object({
  email: z.string().email("Correo electronico invalido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
})

/*--------------------------------------------------registerSchema--------------------------------------------------*/
export const registerSchema = z.object({
  role: z.literal('student', {
    errorMap: () => ({ message: "Solo los estudiantes pueden registrarse públicamente" })
  }),
  userdoc: z.string().min(10, "El documento debe tener al menos 10 caracteres"),
  username: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Correo electronico invalido"),
  inst: z.string().min(1, "La institución educativa es requerida"),
  campus: z.string().min(1, "La sede es requerida"),
  grade: z.string().min(1, "El grado es requerido"),
})

/*--------------------------------------------------adminRegisterSchema--------------------------------------------------*/
export const adminRegisterSchema = z.object({
  role: z.enum(['teacher', 'principal'], {
    errorMap: () => ({ message: "Debe seleccionar un rol válido (docente o coordinador)" })
  }),
  username: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Correo electronico invalido"),
  institution: z.string().min(1, "La institución educativa es requerida"),
  campus: z.string().min(1, "La sede es requerida"),
  grade: z.string().min(1, "El grado es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})
/*--------------------------------------------------registerSchema--------------------------------------------------*/
export const forgotPasswordSchema = z.object({
  email: z.string().email("Correo electronico invalido"),
})
/*---------------------------------------------------------------------------------------------------------*/

export type LoginFormProps = z.infer<typeof loginSchema>
export type RegisterFormProps = z.infer<typeof registerSchema>
export type AdminRegisterFormProps = z.infer<typeof adminRegisterSchema>
export type ForgotPasswordFormProps = z.infer<typeof forgotPasswordSchema>