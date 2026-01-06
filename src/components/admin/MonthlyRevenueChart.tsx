import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { useMonthlyRevenue } from '@/hooks/query/useMonthlyRevenue'
import { Loader2 } from 'lucide-react'
import { ThemeContextProps } from '@/interfaces/context.interface'

interface MonthlyRevenueChartProps extends ThemeContextProps {}

export default function MonthlyRevenueChart({ theme }: MonthlyRevenueChartProps) {
  const currentYear = new Date().getFullYear()
  const [filterYear, setFilterYear] = useState<number>(currentYear)
  const { data: revenueData, isLoading, error } = useMonthlyRevenue(filterYear)

  const chartData = useMemo(() => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    
    // Crear un mapa de los datos existentes
    const dataMap = new Map<string, { ingresos: number; estudiantes: number }>()
    if (revenueData) {
      revenueData.forEach(item => {
        // Extraer el nombre del mes sin el año
        const monthName = item.month.split(' ')[0]
        dataMap.set(monthName, {
          ingresos: item.revenue,
          estudiantes: item.students
        })
      })
    }
    
    // Crear array con todos los meses del año, con 0 si no hay datos
    return months.map(month => ({
      month,
      ingresos: dataMap.get(month)?.ingresos || 0,
      estudiantes: dataMap.get(month)?.estudiantes || 0
    }))
  }, [revenueData, filterYear])

  const chartConfig = {
    ingresos: {
      label: 'Ingresos',
      color: 'hsl(var(--chart-1))',
    },
  }

  if (isLoading) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Ingresos Mensuales
              </CardTitle>
              <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Ingresos estimados por mes basados en estudiantes registrados
              </CardDescription>
            </div>
            <div className="ml-4">
              <Select 
                value={filterYear.toString()} 
                onValueChange={(value) => setFilterYear(parseInt(value))}
              >
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
          <div className={cn("flex items-center justify-center py-12", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p>Cargando datos de ingresos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Ingresos Mensuales
              </CardTitle>
              <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Ingresos estimados por mes basados en estudiantes registrados
              </CardDescription>
            </div>
            <div className="ml-4">
              <Select 
                value={filterYear.toString()} 
                onValueChange={(value) => setFilterYear(parseInt(value))}
              >
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
          <div className={cn("flex items-center justify-center py-12", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            <p>Error al cargar los datos de ingresos</p>
          </div>
        </CardContent>
      </Card>
    )
  }


  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Ingresos Mensuales
            </CardTitle>
            <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Ingresos estimados por mes basados en estudiantes registrados
            </CardDescription>
          </div>
          <div className="ml-4">
            <Select 
              value={filterYear.toString()} 
              onValueChange={(value) => setFilterYear(parseInt(value))}
            >
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
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#e5e7eb'} vertical={false} />
              <XAxis 
                dataKey="month" 
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className={cn(
                        "rounded-lg border bg-background p-2 shadow-sm",
                        theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
                      )}>
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {data.month}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              Ingresos:
                            </span>
                            <span className={cn("text-sm font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              ${data.ingresos.toLocaleString('es-CO')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              Estudiantes:
                            </span>
                            <span className={cn("text-sm font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {data.estudiantes}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar 
                dataKey="ingresos" 
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

