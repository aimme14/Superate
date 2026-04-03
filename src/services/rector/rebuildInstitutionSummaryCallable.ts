import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from '@/services/db'

const FUNCTIONS_REGION = 'us-central1'

export async function requestRebuildInstitutionSummary(params: {
  institutionId: string
  academicYear: number | string
}): Promise<void> {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION)
  const fn = httpsCallable<
    { institutionId: string; academicYear: number | string },
    { ok: true }
  >(functions, 'rebuildInstitutionSummaryOnDemand')
  await fn(params)
}
