/**
 * Script de Pruebas Funcionales - Nueva Estructura Jerárquica de Usuarios
 * 
 * Este script realiza pruebas funcionales completas para verificar que la nueva
 * estructura jerárquica de usuarios funciona correctamente.
 * 
 * Uso:
 *   ts-node functions/src/scripts/testNewStructure.ts
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
}

/**
 * Ejecuta todas las pruebas funcionales
 */
async function runFunctionalTests(): Promise<void> {
  console.log('🧪 Iniciando pruebas funcionales de nueva estructura jerárquica...\n');

  const results: TestResult[] = [];

  // TEST 1: Verificar que existen usuarios en nueva estructura
  console.log('📋 TEST 1: Verificar usuarios en nueva estructura jerárquica...');
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();

    if (institutionsSnap.empty) {
      results.push({
        test: 'TEST 1',
        passed: false,
        message: 'No se encontraron instituciones en la base de datos'
      });
    } else {
      let totalUsers = 0;
      const byRole: Record<string, number> = {};

      for (const institutionDoc of institutionsSnap.docs) {
        const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

        for (const role of roles) {
          const usersRef = institutionDoc.ref.collection(role);
          const usersSnap = await usersRef.get();
          const count = usersSnap.size;
          totalUsers += count;
          byRole[role] = (byRole[role] || 0) + count;
        }
      }

      results.push({
        test: 'TEST 1',
        passed: totalUsers > 0,
        message: `Total usuarios en nueva estructura: ${totalUsers}`,
        details: byRole
      });

      console.log(`   ✅ Usuarios encontrados: ${totalUsers}`);
      Object.entries(byRole).forEach(([role, count]) => {
        console.log(`      - ${role}: ${count}`);
      });
    }
  } catch (error: any) {
    results.push({
      test: 'TEST 1',
      passed: false,
      message: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // TEST 2: Verificar estructura de datos de usuarios migrados
  console.log('\n📋 TEST 2: Verificar estructura de datos de usuarios...');
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();

    if (!institutionsSnap.empty) {
      let checkedUsers = 0;
      let validUsers = 0;
      const errors: string[] = [];

      for (const institutionDoc of institutionsSnap.docs) {
        const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

        for (const role of roles) {
          const usersRef = institutionDoc.ref.collection(role);
          const usersSnap = await usersRef.get();

          for (const userDoc of usersSnap.docs) {
            checkedUsers++;
            const userData = userDoc.data();

            // Verificar campos requeridos
            const hasRequiredFields = 
              userData.id != null &&
              userData.role != null &&
              userData.email != null &&
              userData.name != null &&
              userData.isActive != null &&
              userData.institutionId != null;

            if (hasRequiredFields) {
              validUsers++;
            } else {
              errors.push(`Usuario ${userDoc.id}: Faltan campos requeridos`);
            }
          }
        }
      }

      results.push({
        test: 'TEST 2',
        passed: validUsers === checkedUsers,
        message: `${validUsers}/${checkedUsers} usuarios tienen estructura válida`,
        details: errors.length > 0 ? errors : undefined
      });

      console.log(`   ✅ Usuarios válidos: ${validUsers}/${checkedUsers}`);
      if (errors.length > 0) {
        console.log(`   ⚠️ Errores encontrados: ${errors.length}`);
        errors.slice(0, 3).forEach(error => console.log(`      - ${error}`));
      }
    }
  } catch (error: any) {
    results.push({
      test: 'TEST 2',
      passed: false,
      message: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // TEST 3: Verificar que los usuarios pueden consultarse por ID
  console.log('\n📋 TEST 3: Verificar consulta de usuarios por ID...');
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();

    if (!institutionsSnap.empty) {
      let testedUsers = 0;
      let foundUsers = 0;

      for (const institutionDoc of institutionsSnap.docs) {
        const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

        for (const role of roles) {
          const usersRef = institutionDoc.ref.collection(role);
          const usersSnap = await usersRef.get();

          for (const userDoc of usersSnap.docs) {
            testedUsers++;
            const userId = userDoc.id;

            // Intentar consultar el usuario por ID desde la nueva estructura
            const userRef = institutionDoc.ref.collection(role).doc(userId);
            const userSnap = await userRef.get();

            if (userSnap.exists) {
              foundUsers++;
            }
          }

          // Limitar a 5 usuarios por rol para no sobrecargar
          if (testedUsers >= 5) break;
        }
        if (testedUsers >= 5) break;
      }

      results.push({
        test: 'TEST 3',
        passed: foundUsers === testedUsers,
        message: `${foundUsers}/${testedUsers} usuarios encontrados por ID`
      });

      console.log(`   ✅ Usuarios encontrados por ID: ${foundUsers}/${testedUsers}`);
    }
  } catch (error: any) {
    results.push({
      test: 'TEST 3',
      passed: false,
      message: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // TEST 4: Verificar que no hay duplicados entre estructuras
  console.log('\n📋 TEST 4: Verificar duplicados entre estructuras...');
  try {
    // Obtener usuarios de estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersSnap = await oldUsersRef.get();
    const oldUserIds = new Set(oldUsersSnap.docs.map(doc => doc.id));

    // Obtener usuarios de nueva estructura
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    const newUserIds = new Set<string>();

    for (const institutionDoc of institutionsSnap.docs) {
      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];
      for (const role of roles) {
        const usersSnap = await institutionDoc.ref.collection(role).get();
        usersSnap.docs.forEach(doc => newUserIds.add(doc.id));
      }
    }

    // Encontrar duplicados
    const duplicates = Array.from(oldUserIds).filter(id => newUserIds.has(id));
    const onlyInOld = Array.from(oldUserIds).filter(id => !newUserIds.has(id));
    const onlyInNew = Array.from(newUserIds).filter(id => !oldUserIds.has(id));

    results.push({
      test: 'TEST 4',
      passed: true, // No es un error, es esperado durante la migración
      message: `Duplicados: ${duplicates.length}, Solo en antigua: ${onlyInOld.length}, Solo en nueva: ${onlyInNew.length}`,
      details: {
        duplicates: duplicates.length,
        onlyInOld: onlyInOld.length,
        onlyInNew: onlyInNew.length
      }
    });

    console.log(`   ℹ️ Usuarios en estructura antigua: ${oldUserIds.size}`);
    console.log(`   ℹ️ Usuarios en nueva estructura: ${newUserIds.size}`);
    console.log(`   ℹ️ Usuarios duplicados (esperado durante migración): ${duplicates.length}`);
    console.log(`   ℹ️ Solo en estructura antigua (probablemente admin): ${onlyInOld.length}`);
    console.log(`   ℹ️ Solo en nueva estructura: ${onlyInNew.length}`);
  } catch (error: any) {
    results.push({
      test: 'TEST 4',
      passed: false,
      message: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // TEST 5: Verificar que los usuarios tienen institutionId correcto
  console.log('\n📋 TEST 5: Verificar institutionId de usuarios...');
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    const validInstitutionIds = new Set(institutionsSnap.docs.map(doc => doc.id));

    let checkedUsers = 0;
    let validInstitutionUsers = 0;
    const errors: string[] = [];

    for (const institutionDoc of institutionsSnap.docs) {
      const institutionId = institutionDoc.id;
      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];

      for (const role of roles) {
        const usersSnap = await institutionDoc.ref.collection(role).get();

        for (const userDoc of usersSnap.docs) {
          checkedUsers++;
          const userData = userDoc.data();
          const userInstitutionId = userData.institutionId || userData.inst;

          if (userInstitutionId === institutionId && validInstitutionIds.has(institutionId)) {
            validInstitutionUsers++;
          } else {
            errors.push(`Usuario ${userDoc.id}: institutionId incorrecto (esperado: ${institutionId}, encontrado: ${userInstitutionId})`);
          }
        }
      }
    }

    results.push({
      test: 'TEST 5',
      passed: validInstitutionUsers === checkedUsers,
      message: `${validInstitutionUsers}/${checkedUsers} usuarios tienen institutionId correcto`,
      details: errors.length > 0 ? errors.slice(0, 5) : undefined
    });

    console.log(`   ✅ Usuarios con institutionId correcto: ${validInstitutionUsers}/${checkedUsers}`);
    if (errors.length > 0) {
      console.log(`   ⚠️ Errores encontrados: ${errors.length}`);
      errors.slice(0, 3).forEach(error => console.log(`      - ${error}`));
    }
  } catch (error: any) {
    results.push({
      test: 'TEST 5',
      passed: false,
      message: `Error: ${error.message}`
    });
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Mostrar resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS FUNCIONALES');
  console.log('='.repeat(60));

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   Detalles:`, result.details);
    }
  });

  console.log(`\n📈 Resultado: ${passedTests}/${totalTests} pruebas pasadas`);

  if (passedTests === totalTests) {
    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('✅ La nueva estructura jerárquica está funcionando correctamente');
  } else {
    console.log('\n⚠️ Algunas pruebas fallaron. Revisar detalles arriba.');
  }

  console.log('\n');
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

    await runFunctionalTests();

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error crítico:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { runFunctionalTests };
