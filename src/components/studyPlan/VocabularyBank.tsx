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
  'Lenguaje': 'lectura_critica', // Lenguaje es equivalente a Lectura Crítica en ICFES
  'Ciencias Naturales': 'ciencias_naturales',
  'Física': 'fisica',
  'Biología': 'biologia',
  'Química': 'quimica',
  'Inglés': 'ingles',
  'Sociales y Ciudadanas': 'sociales_ciudadanas',
  'Ciencias Sociales': 'sociales_ciudadanas', // Mapeo adicional para el nombre usado en el sistema
};

// URL base de Cloud Functions
const FUNCTIONS_URL = 'https://us-central1-superate-ia.cloudfunctions.net';

const PAGE_SIZE = 10;

function shuffleWords<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VocabularyBank({ materia, theme = 'light' }: VocabularyBankProps) {
  /** Catálogo completo devuelto una sola vez por el API (consolidado en backend). */
  const [catalog, setCatalog] = useState<WordDefinition[]>([]);
  /** Orden mezclado para mostrar; la paginación es solo sobre este array en cliente. */
  const [displayList, setDisplayList] = useState<WordDefinition[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [loadingDefinition, setLoadingDefinition] = useState<boolean>(false);
  const { notifyError } = useNotification();

  // Normalizar nombre de materia
  const normalizedMateria = MATERIA_MAP[materia] || materia.toLowerCase().replace(/\s+/g, '_');

  const visibleWords = displayList.slice(0, visibleCount);
  const canShowMore = visibleCount < displayList.length;

  // Una sola petición: todas las palabras de la materia (all=1)
  useEffect(() => {
    const loadWords = async () => {
      setLoading(true);
      setVisibleCount(PAGE_SIZE);
      try {
        const response = await fetch(
          `${FUNCTIONS_URL}/getVocabularyWords?materia=${encodeURIComponent(normalizedMateria)}&all=1`
        );

        if (!response.ok) {
          throw new Error('Error al cargar palabras');
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const rows = data.data as WordDefinition[];
          setCatalog(rows);
          setDisplayList(shuffleWords(rows));
        } else {
          throw new Error(data.error?.message || 'Error al cargar palabras');
        }
      } catch (error: unknown) {
        console.error('Error cargando palabras:', error);
        notifyError({
          title: 'Error',
          message: 'No se pudieron cargar las palabras. Intenta nuevamente.',
        });
        setCatalog([]);
        setDisplayList([]);
      } finally {
        setLoading(false);
      }
    };
    loadWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar materia
  }, [materia]);

  const mergeWordInLists = (definition: WordDefinition) => {
    const merge = (prev: WordDefinition[]) =>
      prev.map((w) =>
        w.palabra === definition.palabra ? { ...w, ...definition } : w
      );
    setCatalog(merge);
    setDisplayList(merge);
  };

  const handleShowMore = () => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, displayList.length));
  };

  const handleShuffleWords = () => {
    setDisplayList(shuffleWords(catalog));
    setVisibleCount(PAGE_SIZE);
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
        mergeWordInLists(definition);
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

  return (
    <>
      <Accordion type="single" collapsible>
        <AccordionItem value="vocabulary">
          <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Vocabulario académico
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
              ) : displayList.length === 0 ? (
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
                    {visibleWords.map((word) => (
                      <button
                        key={word.id ?? word.palabra}
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
                  <div className="flex flex-wrap gap-2 justify-end">
                      {canShowMore && (
                        <Button
                          type="button"
                          onClick={handleShowMore}
                          size="sm"
                          variant="outline"
                          className={cn(
                            theme === 'dark'
                              ? 'border-zinc-600 text-white hover:bg-zinc-700'
                              : ''
                          )}
                        >
                          Mostrar {Math.min(PAGE_SIZE, displayList.length - visibleCount)}{' '}
                          más
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={handleShuffleWords}
                        size="sm"
                        className={cn(
                          'font-medium transition-all',
                          theme === 'dark'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-600'
                            : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 hover:border-purple-600'
                        )}
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Mezclar y empezar de nuevo
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
