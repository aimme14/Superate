import type { DecodedIdToken } from 'firebase-admin/auth';

declare global {
  namespace Express {
    interface Request {
      /** Poblado por `verifyBearerIdToken` en rutas protegidas de studentSummary */
      firebaseAuth?: {
        uid: string;
        decoded: DecodedIdToken;
        /** JWT sin verificar; requerido por el tipo `AuthData` de callable si se reutiliza la auth */
        rawIdToken: string;
      };
    }
  }
}

export {};
