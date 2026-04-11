/**
 * Autenticación HTTP para rutas legacy de resumen académico (Bearer ID token).
 */
import type { RequestHandler } from 'express';
import type { Response } from 'express';
import { auth } from '../config/firebase.config';
import type { APIResponse } from '../types/question.types';

function unauthorized(res: Response, message: string): void {
  res.status(401).json({
    success: false,
    error: { message },
  } as APIResponse);
}

/**
 * Lee `Authorization: Bearer <idToken>`, verifica con Admin SDK y adjunta uid + claims en `req.firebaseAuth`.
 */
export const verifyBearerIdToken: RequestHandler = async (req, res, next) => {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== 'string' || !raw.startsWith('Bearer ')) {
    unauthorized(res, 'Se requiere Authorization: Bearer con ID token');
    return;
  }
  const idToken = raw.slice('Bearer '.length).trim();
  if (!idToken) {
    unauthorized(res, 'Token vacío');
    return;
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.firebaseAuth = { uid: decoded.uid, decoded, rawIdToken: idToken };
    next();
  } catch {
    unauthorized(res, 'Token inválido o expirado');
  }
};
