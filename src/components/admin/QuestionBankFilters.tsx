import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Topic } from '@/utils/subjects.config'

interface QuestionBankFiltersProps {
  theme: 'light' | 'dark'
  filterSubject: string
  setFilterSubject: (v: string) => void
  filterTopic: string
  setFilterTopic: (v: string) => void
  filterGrade: string
  setFilterGrade: (v: string) => void
  filterLevel: string
  setFilterLevel: (v: string) => void
  filterAIInconsistency: boolean
  setFilterAIInconsistency: (v: boolean) => void
  searchTerm: string
  setSearchTerm: (v: string) => void
  filterAvailableTopics: Topic[]
  onRefresh: () => void
  isLoading: boolean
  filteredCount: number
}

export default function QuestionBankFilters({
  theme,
  setFilterSubject,
  setFilterTopic,
  setFilterGrade,
  setFilterLevel,
  setFilterAIInconsistency,
  searchTerm,
  setSearchTerm,
  onRefresh,
  isLoading,
  filteredCount,
}: QuestionBankFiltersProps) {
  const isDark = theme === 'dark'
  const handleClearFilters = () => {
    setFilterSubject('all')
    setFilterTopic('all')
    setFilterGrade('all')
    setFilterLevel('all')
    setFilterAIInconsistency(false)
    setSearchTerm('')
  }
  return (
    <Card className={cn(isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardContent className="p-3 md:p-4">
        <div className="flex flex-col gap-3 md:gap-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código, enunciado, materia o tema..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'pl-10 h-9',
                  isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500' : ''
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClearFilters} className="h-9 px-3">
                <X className="h-4 w-4 mr-1.5" />
                Limpiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-9 px-3"
              >
                <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
                Refrescar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <span className={cn('text-xs md:text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {filteredCount} pregunta{filteredCount !== 1 ? 's' : ''} encontrada{filteredCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
