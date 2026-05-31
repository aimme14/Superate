import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import type { Question } from '@/services/firebase/question.service';
import {
  getMatchingInstructionText,
  stripHtmlToPlainText,
} from '@/utils/matchingColumns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/ui/collapsible';
import { Button } from '#/ui/button';
import ImageGallery from '@/components/common/ImageGallery';
import { cn } from '@/lib/utils';

interface MatchingColumnsInlineProps {
  questions: Question[];
  informativeText?: string;
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, optionId: string) => void;
  sanitizeHtml: (html: string) => string;
  theme?: 'dark' | 'light';
  className?: string;
}

export function MatchingColumnsInline({
  questions,
  informativeText,
  answers,
  onAnswerChange,
  sanitizeHtml,
  theme = 'light',
  className,
}: MatchingColumnsInlineProps) {
  const isDark = theme === 'dark';
  const [openRow, setOpenRow] = useState<string | null>(null);
  const instruction = getMatchingInstructionText(informativeText);

  return (
    <div className={cn('space-y-4', className)}>
      {instruction && (
        <div
          className={cn(
            'p-4 rounded-lg border text-sm leading-relaxed',
            isDark ? 'bg-blue-900/30 border-blue-700 text-gray-300' : 'bg-blue-50 border-blue-200 text-gray-700',
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(instruction) }}
        />
      )}

      <div className="space-y-2">
        {questions.map((question, rowIndex) => {
          const qId = question.id || question.code;
          const options = question.options ?? [];
          const selectedAnswer = answers[qId] ?? '';
          const selectedOption = options.find((o) => o.id === selectedAnswer);
          const selectedLabel = selectedOption
            ? stripHtmlToPlainText(selectedOption.text || '') || selectedOption.id
            : '';
          const isOpen = openRow === qId;

          return (
            <div
              key={qId}
              className={cn(
                'grid grid-cols-1 md:grid-cols-2 border rounded-lg overflow-hidden',
                isDark ? 'border-zinc-600' : 'border-gray-200',
              )}
            >
              {/* Columna izquierda: enunciado */}
              <div
                className={cn(
                  'p-4 md:border-r flex flex-col gap-3 min-h-[4.5rem]',
                  isDark ? 'bg-zinc-900/60 border-zinc-600' : 'bg-gray-50 border-gray-200',
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                      selectedAnswer ? 'bg-purple-600' : 'bg-gray-400',
                    )}
                  >
                    {rowIndex + 1}
                  </span>
                  {question.questionText && (
                    <div
                      className={cn(
                        'flex-1 text-base font-medium leading-relaxed prose max-w-none',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(question.questionText),
                      }}
                    />
                  )}
                </div>
                {question.questionImages && question.questionImages.length > 0 && (
                  <ImageGallery images={question.questionImages} maxImages={2} />
                )}
              </div>

              {/* Columna derecha: selector expandible (sin portal — no se cierra con el timer) */}
              <div className={cn('p-4', isDark ? 'bg-zinc-800' : 'bg-white')}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => setOpenRow(open ? qId : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-between h-auto min-h-[2.75rem] py-2 px-3 text-left font-normal',
                        isOpen && (isDark ? 'border-teal-500 ring-1 ring-teal-500/40' : 'border-teal-500 ring-1 ring-teal-400/40'),
                        !isOpen && selectedAnswer && (isDark
                          ? 'border-purple-500 bg-purple-900/30 text-purple-100'
                          : 'border-purple-400 bg-purple-50 text-purple-900'),
                        !isOpen && !selectedAnswer && (isDark
                          ? 'border-zinc-600 bg-zinc-700 text-gray-200 hover:bg-zinc-600'
                          : 'border-gray-300 hover:bg-gray-50'),
                      )}
                    >
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        {selectedAnswer ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="truncate">
                              <span className="font-semibold mr-1">{selectedAnswer}.</span>
                              {selectedLabel}
                            </span>
                          </>
                        ) : (
                          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>
                            Seleccionar respuesta…
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 flex-shrink-0 opacity-60 ml-2 transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border p-2 max-h-[280px] overflow-y-auto',
                        isDark ? 'bg-zinc-900/80 border-zinc-600' : 'bg-gray-50 border-gray-200',
                      )}
                    >
                      {options.map((option) => {
                        const label = stripHtmlToPlainText(option.text || '') || option.id;
                        const isSelected = selectedAnswer === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              onAnswerChange(qId, option.id);
                              setOpenRow(null);
                            }}
                            className={cn(
                              'w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors',
                              isSelected
                                ? isDark
                                  ? 'bg-purple-900/60 text-purple-100 font-medium'
                                  : 'bg-purple-100 text-purple-900 font-medium'
                                : isDark
                                ? 'hover:bg-zinc-700 text-gray-200'
                                : 'hover:bg-white text-gray-800',
                            )}
                          >
                            <span className="font-semibold mr-2">{option.id}.</span>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
