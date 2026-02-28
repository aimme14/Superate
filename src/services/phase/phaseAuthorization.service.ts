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
import { getPhaseName } from '@/utils/firestoreHelpers';
import { logger } from '@/utils/logger';

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

      logger.log(`✅ Fase ${phase} autorizada para grado ${gradeName}`);
      return success(authorization);
    } catch (e) {
      logger.error('❌ Error autorizando fase:', e);
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

      logger.log(`✅ Autorización de fase ${phase} revocada para grado ${gradeId}`);
      return success(undefined);
    } catch (e) {
      logger.error('❌ Error revocando autorización:', e);
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
      logger.error('❌ Error verificando autorización:', e);
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
      logger.error('❌ Error obteniendo autorizaciones:', e);
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
      logger.log(`💾 Actualizando progreso:`, {
        studentId,
        gradeId: `"${gradeId}"`,
        phase,
        subject,
        completed
      });

      const progressId = `${studentId}_${phase}`;
      const progressRef = doc(this.getCollection('studentPhaseProgress'), progressId);
      const progressSnap = await getDoc(progressRef);

      let progress: StudentPhaseProgress;

      if (progressSnap.exists()) {
        const data = progressSnap.data();
        const subjectsCompleted = new Set<string>((data.subjectsCompleted || []) as string[]);
        const subjectsInProgress = new Set<string>((data.subjectsInProgress || []) as string[]);

        // Normalizar el subject antes de agregarlo (convertir códigos a nombres)
        const normalizedSubject = this.normalizeSubjectCode(subject);
        logger.log(`   🔄 Normalizando subject: "${subject}" -> "${normalizedSubject}"`);

        if (completed) {
          subjectsCompleted.add(normalizedSubject);
          subjectsInProgress.delete(normalizedSubject);
          // También eliminar versiones no normalizadas
          subjectsInProgress.delete(subject);
        } else {
          subjectsInProgress.add(normalizedSubject);
          subjectsCompleted.delete(normalizedSubject);
          // También eliminar versiones no normalizadas
          subjectsCompleted.delete(subject);
        }

        progress = {
          studentId,
          gradeId, // Mantener el gradeId actualizado
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

        logger.log(`📝 Progreso actualizado (existente):`, {
          studentId,
          gradeId: `"${progress.gradeId}"`,
          completadas: progress.subjectsCompleted.length,
          enProgreso: progress.subjectsInProgress.length,
          status: progress.status
        });
      } else {
        // Normalizar el subject antes de crear el registro
        const normalizedSubject = this.normalizeSubjectCode(subject);
        logger.log(`   🔄 Normalizando subject (nuevo): "${subject}" -> "${normalizedSubject}"`);

        progress = {
          studentId,
          gradeId,
          phase,
          status: completed ? 'completed' : 'in_progress',
          completedAt: completed ? new Date().toISOString() : undefined,
          subjectsCompleted: completed ? [normalizedSubject] : [],
          subjectsInProgress: completed ? [] : [normalizedSubject],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        logger.log(`📝 Progreso creado (nuevo):`, {
          studentId,
          gradeId: `"${progress.gradeId}"`,
          phase,
          subject,
          completed
        });
      }

      await setDoc(progressRef, {
        ...progress,
        createdAt: Timestamp.fromDate(new Date(progress.createdAt)),
        updatedAt: Timestamp.now(),
      });

      logger.log(`✅ Progreso guardado exitosamente en Firebase`);

      return success(progress);
    } catch (e) {
      logger.error('❌ Error actualizando progreso:', e);
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
      logger.error('❌ Error obteniendo progreso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener progreso')));
    }
  }

  /**
   * Verifica si todos los estudiantes de un grado completaron una fase
   * IMPORTANTE: Verifica directamente en Firestore los exámenes completados de cada estudiante
   */
  async checkGradePhaseCompletion(
    gradeId: string,
    phase: PhaseType,
    totalStudents: number
  ): Promise<Result<GradePhaseCompletion>> {
    try {
      logger.log(`🔍 Verificando completitud para gradeId: "${gradeId}", phase: "${phase}"`);
      
      // 1. Obtener todos los estudiantes del grado
      const studentsResult = await dbService.getFilteredStudents({
        gradeId: gradeId,
        isActive: true,
      });

      if (!studentsResult.success) {
        logger.error('❌ Error obteniendo estudiantes:', studentsResult.error);
        return failure(new ErrorAPI(normalizeError(new Error('Error al obtener estudiantes'), 'verificar completitud')));
      }

      const students = studentsResult.data || [];
      logger.log(`👥 Estudiantes encontrados en el grado: ${students.length}`);

      // 2. Lista canónica de las 7 materias requeridas
      const ALL_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
      
      // 3. Obtener el nombre de la fase para la ruta de Firestore
      const phaseName = getPhaseName(phase);
      logger.log(`📂 Verificando exámenes en: results/{studentId}/${phaseName}`);

      let completedStudents = 0;
      let inProgressStudents = 0;

      // 4. Para cada estudiante, verificar sus exámenes completados directamente en Firestore
      for (const student of students) {
        const studentId = student.id || student.uid;
        if (!studentId) {
          logger.warn(`⚠️ Estudiante sin ID válido:`, student);
          continue;
        }

        try {
          // Consultar los exámenes completados en la subcolección de la fase
          // Para fase 2, también buscar en el nombre alternativo para retrocompatibilidad
          let resultsSnapshot;
          if (phase === 'second') {
            // Intentar primero con el nombre estándar
            const resultsRef = collection(this.db, 'results', studentId, phaseName);
            resultsSnapshot = await getDocs(resultsRef);
            
            // También intentar con el nombre alternativo "fase II" (minúsculas)
            const altPhaseName = 'fase II';
            const altResultsRef = collection(this.db, 'results', studentId, altPhaseName);
            const altSnapshot = await getDocs(altResultsRef);
            
            // Combinar ambos resultados si existen
            if (altSnapshot.size > 0) {
              const allDocs = [...resultsSnapshot.docs, ...altSnapshot.docs];
              resultsSnapshot = {
                docs: allDocs,
                size: allDocs.length,
                empty: allDocs.length === 0
              } as any;
            }
          } else {
            const resultsRef = collection(this.db, 'results', studentId, phaseName);
            resultsSnapshot = await getDocs(resultsRef);
          }
          
          // Filtrar solo exámenes completados con materia válida
          const completedExams = resultsSnapshot.docs
            .map((doc: any) => doc.data())
            .filter((exam: any) => {
              const isCompleted = exam.completed === true;
              const hasSubject = exam.subject && exam.subject.trim() !== '';
              return isCompleted && hasSubject;
            });

          logger.log(`👤 Estudiante ${studentId}:`, {
            totalExamenes: resultsSnapshot.size,
            examenesCompletados: completedExams.length,
            materias: completedExams.map((e: any) => e.subject)
          });

          // Normalizar las materias de los exámenes completados
          const completedSubjectsSet = new Set<string>();
          completedExams.forEach((exam: any) => {
            const subject = exam.subject;
            if (subject) {
              const normalized = this.normalizeSubjectCode(subject).trim().toLowerCase();
              if (normalized) {
                completedSubjectsSet.add(normalized);
              }
            }
          });

          // Verificar si tiene todas las 7 materias requeridas
          const hasAllRequiredSubjects = ALL_SUBJECTS.every(subject => {
            const normalizedSubject = subject.trim().toLowerCase();
            return completedSubjectsSet.has(normalizedSubject);
          });

          if (hasAllRequiredSubjects && completedSubjectsSet.size >= 7) {
            completedStudents++;
            logger.log(`   ✅ COMPLETADO: ${studentId} - Tiene ${completedSubjectsSet.size}/7 materias`);
          } else if (completedSubjectsSet.size > 0) {
            inProgressStudents++;
            const missingSubjects = ALL_SUBJECTS.filter(s => 
              !completedSubjectsSet.has(s.trim().toLowerCase())
            );
            logger.log(`   ⏱️ EN PROGRESO: ${studentId} - Tiene ${completedSubjectsSet.size}/7 materias`);
            logger.log(`      Faltantes: ${missingSubjects.join(', ')}`);
          } else {
            inProgressStudents++; // Si tiene exámenes pero no completados, considerar en progreso
            logger.log(`   ⏱️ EN PROGRESO: ${studentId} - Sin exámenes completados aún`);
          }
        } catch (studentError) {
          logger.error(`❌ Error verificando exámenes del estudiante ${studentId}:`, studentError);
          // Si hay error al consultar, considerar como pendiente (no en progreso)
        }
      }

      // 5. Calcular estudiantes pendientes
      const pendingStudents = Math.max(0, totalStudents - completedStudents - inProgressStudents);
      
      const completionPercentage = totalStudents > 0 
        ? (completedStudents / totalStudents) * 100 
        : 0;

      const completion: GradePhaseCompletion = {
        gradeId,
        gradeName: '', 
        phase,
        totalStudents,
        completedStudents,
        inProgressStudents,
        pendingStudents,
        completionPercentage,
        allCompleted: completedStudents === totalStudents && totalStudents > 0,
        lastUpdated: new Date().toISOString(),
      };

      logger.log(`📊 RESUMEN FINAL - Grado ${gradeId}, Fase ${phase}:`, {
        totalEstudiantes: totalStudents,
        completados: completedStudents,
        enProgreso: inProgressStudents,
        pendientes: pendingStudents,
        porcentajeCompletitud: `${completionPercentage.toFixed(1)}%`
      });

      return success(completion);
    } catch (e) {
      logger.error('❌ Error verificando completitud:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar completitud')));
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

      // Para fase 2 y 3, verificar que completó la fase anterior
      const previousPhase: PhaseType = phase === 'second' ? 'first' : 'second';
      const progressResult = await this.getStudentPhaseProgress(studentId, previousPhase);

      if (!progressResult.success) {
        return failure(progressResult.error);
      }

      if (!progressResult.data || progressResult.data.status !== 'completed') {
        return success({
          canAccess: false,
          reason: `Debes completar la ${previousPhase === 'first' ? 'primera' : 'segunda'} fase antes de acceder a esta`,
        });
      }

      // Para fase 2 y 3, verificar que todos los estudiantes del grado completaron la fase anterior
      // Esto se puede optimizar con un campo en la autorización
      // Por ahora, asumimos que si el estudiante completó, puede acceder
      // El administrador debe verificar antes de autorizar

      return success({ canAccess: true });
    } catch (e) {
      logger.error('❌ Error verificando acceso:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar acceso')));
    }
  }

  /**
   * Normaliza un código/ID de examen a nombre de materia
   * Maneja códigos como: BI11464035, MA11437942, exam_lengua_001, etc.
   */
  private normalizeSubjectCode(codeOrName: string): string {
    if (!codeOrName) return codeOrName;

    const originalCode = codeOrName.trim();
    const upperCode = originalCode.toUpperCase();
    
    // Mapeo de códigos a nombres de materias (en orden de especificidad)
    const codeToSubjectMap: Record<string, string> = {
      // Nombres completos exactos (mayor prioridad)
      'MATEMÁTICAS': 'Matemáticas',
      'MATEMATICAS': 'Matemáticas',
      'LENGUAJE': 'Lenguaje',
      'LENGUA': 'Lenguaje',
      'CIENCIAS SOCIALES': 'Ciencias Sociales',
      'BIOLOGIA': 'Biologia',
      'BIOLOGÍA': 'Biologia',
      'QUIMICA': 'Quimica',
      'QUÍMICA': 'Quimica',
      'FISICA': 'Física',
      'FÍSICA': 'Física',
      'INGLES': 'Inglés',
      'INGLÉS': 'Inglés',
    };

    // Buscar coincidencia exacta primero
    if (codeToSubjectMap[upperCode]) {
      return codeToSubjectMap[upperCode];
    }

    // Buscar por prefijos de 2 caracteres (BI, MA, CS, etc.)
    const prefix = upperCode.substring(0, 2);
    const prefixMap: Record<string, string> = {
      'BI': 'Biologia',
      'MA': 'Matemáticas',
      'LE': 'Lenguaje',
      'CS': 'Ciencias Sociales',
      'QU': 'Quimica',
      'FI': 'Física',
      'IN': 'Inglés',
    };

    if (prefixMap[prefix]) {
      return prefixMap[prefix];
    }

    // Buscar palabras clave en el código
    const keywordMap: Record<string, string> = {
      'LENGUA': 'Lenguaje',
      'EXAM_LENGUA': 'Lenguaje',
      'MATEMATICA': 'Matemáticas',
      'SOCIALES': 'Ciencias Sociales',
      'BIOLOGIA': 'Biologia',
      'QUIMICA': 'Quimica',
      'FISICA': 'Física',
      'INGLES': 'Inglés',
    };

    for (const [keyword, subject] of Object.entries(keywordMap)) {
      if (upperCode.includes(keyword)) {
        return subject;
      }
    }

    // Si no se encuentra, retornar el valor original (puede ser un nombre válido ya normalizado)
    logger.log(`⚠️ No se pudo normalizar código: "${codeOrName}"`);
    return originalCode;
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

  /**
   * Método de diagnóstico para verificar datos de progreso
   */
  async diagnoseStudentProgress(studentId: string, phase: PhaseType): Promise<void> {
    try {
      const progressId = `${studentId}_${phase}`;
      const progressRef = doc(this.getCollection('studentPhaseProgress'), progressId);
      const progressSnap = await getDoc(progressRef);

      logger.log(`🔍 DIAGNÓSTICO - Estudiante: ${studentId}, Fase: ${phase}`);
      
      if (progressSnap.exists()) {
        const data = progressSnap.data();
        logger.log(`📋 Datos encontrados:`, {
          studentId: data.studentId,
          gradeId: `"${data.gradeId}"`,
          phase: data.phase,
          status: data.status,
          subjectsCompleted: data.subjectsCompleted || [],
          subjectsInProgress: data.subjectsInProgress || [],
          completedAt: data.completedAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      } else {
        logger.log(`⚠️ No se encontró registro de progreso`);
      }
    } catch (e) {
      logger.error('❌ Error en diagnóstico:', e);
    }
  }
}

export const phaseAuthorizationService = PhaseAuthorizationService.getInstance();
export default phaseAuthorizationService;

