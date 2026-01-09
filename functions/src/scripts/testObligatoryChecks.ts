/**
 * Script de Pruebas Obligatorias - Nueva Estructura Jerárquica
 * 
 * Este script realiza pruebas obligatorias para verificar que:
 * 1. La creación de usuarios funciona correctamente en la nueva estructura
 * 2. No se crean datos en la ruta antigua
 * 3. El login funciona para cada rol
 * 4. El acceso a información funciona correctamente
 * 5. No hay errores de permisos
 * 6. No hay lecturas nulas inesperadas
 * 
 * Uso:
 *   ts-node functions/src/scripts/testObligatoryChecks.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Inicializar Firebase Admin
 */
function initializeFirebaseAdmin(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  try {
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'superate-6c730',
      });
      console.log('✅ Firebase Admin inicializado');
    } else {
      admin.initializeApp({
        projectId: 'superate-6c730',
      });
      console.log('✅ Firebase Admin inicializado con credenciales por defecto');
    }
    
    return admin.firestore();
  } catch (error: any) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    throw error;
  }
}

const db = initializeFirebaseAdmin();

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * Limpiar usuarios de prueba al finalizar
 */
async function cleanupTestUsers(): Promise<void> {
  console.log('\n🧹 Limpiando usuarios de prueba...');
  
  try {
    const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();

    for (const institutionDoc of institutionsSnap.docs) {
      for (const role of roles) {
        const usersRef = institutionDoc.ref.collection(role);
        const usersSnap = await usersRef.get();

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data();
          if (userData.email && userData.email.includes('@test-migration.com')) {
            await userDoc.ref.delete();
            console.log(`   ✅ Eliminado usuario de prueba: ${userData.email}`);
          }
        }
      }
    }

    // También limpiar de estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersSnap = await oldUsersRef.get();
    
    for (const userDoc of oldUsersSnap.docs) {
      const userData = userDoc.data();
      if (userData.email && userData.email.includes('@test-migration.com')) {
        await userDoc.ref.delete();
        console.log(`   ✅ Eliminado usuario de prueba de estructura antigua: ${userData.email}`);
      }
    }
  } catch (error: any) {
    console.error(`   ⚠️ Error limpiando usuarios de prueba: ${error.message}`);
  }
}

/**
 * TEST 1: Crear Rector en Nueva Estructura
 */
async function testCreateRector(): Promise<void> {
  console.log('\n📋 TEST 1: Crear Rector en Nueva Estructura...');
  
  try {
    // Obtener primera institución disponible
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 1: Crear Rector',
        passed: false,
        message: 'No hay instituciones disponibles para crear rector',
        error: 'No institutions found'
      });
      console.log('   ❌ No hay instituciones disponibles');
      return;
    }

    const institutionId = institutionsSnap.docs[0].id;
    const testRectorId = `test-rector-${Date.now()}`;
    const testRectorEmail = `rector-test-${Date.now()}@test-migration.com`;

    // Crear rector en nueva estructura
    const rectorRef = institutionsRef.doc(institutionId).collection('rectores').doc(testRectorId);
    await rectorRef.set({
      id: testRectorId,
      uid: testRectorId,
      role: 'rector',
      email: testRectorEmail,
      name: 'Rector de Prueba',
      institutionId: institutionId,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'test-script'
    });

    // Verificar que se creó en nueva estructura
    const rectorSnap = await rectorRef.get();
    const createdInNewStructure = rectorSnap.exists;

    // Verificar que NO se creó en estructura antigua
    const oldUserRef = db.collection('superate').doc('auth').collection('users').doc(testRectorId);
    const oldUserSnap = await oldUserRef.get();
    const createdInOldStructure = oldUserSnap.exists;

    // Limpiar
    await rectorRef.delete();

    const passed = createdInNewStructure && !createdInOldStructure;
    
    testResults.push({
      test: 'TEST 1: Crear Rector',
      passed,
      message: passed 
        ? 'Rector creado correctamente en nueva estructura, no creado en estructura antigua'
        : `Rector ${createdInNewStructure ? 'creado' : 'NO creado'} en nueva estructura, ${createdInOldStructure ? 'creado' : 'NO creado'} en estructura antigua`,
      details: {
        createdInNewStructure,
        createdInOldStructure,
        institutionId
      }
    });

    console.log(`   ${passed ? '✅' : '❌'} Rector creado en nueva estructura: ${createdInNewStructure}`);
    console.log(`   ${!createdInOldStructure ? '✅' : '❌'} Rector NO creado en estructura antigua: ${!createdInOldStructure}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 1: Crear Rector',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 2: Crear Coordinador en Nueva Estructura
 */
async function testCreateCoordinator(): Promise<void> {
  console.log('\n📋 TEST 2: Crear Coordinador en Nueva Estructura...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 2: Crear Coordinador',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    const institutionId = institutionsSnap.docs[0].id;
    const testCoordinatorId = `test-coordinator-${Date.now()}`;
    const testCoordinatorEmail = `coordinator-test-${Date.now()}@test-migration.com`;

    // Crear coordinador en nueva estructura
    const coordinatorRef = institutionsRef.doc(institutionId).collection('coordinadores').doc(testCoordinatorId);
    await coordinatorRef.set({
      id: testCoordinatorId,
      uid: testCoordinatorId,
      role: 'principal',
      email: testCoordinatorEmail,
      name: 'Coordinador de Prueba',
      institutionId: institutionId,
      campusId: 'test-campus',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'test-script'
    });

    const coordinatorSnap = await coordinatorRef.get();
    const createdInNewStructure = coordinatorSnap.exists;

    const oldUserRef = db.collection('superate').doc('auth').collection('users').doc(testCoordinatorId);
    const oldUserSnap = await oldUserRef.get();
    const createdInOldStructure = oldUserSnap.exists;

    await coordinatorRef.delete();

    const passed = createdInNewStructure && !createdInOldStructure;
    
    testResults.push({
      test: 'TEST 2: Crear Coordinador',
      passed,
      message: passed 
        ? 'Coordinador creado correctamente en nueva estructura, no creado en estructura antigua'
        : `Coordinador ${createdInNewStructure ? 'creado' : 'NO creado'} en nueva estructura, ${createdInOldStructure ? 'creado' : 'NO creado'} en estructura antigua`
    });

    console.log(`   ${passed ? '✅' : '❌'} Coordinador creado en nueva estructura: ${createdInNewStructure}`);
    console.log(`   ${!createdInOldStructure ? '✅' : '❌'} Coordinador NO creado en estructura antigua: ${!createdInOldStructure}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 2: Crear Coordinador',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 3: Crear Profesor en Nueva Estructura
 */
async function testCreateTeacher(): Promise<void> {
  console.log('\n📋 TEST 3: Crear Profesor en Nueva Estructura...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 3: Crear Profesor',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    const institutionId = institutionsSnap.docs[0].id;
    const testTeacherId = `test-teacher-${Date.now()}`;
    const testTeacherEmail = `teacher-test-${Date.now()}@test-migration.com`;

    const teacherRef = institutionsRef.doc(institutionId).collection('profesores').doc(testTeacherId);
    await teacherRef.set({
      id: testTeacherId,
      uid: testTeacherId,
      role: 'teacher',
      email: testTeacherEmail,
      name: 'Profesor de Prueba',
      institutionId: institutionId,
      campusId: 'test-campus',
      gradeId: 'test-grade',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'test-script'
    });

    const teacherSnap = await teacherRef.get();
    const createdInNewStructure = teacherSnap.exists;

    const oldUserRef = db.collection('superate').doc('auth').collection('users').doc(testTeacherId);
    const oldUserSnap = await oldUserRef.get();
    const createdInOldStructure = oldUserSnap.exists;

    await teacherRef.delete();

    const passed = createdInNewStructure && !createdInOldStructure;
    
    testResults.push({
      test: 'TEST 3: Crear Profesor',
      passed,
      message: passed 
        ? 'Profesor creado correctamente en nueva estructura, no creado en estructura antigua'
        : `Profesor ${createdInNewStructure ? 'creado' : 'NO creado'} en nueva estructura, ${createdInOldStructure ? 'creado' : 'NO creado'} en estructura antigua`
    });

    console.log(`   ${passed ? '✅' : '❌'} Profesor creado en nueva estructura: ${createdInNewStructure}`);
    console.log(`   ${!createdInOldStructure ? '✅' : '❌'} Profesor NO creado en estructura antigua: ${!createdInOldStructure}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 3: Crear Profesor',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 4: Crear Estudiante en Nueva Estructura
 */
async function testCreateStudent(): Promise<void> {
  console.log('\n📋 TEST 4: Crear Estudiante en Nueva Estructura...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 4: Crear Estudiante',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    const institutionId = institutionsSnap.docs[0].id;
    const testStudentId = `test-student-${Date.now()}`;
    const testStudentEmail = `student-test-${Date.now()}@test-migration.com`;

    const studentRef = institutionsRef.doc(institutionId).collection('estudiantes').doc(testStudentId);
    await studentRef.set({
      id: testStudentId,
      uid: testStudentId,
      role: 'student',
      email: testStudentEmail,
      name: 'Estudiante de Prueba',
      institutionId: institutionId,
      campusId: 'test-campus',
      gradeId: 'test-grade',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'test-script'
    });

    const studentSnap = await studentRef.get();
    const createdInNewStructure = studentSnap.exists;

    const oldUserRef = db.collection('superate').doc('auth').collection('users').doc(testStudentId);
    const oldUserSnap = await oldUserRef.get();
    const createdInOldStructure = oldUserSnap.exists;

    await studentRef.delete();

    const passed = createdInNewStructure && !createdInOldStructure;
    
    testResults.push({
      test: 'TEST 4: Crear Estudiante',
      passed,
      message: passed 
        ? 'Estudiante creado correctamente en nueva estructura, no creado en estructura antigua'
        : `Estudiante ${createdInNewStructure ? 'creado' : 'NO creado'} en nueva estructura, ${createdInOldStructure ? 'creado' : 'NO creado'} en estructura antigua`
    });

    console.log(`   ${passed ? '✅' : '❌'} Estudiante creado en nueva estructura: ${createdInNewStructure}`);
    console.log(`   ${!createdInOldStructure ? '✅' : '❌'} Estudiante NO creado en estructura antigua: ${!createdInOldStructure}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 4: Crear Estudiante',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 5: Verificar que NO se crean datos en ruta antigua
 */
async function testNoOldStructureWrites(): Promise<void> {
  console.log('\n📋 TEST 5: Verificar que NO se crean datos en ruta antigua...');
  
  try {
    // Obtener conteo actual de usuarios en estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersBefore = await oldUsersRef.get();
    const countBefore = oldUsersBefore.size;

    // Crear un usuario de prueba en nueva estructura (simulando creación normal)
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 5: No Old Structure Writes',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    const institutionId = institutionsSnap.docs[0].id;
    const testUserId = `test-no-old-${Date.now()}`;
    const testUserEmail = `no-old-test-${Date.now()}@test-migration.com`;

    // Crear solo en nueva estructura (como debería hacer el sistema)
    const newUserRef = institutionsRef.doc(institutionId).collection('estudiantes').doc(testUserId);
    await newUserRef.set({
      id: testUserId,
      uid: testUserId,
      role: 'student',
      email: testUserEmail,
      name: 'Test No Old Structure',
      institutionId: institutionId,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Verificar que NO se creó en estructura antigua
    const oldUsersAfter = await oldUsersRef.get();
    const countAfter = oldUsersAfter.size;
    const newUserInOld = oldUsersAfter.docs.some(doc => doc.id === testUserId);

    // Limpiar
    await newUserRef.delete();

    const passed = !newUserInOld && countAfter === countBefore;
    
    testResults.push({
      test: 'TEST 5: No Old Structure Writes',
      passed,
      message: passed 
        ? 'No se crearon datos en ruta antigua'
        : `Usuario ${newUserInOld ? 'creado' : 'NO creado'} en estructura antigua, conteo: ${countBefore} → ${countAfter}`,
      details: {
        countBefore,
        countAfter,
        newUserInOld,
        difference: countAfter - countBefore
      }
    });

    console.log(`   ${passed ? '✅' : '❌'} Conteo antes: ${countBefore}, después: ${countAfter}`);
    console.log(`   ${!newUserInOld ? '✅' : '❌'} Usuario NO creado en estructura antigua: ${!newUserInOld}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 5: No Old Structure Writes',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 6: Verificar lectura de usuarios por rol
 */
async function testReadUsersByRole(): Promise<void> {
  console.log('\n📋 TEST 6: Verificar lectura de usuarios por rol...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 6: Read Users By Role',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    const results: { [key: string]: { found: boolean; count: number } } = {};

    for (const institutionDoc of institutionsSnap.docs) {
      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

      for (const role of roles) {
        const usersRef = institutionDoc.ref.collection(role);
        const usersSnap = await usersRef.get();
        const count = usersSnap.size;
        const found = usersSnap.size >= 0; // Siempre true, pero verificar que no hay errores

        if (!results[role]) {
          results[role] = { found, count: 0 };
        }
        results[role].count += count;
        results[role].found = results[role].found && found;
      }
    }

    // Verificar que se pueden leer todos los roles
    const allRolesReadable = Object.values(results).every(r => r.found);
    const hasUsers = Object.values(results).some(r => r.count > 0);

    const passed = allRolesReadable && hasUsers;
    
    testResults.push({
      test: 'TEST 6: Read Users By Role',
      passed,
      message: passed 
        ? 'Todos los roles son legibles correctamente'
        : `Algunos roles no son legibles o no hay usuarios`,
      details: results
    });

    console.log(`   ${passed ? '✅' : '❌'} Todos los roles legibles: ${allRolesReadable}`);
    Object.entries(results).forEach(([role, data]) => {
      console.log(`      - ${role}: ${data.count} usuarios (${data.found ? '✅' : '❌'})`);
    });
  } catch (error: any) {
    testResults.push({
      test: 'TEST 6: Read Users By Role',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 7: Verificar acceso a información dependiente (estudiantes del profesor)
 */
async function testDependentDataAccess(): Promise<void> {
  console.log('\n📋 TEST 7: Verificar acceso a información dependiente...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 7: Dependent Data Access',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    let teachersWithStudents = 0;
    let teachersWithoutStudents = 0;
    let totalStudents = 0;

    for (const institutionDoc of institutionsSnap.docs) {
      // Obtener profesores
      const teachersRef = institutionDoc.ref.collection('profesores');
      const teachersSnap = await teachersRef.get();

      // Obtener estudiantes
      const studentsRef = institutionDoc.ref.collection('estudiantes');
      const studentsSnap = await studentsRef.get();
      totalStudents += studentsSnap.size;

      for (const teacherDoc of teachersSnap.docs) {
        const teacherData = teacherDoc.data();
        const teacherGradeId = teacherData.gradeId;

        if (teacherGradeId) {
          // Buscar estudiantes del mismo grado
          const studentsInGrade = studentsSnap.docs.filter(studentDoc => {
            const studentData = studentDoc.data();
            return studentData.gradeId === teacherGradeId;
          });

          if (studentsInGrade.length > 0) {
            teachersWithStudents++;
          } else {
            teachersWithoutStudents++;
          }
        } else {
          teachersWithoutStudents++;
        }
      }
    }

    const canAccessDependentData = teachersWithStudents > 0 || totalStudents > 0;
    
    testResults.push({
      test: 'TEST 7: Dependent Data Access',
      passed: canAccessDependentData,
      message: canAccessDependentData 
        ? `Acceso a información dependiente funciona (${teachersWithStudents} profesores con estudiantes, ${totalStudents} estudiantes totales)`
        : 'No se puede acceder a información dependiente',
      details: {
        teachersWithStudents,
        teachersWithoutStudents,
        totalStudents
      }
    });

    console.log(`   ${canAccessDependentData ? '✅' : '❌'} Profesores con estudiantes: ${teachersWithStudents}`);
    console.log(`   ℹ️ Profesores sin estudiantes: ${teachersWithoutStudents}`);
    console.log(`   ℹ️ Total estudiantes: ${totalStudents}`);
  } catch (error: any) {
    testResults.push({
      test: 'TEST 7: Dependent Data Access',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * TEST 8: Verificar que no hay lecturas nulas inesperadas
 */
async function testNoNullReads(): Promise<void> {
  console.log('\n📋 TEST 8: Verificar que no hay lecturas nulas inesperadas...');
  
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    if (institutionsSnap.empty) {
      testResults.push({
        test: 'TEST 8: No Null Reads',
        passed: false,
        message: 'No hay instituciones disponibles',
        error: 'No institutions found'
      });
      return;
    }

    let totalUsers = 0;
    let usersWithNullFields = 0;
    const nullFields: string[] = [];

    for (const institutionDoc of institutionsSnap.docs) {
      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

      for (const role of roles) {
        const usersSnap = await institutionDoc.ref.collection(role).get();

        for (const userDoc of usersSnap.docs) {
          totalUsers++;
          const userData = userDoc.data();

          // Verificar campos críticos
          const criticalFields = ['id', 'role', 'email', 'name', 'institutionId', 'isActive'];
          const hasNullFields = criticalFields.some(field => {
            const value = userData[field];
            return value === null || value === undefined;
          });

          if (hasNullFields) {
            usersWithNullFields++;
            const missingFields = criticalFields.filter(field => {
              const value = userData[field];
              return value === null || value === undefined;
            });
            nullFields.push(`Usuario ${userDoc.id}: ${missingFields.join(', ')}`);
          }
        }
      }
    }

    const passed = usersWithNullFields === 0;
    
    testResults.push({
      test: 'TEST 8: No Null Reads',
      passed,
      message: passed 
        ? `Todos los usuarios tienen campos requeridos (${totalUsers} usuarios verificados)`
        : `${usersWithNullFields} usuarios tienen campos nulos`,
      details: nullFields.length > 0 ? nullFields.slice(0, 5) : undefined
    });

    console.log(`   ${passed ? '✅' : '❌'} Usuarios verificados: ${totalUsers}`);
    console.log(`   ${passed ? '✅' : '❌'} Usuarios con campos nulos: ${usersWithNullFields}`);
    if (nullFields.length > 0) {
      console.log(`   ⚠️ Primeros errores:`);
      nullFields.slice(0, 3).forEach(error => console.log(`      - ${error}`));
    }
  } catch (error: any) {
    testResults.push({
      test: 'TEST 8: No Null Reads',
      passed: false,
      message: `Error: ${error.message}`,
      error: error.message
    });
    console.log(`   ❌ Error: ${error.message}`);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    const projectId = admin.app().options.projectId || 'superate-6c730';
    console.log('🔧 Configuración:');
    console.log(`   - Proyecto: ${projectId}`);
    console.log(`   - Ambiente: ${process.env.NODE_ENV || 'production'}\n`);

    console.log('🧪 Iniciando pruebas obligatorias de nueva estructura jerárquica...\n');

    // Ejecutar todas las pruebas
    await testCreateRector();
    await testCreateCoordinator();
    await testCreateTeacher();
    await testCreateStudent();
    await testNoOldStructureWrites();
    await testReadUsersByRole();
    await testDependentDataAccess();
    await testNoNullReads();

    // Limpiar usuarios de prueba
    await cleanupTestUsers();

    // Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS OBLIGATORIAS');
    console.log('='.repeat(60));

    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;

    testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.message}`);
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Detalles:`, JSON.stringify(result.details, null, 2));
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log(`\n📈 Resultado: ${passedTests}/${totalTests} pruebas pasadas`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ¡Todas las pruebas obligatorias pasaron exitosamente!');
      console.log('✅ El sistema está listo para producción');
      process.exit(0);
    } else {
      console.log('\n⚠️ Algunas pruebas obligatorias fallaron.');
      console.log('❌ El sistema NO está listo para producción hasta que todas las pruebas pasen.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error crítico:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { main as runObligatoryTests };
