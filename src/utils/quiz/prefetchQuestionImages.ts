import type { Question } from '@/services/firebase/question.service'

function isLikelyImageUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  return /^https?:\/\//i.test(u) || u.startsWith('blob:') || u.startsWith('data:image/')
}

/**
 * Recolecta URLs de imágenes asociadas a una pregunta (enunciado, opciones).
 */
export function collectImageUrlsFromQuestion(question: Question | undefined | null): string[] {
  if (!question) return []
  const urls = new Set<string>()

  for (const u of question.informativeImages || []) {
    if (u && isLikelyImageUrl(u)) urls.add(u.trim())
  }
  for (const u of question.questionImages || []) {
    if (u && isLikelyImageUrl(u)) urls.add(u.trim())
  }
  for (const opt of question.options || []) {
    const im = opt.imageUrl
    if (im && isLikelyImageUrl(im)) urls.add(im.trim())
  }

  return [...urls]
}

export function collectImageUrlsFromQuestions(questions: Question[]): string[] {
  const all = new Set<string>()
  for (const q of questions) {
    for (const u of collectImageUrlsFromQuestion(q)) {
      all.add(u)
    }
  }
  return [...all]
}

function loadImage(url: string): void {
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

/**
 * Precarga URLs en el caché HTTP del navegador (Image).
 */
export function prefetchImageUrls(urls: string[]): void {
  const unique = [...new Set(urls.filter(Boolean))]
  for (const u of unique) {
    try {
      loadImage(u)
    } catch {
      // ignorar URLs inválidas en entornos extraños
    }
  }
}

export function scheduleIdlePrefetch(run: () => void, timeoutMs = 2500): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: timeoutMs })
    return
  }
  setTimeout(run, 0)
}
