import { useState, useMemo } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { 
  Building, 
  Users, 
  TrendingUp, 
  BookOpen,
  BarChart3,
  Target,
  Loader2,
  AlertCircle,
  Trophy,
  Shield,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminAnalysis, useStudentAnalysis, useStudentsRanking } from '@/hooks/query/useAdminAnalysis'
import { useFilteredStudents } from '@/hooks/query/useStudentQuery'
import { useAdminStats } from '@/hooks/query/useAdminStats'
import { useInstitutions } from '@/hooks/query/useInstitutionQuery'
import { useAllGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useGradeAnalysis } from '@/hooks/query/useGradeAnalysis'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'

interface AdminAnalysisProps extends ThemeContextProps {}

export default function AdminAnalysis({ theme }: AdminAnalysisProps) {
  const currentYear = new Date().getFullYear()
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('global')
  const [filterInstitution, setFilterInstitution] = useState<string>('all')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterPhase, setFilterPhase] = useState<string>('all')
  const [filterJornada, setFilterJornada] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<number>(currentYear)

  const { data: analysis, isLoading, error } = useAdminAnalysis(
    filterJornada !== 'all' ? filterJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterYear
  )
  const { totalCompletedExams } = useAdminStats()
  const { data: institutions } = useInstitutions()
  const { options: gradeOptions } = useAllGradeOptions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className={cn("ml-3", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Cargando análisis...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mr-3" />
            <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Error al cargar el análisis: {error instanceof Error ? error.message : 'Error desconocido'}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis || analysis.length === 0) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <BarChart3 className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <h3 className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              No hay datos disponibles
            </h3>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No se encontraron instituciones con datos de exámenes para analizar
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular estadísticas globales
  const globalStats = {
    totalInstitutions: analysis.length,
    totalStudents: analysis.reduce((sum, inst) => sum + inst.totalStudents, 0),
    totalExams: analysis.reduce((sum, inst) => sum + inst.totalExams, 0),
    averageScore: analysis.length > 0
      ? analysis.reduce((sum, inst) => sum + inst.averageScore, 0) / analysis.length
      : 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Análisis del Sistema
          </h2>
          <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Evaluación del desempeño académico por instituciones, estudiantes, materias y fases
          </p>
        </div>
      </div>

      {/* Estadísticas globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Instituciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {globalStats.totalInstitutions}
            </div>
            <div className="flex items-center mt-1">
              <Building className="h-4 w-4 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {globalStats.totalStudents.toLocaleString()}
            </div>
            <div className="flex items-center mt-1">
              <Users className="h-4 w-4 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Exámenes Presentados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {totalCompletedExams.toLocaleString()}
            </div>
            <div className="flex items-center mt-1">
              <BookOpen className="h-4 w-4 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              Promedio Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {globalStats.averageScore.toFixed(1)}%
            </div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de análisis */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full grid-cols-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <TabsTrigger value="global" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <Building className="h-4 w-4" />
            <span>Instituciones</span>
          </TabsTrigger>
          <TabsTrigger value="students" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <Users className="h-4 w-4" />
            <span>Estudiantes</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <BookOpen className="h-4 w-4" />
            <span>Materias</span>
          </TabsTrigger>
          <TabsTrigger value="phases" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <Target className="h-4 w-4" />
            <span>Fases</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Análisis Global por Instituciones */}
        <TabsContent value="global" className="space-y-6 mt-6">
          <GlobalAnalysisTab 
            analysis={analysis} 
            theme={theme} 
            institutions={institutions || []}
            gradeOptions={gradeOptions}
            filterInstitution={filterInstitution}
            setFilterInstitution={setFilterInstitution}
            filterGrade={filterGrade}
            setFilterGrade={setFilterGrade}
            filterPhase={filterPhase}
            setFilterPhase={setFilterPhase}
            filterJornada={filterJornada}
            setFilterJornada={setFilterJornada}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            currentYear={currentYear}
          />
        </TabsContent>

        {/* Tab: Análisis por Estudiantes */}
        <TabsContent value="students" className="space-y-6 mt-6">
          <StudentsAnalysisTab 
            theme={theme} 
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
          />
        </TabsContent>

        {/* Tab: Análisis por Materias */}
        <TabsContent value="subjects" className="space-y-6 mt-6">
          <SubjectsAnalysisTab analysis={analysis} theme={theme} />
        </TabsContent>

        {/* Tab: Análisis por Fases */}
        <TabsContent value="phases" className="space-y-6 mt-6">
          <PhasesAnalysisTab analysis={analysis} theme={theme} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente: Análisis Global
function GlobalAnalysisTab({ 
  analysis, 
  theme, 
  institutions,
  gradeOptions,
  filterInstitution,
  setFilterInstitution,
  filterGrade,
  setFilterGrade,
  filterPhase,
  setFilterPhase,
  filterJornada,
  setFilterJornada,
  filterYear,
  setFilterYear,
  currentYear
}: { 
  analysis: any[]
  theme: 'light' | 'dark'
  institutions: any[]
  gradeOptions: any[]
  filterInstitution: string
  setFilterInstitution: (value: string) => void
  filterGrade: string
  setFilterGrade: (value: string) => void
  filterPhase: string
  setFilterPhase: (value: string) => void
  filterJornada: string
  setFilterJornada: (value: string) => void
  filterYear: number
  setFilterYear: (value: number) => void
  currentYear: number
}) {
  // Estados para filtros del ranking (independientes)
  const [filterRankingGrade, setFilterRankingGrade] = useState<string>('all')
  const [filterRankingJornada, setFilterRankingJornada] = useState<string>('all')
  const [filterRankingYear, setFilterRankingYear] = useState<number>(currentYear)
  
  // Estados para filtros del ranking de estudiantes
  const [filterStudentRankingJornada, setFilterStudentRankingJornada] = useState<string>('all')
  const [filterStudentRankingYear, setFilterStudentRankingYear] = useState<number>(currentYear)

  // Obtener datos por grado si se selecciona un grado específico (para el gráfico)
  const { data: gradeAnalysis, isLoading: isLoadingGradeAnalysis } = useGradeAnalysis(
    filterGrade !== 'all' ? filterGrade : '',
    filterGrade !== 'all',
    filterJornada !== 'all' ? filterJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterYear
  )

  // Obtener datos para el ranking (con sus propios filtros)
  const { data: rankingAnalysis } = useAdminAnalysis(
    filterRankingJornada !== 'all' ? filterRankingJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterRankingYear
  )
  
  const { data: rankingGradeAnalysis, isLoading: isLoadingRankingGradeAnalysis } = useGradeAnalysis(
    filterRankingGrade !== 'all' ? filterRankingGrade : '',
    filterRankingGrade !== 'all',
    filterRankingJornada !== 'all' ? filterRankingJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterRankingYear
  )
  
  // Obtener datos del ranking de estudiantes
  const { data: studentsRanking, isLoading: isLoadingStudentsRanking } = useStudentsRanking(
    filterStudentRankingJornada !== 'all' ? filterStudentRankingJornada as 'mañana' | 'tarde' | 'única' : undefined,
    filterStudentRankingYear
  )

  // Crear un mapa de análisis por institución para búsqueda rápida
  const analysisMap = useMemo(() => {
    const map = new Map<string, any>()
    analysis.forEach(inst => {
      map.set(inst.institutionId, inst)
    })
    return map
  }, [analysis])

  // Filtrar análisis por institución, incluyendo todas las instituciones incluso sin datos
  const filteredAnalysis = useMemo(() => {
    if (filterInstitution !== 'all') {
      // Si hay filtro de institución, solo mostrar esa
      const instData = analysisMap.get(filterInstitution)
      return instData ? [instData] : []
    }
    
    // Si no hay filtro, combinar todas las instituciones con sus datos (o vacíos)
    return institutions.map(inst => {
      const instData = analysisMap.get(inst.id)
      if (instData) return instData
      
      // Institución sin datos
      return {
        institutionId: inst.id,
        institutionName: inst.name || 'Sin nombre',
        totalStudents: 0,
        totalExams: 0,
        averageScore: 0,
        phaseStats: {
          phase1: { count: 0, average: 0 },
          phase2: { count: 0, average: 0 },
          phase3: { count: 0, average: 0 },
        },
        subjectStats: {},
        gradeStats: {},
      }
    })
  }, [analysis, filterInstitution, institutions, analysisMap])

  // Preparar datos para gráfico apilado por fases
  const stackedData = useMemo(() => {
    // Si hay un filtro de grado activo, usar los datos del análisis por grado
    if (filterGrade !== 'all' && gradeAnalysis) {
      // Crear mapa de análisis por grado
      const gradeAnalysisMap = new Map<string, any>()
      gradeAnalysis.forEach(inst => {
        gradeAnalysisMap.set(inst.institutionId, inst)
      })
      
      // Obtener todas las instituciones que tienen el grado seleccionado
      const institutionsWithGrade = institutions.filter(inst => {
        return inst.campuses?.some((campus: any) => 
          campus.grades?.some((g: any) => g.name === filterGrade)
        )
      })
      
      // Combinar instituciones con sus datos (o vacíos si no tienen datos)
      let filtered = institutionsWithGrade.map(inst => {
        const instData = gradeAnalysisMap.get(inst.id)
        if (instData) return instData
        
        // Institución sin datos para este grado
        return {
          institutionId: inst.id,
          institutionName: inst.name || 'Sin nombre',
          gradeName: filterGrade,
          totalStudents: 0,
          totalExams: 0,
          averageScore: 0,
          phaseStats: {
            phase1: { count: 0, average: 0 },
            phase2: { count: 0, average: 0 },
            phase3: { count: 0, average: 0 },
          },
        }
      })
      
      // Aplicar filtro de institución si está activo
      if (filterInstitution !== 'all') {
        filtered = filtered.filter(inst => inst.institutionId === filterInstitution)
      }

      return filtered
        .map((inst) => {
          const data: any = {
            name: inst.institutionName.length > 20 
              ? inst.institutionName.substring(0, 20) + '...' 
              : inst.institutionName,
            fullName: inst.institutionName,
          }
          
          // Aplicar filtro de fase
          if (filterPhase === 'all' || filterPhase === 'Fase I') {
            data['Fase I'] = inst.phaseStats.phase1.average > 0 ? parseFloat(inst.phaseStats.phase1.average.toFixed(1)) : 0
          } else {
            data['Fase I'] = 0
          }
          if (filterPhase === 'all' || filterPhase === 'Fase II') {
            data['Fase II'] = inst.phaseStats.phase2.average > 0 ? parseFloat(inst.phaseStats.phase2.average.toFixed(1)) : 0
          } else {
            data['Fase II'] = 0
          }
          if (filterPhase === 'all' || filterPhase === 'Fase III') {
            data['Fase III'] = inst.phaseStats.phase3.average > 0 ? parseFloat(inst.phaseStats.phase3.average.toFixed(1)) : 0
          } else {
            data['Fase III'] = 0
          }
          
          return data
        })
        .sort((a, b) => {
          const totalA = a['Fase I'] + a['Fase II'] + a['Fase III']
          const totalB = b['Fase I'] + b['Fase II'] + b['Fase III']
          return totalB - totalA
        })
    }

    // Si no hay filtro de grado, usar datos generales
    return filteredAnalysis
      .map((inst) => {
        const data: any = {
          name: inst.institutionName.length > 20 
            ? inst.institutionName.substring(0, 20) + '...' 
            : inst.institutionName,
          fullName: inst.institutionName,
        }
        
        // Aplicar filtro de fase
        if (filterPhase === 'all' || filterPhase === 'Fase I') {
          data['Fase I'] = inst.phaseStats.phase1.average > 0 ? parseFloat(inst.phaseStats.phase1.average.toFixed(1)) : 0
        } else {
          data['Fase I'] = 0
        }
        if (filterPhase === 'all' || filterPhase === 'Fase II') {
          data['Fase II'] = inst.phaseStats.phase2.average > 0 ? parseFloat(inst.phaseStats.phase2.average.toFixed(1)) : 0
        } else {
          data['Fase II'] = 0
        }
        if (filterPhase === 'all' || filterPhase === 'Fase III') {
          data['Fase III'] = inst.phaseStats.phase3.average > 0 ? parseFloat(inst.phaseStats.phase3.average.toFixed(1)) : 0
        } else {
          data['Fase III'] = 0
        }
        
        return data
      })
      .sort((a, b) => {
        const totalA = a['Fase I'] + a['Fase II'] + a['Fase III']
        const totalB = b['Fase I'] + b['Fase II'] + b['Fase III']
        return totalB - totalA
      })
  }, [filteredAnalysis, filterGrade, gradeAnalysis, filterInstitution, filterPhase])

  // Configuración del gráfico
  const chartConfig = {
    'Fase I': {
      label: 'Fase I',
      color: theme === 'dark' ? 'hsl(217, 91%, 60%)' : 'hsl(217, 91%, 50%)', // Azul
    },
    'Fase II': {
      label: 'Fase II',
      color: theme === 'dark' ? 'hsl(271, 91%, 65%)' : 'hsl(271, 91%, 55%)', // Púrpura
    },
    'Fase III': {
      label: 'Fase III',
      color: theme === 'dark' ? 'hsl(142, 76%, 56%)' : 'hsl(142, 76%, 46%)', // Verde
    },
  } satisfies ChartConfig

  // Obtener todos los grados únicos disponibles
  const uniqueGrades = useMemo(() => {
    const gradeSet = new Set<string>()
    gradeOptions.forEach(grade => {
      if (grade.label) {
        gradeSet.add(grade.label)
      }
    })
    return Array.from(gradeSet).sort()
  }, [gradeOptions])



  // Datos para el ranking: usar datos filtrados según filtros del ranking
  const rankingData = useMemo(() => {
    // Si hay un filtro de grado activo en el ranking, usar los datos del análisis por grado
    if (filterRankingGrade !== 'all' && rankingGradeAnalysis) {
      return rankingGradeAnalysis
    }
    
    // Si no hay filtro de grado, usar datos generales
    return rankingAnalysis || []
  }, [rankingAnalysis, filterRankingGrade, rankingGradeAnalysis])

  return (
    <div className="space-y-6">
      {/* Gráfico de barras apiladas: Promedio por institución y fases */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Rendimiento Promedio por Institución
              </CardTitle>
              <CardDescription>
                Comparación del rendimiento por fases evaluativas (Fase I, II y III)
              </CardDescription>
            </div>
            <div className="ml-4 flex gap-2">
              <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                <SelectTrigger className={cn("w-[180px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Todas las instituciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las instituciones</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger className={cn("w-[180px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Todos los grados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grados</SelectItem>
                  {uniqueGrades.map((gradeName) => (
                    <SelectItem key={gradeName} value={gradeName}>
                      {gradeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className={cn("w-[150px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Todas las fases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fases</SelectItem>
                  <SelectItem value="Fase I">Fase I</SelectItem>
                  <SelectItem value="Fase II">Fase II</SelectItem>
                  <SelectItem value="Fase III">Fase III</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterJornada} onValueChange={setFilterJornada}>
                <SelectTrigger className={cn("w-[150px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Todas las jornadas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las jornadas</SelectItem>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="única">Única</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterYear.toString()} onValueChange={(value) => setFilterYear(parseInt(value))}>
                <SelectTrigger className={cn("w-[140px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGradeAnalysis && filterGrade !== 'all' ? (
            <div className={cn("flex items-center justify-center h-[400px]", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p>Cargando datos del grado {filterGrade}...</p>
              </div>
            </div>
          ) : stackedData.length === 0 ? (
            <div className={cn("flex items-center justify-center h-[400px]", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos disponibles para mostrar el gráfico</p>
                {filterGrade !== 'all' && (
                  <p className="text-sm mt-2">No se encontraron datos para el grado {filterGrade}</p>
                )}
              </div>
            </div>
          ) : (
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stackedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#e5e7eb'} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 500]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    ticks={[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]}
                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className={cn(
                            "rounded-lg border p-3 shadow-lg",
                            theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
                          )}>
                            <p className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {label}
                            </p>
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                                  {entry.name}:
                                </span>
                                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend />
                  {(filterPhase === 'all' || filterPhase === 'Fase I') && (
                    <Bar
                      dataKey="Fase I"
                      fill={chartConfig['Fase I'].color}
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {(filterPhase === 'all' || filterPhase === 'Fase II') && (
                    <Bar
                      dataKey="Fase II"
                      fill={chartConfig['Fase II'].color}
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {(filterPhase === 'all' || filterPhase === 'Fase III') && (
                    <Bar
                      dataKey="Fase III"
                      fill={chartConfig['Fase III'].color}
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Estudiantes */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Ranking de Estudiantes
                </CardTitle>
                <CardDescription>
                  Mejor estudiante por institución (basado en Fase III)
                </CardDescription>
              </div>
              <div className="ml-4 flex gap-2">
                <Select value={filterStudentRankingJornada} onValueChange={setFilterStudentRankingJornada}>
                  <SelectTrigger className={cn("w-[150px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Todas las jornadas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las jornadas</SelectItem>
                    <SelectItem value="mañana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="única">Única</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStudentRankingYear.toString()} onValueChange={(value) => setFilterStudentRankingYear(parseInt(value))}>
                  <SelectTrigger className={cn("w-[140px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {isLoadingStudentsRanking ? (
                <div className={cn("flex items-center justify-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                    <p>Cargando datos del ranking...</p>
                  </div>
                </div>
              ) : !studentsRanking || studentsRanking.length === 0 ? (
                <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay datos disponibles para el ranking
                </p>
              ) : (
                studentsRanking.map((student, index) => (
                  <div
                    key={student.studentId}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Badge variant="outline" className={cn(
                        theme === 'dark' ? 'border-zinc-600' : ''
                      )}>
                        #{index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {student.studentName}
                        </p>
                        <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {student.institutionName} · {student.totalExams} {student.totalExams === 1 ? 'examen' : 'exámenes'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {Math.round(student.score)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabla de instituciones */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Ranking de Instituciones
                </CardTitle>
                <CardDescription>
                  Ordenadas por puntaje de Fase III
                </CardDescription>
              </div>
              <div className="ml-4 flex gap-2">
                <Select value={filterRankingGrade} onValueChange={setFilterRankingGrade}>
                  <SelectTrigger className={cn("w-[180px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Todos los grados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grados</SelectItem>
                    {uniqueGrades.map((gradeName) => (
                      <SelectItem key={gradeName} value={gradeName}>
                        {gradeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRankingJornada} onValueChange={setFilterRankingJornada}>
                  <SelectTrigger className={cn("w-[150px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Todas las jornadas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las jornadas</SelectItem>
                    <SelectItem value="mañana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="única">Única</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRankingYear.toString()} onValueChange={(value) => setFilterRankingYear(parseInt(value))}>
                  <SelectTrigger className={cn("w-[140px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {isLoadingRankingGradeAnalysis && filterRankingGrade !== 'all' ? (
                <div className={cn("flex items-center justify-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                    <p>Cargando datos del ranking...</p>
                  </div>
                </div>
              ) : rankingData.length === 0 ? (
                <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No hay datos disponibles para el ranking
                </p>
              ) : (
                rankingData
                  .sort((a, b) => {
                    const phase3A = a.phaseStats?.phase3?.average || 0
                    const phase3B = b.phaseStats?.phase3?.average || 0
                    return phase3B - phase3A
                  })
                  .map((inst, index) => {
                    const phase3Score = inst.phaseStats?.phase3?.average || 0
                    const phase3Exams = inst.phaseStats?.phase3?.count || 0
                    return (
                      <div
                        key={inst.institutionId}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn(
                            theme === 'dark' ? 'border-zinc-600' : ''
                          )}>
                            #{index + 1}
                          </Badge>
                          <div>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {inst.institutionName}
                            </p>
                            <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {inst.totalStudents} estudiantes · {phase3Exams} exámenes
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {Math.round(phase3Score)}
                          </p>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Componente: Análisis por Estudiantes
function StudentsAnalysisTab({ 
  theme, 
  selectedStudent,
  setSelectedStudent
}: { 
  theme: 'light' | 'dark'
  selectedStudent: string | null
  setSelectedStudent: (id: string | null) => void
}) {
  const { data: institutions } = useInstitutions()

  // Función helper para obtener el año del estudiante
  const getStudentYear = (student: any): number | null => {
    if (student.academicYear) {
      return student.academicYear
    }
    if (student.createdAt) {
      let date: Date
      if (typeof student.createdAt === 'string') {
        date = new Date(student.createdAt)
      } else if (student.createdAt?.toDate) {
        date = student.createdAt.toDate()
      } else if (student.createdAt?.seconds) {
        date = new Date(student.createdAt.seconds * 1000)
      } else {
        return null
      }
      return date.getFullYear()
    }
    return null
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Análisis por Estudiante
          </CardTitle>
          <CardDescription>
            Expande las instituciones, años, sedes y grados para ver el análisis detallado de los estudiantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!institutions || institutions.length === 0 ? (
            <div className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              <p>No hay instituciones disponibles</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {institutions.map((institution) => {
                // Obtener estudiantes de esta institución
                const { students: institutionStudents } = useFilteredStudents({
                  institutionId: institution.id,
                  isActive: true
                })

                // Agrupar estudiantes por año académico
                const studentsByYear = useMemo(() => {
                  const grouped: { [year: number]: any[] } = {}
                  institutionStudents?.forEach((student: any) => {
                    const year = getStudentYear(student)
                    if (year) {
                      if (!grouped[year]) {
                        grouped[year] = []
                      }
                      grouped[year].push(student)
                    }
                  })
                  return grouped
                }, [institutionStudents])

                const years = Object.keys(studentsByYear).map(Number).sort((a, b) => b - a)
                const totalCampuses = institution.campuses?.length || 0
                const totalGrades = institution.campuses?.reduce((sum: number, campus: any) => 
                  sum + (campus.grades?.length || 0), 0
                ) || 0
                
                return (
                  <AccordionItem 
                    key={institution.id} 
                    value={institution.id}
                    className={cn(
                      "border rounded-lg mb-2 px-4",
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-white'
                    )}
                  >
                    <AccordionTrigger className={cn(
                      "hover:no-underline",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5" />
                          <span className="font-medium">{institution.name}</span>
                        </div>
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          ({totalGrades} {totalGrades === 1 ? 'grado' : 'grados'}, {totalCampuses} {totalCampuses === 1 ? 'sede' : 'sedes'})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 pb-4 pl-8">
                        <Accordion type="multiple" className="w-full">
                          {years.map((year) => {
                            const yearStudents = studentsByYear[year] || []
                            // Agrupar estudiantes del año por sede y grado
                            const studentsByCampusAndGrade: { [campusId: string]: { [gradeId: string]: any[] } } = {}
                            
                            yearStudents.forEach((student: any) => {
                              const campusId = student.campus || student.campusId
                              const gradeId = student.grade || student.gradeId
                              if (campusId && gradeId) {
                                if (!studentsByCampusAndGrade[campusId]) {
                                  studentsByCampusAndGrade[campusId] = {}
                                }
                                if (!studentsByCampusAndGrade[campusId][gradeId]) {
                                  studentsByCampusAndGrade[campusId][gradeId] = []
                                }
                                studentsByCampusAndGrade[campusId][gradeId].push(student)
                              }
                            })

                            // Obtener sedes que tienen estudiantes de este año
                            const campusesWithStudents = institution.campuses?.filter((campus: any) => 
                              studentsByCampusAndGrade[campus.id]
                            ) || []

                            return (
                              <AccordionItem
                                key={`${institution.id}-year-${year}`}
                                value={`${institution.id}-year-${year}`}
                                className={cn(
                                  "border rounded-lg mb-2 px-4",
                                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800/40' : 'border-gray-200 bg-gray-50/80'
                                )}
                              >
                                <AccordionTrigger className={cn(
                                  "hover:no-underline",
                                  theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                                )}>
                                  <div className="flex items-center justify-between w-full pr-4">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium">Año {year}</span>
                                    </div>
                                    <span className={cn(
                                      "text-sm",
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    )}>
                                      ({yearStudents.length} {yearStudents.length === 1 ? 'estudiante' : 'estudiantes'})
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="pt-2 pb-4 pl-8">
                                    <Accordion type="multiple" className="w-full">
                                      {campusesWithStudents.map((campus: any) => {
                                        const campusStudentsByGrade = studentsByCampusAndGrade[campus.id] || {}
                                        const gradesWithStudents = campus.grades?.filter((grade: any) => 
                                          campusStudentsByGrade[grade.id]
                                        ) || []

                                        return (
                                          <AccordionItem
                                            key={`${institution.id}-${year}-${campus.id}`}
                                            value={`${institution.id}-${year}-${campus.id}`}
                                            className={cn(
                                              "border rounded-lg mb-2 px-4",
                                              theme === 'dark' ? 'border-zinc-700 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'
                                            )}
                                          >
                                            <AccordionTrigger className={cn(
                                              "hover:no-underline",
                                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                            )}>
                                              <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-3">
                                                  <Building className="h-4 w-4" />
                                                  <span className="font-medium">{campus.name}</span>
                                                </div>
                                                <span className={cn(
                                                  "text-sm",
                                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                                )}>
                                                  ({gradesWithStudents.length} {gradesWithStudents.length === 1 ? 'grado' : 'grados'})
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                              <div className="pt-2 pb-4 pl-8">
                                                <Accordion type="multiple" className="w-full">
                                                  {gradesWithStudents.map((grade: any) => {
                                                    return (
                                                      <AccordionItem
                                                        key={`${institution.id}-${year}-${campus.id}-${grade.id}`}
                                                        value={`${institution.id}-${year}-${campus.id}-${grade.id}`}
                                                        className={cn(
                                                          "border rounded-lg mb-2 px-4",
                                                          theme === 'dark' ? 'border-zinc-700 bg-zinc-800/20' : 'border-gray-200 bg-gray-50/50'
                                                        )}
                                                      >
                                                        <AccordionTrigger className={cn(
                                                          "hover:no-underline",
                                                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                        )}>
                                                          <span className="font-medium">{grade.name}</span>
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                          <div className="pt-2 pb-4">
                                                            <StudentList 
                                                              institutionId={institution.id}
                                                              campusId={campus.id}
                                                              gradeId={grade.id}
                                                              institutionName={institution.name}
                                                              campusName={campus.name}
                                                              theme={theme}
                                                              selectedStudent={selectedStudent}
                                                              setSelectedStudent={setSelectedStudent}
                                                              year={year}
                                                            />
                                                          </div>
                                                        </AccordionContent>
                                                      </AccordionItem>
                                                    )
                                                  })}
                                                </Accordion>
                                              </div>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )
                                      })}
                                    </Accordion>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )
                          })}
                        </Accordion>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Detalle del estudiante seleccionado */}
      {selectedStudent && (
        <StudentDetail 
          studentId={selectedStudent}
          theme={theme}
        />
      )}
    </div>
  )
}

// Componente: Lista de estudiantes
function StudentList({ 
  institutionId, 
  campusId,
  gradeId,
  institutionName, 
  campusName,
  theme,
  selectedStudent,
  setSelectedStudent,
  year
}: { 
  institutionId?: string
  campusId?: string
  gradeId?: string
  institutionName?: string
  campusName?: string
  theme: 'light' | 'dark'
  selectedStudent: string | null
  setSelectedStudent: (id: string | null) => void
  year?: number
}) {
  // Función helper para obtener el año del estudiante
  const getStudentYear = (student: any): number | null => {
    if (student.academicYear) {
      return student.academicYear
    }
    if (student.createdAt) {
      let date: Date
      if (typeof student.createdAt === 'string') {
        date = new Date(student.createdAt)
      } else if (student.createdAt?.toDate) {
        date = student.createdAt.toDate()
      } else if (student.createdAt?.seconds) {
        date = new Date(student.createdAt.seconds * 1000)
      } else {
        return null
      }
      return date.getFullYear()
    }
    return null
  }

  const { students: allStudents, isLoading } = useFilteredStudents({
    institutionId,
    campusId,
    gradeId,
    isActive: true,
  })

  // Filtrar estudiantes por año si se proporciona
  const students = useMemo(() => {
    if (!year) return allStudents || []
    return (allStudents || []).filter((student: any) => {
      const studentYear = getStudentYear(student)
      return studentYear === year
    })
  }, [allStudents, year])

  if (isLoading) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!students || students.length === 0) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No se encontraron estudiantes con los filtros seleccionados
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {students.length === 0 ? (
        <p className={cn("text-sm text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          No hay estudiantes en este grado
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {students.map((student: any) => (
            <Button
              key={student.id || student.uid}
              variant={selectedStudent === (student.id || student.uid) ? 'default' : 'outline'}
              onClick={() => setSelectedStudent(
                selectedStudent === (student.id || student.uid) ? null : (student.id || student.uid)
              )}
              className={cn(
                "justify-start h-auto p-4",
                theme === 'dark' && selectedStudent !== (student.id || student.uid)
                  ? 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                  : ''
              )}
            >
              <div className="text-left">
                <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {student.name || student.displayName || 'Sin nombre'}
                </p>
                {student.grade && (
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Grado: {student.grade}
                  </p>
                )}
              </div>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// Componente: Detalle de estudiante
function StudentDetail({ studentId, theme }: { studentId: string, theme: 'light' | 'dark' }) {
  const { data: studentAnalysis, isLoading } = useStudentAnalysis(studentId, !!studentId)
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'phase1' | 'phase2' | 'phase3'>('all')

  if (isLoading) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!studentAnalysis) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="pt-6">
          <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No se encontraron datos de análisis para este estudiante
          </p>
        </CardContent>
      </Card>
    )
  }

  // Preparar datos para el gráfico de evolución por materia (SubjectsProgressChart)
  const subjectPhaseStats = studentAnalysis.subjectPhaseStats || {}
  
  const phase1Data = Object.keys(subjectPhaseStats).length > 0 ? {
    phase: 'phase1' as const,
    subjects: Object.entries(subjectPhaseStats)
      .filter(([_, stats]) => stats.phase1.count > 0)
      .map(([subject, stats]) => ({
        name: subject,
        percentage: stats.phase1.average
      }))
  } : null

  const phase2Data = Object.keys(subjectPhaseStats).length > 0 ? {
    phase: 'phase2' as const,
    subjects: Object.entries(subjectPhaseStats)
      .filter(([_, stats]) => stats.phase2.count > 0)
      .map(([subject, stats]) => ({
        name: subject,
        percentage: stats.phase2.average
      }))
  } : null

  const phase3Data = Object.keys(subjectPhaseStats).length > 0 ? {
    phase: 'phase3' as const,
    subjects: Object.entries(subjectPhaseStats)
      .filter(([_, stats]) => stats.phase3.count > 0)
      .map(([subject, stats]) => ({
        name: subject,
        percentage: stats.phase3.average
      }))
  } : null

  // Contar materias completadas en Fase III
  const phase3Subjects = new Set<string>()
  Object.entries(subjectPhaseStats).forEach(([subject, stats]) => {
    if (stats.phase3.count > 0) {
      phase3Subjects.add(subject)
    }
  })

  // Calcular total de preguntas según la fase seleccionada
  const getTotalQuestionsForPhase = () => {
    if (selectedPhase === 'all') {
      return studentAnalysis.totalExams * 40 // Aproximación
    }
    // Contar exámenes de la fase seleccionada
    const phaseCount = selectedPhase === 'phase1'
      ? studentAnalysis.phaseStats.phase1.count
      : selectedPhase === 'phase2'
        ? studentAnalysis.phaseStats.phase2.count
        : studentAnalysis.phaseStats.phase3.count
    return phaseCount * 40 // Aproximación: cada examen tiene ~40 preguntas
  }
  const totalQuestions = getTotalQuestionsForPhase()

  return (
    <div className="space-y-6">
      {/* Resumen del estudiante */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              <BookOpen className="h-4 w-4" />
              Exámenes Presentados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {studentAnalysis.totalExams}
            </div>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Total de evaluaciones
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              <TrendingUp className="h-4 w-4" />
              Promedio General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {studentAnalysis.averageScore.toFixed(1)}%
            </div>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Rendimiento promedio
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              <Target className="h-4 w-4" />
              Materias Evaluadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {Object.keys(studentAnalysis.subjectStats).length}
            </div>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Áreas de conocimiento
            </p>
          </CardContent>
        </Card>

        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm font-medium flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
              <BarChart3 className="h-4 w-4" />
              Fases Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {[
                studentAnalysis.phaseStats.phase1.count > 0,
                studentAnalysis.phaseStats.phase2.count > 0,
                studentAnalysis.phaseStats.phase3.count > 0
              ].filter(Boolean).length}
            </div>
            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              De 3 fases evaluativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de Fases */}
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
          Filtrar por fase:
        </span>
        <div className="flex gap-2">
          <Button
            variant={selectedPhase === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase('all')}
            className={cn(
              selectedPhase === 'all' 
                ? '' 
                : theme === 'dark' 
                  ? 'border-zinc-700 text-gray-300 hover:bg-zinc-800' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            Todas las Fases
          </Button>
          <Button
            variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase('phase1')}
            className={cn(
              selectedPhase === 'phase1' 
                ? '' 
                : theme === 'dark' 
                  ? 'border-zinc-700 text-gray-300 hover:bg-zinc-800' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            Fase I
          </Button>
          <Button
            variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase('phase2')}
            className={cn(
              selectedPhase === 'phase2' 
                ? '' 
                : theme === 'dark' 
                  ? 'border-zinc-700 text-gray-300 hover:bg-zinc-800' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            Fase II
          </Button>
          <Button
            variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase('phase3')}
            className={cn(
              selectedPhase === 'phase3' 
                ? '' 
                : theme === 'dark' 
                  ? 'border-zinc-700 text-gray-300 hover:bg-zinc-800' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            Fase III
          </Button>
        </div>
      </div>

      {/* Gráfico de evolución por materia y tarjetas de estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Gráfico - ocupa 3 columnas */}
        <div className="lg:col-span-3">
          {(phase1Data || phase2Data || phase3Data) && (
            <SubjectsProgressChart
              phase1Data={phase1Data}
              phase2Data={phase2Data}
              phase3Data={phase3Data}
          theme={theme}
            />
          )}
        </div>

        {/* Tarjetas de estadísticas - ocupa 2 columnas, layout 2x2 */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {/* Puntaje Global y Ranking */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-3 pb-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <Trophy className={cn('h-4 w-4', theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600')} />
              </div>
              <div className={cn('text-2xl font-bold mb-0.5', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {selectedPhase === 'all'
                  ? studentAnalysis.globalScore || Math.round(studentAnalysis.averageScore)
                  : selectedPhase === 'phase1'
                    ? (studentAnalysis.phaseMetrics?.phase1.globalScore || 0)
                    : selectedPhase === 'phase2'
                      ? (studentAnalysis.phaseMetrics?.phase2.globalScore || 0)
                      : (studentAnalysis.phaseMetrics?.phase3.globalScore || 0)}
              </div>
              <p className={cn('text-xs mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Puntaje Global
              </p>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
                theme === 'dark' ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'
              )}>
                <Trophy className="h-3 w-3 text-yellow-500" />
                <span className={cn('text-[10px] font-medium', theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700')}>
                  {(studentAnalysis as any).ranking 
                    ? `${(studentAnalysis as any).ranking.position}º de ${(studentAnalysis as any).ranking.total}`
                    : 'Sin ranking'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Porcentaje de Fase */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-3 pb-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <TrendingUp className={cn('h-4 w-4', theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
              </div>
              <div className={cn('text-2xl font-bold mb-0.5', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                {selectedPhase === 'all' 
                  ? Math.round(((phase3Subjects?.size || 0) / 7) * 100)
                  : selectedPhase === 'phase1'
                    ? (studentAnalysis.phaseMetrics?.phase1.phasePercentage || 0)
                    : selectedPhase === 'phase2'
                      ? (studentAnalysis.phaseMetrics?.phase2.phasePercentage || 0)
                      : (studentAnalysis.phaseMetrics?.phase3.phasePercentage || 0)}%
              </div>
              <p className={cn('text-xs mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Porcentaje de {selectedPhase === 'all' 
                  ? 'Fase III'
                  : selectedPhase === 'phase1'
                    ? 'Fase I'
                    : selectedPhase === 'phase2'
                      ? 'Fase II'
                      : 'Fase III'}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full" 
                  style={{ 
                    width: `${selectedPhase === 'all' 
                      ? Math.round(((phase3Subjects?.size || 0) / 7) * 100)
                      : selectedPhase === 'phase1'
                        ? (studentAnalysis.phaseMetrics?.phase1.phasePercentage || 0)
                        : selectedPhase === 'phase2'
                          ? (studentAnalysis.phaseMetrics?.phase2.phasePercentage || 0)
                          : (studentAnalysis.phaseMetrics?.phase3.phasePercentage || 0)}%` 
                  }}
                />
              </div>
              <p className={cn('text-[10px]', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {selectedPhase === 'all'
                  ? `${phase3Subjects?.size || 0} de 7 materias`
                  : selectedPhase === 'phase1'
                    ? `${studentAnalysis.phaseMetrics?.phase1.completedSubjects || 0} de 7 materias`
                    : selectedPhase === 'phase2'
                      ? `${studentAnalysis.phaseMetrics?.phase2.completedSubjects || 0} de 7 materias`
                      : `${studentAnalysis.phaseMetrics?.phase3.completedSubjects || 0} de 7 materias`}
              </p>
            </CardContent>
          </Card>

          {/* Tiempo Promedio por Pregunta */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-3 pb-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <Clock className={cn('h-4 w-4', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              </div>
              <div className={cn('text-2xl font-bold mb-0.5', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {(() => {
                  const time = selectedPhase === 'all'
                    ? studentAnalysis.averageTimePerQuestion || 0
                    : selectedPhase === 'phase1'
                      ? studentAnalysis.phaseMetrics?.phase1.averageTimePerQuestion || 0
                      : selectedPhase === 'phase2'
                        ? studentAnalysis.phaseMetrics?.phase2.averageTimePerQuestion || 0
                        : studentAnalysis.phaseMetrics?.phase3.averageTimePerQuestion || 0
                  return time > 0 ? `${time.toFixed(1)}m` : '0m'
                })()}
              </div>
              <p className={cn('text-xs mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Tiempo Promedio - {selectedPhase === 'all' 
                  ? 'Fase III'
                  : selectedPhase === 'phase1'
                    ? 'Fase I'
                    : selectedPhase === 'phase2'
                      ? 'Fase II'
                      : 'Fase III'}
              </p>
              <div className={cn(
                'inline-flex items-center px-2 py-0.5 rounded',
                theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'
              )}>
                <span className={cn('text-[10px]', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  {(() => {
                    const questions = selectedPhase === 'all'
                      ? totalQuestions
                      : selectedPhase === 'phase1'
                        ? (studentAnalysis.phaseMetrics?.phase1.totalQuestions || 0)
                        : selectedPhase === 'phase2'
                          ? (studentAnalysis.phaseMetrics?.phase2.totalQuestions || 0)
                          : (studentAnalysis.phaseMetrics?.phase3.totalQuestions || 0)
                    return `Promedio de ${questions} preguntas`
                  })()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Intento de Fraude */}
          <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-3 pb-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <Shield className={cn('h-4 w-4', theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
              </div>
              <div className={cn('text-2xl font-bold mb-0.5', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                {selectedPhase === 'all'
                  ? studentAnalysis.fraudAttempts || 0
                  : selectedPhase === 'phase1'
                    ? studentAnalysis.phaseMetrics?.phase1.fraudAttempts || 0
                    : selectedPhase === 'phase2'
                      ? studentAnalysis.phaseMetrics?.phase2.fraudAttempts || 0
                      : studentAnalysis.phaseMetrics?.phase3.fraudAttempts || 0}
              </div>
              <p className={cn('text-xs mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Intento de fraude
              </p>
              {(() => {
                const fraudCount = selectedPhase === 'all'
                  ? studentAnalysis.fraudAttempts || 0
                  : selectedPhase === 'phase1'
                    ? studentAnalysis.phaseMetrics?.phase1.fraudAttempts || 0
                    : selectedPhase === 'phase2'
                      ? studentAnalysis.phaseMetrics?.phase2.fraudAttempts || 0
                      : studentAnalysis.phaseMetrics?.phase3.fraudAttempts || 0
                return fraudCount > 0 && (
                  <div className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded',
                    theme === 'dark' ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'
                  )}>
                    <span className={cn('text-[10px] font-medium', theme === 'dark' ? 'text-red-300' : 'text-red-700')}>
                      {fraudCount} {fraudCount === 1 ? 'evaluación' : 'evaluaciones'} con incidentes
                    </span>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Porcentaje de Suerte - Primera fila, segunda columna */}
          <Card className={cn('lg:col-span-2', theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardContent className="pt-3 pb-2.5">
              <div className="flex items-start justify-between mb-1.5">
                <Zap className={cn('h-4 w-4', theme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className={cn('text-2xl font-bold mb-0.5', theme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>
                    {(() => {
                      const luck = selectedPhase === 'all'
                        ? studentAnalysis.luckPercentage || 0
                        : selectedPhase === 'phase1'
                          ? studentAnalysis.phaseMetrics?.phase1.luckPercentage || 0
                          : selectedPhase === 'phase2'
                            ? studentAnalysis.phaseMetrics?.phase2.luckPercentage || 0
                            : studentAnalysis.phaseMetrics?.phase3.luckPercentage || 0
                      return luck
                    })()}%
                  </div>
                  <p className={cn('text-xs mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Porcentaje de Suerte
                  </p>
                </div>
                <div className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded',
                  theme === 'dark' ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'
                )}>
                  <span className={cn('text-[10px] font-medium', theme === 'dark' ? 'text-orange-300' : 'text-orange-700')}>
                    {(() => {
                      const luck = selectedPhase === 'all'
                        ? studentAnalysis.luckPercentage || 0
                        : selectedPhase === 'phase1'
                          ? studentAnalysis.phaseMetrics?.phase1.luckPercentage || 0
                          : selectedPhase === 'phase2'
                            ? studentAnalysis.phaseMetrics?.phase2.luckPercentage || 0
                            : studentAnalysis.phaseMetrics?.phase3.luckPercentage || 0
                      return luck > 50 ? 'Muchas respuestas rápidas' : 'Tiempo adecuado'
                    })()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Componente: Análisis por Materias
function SubjectsAnalysisTab({ analysis, theme }: { analysis: any[], theme: 'light' | 'dark' }) {
  // Agrupar todas las materias de todas las instituciones
  const subjectMap: { [subject: string]: { count: number; total: number; institutions: Set<string> } } = {}

  analysis.forEach(inst => {
    Object.entries(inst.subjectStats).forEach(([subject, stats]: [string, any]) => {
      if (!subjectMap[subject]) {
        subjectMap[subject] = { count: 0, total: 0, institutions: new Set() }
      }
      subjectMap[subject].count += stats.count
      subjectMap[subject].total += stats.average * stats.count
      subjectMap[subject].institutions.add(inst.institutionId)
    })
  })

  const subjectData = Object.entries(subjectMap)
    .map(([subject, data]) => ({
      name: subject,
      promedio: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      examenes: data.count,
      instituciones: data.institutions.size,
    }))
    .sort((a, b) => b.promedio - a.promedio)

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Rendimiento por Materia
          </CardTitle>
          <CardDescription>
            Promedio general de rendimiento por materia en todas las instituciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#e5e7eb'} />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#18181b' : '#fff',
                  border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="promedio" fill="#8b5cf6" name="Promedio (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabla de materias */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Estadísticas Detalladas por Materia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {subjectData.map((subject) => (
              <div
                key={subject.name}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
                )}
              >
                <div>
                  <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {subject.name}
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {subject.examenes} exámenes · {subject.instituciones} instituciones
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {subject.promedio}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente: Análisis por Fases
function PhasesAnalysisTab({ analysis, theme }: { analysis: any[], theme: 'light' | 'dark' }) {
  // Agregar estadísticas de todas las fases
  const phase1Institutions = analysis.filter(inst => inst.phaseStats.phase1.average > 0)
  const phase2Institutions = analysis.filter(inst => inst.phaseStats.phase2.average > 0)
  const phase3Institutions = analysis.filter(inst => inst.phaseStats.phase3.average > 0)

  const phaseData = [
    {
      fase: 'Fase I',
      promedio: phase1Institutions.length > 0
        ? phase1Institutions.reduce((sum, inst) => sum + inst.phaseStats.phase1.average, 0) / phase1Institutions.length
        : 0,
      examenes: analysis.reduce((sum, inst) => sum + inst.phaseStats.phase1.count, 0),
    },
    {
      fase: 'Fase II',
      promedio: phase2Institutions.length > 0
        ? phase2Institutions.reduce((sum, inst) => sum + inst.phaseStats.phase2.average, 0) / phase2Institutions.length
        : 0,
      examenes: analysis.reduce((sum, inst) => sum + inst.phaseStats.phase2.count, 0),
    },
    {
      fase: 'Fase III',
      promedio: phase3Institutions.length > 0
        ? phase3Institutions.reduce((sum, inst) => sum + inst.phaseStats.phase3.average, 0) / phase3Institutions.length
        : 0,
      examenes: analysis.reduce((sum, inst) => sum + inst.phaseStats.phase3.count, 0),
    },
  ].filter(phase => phase.examenes > 0)

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Rendimiento por Fase Evaluativa
          </CardTitle>
          <CardDescription>
            Comparación del rendimiento promedio en cada fase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={phaseData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#e5e7eb'} />
              <XAxis 
                dataKey="fase" 
                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#18181b' : '#fff',
                  border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="promedio" fill="#f59e0b" name="Promedio (%)" />
              <Bar dataKey="examenes" fill="#06b6d4" name="Exámenes Presentados" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de líneas: Evolución entre fases */}
      {phaseData.length >= 2 && (
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Evolución del Rendimiento entre Fases
            </CardTitle>
            <CardDescription>
              Tendencia del rendimiento promedio del sistema a través de las fases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={phaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#e5e7eb'} />
                <XAxis 
                  dataKey="fase" 
                  tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#18181b' : '#fff',
                    border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="promedio" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ r: 6 }}
                  name="Promedio (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabla de estadísticas por fase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {phaseData.map((phase) => (
          <Card key={phase.fase} className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
            <CardHeader>
              <CardTitle className={cn("text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {phase.fase}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Promedio
                  </p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {phase.promedio.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Exámenes
                  </p>
                  <p className={cn("text-xl font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {phase.examenes.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

