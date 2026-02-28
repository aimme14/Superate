import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Question } from '@/services/firebase/question.service'
import type { CombinedItem } from './questionBankUtils'
import QuestionBankGroupedItem from './QuestionBankGroupedItem'
import QuestionBankItem from './QuestionBankItem'

const LIST_HEIGHT = 600
const ESTIMATE_QUESTION = 140
const ESTIMATE_GROUP_HEADER = 56
const ESTIMATE_QUESTION_IN_GROUP = 95

function estimateItemSize(index: number, items: CombinedItem[]): number {
  const item = items[index]
  if (item.type === 'group') {
    return ESTIMATE_GROUP_HEADER + item.groupQuestions.length * ESTIMATE_QUESTION_IN_GROUP
  }
  return ESTIMATE_QUESTION
}

interface QuestionBankListProps {
  combinedItems: CombinedItem[]
  theme: 'light' | 'dark'
  selectedQuestionIds: Set<string>
  onView: (q: Question) => void
  onCreateFirst: () => void
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
  onToggleSelect: (id: string) => void
  hasQuestions: boolean
}

export default function QuestionBankList({
  combinedItems,
  theme,
  selectedQuestionIds,
  onView,
  onCreateFirst,
  onEdit,
  onDelete,
  onToggleSelect,
  hasQuestions,
}: QuestionBankListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'

  const virtualizer = useVirtualizer({
    count: combinedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateItemSize(index, combinedItems),
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()

  if (combinedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText
          className={cn('h-12 w-12 mx-auto mb-4', isDark ? 'text-gray-500' : 'text-gray-400')}
          aria-hidden
        />
        <h3
          className={cn(
            'text-lg font-medium mb-2',
            isDark ? 'text-white' : 'text-gray-900'
          )}
        >
          No se encontraron preguntas
        </h3>
        <p
          className={cn(
            'text-sm mb-4',
            isDark ? 'text-gray-400' : 'text-gray-500'
          )}
        >
          {!hasQuestions
            ? 'Comienza creando tu primera pregunta'
            : 'Intenta cambiar los filtros de búsqueda'}
        </p>
        {!hasQuestions && (
          <Button
            onClick={onCreateFirst}
            className="bg-black text-white hover:bg-gray-800"
          >
            Crear Primera Pregunta
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: LIST_HEIGHT }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = combinedItems[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="pb-4 last:pb-0"
              >
                {item.type === 'group' ? (
                  <QuestionBankGroupedItem
                    entry={item}
                    theme={theme}
                    selectedQuestionIds={selectedQuestionIds}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleSelect={onToggleSelect}
                  />
                ) : (
                  <QuestionBankItem
                    question={item.question}
                    theme={theme}
                    isSelected={!!(item.question.id && selectedQuestionIds.has(item.question.id))}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleSelect={onToggleSelect}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
