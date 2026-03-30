import { initializeApp, getApps } from "firebase/app"
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore"
import config from "@/utils/config"

export const firebaseApp = initializeApp(config.firebaseConfig)

/** Caché persistente en navegador (IndexedDB) para que getDoc reutilice datos offline y entre visitas. */
if (typeof window !== "undefined") {
  try {
    initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes("already")) {
      console.warn("[Firestore] No se pudo activar persistentLocalCache:", e)
    }
  }
}

/** Segunda app (mismo proyecto): permite crear cuentas en Auth sin cambiar `currentUser` de la app principal. */
const SECONDARY_AUTH_APP_NAME = "SuperateAdminCreateUser"
export const firebaseSecondaryApp =
  getApps().find((a) => a.name === SECONDARY_AUTH_APP_NAME) ??
  initializeApp(config.firebaseConfig, SECONDARY_AUTH_APP_NAME)