/**
 * Script para procesar resultados de exámenes existentes y actualizar el progreso de fases
 * 
 * Este script se puede ejecutar para actualizar el progreso de estudiantes que ya presentaron
 * exámenes antes de que se implementara el sistema de procesamiento de resultados.
 * 
 * Uso: tsx src/scripts/processExistingExamResults.ts [studentId]
 */

import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { processExamResults } from '@/utils/phaseIntegration';

const db = getFirestore(firebaseApp);

interface ExamResult {
  userId: string;
  examId: string;
  examTitle: string;
  subject: string;
  phase?: string;
  score?: any;
  questionDetails?: any[];
  completed?: boolean;
  [key: string]: any;
}

/**
 * Mapeo de nombres de materias para normalización
 */
const SUBJECT_MAPPING: Record<string, string> = {
  'Lenguaje': 'Lenguaje',
  'Lectura Crítica': 'Lenguaje',
  'Matemáticas': 'Matemáticas',
  'Ciencias Sociales': 'Ciencias Sociales',
  'Biologia': 'Biologia',
  'Biología': 'Biologia',
  'Física': 'Física',
  'Quimica': 'Quimica',
  'Química': 'Quimica',
  'Inglés': 'Inglés',
  'English': 'Inglés',
};

/**
 * Normaliza el nombre de la materia
 */
function normalizeSubject(subject: string): string {
  return SUBJECT_MAPPING[subject] || subject;
}

/**
 * Procesa los resultados de un estudiante específico
 */
async function processStudentResults(studentId: string) {
  console.log(`\n🔍 Procesando resultados para estudiante: ${studentId}`);
  
  try {
    const resultsRef = doc(db, 'results', studentId);
    const resultsSnap = await getDoc(resultsRef);

    if (!resultsSnap.exists()) {
      console.log(`   ❌ No se encontraron resultados para ${studentId}`);
      return;
    }

    const resultsData = resultsSnap.data();
    let processedCount = 0;
    let errorCount = 0;

    // Procesar cada examen
    for (const [examId, examData] of Object.entries(resultsData)) {
      const exam = examData as ExamResult;
      
      // Verificar que tenga los datos necesarios
      if (!exam.subject || !exam.phase || !exam.completed) {
        console.log(`   ⚠️ Saltando ${examId}: falta información (subject: ${exam.subject}, phase: ${exam.phase}, completed: ${exam.completed})`);
        continue;
      }

      const normalizedSubject = normalizeSubject(exam.subject);
      const phase = exam.phase as 'first' | 'second' | 'third';

      console.log(`   📝 Procesando: ${normalizedSubject} - ${phase} (${examId})`);

      try {
        const result = await processExamResults(
          studentId,
          normalizedSubject,
          phase,
          exam
        );

        if (result.success) {
          console.log(`   ✅ Procesado exitosamente`);
          processedCount++;
        } else {
          console.error(`   ❌ Error: ${result.error}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error procesando ${examId}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen para ${studentId}:`);
    console.log(`   ✅ Procesados: ${processedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
  } catch (error) {
    console.error(`❌ Error procesando resultados de ${studentId}:`, error);
  }
}

/**
 * Procesa todos los estudiantes
 */
async function processAllStudents() {
  console.log('🔍 Buscando todos los estudiantes con resultados...\n');

  try {
    const resultsRef = collection(db, 'results');
    const resultsSnap = await getDocs(resultsRef);

    const studentIds: string[] = [];
    resultsSnap.forEach((doc) => {
      studentIds.push(doc.id);
    });

    console.log(`📋 Encontrados ${studentIds.length} estudiantes con resultados\n`);

    for (const studentId of studentIds) {
      await processStudentResults(studentId);
      // Pequeña pausa para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Procesamiento completado para ${studentIds.length} estudiantes`);
  } catch (error) {
    console.error('❌ Error procesando todos los estudiantes:', error);
  }
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const studentId = args[0];

  if (studentId) {
    // Procesar un estudiante específico
    await processStudentResults(studentId);
  } else {
    // Procesar todos los estudiantes
    await processAllStudents();
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { processStudentResults, processAllStudents };

