import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, BarChart3, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config'

export interface QuestionStats {
  total: number
  bySubject: Record<string, number>
  byLevel: Record<string, number>
  byGrade: Record<string, number>
}

const INITIAL_VISIBLE = 3

interface QuestionBankStatsProps {
  stats: QuestionStats
  theme: 'light' | 'dark'
}

function ExpandableStatsSection({
  title,
  icon: Icon,
  iconColor,
  entries,
  formatLabel,
  theme,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  entries: [string, number][]
  formatLabel: (key: string) => string
  theme: 'light' | 'dark'
}) {
  const [expanded, setExpanded] = useState(false)
  const isDark = theme === 'dark'
  const hasMore = entries.length > INITIAL_VISIBLE
  const visibleEntries = expanded ? entries : entries.slice(0, INITIAL_VISIBLE)

  return (
    <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
          {title}
        </CardTitle>
        <Icon className={cn('h-4 w-4', iconColor)} aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {visibleEntries.map(([key, count]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>
                {formatLabel(key)}
              </span>
              <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                {count}
              </span>
            </div>
          ))}
        </div>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full mt-2 -mb-1 text-xs',
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            )}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ver más ({entries.length - INITIAL_VISIBLE} más)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function QuestionBankStats({ stats, theme }: QuestionBankStatsProps) {
  const isDark = theme === 'dark'
  const subjectEntries = Object.entries(stats.bySubject)
  const gradeEntries = Object.entries(stats.byGrade)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Total Preguntas
          </CardTitle>
          <FileText className="h-4 w-4 text-blue-500" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {stats.total}
          </div>
        </CardContent>
      </Card>

      <ExpandableStatsSection
        title="Por Materia"
        icon={BarChart3}
        iconColor="text-green-500"
        entries={subjectEntries}
        formatLabel={(key) => key}
        theme={theme}
      />

      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Por Nivel
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.byLevel).map(([level, count]) => (
              <div key={level} className="flex justify-between text-sm">
                <span className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>{level}</span>
                <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ExpandableStatsSection
        title="Por Grado"
        icon={CheckCircle2}
        iconColor="text-purple-500"
        entries={gradeEntries}
        formatLabel={(key) => GRADE_CODE_TO_NAME[key] || key}
        theme={theme}
      />
    </div>
  )
}
