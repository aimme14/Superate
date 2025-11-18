import { Institution, Campus, Grade } from '@/interfaces/db.interface'
import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'


// Interfaces para las operaciones CRUD
export interface CreateInstitutionData {
  name: string
  type: 'public' | 'private' 
  nit?: string
  address: string
  phone?: string
  email?: string
  website?: string
  rector?: string
  logo?: string
}

export interface UpdateInstitutionData extends Partial<CreateInstitutionData> {
  isActive?: boolean
  campuses?: Campus[] // Para actualizar sedes y grados
}

export interface CreateCampusData {
  institutionId: string
  name: string
  address: string
  phone?: string
  email?: string
  principal?: string
}

export interface UpdateCampusData extends Partial<Omit<CreateCampusData, 'institutionId'>> {
  isActive?: boolean
}

export interface CreateGradeData {
  institutionId: string
  campusId: string
  name: string
  level: number
}

export interface UpdateGradeData extends Partial<Omit<CreateGradeData, 'institutionId' | 'campusId'>> {
  isActive?: boolean
}

// Funciones CRUD para Instituciones
export const getAllInstitutions = async (): Promise<Result<Institution[]>> => {
  try {
    const result = await dbService.getAllInstitutions()
    if (result.success) {
      return success(result.data as Institution[])
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener instituciones', statusCode: 500 }))
  }
}

export const getInstitutionById = async (id: string): Promise<Result<Institution>> => {
  try {
    const result = await dbService.getInstitutionById(id)
    if (result.success) {
      return success(result.data as Institution)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener la institución', statusCode: 500 }))
  }
}

export const createInstitution = async (data: CreateInstitutionData): Promise<Result<Institution>> => {
  try {
    if (!data.name || !data.address) {
      return failure(new ErrorAPI({ message: 'Nombre y dirección son obligatorios', statusCode: 400 }))
    }

    const institutionData = {
      name: data.name,
      type: data.type,
      nit: data.nit,
      address: data.address,
      phone: data.phone,
      email: data.email,
      website: data.website,
      rector: data.rector,
      logo: data.logo,
      campuses: [],
      isActive: true
    }

    const result = await dbService.createInstitution(institutionData)
    if (result.success) {
      return success(result.data as Institution)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al crear la institución', statusCode: 500 }))
  }
}

export const updateInstitution = async (id: string, data: UpdateInstitutionData): Promise<Result<Institution>> => {
  try {
    // Si se están actualizando sedes y grados, necesitamos obtener la institución actual
    // y fusionar los datos para preservar toda la estructura
    if (data.campuses) {
      const currentInstitutionResult = await dbService.getInstitutionById(id)
      if (!currentInstitutionResult.success) {
        return failure(currentInstitutionResult.error)
      }

      const currentInstitution = currentInstitutionResult.data
      
      // Fusionar los datos actualizados con la estructura existente
      const mergedData = {
        ...currentInstitution,
        ...data,
        campuses: data.campuses, // Usar las sedes actualizadas
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const result = await dbService.updateInstitution(id, mergedData)
      if (result.success) {
        return success(result.data as Institution)
      }
      return failure(result.error)
    } else {
      // Si no se están actualizando sedes, actualizar normalmente
      const result = await dbService.updateInstitution(id, data)
      if (result.success) {
        return success(result.data as Institution)
      }
      return failure(result.error)
    }
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar la institución', statusCode: 500 }))
  }
}

export const deleteInstitution = async (id: string): Promise<Result<boolean>> => {
  try {
    const result = await dbService.deleteInstitution(id)
    if (result.success) {
      return success(true)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar la institución', statusCode: 500 }))
  }
}

// Funciones CRUD para Sedes
export const createCampus = async (data: CreateCampusData): Promise<Result<Campus>> => {
  try {
    if (!data.name || !data.address) {
      return failure(new ErrorAPI({ message: 'Nombre y dirección de la sede son obligatorios', statusCode: 400 }))
    }

    const campusData = {
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email,
      principal: data.principal
    }

    const result = await dbService.addCampusToInstitution(data.institutionId, campusData)
    if (result.success) {
      return success(result.data as Campus)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al crear la sede', statusCode: 500 }))
  }
}

export const updateCampus = async (institutionId: string, campusId: string, data: UpdateCampusData): Promise<Result<Campus>> => {
  try {
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
    if (campusIndex === -1) {
      return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
    }

    const updatedCampuses = [...institution.campuses]
    updatedCampuses[campusIndex] = {
      ...updatedCampuses[campusIndex],
      ...data,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updatedInstitution = {
      ...institution,
      campuses: updatedCampuses,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updateResult = await dbService.updateInstitution(institutionId, updatedInstitution)
    if (updateResult.success) {
      return success(updatedCampuses[campusIndex] as Campus)
    }
    return failure(updateResult.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar la sede', statusCode: 500 }))
  }
}

export const deleteCampus = async (institutionId: string, campusId: string): Promise<Result<boolean>> => {
  try {
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
    if (campusIndex === -1) {
      return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
    }

    const updatedCampuses = institution.campuses.filter((c: any) => c.id !== campusId)
    const updatedInstitution = {
      ...institution,
      campuses: updatedCampuses,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updateResult = await dbService.updateInstitution(institutionId, updatedInstitution)
    if (updateResult.success) {
      return success(true)
    }
    return failure(updateResult.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar la sede', statusCode: 500 }))
  }
}

// Funciones CRUD para Grados
export const createGrade = async (data: CreateGradeData): Promise<Result<Grade>> => {
  try {
    if (!data.name) {
      return failure(new ErrorAPI({ message: 'Nombre del grado es obligatorio', statusCode: 400 }))
    }

    const gradeData = {
      name: data.name,
      level: data.level
    }

    const result = await dbService.addGradeToCampus(data.institutionId, data.campusId, gradeData)
    if (result.success) {
      return success(result.data as Grade)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al crear el grado', statusCode: 500 }))
  }
}

export const updateGrade = async (institutionId: string, campusId: string, gradeId: string, data: UpdateGradeData): Promise<Result<Grade>> => {
  try {
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
    if (campusIndex === -1) {
      return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
    }

    const gradeIndex = institution.campuses[campusIndex].grades.findIndex((g: any) => g.id === gradeId)
    if (gradeIndex === -1) {
      return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
    }

    const updatedCampuses = [...institution.campuses]
    const updatedGrades = [...updatedCampuses[campusIndex].grades]
    updatedGrades[gradeIndex] = {
      ...updatedGrades[gradeIndex],
      ...data,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    updatedCampuses[campusIndex] = {
      ...updatedCampuses[campusIndex],
      grades: updatedGrades,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updatedInstitution = {
      ...institution,
      campuses: updatedCampuses,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updateResult = await dbService.updateInstitution(institutionId, updatedInstitution)
    if (updateResult.success) {
      return success(updatedGrades[gradeIndex] as Grade)
    }
    return failure(updateResult.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el grado', statusCode: 500 }))
  }
}

export const deleteGrade = async (institutionId: string, campusId: string, gradeId: string): Promise<Result<boolean>> => {
  try {
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
    if (campusIndex === -1) {
      return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
    }

    const updatedCampuses = [...institution.campuses]
    updatedCampuses[campusIndex] = {
      ...updatedCampuses[campusIndex],
      grades: updatedCampuses[campusIndex].grades.filter((g: any) => g.id !== gradeId),
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updatedInstitution = {
      ...institution,
      campuses: updatedCampuses,
      updatedAt: new Date().toISOString().split('T')[0]
    }

    const updateResult = await dbService.updateInstitution(institutionId, updatedInstitution)
    if (updateResult.success) {
      return success(true)
    }
    return failure(updateResult.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el grado', statusCode: 500 }))
  }
}
