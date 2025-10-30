import { useRef, useEffect } from 'react';

/**
 * Hook personalizado para autoajustar la altura de un textarea
 * @param value - El valor del textarea
 * @param minRows - Número mínimo de filas (por defecto 3)
 * @param maxRows - Número máximo de filas (por defecto 10)
 * @returns Ref del textarea
 */
export const useAutoResizeTextarea = (
  value: string,
  minRows: number = 3,
  maxRows: number = 10
) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Resetear altura para calcular la altura correcta
    textarea.style.height = 'auto';
    
    // Calcular la altura del contenido
    const scrollHeight = textarea.scrollHeight;
    
    // Calcular altura mínima y máxima
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    
    // Aplicar altura calculada respetando los límites
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
    
    // Mostrar scrollbar si el contenido excede la altura máxima
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    
  }, [value, minRows, maxRows]);

  return textareaRef;
};
