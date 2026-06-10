import type { User } from 'firebase/auth'

export const STUDENT_SESSION_REV_KEY = 'studentSessionRev'

export function storeStudentSessionRev(rev: number): void {
  sessionStorage.setItem(STUDENT_SESSION_REV_KEY, String(rev))
}

export function getStoredStudentSessionRev(): number {
  return Number(sessionStorage.getItem(STUDENT_SESSION_REV_KEY) ?? 0)
}

export function clearStudentSessionRev(): void {
  sessionStorage.removeItem(STUDENT_SESSION_REV_KEY)
}

export async function captureStudentSessionRevFromUser(user: User): Promise<void> {
  const result = await user.getIdTokenResult()
  if (result.claims.role !== 'student') return
  storeStudentSessionRev(Number(result.claims.sessionRev ?? 0))
}

export function isRevokedTokenError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === 'auth/id-token-revoked' || code === 'auth/user-token-expired'
}
