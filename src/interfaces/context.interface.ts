import { LoginFormProps, RegisterFormProps } from "@/schemas/auth.schema"
/*--------------------------------------------------ThemeContext--------------------------------------------------*/
export type Theme = 'light' | 'dark'

export type ThemeContext = {
  toggleTheme: () => void
  theme: Theme
} | undefined

export type ThemeContextProps = { theme: Theme }
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------ActionConfirmContext--------------------------------------------------*/
export type DialogConfig = {
  action: () => void | Promise<void>
  isDestructive?: boolean
  description: string
  title: string
} | null

export type DialogConfirmContext = {
  show: boolean
  title: string
  description: string
  isDestructive: boolean
  setShow: (show: boolean) => void
  handleConfirm: () => Promise<void>
  confirmAction: (config: DialogConfig) => void
} | undefined
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------AuthContext--------------------------------------------------*/

export type UserRole = 'student' | 'teacher' | 'principal' | 'admin'

export type User = {
  statusExams?: Record<string, boolean>
  displayName: string | null
  emailVerified: boolean
  email: string
  uid: string
  role?: UserRole
  grade?: string
  institution?: string
  userdoc?: string
}

export type AuthContext = {
  user: User | undefined
  isAuth: boolean
  loading: boolean
  signout: () => Promise<void>
  signin: (data: LoginFormProps) => Promise<void>
  signup: (data: RegisterFormProps) => Promise<void>
  sendResetPassword: (email: string) => Promise<void>

  //user handlers
  getAll: <T>() => Promise<T[]>
  getById: <T>(id: string, enabled?: boolean) => Promise<T | undefined>
  update: (id: string, data: object) => Promise<any> 
  delete: (id: string) => Promise<any>
} | undefined
/*---------------------------------------------------------------------------------------------------------*/