/**
 * Script para Eliminar Usuarios Migrados de Estructura Antigua
 * 
 * Este script elimina los usuarios que ya fueron migrados a la nueva estructura
 * jerárquica de la colección antigua 'users'.
 * 
 * IMPORTANTE: Solo elimina usuarios que existen en la nueva estructura.
 * Los usuarios admin se mantienen en la estructura antigua si no tienen institutionId.
 * 
 * Uso:
 *   ts-node functions/src/scripts/deleteOldStructureUsers.ts
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

interface DeletionStats {
  total: number;
  deleted: number;
  kept: number;
  errors: number;
  byRole: { [key: string]: number };
}

/**
 * Verifica si un usuario existe en la nueva estructura
 */
async function userExistsInNewStructure(userId: string): Promise<boolean> {
  try {
    const institutionsRef = db.collection('superate').doc('auth').collection('institutions');
    const institutionsSnap = await institutionsRef.get();

    for (const institutionDoc of institutionsSnap.docs) {
      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes'];
      
      for (const role of roles) {
        const userRef = institutionDoc.ref.collection(role).doc(userId);
        const userSnap = await userRef.get();
        
        if (userSnap.exists) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error verificando usuario ${userId}:`, error);
    return false;
  }
}

/**
 * Elimina usuarios migrados de la estructura antigua
 */
async function deleteMigratedUsers(): Promise<DeletionStats> {
  const stats: DeletionStats = {
    total: 0,
    deleted: 0,
    kept: 0,
    errors: 0,
    byRole: {}
  };

  try {
    console.log('🔍 Obteniendo usuarios de estructura antigua...');
    
    // Obtener todos los usuarios de estructura antigua
    const oldUsersRef = db.collection('superate').doc('auth').collection('users');
    const oldUsersSnap = await oldUsersRef.get();
    
    stats.total = oldUsersSnap.size;
    console.log(`📊 Total de usuarios en estructura antigua: ${stats.total}\n`);

    if (stats.total === 0) {
      console.log('✅ No hay usuarios en estructura antigua');
      return stats;
    }

    // Procesar usuarios en lotes
    const BATCH_SIZE = 10;
    const users = oldUsersSnap.docs;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}...`);

      await Promise.all(
        batch.map(async (userDoc) => {
          const userId = userDoc.id;
          const userData = userDoc.data();
          const role = userData.role || 'unknown';

          try {
            // Verificar si existe en nueva estructura
            const existsInNew = await userExistsInNewStructure(userId);

            if (existsInNew) {
              // Usuario migrado - eliminar de estructura antigua
              await userDoc.ref.delete();
              stats.deleted++;
              stats.byRole[role] = (stats.byRole[role] || 0) + 1;
              console.log(`✅ Usuario ${userId} (${role}) eliminado de estructura antigua`);
            } else {
              // Usuario no migrado (probablemente admin) - mantener
              stats.kept++;
              console.log(`ℹ️ Usuario ${userId} (${role}) mantenido en estructura antigua (no migrado)`);
            }
          } catch (error: any) {
            stats.errors++;
            console.error(`❌ Error procesando usuario ${userId}:`, error.message);
          }
        })
      );

      // Pequeño delay entre lotes
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mostrar resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE ELIMINACIÓN');
    console.log('='.repeat(60));
    console.log(`Total usuarios procesados: ${stats.total}`);
    console.log(`✅ Usuarios eliminados: ${stats.deleted}`);
    console.log(`ℹ️ Usuarios mantenidos: ${stats.kept}`);
    console.log(`❌ Errores: ${stats.errors}`);
    console.log('\n📈 Eliminados por rol:');
    Object.entries(stats.byRole).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count}`);
    });

    return stats;
  } catch (error: any) {
    console.error('\n❌ Error crítico durante eliminación:', error);
    throw error;
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

    console.log('⚠️ ADVERTENCIA: Este script eliminará usuarios migrados de la estructura antigua.');
    console.log('⚠️ Solo se eliminarán usuarios que existen en la nueva estructura.\n');

    const stats = await deleteMigratedUsers();

    if (stats.deleted > 0) {
      console.log('\n✅ Eliminación completada exitosamente');
      console.log(`✅ ${stats.deleted} usuarios eliminados de estructura antigua`);
    } else {
      console.log('\nℹ️ No se eliminaron usuarios (todos están en nueva estructura o son admin)');
    }

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

export { deleteMigratedUsers };
