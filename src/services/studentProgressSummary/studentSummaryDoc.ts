/**
 * Lectura única de studentSummaries (misma ruta que evaluaciones del estudiante).
 */

import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import type { StudentProgressSummaryDoc } from '@/services/studentProgressSummary/fetchEvaluationsFromSummary'

const db = getFirestore(firebaseApp)

/** Mapea slugs del resumen a nombres para métricas / gráficos. */
export const SUBJECT_SLUG_TO_DISPLAY: Record<string, string> = {
  matematicas: 'Matemáticas',
  lenguaje: 'Lenguaje',
  'ciencias sociales': 'Ciencias Sociales',
  ciencias_sociales: 'Ciencias Sociales',
  sociales: 'Ciencias Sociales',
  biologia: 'Biologia',
  quimica: 'Quimica',
  fisica: 'Física',
  física: 'Física',
  ingles: 'Inglés',
  inglés: 'Inglés',
}

export function displayNameFromSubjectKey(key: string): string {
  const k = key.trim().toLowerCase().replace(/\s+/g, ' ')
  return SUBJECT_SLUG_TO_DISPLAY[k] || SUBJECT_SLUG_TO_DISPLAY[k.replace(/_/g, ' ')] || key
}

export async function fetchStudentProgressSummaryDoc(
  institutionId: string,
  studentId: string
): Promise<StudentProgressSummaryDoc | null> {
  if (!institutionId?.trim() || !studentId?.trim()) return null
  const ref = doc(
    db,
    'superate',
    'auth',
    'institutions',
    institutionId.trim(),
    'studentSummaries',
    studentId.trim()
  )
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as StudentProgressSummaryDoc
}
