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
   */
  async checkGradePhaseCompletion(
    gradeId: string,
    phase: PhaseType,
    totalStudents: number
  ): Promise<Result<GradePhaseCompletion>> {
    try {
      const q = query(
        this.getCollection('studentPhaseProgress'),
        where('gradeId', '==', gradeId),
        where('phase', '==', phase)
      );

      const querySnapshot = await getDocs(q);
      let completedStudents = 0;
      let inProgressStudents = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'completed') {
          completedStudents++;
        } else if (data.status === 'in_progress') {
          inProgressStudents++;
        }
      });

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
      };

      return success(completion);
    } catch (e) {
      console.error('❌ Error verificando completitud:', e);
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

