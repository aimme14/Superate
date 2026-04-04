/**
 * Banco de vocabulario académico: una sola carga desde definitionswords/consolidado_{materia} (backend).
 */

import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/hooks/ui/useNotification';

interface WordDefinition {
  palabra: string;
  definicion: string;
  materia: string;
  activa: boolean;
  fechaCreacion?: any;
  version?: number;
  ejemploIcfes?: string;
  respuestaEjemploIcfes?: string;
  id?: string;
}

interface VocabularyBankProps {
  materia: string;
  theme?: 'light' | 'dark';
}

const MATERIA_MAP: Record<string, string> = {
  'Matemáticas': 'matematicas',
  'Lectura Crítica': 'lectura_critica',
  'Lenguaje': 'lectura_critica',
  'Ciencias Naturales': 'ciencias_naturales',
  'Física': 'fisica',
  'Biología': 'biologia',
  'Química': 'quimica',
  'Inglés': 'ingles',
  'Sociales y Ciudadanas': 'sociales_ciudadanas',
  'Ciencias Sociales': 'sociales_ciudadanas',
};

const FUNCTIONS_URL =
  import.meta.env.VITE_CLOUD_FUNCTIONS_URL ||
  'https://us-central1-superate-6c730.cloudfunctions.net';

const PAGE_SIZE = 10;

export function VocabularyBank({ materia, theme = 'light' }: VocabularyBankProps) {
  const [words, setWords] = useState<WordDefinition[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const { notifyError } = useNotification();

  const normalizedMateria = MATERIA_MAP[materia] || materia.toLowerCase().replace(/\s+/g, '_');

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
          setWords(data.data as WordDefinition[]);
        } else {
          throw new Error(data.error?.message || 'Error al cargar palabras');
        }
      } catch (error: unknown) {
        console.error('Error cargando palabras:', error);
        notifyError({
          title: 'Error',
          message: 'No se pudieron cargar las palabras. Intenta nuevamente.',
        });
        setWords([]);
      } finally {
        setLoading(false);
      }
    };
    loadWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar materia
  }, [materia]);

  const handleWordClick = (word: WordDefinition) => {
    setSelectedWord(word);
  };

  const visibleWords = words.slice(0, visibleCount);
  const canShowMore = visibleCount < words.length;

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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-h-[min(70vh,480px)] overflow-y-auto pr-1">
                    {visibleWords.map((word) => (
                      <button
                        key={word.id ?? word.palabra}
                        type="button"
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
                  {canShowMore && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setVisibleCount((c) => Math.min(c + PAGE_SIZE, words.length))
                        }
                        className={cn(
                          theme === 'dark'
                            ? 'border-zinc-600 text-white hover:bg-zinc-700'
                            : ''
                        )}
                      >
                        Mostrar{' '}
                        {Math.min(PAGE_SIZE, words.length - visibleCount)} más
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
          {selectedWord?.definicion ? (
            <div className="space-y-4">
              <div className={cn(
                "p-3 rounded-lg",
                theme === 'dark' ? 'bg-zinc-700/50 text-gray-200' : 'bg-gray-50 text-gray-700'
              )}>
                <p className="text-sm leading-relaxed">{selectedWord.definicion}</p>
              </div>

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
              <p>No hay definición en el consolidado para esta palabra.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
