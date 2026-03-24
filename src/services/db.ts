import { initializeApp, getApps } from "firebase/app"
import config from "@/utils/config"

export const firebaseApp = initializeApp(config.firebaseConfig)

/** Segunda app (mismo proyecto): permite crear cuentas en Auth sin cambiar `currentUser` de la app principal. */
const SECONDARY_AUTH_APP_NAME = "SuperateAdminCreateUser"
export const firebaseSecondaryApp =
  getApps().find((a) => a.name === SECONDARY_AUTH_APP_NAME) ??
  initializeApp(config.firebaseConfig, SECONDARY_AUTH_APP_NAME)