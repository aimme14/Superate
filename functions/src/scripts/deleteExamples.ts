/**
 * Script para eliminar ejemplos de vocabulario de una materia
 * 
 * Uso:
 *   npm run build && node lib/scripts/deleteExamples.js matematicas
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  try {
    // Intentar cargar credenciales locales si existen
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin inicializado con credenciales locales');
    } else {
      // Usar credenciales por defecto (para producción o con GOOGLE_APPLICATION_CREDENTIALS)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('✅ Firebase Admin inicializado con credenciales por defecto');
    }
  } catch (error: any) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    throw error;
  }
}

const db = admin.firestore();

/**
 * Elimina todos los ejemplos de palabras de una materia
 */
async function deleteExamples(materia: string): Promise<void> {
  try {
    const normalizedMateria = materia.toLowerCase().replace(/\s+/g, '_');
    const materiaRef = db.collection('definitionswords').doc(normalizedMateria);
    const palabrasRef = materiaRef.collection('palabras');

    console.log(`\n🗑️ Eliminando ejemplos de la materia: ${materia} (${normalizedMateria})`);

    // Obtener todas las palabras activas que tienen ejemplo
    const snapshot = await palabrasRef.where('activa', '==', true).get();
    
    const wordsWithExample = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.ejemploIcfes && data.ejemploIcfes.trim() !== '';
    });

    console.log(`   Total de palabras con ejemplo: ${wordsWithExample.length}`);

    if (wordsWithExample.length === 0) {
      console.log('   ✅ No hay ejemplos para eliminar');
      return;
    }

    let deleted = 0;
    let failed = 0;

    // Usar batch writes para eliminar el campo ejemploIcfes
    const batchSize = 500; // Límite de Firestore
    for (let i = 0; i < wordsWithExample.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = wordsWithExample.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        try {
          batch.update(doc.ref, {
            ejemploIcfes: admin.firestore.FieldValue.delete(),
            respuestaEjemploIcfes: admin.firestore.FieldValue.delete(),
          });
        } catch (error: any) {
          console.error(`   ❌ Error preparando eliminación para ${doc.id}:`, error.message);
          failed++;
        }
      }

      try {
        await batch.commit();
        deleted += batchDocs.length;
        console.log(`   ✅ Eliminados ${batchDocs.length} ejemplo(s) (lote ${Math.floor(i / batchSize) + 1})`);
      } catch (error: any) {
        console.error(`   ❌ Error ejecutando batch:`, error.message);
        failed += batchDocs.length;
      }
    }

    console.log(`\n✅ Proceso completado:`);
    console.log(`   Eliminados: ${deleted}`);
    console.log(`   Fallidos: ${failed}`);
  } catch (error: any) {
    console.error(`❌ Error eliminando ejemplos:`, error);
    throw error;
  }
}

// Ejecutar script
const materia = process.argv[2] || 'matematicas';

deleteExamples(materia)
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando script:', error);
    process.exit(1);
  });
