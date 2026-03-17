import { useState } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Building,
  Activity,
  Server,
  ClipboardCheck,
  DollarSign,
  Info,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminStats } from '@/hooks/query/useAdminStats'
import DailyUsageChart from '@/components/admin/DailyUsageChart'
import MonthlyRevenueChart from '@/components/admin/MonthlyRevenueChart'
import { useInstitutionUserCounts } from '@/hooks/query/useInstitutionUserCounts'
import { PRECIO_POR_ESTUDIANTE } from '@/utils/constants'

interface AdminOverviewTabProps extends ThemeContextProps {}

const cardBase = (theme: 'light' | 'dark') =>
  cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')

export default function AdminOverviewTab({ theme }: AdminOverviewTabProps) {
  const currentYear = new Date().getFullYear()
  const [filterYear, setFilterYear] = useState<number>(currentYear)
  const [filterBudgetYear, setFilterBudgetYear] = useState<string | number>(currentYear)
  const {
    totalUsers,
    totalInstitutions,
    activeSessions,
    systemUptimeDays,
    totalCompletedExams,
    isLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminStats()

  const { data: institutionUserCounts, isLoading: isLoadingInstitutions } =
    useInstitutionUserCounts(filterYear)
  const { data: budgetInstitutionUserCounts, isLoading: isLoadingBudgetInstitutions } =
    useInstitutionUserCounts(
      filterBudgetYear === 'total'
        ? undefined
        : typeof filterBudgetYear === 'number'
          ? filterBudgetYear
          : parseInt(filterBudgetYear.toString())
    )

  const totalBudgetStudents = budgetInstitutionUserCounts.reduce((sum, inst) => sum + inst.students, 0)
  const totalBudget = totalBudgetStudents * PRECIO_POR_ESTUDIANTE
  const precioFormatted = PRECIO_POR_ESTUDIANTE.toLocaleString('es-CO')

  return (
    <div className="space-y-6">
      <TooltipProvider delayDuration={300}>
        {/* Banner de error de estadísticas */}
        {statsError && (
          <Card className={cn('border-destructive/50', cardBase(theme))}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-700')}>
                    No se pudieron cargar las estadísticas. Revisa la conexión e intenta de nuevo.
                  </p>
                </div>
                {statsError?.message && (
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {statsError.message}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchStats()} className="shrink-0">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Total Usuarios
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className={cn('h-8 w-16 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-20', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {totalUsers.toLocaleString()}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Todos los roles
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Instituciones
              </CardTitle>
              <Building className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className={cn('h-8 w-12 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-24', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {totalInstitutions}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Total registradas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  Sesiones Activas
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    Usuarios con sesión abierta en los últimos minutos (actualizado cada 5 min).
                  </TooltipContent>
                </Tooltip>
              </div>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className={cn('h-8 w-14 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-28', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {activeSessions.toLocaleString()}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    Actualizado cada 5 min
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1">
                <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  Tiempo de Actividad
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    Tiempo desde que el sistema está en operación de forma continua.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Server className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className={cn('h-8 w-12 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-24', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {systemUptimeDays}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    {systemUptimeDays === 1 ? 'día en operación' : 'días en operación'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Pruebas Presentadas
              </CardTitle>
              <ClipboardCheck className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className={cn('h-8 w-20 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-28', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {totalCompletedExams.toLocaleString()}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Exámenes completados
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={cardBase(theme)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex-1">
                <CardTitle className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  Presupuesto Total
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={filterBudgetYear.toString()}
                  onValueChange={(value) => setFilterBudgetYear(value === 'total' ? 'total' : parseInt(value))}
                >
                  <SelectTrigger className={cn('h-7 w-[110px] text-xs', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBudgetInstitutions ? (
                <>
                  <Skeleton className={cn('h-8 w-24 mb-2', theme === 'dark' ? 'bg-zinc-700' : '')} />
                  <Skeleton className={cn('h-3 w-36', theme === 'dark' ? 'bg-zinc-700' : '')} />
                </>
              ) : (
                <>
                  <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${totalBudget.toLocaleString('es-CO')}
                  </div>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Ingresos esperados ({totalBudgetStudents.toLocaleString('es-CO')} estudiantes × ${precioFormatted})
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <DailyUsageChart theme={theme} />
        <MonthlyRevenueChart theme={theme} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usuarios por institución */}
          <Card className={cardBase(theme)}>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Usuarios por Institución
                  </CardTitle>
                  <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Cantidad de usuarios activos por institución
                  </CardDescription>
                </div>
                <div className="shrink-0">
                  <Select value={filterYear.toString()} onValueChange={(value) => setFilterYear(parseInt(value))}>
                    <SelectTrigger className={cn('w-full sm:w-[140px]', theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
            <CardContent className="space-y-4">
              {isLoadingInstitutions ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'animate-pulse rounded-lg border p-3',
                        theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200'
                      )}
                    >
                      <div className={cn('mb-2 h-4 w-3/4 rounded', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                      <div className={cn('h-3 w-1/2 rounded', theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-200')} />
                    </div>
                  ))}
                </div>
              ) : institutionUserCounts.length === 0 ? (
                <div className={cn('py-8 text-center', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  <Building className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No hay instituciones registradas</p>
                </div>
              ) : (
                institutionUserCounts.map((institution) => (
                  <div
                    key={institution.institutionId}
                    className={cn(
                      'rounded-lg border p-4 transition-all',
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200',
                      !institution.isActive && 'opacity-60'
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className={cn('mb-1 truncate font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.institutionName}
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          {institution.userCount.toLocaleString()}{' '}
                          {institution.userCount === 1 ? 'usuario' : 'usuarios'}
                        </p>
                      </div>
                      <Badge
                        variant={institution.isActive ? 'default' : 'secondary'}
                        className={cn(
                          'ml-4 shrink-0',
                          theme === 'dark' && institution.isActive ? 'bg-blue-600 text-white' : '',
                          theme === 'dark' && !institution.isActive ? 'bg-zinc-700 text-white border-zinc-600' : ''
                        )}
                      >
                        {institution.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        'grid grid-cols-2 gap-2 border-t pt-3 md:grid-cols-4',
                        theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                      )}
                    >
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Rectores</p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.rectors}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Coordinadores
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.coordinators}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Docentes</p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.teachers}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Estudiantes
                        </p>
                        <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {institution.students}
                        </p>
                      </div>
                    </div>
                    {/* Desglose por jornada: solo aplica a estudiantes; se muestra siempre para mantener consistencia */}
                    <div
                      className={cn(
                        'border-t pt-3',
                        theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
                      )}
                    >
                      <p className={cn('mb-2 text-xs font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Jornada (solo estudiantes)
                      </p>
                      <div
                        className={cn(
                          'grid gap-2',
                          (institution.students - ((institution.jornadaManana || 0) + (institution.jornadaTarde || 0) + (institution.jornadaUnica || 0)) > 0
                            ? 'grid-cols-4'
                            : 'grid-cols-3')
                        )}
                      >
                        <div className="text-center">
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Mañana</p>
                          <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {institution.jornadaManana || 0}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tarde</p>
                          <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {institution.jornadaTarde || 0}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Única</p>
                          <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {institution.jornadaUnica || 0}
                          </p>
                        </div>
                        {(institution.jornadaManana || 0) + (institution.jornadaTarde || 0) + (institution.jornadaUnica || 0) < institution.students && (
                          <div className="text-center">
                            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sin jornada</p>
                            <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                              {institution.students - ((institution.jornadaManana || 0) + (institution.jornadaTarde || 0) + (institution.jornadaUnica || 0))}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  )
}
