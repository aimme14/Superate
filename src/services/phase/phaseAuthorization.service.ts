import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  Timestamp,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { dbService } from '@/services/firebase/db.service';
import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { 
  PhaseAuthorization, 
  StudentPhaseProgress, 
  GradePhaseCompletion,
  PhaseType,
  PhaseStatus 
} from '@/interfaces/phase.interface';

/**
 * Servicio para gestionar la autorización de fases evaluativas por grado
 */
class PhaseAuthorizationService {
  private static instance: PhaseAuthorizationService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!PhaseAuthorizationService.instance) {
      PhaseAuthorizationService.instance = new PhaseAuthorizationService();
    }
    return PhaseAuthorizationService.instance;
  }

  /**
   * Obtiene una referencia a una colección en superate/auth
   */
  private getCollection(name: string) {
    return collection(this.db, 'superate', 'auth', name);
  }

  /**
   * Autoriza una fase para un grado específico
   */
  async authorizePhase(
    gradeId: string,
    gradeName: string,
    phase: PhaseType,
    adminId: string,
    institutionId?: string,
    campusId?: string
  ): Promise<Result<PhaseAuthorization>> {
    try {
      const authId = `${gradeId}_${phase}`;
      const authRef = doc(this.getCollection('phaseAuthorizations'), authId);

      const authorization: PhaseAuthorization = {
        id: authId,
        gradeId,
        gradeName,
        phase,
        authorized: true,
        authorizedBy: adminId,
        authorizedAt: new Date().toISOString(),
        institutionId,
        campusId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(authRef, {
        ...authorization,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`✅ Fase ${phase} autorizada para grado ${gradeName}`);
      return success(authorization);
    } catch (e) {
      console.error('❌ Error autorizando fase:', e);
      return failure(new ErrorAPI(normalizeError(e, 'autorizar fase')));
    }
  }

  /**
   * Revoca la autorización de una fase para un grado
   */
  async revokePhaseAuthorization(
    gradeId: string,
    phase: PhaseType
  ): Promise<Result<void>> {
    try {
      const authId = `${gradeId}_${phase}`;
      const authRef = doc(this.getCollection('phaseAuthorizations'), authId);

      await updateDoc(authRef, {
        authorized: false,
        updatedAt: Timestamp.now(),
      });

      console.log(`✅ Autorización de fase ${phase} revocada para grado ${gradeId}`);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error revocando autorización:', e);
      return failure(new ErrorAPI(normalizeError(e, 'revocar autorización')));
    }
  }

  /**
   * Verifica si una fase está autorizada para un grado
   */
  async isPhaseAuthorized(
    gradeId: string,
    phase: PhaseType
  ): Promise<Result<boolean>> {
    try {
      const authId = `${gradeId}_${phase}`;
      const authRef = doc(this.getCollection('phaseAuthorizations'), authId);
      const authSnap = await getDoc(authRef);

      if (!authSnap.exists()) {
        return success(false);
      }

      const data = authSnap.data();
      return success(data?.authorized === true);
    } catch (e) {
      console.error('❌ Error verificando autorización:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar autorización')));
    }
  }

  /**
   * Obtiene todas las autorizaciones de un grado
   */
  async getGradeAuthorizations(gradeId: string): Promise<Result<PhaseAuthorization[]>> {
    try {
      const q = query(
        this.getCollection('phaseAuthorizations'),
        where('gradeId', '==', gradeId)
      );

      const querySnapshot = await getDocs(q);
      const authorizations: PhaseAuthorization[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        authorizations.push({
          id: doc.id,
          gradeId: data.gradeId,
          gradeName: data.gradeName,
          phase: data.phase,
          authorized: data.authorized,
          authorizedBy: data.authorizedBy,
          authorizedAt: data.authorizedAt,
          institutionId: data.institutionId,
          campusId: data.campusId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        });
      });

      return success(authorizations);
    } catch (e) {
      console.error('❌ Error obteniendo autorizaciones:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener autorizaciones')));
    }
  }

  /**
   * Actualiza el progreso de un estudiante en una fase
   */
  async updateStudentPhaseProgress(
    studentId: string,
    gradeId: string,
    phase: PhaseType,
    subject: string,
    completed: boolean
  ): Promise<Result<StudentPhaseProgress>> {
    try {
      const progressId = `${studentId}_${phase}`;
      const progressRef = doc(this.getCollection('studentPhaseProgress'), progressId);
      const progressSnap = await getDoc(progressRef);

      let progress: StudentPhaseProgress;

      if (progressSnap.exists()) {
        const data = progressSnap.data();
        const subjectsCompleted = new Set<string>((data.subjectsCompleted || []) as string[]);
        const subjectsInProgress = new Set<string>((data.subjectsInProgress || []) as string[]);

        if (completed) {
          subjectsCompleted.add(subject);
          subjectsInProgress.delete(subject);
        } else {
          subjectsInProgress.add(subject);
          subjectsCompleted.delete(subject);
        }

        progress = {
          studentId,
          gradeId,
          phase,
          status: this.calculatePhaseStatus(
            Array.from(subjectsCompleted) as string[],
            Array.from(subjectsInProgress) as string[]
          ),
          completedAt: completed && subjectsCompleted.size === 7 
            ? new Date().toISOString() 
            : data.completedAt,
          subjectsCompleted: Array.from(subjectsCompleted) as string[],
          subjectsInProgress: Array.from(subjectsInProgress) as string[],
          overallScore: data.overallScore,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: new Date().toISOString(),
        };
      } else {
        progress = {
          studentId,
          gradeId,
          phase,
          status: completed ? 'completed' : 'in_progress',
          completedAt: completed ? new Date().toISOString() : undefined,
          subjectsCompleted: completed ? [subject] : [],
          subjectsInProgress: completed ? [] : [subject],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      await setDoc(progressRef, {
        ...progress,
        createdAt: Timestamp.fromDate(new Date(progress.createdAt)),
        updatedAt: Timestamp.now(),
      });

      return success(progress);
    } catch (e) {
      console.error('❌ Error actualizando progreso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'actualizar progreso')));
    }
  }

  /**
   * Obtiene el progreso de un estudiante en una fase
   */
  async getStudentPhaseProgress(
    studentId: string,
    phase: PhaseType
  ): Promise<Result<StudentPhaseProgress | null>> {
    try {
      const progressId = `${studentId}_${phase}`;
      const progressRef = doc(this.getCollection('studentPhaseProgress'), progressId);
      const progressSnap = await getDoc(progressRef);

      if (!progressSnap.exists()) {
        return success(null);
      }

      const data = progressSnap.data();
      const progress: StudentPhaseProgress = {
        studentId,
        gradeId: data.gradeId,
        phase,
        status: data.status,
        completedAt: data.completedAt,
        subjectsCompleted: data.subjectsCompleted || [],
        subjectsInProgress: data.subjectsInProgress || [],
        overallScore: data.overallScore,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      };

      return success(progress);
    } catch (e) {
      console.error('❌ Error obteniendo progreso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener progreso')));
    }
  }

  /**
   * Verifica si todos los estudiantes de un grado completaron una fase
   * Ahora verifica que cada estudiante completó TODAS las materias requeridas
   * También busca en la colección 'results' para encontrar estudiantes que completaron exámenes
   * pero no tienen documento en studentPhaseProgress
   */
  async checkGradePhaseCompletion(
    gradeId: string,
    phase: PhaseType,
    totalStudents: number
  ): Promise<Result<GradePhaseCompletion>> {
    try {
      console.log(`🔍 Verificando completitud de fase ${phase} para grado ${gradeId}`);
      
      // Primero, obtener todos los estudiantes del grado
      const studentsResult = await dbService.getFilteredStudents({
        gradeId: gradeId,
        isActive: true
      });
      if (!studentsResult.success || !studentsResult.data) {
        console.error('❌ No se pudieron obtener estudiantes del grado');
        return failure(new ErrorAPI({ message: 'No se pudieron obtener estudiantes del grado' }));
      }

      const students = studentsResult.data;
      console.log(`📋 Encontrados ${students.length} estudiantes en el grado ${gradeId}`);

      let completedStudents = 0;
      let inProgressStudents = 0;
      const pendingStudentsDetails: Array<{ studentId: string; pendingSubjects: string[] }> = [];

      // Verificar cada estudiante del grado
      for (const student of students) {
        const studentId = student.id || student.uid;
        if (!studentId) continue;

        // Verificar que completó TODAS las materias
        const completionResult = await this.hasCompletedAllSubjectsInPhase(studentId, gradeId, phase);
        
        if (completionResult.success && completionResult.data.completed) {
          completedStudents++;
          console.log(`   ✅ ${studentId}: Completó todas las materias`);
        } else if (completionResult.success && completionResult.data.completedSubjects.length > 0) {
          // Tiene algunas materias completadas pero no todas
          inProgressStudents++;
          console.log(`   ⏳ ${studentId}: ${completionResult.data.completedSubjects.length}/${this.REQUIRED_SUBJECTS.length} materias completadas`);
          if (completionResult.data.pendingSubjects.length > 0) {
            pendingStudentsDetails.push({
              studentId,
              pendingSubjects: completionResult.data.pendingSubjects
            });
          }
        } else {
          // No tiene progreso o no completó ninguna materia
          // Verificar si tiene exámenes completados en la colección 'results'
          const hasExams = await this.checkStudentHasExams(studentId, phase);
          if (hasExams) {
            // Tiene exámenes pero no tiene progreso registrado, intentar sincronizar
            console.log(`   🔄 ${studentId}: Tiene exámenes pero no tiene progreso, sincronizando...`);
            await this.syncStudentProgressFromResults(studentId, gradeId, phase);
            // Verificar nuevamente después de sincronizar
            const recheckResult = await this.hasCompletedAllSubjectsInPhase(studentId, gradeId, phase);
            if (recheckResult.success) {
              const recheckData = recheckResult.data;
              if (recheckData && recheckData.completed) {
                completedStudents++;
                inProgressStudents--; // Ajustar contador
                continue;
              }
            }
          }
          
          inProgressStudents++;
          const pendingSubjects = completionResult.success && completionResult.data 
            ? completionResult.data.pendingSubjects 
            : [...this.REQUIRED_SUBJECTS];
          pendingStudentsDetails.push({
            studentId,
            pendingSubjects
          });
        }
      }

      const pendingStudents = totalStudents - completedStudents - inProgressStudents;
      const completionPercentage = totalStudents > 0 
        ? (completedStudents / totalStudents) * 100 
        : 0;

      const completion: GradePhaseCompletion = {
        gradeId,
        gradeName: '', // Se puede obtener de otra fuente si es necesario
        phase,
        totalStudents,
        completedStudents,
        inProgressStudents,
        pendingStudents,
        completionPercentage,
        allCompleted: completedStudents === totalStudents,
        lastUpdated: new Date().toISOString(),
        pendingStudentsDetails: pendingStudentsDetails.length > 0 ? pendingStudentsDetails : undefined
      };

      console.log(`📊 Completitud de fase ${phase} para grado ${gradeId}: ${completedStudents}/${totalStudents} estudiantes completaron todas las materias`);
      if (pendingStudentsDetails.length > 0) {
        console.log(`   Estudiantes pendientes: ${pendingStudentsDetails.length}`);
      }

      return success(completion);
    } catch (e) {
      console.error('❌ Error verificando completitud:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar completitud')));
    }
  }

  /**
   * Verifica si un estudiante tiene exámenes completados en la colección 'results'
   */
  private async checkStudentHasExams(studentId: string, phase: PhaseType): Promise<boolean> {
    try {
      const resultsRef = doc(collection(this.db, 'results'), studentId);
      const resultsSnap = await getDoc(resultsRef);
      
      if (!resultsSnap.exists()) {
        console.log(`   ⚠️ ${studentId}: No existe documento en 'results'`);
        return false;
      }

      const results = resultsSnap.data();
      console.log(`   🔍 ${studentId}: Verificando ${Object.keys(results).length} exámenes en 'results'`);
      
      // Verificar si hay algún examen con la fase especificada
      for (const [examId, examData] of Object.entries(results)) {
        const exam = examData as any;
        console.log(`   📝 ${studentId}: Examen ${examId} - phase: ${exam.phase}, completed: ${exam.completed}, subject: ${exam.subject}`);
        
        // Verificar si corresponde a esta fase (puede ser string o undefined)
        const examPhase = exam.phase || exam.phaseType || 'first'; // Default a 'first' si no hay fase
        const isCompleted = exam.completed === true || exam.completed === 'true' || exam.completed === 't';
        
        if (examPhase === phase && isCompleted) {
          console.log(`   ✅ ${studentId}: Encontrado examen válido: ${examId} (${exam.subject})`);
          return true;
        }
      }

      console.log(`   ⚠️ ${studentId}: No se encontraron exámenes completados para fase ${phase}`);
      return false;
    } catch (e) {
      console.error(`❌ Error verificando exámenes del estudiante ${studentId}:`, e);
      return false;
    }
  }

  /**
   * Sincroniza el progreso de un estudiante desde la colección 'results'
   * Crea o actualiza el documento en studentPhaseProgress basado en los exámenes completados
   */
  private async syncStudentProgressFromResults(
    studentId: string,
    gradeId: string,
    phase: PhaseType
  ): Promise<void> {
    try {
      console.log(`🔄 Sincronizando progreso para ${studentId} en fase ${phase}`);
      const resultsRef = doc(collection(this.db, 'results'), studentId);
      const resultsSnap = await getDoc(resultsRef);
      
      if (!resultsSnap.exists()) {
        console.log(`   ⚠️ No se encontraron resultados para ${studentId}`);
        return;
      }

      const results = resultsSnap.data();
      const completedSubjects = new Set<string>();
      const foundExams: string[] = [];
      const skippedExams: string[] = [];

      console.log(`   📋 Revisando ${Object.keys(results).length} exámenes guardados`);

      // Recorrer todos los exámenes y encontrar los que corresponden a esta fase
      for (const [examId, examData] of Object.entries(results)) {
        const exam = examData as any;
        
        // Log para debugging
        console.log(`   🔍 Examen ${examId}: phase=${exam.phase}, completed=${exam.completed}, subject=${exam.subject}`);
        
        // Verificar si corresponde a esta fase
        if (exam.phase !== phase) {
          skippedExams.push(`${examId} (fase diferente: ${exam.phase})`);
          continue;
        }

        if (!exam.completed) {
          skippedExams.push(`${examId} (no completado)`);
          continue;
        }

        if (!exam.subject) {
          skippedExams.push(`${examId} (sin subject)`);
          continue;
        }

        // Normalizar nombre de materia
        const originalSubject = exam.subject;
        const normalizedSubject = this.normalizeSubjectName(originalSubject);
        
        console.log(`   📝 Materia: "${originalSubject}" → "${normalizedSubject}"`);
        
        if (this.REQUIRED_SUBJECTS.includes(normalizedSubject)) {
          completedSubjects.add(normalizedSubject);
          foundExams.push(`${examId} (${normalizedSubject})`);
          console.log(`   ✅ Materia reconocida: ${normalizedSubject}`);
        } else {
          console.log(`   ⚠️ Materia no reconocida: "${normalizedSubject}" no está en REQUIRED_SUBJECTS`);
          console.log(`   📋 REQUIRED_SUBJECTS: ${this.REQUIRED_SUBJECTS.join(', ')}`);
          skippedExams.push(`${examId} (materia no reconocida: ${normalizedSubject})`);
        }
      }

      console.log(`   📊 Resumen: ${foundExams.length} exámenes válidos, ${skippedExams.length} saltados`);
      if (foundExams.length > 0) {
        console.log(`   ✅ Exámenes encontrados: ${foundExams.join(', ')}`);
      }
      if (skippedExams.length > 0) {
        console.log(`   ⚠️ Exámenes saltados: ${skippedExams.join(', ')}`);
      }

      // Si hay materias completadas, crear o actualizar el documento de progreso
      if (completedSubjects.size > 0) {
        const progressId = `${studentId}_${phase}`;
        const progressRef = doc(this.getCollection('studentPhaseProgress'), progressId);
        const progressSnap = await getDoc(progressRef);

        const subjectsCompletedArray = Array.from(completedSubjects);
        const status = this.calculatePhaseStatus(
          subjectsCompletedArray,
          []
        );

        const progress: StudentPhaseProgress = {
          studentId,
          gradeId,
          phase,
          status,
          completedAt: subjectsCompletedArray.length === this.REQUIRED_SUBJECTS.length 
            ? new Date().toISOString() 
            : undefined,
          subjectsCompleted: subjectsCompletedArray,
          subjectsInProgress: [],
          createdAt: progressSnap.exists() 
            ? (progressSnap.data().createdAt?.toDate?.()?.toISOString() || progressSnap.data().createdAt)
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(progressRef, {
          ...progress,
          createdAt: Timestamp.fromDate(new Date(progress.createdAt)),
          updatedAt: Timestamp.now(),
        });

        console.log(`✅ Progreso sincronizado para ${studentId}: ${subjectsCompletedArray.length}/${this.REQUIRED_SUBJECTS.length} materias`);
        console.log(`   Materias completadas: ${subjectsCompletedArray.join(', ')}`);
      } else {
        console.log(`   ⚠️ No se encontraron materias válidas para sincronizar`);
      }
    } catch (e) {
      console.error('❌ Error sincronizando progreso:', e);
    }
  }

  /**
   * Normaliza el nombre de una materia para que coincida con REQUIRED_SUBJECTS
   */
  private normalizeSubjectName(subject: string): string {
    if (!subject) return subject;
    
    // Normalizar espacios y mayúsculas/minúsculas
    const normalized = subject.trim();
    
    const mapping: Record<string, string> = {
      'Lenguaje': 'Lenguaje',
      'Lectura Crítica': 'Lenguaje',
      'Lectura Critica': 'Lenguaje',
      'Matemáticas': 'Matemáticas',
      'Matematicas': 'Matemáticas',
      'Ciencias Sociales': 'Ciencias Sociales',
      'Biologia': 'Biologia',
      'Biología': 'Biologia',
      'Física': 'Física',
      'Fisica': 'Física',
      'Quimica': 'Quimica',
      'Química': 'Quimica',
      'Inglés': 'Inglés',
      'Ingles': 'Inglés',
      'English': 'Inglés',
    };
    
    // Buscar coincidencia exacta primero
    if (mapping[normalized]) {
      return mapping[normalized];
    }
    
    // Buscar coincidencia case-insensitive
    const lowerNormalized = normalized.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerNormalized) {
        return value;
      }
    }
    
    // Si no hay coincidencia, retornar el original
    return normalized;
  }

  /**
   * Lista de materias requeridas por fase (7 materias)
   */
  private readonly REQUIRED_SUBJECTS = [
    'Matemáticas',
    'Lenguaje',
    'Ciencias Sociales',
    'Biologia',
    'Física',
    'Quimica',
    'Inglés'
  ];

  /**
   * Verifica si un estudiante completó TODAS las materias requeridas en una fase
   */
  async hasCompletedAllSubjectsInPhase(
    studentId: string,
    _gradeId: string, // Parámetro mantenido para compatibilidad, pero no se usa directamente
    phase: PhaseType
  ): Promise<Result<{ completed: boolean; completedSubjects: string[]; pendingSubjects: string[] }>> {
    try {
      console.log(`🔍 Verificando completitud de materias para ${studentId} en fase ${phase}`);

      // Obtener progreso del estudiante en la fase
      const progressResult = await this.getStudentPhaseProgress(studentId, phase);
      
      if (!progressResult.success) {
        return failure(progressResult.error);
      }

      const progress = progressResult.data;
      
      if (!progress) {
        // No hay progreso, ninguna materia completada
        return success({
          completed: false,
          completedSubjects: [],
          pendingSubjects: [...this.REQUIRED_SUBJECTS]
        });
      }

      const completedSubjects = progress.subjectsCompleted || [];
      const pendingSubjects = this.REQUIRED_SUBJECTS.filter(
        subject => !completedSubjects.includes(subject)
      );

      const completed = completedSubjects.length === this.REQUIRED_SUBJECTS.length;

      console.log(`✅ Estudiante ${studentId}: ${completedSubjects.length}/${this.REQUIRED_SUBJECTS.length} materias completadas`);
      if (pendingSubjects.length > 0) {
        console.log(`   Materias pendientes: ${pendingSubjects.join(', ')}`);
      }

      return success({
        completed,
        completedSubjects,
        pendingSubjects
      });
    } catch (e) {
      console.error('❌ Error verificando completitud de materias:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar completitud de materias')));
    }
  }

  /**
   * Verifica si un estudiante puede acceder a una fase
   */
  async canStudentAccessPhase(
    studentId: string,
    gradeId: string,
    phase: PhaseType
  ): Promise<Result<{ canAccess: boolean; reason?: string }>> {
    try {
      // Verificar autorización de la fase
      const authResult = await this.isPhaseAuthorized(gradeId, phase);
      if (!authResult.success) {
        return failure(authResult.error);
      }

      if (!authResult.data) {
        return success({
          canAccess: false,
          reason: 'La fase no ha sido autorizada por el administrador para tu grado',
        });
      }

      // Si es la primera fase, siempre está disponible si está autorizada
      if (phase === 'first') {
        return success({ canAccess: true });
      }

      // Para fase 2 y 3, verificar que completó TODAS las materias de la fase anterior
      const previousPhase: PhaseType = phase === 'second' ? 'first' : 'second';
      const completionResult = await this.hasCompletedAllSubjectsInPhase(studentId, gradeId, previousPhase);

      if (!completionResult.success) {
        return failure(completionResult.error);
      }

      if (!completionResult.data.completed) {
        const pendingCount = completionResult.data.pendingSubjects.length;
        const pendingList = completionResult.data.pendingSubjects.join(', ');
        return success({
          canAccess: false,
          reason: `Debes completar todas las materias de la ${previousPhase === 'first' ? 'primera' : 'segunda'} fase antes de acceder a esta. Faltan ${pendingCount} materia(s): ${pendingList}`,
        });
      }

      return success({ canAccess: true });
    } catch (e) {
      console.error('❌ Error verificando acceso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar acceso')));
    }
  }

  /**
   * Calcula el estado de una fase basado en las materias completadas
   */
  private calculatePhaseStatus(
    subjectsCompleted: string[],
    subjectsInProgress: string[]
  ): PhaseStatus {
    const totalSubjects = 7; // Matemáticas, Lenguaje, Ciencias Sociales, Biología, Química, Física, Inglés

    if (subjectsCompleted.length === totalSubjects) {
      return 'completed';
    }

    if (subjectsCompleted.length > 0 || subjectsInProgress.length > 0) {
      return 'in_progress';
    }

    return 'available';
  }
}

export const phaseAuthorizationService = PhaseAuthorizationService.getInstance();
export default phaseAuthorizationService;

