import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  getDocs, 
  query, 
  where, 
  limit,
  runTransaction,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { firebaseApp } from '@/services/db';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

/**
 * Interfaz para las opciones de una pregunta
 */
export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

/**
 * Interfaz para una pregunta completa
 */
export interface Question {
  id?: string;
  code: string; // Ej: MAAL1F001
  subject: string; // Ej: "Matemáticas"
  subjectCode: string; // Ej: "MA"
  topic: string; // Ej: "Álgebra"
  topicCode: string; // Ej: "AL"
  grade: '6' | '7' | '8' | '9' | '0' | '1'; // 6=sexto, 7=séptimo, 8=octavo, 9=noveno, 0=décimo, 1=undécimo
  level: 'Fácil' | 'Medio' | 'Difícil';
  levelCode: 'F' | 'M' | 'D';
  informativeText?: string;
  informativeImages?: string[];
  questionText: string;
  questionImages?: string[];
  answerType: 'MCQ'; // Multiple Choice Question
  options: QuestionOption[];
  createdBy: string; // UID del usuario que creó la pregunta
  createdAt: Date;
  rand?: number; // Número aleatorio para muestreo eficiente
}

/**
 * Interfaz para filtros de búsqueda de preguntas
 */
export interface QuestionFilters {
  subject?: string;
  subjectCode?: string;
  topic?: string;
  topicCode?: string;
  grade?: string;
  level?: string;
  levelCode?: string;
  limit?: number;
}

/**
 * Servicio para gestionar preguntas en Firebase
 */
class QuestionService {
  private static instance: QuestionService;

  static getInstance() {
    if (!QuestionService.instance) {
      QuestionService.instance = new QuestionService();
    }
    return QuestionService.instance;
  }

  /**
   * Sube una imagen a Firebase Storage
   * @param file - Archivo de imagen a subir
   * @param path - Ruta donde se guardará la imagen
   * @returns URL de descarga de la imagen
   */
  async uploadImage(file: File, path: string): Promise<Result<string>> {
    try {
      // Validar tamaño de archivo (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return failure(new ErrorAPI({ 
          message: 'El archivo es demasiado grande. Tamaño máximo: 5MB', 
          statusCode: 400 
        }));
      }

      // Validar tipo de archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        return failure(new ErrorAPI({ 
          message: 'Tipo de archivo no válido. Solo se permiten imágenes (JPEG, PNG, WEBP)', 
          statusCode: 400 
        }));
      }

      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ Imagen subida exitosamente:', downloadURL);
      return success(downloadURL);
    } catch (e) {
      console.error('❌ Error al subir imagen:', e);
      return failure(new ErrorAPI(normalizeError(e, 'subir imagen')));
    }
  }

  /**
   * Elimina una imagen de Firebase Storage
   * @param imageUrl - URL de la imagen a eliminar
   */
  async deleteImage(imageUrl: string): Promise<Result<void>> {
    try {
      // Si la imagen es una data URI (base64), no está en Storage, no hay nada que eliminar
      if (imageUrl.startsWith('data:')) {
        console.log('ℹ️ La imagen es una data URI (base64), no se elimina de Storage');
        return success(undefined);
      }

      // Si es una URL de Firebase Storage, extraer la ruta del archivo
      let imagePath: string;
      
      // Verificar si es una URL completa de Firebase Storage
      // Formato: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const url = new URL(imageUrl);
          // Extraer la ruta desde el parámetro 'o' (el path está URL-encoded)
          const pathMatch = url.pathname.match(/\/o\/(.+)$/);
          if (pathMatch && pathMatch[1]) {
            // Decodificar el path
            imagePath = decodeURIComponent(pathMatch[1]);
          } else {
            console.warn('⚠️ No se pudo extraer la ruta de la URL de Storage:', imageUrl);
            return success(undefined); // No fallar, simplemente ignorar
          }
        } catch (urlError) {
          console.warn('⚠️ Error al parsear URL de Storage:', imageUrl, urlError);
          return success(undefined); // No fallar, simplemente ignorar
        }
      } else {
        // Asumir que es una ruta directa
        imagePath = imageUrl;
      }

      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
      console.log('✅ Imagen eliminada exitosamente de Storage:', imagePath);
      return success(undefined);
    } catch (e: any) {
      // Si el error es que el archivo no existe, no es crítico
      if (e?.code === 'storage/object-not-found') {
        console.log('ℹ️ La imagen no existe en Storage (puede haber sido eliminada previamente)');
        return success(undefined);
      }
      console.error('❌ Error al eliminar imagen:', e);
      // No fallar la eliminación completa si falla la eliminación de una imagen
      return success(undefined);
    }
  }

  /**
   * Genera el código único de la pregunta de forma atómica
   * Formato: <MAT><TOP><GRADE><NIV><SERIE>
   * Ejemplo: MAAL1F001
   * 
   * @param subjectCode - Código de la materia (2 letras)
   * @param topicCode - Código del tema (2 letras)
   * @param grade - Grado (1 carácter)
   * @param levelCode - Código del nivel (1 letra)
   * @returns Código único generado
   */
  async generateQuestionCode(
    subjectCode: string,
    topicCode: string,
    grade: string,
    levelCode: string
  ): Promise<Result<string>> {
    try {
      const counterKey = `${subjectCode}${topicCode}${grade}${levelCode}`;
      const counterRef = doc(db, 'superate', 'auth', 'counters', counterKey);

      // Usar transacción para garantizar atomicidad
      const newCode = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let currentCount = 1;
        if (counterDoc.exists()) {
          currentCount = (counterDoc.data().count || 0) + 1;
        }

        // Actualizar el contador
        transaction.set(counterRef, { count: currentCount }, { merge: true });

        // Generar el código con formato de 3 dígitos
        const serie = String(currentCount).padStart(3, '0');
        return `${counterKey}${serie}`;
      });

      console.log('✅ Código generado:', newCode);
      return success(newCode);
    } catch (e) {
      console.error('❌ Error al generar código:', e);
      return failure(new ErrorAPI(normalizeError(e, 'generar código de pregunta')));
    }
  }

  /**
   * Crea una nueva pregunta en Firestore
   * @param questionData - Datos de la pregunta (sin el código)
   * @param userId - UID del usuario que crea la pregunta
   * @returns La pregunta creada con su ID
   */
  async createQuestion(
    questionData: Omit<Question, 'id' | 'code' | 'createdBy' | 'createdAt' | 'rand'>,
    userId: string
  ): Promise<Result<Question>> {
    try {
      console.log('🚀 Iniciando creación de pregunta...');

      // Validar que exactamente una opción sea correcta
      const correctOptions = questionData.options.filter(opt => opt.isCorrect);
      if (correctOptions.length !== 1) {
        return failure(new ErrorAPI({ 
          message: 'Debe haber exactamente una opción correcta', 
          statusCode: 400 
        }));
      }

      // Validar que todas las opciones tengan texto o imagen
      const invalidOptions = questionData.options.filter(
        opt => !opt.text && !opt.imageUrl
      );
      if (invalidOptions.length > 0) {
        return failure(new ErrorAPI({ 
          message: 'Todas las opciones deben tener texto o imagen', 
          statusCode: 400 
        }));
      }

      // Generar código único
      const codeResult = await this.generateQuestionCode(
        questionData.subjectCode,
        questionData.topicCode,
        questionData.grade,
        questionData.levelCode
      );

      if (!codeResult.success) {
        return failure(codeResult.error);
      }

      // Crear el documento de la pregunta
      const questionRef = doc(collection(db, 'superate', 'auth', 'questions'));
      
      const question: Question = {
        id: questionRef.id,
        code: codeResult.data,
        subject: questionData.subject,
        subjectCode: questionData.subjectCode,
        topic: questionData.topic,
        topicCode: questionData.topicCode,
        grade: questionData.grade,
        level: questionData.level,
        levelCode: questionData.levelCode,
        informativeText: questionData.informativeText,
        informativeImages: questionData.informativeImages,
        questionText: questionData.questionText,
        questionImages: questionData.questionImages,
        answerType: questionData.answerType,
        options: questionData.options,
        createdBy: userId,
        createdAt: new Date(),
        rand: Math.random(), // Para muestreo aleatorio eficiente
      };

      // Preparar datos para Firestore (sin campos undefined)
      const firestoreData = Object.fromEntries(
        Object.entries({
          ...question,
          createdAt: Timestamp.fromDate(question.createdAt),
        }).filter(([_, value]) => value !== undefined)
      );

      await setDoc(questionRef, firestoreData);

      console.log('✅ Pregunta creada exitosamente:', question.code);
      return success(question);
    } catch (e) {
      console.error('❌ Error al crear pregunta:', e);
      return failure(new ErrorAPI(normalizeError(e, 'crear pregunta')));
    }
  }

  /**
   * Obtiene una pregunta por su ID
   * @param questionId - ID de la pregunta
   * @returns La pregunta encontrada
   */
  async getQuestionById(questionId: string): Promise<Result<Question>> {
    try {
      const questionRef = doc(db, 'superate', 'auth', 'questions', questionId);
      const questionSnap = await getDoc(questionRef);

      if (!questionSnap.exists()) {
        return failure(new ErrorAPI({ 
          message: 'Pregunta no encontrada', 
          statusCode: 404 
        }));
      }

      const data = questionSnap.data();
      const question: Question = {
        ...data,
        id: questionSnap.id,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Question;

      return success(question);
    } catch (e) {
      console.error('❌ Error al obtener pregunta:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener pregunta')));
    }
  }

  /**
   * Obtiene preguntas filtradas
   * @param filters - Filtros de búsqueda
   * @returns Lista de preguntas que cumplen los filtros
   */
  async getFilteredQuestions(filters: QuestionFilters): Promise<Result<Question[]>> {
    try {
      console.log('🔍 Buscando preguntas con filtros:', filters);

      const questionsRef = collection(db, 'superate', 'auth', 'questions');
      const conditions: any[] = [];

      if (filters.subject) {
        conditions.push(where('subject', '==', filters.subject));
      }
      if (filters.subjectCode) {
        conditions.push(where('subjectCode', '==', filters.subjectCode));
      }
      if (filters.topic) {
        conditions.push(where('topic', '==', filters.topic));
      }
      if (filters.topicCode) {
        conditions.push(where('topicCode', '==', filters.topicCode));
      }
      if (filters.grade) {
        conditions.push(where('grade', '==', filters.grade));
      }
      if (filters.level) {
        conditions.push(where('level', '==', filters.level));
      }
      if (filters.levelCode) {
        conditions.push(where('levelCode', '==', filters.levelCode));
      }

      // Crear consulta sin orderBy para evitar necesidad de índice compuesto
      let q = query(questionsRef, ...conditions);

      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const querySnapshot = await getDocs(q);
      const questions: Question[] = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as Question));

      // Ordenar por fecha de creación en el cliente
      questions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      console.log(`✅ ${questions.length} preguntas encontradas`);
      return success(questions);
    } catch (e) {
      console.error('❌ Error al filtrar preguntas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'filtrar preguntas')));
    }
  }

  /**
   * Obtiene preguntas aleatorias según filtros
   * Utiliza el campo 'rand' para muestreo eficiente
   * 
   * @param filters - Filtros de búsqueda
   * @param count - Número de preguntas a obtener
   * @returns Lista de preguntas aleatorias
   */
  async getRandomQuestions(
    filters: QuestionFilters, 
    count: number
  ): Promise<Result<Question[]>> {
    try {
      console.log('🎲 Obteniendo preguntas aleatorias:', { filters, count });

      // Crear un timeout de 30 segundos
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: La consulta tardó demasiado tiempo')), 30000);
      });

      // Obtener todas las preguntas que cumplen los filtros con timeout
      const allQuestionsResult = await Promise.race([
        this.getFilteredQuestions({
          ...filters,
          limit: undefined, // No limitar inicialmente
        }),
        timeoutPromise
      ]);

      if (!allQuestionsResult.success) {
        console.error('❌ Error en getFilteredQuestions:', allQuestionsResult.error);
        return failure(allQuestionsResult.error);
      }

      const allQuestions = allQuestionsResult.data;
      console.log(`📊 Preguntas encontradas: ${allQuestions.length} de ${count} solicitadas`);

      if (allQuestions.length === 0) {
        console.warn('⚠️ No se encontraron preguntas con los filtros especificados');
        return success([]);
      }

      // Si hay menos preguntas de las solicitadas, devolver todas
      if (allQuestions.length <= count) {
        console.log(`📝 Devolviendo todas las ${allQuestions.length} preguntas encontradas`);
        return success(this.shuffleArray(allQuestions));
      }

      // Mezclar y tomar el número solicitado
      const shuffled = this.shuffleArray(allQuestions);
      const randomQuestions = shuffled.slice(0, count);

      console.log(`✅ ${randomQuestions.length} preguntas aleatorias obtenidas`);
      return success(randomQuestions);
    } catch (e) {
      console.error('❌ Error al obtener preguntas aleatorias:', e);
      if (e instanceof Error && e.message.includes('Timeout')) {
        return failure(new ErrorAPI({ 
          message: 'La consulta tardó demasiado tiempo. Verifica tu conexión a internet.' 
        }));
      }
      return failure(new ErrorAPI(normalizeError(e, 'obtener preguntas aleatorias')));
    }
  }

  /**
   * Mezcla un array usando el algoritmo Fisher-Yates
   * @param array - Array a mezclar
   * @returns Array mezclado
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Actualiza una pregunta existente
   * @param questionId - ID de la pregunta
   * @param updates - Datos a actualizar
   * @returns La pregunta actualizada
   */
  async updateQuestion(
    questionId: string,
    updates: Partial<Omit<Question, 'id' | 'code' | 'createdBy' | 'createdAt'>>
  ): Promise<Result<Question>> {
    try {
      const questionRef = doc(db, 'superate', 'auth', 'questions', questionId);
      
      // Verificar que la pregunta existe
      const questionSnap = await getDoc(questionRef);
      if (!questionSnap.exists()) {
        return failure(new ErrorAPI({ 
          message: 'Pregunta no encontrada', 
          statusCode: 404 
        }));
      }

      // Validar opciones si se están actualizando
      if (updates.options) {
        const correctOptions = updates.options.filter(opt => opt.isCorrect);
        if (correctOptions.length !== 1) {
          return failure(new ErrorAPI({ 
            message: 'Debe haber exactamente una opción correcta', 
            statusCode: 400 
          }));
        }
      }

      await setDoc(questionRef, updates, { merge: true });

      // Obtener la pregunta actualizada
      return await this.getQuestionById(questionId);
    } catch (e) {
      console.error('❌ Error al actualizar pregunta:', e);
      return failure(new ErrorAPI(normalizeError(e, 'actualizar pregunta')));
    }
  }

  /**
   * Elimina una pregunta
   * @param questionId - ID de la pregunta
   */
  async deleteQuestion(questionId: string): Promise<Result<void>> {
    try {
      // Validar que el ID existe
      if (!questionId || questionId.trim() === '') {
        console.error('❌ Error: questionId es inválido o vacío');
        return failure(new ErrorAPI({ 
          message: 'ID de pregunta inválido', 
          statusCode: 400 
        }));
      }

      console.log('🗑️ Iniciando eliminación de pregunta:', questionId);

      // Crear referencia al documento
      const questionRef = doc(db, 'superate', 'auth', 'questions', questionId);
      
      // Verificar que el documento existe antes de intentar eliminarlo
      const questionSnap = await getDoc(questionRef);
      if (!questionSnap.exists()) {
        console.warn('⚠️ El documento no existe en Firestore:', questionId);
        return failure(new ErrorAPI({ 
          message: 'Pregunta no encontrada en la base de datos', 
          statusCode: 404 
        }));
      }

      const questionData = questionSnap.data();
      console.log('📋 Datos de la pregunta a eliminar:', { id: questionSnap.id, code: questionData.code });

      // Eliminar imágenes informativas
      if (questionData.informativeImages && Array.isArray(questionData.informativeImages) && questionData.informativeImages.length > 0) {
        console.log('🖼️ Eliminando imágenes informativas:', questionData.informativeImages.length);
        for (const imageUrl of questionData.informativeImages) {
          try {
            await this.deleteImage(imageUrl);
          } catch (imageError) {
            console.warn('⚠️ Error al eliminar imagen informativa:', imageUrl, imageError);
            // Continuar aunque falle la eliminación de una imagen
          }
        }
      }

      // Eliminar imágenes de la pregunta
      if (questionData.questionImages && Array.isArray(questionData.questionImages) && questionData.questionImages.length > 0) {
        console.log('🖼️ Eliminando imágenes de pregunta:', questionData.questionImages.length);
        for (const imageUrl of questionData.questionImages) {
          try {
            await this.deleteImage(imageUrl);
          } catch (imageError) {
            console.warn('⚠️ Error al eliminar imagen de pregunta:', imageUrl, imageError);
            // Continuar aunque falle la eliminación de una imagen
          }
        }
      }

      // Eliminar imágenes de las opciones
      if (questionData.options && Array.isArray(questionData.options) && questionData.options.length > 0) {
        console.log('🖼️ Eliminando imágenes de opciones');
        for (const option of questionData.options) {
          if (option && option.imageUrl) {
            try {
              await this.deleteImage(option.imageUrl);
            } catch (imageError) {
              console.warn('⚠️ Error al eliminar imagen de opción:', option.imageUrl, imageError);
              // Continuar aunque falle la eliminación de una imagen
            }
          }
        }
      }

      // Eliminar el documento de Firestore
      console.log('🗑️ Eliminando documento de Firestore...');
      console.log('📍 Ruta del documento:', questionRef.path);
      
      try {
        await deleteDoc(questionRef);
        console.log('✅ deleteDoc ejecutado sin errores');
      } catch (deleteError: any) {
        console.error('❌ Error al ejecutar deleteDoc:', deleteError);
        console.error('❌ Código del error:', deleteError.code);
        console.error('❌ Mensaje del error:', deleteError.message);
        
        // Si es un error de permisos, dar un mensaje más claro
        if (deleteError.code === 'permission-denied') {
          return failure(new ErrorAPI({ 
            message: 'No tienes permisos para eliminar esta pregunta. Verifica que eres administrador.', 
            statusCode: 403 
          }));
        }
        
        // Re-lanzar el error para que se capture en el catch general
        throw deleteError;
      }
      
      // Esperar un momento para que Firestore procese la eliminación
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar que se eliminó correctamente (forzar lectura desde el servidor, no caché)
      console.log('🔍 Verificando que el documento se eliminó (desde servidor)...');
      try {
        const verifySnap = await getDocFromServer(questionRef);
        
        if (verifySnap.exists()) {
          console.error('❌ Error: El documento todavía existe después de deleteDoc');
          console.error('❌ Datos del documento:', verifySnap.data());
          console.error('❌ ID del documento:', verifySnap.id);
          console.error('❌ Ruta completa:', verifySnap.ref.path);
          
          // Intentar eliminar nuevamente como último recurso
          console.log('🔄 Intentando eliminar nuevamente...');
          try {
            await deleteDoc(questionRef);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryVerifySnap = await getDocFromServer(questionRef);
            if (retryVerifySnap.exists()) {
              return failure(new ErrorAPI({ 
                message: 'Error: No se pudo eliminar el documento de la base de datos después de múltiples intentos. Puede ser un problema de permisos o de reglas de seguridad.', 
                statusCode: 500 
              }));
            }
            console.log('✅ Documento eliminado en el segundo intento');
          } catch (retryError: any) {
            console.error('❌ Error en segundo intento de eliminación:', retryError);
            return failure(new ErrorAPI({ 
              message: `Error al eliminar documento: ${retryError.message || 'Error desconocido'}. Verifica las reglas de seguridad de Firestore.`, 
              statusCode: 500 
            }));
          }
        } else {
          console.log('✅ Confirmado: El documento no existe en el servidor (eliminación exitosa)');
        }
      } catch (verifyError: any) {
        // Si hay un error de permisos al verificar, puede ser que no tengamos permisos
        // pero el documento sí se eliminó
        console.warn('⚠️ Error al verificar eliminación:', verifyError);
        console.warn('⚠️ Código del error:', verifyError.code);
        
        if (verifyError.code === 'permission-denied') {
          console.warn('⚠️ No se pudo verificar la eliminación por permisos, pero deleteDoc completó sin errores');
          // Intentar verificar con getDoc normal (que puede usar caché)
          try {
            const cachedSnap = await getDoc(questionRef);
            if (cachedSnap.exists()) {
              console.error('❌ El documento todavía existe (verificado desde caché)');
              return failure(new ErrorAPI({ 
                message: 'Error: No se pudo verificar la eliminación. El documento puede todavía existir. Verifica las reglas de seguridad.', 
                statusCode: 500 
              }));
            }
          } catch (cachedError) {
            console.warn('⚠️ Error al verificar desde caché:', cachedError);
          }
        } else {
          // Otro tipo de error - puede ser que el documento no exista
          console.warn('⚠️ Error inesperado al verificar, asumiendo que se eliminó correctamente');
        }
      }
      
      console.log('✅ Pregunta eliminada correctamente de la base de datos:', questionId);
      
      return success(undefined);
    } catch (e: any) {
      console.error('❌ Error al eliminar pregunta:', e);
      console.error('❌ Detalles del error:', {
        code: e.code,
        message: e.message,
        stack: e.stack
      });
      return failure(new ErrorAPI(normalizeError(e, 'eliminar pregunta')));
    }
  }

  /**
   * Obtiene estadísticas del banco de preguntas
   * @returns Estadísticas generales
   */
  async getQuestionStats(): Promise<Result<{
    total: number;
    bySubject: Record<string, number>;
    byLevel: Record<string, number>;
    byGrade: Record<string, number>;
  }>> {
    try {
      const questionsRef = collection(db, 'superate', 'auth', 'questions');
      const querySnapshot = await getDocs(questionsRef);

      const stats = {
        total: querySnapshot.size,
        bySubject: {} as Record<string, number>,
        byLevel: {} as Record<string, number>,
        byGrade: {} as Record<string, number>,
      };

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Contar por materia
        stats.bySubject[data.subject] = (stats.bySubject[data.subject] || 0) + 1;
        
        // Contar por nivel
        stats.byLevel[data.level] = (stats.byLevel[data.level] || 0) + 1;
        
        // Contar por grado
        stats.byGrade[data.grade] = (stats.byGrade[data.grade] || 0) + 1;
      });

      return success(stats);
    } catch (e) {
      console.error('❌ Error al obtener estadísticas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener estadísticas')));
    }
  }
}

export const questionService = QuestionService.getInstance();

