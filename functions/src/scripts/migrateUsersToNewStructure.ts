/**
 * Script de Migración de Usuarios a Nueva Estructura Jerárquica
 * 
 * Este script migra usuarios existentes de la estructura antigua (users collection)
 * a la nueva estructura jerárquica organizada por institución y rol.
 * 
 * IMPORTANTE:
 * - Ejecutar primero en ambiente de desarrollo
 * - Verificar integridad de datos después de la migración
 * - Hacer backup de la base de datos antes de ejecutar en producción
 * - Los usuarios admin NO se migran (permanecen en estructura antigua)
 * 
 * Uso:
 *   ts-node functions/src/scripts/migrateUsersToNewStructure.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Inicializar Firebase Admin para el script
 */
function initializeFirebaseAdmin(): admin.firestore.Firestore {
  // Verificar si Firebase Admin ya está inicializado
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  try {
    // Intentar cargar credenciales del service account
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'superate-6c730',
      });
      console.log('✅ Firebase Admin inicializado con serviceAccountKey.json');
    } else {
      // Intentar usar credenciales por defecto
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

// Inicializar Firebase Admin y obtener db
const db = initializeFirebaseAdmin();

/**
 * Roles válidos para la nueva estructura jerárquica
 */
const VALID_ROLES = ['rector', 'principal', 'teacher', 'student'] as const;
type ValidRole = typeof VALID_ROLES[number];

/**
 * Mapeo de roles a nombres de colección en la nueva estructura
 */
const ROLE_TO_COLLECTION: Record<ValidRole, string> = {
  'rector': 'rectores',
  'principal': 'coordinadores',
  'teacher': 'profesores',
  'student': 'estudiantes'
};

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  byRole: Record<string, number>;
  errorsList: Array<{ userId: string; error: string }>;
}

/**
 * Verifica si un usuario ya existe en la nueva estructura
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
 * Migra un usuario a la nueva estructura jerárquica
 */
async function migrateUser(
  userId: string,
  userData: admin.firestore.DocumentData,
  stats: MigrationStats
): Promise<boolean> {
  try {
    const role = userData.role as string;
    const institutionId = userData.institutionId || userData.inst;

    // Validar que el usuario tenga un rol válido
    if (!VALID_ROLES.includes(role as ValidRole)) {
      console.log(`⚠️ Usuario ${userId}: Rol '${role}' no válido para migración (se omite)`);
      stats.skipped++;
      return false;
    }

    // Validar que el usuario tenga institutionId
    if (!institutionId) {
      console.log(`⚠️ Usuario ${userId}: Sin institutionId (se omite - probablemente admin)`);
      stats.skipped++;
      return false;
    }

    // Verificar si el usuario ya existe en la nueva estructura
    const exists = await userExistsInNewStructure(institutionId, role as ValidRole, userId);
    if (exists) {
      console.log(`ℹ️ Usuario ${userId}: Ya existe en nueva estructura (se omite)`);
      stats.skipped++;
      return false;
    }

    // Preparar datos del usuario para la nueva estructura
    const collectionName = ROLE_TO_COLLECTION[role as ValidRole];
    const newUserData = {
      ...userData,
      id: userId,
      uid: userId,
      institutionId: institutionId,
      inst: institutionId, // Mantener inst para retrocompatibilidad
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: 'users' // Marcar que fue migrado desde la estructura antigua
    };

    // Crear el usuario en la nueva estructura
    const newUserRef = db
      .collection('superate')
      .doc('auth')
      .collection('institutions')
      .doc(institutionId)
      .collection(collectionName)
      .doc(userId);

    await newUserRef.set(newUserData);

    console.log(`✅ Usuario ${userId} (${role}) migrado a institutions/${institutionId}/${collectionName}`);
    stats.migrated++;
    stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    return true;
  } catch (error: any) {
    console.error(`❌ Error migrando usuario ${userId}:`, error.message);
    stats.errors++;
    stats.errorsList.push({
      userId,
      error: error.message || 'Error desconocido'
    });
    return false;
  }
}

/**
 * Migra todos los usuarios de la estructura antigua a la nueva estructura jerárquica
 */
async function migrateAllUsers(): Promise<MigrationStats> {
  console.log('🚀 Iniciando migración de usuarios a nueva estructura jerárquica...\n');

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    byRole: {},
    errorsList: []
  };

  try {
    // Obtener todos los usuarios de la estructura antigua
    const usersRef = db.collection('superate').doc('auth').collection('users');
    const usersSnap = await usersRef.get();

    stats.total = usersSnap.size;
    console.log(`📊 Total de usuarios encontrados en estructura antigua: ${stats.total}\n`);

    if (stats.total === 0) {
      console.log('✅ No hay usuarios para migrar');
      return stats;
    }

    // Migrar usuarios en lotes para no sobrecargar Firestore
    const BATCH_SIZE = 10;
    const users = usersSnap.docs;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}...`);

      await Promise.all(
        batch.map(async (userDoc) => {
          const userId = userDoc.id;
          const userData = userDoc.data();
          await migrateUser(userId, userData, stats);
        })
      );

      // Pequeño delay entre lotes para no sobrecargar Firestore
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`Total usuarios procesados: ${stats.total}`);
    console.log(`✅ Usuarios migrados exitosamente: ${stats.migrated}`);
    console.log(`⚠️ Usuarios omitidos: ${stats.skipped}`);
    console.log(`❌ Errores: ${stats.errors}`);
    console.log('\n📈 Migrados por rol:');
    Object.entries(stats.byRole).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count}`);
    });

    if (stats.errorsList.length > 0) {
      console.log('\n❌ Errores detallados:');
      stats.errorsList.forEach(({ userId, error }) => {
        console.log(`   - ${userId}: ${error}`);
      });
    }

    console.log('\n✅ Migración completada');
    return stats;
  } catch (error: any) {
    console.error('\n❌ Error crítico durante la migración:', error);
    throw error;
  }
}

/**
 * Verifica la integridad de la migración
 */
async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verificando integridad de la migración...\n');

  try {
    // Contar usuarios en estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersSnap = await oldUsersRef.get();
    const oldUsersCount = oldUsersSnap.size;

    // Contar usuarios en nueva estructura (por rol)
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();
    
    let newUsersCount = 0;
    const byRole: Record<string, number> = {};

    for (const institutionDoc of institutionsSnap.docs) {
      for (const role of VALID_ROLES) {
        const collectionName = ROLE_TO_COLLECTION[role];
        const usersRef = institutionDoc.ref.collection(collectionName);
        const usersSnap = await usersRef.get();
        const count = usersSnap.size;
        newUsersCount += count;
        byRole[role] = (byRole[role] || 0) + count;
      }
    }

    console.log(`📊 Usuarios en estructura antigua: ${oldUsersCount}`);
    console.log(`📊 Usuarios en nueva estructura: ${newUsersCount}`);
    console.log('\n📈 Usuarios en nueva estructura por rol:');
    Object.entries(byRole).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count}`);
    });

    // Verificar usuarios duplicados (en ambas estructuras)
    let duplicates = 0;
    for (const userDoc of oldUsersSnap.docs) {
      const userData = userDoc.data();
      const role = userData.role;
      const institutionId = userData.institutionId || userData.inst;

      if (VALID_ROLES.includes(role as ValidRole) && institutionId) {
        const exists = await userExistsInNewStructure(institutionId, role as ValidRole, userDoc.id);
        if (exists) {
          duplicates++;
        }
      }
    }

    console.log(`\n⚠️ Usuarios que existen en ambas estructuras: ${duplicates}`);
    console.log('\n✅ Verificación completada');
  } catch (error: any) {
    console.error('❌ Error durante la verificación:', error);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    // Verificar que Firebase Admin esté inicializado
    if (!admin.apps.length) {
      console.error('❌ Firebase Admin no está inicializado');
      process.exit(1);
    }

    console.log('🔧 Configuración:');
    console.log(`   - Proyecto: ${admin.app().options.projectId}`);
    console.log(`   - Ambiente: ${process.env.NODE_ENV || 'production'}\n`);

    // Confirmar antes de ejecutar (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ ATENCIÓN: Este script modificará la base de datos');
      console.log('⚠️ Asegúrate de tener un backup antes de continuar\n');
      // En desarrollo, podrías agregar una confirmación interactiva aquí
    }

    // Ejecutar migración
    const stats = await migrateAllUsers();

    // Verificar integridad
    await verifyMigration();

    // Mostrar recomendaciones
    console.log('\n' + '='.repeat(60));
    console.log('📋 RECOMENDACIONES');
    console.log('='.repeat(60));
    console.log('1. Verificar manualmente algunos usuarios migrados');
    console.log('2. Probar funcionalidad del sistema con usuarios migrados');
    console.log('3. Si todo está bien, ejecutar limpieza de estructura antigua');
    console.log('4. Hacer backup antes de eliminar estructura antigua');
    console.log('\n');

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n❌ Error crítico:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { migrateAllUsers, verifyMigration };
