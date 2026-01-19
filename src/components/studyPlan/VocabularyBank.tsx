/**
 * Componente de Banco de Vocabulario Académico
 * 
 * Muestra palabras académicas organizadas por materia con definiciones
 * que se obtienen desde Firestore o se generan con IA si no existen.
 */

import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { BookOpen, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useNotification } from '@/hooks/ui/useNotification';

interface WordDefinition {
  palabra: string;
  definicion: string;
  materia: string;
  activa: boolean;
  fechaCreacion?: any;
  version?: number;
  ejemploIcfes?: string; // Ejemplo de uso en pruebas ICFES
  respuestaEjemploIcfes?: string; // Respuesta lógica y razonable al ejemplo
  id?: string;
}

interface VocabularyBankProps {
  materia: string;
  theme?: 'light' | 'dark';
}

// Mapeo de materias a nombres normalizados
const MATERIA_MAP: Record<string, string> = {
  'Matemáticas': 'matematicas',
  'Lectura Crítica': 'lectura_critica',
  'Ciencias Naturales': 'ciencias_naturales',
  'Física': 'fisica',
  'Biología': 'biologia',
  'Química': 'quimica',
  'Inglés': 'ingles',
  'Sociales y Ciudadanas': 'sociales_ciudadanas',
  'Ciencias Sociales': 'sociales_ciudadanas', // Mapeo adicional para compatibilidad
};

// URL base de Cloud Functions
const FUNCTIONS_URL = 'https://us-central1-superate-ia.cloudfunctions.net';

export function VocabularyBank({ materia, theme = 'light' }: VocabularyBankProps) {
  const [words, setWords] = useState<WordDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [loadingDefinition, setLoadingDefinition] = useState<boolean>(false);
  const [previousWordIds, setPreviousWordIds] = useState<string[]>([]);
  const { notifyError } = useNotification();

  // Normalizar nombre de materia
  const normalizedMateria = MATERIA_MAP[materia] || materia.toLowerCase().replace(/\s+/g, '_');

  // Cargar palabras iniciales
  useEffect(() => {
    loadWords();
  }, [materia]);

  const loadWords = async (excludeIds: string[] = []) => {
    setLoading(true);
    try {
      const excludeParam = excludeIds.length > 0 ? `&exclude=${excludeIds.join(',')}` : '';
      const response = await fetch(
        `${FUNCTIONS_URL}/getVocabularyWords?materia=${encodeURIComponent(normalizedMateria)}&limit=10${excludeParam}`
      );

      if (!response.ok) {
        throw new Error('Error al cargar palabras');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setWords(data.data);
        // Guardar IDs de las palabras actuales para excluirlas en la próxima carga
        // Usar el ID del documento o generar uno basado en la palabra normalizada
        const currentIds = data.data.map((w: WordDefinition) => {
          if (w.id) return w.id;
          // Si no hay ID, generar uno basado en la palabra normalizada
          return w.palabra.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        }).filter(Boolean);
        setPreviousWordIds(currentIds);
      } else {
        throw new Error(data.error?.message || 'Error al cargar palabras');
      }
    } catch (error: any) {
      console.error('Error cargando palabras:', error);
      notifyError({
        title: 'Error',
        message: 'No se pudieron cargar las palabras. Intenta nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = async (word: WordDefinition) => {
    // Si ya tiene definición, mostrarla directamente
    if (word.definicion) {
      setSelectedWord(word);
      return;
    }

    // Si no tiene definición, cargarla desde el backend
    setLoadingDefinition(true);
    try {
      const response = await fetch(
        `${FUNCTIONS_URL}/getVocabularyWord?materia=${encodeURIComponent(normalizedMateria)}&palabra=${encodeURIComponent(word.palabra)}`
      );

      if (!response.ok) {
        throw new Error('Error al cargar definición');
      }

      const data = await response.json();
      if (data.success && data.data) {
        const definition = data.data;
        setSelectedWord(definition);
        // Actualizar la palabra en la lista si tiene definición
        setWords(prevWords =>
          prevWords.map(w => (w.palabra === word.palabra ? definition : w))
        );
      } else {
        throw new Error(data.error?.message || 'No se pudo obtener la definición');
      }
    } catch (error: any) {
      console.error('Error cargando definición:', error);
      notifyError({
        title: 'Error',
        message: 'No se pudo cargar la definición. Intenta nuevamente.'
      });
    } finally {
      setLoadingDefinition(false);
    }
  };

  const handleChangeWords = () => {
    loadWords(previousWordIds);
  };

  return (
    <>
      <Accordion type="single" collapsible>
        <AccordionItem value="vocabulary">
          <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Vocabulario Académico ({words.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <span className={cn("ml-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    Cargando palabras...
                  </span>
                </div>
              ) : words.length === 0 ? (
                <div className={cn(
                  "flex items-center gap-2 p-4 rounded-lg",
                  theme === 'dark' ? 'bg-zinc-700/50 text-gray-300' : 'bg-gray-50 text-gray-600'
                )}>
                  <AlertCircle className="h-4 w-4" />
                  <span>No hay palabras disponibles para esta materia.</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {words.map((word, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleWordClick(word)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all hover:scale-105",
                          theme === 'dark'
                            ? 'bg-zinc-700/50 border-zinc-600 hover:bg-zinc-700 hover:border-purple-500 text-white'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-purple-500'
                        )}
                      >
                        <span className={cn(
                          "font-medium text-sm",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {word.palabra}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleChangeWords}
                      size="sm"
                      className={cn(
                        "font-medium transition-all",
                        theme === 'dark' 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-600' 
                          : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-600'
                      )}
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Aprender nuevas palabras
                    </Button>
                  </div>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Dialog para mostrar definición */}
      <Dialog open={!!selectedWord} onOpenChange={() => setSelectedWord(null)}>
        <DialogContent className={cn(
          theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : ''
        )}>
          <DialogHeader>
            <DialogTitle className={cn(
              "text-xl font-bold",
              theme === 'dark' ? 'text-white' : ''
            )}>
              {selectedWord?.palabra}
            </DialogTitle>
            <DialogDescription className={cn(
              "text-sm",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              {materia}
            </DialogDescription>
          </DialogHeader>
          {loadingDefinition ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              <span className={cn("ml-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Generando definición...
              </span>
            </div>
          ) : selectedWord?.definicion ? (
            <div className="space-y-4">
              {/* Definición */}
              <div className={cn(
                "p-3 rounded-lg",
                theme === 'dark' ? 'bg-zinc-700/50 text-gray-200' : 'bg-gray-50 text-gray-700'
              )}>
                <h4 className={cn(
                  "font-semibold mb-2 text-sm",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  
                </h4>
                <p className="text-sm leading-relaxed">{selectedWord.definicion}</p>
              </div>
              
              {/* Ejemplo de uso en ICFES */}
              {selectedWord.ejemploIcfes && (
                <div className="space-y-3">
                  <div className={cn(
                    "p-4 rounded-lg border-l-4",
                    theme === 'dark' 
                      ? 'bg-purple-900/20 border-purple-500 text-gray-200' 
                      : 'bg-purple-50 border-purple-500 text-gray-700'
                  )}>
                    <h4 className={cn(
                      "font-semibold mb-2 text-sm flex items-center gap-2",
                      theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                    )}>
                      <BookOpen className="h-4 w-4" />
                      Ejemplo de uso en ICFES
                    </h4>
                    <p className="text-sm leading-relaxed italic">{selectedWord.ejemploIcfes}</p>
                  </div>
                  
                  {/* Respuesta al ejemplo */}
                  {selectedWord.respuestaEjemploIcfes && (
                    <div className={cn(
                      "p-4 rounded-lg border-l-4",
                      theme === 'dark' 
                        ? 'bg-green-900/20 border-green-500 text-gray-200' 
                        : 'bg-green-50 border-green-500 text-gray-700'
                    )}>
                      <h4 className={cn(
                        "font-semibold mb-2 text-sm flex items-center gap-2",
                        theme === 'dark' ? 'text-green-300' : 'text-green-700'
                      )}>
                        <BookOpen className="h-4 w-4" />
                        Respuesta
                      </h4>
                      <p className="text-sm leading-relaxed">{selectedWord.respuestaEjemploIcfes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "p-4 rounded-lg",
              theme === 'dark' ? 'bg-zinc-700/50 text-gray-300' : 'bg-gray-50 text-gray-600'
            )}>
              <p>No se pudo cargar la definición.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
