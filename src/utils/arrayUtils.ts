/**
 * Utilidades para manipulación de arrays.
 * Centraliza funciones reutilizables como shuffle para evitar duplicación.
 */

/**
 * Mezcla un array usando el algoritmo Fisher-Yates.
 * Produce una permutación uniformemente aleatoria en O(n).
 *
 * @param array - Array a mezclar (no muta el original)
 * @returns Nuevo array con los elementos en orden aleatorio
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
