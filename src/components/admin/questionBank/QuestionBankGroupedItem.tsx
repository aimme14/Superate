import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Question } from '@/services/firebase/question.service'
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config'
import type { GroupEntry } from './questionBankUtils'
import QuestionBankItem from './QuestionBankItem'

interface QuestionBankGroupedItemProps {
  entry: GroupEntry
  theme: 'light' | 'dark'
  selectedQuestionIds: Set<string>
  onView: (q: Question) => void
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
  onToggleSelect: (id: string) => void
}

function QuestionBankGroupedItem({
  entry,
  theme,
  selectedQuestionIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: QuestionBankGroupedItemProps) {
  const { groupQuestions, firstQuestion, groupName, isClozeTest } = entry
  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'rounded-lg border-2 overflow-hidden',
        isDark ? 'border-purple-700 bg-purple-950/30' : 'border-purple-300 bg-purple-50/50'
      )}
    >
      <div
        className={cn(
          'px-4 py-2 flex items-center justify-between',
          isDark ? 'bg-purple-900/50' : 'bg-purple-100'
        )}
      >
        <div className="flex items-center gap-2">
          <BookOpen
            className={cn('h-4 w-4', isDark ? 'text-purple-300' : 'text-purple-600')}
            aria-hidden
          />
          <span
            className={cn('font-semibold text-sm', isDark ? 'text-purple-200' : 'text-purple-700')}
          >
            {groupName}
          </span>
          <Badge variant="outline" className="text-xs">
            {firstQuestion.topic} • {GRADE_CODE_TO_NAME[firstQuestion.grade]} • {firstQuestion.level}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(firstQuestion)}
          className="text-xs"
          aria-label="Ver todas las preguntas del grupo"
        >
          <Eye className="h-3 w-3 mr-1" />
          Ver todas
        </Button>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {groupQuestions.map((question) => (
          <QuestionBankItem
            key={question.id}
            question={question}
            theme={theme}
            isSelected={!!(question.id && selectedQuestionIds.has(question.id))}
            isInGroup
            isClozeTest={isClozeTest}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  )
}

export default memo(QuestionBankGroupedItem)
