import { dbService } from '@/services/firebase/db.service'
import { Teacher } from '@/interfaces/db.interface'

const defaultTeachers: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Prof. Roberto Silva',
    email: 'roberto.silva@colegio.edu.co',
    role: 'teacher',
    institutionId: '1', // ID de Colegio San José
    campusId: '1-1', // ID de Sede Principal
    subjects: ['Matemáticas', 'Física'],
    studentCount: 45,
    students: [],
    isActive: true
  },
  {
    name: 'Prof. Laura García',
    email: 'laura.garcia@instituto.edu',
    role: 'teacher',
    institutionId: '2', // ID de Instituto Nacional
    campusId: '2-1', // ID de Sede Central
    subjects: ['Lenguaje', 'Literatura'],
    studentCount: 38,
    students: [],
    isActive: true
  },
  {
    name: 'Prof. Carlos Mendoza',
    email: 'carlos.mendoza@colegio.edu.co',
    role: 'teacher',
    institutionId: '1',
    campusId: '1-1',
    subjects: ['Historia', 'Geografía'],
    studentCount: 42,
    students: [],
    isActive: true
  },
  {
    name: 'Prof. Ana Torres',
    email: 'ana.torres@instituto.edu',
    role: 'teacher',
    institutionId: '2',
    campusId: '2-1',
    subjects: ['Química', 'Biología'],
    studentCount: 35,
    students: [],
    isActive: true
  },
  {
    name: 'Prof. Miguel Rodríguez',
    email: 'miguel.rodriguez@colegio.edu.co',
    role: 'teacher',
    institutionId: '1',
    campusId: '1-1',
    subjects: ['Inglés', 'Francés'],
    studentCount: 28,
    students: [],
    isActive: true
  },
  {
    name: 'Prof. María González',
    email: 'maria.gonzalez@instituto.edu',
    role: 'teacher',
    institutionId: '2',
    campusId: '2-1',
    subjects: ['Arte', 'Música'],
    studentCount: 22,
    students: [],
    isActive: true
  }
]

export const initializeTeachers = async () => {
  console.log('Initializing default teachers...')
  for (const teacher of defaultTeachers) {
    const result = await dbService.createTeacher(teacher)
    if (result.success) {
      console.log(`Teacher "${teacher.name}" created successfully.`)
    } else {
      console.error(`Error creating teacher "${teacher.name}":`, result.error.message)
    }
  }
  console.log('Default teachers initialization complete.')
}
