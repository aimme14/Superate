/**
 * Sección "Tips para Romperla en el ICFES".
 * Cada consejo va en un ítem de acordeón expandible (título en trigger, contenido al expandir).
 * Agrupado por categoría.
 */

import { useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TipICFES } from '@/interfaces/tipsICFES.interface';

export interface TipsICFESSectionProps {
  tips: TipICFES[];
  theme: 'light' | 'dark';
}

function groupByCategory(tips: TipICFES[]): Record<string, TipICFES[]> {
  const groups: Record<string, TipICFES[]> = {};
  for (const tip of tips) {
    const cat = tip.category?.trim() || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tip);
  }
  return groups;
}

export function TipsICFESSection({ tips, theme }: TipsICFESSectionProps) {
  const byCategory = useMemo(() => groupByCategory(tips), [tips]);
  const categories = Object.keys(byCategory).sort();

  const triggerClass = cn(
    'text-left py-3 px-4 hover:no-underline',
    theme === 'dark' ? 'text-zinc-200' : ''
  );
  const titleClass = cn('font-medium', theme === 'dark' ? 'text-zinc-200' : 'text-gray-900');
  const descClass = cn('text-sm', theme === 'dark' ? 'text-zinc-400' : 'text-gray-600');
  const metaClass = cn('text-xs', theme === 'dark' ? 'text-zinc-500' : 'text-gray-500');
  const badgeClass = theme === 'dark'
    ? 'bg-amber-400/15 text-amber-100/90 border border-amber-400/20'
    : 'bg-purple-100 text-purple-700';
  const itemBorderClass = theme === 'dark' ? 'border-zinc-600' : 'border-gray-200';

  if (tips.length === 0) return null;

  return (
    <section aria-labelledby="tips-icfes-heading" className="space-y-4">
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category}>
            <h3
              className={cn(
                'mb-2 text-sm font-medium',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}
            >
              {category}
            </h3>
            <Accordion type="multiple" className="space-y-1 w-full">
              {byCategory[category].map((tip) => {
                const id = tip.id || `tip-${(tip.title || '').slice(0, 30).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
                return (
                  <AccordionItem
                    key={id}
                    value={id}
                    className={cn('border rounded-lg overflow-hidden', itemBorderClass, theme === 'dark' ? 'bg-zinc-800/40' : 'bg-gray-50/80')}
                  >
                    <AccordionTrigger className={triggerClass}>
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <Badge className={badgeClass} variant="secondary">
                          {tip.category}
                        </Badge>
                        <span className={titleClass}>{tip.title}</span>
                        {tip.subject && tip.subject !== 'General' && (
                          <span className={metaClass}>· {tip.subject}</span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className={cn('px-4 pb-4 pt-0 space-y-3', theme === 'dark' ? 'text-zinc-400' : 'text-gray-700')}>
                        <p className={descClass}>{tip.description}</p>
                        {tip.example?.trim() && (
                          <p className={cn('text-sm', theme === 'dark' ? 'text-zinc-400' : 'text-gray-700')}>
                            <span className="font-medium text-zinc-300">Ejemplo: </span>
                            {tip.example}
                          </p>
                        )}
                        {tip.recommendation?.trim() && (
                          <p className={cn('text-sm', theme === 'dark' ? 'text-zinc-400' : 'text-gray-700')}>
                            <span className="font-medium text-zinc-300">Recomendación: </span>
                            {tip.recommendation}
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
      </div>
    </section>
  );
}
