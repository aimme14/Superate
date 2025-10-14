import ErrorAPI from "@/errors";

interface IError extends ErrorAPI { }
export interface Success<T> { success: true, data: T }
export interface Failure { success: false; error: IError }

export type Result<T> = Success<T> | Failure //Result either
export const success = <T>(data: T): Success<T> => ({ success: true, data })
export const failure = (error: IError): Failure => ({ success: false, error })

// Interfaces para gestión de instituciones
export interface Grade {
  id: string
  name: string
  level: number
  teachers?: Teacher[] // Docentes asignados a este grado específico
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Campus {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  principal?: string
  grades: Grade[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Institution {
  id: string
  name: string
  type: 'public' | 'private' 
  nit?: string
  address: string
  phone?: string
  email?: string
  website?: string
  rector?: string
  logo?: string
  campuses: Campus[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Interfaces para gestión de usuarios (estudiantes, docentes, coordinadores, rectores)
export interface User {
  id: string
  name: string
  email: string
  role: 'student' | 'teacher' | 'principal' | 'rector' | 'admin'
  institutionId?: string
  campusId?: string
  gradeId?: string
  subjects?: string[] // Para docentes
  studentCount?: number // Para docentes y rectores
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Teacher extends User {
  role: 'teacher'
  subjects?: string[] // Opcional - los docentes no necesitan materias específicas
  studentCount: number
  students?: string[] // IDs de estudiantes asignados
  institutionName?: string // Nombre de la institución
  campusName?: string // Nombre de la sede
  gradeName?: string // Nombre del grado
}

export interface Student extends User {
  role: 'student'
  gradeId: string
  teacherIds?: string[] // IDs de docentes asignados
  institutionName?: string // Nombre de la institución
  campusName?: string // Nombre de la sede
  gradeName?: string // Nombre del grado
}

export interface Principal extends User {
  role: 'principal'
  institutionId: string
  campusId?: string
  institutionName?: string // Nombre de la institución
  campusName?: string // Nombre de la sede
}

export interface Rector extends User {
  role: 'rector'
  institutionId: string
  institutionName?: string // Nombre de la institución
  campusCount?: number // Número de sedes bajo su supervisión
  principalCount?: number // Número de coordinadores
  teacherCount?: number // Número de docentes
  studentCount?: number // Número total de estudiantes
}