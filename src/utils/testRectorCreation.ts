/**
 * Script de prueba para verificar la creación de rectores
 * Este archivo ayuda a diagnosticar problemas en la creación de usuarios rector
 */

import { createRector } from '@/controllers/rector.controller'
import { CreateRectorData } from '@/controllers/rector.controller'

export const testRectorCreation = async () => {
  console.log('🧪 Iniciando prueba de creación de rector...')
  
  const testData: CreateRectorData = {
    name: 'Test Rector',
    email: 'test.rector@institucion.edu',
    institutionId: 'test-institution-id',
    phone: '1234567890',
    password: 'TestPassword123'
  }
  
  console.log('📋 Datos de prueba:', testData)
  
  try {
    const result = await createRector(testData)
    
    if (result.success) {
      console.log('✅ Prueba exitosa:', result.data)
      return { success: true, data: result.data }
    } else {
      console.error('❌ Prueba fallida:', result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
    return { success: false, error }
  }
}

export const validateRectorData = (data: CreateRectorData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre es obligatorio')
  }
  
  if (!data.email || data.email.trim().length === 0) {
    errors.push('El email es obligatorio')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      errors.push('El formato del email no es válido')
    }
  }
  
  if (!data.institutionId || data.institutionId.trim().length === 0) {
    errors.push('La institución es obligatoria')
  }
  
  if (data.password && data.password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const debugRectorCreation = (data: CreateRectorData) => {
  console.log('🔍 Debugging creación de rector...')
  console.log('📊 Datos recibidos:', data)
  
  const validation = validateRectorData(data)
  console.log('✅ Validación:', validation)
  
  if (!validation.isValid) {
    console.error('❌ Datos inválidos:', validation.errors)
    return { valid: false, errors: validation.errors }
  }
  
  console.log('✅ Datos válidos, procediendo con la creación...')
  return { valid: true, errors: [] }
}
