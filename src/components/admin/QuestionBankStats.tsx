import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config'

export interface QuestionStats {
  total: number
  bySubject: Record<string, number>
  byLevel: Record<string, number>
  byGrade: Record<string, number>
}

interface QuestionBankStatsProps {
  stats: QuestionStats
  theme: 'light' | 'dark'
}

export default function QuestionBankStats({ stats, theme }: QuestionBankStatsProps) {
  const isDark = theme === 'dark'
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Total Preguntas
          </CardTitle>
          <FileText className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {stats.total}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Por Materia
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.bySubject).slice(0, 3).map(([subject, count]) => (
              <div key={subject} className="flex justify-between text-sm">
                <span className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>{subject}</span>
                <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Por Nivel
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.byLevel).map(([level, count]) => (
              <div key={level} className="flex justify-between text-sm">
                <span className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>{level}</span>
                <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Por Grado
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.byGrade).slice(0, 3).map(([grade, count]) => (
              <div key={grade} className="flex justify-between text-sm">
                <span className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {GRADE_CODE_TO_NAME[grade] || grade}
                </span>
                <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
