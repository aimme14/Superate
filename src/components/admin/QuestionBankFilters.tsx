import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, X, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECTS_CONFIG, DIFFICULTY_LEVELS } from '@/utils/subjects.config'
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

const GRADE_CODE_TO_NAME: Record<string, string> = {
  '6': 'Sexto',
  '7': 'Séptimo',
  '8': 'Octavo',
  '9': 'Noveno',
  '0': 'Décimo',
  '1': 'Undécimo',
}

export default function QuestionBankFilters({
  theme,
  filterSubject,
  setFilterSubject,
  filterTopic,
  setFilterTopic,
  filterGrade,
  setFilterGrade,
  filterLevel,
  setFilterLevel,
  filterAIInconsistency,
  setFilterAIInconsistency,
  searchTerm,
  setSearchTerm,
  filterAvailableTopics,
  onRefresh,
  isLoading,
  filteredCount,
}: QuestionBankFiltersProps) {
  const isDark = theme === 'dark'
  const handleSubjectChange = (code: string) => {
    setFilterSubject(code)
    setFilterTopic('all')
  }
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
      <CardHeader>
        <CardTitle className={cn('flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar preguntas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn('pl-10', isDark ? 'bg-zinc-700 border-zinc-600 text-white' : '')}
            />
          </div>

          <Select value={filterSubject} onValueChange={handleSubjectChange}>
            <SelectTrigger className={cn(isDark ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
              <SelectValue placeholder="Todas las materias" />
            </SelectTrigger>
            <SelectContent className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
              <SelectItem value="all">Todas las materias</SelectItem>
              {SUBJECTS_CONFIG.map((subject) => (
                <SelectItem key={subject.code} value={subject.code}>
                  {subject.icon} {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTopic} onValueChange={setFilterTopic} disabled={filterSubject === 'all'}>
            <SelectTrigger className={cn(isDark ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
              <SelectValue placeholder="Todos los temas" />
            </SelectTrigger>
            <SelectContent className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
              <SelectItem value="all">Todos los temas</SelectItem>
              {filterAvailableTopics.map((topic) => (
                <SelectItem key={topic.code} value={topic.code}>
                  {topic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className={cn(isDark ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
              <SelectValue placeholder="Todos los grados" />
            </SelectTrigger>
            <SelectContent className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
              <SelectItem value="all">Todos los grados</SelectItem>
              {Object.entries(GRADE_CODE_TO_NAME).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className={cn(isDark ? 'bg-zinc-700 border-zinc-600 text-white' : '')}>
              <SelectValue placeholder="Todos los niveles" />
            </SelectTrigger>
            <SelectContent className={cn(isDark ? 'bg-zinc-800 border-zinc-700' : '')}>
              <SelectItem value="all">Todos los niveles</SelectItem>
              {DIFFICULTY_LEVELS.map((level) => (
                <SelectItem key={level.code} value={level.code}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-ai-inconsistency"
              checked={filterAIInconsistency}
              onCheckedChange={(checked) => setFilterAIInconsistency(checked === true)}
              className={cn(isDark ? 'border-zinc-600' : '')}
            />
            <Label
              htmlFor="filter-ai-inconsistency"
              className={cn(
                'text-sm cursor-pointer flex items-center gap-2',
                isDark ? 'text-gray-300' : 'text-gray-700'
              )}
            >
              <AlertCircle className={cn('h-4 w-4', filterAIInconsistency ? 'text-orange-500' : 'text-gray-400')} />
              Inconsistencias con IA
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
          <span className={cn('text-sm ml-auto', isDark ? 'text-gray-400' : 'text-gray-600')}>
            {filteredCount} pregunta{filteredCount !== 1 ? 's' : ''} encontrada{filteredCount !== 1 ? 's' : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
