import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { useDailyUsage } from '@/hooks/query/useDailyUsage'
import { cn } from '@/lib/utils'
import { Calendar, TrendingUp } from 'lucide-react'

interface DailyUsageChartProps {
  theme?: 'light' | 'dark'
}

export default function DailyUsageChart({ theme = 'light' }: DailyUsageChartProps) {
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week')
  const days = viewMode === 'week' ? 7 : viewMode === 'month' ? 30 : 365
  const { data, isLoading } = useDailyUsage(days)

  // Tooltip personalizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className={cn(
          "rounded-lg border p-3 shadow-lg",
          theme === 'dark' 
            ? 'bg-zinc-800 border-zinc-700' 
            : 'bg-white border-gray-200'
        )}>
          <p className={cn(
            "font-medium mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {label}
          </p>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          )}>
            Pruebas: <span className="font-bold">{data.count}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className={cn(
      theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={cn(
              'flex items-center gap-2',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Uso del Sistema
            </CardTitle>
            <CardDescription className={cn(
              'mt-1',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {viewMode === 'year' ? 'Pruebas presentadas por mes' : 'Pruebas presentadas por día'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
              className={cn(
                viewMode === 'week' 
                  ? theme === 'dark' 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  : theme === 'dark'
                    ? 'border-zinc-600 text-gray-300 hover:bg-zinc-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Semana
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              className={cn(
                viewMode === 'month' 
                  ? theme === 'dark' 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  : theme === 'dark'
                    ? 'border-zinc-600 text-gray-300 hover:bg-zinc-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Mes
            </Button>
            <Button
              variant={viewMode === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('year')}
              className={cn(
                viewMode === 'year' 
                  ? theme === 'dark' 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  : theme === 'dark'
                    ? 'border-zinc-600 text-gray-300 hover:bg-zinc-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Anual
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className={cn(
            "flex items-center justify-center h-[350px]",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p>Cargando datos...</p>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className={cn(
            "flex items-center justify-center h-[350px]",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay datos disponibles</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{
                  fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  fontSize: 12
                }}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{
                  fill: theme === 'dark' ? '#9ca3af' : '#6b7280',
                  fontSize: 12
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{
                  paddingTop: '10px',
                  fontSize: '12px'
                }}
                iconType="line"
                iconSize={12}
                formatter={() => (
                  <span style={{
                    color: theme === 'dark' ? '#d1d5db' : '#374151',
                    fontSize: '11px'
                  }}>
                    Pruebas Presentadas
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: theme === 'dark' ? '#1e293b' : '#ffffff' }}
                activeDot={{ r: 7, strokeWidth: 2 }}
                name="Pruebas Presentadas"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

