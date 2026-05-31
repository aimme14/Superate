import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Question } from '@/services/firebase/question.service';
import {
  buildClozeGapQuestionMap,
  clozeHtmlForInlineDisplay,
  parseClozeParts,
  stripHtmlToPlainText,
} from '@/utils/clozeTest';
import { Popover, PopoverContent, PopoverTrigger } from '#/ui/popover';
import { Button } from '#/ui/button';
import { cn } from '@/lib/utils';

interface ClozeTestInlineProps {
  clozeHtml: string;
  questions: Question[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, optionId: string) => void;
  sanitizeHtml: (html: string) => string;
  theme?: 'dark' | 'light';
  className?: string;
}

export function ClozeTestInline({
  clozeHtml,
  questions,
  answers,
  onAnswerChange,
  sanitizeHtml,
  theme = 'light',
  className,
}: ClozeTestInlineProps) {
  const isDark = theme === 'dark';
  const [openGap, setOpenGap] = useState<number | null>(null);

  const { parts, gapMap } = useMemo(() => ({
    parts: parseClozeParts(clozeHtmlForInlineDisplay(clozeHtml)),
    gapMap: buildClozeGapQuestionMap(questions),
  }), [clozeHtml, questions]);

  return (
    <div
      className={cn(
        'p-5 rounded-lg border leading-relaxed text-[15px]',
        isDark ? 'bg-blue-900/30 border-blue-700 text-gray-300' : 'bg-blue-50 border-blue-200 text-gray-800',
        className,
      )}
    >
      <p className={cn('text-sm font-semibold mb-4', isDark ? 'text-blue-300' : 'text-blue-800')}>
        Selecciona la palabra correcta en cada hueco del texto:
      </p>
      <div className="leading-[1.85] max-w-none">
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <span
                key={`text-${idx}`}
                className="inline"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(part.content) }}
              />
            );
          }

          const gapNum = part.gapNum;
          const question = gapMap.get(gapNum);
          const questionId = question ? (question.id || question.code) : '';
          const options = question?.options ?? [];
          const selectedAnswer = questionId ? (answers[questionId] ?? '') : '';
          const selectedOption = options.find((opt) => opt.id === selectedAnswer);
          const selectedLabel = selectedOption
            ? stripHtmlToPlainText(selectedOption.text || '') || selectedOption.id
            : '';

          return (
            <Popover
              key={`gap-${gapNum}`}
              open={openGap === gapNum}
              onOpenChange={(open) => setOpenGap(open ? gapNum : null)}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!questionId || options.length === 0}
                  className={cn(
                    'inline-flex h-auto min-h-[2rem] px-2.5 py-1 mx-0.5 my-0.5 align-baseline text-sm font-medium border-2 rounded-md shadow-sm max-w-[200px]',
                    selectedAnswer
                      ? isDark
                        ? 'bg-purple-900/50 border-purple-400 text-purple-100 hover:bg-purple-900/60'
                        : 'bg-purple-100 border-purple-500 text-purple-900 hover:bg-purple-200'
                      : isDark
                      ? 'bg-zinc-700 border-dashed border-blue-400 text-blue-200 hover:bg-zinc-600'
                      : 'bg-white border-dashed border-blue-400 text-blue-700 hover:bg-blue-50',
                  )}
                >
                  <span className="truncate">{selectedLabel || `[${gapNum}]`}</span>
                  <ChevronDown className="h-3.5 w-3.5 ml-1 flex-shrink-0 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className={cn('w-64 p-2', isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-white')}
              >
                <p className={cn('text-xs font-semibold mb-2 px-1', isDark ? 'text-zinc-400' : 'text-gray-500')}>
                  Hueco [{gapNum}]
                </p>
                <div className="flex flex-col gap-1">
                  {options.length > 0 ? (
                    options.map((option) => {
                      const label = stripHtmlToPlainText(option.text || '') || option.id;
                      const isSelected = selectedAnswer === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            if (questionId) onAnswerChange(questionId, option.id);
                            setOpenGap(null);
                          }}
                          className={cn(
                            'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                            isSelected
                              ? isDark
                                ? 'bg-purple-900/60 text-purple-100 font-medium'
                                : 'bg-purple-100 text-purple-900 font-medium'
                              : isDark
                              ? 'hover:bg-zinc-700 text-gray-200'
                              : 'hover:bg-gray-100 text-gray-800',
                          )}
                        >
                          <span className="font-semibold mr-2">{option.id}.</span>
                          {label}
                        </button>
                      );
                    })
                  ) : (
                    <p className={cn('text-xs px-2 py-1', isDark ? 'text-zinc-500' : 'text-gray-400')}>
                      Sin opciones para este hueco
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
