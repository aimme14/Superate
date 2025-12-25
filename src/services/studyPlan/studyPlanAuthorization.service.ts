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
  StudyPlanAuthorization,
  SubjectName,
  StudyPlanPhase
} from '@/interfaces/studyPlan.interface';

/**
 * Servicio para gestionar la autorización de generación de planes de estudio por grado y materia
 */
class StudyPlanAuthorizationService {
  private static instance: StudyPlanAuthorizationService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!StudyPlanAuthorizationService.instance) {
      StudyPlanAuthorizationService.instance = new StudyPlanAuthorizationService();
    }
    return StudyPlanAuthorizationService.instance;
  }

  /**
   * Obtiene una referencia a una colección en superate/auth
   */
  private getCollection(name: string) {
    return collection(this.db, 'superate', 'auth', name);
  }

  /**
   * Autoriza la generación de plan de estudio para una fase, materia y grado específico
   */
  async authorizeStudyPlan(
    gradeId: string,
    gradeName: string,
    phase: StudyPlanPhase,
    subject: SubjectName,
    adminId: string,
    institutionId?: string,
    campusId?: string
  ): Promise<Result<StudyPlanAuthorization>> {
    try {
      const authId = `${gradeId}_${phase}_${subject}`;
      const authRef = doc(this.getCollection('studyPlanAuthorizations'), authId);

      const authorization: StudyPlanAuthorization = {
        id: authId,
        gradeId,
        gradeName,
        phase,
        subject,
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

      const phaseName = phase === 'first' ? 'Fase I' : 'Fase II';
      console.log(`✅ Plan de estudio autorizado para ${subject} (${phaseName}) en grado ${gradeName}`);
      return success(authorization);
    } catch (e) {
      console.error('❌ Error autorizando plan de estudio:', e);
      return failure(new ErrorAPI(normalizeError(e, 'autorizar plan de estudio')));
    }
  }

  /**
   * Revoca la autorización de generación de plan de estudio para una fase, materia y grado
   */
  async revokeStudyPlanAuthorization(
    gradeId: string,
    phase: StudyPlanPhase,
    subject: SubjectName
  ): Promise<Result<void>> {
    try {
      const authId = `${gradeId}_${phase}_${subject}`;
      const authRef = doc(this.getCollection('studyPlanAuthorizations'), authId);

      await updateDoc(authRef, {
        authorized: false,
        updatedAt: Timestamp.now(),
      });

      const phaseName = phase === 'first' ? 'Fase I' : 'Fase II';
      console.log(`✅ Autorización de plan de estudio revocada para ${subject} (${phaseName}) en grado ${gradeId}`);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error revocando autorización:', e);
      return failure(new ErrorAPI(normalizeError(e, 'revocar autorización de plan de estudio')));
    }
  }

  /**
   * Verifica si la generación de plan de estudio está autorizada para una fase, materia y grado
   */
  async isStudyPlanAuthorized(
    gradeId: string,
    phase: StudyPlanPhase,
    subject: SubjectName
  ): Promise<Result<boolean>> {
    try {
      const authId = `${gradeId}_${phase}_${subject}`;
      const authRef = doc(this.getCollection('studyPlanAuthorizations'), authId);
      const authSnap = await getDoc(authRef);

      if (!authSnap.exists()) {
        return success(false);
      }

      const data = authSnap.data();
      return success(data?.authorized === true);
    } catch (e) {
      console.error('❌ Error verificando autorización:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar autorización de plan de estudio')));
    }
  }

  /**
   * Obtiene todas las autorizaciones de planes de estudio de un grado
   */
  async getGradeAuthorizations(gradeId: string): Promise<Result<StudyPlanAuthorization[]>> {
    try {
      const q = query(
        this.getCollection('studyPlanAuthorizations'),
        where('gradeId', '==', gradeId)
      );

      const querySnapshot = await getDocs(q);
      const authorizations: StudyPlanAuthorization[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        authorizations.push({
          id: docSnap.id,
          gradeId: data.gradeId,
          gradeName: data.gradeName,
          phase: data.phase || 'first', // Default a 'first' para retrocompatibilidad
          subject: data.subject,
          authorized: data.authorized,
          authorizedBy: data.authorizedBy,
          authorizedAt: data.authorizedAt,
          institutionId: data.institutionId,
          campusId: data.campusId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as StudyPlanAuthorization);
      });

      return success(authorizations);
    } catch (e) {
      console.error('❌ Error obteniendo autorizaciones:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener autorizaciones de planes de estudio')));
    }
  }

  /**
   * Obtiene todas las autorizaciones de planes de estudio para una materia específica
   */
  async getSubjectAuthorizations(subject: SubjectName): Promise<Result<StudyPlanAuthorization[]>> {
    try {
      const q = query(
        this.getCollection('studyPlanAuthorizations'),
        where('subject', '==', subject),
        where('authorized', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const authorizations: StudyPlanAuthorization[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        authorizations.push({
          id: docSnap.id,
          gradeId: data.gradeId,
          gradeName: data.gradeName,
          phase: data.phase || 'first', // Default a 'first' para retrocompatibilidad
          subject: data.subject,
          authorized: data.authorized,
          authorizedBy: data.authorizedBy,
          authorizedAt: data.authorizedAt,
          institutionId: data.institutionId,
          campusId: data.campusId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as StudyPlanAuthorization);
      });

      return success(authorizations);
    } catch (e) {
      console.error('❌ Error obteniendo autorizaciones por materia:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener autorizaciones por materia')));
    }
  }
}

export const studyPlanAuthorizationService = StudyPlanAuthorizationService.getInstance();


