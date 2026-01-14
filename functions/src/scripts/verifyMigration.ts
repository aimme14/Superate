/**
 * Script de Verificación Post-Migración
 * 
 * Este script verifica la integridad de la migración de usuarios
 * comparando datos entre la estructura antigua y la nueva.
 * 
 * Uso:
 *   ts-node functions/src/scripts/verifyMigration.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Inicializar Firebase Admin para el script
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
      console.log('✅ Firebase Admin inicializado con serviceAccountKey.json');
    } else {
      admin.initializeApp({
        projectId: 'superate-6c730',
      });
      console.log('✅ Firebase Admin inicializado con credenciales por defecto');
    }
    
    return admin.firestore();
  } catch (error: any) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    throw new Error(`No se pudo inicializar Firebase Admin: ${error.message}`);
  }
}

const db = initializeFirebaseAdmin();

const VALID_ROLES = ['rector', 'principal', 'teacher', 'student'] as const;
type ValidRole = typeof VALID_ROLES[number];

const ROLE_TO_COLLECTION: Record<ValidRole, string> = {
  'rector': 'rectores',
  'principal': 'coordinadores',
  'teacher': 'profesores',
  'student': 'estudiantes'
};

interface VerificationResult {
  userId: string;
  role: string;
  institutionId: string;
  status: 'ok' | 'missing_in_new' | 'missing_in_old' | 'data_mismatch' | 'error';
  details?: string;
}

/**
 * Verifica si un usuario existe en la nueva estructura
 */
async function userExistsInNewStructure(
  institutionId: string,
  role: ValidRole,
  userId: string
): Promise<boolean> {
  try {
    const collectionName = ROLE_TO_COLLECTION[role];
    const userRef = db
      .collection('superate')
      .doc('auth')
      .collection('institutions')
      .doc(institutionId)
      .collection(collectionName)
      .doc(userId);
    const userSnap = await userRef.get();
    return userSnap.exists;
  } catch (error) {
    return false;
  }
}

/**
 * Compara datos clave entre estructura antigua y nueva
 */
function compareUserData(oldData: any, newData: any): { match: boolean; differences: string[] } {
  const differences: string[] = [];
  
  // Campos clave a comparar
  const keyFields = ['name', 'email', 'role', 'institutionId', 'inst', 'grade', 'gradeName', 'campus', 'campusId'];
  
  for (const field of keyFields) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    
    if (oldValue !== undefined && newValue !== undefined) {
      if (oldValue !== newValue) {
        differences.push(`${field}: "${oldValue}" (old) vs "${newValue}" (new)`);
      }
    } else if (oldValue !== undefined && newValue === undefined) {
      differences.push(`${field}: existe en estructura antigua pero no en nueva`);
    } else if (oldValue === undefined && newValue !== undefined) {
      differences.push(`${field}: existe en estructura nueva pero no en antigua`);
    }
  }
  
  return {
    match: differences.length === 0,
    differences
  };
}

/**
 * Verifica un usuario específico
 */
async function verifyUser(
  userId: string,
  oldUserData: admin.firestore.DocumentData
): Promise<VerificationResult> {
  try {
    const role = oldUserData.role as string;
    const institutionId = oldUserData.institutionId || oldUserData.inst;

    if (!role || !VALID_ROLES.includes(role as ValidRole)) {
      return {
        userId,
        role: role || 'unknown',
        institutionId: institutionId || 'unknown',
        status: 'ok',
        details: 'Rol no válido (se omite en migración)'
      };
    }

    if (!institutionId) {
      return {
        userId,
        role,
        institutionId: 'unknown',
        status: 'ok',
        details: 'Sin institutionId (admin, se omite en migración)'
      };
    }

    const existsInNew = await userExistsInNewStructure(institutionId, role as ValidRole, userId);
    
    if (!existsInNew) {
      return {
        userId,
        role,
        institutionId,
        status: 'missing_in_new',
        details: 'Usuario no encontrado en nueva estructura'
      };
    }

    // Obtener datos de la nueva estructura para comparar
    const collectionName = ROLE_TO_COLLECTION[role as ValidRole];
    const newUserRef = db
      .collection('superate')
      .doc('auth')
      .collection('institutions')
      .doc(institutionId)
      .collection(collectionName)
      .doc(userId);
    const newUserSnap = await newUserRef.get();
    
    if (!newUserSnap.exists) {
      return {
        userId,
        role,
        institutionId,
        status: 'error',
        details: 'Error obteniendo datos de nueva estructura'
      };
    }

    const newUserData = newUserSnap.data();
    const comparison = compareUserData(oldUserData, newUserData || {});

    if (!comparison.match) {
      return {
        userId,
        role,
        institutionId,
        status: 'data_mismatch',
        details: `Diferencias: ${comparison.differences.join('; ')}`
      };
    }

    return {
      userId,
      role,
      institutionId,
      status: 'ok',
      details: 'Usuario verificado correctamente'
    };
  } catch (error: any) {
    return {
      userId,
      role: oldUserData.role || 'unknown',
      institutionId: oldUserData.institutionId || oldUserData.inst || 'unknown',
      status: 'error',
      details: `Error: ${error.message}`
    };
  }
}

/**
 * Verifica todos los usuarios migrados
 */
async function verifyAllUsers(): Promise<void> {
  console.log('🔍 Iniciando verificación de migración...\n');

  try {
    // Obtener usuarios de estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersSnap = await oldUsersRef.get();
    
    console.log(`📊 Total de usuarios en estructura antigua: ${oldUsersSnap.size}\n`);

    if (oldUsersSnap.size === 0) {
      console.log('✅ No hay usuarios para verificar');
      return;
    }

    const results: VerificationResult[] = [];
    const stats = {
      ok: 0,
      missing_in_new: 0,
      data_mismatch: 0,
      error: 0,
      skipped: 0
    };

    // Verificar usuarios en lotes
    const BATCH_SIZE = 10;
    const users = oldUsersSnap.docs;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`📦 Verificando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}...`);

      const batchResults = await Promise.all(
        batch.map(async (userDoc) => {
          const userId = userDoc.id;
          const userData = userDoc.data();
          return await verifyUser(userId, userData);
        })
      );

      results.push(...batchResults);

      // Actualizar estadísticas
      batchResults.forEach(result => {
        if (result.details?.includes('se omite')) {
          stats.skipped++;
        } else {
          stats[result.status as keyof typeof stats]++;
        }
      });

      // Delay entre lotes
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VERIFICACIÓN');
    console.log('='.repeat(60));
    console.log(`Total usuarios verificados: ${results.length}`);
    console.log(`✅ Usuarios OK: ${stats.ok}`);
    console.log(`⚠️ Usuarios omitidos (admin/sin rol válido): ${stats.skipped}`);
    console.log(`❌ Usuarios faltantes en nueva estructura: ${stats.missing_in_new}`);
    console.log(`⚠️ Usuarios con diferencias de datos: ${stats.data_mismatch}`);
    console.log(`❌ Errores durante verificación: ${stats.error}`);

    // Mostrar problemas encontrados
    const problems = results.filter(r => 
      r.status === 'missing_in_new' || 
      r.status === 'data_mismatch' || 
      r.status === 'error'
    );

    if (problems.length > 0) {
      console.log('\n⚠️ PROBLEMAS ENCONTRADOS:');
      problems.forEach(problem => {
        console.log(`   - ${problem.userId} (${problem.role}): ${problem.status} - ${problem.details}`);
      });
    } else {
      console.log('\n✅ No se encontraron problemas en la migración');
    }

    console.log('\n');
  } catch (error: any) {
    console.error('\n❌ Error durante la verificación:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    if (!admin.apps.length) {
      console.error('❌ Firebase Admin no está inicializado');
      process.exit(1);
    }

    console.log('🔧 Configuración:');
    console.log(`   - Proyecto: ${admin.app().options.projectId}`);
    console.log(`   - Ambiente: ${process.env.NODE_ENV || 'production'}\n`);

    await verifyAllUsers();

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

export { verifyAllUsers };
