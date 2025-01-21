import { z } from "zod"

/*--------------------------------------------------loginSchema--------------------------------------------------*/
export const loginSchema = z.object({
  email: z.string().email("Correo electronico invalido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
})

/*--------------------------------------------------registerSchema--------------------------------------------------*/
export const registerSchema = z.object({
  typeDocument: z.string().min(1, "El tipo de documento es requerido"),
  document: z.string().min(10, "El documento debe tener al menos 10 caracteres"),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  lastName: z.string().min(3, "El apellido debe tener al menos 3 caracteres"),
  email: z.string().email("Correo electronico invalido"),
})
/*---------------------------------------------------------------------------------------------------------*/