import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Eye, Edit, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Question } from '@/services/firebase/question.service'
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config'
import { stripHtmlTags, hasAIIssues } from './questionBankUtils'

interface QuestionBankItemProps {
  question: Question
  theme: 'light' | 'dark'
  isSelected: boolean
  isInGroup?: boolean
  isClozeTest?: boolean
  onView: (q: Question) => void
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
  onToggleSelect: (id: string) => void
}

function QuestionBankItem({
  question,
  theme,
  isSelected,
  isInGroup = false,
  isClozeTest = false,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: QuestionBankItemProps) {
  const isDark = theme === 'dark'
  const previewLength = isInGroup ? 100 : 120

  return (
    <div
      className={cn(
        'cursor-pointer transition-colors',
        isInGroup ? 'p-4' : 'p-4 rounded-lg border',
        isDark
          ? isSelected
            ? 'border-blue-500 bg-blue-950/20 hover:bg-blue-950/30'
            : isInGroup
              ? 'hover:bg-zinc-800 border-l-2 border-transparent'
              : 'border-zinc-700 hover:bg-zinc-800'
          : isSelected
            ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
            : isInGroup
              ? 'hover:bg-gray-50 border-l-2 border-transparent'
              : 'border-gray-200 hover:bg-gray-50',
        isInGroup && isSelected && 'border-l-2 border-blue-500'
      )}
      onClick={() => onView(question)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onView(question)
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div onClick={(e) => e.stopPropagation()} className="mt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => question.id && onToggleSelect(question.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={isSelected ? 'Deseleccionar pregunta' : 'Seleccionar pregunta'}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs">
                {question.code}
              </Badge>
              {isClozeTest && question.questionText?.match(/hueco \[(\d+)\]/) && (
                <Badge variant="secondary" className="text-xs">
                  Pregunta {question.questionText.match(/hueco \[(\d+)\]/)?.[1]}
                </Badge>
              )}
              {!isInGroup && (
                <>
                  <Badge variant="secondary">{question.subject}</Badge>
                  <Badge variant="secondary">{question.topic}</Badge>
                  <Badge variant="secondary">{GRADE_CODE_TO_NAME[question.grade]}</Badge>
                  <Badge
                    variant={
                      question.level === 'Fácil'
                        ? 'default'
                        : question.level === 'Medio'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {question.level}
                  </Badge>
                </>
              )}
              {isInGroup && (
                <Badge variant="secondary">{question.options.length} opciones</Badge>
              )}
              <span className="text-xs text-gray-500">
                {new Date(question.createdAt).toLocaleDateString('es-ES')}
              </span>
            </div>
            <p
              className={cn(
                isInGroup ? 'text-sm mb-1' : 'font-medium mb-1',
                isDark ? (isInGroup ? 'text-gray-300' : 'text-white') : 'text-gray-900'
              )}
            >
              {stripHtmlTags(question.questionText || '').substring(0, previewLength)}
              {stripHtmlTags(question.questionText || '').length > previewLength && '...'}
            </p>
            {!isInGroup && (
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{question.options.length} opciones</span>
                {question.questionImages && question.questionImages.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {question.questionImages.length} imagen
                    {question.questionImages.length > 1 ? 'es' : ''}
                  </span>
                )}
                {question.informativeImages && question.informativeImages.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {question.informativeImages.length} info
                  </span>
                )}
                {question.options.some((opt) => opt.imageUrl) && (
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    opciones con imagen
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onView(question)
              }}
              aria-label="Ver pregunta"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {hasAIIssues(question) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'flex items-center justify-center h-6 w-6 rounded-full',
                        isDark ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'
                      )}
                      role="img"
                      aria-label="La justificación de IA tiene problemas de calidad"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>La justificación de IA tiene problemas de calidad</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(question)
            }}
            aria-label="Editar pregunta"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(question)
            }}
            aria-label="Eliminar pregunta"
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(QuestionBankItem)
