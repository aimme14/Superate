/**
 * Temas visuales para cada materia de los cuestionarios
 * Incluye fondos, colores, patrones y estilos temáticos
 */

export interface QuizTheme {
  name: string;
  subject: string;
  // Fondos principales
  backgroundGradient: string;
  cardBackground: string;
  // Colores de acento
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  // Estilos de respuestas
  answerBorder: string;
  answerBackground: string;
  answerHover: string;
  answerText: string;
  // Patrones y efectos
  pattern?: string;
  // Colores de botones
  buttonGradient: string;
  buttonHover: string;
}

export const quizThemes: Record<string, QuizTheme> = {
  // Matemáticas - Estilo ICFES con patrones geométricos sutiles
  matemáticas: {
    name: 'Matemáticas',
    subject: 'matemáticas',
    backgroundGradient: 'linear-gradient(135deg, #fafbfc 0%, #f8f9fa 50%, #f5f6f7 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-blue-700',
    secondaryColor: 'text-indigo-600',
    accentColor: 'text-blue-600',
    answerBorder: 'border border-blue-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-blue-300 hover:shadow-sm hover:shadow-blue-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.015) 1px, transparent 0), repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(99, 102, 241, 0.008) 20px, rgba(99, 102, 241, 0.008) 40px)',
    buttonGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    buttonHover: 'hover:from-blue-700 hover:to-indigo-700',
  },

  // Física - Estilo ICFES con ondas sutiles
  física: {
    name: 'Física',
    subject: 'física',
    backgroundGradient: 'linear-gradient(135deg, #fefaf5 0%, #fef7ed 25%, #fefaf5 50%, #fef7ed 75%, #fefaf5 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-orange-700',
    secondaryColor: 'text-amber-700',
    accentColor: 'text-orange-600',
    answerBorder: 'border border-orange-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-orange-300 hover:shadow-sm hover:shadow-orange-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(251, 146, 60, 0.01) 15px, rgba(251, 146, 60, 0.01) 30px)',
    buttonGradient: 'bg-gradient-to-r from-orange-600 to-amber-600',
    buttonHover: 'hover:from-orange-700 hover:to-amber-700',
  },

  // Química - Estilo ICFES con estructura molecular sutil
  química: {
    name: 'Química',
    subject: 'química',
    backgroundGradient: 'linear-gradient(135deg, #f5fdf9 0%, #f0fdf5 25%, #f5fdf9 50%, #f0fdf5 75%, #f5fdf9 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-green-700',
    secondaryColor: 'text-emerald-700',
    accentColor: 'text-green-600',
    answerBorder: 'border border-green-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-green-300 hover:shadow-sm hover:shadow-green-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'radial-gradient(circle at 3px 3px, rgba(16, 185, 129, 0.012) 1.5px, transparent 0), radial-gradient(circle at 15px 15px, rgba(5, 150, 105, 0.008) 1px, transparent 0)',
    buttonGradient: 'bg-gradient-to-r from-green-600 to-emerald-600',
    buttonHover: 'hover:from-green-700 hover:to-emerald-700',
  },

  // Biología - Estilo ICFES con textura orgánica sutil
  biología: {
    name: 'Biología',
    subject: 'biología',
    backgroundGradient: 'linear-gradient(135deg, #f5fdf7 0%, #f0fdf4 25%, #f5fdf7 50%, #f0fdf4 75%, #f5fdf7 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-emerald-700',
    secondaryColor: 'text-green-700',
    accentColor: 'text-emerald-600',
    answerBorder: 'border border-emerald-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-emerald-300 hover:shadow-sm hover:shadow-emerald-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(16, 185, 129, 0.01) 20px, rgba(16, 185, 129, 0.01) 40px)',
    buttonGradient: 'bg-gradient-to-r from-emerald-600 to-green-600',
    buttonHover: 'hover:from-emerald-700 hover:to-green-700',
  },

  // Inglés - Estilo ICFES con líneas sutiles tipo cuaderno
  inglés: {
    name: 'Inglés',
    subject: 'inglés',
    backgroundGradient: 'linear-gradient(135deg, #f5f8fc 0%, #f0f5fc 25%, #f5f8fc 50%, #f0f5fc 75%, #f5f8fc 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-blue-700',
    secondaryColor: 'text-indigo-700',
    accentColor: 'text-blue-600',
    answerBorder: 'border border-blue-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-blue-300 hover:shadow-sm hover:shadow-blue-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(59, 130, 246, 0.01) 24px, rgba(59, 130, 246, 0.01) 25px)',
    buttonGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    buttonHover: 'hover:from-blue-700 hover:to-indigo-700',
  },

  // Lenguaje/Lectura - Estilo ICFES con líneas de texto sutiles
  lenguaje: {
    name: 'Lenguaje',
    subject: 'lenguaje',
    backgroundGradient: 'linear-gradient(135deg, #faf8fc 0%, #f7f3fc 25%, #faf8fc 50%, #f7f3fc 75%, #faf8fc 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-purple-700',
    secondaryColor: 'text-violet-700',
    accentColor: 'text-purple-600',
    answerBorder: 'border border-purple-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-purple-300 hover:shadow-sm hover:shadow-purple-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(168, 85, 247, 0.01) 20px, rgba(168, 85, 247, 0.01) 21px)',
    buttonGradient: 'bg-gradient-to-r from-purple-600 to-violet-600',
    buttonHover: 'hover:from-purple-700 hover:to-violet-700',
  },

  // Sociales - Estilo ICFES con textura tipo pergamino
  sociales: {
    name: 'Sociales',
    subject: 'sociales',
    backgroundGradient: 'linear-gradient(135deg, #fefaf5 0%, #fef7ed 25%, #fefaf5 50%, #fef7ed 75%, #fefaf5 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-amber-700',
    secondaryColor: 'text-yellow-700',
    accentColor: 'text-amber-600',
    answerBorder: 'border border-amber-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-amber-300 hover:shadow-sm hover:shadow-amber-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(245, 158, 11, 0.01) 18px, rgba(245, 158, 11, 0.01) 36px)',
    buttonGradient: 'bg-gradient-to-r from-amber-600 to-yellow-600',
    buttonHover: 'hover:from-amber-700 hover:to-yellow-700',
  },

  // Naturales - Estilo ICFES con textura natural sutil
  naturales: {
    name: 'Naturales',
    subject: 'naturales',
    backgroundGradient: 'linear-gradient(135deg, #f5fdfb 0%, #f0fdfa 25%, #f5fdfb 50%, #f0fdfa 75%, #f5fdfb 100%)',
    cardBackground: 'bg-white/98 backdrop-blur-sm',
    primaryColor: 'text-teal-700',
    secondaryColor: 'text-cyan-700',
    accentColor: 'text-teal-600',
    answerBorder: 'border border-teal-200',
    answerBackground: 'bg-white/90',
    answerHover: 'hover:border-teal-300 hover:shadow-sm hover:shadow-teal-50 hover:bg-white/95',
    answerText: 'text-gray-800',
    pattern: 'radial-gradient(circle at 4px 4px, rgba(20, 184, 166, 0.01) 1.5px, transparent 0), radial-gradient(circle at 20px 20px, rgba(6, 182, 212, 0.008) 1px, transparent 0)',
    buttonGradient: 'bg-gradient-to-r from-teal-600 to-cyan-600',
    buttonHover: 'hover:from-teal-700 hover:to-cyan-700',
  },
};

/**
 * Obtiene el tema visual para una materia específica
 */
export function getQuizTheme(subject: string): QuizTheme {
  const normalizedSubject = subject.toLowerCase().trim();
  
  // Mapeo de variaciones de nombres
  const subjectMap: Record<string, string> = {
    'matemáticas': 'matemáticas',
    'matematicas': 'matemáticas',
    'matematica': 'matemáticas',
    'math': 'matemáticas',
    'física': 'física',
    'fisica': 'física',
    'physics': 'física',
    'química': 'química',
    'quimica': 'química',
    'chemistry': 'química',
    'biología': 'biología',
    'biologia': 'biología',
    'biology': 'biología',
    'inglés': 'inglés',
    'ingles': 'inglés',
    'english': 'inglés',
    'lenguaje': 'lenguaje',
    'lengua': 'lenguaje',
    'lectura': 'lenguaje',
    'language': 'lenguaje',
    'sociales': 'sociales',
    'social': 'sociales',
    'historia': 'sociales',
    'naturales': 'naturales',
    'natural': 'naturales',
  };

  const mappedSubject = subjectMap[normalizedSubject] || normalizedSubject;
  return quizThemes[mappedSubject] || quizThemes['matemáticas']; // Tema por defecto
}

/**
 * Obtiene las clases CSS para el contenedor principal del cuestionario
 */
export function getQuizContainerClasses(theme: QuizTheme): string {
  return `min-h-screen relative overflow-hidden`;
}

/**
 * Obtiene los estilos inline para el fondo del cuestionario
 */
export function getQuizBackgroundStyle(theme: QuizTheme): React.CSSProperties {
  return {
    background: theme.backgroundGradient,
    backgroundSize: '100% 100%',
    backgroundAttachment: 'fixed',
  } as React.CSSProperties;
}

/**
 * Obtiene las clases CSS para las tarjetas de respuesta
 */
export function getAnswerOptionClasses(theme: QuizTheme, isSelected?: boolean): string {
  const baseClasses = `flex items-start space-x-3 ${theme.answerBorder} rounded-lg p-4 transition-all duration-200 ${theme.answerBackground} relative overflow-hidden ${theme.answerHover}`;
  
  if (isSelected) {
    return `${baseClasses} ${theme.answerBorder.replace('border-2', 'border-4')} shadow-lg`;
  }
  
  return baseClasses;
}

