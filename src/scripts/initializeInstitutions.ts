import { dbService } from '@/services/firebase/db.service'
import { Institution } from '@/interfaces/db.interface'

// Datos de ejemplo para inicializar instituciones en Firebase
const sampleInstitutions: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Colegio San José',
    type: 'private',
    nit: '900123456-1',
    address: 'Calle 123 #45-67, Bogotá',
    phone: '+57 1 234-5678',
    email: 'info@colegiosanjose.edu.co',
    website: 'www.colegiosanjose.edu.co',
    rector: 'Dr. María González',
    logo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM0RjQ2RjUiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4KPC9zdmc+',
    campuses: [
      {
        id: '1-1',
        name: 'Sede Principal',
        address: 'Calle 123 #45-67, Bogotá',
        phone: '+57 1 234-5678',
        email: 'principal@colegiosanjose.edu.co',
        principal: 'Lic. Carlos Mendoza',
        grades: [
          { id: '1-1-1', name: '6°', level: 6, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '1-1-2', name: '7°', level: 7, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '1-1-3', name: '8°', level: 8, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '1-1-4', name: '9°', level: 9, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '1-1-5', name: '10°', level: 10, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '1-1-6', name: '11°', level: 11, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' }
        ],
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ],
    isActive: true
  },
  {
    name: 'Instituto Nacional',
    type: 'public',
    address: 'Avenida 45 #23-89, Medellín',
    phone: '+57 4 567-8901',
    email: 'contacto@institucionacional.edu.co',
    rector: 'Dr. Roberto Silva',
    campuses: [
      {
        id: '2-1',
        name: 'Sede Central',
        address: 'Avenida 45 #23-89, Medellín',
        phone: '+57 4 567-8901',
        email: 'central@institucionacional.edu.co',
        principal: 'Lic. Ana Torres',
        grades: [
          { id: '2-1-1', name: '6°', level: 6, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2-1-2', name: '7°', level: 7, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2-1-3', name: '8°', level: 8, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2-1-4', name: '9°', level: 9, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2-1-5', name: '10°', level: 10, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { id: '2-1-6', name: '11°', level: 11, isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01' }
        ],
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ],
    isActive: true
  }
]

/**
 * Inicializa las instituciones de ejemplo en Firebase
 * Este script se puede ejecutar una vez para poblar la base de datos con datos de prueba
 */
export const initializeInstitutions = async () => {
  try {
    console.log('Inicializando instituciones de ejemplo...')
    
    for (const institutionData of sampleInstitutions) {
      const result = await dbService.createInstitution(institutionData)
      if (result.success) {
        console.log(`✅ Institución "${institutionData.name}" creada exitosamente`)
      } else {
        console.error(`❌ Error al crear institución "${institutionData.name}":`, result.error.message)
      }
    }
    
    console.log('🎉 Inicialización completada')
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeInstitutions()
}
