/**
 * Estado compartido del prompt diferido de instalación PWA (Chrome/Edge/Android).
 * Safari en iOS no dispara `beforeinstallprompt`; ahí solo hay instrucciones manuales.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

export function setDeferredInstallPrompt(e: BeforeInstallPromptEvent | null) {
  deferred = e
  notify()
}

export function getDeferredInstallPrompt() {
  return deferred
}

export function subscribePwaInstall(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferred
  if (!ev) return 'unavailable'
  await ev.prompt()
  const choice = await ev.userChoice
  deferred = null
  notify()
  return choice.outcome
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  )
}
