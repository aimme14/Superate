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
  Shield,
  Clock,
  Zap,
  Award,
  PieChart as PieChartIcon,
  CheckCircle2
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
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { SubjectsProgressChart } from '@/components/charts/SubjectsProgressChart'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import { StrengthsRadarChart } from '@/components/charts/StrengthsRadarChart'
import { SubjectsDetailedSummary } from '@/components/charts/SubjectsDetailedSummary'

const db = getFirestore(firebaseApp)

interface AdminAnalysisProps extends ThemeContextProps {}

export default function AdminAnalysis({ theme }: AdminAnalysisProps) {
  const currentYear = new Date().getFullYear()
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
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
        <TabsList className={cn("grid w-full grid-cols-2", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <TabsTrigger value="global" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <Building className="h-4 w-4" />
            <span>Instituciones</span>
          </TabsTrigger>
          <TabsTrigger value="students" className={cn("flex items-center space-x-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=inactive]:text-gray-400' : 'data-[state=inactive]:text-black')}>
            <Users className="h-4 w-4" />
            <span>Estudiantes</span>
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
  const [filterRankingPhase, setFilterRankingPhase] = useState<string>('third')
  
  // Estados para filtros del ranking de estudiantes
  const [filterStudentRankingJornada, setFilterStudentRankingJornada] = useState<string>('all')
  const [filterStudentRankingYear, setFilterStudentRankingYear] = useState<number>(currentYear)
  const [filterStudentRankingPhase, setFilterStudentRankingPhase] = useState<string>('third')

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
    filterStudentRankingYear,
    filterStudentRankingPhase !== 'all' ? filterStudentRankingPhase as 'first' | 'second' | 'third' : 'all'
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
                  Mejor estudiante por institución
                  {filterStudentRankingPhase === 'first' ? ' (Fase I)' :
                   filterStudentRankingPhase === 'second' ? ' (Fase II)' :
                   filterStudentRankingPhase === 'third' ? ' (Fase III)' :
                   ' (Todas las Fases)'}
                </CardDescription>
              </div>
              <div className="ml-4 flex gap-4">
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Fase
                  </label>
                  <Select value={filterStudentRankingPhase} onValueChange={setFilterStudentRankingPhase}>
                    <SelectTrigger className={cn("w-[130px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                      <SelectValue placeholder="Fase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Fases</SelectItem>
                      <SelectItem value="first">Fase I</SelectItem>
                      <SelectItem value="second">Fase II</SelectItem>
                      <SelectItem value="third">Fase III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Jornada
                  </label>
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
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Año
                  </label>
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
                          {[
                            student.institutionName,
                            student.campusName,
                            student.gradeName,
                            student.jornada
                          ].filter(Boolean).join(' · ')}
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
                   {filterRankingPhase === 'first' ? '' : filterRankingPhase === 'second' ? '' : filterRankingPhase === 'third' ? '' : ''}
                </CardDescription>
              </div>
              <div className="ml-4 flex gap-4">
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Grado
                  </label>
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
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Fase
                  </label>
                  <Select value={filterRankingPhase} onValueChange={setFilterRankingPhase}>
                    <SelectTrigger className={cn("w-[130px]", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                      <SelectValue placeholder="Fase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Fases</SelectItem>
                      <SelectItem value="first">Fase I</SelectItem>
                      <SelectItem value="second">Fase II</SelectItem>
                      <SelectItem value="third">Fase III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Jornada
                  </label>
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
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Año
                  </label>
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
                    const phaseKey = filterRankingPhase === 'first' ? 'phase1' : filterRankingPhase === 'second' ? 'phase2' : filterRankingPhase === 'third' ? 'phase3' : 'phase3'
                    const phaseA = a.phaseStats?.[phaseKey]?.average || 0
                    const phaseB = b.phaseStats?.[phaseKey]?.average || 0
                    return phaseB - phaseA
                  })
                  .map((inst, index) => {
                    const phaseKey = filterRankingPhase === 'first' ? 'phase1' : filterRankingPhase === 'second' ? 'phase2' : filterRankingPhase === 'third' ? 'phase3' : 'phase3'
                    const phaseScore = inst.phaseStats?.[phaseKey]?.average || 0
                    const phaseExams = inst.phaseStats?.[phaseKey]?.count || 0
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
                              {inst.totalStudents} estudiantes · {phaseExams} exámenes
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {Math.round(phaseScore)}
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
  selectedStudent: any | null
  setSelectedStudent: (student: any | null) => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
                                                              theme={theme}
                                                              selectedStudent={selectedStudent}
                                                              setSelectedStudent={setSelectedStudent}
                                                              year={year}
                                                              setIsDialogOpen={setIsDialogOpen}
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

      {/* Dialog para mostrar resumen y diagnóstico */}
      {selectedStudent && (
        <StudentDetailDialog
          student={selectedStudent}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedStudent(null)
          }}
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
  theme,
  selectedStudent,
  setSelectedStudent,
  year,
  setIsDialogOpen
}: { 
  institutionId?: string
  campusId?: string
  gradeId?: string
  theme: 'light' | 'dark'
  selectedStudent: any | null
  setSelectedStudent: (student: any | null) => void
  year?: number
  setIsDialogOpen: (open: boolean) => void
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
          {students.map((student: any) => {
            const isSelected = selectedStudent && (selectedStudent.id || selectedStudent.uid) === (student.id || student.uid)
            return (
              <Button
                key={student.id || student.uid}
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedStudent(isSelected ? null : student)
                  setIsDialogOpen(!isSelected)
                }}
                className={cn(
                  "justify-start h-auto p-4",
                  theme === 'dark' && !isSelected
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
            )
          })}
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares para mostrar rendimiento y fortalezas/debilidades
function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: any[], theme?: 'light' | 'dark', subjectsWithTopics?: any[] }) {
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject: any) => {
          const hasStrengths = subject.strengths?.length > 0
          const hasNeutrals = subject.neutrals?.length > 0
          const hasWeaknesses = subject.weaknesses?.length > 0
          
          // Determinar color según el porcentaje
          const getPercentageColor = (percentage: number) => {
            if (percentage >= 65) return theme === 'dark' ? 'text-green-400' : 'text-green-600'
            if (percentage >= 50) return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            return theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }
          
          return (
            <AccordionItem key={subject.name} value={subject.name} className={cn("border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
              <AccordionTrigger className={cn("hover:no-underline", theme === 'dark' ? 'text-white' : '')}>
                <div className="flex items-center justify-between w-full pr-4">
                  <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-sm font-semibold", getPercentageColor(subject.percentage))}>
                      {subject.percentage}%
                    </span>
                    {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                      <div className="flex items-center gap-1.5">
                        {hasStrengths && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-green-900/50 text-green-300 border-green-700" : "bg-green-100 text-green-700 border-green-300")}>
                            {subject.strengths.length}
                          </Badge>
                        )}
                        {hasNeutrals && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-yellow-900/50 text-yellow-300 border-yellow-700" : "bg-yellow-100 text-yellow-700 border-yellow-300")}>
                            {subject.neutrals.length}
                          </Badge>
                        )}
                        {hasWeaknesses && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", theme === 'dark' ? "bg-red-900/50 text-red-300 border-red-700" : "bg-red-100 text-red-700 border-red-300")}>
                            {subject.weaknesses.length}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className={cn("space-y-4 pt-2", theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border border-gray-200')}>
                  {/* Temas */}
                  {subject.topics && subject.topics.length > 0 && (
                    <div className="space-y-3">
                      <h4 className={cn("text-xs font-semibold mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Temas
                      </h4>
                      {subject.topics.map((topic: any) => (
                        <div key={topic.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{topic.name}</span>
                            <span className={cn("text-xs font-semibold", getPercentageColor(topic.percentage))}>
                              {topic.percentage}%
                            </span>
                          </div>
                          <Progress 
                            value={topic.percentage} 
                            className={cn(
                              "h-2",
                              topic.percentage >= 65 ? 'bg-green-500' :
                              topic.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Fortalezas, Neutros y Debilidades en horizontal */}
                  {(hasStrengths || hasNeutrals || hasWeaknesses) && (
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Fortalezas */}
                      {hasStrengths && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                            Fortalezas ({subject.strengths.length})
                          </span>
                        </div>
                      )}
                      
                      {/* Neutros */}
                      {hasNeutrals && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700')}>
                            Neutro ({subject.neutrals.length})
                          </span>
                        </div>
                      )}
                      
                      {/* Debilidades */}
                      {hasWeaknesses && (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-red-500" />
                          <span className={cn("text-xs font-semibold", theme === 'dark' ? 'text-red-400' : 'text-red-700')}>
                            Debilidades ({subject.weaknesses.length})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((subject: any) => {
        const percentage = subject.percentage || subject.score
        const getColor = (pct: number) => {
          if (pct >= 65) return theme === 'dark' ? 'text-green-400' : 'text-green-600'
          if (pct >= 50) return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
          return theme === 'dark' ? 'text-red-400' : 'text-red-600'
        }
        
        return (
          <div key={subject.name} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{subject.name}</span>
              <span className={cn("text-sm font-semibold", getColor(percentage))}>
                {percentage}%
              </span>
            </div>
            <Progress 
              value={percentage} 
              className={cn(
                "h-2",
                percentage >= 65 ? 'bg-green-500' :
                percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

// Componente de Dialog para mostrar resumen y diagnóstico del estudiante
function StudentDetailDialog({ student, isOpen, onClose, theme }: any) {
  const studentId = student?.id || student?.uid
  const { data: studentAnalysis, isLoading } = useStudentAnalysis(studentId, isOpen && !!studentId)
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('phase1')
  
  // Función para normalizar nombres de materias
  const normalizeSubjectName = (subject: string): string => {
    const normalized = subject.trim().toLowerCase()
    const subjectMap: Record<string, string> = {
      'biologia': 'Biologia', 'biología': 'Biologia', 'biology': 'Biologia',
      'quimica': 'Quimica', 'química': 'Quimica', 'chemistry': 'Quimica',
      'fisica': 'Física', 'física': 'Física', 'physics': 'Física',
      'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas', 'math': 'Matemáticas',
      'lenguaje': 'Lenguaje', 'language': 'Lenguaje',
      'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
      'ingles': 'Inglés', 'inglés': 'Inglés', 'english': 'Inglés'
    }
    return subjectMap[normalized] || subject
  }

  // Obtener datos de materias con temas para la fase seleccionada (para Resumen)
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['student-subjects-data', studentId, selectedPhase],
    queryFn: async () => {
      if (!studentId) return { subjects: [], subjectsWithTopics: [] }
      
      const phases = [
        { key: 'first', name: 'fase I' },
        { key: 'second', name: 'Fase II' },
        { key: 'third', name: 'fase III' }
      ]
      
      const selectedPhases = selectedPhase === 'all' 
        ? phases 
        : selectedPhase === 'phase1' 
          ? [phases[0]]
          : selectedPhase === 'phase2'
          ? [phases[1]]
          : [phases[2]]
      
      const subjectTopicGroups: { [subject: string]: { [topic: string]: any[] } } = {}
      const subjectScores: { [subject: string]: number } = {}
      const subjectTotals: { [subject: string]: { correct: number; total: number } } = {}
      
      for (const phase of selectedPhases) {
        try {
          const phaseRef = collection(db, 'results', studentId, phase.name)
          const phaseSnap = await getDocs(phaseRef)
          
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            if (examData.completed && examData.score && examData.subject) {
              const subject = normalizeSubjectName(examData.subject)
              const percentage = examData.score.overallPercentage || 0
              
              if (!subjectScores[subject] || percentage > subjectScores[subject]) {
                subjectScores[subject] = percentage
              }
              
              if (!subjectTotals[subject]) {
                subjectTotals[subject] = { correct: 0, total: 0 }
              }
              subjectTotals[subject].correct += examData.score.correctAnswers || 0
              subjectTotals[subject].total += examData.score.totalQuestions || 0
              
              if (examData.questionDetails && Array.isArray(examData.questionDetails)) {
                examData.questionDetails.forEach((question: any) => {
                  const topic = question.topic || 'General'
                  if (!subjectTopicGroups[subject]) {
                    subjectTopicGroups[subject] = {}
                  }
                  if (!subjectTopicGroups[subject][topic]) {
                    subjectTopicGroups[subject][topic] = []
                  }
                  subjectTopicGroups[subject][topic].push(question)
                })
              }
            }
          })
        } catch (error) {
          console.error(`Error obteniendo datos para fase ${phase.name}:`, error)
        }
      }
      
      const subjectsWithTopics: any[] = []
      Object.entries(subjectTopicGroups).forEach(([subject, topics]) => {
        const topicData = Object.entries(topics).map(([topicName, questions]) => {
          const correct = questions.filter((q: any) => q.isCorrect).length
          const total = questions.length
          const percentage = total > 0 ? Math.round((correct / total) * 100) : 0
          return { name: topicName, percentage, correct, total }
        })
        
        const strengths = topicData.filter(t => t.percentage >= 65).map(t => t.name)
        const weaknesses = topicData.filter(t => t.percentage < 50).map(t => t.name)
        const neutrals = topicData.filter(t => t.percentage >= 50 && t.percentage < 65).map(t => t.name)
        
        subjectsWithTopics.push({
          name: subject,
          percentage: Math.round(subjectScores[subject] || 0),
          topics: topicData,
          strengths,
          weaknesses,
          neutrals
        })
      })
      
      const subjects = Object.entries(subjectScores).map(([name, percentage]) => {
        const totals = subjectTotals[name] || { correct: 0, total: 0 }
        return {
          name,
          percentage: Math.round(percentage),
          score: Math.round(percentage),
          maxScore: 100,
          correct: totals.correct,
          total: totals.total,
          strengths: subjectsWithTopics.find(s => s.name === name)?.strengths || [],
          weaknesses: subjectsWithTopics.find(s => s.name === name)?.weaknesses || [],
          improvement: ''
        }
      })
      
      return { subjects, subjectsWithTopics }
    },
    enabled: isOpen && !!studentId,
    staleTime: 5 * 60 * 1000,
  })

  // Obtener datos de las 3 fases para el gráfico de evolución (para Diagnóstico)
  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ['student-phases-data', studentId],
    queryFn: async () => {
      if (!studentId) return { phase1: null, phase2: null, phase3: null }
      
      const phases = [
        { key: 'phase1', name: 'fase I' },
        { key: 'phase2', name: 'Fase II' },
        { key: 'phase3', name: 'fase III' }
      ]
      
      const phaseResults: { [key: string]: any[] } = { phase1: [], phase2: [], phase3: [] }
      
      for (const phase of phases) {
        try {
          const phaseRef = collection(db, 'results', studentId, phase.name)
          const phaseSnap = await getDocs(phaseRef)
          
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data()
            if (examData.completed && examData.score && examData.subject) {
              phaseResults[phase.key].push({
                subject: normalizeSubjectName(examData.subject),
                percentage: examData.score.overallPercentage || 0
              })
            }
          })
        } catch (error) {
          console.error(`Error obteniendo datos para fase ${phase.name}:`, error)
        }
      }
      
      // Procesar datos por fase
      const processPhaseData = (results: any[]) => {
        const subjectScores: { [subject: string]: number } = {}
        results.forEach(result => {
          const subject = result.subject
          if (!subjectScores[subject] || result.percentage > subjectScores[subject]) {
            subjectScores[subject] = result.percentage
          }
        })
        
        return Object.entries(subjectScores).map(([name, percentage]) => ({
          name,
          percentage: Math.round(percentage)
        }))
      }
      
      return {
        phase1: phaseResults.phase1.length > 0 ? { phase: 'phase1' as const, subjects: processPhaseData(phaseResults.phase1) } : null,
        phase2: phaseResults.phase2.length > 0 ? { phase: 'phase2' as const, subjects: processPhaseData(phaseResults.phase2) } : null,
        phase3: phaseResults.phase3.length > 0 ? { phase: 'phase3' as const, subjects: processPhaseData(phaseResults.phase3) } : null
      }
    },
    enabled: isOpen && !!studentId,
    staleTime: 5 * 60 * 1000,
  })

  if (!student) return null

  const getPhaseMetrics = () => {
    if (!studentAnalysis) return null
    
    if (selectedPhase === 'all') {
      return {
        globalScore: studentAnalysis.globalScore || 0,
        phasePercentage: studentAnalysis.phase3Percentage || 0,
        averageTimePerQuestion: studentAnalysis.averageTimePerQuestion || 0,
        fraudAttempts: studentAnalysis.fraudAttempts || 0,
        luckPercentage: studentAnalysis.luckPercentage || 0,
        completedSubjects: 7
      }
    }
    
    const phase = selectedPhase === 'phase1' ? 'phase1' : selectedPhase === 'phase2' ? 'phase2' : 'phase3'
    return studentAnalysis.phaseMetrics?.[phase] || {
      globalScore: 0,
      phasePercentage: 0,
      averageTimePerQuestion: 0,
      fraudAttempts: 0,
      luckPercentage: 0,
      completedSubjects: 0
    }
  }

  const phaseMetrics = getPhaseMetrics()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-6xl max-h-[90vh] overflow-y-auto",
        theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-300'
      )}>
        <DialogHeader>
          <DialogTitle className={cn("text-xl", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {(student as any).name || (student as any).displayName || 'Estudiante'} - Resumen y Diagnóstico
          </DialogTitle>
          <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            {student.campusName && `${student.campusName} • `}{student.gradeName || ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
          </div>
        ) : studentAnalysis && phaseMetrics ? (
          <div className="space-y-6">
            {/* Selector de Fase */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setSelectedPhase('phase1')}
                variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase1'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800 text-white' : ''
                )}
              >
                Fase I
                {studentAnalysis.phaseMetrics?.phase1 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase1.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('phase2')}
                variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase2'
                    ? 'bg-green-600 hover:bg-green-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800 text-white' : ''
                )}
              >
                Fase II
                {studentAnalysis.phaseMetrics?.phase2 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase2.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('phase3')}
                variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'phase3'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800 text-white' : ''
                )}
              >
                Fase III
                {studentAnalysis.phaseMetrics?.phase3 && (
                  <Badge className="ml-2">{studentAnalysis.phaseMetrics.phase3.completedSubjects} materias</Badge>
                )}
              </Button>
              <Button
                onClick={() => setSelectedPhase('all')}
                variant={selectedPhase === 'all' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  selectedPhase === 'all'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : theme === 'dark' ? 'border-zinc-600 bg-zinc-800 text-white' : ''
                )}
              >
                Todas las Fases
              </Button>
            </div>

            {/* Tarjetas de KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Puntaje Global */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {phaseMetrics.globalScore}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntaje Global</p>
                    </div>
                    <Award className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Porcentaje de Fase */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                        {phaseMetrics.phasePercentage}%
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Porcentaje de Fase {selectedPhase === 'phase1' ? 'I' : selectedPhase === 'phase2' ? 'II' : selectedPhase === 'phase3' ? 'III' : ''}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Progress value={phaseMetrics.phasePercentage} className="h-2" />
                    <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {phaseMetrics.completedSubjects} de 7 materias completadas
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Tiempo Promedio */}
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {phaseMetrics.averageTimePerQuestion.toFixed(1)}m
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Tiempo Promedio por Pregunta
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Intento de Fraude */}
              <Card className={cn(
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 
                phaseMetrics.fraudAttempts === 0 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200'
                  : phaseMetrics.fraudAttempts <= 2
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-gray-200'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        phaseMetrics.fraudAttempts === 0 
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : phaseMetrics.fraudAttempts <= 2
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-red-400' : 'text-red-700'
                      )}>
                        {phaseMetrics.fraudAttempts}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Intento de fraude</p>
                    </div>
                    <Shield className={cn(
                      "h-8 w-8",
                      phaseMetrics.fraudAttempts === 0 
                        ? 'text-green-500'
                        : phaseMetrics.fraudAttempts <= 2
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Porcentaje de Suerte */}
              <Card className={cn(
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 
                phaseMetrics.luckPercentage < 20 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200'
                  : phaseMetrics.luckPercentage <= 40
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200'
                  : 'bg-gradient-to-br from-orange-50 to-red-50 border-gray-200'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        phaseMetrics.luckPercentage < 20
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : phaseMetrics.luckPercentage <= 40
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-orange-400' : 'text-orange-700'
                      )}>
                        {phaseMetrics.luckPercentage}%
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Suerte</p>
                    </div>
                    <Zap className={cn(
                      "h-8 w-8",
                      phaseMetrics.luckPercentage < 20
                        ? 'text-green-500'
                        : phaseMetrics.luckPercentage <= 40
                        ? 'text-yellow-500'
                        : 'text-orange-500'
                    )} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs para Resumen y Diagnóstico */}
            <Tabs defaultValue="resumen" className="space-y-4">
              <TabsList className={cn("grid w-full grid-cols-2", theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100')}>
                <TabsTrigger value="resumen" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="diagnostico" className={cn(theme === 'dark' ? 'data-[state=active]:bg-zinc-700' : 'data-[state=active]:bg-white')}>
                  Diagnóstico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200')}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <PieChartIcon className="h-5 w-5" />
                      Rendimiento académico por materia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subjectsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                      </div>
                    ) : subjectsData && subjectsData.subjectsWithTopics && subjectsData.subjectsWithTopics.length > 0 ? (
                      <PerformanceChart 
                        data={subjectsData.subjects} 
                        subjectsWithTopics={subjectsData.subjectsWithTopics}
                        theme={theme} 
                      />
                    ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                      <PerformanceChart 
                        data={subjectsData.subjects} 
                        theme={theme} 
                      />
                    ) : (
                      <p className={cn("text-sm text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        No hay datos de materias disponibles para esta fase
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostico" className="space-y-6">
                {subjectsLoading || phasesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className={cn("h-6 w-6 animate-spin", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  </div>
                ) : subjectsData && subjectsData.subjects && subjectsData.subjects.length > 0 ? (
                  <>
                    {/* Primera Fila: Radar Chart y Evolución por Materia */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Radar Chart de Fortalezas/Debilidades */}
                      <StrengthsRadarChart
                        subjects={subjectsData.subjects}
                        theme={theme}
                      />

                      {/* Gráfico de Evolución por Materia */}
                      <SubjectsProgressChart
                        phase1Data={phasesData?.phase1 || null}
                        phase2Data={phasesData?.phase2 || null}
                        phase3Data={phasesData?.phase3 || null}
                        theme={theme}
                      />
                    </div>

                    {/* Resumen General de Desempeño */}
                    <SubjectsDetailedSummary
                      subjects={subjectsData.subjects}
                      subjectsWithTopics={subjectsData.subjectsWithTopics}
                      theme={theme}
                    />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      No hay datos de diagnóstico disponibles para esta fase
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              No hay datos disponibles para este estudiante
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


