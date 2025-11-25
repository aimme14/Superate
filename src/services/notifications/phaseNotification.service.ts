import { 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  query,
  where,
  Timestamp,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { Result, success, failure } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';
import { PhaseType } from '@/interfaces/phase.interface';

/**
 * Tipo de notificación
 */
export type NotificationType = 
  | 'phase_completed' // Estudiante completó todas las materias de una fase
  | 'phase_ready_to_authorize' // Todos los estudiantes completaron, listo para autorizar
  | 'phase_authorized' // Administrador autorizó una fase
  | 'phase_revoked'; // Administrador revocó una fase

/**
 * Notificación del sistema
 */
export interface PhaseNotification {
  id: string;
  type: NotificationType;
  recipientId: string; // ID del destinatario (estudiante o administrador)
  recipientType: 'student' | 'admin';
  title: string;
  message: string;
  phase: PhaseType;
  gradeId?: string;
  gradeName?: string;
  subject?: string; // Para notificaciones de materia completada
  read: boolean;
  createdAt: string;
}

/**
 * Servicio para gestionar notificaciones del sistema de fases
 */
class PhaseNotificationService {
  private static instance: PhaseNotificationService;
  private db;

  constructor() {
    this.db = getFirestore(firebaseApp);
  }

  static getInstance() {
    if (!PhaseNotificationService.instance) {
      PhaseNotificationService.instance = new PhaseNotificationService();
    }
    return PhaseNotificationService.instance;
  }

  /**
   * Obtiene una referencia a una colección en superate/auth
   */
  private getCollection(name: string) {
    return collection(this.db, 'superate', 'auth', name);
  }

  /**
   * Notifica cuando un estudiante completa todas las materias de una fase
   */
  async notifyPhaseCompleted(
    studentId: string,
    phase: PhaseType,
    gradeId: string
  ): Promise<Result<void>> {
    try {
      const notificationId = `phase_completed_${studentId}_${phase}_${Date.now()}`;
      const notificationRef = doc(this.getCollection('notifications'), notificationId);

      const phaseNames: Record<PhaseType, string> = {
        first: 'Fase 1',
        second: 'Fase 2',
        third: 'Fase 3',
      };

      const notification: PhaseNotification = {
        id: notificationId,
        type: 'phase_completed',
        recipientId: studentId,
        recipientType: 'student',
        title: `Fase completada`,
        message: `Has completado todas las materias de la ${phaseNames[phase]}. Esperando autorización del administrador para avanzar a la siguiente fase.`,
        phase,
        gradeId,
        read: false,
        createdAt: new Date().toISOString(),
      };

      await setDoc(notificationRef, {
        ...notification,
        createdAt: Timestamp.now(),
      });

      console.log(`✅ Notificación enviada: Estudiante ${studentId} completó ${phaseNames[phase]}`);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error enviando notificación:', e);
      return failure(new ErrorAPI(normalizeError(e, 'enviar notificación')));
    }
  }

  /**
   * Notifica a administradores cuando todos los estudiantes completaron una fase
   */
  async notifyPhaseReadyToAuthorize(
    gradeId: string,
    gradeName: string,
    phase: PhaseType,
    adminIds: string[] // IDs de administradores a notificar
  ): Promise<Result<void>> {
    try {
      const phaseNames: Record<PhaseType, string> = {
        first: 'Fase 1',
        second: 'Fase 2',
        third: 'Fase 3',
      };

      // Crear notificación para cada administrador
      const promises = adminIds.map(async (adminId) => {
        const notificationId = `phase_ready_${gradeId}_${phase}_${adminId}_${Date.now()}`;
        const notificationRef = doc(this.getCollection('notifications'), notificationId);

        const notification: PhaseNotification = {
          id: notificationId,
          type: 'phase_ready_to_authorize',
          recipientId: adminId,
          recipientType: 'admin',
          title: `Listo para autorizar ${phaseNames[phase]}`,
          message: `Todos los estudiantes del grado ${gradeName} han completado todas las materias de la ${phaseNames[phase]}. Puedes autorizar la siguiente fase.`,
          phase,
          gradeId,
          gradeName,
          read: false,
          createdAt: new Date().toISOString(),
        };

        await setDoc(notificationRef, {
          ...notification,
          createdAt: Timestamp.now(),
        });
      });

      await Promise.all(promises);

      console.log(`✅ Notificaciones enviadas: ${adminIds.length} administradores notificados sobre ${phaseNames[phase]} para ${gradeName}`);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error enviando notificaciones:', e);
      return failure(new ErrorAPI(normalizeError(e, 'enviar notificaciones')));
    }
  }

  /**
   * Notifica a estudiantes cuando el administrador autoriza una fase
   */
  async notifyPhaseAuthorized(
    gradeId: string,
    gradeName: string,
    phase: PhaseType,
    studentIds: string[]
  ): Promise<Result<void>> {
    try {
      const phaseNames: Record<PhaseType, string> = {
        first: 'Fase 1',
        second: 'Fase 2',
        third: 'Fase 3',
      };

      // Crear notificación para cada estudiante
      const promises = studentIds.map(async (studentId) => {
        const notificationId = `phase_authorized_${gradeId}_${phase}_${studentId}_${Date.now()}`;
        const notificationRef = doc(this.getCollection('notifications'), notificationId);

        const notification: PhaseNotification = {
          id: notificationId,
          type: 'phase_authorized',
          recipientId: studentId,
          recipientType: 'student',
          title: `${phaseNames[phase]} autorizada`,
          message: `El administrador ha autorizado la ${phaseNames[phase]} para tu grado. Ya puedes comenzar a presentar los exámenes.`,
          phase,
          gradeId,
          gradeName,
          read: false,
          createdAt: new Date().toISOString(),
        };

        await setDoc(notificationRef, {
          ...notification,
          createdAt: Timestamp.now(),
        });
      });

      await Promise.all(promises);

      console.log(`✅ Notificaciones enviadas: ${studentIds.length} estudiantes notificados sobre ${phaseNames[phase]} autorizada`);
      return success(undefined);
    } catch (e) {
      console.error('❌ Error enviando notificaciones:', e);
      return failure(new ErrorAPI(normalizeError(e, 'enviar notificaciones')));
    }
  }

  /**
   * Obtiene notificaciones no leídas para un usuario
   */
  async getUnreadNotifications(
    userId: string
  ): Promise<Result<PhaseNotification[]>> {
    try {
      const q = query(
        this.getCollection('notifications'),
        where('recipientId', '==', userId),
        where('read', '==', false)
      );

      const querySnapshot = await getDocs(q);
      const notifications: PhaseNotification[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        notifications.push({
          id: data.id,
          type: data.type,
          recipientId: data.recipientId,
          recipientType: data.recipientType,
          title: data.title,
          message: data.message,
          phase: data.phase,
          gradeId: data.gradeId,
          gradeName: data.gradeName,
          subject: data.subject,
          read: data.read,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        });
      });

      // Ordenar por fecha (más recientes primero)
      notifications.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return success(notifications);
    } catch (e) {
      console.error('❌ Error obteniendo notificaciones:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener notificaciones')));
    }
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: string): Promise<Result<void>> {
    try {
      const notificationRef = doc(this.getCollection('notifications'), notificationId);
      await setDoc(notificationRef, { read: true }, { merge: true });
      return success(undefined);
    } catch (e) {
      console.error('❌ Error marcando notificación como leída:', e);
      return failure(new ErrorAPI(normalizeError(e, 'marcar notificación como leída')));
    }
  }
}

export const phaseNotificationService = PhaseNotificationService.getInstance();
export default phaseNotificationService;

