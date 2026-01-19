/**
 * Configuración de Firebase Admin SDK
 * 
 * Este archivo inicializa Firebase Admin para uso en el backend
 * y proporciona acceso a Firestore y otras funcionalidades
 */

// Cargar variables de entorno (solo en desarrollo local)
import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import * as admin from 'firebase-admin';
import * as path from 'path';

/**
 * Inicializar Firebase Admin
 * 
 * IMPORTANTE: En producción, Firebase Functions ya tiene las credenciales
 * configuradas automáticamente. En desarrollo local, necesitas configurar
 * la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
 */
if (!admin.apps.length) {
  try {
    // Verificar si estamos en desarrollo local o en Cloud Functions
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Detectar si estamos en modo deploy/analizador de Firebase
    const isDeployPhase = process.env.FIREBASE_CONFIG || 
                          process.env.GCLOUD_PROJECT ||
                          (typeof process.env.FUNCTION_TARGET === 'undefined' && !process.env.FUNCTIONS_EMULATOR);
    
    // Detectar si estamos ejecutando como script (no como Cloud Function)
    const isScriptExecution = require.main !== undefined && 
                              !process.env.FUNCTION_TARGET && 
                              !process.env.FIREBASE_CONFIG;
    
    // Solo validar archivos en desarrollo local con emulador o cuando se ejecuta como script
    const shouldValidateFiles = (!isDeployPhase && process.env.FUNCTIONS_EMULATOR === 'true') || isScriptExecution;
    
    // Si estamos ejecutando como script, intentar usar el archivo local si existe
    let localServiceAccountPath: string | undefined;
    if (isScriptExecution) {
      const localPath = path.resolve(__dirname, '../../serviceAccountKey.json');
      if (require('fs').existsSync(localPath)) {
        localServiceAccountPath = localPath;
      }
    }
    
    const finalServiceAccountPath = serviceAccountPath || localServiceAccountPath;
    
    if (finalServiceAccountPath && shouldValidateFiles) {
      try {
        // Validar que sea una ruta de archivo válida (no un hash)
        if (finalServiceAccountPath.length > 200 || !finalServiceAccountPath.endsWith('.json')) {
          console.warn(`⚠️ Ruta de credenciales no parece ser válida: ${finalServiceAccountPath}`);
          // Fallback a credenciales por defecto
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
          });
          console.log('✅ Firebase Admin inicializado (modo local, usando credenciales por defecto)');
        } else {
          // Desarrollo local: usar service account
          const absolutePath = finalServiceAccountPath.startsWith('/') || finalServiceAccountPath.match(/^[A-Z]:/i) 
            ? finalServiceAccountPath 
            : path.resolve(__dirname, '../../', finalServiceAccountPath);
          
          if (require('fs').existsSync(absolutePath)) {
            const serviceAccount = require(absolutePath);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id,
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
            });
            console.log('✅ Firebase Admin inicializado correctamente (modo local)');
          } else {
            console.warn(`⚠️ No se encontró el archivo de credenciales: ${absolutePath}`);
            admin.initializeApp({
              credential: admin.credential.applicationDefault(),
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
            });
            console.log('✅ Firebase Admin inicializado (modo local, usando credenciales por defecto)');
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ Error cargando credenciales locales: ${error.message}`);
        // Fallback a credenciales por defecto
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
        });
        console.log('✅ Firebase Admin inicializado (usando credenciales por defecto)');
      }
    } else {
      // Cloud Functions o deploy: usar credenciales por defecto
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
      });
      if (!isDeployPhase) {
        console.log('✅ Firebase Admin inicializado correctamente (modo producción)');
      }
    }
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
    throw error;
  }
}

// Exportar instancias de servicios
export const db = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();

/**
 * Configuración de Firestore
 */
db.settings({
  ignoreUndefinedProperties: true,
});

/**
 * Colecciones principales
 */
export const COLLECTIONS = {
  SUPERATE_BASE: 'superate',
  AUTH: 'auth',
  QUESTIONS: 'questions',
  COUNTERS: 'counters',
  USERS: 'users', // @deprecated - Usar nueva estructura jerárquica por institución y rol
  INSTITUTIONS: 'institutions',
  // Nueva estructura jerárquica
  RECTORES: 'rectores',
  COORDINADORES: 'coordinadores',
  PROFESORES: 'profesores',
  ESTUDIANTES: 'estudiantes',
} as const;

/**
 * Rutas de Firestore
 */
export const FIRESTORE_PATHS = {
  questions: () => `${COLLECTIONS.SUPERATE_BASE}/${COLLECTIONS.AUTH}/${COLLECTIONS.QUESTIONS}`,
  question: (questionId: string) => 
    `${COLLECTIONS.SUPERATE_BASE}/${COLLECTIONS.AUTH}/${COLLECTIONS.QUESTIONS}/${questionId}`,
  counters: () => `${COLLECTIONS.SUPERATE_BASE}/${COLLECTIONS.AUTH}/${COLLECTIONS.COUNTERS}`,
  counter: (counterId: string) => 
    `${COLLECTIONS.SUPERATE_BASE}/${COLLECTIONS.AUTH}/${COLLECTIONS.COUNTERS}/${counterId}`,
} as const;

/**
 * Referencia a la colección de preguntas
 */
export const questionsCollection = () => 
  db.collection(FIRESTORE_PATHS.questions());

/**
 * Referencia a un documento de pregunta específico
 */
export const questionDocument = (questionId: string) => 
  db.doc(FIRESTORE_PATHS.question(questionId));

export default admin;

