/**
 * Script de diagnóstico para verificar el progreso de fases de estudiantes
 * Ejecutar con: npm run diagnose-phase
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCOYy9sRGzlVjNKJhpNdkwPT7vWxXfBzec",
  authDomain: "superate-e7b18.firebaseapp.com",
  projectId: "superate-e7b18",
  storageBucket: "superate-e7b18.firebasestorage.app",
  messagingSenderId: "428859712652",
  appId: "1:428859712652:web:19cf31835cc2e5d4e03f8d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function diagnosePhaseProgress() {
  console.log('🔍 INICIANDO DIAGNÓSTICO DE PROGRESO DE FASES\n');

  try {
    // 1. Obtener todos los registros de studentPhaseProgress para la fase 'first'
    console.log('📋 Paso 1: Obteniendo todos los registros de Fase 1...');
    const progressCollection = collection(db, 'superate', 'auth', 'studentPhaseProgress');
    const phase1Query = query(progressCollection, where('phase', '==', 'first'));
    const phase1Snapshot = await getDocs(phase1Query);

    console.log(`   Total de registros encontrados: ${phase1Snapshot.size}\n`);

    // 2. Analizar cada registro
    const studentsByGrade: Record<string, any[]> = {};

    phase1Snapshot.forEach((doc) => {
      const data = doc.data();
      const gradeId = data.gradeId || 'SIN_GRADE';
      
      if (!studentsByGrade[gradeId]) {
        studentsByGrade[gradeId] = [];
      }

      studentsByGrade[gradeId].push({
        docId: doc.id,
        studentId: data.studentId,
        gradeId: data.gradeId,
        phase: data.phase,
        status: data.status,
        completedCount: (data.subjectsCompleted || []).length,
        inProgressCount: (data.subjectsInProgress || []).length,
        subjectsCompleted: data.subjectsCompleted || [],
        subjectsInProgress: data.subjectsInProgress || [],
      });
    });

    // 3. Mostrar resumen por grado
    console.log('📊 RESUMEN POR GRADO:\n');
    
    for (const [gradeId, students] of Object.entries(studentsByGrade)) {
      console.log(`\n🎓 GradeId: "${gradeId}"`);
      console.log(`   Total estudiantes: ${students.length}`);
      
      const completed = students.filter(s => s.completedCount === 7).length;
      const inProgress = students.filter(s => s.completedCount > 0 && s.completedCount < 7).length;
      const pending = students.filter(s => s.completedCount === 0).length;
      
      console.log(`   ✅ Completados (7/7): ${completed}`);
      console.log(`   ⏱️ En progreso: ${inProgress}`);
      console.log(`   ⭕ Pendientes: ${pending}`);
      
      // Mostrar detalles de cada estudiante
      console.log(`\n   Estudiantes:`);
      students.forEach(student => {
        const status = student.completedCount === 7 ? '✅' : 
                      student.completedCount > 0 ? '⏱️' : '⭕';
        console.log(`   ${status} ${student.studentId}: ${student.completedCount}/7 materias`);
        if (student.completedCount > 0) {
          console.log(`      Completadas: ${student.subjectsCompleted.join(', ')}`);
        }
      });
    }

    // 4. Obtener información de grados de la base de datos
    console.log('\n\n📚 Paso 2: Verificando grados en la base de datos...');
    const gradesCollection = collection(db, 'superate', 'auth', 'grades');
    const gradesSnapshot = await getDocs(gradesCollection);

    console.log(`   Total de grados en BD: ${gradesSnapshot.size}\n`);
    
    const grades: any[] = [];
    gradesSnapshot.forEach((doc) => {
      const data = doc.data();
      grades.push({
        id: doc.id,
        name: data.name,
        institutionId: data.institutionId,
        institutionName: data.institutionName,
        campusId: data.campusId,
        campusName: data.campusName,
      });
    });

    console.log('   Grados disponibles:');
    grades.forEach(grade => {
      const studentsInGrade = studentsByGrade[grade.id] || [];
      console.log(`   - ID: "${grade.id}"`);
      console.log(`     Nombre: ${grade.name}`);
      console.log(`     Institución: ${grade.institutionName}`);
      console.log(`     Sede: ${grade.campusName}`);
      console.log(`     Estudiantes con progreso: ${studentsInGrade.length}`);
    });

    // 5. Verificar inconsistencias
    console.log('\n\n⚠️ Paso 3: Verificando inconsistencias...');
    
    const gradeIdsInProgress = new Set(Object.keys(studentsByGrade));
    const gradeIdsInDB = new Set(grades.map(g => g.id));

    const progressNotInDB = Array.from(gradeIdsInProgress).filter(id => !gradeIdsInDB.has(id));
    const dbNotInProgress = Array.from(gradeIdsInDB).filter(id => !gradeIdsInProgress.has(id));

    if (progressNotInDB.length > 0) {
      console.log(`\n   ⚠️ GradeIds en progreso pero NO en base de datos:`);
      progressNotInDB.forEach(id => {
        console.log(`      - "${id}" (${studentsByGrade[id].length} estudiantes)`);
      });
    }

    if (dbNotInProgress.length > 0) {
      console.log(`\n   ℹ️ Grados en BD sin estudiantes con progreso:`);
      dbNotInProgress.forEach(id => {
        const grade = grades.find(g => g.id === id);
        console.log(`      - "${id}" (${grade?.name})`);
      });
    }

    console.log('\n\n✅ DIAGNÓSTICO COMPLETADO');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }

  process.exit(0);
}

diagnosePhaseProgress();

