/**
 * Utilidades para Firestore
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Obtiene una instancia de Firestore para el proyecto superate-6c730
 * donde están almacenados los resultados de los estudiantes
 */
export function getStudentDatabase(): admin.firestore.Firestore {
  try {
    // Intentar obtener la app existente para superate-6c730
    let studentApp: admin.app.App;
    try {
      studentApp = admin.app('superate-6c730');
    } catch {
      // Si no existe, crear una nueva app para superate-6c730
      // Intentar cargar las credenciales del proyecto superate-6c730
      const credentialsPath = path.resolve(__dirname, '../../serviceAccountKey.json');
      
      if (fs.existsSync(credentialsPath)) {
        // Desarrollo local: usar archivo de credenciales
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
          studentApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'superate-6c730',
          }, 'superate-6c730');
          console.log('✅ Base de datos de estudiantes (superate-6c730) inicializada con credenciales locales');
        } catch (error: any) {
          console.warn('⚠️ Error cargando credenciales locales, intentando con credenciales por defecto:', error.message);
          // Fallback: usar credenciales por defecto
          studentApp = admin.initializeApp({
            projectId: 'superate-6c730',
          }, 'superate-6c730');
        }
      } else {
        // Producción (Cloud Functions): usar credenciales por defecto
        // Esto funcionará si las credenciales de superate-ia tienen acceso a superate-6c730
        // O si ambos proyectos están en la misma organización de GCP
        console.log('📝 Usando credenciales por defecto para acceder a superate-6c730');
        studentApp = admin.initializeApp({
          projectId: 'superate-6c730',
        }, 'superate-6c730');
      }
    }
    
    // Obtener Firestore
    return studentApp.firestore();
  } catch (error: any) {
    console.error('❌ Error obteniendo base de datos de estudiantes:', error);
    throw new Error(`No se pudo acceder a la base de datos superate-6c730: ${error.message}`);
  }
}
