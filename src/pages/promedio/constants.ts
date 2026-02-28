/**
 * Constantes para el módulo de análisis ICFES.
 */

export const STUDY_LINKS_INITIAL_PER_TOPIC = 10;
export const STUDY_VIDEOS_INITIAL_PER_TOPIC = 10;

export const MOTIVATIONAL_MESSAGES = [
  "El temor a Dios es el inicio de la sabiduría.",
  "Cree en ti. Ya estás más cerca de lo que imaginas.",
  "Cada página que estudias te acerca un paso más al éxito.",
  "Tu esfuerzo de hoy es tu logro de mañana.",
  "Los limites están solo en tu mente.",
  "No hay metas imposibles, solo pasos que aún no diste.",
  "El conocimiento te abre puertas, el esfuerzo las mantiene abiertas.",
  "Nunca es tarde para volver a intentarlo.",
  "Sigue adelante, aunque el camino se vuelva cuesta arriba.",
  "La constancia vence al talento cuando el talento no trabaja duro.",
  "Tu actitud puede cambiarlo todo.",
  "El éxito no es un destino, es un viaje decides recorrer.",
  "Cada error te enseña algo nuevo.",
  "Tu dedicación de hoy construye tu futuro de mañana.",
  "Los grandes logros comienzan con pequeños pasos.",
  "Confía en tu proceso, estás en el camino correcto.",
] as const;

export const PHILOSOPHICAL_QUOTES = [
  { quote: "La excelencia no es un acto, sino un hábito. Somos lo que repetidamente hacemos.", author: "Aristóteles" },
  { quote: "El único modo de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
  { quote: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { quote: "No te preocupes por los fracasos, preocúpate por las oportunidades que pierdes cuando ni siquiera lo intentas.", author: "Jack Canfield" },
  { quote: "La diferencia entre lo imposible y lo posible reside en la determinación de una persona.", author: "Tommy Lasorda" },
  { quote: "El único lugar donde el éxito viene antes que el trabajo es en el diccionario.", author: "Vidal Sassoon" },
  { quote: "El futuro pertenece a aquellos que creen en la belleza de sus sueños.", author: "Eleanor Roosevelt" },
  { quote: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", author: "Nelson Mandela" },
  { quote: "El aprendizaje nunca agota la mente.", author: "Leonardo da Vinci" },
  { quote: "No esperes el momento perfecto, comienza ahora. Hazlo ahora.", author: "George Herbert" },
] as const;

export const BIBLE_VERSES = [
  { verse: "Todo lo puedo en Cristo que me fortalece.", reference: "Filipenses 4:13" },
  { verse: "El Señor es mi fortaleza y mi escudo; en él confía mi corazón.", reference: "Salmos 28:7" },
  { verse: "Con Dios todas las cosas son posibles.", reference: "Mateo 19:26" },
  { verse: "El Señor te bendecirá y te guardará.", reference: "Números 6:24" },
  { verse: "Fíate del Señor de todo corazón, y no te apoyes en tu propia prudencia.", reference: "Proverbios 3:5" },
  { verse: "Porque yo sé los planes que tengo para ti... planes de bienestar y no de mal, para darte un futuro y una esperanza.", reference: "Jeremías 29:11" },
  { verse: "Encomienda al Señor tu camino, confía en él, y él actuará.", reference: "Salmos 37:5" },
  { verse: "El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.", reference: "Filipenses 1:6" },
  { verse: "Esforzaos y cobrad ánimo; no temáis ni os intimidéis, porque el Señor tu Dios está contigo.", reference: "Josué 1:9" },
] as const;

export const TEST_NAME_MAP: Record<string, string> = {
  'Prueba 1': 'Comprensión de avisos públicos',
  'Prueba 2': 'Vocabulario, Asociación semántica',
  'Prueba 3': 'Competencia comunicativa',
  'Prueba 4': 'Comprensión lectora',
  'Prueba 5': 'Comprensión global del texto',
  'Prueba 6': 'Comprensión lectora avanzada',
  'Prueba 7': 'Preposiciones y conectores',
};
