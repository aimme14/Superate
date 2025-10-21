import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  runTransaction,
  Timestamp
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
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      console.log('✅ Imagen eliminada exitosamente');
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al eliminar imagen:', e);
      return failure(new ErrorAPI(normalizeError(e, 'eliminar imagen')));
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
      
      // Filtrar campos undefined para evitar errores en Firebase
      const cleanQuestionData = Object.fromEntries(
        Object.entries(questionData).filter(([_, value]) => value !== undefined)
      );
      
      const question: Question = {
        ...cleanQuestionData,
        id: questionRef.id,
        code: codeResult.data,
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

      if (filters.subjectCode) {
        conditions.push(where('subjectCode', '==', filters.subjectCode));
      }
      if (filters.topicCode) {
        conditions.push(where('topicCode', '==', filters.topicCode));
      }
      if (filters.grade) {
        conditions.push(where('grade', '==', filters.grade));
      }
      if (filters.levelCode) {
        conditions.push(where('levelCode', '==', filters.levelCode));
      }

      let q = query(questionsRef, ...conditions, orderBy('createdAt', 'desc'));

      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const querySnapshot = await getDocs(q);
      const questions: Question[] = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as Question));

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

      // Obtener todas las preguntas que cumplen los filtros
      const allQuestionsResult = await this.getFilteredQuestions({
        ...filters,
        limit: undefined, // No limitar inicialmente
      });

      if (!allQuestionsResult.success) {
        return failure(allQuestionsResult.error);
      }

      const allQuestions = allQuestionsResult.data;

      if (allQuestions.length === 0) {
        return success([]);
      }

      // Si hay menos preguntas de las solicitadas, devolver todas
      if (allQuestions.length <= count) {
        return success(this.shuffleArray(allQuestions));
      }

      // Mezclar y tomar el número solicitado
      const shuffled = this.shuffleArray(allQuestions);
      const randomQuestions = shuffled.slice(0, count);

      console.log(`✅ ${randomQuestions.length} preguntas aleatorias obtenidas`);
      return success(randomQuestions);
    } catch (e) {
      console.error('❌ Error al obtener preguntas aleatorias:', e);
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
      const questionRef = doc(db, 'superate', 'auth', 'questions', questionId);
      
      // Obtener la pregunta para eliminar sus imágenes
      const questionResult = await this.getQuestionById(questionId);
      if (questionResult.success) {
        const question = questionResult.data;
        
        // Eliminar imágenes informativas
        if (question.informativeImages) {
          for (const imageUrl of question.informativeImages) {
            await this.deleteImage(imageUrl);
          }
        }

        // Eliminar imágenes de la pregunta
        if (question.questionImages) {
          for (const imageUrl of question.questionImages) {
            await this.deleteImage(imageUrl);
          }
        }

        // Eliminar imágenes de las opciones
        for (const option of question.options) {
          if (option.imageUrl) {
            await this.deleteImage(option.imageUrl);
          }
        }
      }

      // Eliminar el documento (nota: no podemos eliminar con el SDK del cliente)
      // Para eliminar completamente, necesitarías Firebase Admin SDK
      console.warn('⚠️ La eliminación completa requiere Firebase Admin SDK');
      
      return success(undefined);
    } catch (e) {
      console.error('❌ Error al eliminar pregunta:', e);
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

