/**
 * Configuración de Firebase Admin SDK
 * 
 * Este archivo inicializa Firebase Admin para uso en el backend
 * y proporciona acceso a Firestore y otras funcionalidades
 */

// Cargar variables de entorno
import * as dotenv from 'dotenv';
dotenv.config();

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
    
    if (serviceAccountPath) {
      // Validar que sea una ruta de archivo válida (no un hash)
      if (serviceAccountPath.length > 200 || !serviceAccountPath.endsWith('.json')) {
        throw new Error(
          `GOOGLE_APPLICATION_CREDENTIALS debe ser una ruta a un archivo JSON. ` +
          `Valor actual parece ser un hash. ` +
          `Configura GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json en tu archivo .env`
        );
      }
      
      // Desarrollo local: usar service account
      // Construir ruta absoluta desde la raíz del proyecto functions
      const absolutePath = path.resolve(__dirname, '../../', serviceAccountPath);
      
      if (!require('fs').existsSync(absolutePath)) {
        throw new Error(
          `No se encontró el archivo de credenciales de Firebase: ${absolutePath}\n` +
          `Asegúrate de que el archivo existe y que GOOGLE_APPLICATION_CREDENTIALS en .env apunta a la ruta correcta.`
        );
      }
      
      const serviceAccount = require(absolutePath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
      });
      console.log('✅ Firebase Admin inicializado correctamente (modo local)');
    } else {
      // Cloud Functions: usar credenciales por defecto
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'superate-6c730.firebasestorage.app',
      });
      console.log('✅ Firebase Admin inicializado correctamente (modo producción)');
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
  USERS: 'users',
  INSTITUTIONS: 'institutions',
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

