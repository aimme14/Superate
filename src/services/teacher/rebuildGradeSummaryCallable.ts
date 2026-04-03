import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from '@/services/db'

/** Misma región que `functions/src/index.ts` (REGION). */
const FUNCTIONS_REGION = 'us-central1'

export async function requestRebuildGradeSummary(params: {
  institutionId: string
  gradeId: string
  academicYear: number | string
}): Promise<void> {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION)
  const rebuild = httpsCallable<
    { institutionId: string; gradeId: string; academicYear: number | string },
    { ok: true }
  >(functions, 'rebuildGradeSummaryOnDemand')
  await rebuild(params)
}
