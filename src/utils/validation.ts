/**
 * Valida si una cadena es una URL válida
 * @param url Cadena a validar como URL
 * @returns true si es una URL válida, false en caso contrario
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch (err) { return false }
}

/**
 * Valida si una cadena es un correo electrónico válido
 * @param email Cadena a validar como correo electrónico
 * @returns true si es un correo válido, false en caso contrario
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
};

/**
 * Valida si una cadena contiene solo números
 * @param value Cadena a validar
 * @returns true si solo contiene números, false en caso contrario
 */
export const isNumeric = (value: string): boolean => { return /^\d+$/.test(value) }