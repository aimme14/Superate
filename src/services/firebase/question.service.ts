import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  getDoc, 
  getDocFromServer,
  getDocs, 
  getCountFromServer,
  query, 
  where, 
  orderBy,
  startAfter,
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
import { shuffleArray } from '@/utils/arrayUtils';
import { SUBJECTS_CONFIG, DIFFICULTY_LEVELS } from '@/utils/subjects.config';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

/**
 * Interfaz para las opciones de una pregunta
 */
export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  text: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

/**
 * Interfaz para la explicación de una respuesta incorrecta
 */
export interface IncorrectAnswerExplanation {
  optionId: string;
  explanation: string;
}

/**
 * Justificación generada por IA para una pregunta
 */
export interface AIJustification {
  // Explicación de la respuesta correcta
  correctAnswerExplanation: string;
  
  // Explicaciones de cada respuesta incorrecta
  incorrectAnswersExplanation: IncorrectAnswerExplanation[];
  
  // Conceptos clave que el estudiante debe dominar
  keyConcepts: string[];
  
  // Dificultad percibida por la IA
  perceivedDifficulty: 'Fácil' | 'Medio' | 'Difícil';
  
  // Metadata de generación
  generatedAt: Date | any; // Puede ser Date o Timestamp de Firestore
  generatedBy: string; // Nombre del modelo (ej: "gemini-1.5-flash")
  confidence: number; // 0.0 a 1.0
  promptVersion?: string; // Versión del prompt utilizado
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
  justification?: string; // Justificación de la respuesta correcta (legacy)
  aiJustification?: AIJustification; // Justificación generada por IA
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

export interface QuestionCursor {
  createdAtMillis: number
}

export interface PaginatedQuestions {
  items: Question[]
  nextCursor?: QuestionCursor
  hasMore: boolean
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
   * Comprime una imagen si es mayor a 200KB usando Canvas API
   * @param file - Archivo de imagen a comprimir
   * @returns Archivo comprimido o el original si no necesita compresión
   */
  private async compressImageIfNeeded(file: File): Promise<File> {
    const maxSizeBeforeCompression = 200 * 1024; // 200KB
    
    // Si la imagen es menor a 200KB, no comprimir
    if (file.size <= maxSizeBeforeCompression) {
      console.log(`ℹ️ Imagen de ${(file.size / 1024).toFixed(2)}KB no requiere compresión`);
      return file;
    }

    try {
      console.log(`🗜️ Comprimiendo imagen de ${(file.size / 1024).toFixed(2)}KB...`);
      
      // Crear una imagen desde el archivo
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Calcular nuevas dimensiones (máximo 1920px en el lado más grande)
      const maxDimension = 1920;
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      // Crear canvas y dibujar la imagen redimensionada
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      // Convertir a blob con calidad ajustable
      const targetSize = 200 * 1024; // 200KB
      let quality = 0.9;
      let blob: Blob | null = null;
      let attempts = 0;
      const maxAttempts = 10;

      // Ajustar calidad hasta alcanzar el tamaño objetivo
      while (attempts < maxAttempts) {
        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b || new Blob()),
            file.type || 'image/jpeg',
            quality
          );
        });

        if (blob && blob.size <= targetSize) {
          break;
        }

        quality -= 0.1;
        attempts++;
      }

      if (!blob) {
        throw new Error('No se pudo crear el blob comprimido');
      }

      // Crear nuevo archivo desde el blob
      const compressedFile = new File([blob], file.name, {
        type: file.type || 'image/jpeg',
        lastModified: Date.now(),
      });

      const originalSize = (file.size / 1024).toFixed(2);
      const compressedSize = (compressedFile.size / 1024).toFixed(2);
      const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
      
      console.log(`✅ Imagen comprimida: ${originalSize}KB → ${compressedSize}KB (reducción del ${reduction}%)`);
      
      return compressedFile;
    } catch (error) {
      console.warn('⚠️ Error al comprimir imagen, usando imagen original:', error);
      return file; // Si falla la compresión, usar el archivo original
    }
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

      // Comprimir imagen si es mayor a 200KB
      const fileToUpload = await this.compressImageIfNeeded(file);

      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, fileToUpload);
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
  /**
   * Intenta ejecutar una transacción con retry y backoff exponencial
   * @param transactionFn - Función de transacción a ejecutar
   * @param maxRetries - Número máximo de reintentos (default: 5)
   * @param initialDelay - Delay inicial en ms (default: 1000)
   * @returns Resultado de la transacción
   */
  private async executeTransactionWithRetry<T>(
    transactionFn: () => Promise<T>,
    maxRetries: number = 5,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await transactionFn();
      } catch (error: any) {
        lastError = error;
        
        // Si es un error de conflicto de transacción, reintentar
        if (error?.code === 'failed-precondition' || 
            error?.message?.includes('transaction') ||
            error?.message?.includes('concurrent') ||
            error?.code === 'aborted') {
          
          const delay = initialDelay * Math.pow(2, attempt); // Backoff exponencial
          const jitter = Math.random() * 1000; // Jitter aleatorio para evitar thundering herd
          const totalDelay = delay + jitter;
          
          console.log(`⚠️ Intento ${attempt + 1}/${maxRetries} falló. Reintentando en ${Math.round(totalDelay)}ms...`);
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, totalDelay));
            continue;
          }
        }
        
        // Si no es un error de transacción, lanzar inmediatamente
        throw error;
      }
    }
    
    throw lastError;
  }

  async generateQuestionCode(
    subjectCode: string,
    topicCode: string,
    grade: string,
    levelCode: string
  ): Promise<Result<string>> {
    try {
      // Normalizar los parámetros a string y trim
      const normalizedSubjectCode = String(subjectCode || '').trim();
      const normalizedTopicCode = String(topicCode || '').trim();
      const normalizedGrade = String(grade || '').trim();
      const normalizedLevelCode = String(levelCode || '').trim();

      console.log('🔢 Generando código con parámetros:', {
        subjectCode: normalizedSubjectCode,
        topicCode: normalizedTopicCode,
        grade: normalizedGrade,
        levelCode: normalizedLevelCode,
      });

      const counterKey = `${normalizedSubjectCode}${normalizedTopicCode}${normalizedGrade}${normalizedLevelCode}`;
      console.log('🔑 Clave del contador:', counterKey);
      
      const counterRef = doc(db, 'superate', 'auth', 'counters', counterKey);

      // Usar transacción con retry y backoff exponencial para evitar saturación
      const newCode = await this.executeTransactionWithRetry(async () => {
        return await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          
          let currentCount = 1;
          if (counterDoc.exists()) {
            const existingCount = counterDoc.data().count || 0;
            currentCount = existingCount + 1;
            console.log(`📊 Contador existente: ${existingCount}, nuevo: ${currentCount}`);
          } else {
            console.log('📊 No existe contador, iniciando en 1');
          }

          // Actualizar el contador
          transaction.set(counterRef, { count: currentCount }, { merge: true });

          // Generar el código con formato de 3 dígitos
          const serie = String(currentCount).padStart(3, '0');
          const generatedCode = `${counterKey}${serie}`;
          console.log(`🔢 Código generado: ${generatedCode} (serie: ${serie})`);
          return generatedCode;
        });
      }, 5, 2000); // 5 reintentos con delay inicial de 2 segundos

      console.log('✅ Código generado exitosamente:', newCode);
      return success(newCode);
    } catch (e) {
      console.error('❌ Error al generar código después de reintentos:', e);
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
      
      // Construir el objeto question solo con campos válidos (no undefined)
      const question: any = {
        id: questionRef.id,
        code: codeResult.data,
        subject: questionData.subject,
        subjectCode: questionData.subjectCode,
        topic: questionData.topic,
        topicCode: questionData.topicCode,
        grade: questionData.grade,
        level: questionData.level,
        levelCode: questionData.levelCode,
        questionText: questionData.questionText,
        answerType: questionData.answerType,
        options: questionData.options,
        createdBy: userId,
        createdAt: new Date(),
        rand: Math.random(), // Para muestreo aleatorio eficiente
      };

      // Solo agregar campos opcionales si tienen valores válidos
      if (questionData.informativeText !== undefined && questionData.informativeText !== null && questionData.informativeText.trim() !== '') {
        question.informativeText = questionData.informativeText.trim();
      }
      if (questionData.informativeImages !== undefined && questionData.informativeImages !== null && questionData.informativeImages.length > 0) {
        question.informativeImages = questionData.informativeImages;
      }
      if (questionData.questionImages !== undefined && questionData.questionImages !== null && questionData.questionImages.length > 0) {
        question.questionImages = questionData.questionImages;
      }

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
      
      // Convertir aiJustification.generatedAt si existe y es Timestamp
      let aiJustification = data.aiJustification;
      if (aiJustification && aiJustification.generatedAt && typeof aiJustification.generatedAt.toDate === 'function') {
        aiJustification = {
          ...aiJustification,
          generatedAt: aiJustification.generatedAt.toDate()
        };
      }
      
      const question: Question = {
        ...data,
        id: questionSnap.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        aiJustification,
      } as Question;

      return success(question);
    } catch (e) {
      console.error('❌ Error al obtener pregunta:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener pregunta')));
    }
  }

  /**
   * Obtiene una pregunta por su código
   * @param code - Código de la pregunta (ej: MAAL1F001)
   * @returns La pregunta encontrada
   */
  async getQuestionByCode(code: string): Promise<Result<Question>> {
    try {
      const questionsRef = collection(db, 'superate', 'auth', 'questions');
      const q = query(questionsRef, where('code', '==', code), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return failure(new ErrorAPI({ 
          message: 'Pregunta no encontrada', 
          statusCode: 404 
        }));
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      // Convertir aiJustification.generatedAt si existe y es Timestamp
      let aiJustification = data.aiJustification;
      if (aiJustification && aiJustification.generatedAt && typeof aiJustification.generatedAt.toDate === 'function') {
        aiJustification = {
          ...aiJustification,
          generatedAt: aiJustification.generatedAt.toDate()
        };
      }
      
      const question: Question = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate() || new Date(),
        aiJustification,
      } as Question;

      return success(question);
    } catch (e) {
      console.error('❌ Error al obtener pregunta por código:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener pregunta por código')));
    }
  }

  /**
   * Obtiene una pregunta por ID o código
   * Intenta primero por ID, luego por código
   * @param identifier - ID del documento o código de la pregunta
   * @returns La pregunta encontrada
   */
  async getQuestionByIdOrCode(identifier: string | number): Promise<Result<Question>> {
    try {
      // Intentar primero como ID del documento
      const idResult = await this.getQuestionById(String(identifier));
      if (idResult.success) {
        return idResult;
      }

      // Si falla, intentar como código
      return await this.getQuestionByCode(String(identifier));
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
      const questions: Question[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Convertir aiJustification.generatedAt si existe y es Timestamp
        let aiJustification = data.aiJustification;
        if (aiJustification && aiJustification.generatedAt && typeof aiJustification.generatedAt.toDate === 'function') {
          aiJustification = {
            ...aiJustification,
            generatedAt: aiJustification.generatedAt.toDate()
          };
        }
        
        return {
          ...data,
        id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          aiJustification,
        } as Question;
      });

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
   * Obtiene una página de preguntas filtradas con paginación por cursor.
   * Orden estable: createdAt desc + documentId desc.
   *
   * Nota: agregar ordenBy puede requerir índices compuestos en Firestore.
   */
  async getFilteredQuestionsPaginated(
    filters: QuestionFilters,
    pageSize: number,
    cursor?: QuestionCursor
  ): Promise<Result<PaginatedQuestions>> {
    try {
      const questionsRef = collection(db, 'superate', 'auth', 'questions')
      const conditions: any[] = []

      if (filters.subject) conditions.push(where('subject', '==', filters.subject))
      if (filters.subjectCode) conditions.push(where('subjectCode', '==', filters.subjectCode))
      if (filters.topic) conditions.push(where('topic', '==', filters.topic))
      if (filters.topicCode) conditions.push(where('topicCode', '==', filters.topicCode))
      if (filters.grade) conditions.push(where('grade', '==', filters.grade))
      if (filters.level) conditions.push(where('level', '==', filters.level))
      if (filters.levelCode) conditions.push(where('levelCode', '==', filters.levelCode))

      // Para minimizar requisitos de índices, usamos un solo orderBy.
      // Cursor solo con createdAt.
      const q = query(
        questionsRef,
        ...conditions,
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(Timestamp.fromMillis(cursor.createdAtMillis))] : []),
        limit(pageSize)
      )
      const querySnapshot = await getDocs(q)

      const items: Question[] = querySnapshot.docs.map((docSnap) => {
        const data: any = docSnap.data()

        let aiJustification = data.aiJustification
        if (
          aiJustification &&
          aiJustification.generatedAt &&
          typeof aiJustification.generatedAt.toDate === 'function'
        ) {
          aiJustification = {
            ...aiJustification,
            generatedAt: aiJustification.generatedAt.toDate(),
          }
        }

        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          aiJustification,
        } as Question
      })

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
      const hasMore = items.length === pageSize && !!lastDoc

      let nextCursor: QuestionCursor | undefined = undefined
      if (lastDoc) {
        const lastData: any = lastDoc.data()
        const lastCreatedAtMillis =
          lastData.createdAt?.toDate?.().getTime?.() ?? Date.now()
        nextCursor = {
          createdAtMillis: lastCreatedAtMillis,
        }
      }

      return success({
        items,
        nextCursor: hasMore ? nextCursor : undefined,
        hasMore,
      })
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'filtrar preguntas paginadas')))
    }
  }

  /**
   * Mapea un documento de Firestore a Question
   */
  private mapDocToQuestion(docSnap: { id: string; data: () => Record<string, unknown> }): Question {
    const data = docSnap.data();
    let aiJustification = data.aiJustification as Record<string, unknown> | undefined;
    if (aiJustification && aiJustification.generatedAt) {
      const genAt = aiJustification.generatedAt as { toDate?: () => Date };
      if (typeof genAt?.toDate === 'function') {
        aiJustification = {
          ...aiJustification,
          generatedAt: genAt.toDate()
        };
      }
    }
    return {
      ...data,
      id: docSnap.id,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
      aiJustification
    } as Question;
  }

  /**
   * Intenta obtener preguntas usando el campo rand para muestreo eficiente.
   * Solo trae las preguntas necesarias desde Firestore (sin descargar todo el banco).
   */
  private async getRandomQuestionsWithRand(
    filters: QuestionFilters,
    count: number
  ): Promise<Result<Question[]>> {
    const questionsRef = collection(db, 'superate', 'auth', 'questions');
    const conditions: ReturnType<typeof where>[] = [];

    if (filters.grade) {
      conditions.push(where('grade', '==', filters.grade));
    }
    if (filters.subjectCode) {
      conditions.push(where('subjectCode', '==', filters.subjectCode));
    }
    if (filters.subject) {
      conditions.push(where('subject', '==', filters.subject));
    }

    const fetchLimit = Math.max(count * 3, 30);
    const randomThreshold = Math.random();

    try {
      const q = query(
        questionsRef,
        ...conditions,
        where('rand', '>=', randomThreshold),
        orderBy('rand', 'asc'),
        limit(fetchLimit)
      );
      const snapshot = await getDocs(q);
      let questions: Question[] = snapshot.docs.map((d) =>
        this.mapDocToQuestion({ id: d.id, data: () => d.data() })
      );

      if (questions.length < count) {
        const q2 = query(
          questionsRef,
          ...conditions,
          where('rand', '<', randomThreshold),
          orderBy('rand', 'desc'),
          limit(fetchLimit - questions.length)
        );
        const snapshot2 = await getDocs(q2);
        const more = snapshot2.docs.map((d) =>
          this.mapDocToQuestion({ id: d.id, data: () => d.data() })
        );
        questions = shuffleArray([...questions, ...more]);
      } else {
        questions = shuffleArray(questions);
      }

      return success(questions.slice(0, count));
    } catch {
      return failure(new ErrorAPI({ message: 'Rand query falló, usando fallback' }));
    }
  }

  /**
   * Obtiene preguntas aleatorias según filtros.
   * 1) Intenta muestreo eficiente con campo rand (solo trae ~30-50 docs).
   * 2) Si falla, usa getFilteredQuestions con limit (máx 50-100 docs).
   * Nunca descarga todo el banco.
   */
  async getRandomQuestions(
    filters: QuestionFilters,
    count: number
  ): Promise<Result<Question[]>> {
    try {
      console.log('🎲 Obteniendo preguntas aleatorias:', { filters, count });

      const timeoutMs = 15000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });

      const fetchLimit = Math.max(count * 5, 50);

      const run = async (): Promise<Result<Question[]>> => {
        if (filters.grade) {
          const randResult = await this.getRandomQuestionsWithRand(filters, count);
          if (randResult.success && (randResult.data?.length ?? 0) >= count) {
            console.log(`✅ Preguntas aleatorias (rand): ${randResult.data?.length}`);
            return randResult;
          }
        }

        const limitedResult = await this.getFilteredQuestions({
          ...filters,
          limit: fetchLimit
        });
        if (!limitedResult.success) return limitedResult;
        const all = limitedResult.data ?? [];
        if (all.length === 0) return success([]);
        const shuffled = shuffleArray(all);
        return success(shuffled.slice(0, count));
      };

      const result = await Promise.race([run(), timeoutPromise]);
      return result;
    } catch (e) {
      if (e instanceof Error && e.message === 'Timeout') {
        return failure(new ErrorAPI({
          message: 'La consulta tardó demasiado. Intenta de nuevo.'
        }));
      }
      return failure(new ErrorAPI(normalizeError(e, 'obtener preguntas aleatorias')));
    }
  }

  /**
   * Actualiza una pregunta existente
   * @param questionId - ID de la pregunta
   * @param updates - Datos a actualizar (puede incluir código si cambian los parámetros)
   * @returns La pregunta actualizada
   */
  async updateQuestion(
    questionId: string,
    updates: Partial<Omit<Question, 'id' | 'createdBy' | 'createdAt'>>
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

      const currentQuestion = questionSnap.data() as Question;

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

      // Si se está actualizando el código, verificar que sea válido
      if (updates.code && updates.code !== currentQuestion.code) {
        console.log(`🔄 Actualizando código de pregunta: ${currentQuestion.code} → ${updates.code}`);
        console.log('📋 Datos que se están actualizando:', {
          code: updates.code,
          subjectCode: updates.subjectCode,
          topicCode: updates.topicCode,
          grade: updates.grade,
          levelCode: updates.levelCode
        });
      }

      // Log de todos los updates para depuración
      console.log('📤 Actualizando pregunta en Firestore:', {
        questionId,
        updates: {
          ...updates,
          code: updates.code || currentQuestion.code,
          subjectCode: updates.subjectCode || currentQuestion.subjectCode,
          topicCode: updates.topicCode || currentQuestion.topicCode,
          grade: updates.grade || currentQuestion.grade,
          levelCode: updates.levelCode || currentQuestion.levelCode,
        }
      });

      // Usar updateDoc para asegurar que los arrays se actualicen correctamente
      // updateDoc es más explícito para actualizaciones parciales
      await updateDoc(questionRef, updates);
      console.log('✅ Pregunta actualizada en Firestore');

      // Obtener la pregunta actualizada
      const updatedQuestion = await this.getQuestionById(questionId);
      if (updatedQuestion.success && updates.code) {
        console.log('✅ Pregunta actualizada correctamente. Nuevo código:', updatedQuestion.data.code);
      }
      return updatedQuestion;
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
      console.log('📍 ID del documento:', questionRef.id);
      console.log('📍 Ruta completa:', questionRef.path);
      
      // Ejecutar deleteDoc - si hay un error, se lanzará aquí
      await deleteDoc(questionRef);
      console.log('✅ deleteDoc ejecutado exitosamente');
      
      // Esperar un momento para que Firestore procese la eliminación
      console.log('⏳ Esperando a que Firestore procese la eliminación...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar múltiples veces que el documento realmente se eliminó
      let verificationAttempts = 0;
      const maxAttempts = 3;
      let documentStillExists = false;
      
      while (verificationAttempts < maxAttempts) {
        verificationAttempts++;
        console.log(`🔍 Verificación ${verificationAttempts}/${maxAttempts}: Consultando documento desde el servidor...`);
        
        try {
          // Forzar lectura desde el servidor (sin caché)
          const verifySnap = await getDocFromServer(questionRef);
          
          if (verifySnap.exists()) {
            console.error(`❌ Intento ${verificationAttempts}: El documento todavía existe`);
            documentStillExists = true;
            
            if (verificationAttempts < maxAttempts) {
              // Esperar un poco más antes del siguiente intento
              console.log(`⏳ Esperando 1 segundo antes del siguiente intento...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            console.log(`✅ Intento ${verificationAttempts}: Confirmado - El documento no existe (eliminación exitosa)`);
            documentStillExists = false;
            break; // Salir del bucle si confirmamos que no existe
          }
        } catch (verifyError: any) {
          // Si hay un error de permisos, puede ser que no podamos leer pero el documento se eliminó
          if (verifyError.code === 'permission-denied') {
            console.warn(`⚠️ Intento ${verificationAttempts}: No se pudo verificar por permisos, pero deleteDoc fue exitoso`);
            // Asumir que se eliminó correctamente si deleteDoc no lanzó error
            documentStillExists = false;
            break;
          } else if (verifyError.code === 'not-found') {
            // El documento no existe (éxito)
            console.log(`✅ Intento ${verificationAttempts}: Documento no encontrado (eliminación exitosa)`);
            documentStillExists = false;
            break;
          } else {
            console.warn(`⚠️ Intento ${verificationAttempts}: Error al verificar:`, verifyError.message);
            if (verificationAttempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
      
      // Si después de todos los intentos el documento todavía existe, es un problema
      if (documentStillExists) {
        console.error('❌ ERROR CRÍTICO: El documento todavía existe después de múltiples verificaciones');
        console.error('❌ Esto indica que deleteDoc no eliminó el documento realmente');
        console.error('❌ Posibles causas:');
        console.error('   1. Problema de permisos en las reglas de seguridad');
        console.error('   2. Problema de sincronización de Firestore');
        console.error('   3. El documento está en una ruta diferente');
        
        // Intentar una última vez
        console.log('🔄 Intentando eliminación final...');
        try {
          await deleteDoc(questionRef);
          await new Promise(resolve => setTimeout(resolve, 2000));
          const finalVerify = await getDocFromServer(questionRef);
          if (finalVerify.exists()) {
            return failure(new ErrorAPI({ 
              message: 'No se pudo eliminar el documento de Firestore después de múltiples intentos. Verifica las reglas de seguridad y que tengas permisos de administrador.', 
              statusCode: 500 
            }));
          }
        } catch (finalError: any) {
          return failure(new ErrorAPI({ 
            message: `Error al eliminar documento: ${finalError.message || 'Error desconocido'}. Verifica las reglas de seguridad de Firestore.`, 
            statusCode: 500 
          }));
        }
      }
      
      console.log('✅ Pregunta eliminada correctamente de la base de datos:', questionId);
      
      return success(undefined);
    } catch (e: any) {
      console.error('❌ Error al eliminar pregunta:', e);
      console.error('❌ Detalles del error:', {
        code: e.code,
        message: e.message,
        stack: e.stack,
        name: e.name
      });
      
      // Manejar errores específicos de Firestore
      if (e.code === 'permission-denied') {
        console.error('❌ Error de permisos: El usuario no tiene permisos para eliminar esta pregunta');
        return failure(new ErrorAPI({ 
          message: 'No tienes permisos para eliminar esta pregunta. Verifica que eres administrador y que las reglas de seguridad de Firestore están configuradas correctamente.', 
          statusCode: 403 
        }));
      }
      
      if (e.code === 'not-found') {
        console.error('❌ Error: La pregunta no existe en la base de datos');
        return failure(new ErrorAPI({ 
          message: 'La pregunta no existe en la base de datos', 
          statusCode: 404 
        }));
      }
      
      // Para otros errores, usar el manejo normal
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

  /**
   * Obtiene estadísticas del banco usando getCountFromServer (sin descargar documentos).
   * Mucho más eficiente que getQuestionStats para colecciones grandes.
   */
  async getQuestionStatsOptimized(): Promise<Result<{
    total: number;
    bySubject: Record<string, number>;
    byLevel: Record<string, number>;
    byGrade: Record<string, number>;
  }>> {
    try {
      const questionsRef = collection(db, 'superate', 'auth', 'questions');

      const countPromises: Promise<number>[] = [
        getCountFromServer(questionsRef).then(s => s.data().count),
      ];

      const subjectKeys: { code: string; name: string }[] = SUBJECTS_CONFIG.map(s => ({ code: s.code, name: s.name }));
      const levelNames = DIFFICULTY_LEVELS.map(l => l.name);
      const gradeCodes = ['6', '7', '8', '9', '0', '1'];

      subjectKeys.forEach(({ code }) => {
        countPromises.push(
          getCountFromServer(query(questionsRef, where('subjectCode', '==', code))).then(s => s.data().count)
        );
      });
      levelNames.forEach((level) => {
        countPromises.push(
          getCountFromServer(query(questionsRef, where('level', '==', level))).then(s => s.data().count)
        );
      });
      gradeCodes.forEach((grade) => {
        countPromises.push(
          getCountFromServer(query(questionsRef, where('grade', '==', grade))).then(s => s.data().count)
        );
      });

      const results = await Promise.all(countPromises);
      const [total, ...rest] = results;

      const stats = {
        total,
        bySubject: {} as Record<string, number>,
        byLevel: {} as Record<string, number>,
        byGrade: {} as Record<string, number>,
      };

      let idx = 0;
      subjectKeys.forEach(({ name }) => {
        const c = rest[idx++];
        if (c > 0) stats.bySubject[name] = c;
      });
      levelNames.forEach((level) => {
        const c = rest[idx++];
        if (c > 0) stats.byLevel[level] = c;
      });
      gradeCodes.forEach((grade) => {
        const c = rest[idx++];
        if (c > 0) stats.byGrade[grade] = c;
      });

      return success(stats);
    } catch (e) {
      console.error('❌ Error al obtener estadísticas optimizadas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener estadísticas')));
    }
  }
}

export const questionService = QuestionService.getInstance();

