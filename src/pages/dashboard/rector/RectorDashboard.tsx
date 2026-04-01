import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, GraduationCap, TrendingUp, Users, UserCog, Crown, Target, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { DashboardRoleSkeleton } from '@/components/common/skeletons/DashboardRoleSkeleton'
import { useCurrentRector } from '@/hooks/query/useRectorQuery'
import { usePrincipalsByInstitution } from '@/hooks/query/usePrincipalQuery'
import { useTeachersByInstitution } from '@/hooks/query/useTeacherQuery'
import { useFilteredStudents } from '@/hooks/query/useStudentQuery'
import { useUserInstitution } from '@/hooks/query/useUserInstitution'
import { DASHBOARD_RECTOR_CACHE } from '@/config/dashboardRectorCache'
import {
  fetchInstitutionSummaryByContext,
  RectorPhaseKey,
} from '@/services/rector/institutionSummary.service'

interface RectorDashboardProps extends ThemeContextProps {}

const SUBJECT_LABELS: Record<string, string> = {
  matematicas: 'Matemáticas',
  lenguaje: 'Lenguaje',
  ciencias_sociales: 'Ciencias Sociales',
  biologia: 'Biología',
  quimica: 'Química',
  fisica: 'Física',
  ingles: 'Inglés',
}

function getSubjectLabel(slug: string): string {
  return SUBJECT_LABELS[slug] || slug
}

function safeNum(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export default function RectorDashboard({ theme }: RectorDashboardProps) {
  const { institutionName, institutionLogo } = useUserInstitution()
  const [activeTab, setActiveTab] = useState<'inicio' | 'administrativos' | 'estudiantes'>('inicio')
  const [menuExpanded, setMenuExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [subjectFilter, setSubjectFilter] = useState<string>('todas')
  const [phaseFilter, setPhaseFilter] = useState<RectorPhaseKey>('first')
  const [studentsJornadaFilter, setStudentsJornadaFilter] = useState<'todas' | 'manana' | 'tarde'>('todas')
  const isDark = theme === 'dark'
  const dashboardBg = isDark ? 'bg-zinc-950' : 'bg-slate-50'
  const cardBase = isDark
    ? 'bg-zinc-900 border-zinc-800 shadow-lg shadow-black/20'
    : 'bg-white border-slate-200 shadow-sm'
  const cardMuted = isDark
    ? 'bg-zinc-900/90 border-zinc-800/80 shadow-md shadow-black/10'
    : 'bg-white border-slate-200 shadow-sm'

  const { data: currentRector, isLoading: rectorLoading } = useCurrentRector()
  const institutionId = currentRector?.institutionId || currentRector?.inst || ''
  const currentYear = new Date().getFullYear()

  const { data: institutionSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['rector-institution-summary-shared', institutionId, currentYear],
    queryFn: () => fetchInstitutionSummaryByContext({ institutionId, academicYear: currentYear }),
    enabled: !!institutionId,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  const { data: coordinators = [] } = usePrincipalsByInstitution(
    institutionId,
    activeTab === 'administrativos' && !!institutionId
  )
  const { data: teachers = [] } = useTeachersByInstitution(
    institutionId,
    activeTab === 'administrativos' && !!institutionId
  )
  const { students = [] } = useFilteredStudents(
    {
      institutionId,
      isActive: true,
    },
    activeTab === 'estudiantes' && !!institutionId
  )

  const evolutionBySubjectOption = useMemo(() => {
    if (!institutionSummary) return null

    const phases: RectorPhaseKey[] = ['first', 'second', 'third']
    const allSubjects = new Set<string>()
    phases.forEach((phase) => {
      Object.keys(institutionSummary.phases[phase]?.subjects || {}).forEach((slug) => allSubjects.add(slug))
    })

    const orderedSubjects = Array.from(allSubjects)
    const visibleSubjects = subjectFilter === 'todas'
      ? orderedSubjects
      : orderedSubjects.filter((slug) => slug === subjectFilter)

    const categories = visibleSubjects.map((slug) => getSubjectLabel(slug))
    const getPhaseData = (phase: RectorPhaseKey) => visibleSubjects.map((slug) => safeNum(institutionSummary.phases[phase]?.subjects?.[slug]?.avgPct))

    return {
      backgroundColor: 'transparent',
      color: ['#f59e0b', '#f97316', '#22c55e'],
      grid: { left: 38, right: 12, top: 40, bottom: 52 },
      legend: {
        top: 8,
        textStyle: { color: isDark ? '#d4d4d8' : '#334155', fontSize: 11 },
        data: ['Fase I', 'Fase II', 'Fase III'],
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: isDark ? '#3f3f46' : '#cbd5e1' } },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? '#a1a1aa' : '#64748b',
          fontSize: 10,
          interval: 0,
          rotate: categories.length > 4 ? 18 : 0,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLabel: { color: isDark ? '#a1a1aa' : '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: isDark ? '#3f3f46' : '#e2e8f0' } },
      },
      series: [
        { name: 'Fase I', type: 'bar', barMaxWidth: 22, data: getPhaseData('first'), itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: 'Fase II', type: 'bar', barMaxWidth: 22, data: getPhaseData('second'), itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: 'Fase III', type: 'bar', barMaxWidth: 22, data: getPhaseData('third'), itemStyle: { borderRadius: [4, 4, 0, 0] } },
      ],
    }
  }, [institutionSummary, subjectFilter, isDark])

  const phaseBarOption = useMemo(() => {
    if (!institutionSummary) return null
    const labels = ['Fase I', 'Fase II', 'Fase III']
    const data = [
      safeNum(institutionSummary.phases.first?.avgScore),
      safeNum(institutionSummary.phases.second?.avgScore),
      safeNum(institutionSummary.phases.third?.avgScore),
    ]
    return {
      backgroundColor: 'transparent',
      grid: { left: 38, right: 12, top: 40, bottom: 52 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: isDark ? '#3f3f46' : '#cbd5e1' } },
        axisLabel: { color: isDark ? '#a1a1aa' : '#64748b', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: isDark ? '#3f3f46' : '#e2e8f0' } },
        axisLabel: { color: isDark ? '#a1a1aa' : '#64748b', fontSize: 10 },
      },
      tooltip: { trigger: 'axis' },
      series: [
        {
          type: 'bar',
          data,
          barWidth: 30,
          itemStyle: {
            borderRadius: [8, 8, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#1d4ed8' },
              ],
            },
          },
          label: {
            show: true,
            position: 'top',
            color: isDark ? '#e4e4e7' : '#334155',
            fontSize: 11,
          },
        },
      ],
    }
  }, [institutionSummary, isDark])

  const filteredStudentsCount = useMemo(() => {
    if (!institutionSummary) return 0
    if (studentsJornadaFilter === 'todas') return institutionSummary.totalStudents || 0
    if (studentsJornadaFilter === 'manana') return institutionSummary.byJornada?.mañana || 0
    return institutionSummary.byJornada?.tarde || 0
  }, [institutionSummary, studentsJornadaFilter])

  const subjectsPieOption = useMemo(() => {
    if (!institutionSummary) return null
    const entries = Object.entries(institutionSummary.phases[phaseFilter]?.subjects || {})
      .map(([slug, info]) => ({
        name: getSubjectLabel(slug),
        value: safeNum(info?.avgPct),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        type: 'scroll',
        textStyle: { color: isDark ? '#d4d4d8' : '#334155', fontSize: 10 },
      },
      series: [
        {
          type: 'pie',
          radius: ['35%', '65%'],
          center: ['50%', '43%'],
          label: { show: false },
          emphasis: { label: { show: true, formatter: '{b}\n{c}%', color: isDark ? '#f4f4f5' : '#0f172a' } },
          data: entries,
        },
      ],
    }
  }, [institutionSummary, phaseFilter, isDark])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const prevBodyOverflowY = document.body.style.overflowY
    const prevHtmlOverflowY = document.documentElement.style.overflowY
    document.body.style.overflowY = 'hidden'
    document.documentElement.style.overflowY = 'hidden'

    return () => {
      document.body.style.overflowY = prevBodyOverflowY
      document.documentElement.style.overflowY = prevHtmlOverflowY
    }
  }, [])

  if (rectorLoading || summaryLoading) return <DashboardRoleSkeleton theme={theme} />

  return (
    <div className={cn('overflow-x-hidden', dashboardBg)}>
      <div className="px-4 md:px-6 pt-3">
        <div
          className={cn(
            'relative overflow-visible rounded-2xl px-4 py-3 md:px-5 md:py-4 text-white shadow-2xl',
            isDark ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900' : 'bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700'
          )}
        >
          <div className={cn('absolute inset-0', isDark ? 'bg-gradient-to-r from-blue-900/80 via-blue-800/90 to-blue-900/80' : 'bg-gradient-to-r from-blue-700/85 via-blue-600/85 to-blue-700/85')} />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={institutionLogo || '/assets/agustina.png'}
                alt="Logo institución"
                className="h-14 w-14 rounded-lg object-contain border border-white/30 bg-white/10 p-1.5 shadow-sm"
              />
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold truncate">
                  Bienvenido Rector de {institutionName || currentRector?.institutionName || 'Institución'}
                </h1>
                <p className="text-xs md:text-sm text-white/85 truncate">
                  Rectoría - {institutionName || currentRector?.institutionName || 'Institución'}
                </p>
                <p className="text-[11px] md:text-xs text-white/75 truncate">{currentRector?.email || 'rector@institucion.edu.co'}</p>
              </div>
            </div>

            <div ref={menuRef} className="relative shrink-0 z-[80]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMenuExpanded((prev) => !prev)}
                className="h-9 gap-2 rounded-md border border-zinc-700 bg-black px-3 text-xs text-white hover:bg-zinc-900"
              >
                Menú
                {menuExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
              {menuExpanded && (
                <div className={cn('absolute right-0 top-full mt-1.5 w-52 rounded-md border p-1.5 shadow-2xl z-[90]', 'border-zinc-700 bg-black text-white')}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setActiveTab('inicio')
                      setMenuExpanded(false)
                    }}
                    className={cn('w-full justify-start h-8 text-xs', activeTab === 'inicio' ? 'bg-zinc-800 text-white' : 'text-zinc-200 hover:bg-zinc-900')}
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-2" />
                    Inicio
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMenuExpanded(false)}
                    className="w-full justify-start h-8 text-xs text-zinc-200 hover:bg-zinc-900"
                  >
                    <Wrench className="h-3.5 w-3.5 mr-2" />
                    Soporte técnico
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Building2 className="absolute -right-5 -top-4 h-28 w-28 text-white/10" aria-hidden />
        </div>
      </div>

      {activeTab === 'inicio' && (
        <div className="space-y-4 px-4 md:px-6 pt-3 pb-6">
          {summaryError || !institutionSummary ? (
            <Card className={cn(cardBase)}>
              <CardContent className="py-8 text-center">
                <p className={cn(theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                  No se encontró `institutionSummary` para este rector/año.
                </p>
                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Ejecuta el script `rebuild-institution-summary` y recarga.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Card className={cn(cardBase, 'h-[56px]')}>
                  <CardHeader className="px-2.5 py-1.5 pb-0">
                    <div className="flex items-start justify-between gap-1">
                      <CardTitle className={cn('text-[11px] flex items-center gap-1', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                        <Users className="h-3 w-3 text-blue-400" />
                        Total Estudiantes
                      </CardTitle>
                      <Select value={studentsJornadaFilter} onValueChange={(value) => setStudentsJornadaFilter(value as 'todas' | 'manana' | 'tarde')}>
                        <SelectTrigger className={cn('h-5 w-[68px] px-1 text-[9px] leading-none', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todos</SelectItem>
                          <SelectItem value="manana">Mañana</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pt-0.5 pb-1.5">
                    <div className={cn('text-[20px] leading-none font-bold', isDark ? 'text-white' : 'text-slate-900')}>{filteredStudentsCount}</div>
                  </CardContent>
                </Card>
                <Card className={cn(cardBase, 'h-[56px]')}>
                  <CardHeader className="px-2.5 py-1.5 pb-0">
                    <CardTitle className={cn('text-[11px] flex items-center gap-1', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                      <GraduationCap className="h-3 w-3 text-violet-400" />
                      Total Grados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2.5 pt-0.5 pb-1.5">
                    <div className={cn('text-[20px] leading-none font-bold', isDark ? 'text-white' : 'text-slate-900')}>{institutionSummary.totalGrades}</div>
                  </CardContent>
                </Card>
                <Card className={cn(cardBase, 'h-[56px]')}>
                  <CardHeader className="px-2.5 py-1.5 pb-0">
                    <CardTitle className={cn('text-[11px] flex items-center gap-1', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                      <Building2 className="h-3 w-3 text-cyan-400" />
                      Sedes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2.5 pt-0.5 pb-1.5">
                    <div className={cn('text-[20px] leading-none font-bold', isDark ? 'text-white' : 'text-slate-900')}>{Object.keys(institutionSummary.bySede || {}).length}</div>
                  </CardContent>
                </Card>
                <Card className={cn(cardBase, 'h-[56px]')}>
                  <CardHeader className="px-2.5 py-1.5 pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className={cn('text-[11px] flex items-center gap-1', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                        <Target className="h-3 w-3 text-emerald-400" />
                        Promedio Fase
                      </CardTitle>
                      <Select value={phaseFilter} onValueChange={(value) => setPhaseFilter(value as RectorPhaseKey)}>
                        <SelectTrigger className={cn('h-5 w-[66px] px-1 text-[9px] leading-none', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first">Fase I</SelectItem>
                          <SelectItem value="second">Fase II</SelectItem>
                          <SelectItem value="third">Fase III</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2.5 pt-0.5 pb-1.5">
                    <div className={cn('text-[20px] leading-none font-bold', isDark ? 'text-white' : 'text-slate-900')}>{safeNum(institutionSummary.phases[phaseFilter]?.avgScore)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <Card className={cn(cardMuted)}>
                  <CardHeader className="h-[86px] pb-2">
                    <CardTitle className={cn(isDark ? 'text-zinc-100' : 'text-slate-900')}>Promedio por fase</CardTitle>
                    <CardDescription className={cn(isDark ? 'text-zinc-400' : 'text-slate-500')}>
                      Resultado ponderado de la sesión de la Institución
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {phaseBarOption ? (
                      <ReactECharts option={phaseBarOption} style={{ height: 250 }} notMerge lazyUpdate />
                    ) : (
                      <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-slate-500')}>Sin datos para mostrar</p>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(cardMuted)}>
                  <CardHeader className="h-[86px] pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className={cn(isDark ? 'text-zinc-100' : 'text-slate-900')}>Estado académico por materia</CardTitle>
                        <CardDescription className={cn(isDark ? 'text-zinc-400' : 'text-slate-500')}>Evolución de la Institucional</CardDescription>
                      </div>
                      <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                        <SelectTrigger className={cn('h-7 w-32 px-2 text-[11px]', isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas las materias</SelectItem>
                          {Object.keys(institutionSummary.phases.first.subjects || {}).map((subject) => (
                            <SelectItem key={subject} value={subject}>
                              {getSubjectLabel(subject)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {evolutionBySubjectOption ? (
                      <ReactECharts option={evolutionBySubjectOption} style={{ height: 250 }} notMerge lazyUpdate />
                    ) : (
                      <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-slate-500')}>Sin datos para mostrar</p>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(cardMuted)}>
                  <CardHeader>
                    <CardTitle className={cn(isDark ? 'text-zinc-100' : 'text-slate-900')}>
                      Materias destacadas {phaseFilter === 'first' ? '(Fase I)' : phaseFilter === 'second' ? '(Fase II)' : '(Fase III)'}
                    </CardTitle>
                    <CardDescription className={cn(isDark ? 'text-zinc-400' : 'text-slate-500')}>
                      Distribución de rendimiento por materia en la fase seleccionada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {subjectsPieOption ? (
                      <ReactECharts option={subjectsPieOption} style={{ height: 250 }} notMerge lazyUpdate />
                    ) : (
                      <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-slate-500')}>Sin datos para mostrar</p>
                    )}
                  </CardContent>
                </Card>
              </div>

            </>
          )}
        </div>
      )}

      {activeTab === 'administrativos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 md:px-6 pt-3 pb-6">
          <Card className={cn(cardMuted)}>
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                <Crown className="h-4 w-4 text-amber-400" />
                Coordinadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-slate-900')}>{coordinators.length}</p>
              <div className={cn('space-y-1 text-sm max-h-64 overflow-auto', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                {coordinators.slice(0, 20).map((c: any) => (
                  <div key={c.id} className="flex justify-between">
                    <span className="truncate">{c.name || 'Sin nombre'}</span>
                    <span className="opacity-70">{c.campusName || 'Sin sede'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className={cn(cardMuted)}>
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2', isDark ? 'text-zinc-100' : 'text-slate-900')}>
                <UserCog className="h-4 w-4 text-sky-400" />
                Docentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-slate-900')}>{teachers.length}</p>
              <div className={cn('space-y-1 text-sm max-h-64 overflow-auto', isDark ? 'text-zinc-200' : 'text-slate-700')}>
                {teachers.slice(0, 20).map((t: any) => (
                  <div key={t.id} className="flex justify-between">
                    <span className="truncate">{t.name || 'Sin nombre'}</span>
                    <span className="opacity-70">{t.grade || 'Sin grado'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'estudiantes' && (
        <Card className={cn('mx-4 md:mx-6 mt-3 mb-6', cardMuted)}>
          <CardHeader>
            <CardTitle className={cn(isDark ? 'text-zinc-100' : 'text-slate-900')}>Análisis por estudiante</CardTitle>
            <CardDescription>
              La vista de ranking de estudiantes está deshabilitada para rector. Se mantiene solo listado institucional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold mb-3', isDark ? 'text-white' : 'text-slate-900')}>{students.length} estudiantes activos</p>
            <div className={cn('space-y-1 text-sm max-h-96 overflow-auto', isDark ? 'text-zinc-200' : 'text-slate-700')}>
              {students.slice(0, 50).map((s: any) => (
                <div key={s.id} className="flex justify-between">
                  <span className="truncate">{s.name || 'Sin nombre'}</span>
                  <span className="opacity-70">{s.gradeName || s.grade || 'Sin grado'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
