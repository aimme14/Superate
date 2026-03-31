import { doc, onSnapshot, getFirestore, Timestamp, setDoc } from "firebase/firestore";
import { firebaseApp } from "@/services/db";
import type { GlobalPhaseAuthorization, PhaseType } from "@/interfaces/phase.interface";

const db = getFirestore(firebaseApp);

type FlagsDoc = {
  faseI?: boolean;
  faseII?: boolean;
  faseIII?: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
};

const DEFAULT_FLAGS: GlobalPhaseAuthorization = {
  // Por UX: si no existe la config global, asumimos que Fase I está abierta
  // para que el estudiante pueda iniciar (fase II/III cerradas por defecto).
  faseI: true,
  faseII: false,
  faseIII: false,
};

const FLAGS_DOC_REF = doc(db, "superate", "auth", "system", "Autorizacion_fases");

/**
 * Singleton: mantiene un listener único (onSnapshot) y guarda en memoria la config global.
 * Así evitamos "getDoc" repetidos desde múltiples componentes.
 */
class GlobalPhaseAuthorizationService {
  private static instance: GlobalPhaseAuthorizationService;

  private current: GlobalPhaseAuthorization | null = null;
  private unsubscribe: (() => void) | null = null;
  private readyPromise: Promise<GlobalPhaseAuthorization> | null = null;
  private readyResolve: ((v: GlobalPhaseAuthorization) => void) | null = null;

  static getInstance() {
    if (!GlobalPhaseAuthorizationService.instance) {
      GlobalPhaseAuthorizationService.instance = new GlobalPhaseAuthorizationService();
    }
    return GlobalPhaseAuthorizationService.instance;
  }

  private toFlags(data: FlagsDoc | undefined | null): GlobalPhaseAuthorization {
    return {
      faseI: data?.faseI === true,
      faseII: data?.faseII === true,
      faseIII: data?.faseIII === true,
    };
  }

  private ensureListener() {
    if (this.unsubscribe) return;

    // Iniciar promesa de "ready" una sola vez.
    if (!this.readyPromise) {
      this.readyPromise = new Promise<GlobalPhaseAuthorization>((resolve) => {
        this.readyResolve = resolve;
      });
    }

    this.unsubscribe = onSnapshot(
      FLAGS_DOC_REF,
      (snap) => {
        const flags = snap.exists() ? this.toFlags(snap.data() as FlagsDoc) : DEFAULT_FLAGS;
        this.current = flags;
        if (this.readyResolve) {
          this.readyResolve(flags);
          this.readyResolve = null;
        }
      },
      (err) => {
        // Si falla el listener, al menos devolvemos defaults para no romper el flujo.
        console.error("[GlobalPhaseAuthorization] onSnapshot error:", err);
        this.current = this.current ?? DEFAULT_FLAGS;
        if (this.readyResolve) {
          this.readyResolve(this.current);
          this.readyResolve = null;
        }
      }
    );
  }

  /**
   * Obtiene el estado global con un único listener compartido.
   * - Primera llamada espera al primer snapshot.
   * - Subsecuentes llamadas usan memoria.
   */
  async getFlags(): Promise<GlobalPhaseAuthorization> {
    if (this.current) return this.current;
    this.ensureListener();
    return this.readyPromise ?? DEFAULT_FLAGS;
  }

  /**
   * Permite leer sin esperar; puede ser null si aún no llegó el primer snapshot.
   */
  getCurrentFlags(): GlobalPhaseAuthorization | null {
    return this.current;
  }

  /**
   * Actualiza la config global (solo admin desde el cliente).
   */
  async setFlags(flags: GlobalPhaseAuthorization, adminId: string): Promise<void> {
    // Importante: esto no se usa desde el estudiante.
    await setDoc(
      FLAGS_DOC_REF,
      {
        ...flags,
        updatedBy: adminId,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  /**
   * @returns docId de fase (para debug/telemetría)
   */
  phaseToFlagKey(phase: PhaseType): keyof GlobalPhaseAuthorization {
    if (phase === "first") return "faseI";
    if (phase === "second") return "faseII";
    return "faseIII";
  }
}

export const globalPhaseAuthorizationService = GlobalPhaseAuthorizationService.getInstance();

