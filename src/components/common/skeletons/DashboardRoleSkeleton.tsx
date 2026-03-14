import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton para dashboards de docente, coordinador y rector.
 * Simula header con logo + grid de tarjetas de estadísticas para carga sin parpadeo.
 */
export function DashboardRoleSkeleton({ theme }: ThemeContextProps) {
  const isDark = theme === 'dark'
  const skeletonClass = isDark ? 'bg-zinc-700' : 'bg-gray-200'

  return (
    <div className={cn('min-h-screen animate-pulse', isDark ? 'bg-zinc-950' : 'bg-gray-100')}>
      {/* Header */}
      <div
        className={cn(
          'px-8 pt-8 pb-3 rounded-none',
          isDark ? 'bg-zinc-800/80' : 'bg-gray-300/50'
        )}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <Skeleton className={cn('w-32 h-32 rounded-xl', skeletonClass)} />
          <div className="space-y-2">
            <Skeleton className={cn('h-8 w-64', skeletonClass)} />
            <Skeleton className={cn('h-5 w-48', skeletonClass)} />
            <Skeleton className={cn('h-4 w-56', skeletonClass)} />
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="container mx-auto px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className={cn(isDark ? 'bg-zinc-800/50' : 'bg-white/80')}>
              <CardHeader className="pb-2">
                <Skeleton className={cn('h-4 w-24', skeletonClass)} />
              </CardHeader>
              <CardContent>
                <Skeleton className={cn('h-8 w-16 mb-2', skeletonClass)} />
                <Skeleton className={cn('h-3 w-full rounded-full', skeletonClass)} />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className={cn('h-10 w-48 rounded-lg', skeletonClass)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={cn(isDark ? 'bg-zinc-800/50' : 'bg-white/80')}>
              <CardContent className="pt-6">
                <Skeleton className={cn('h-[200px] w-full rounded', skeletonClass)} />
              </CardContent>
            </Card>
            <Card className={cn(isDark ? 'bg-zinc-800/50' : 'bg-white/80')}>
              <CardContent className="pt-6">
                <Skeleton className={cn('h-[200px] w-full rounded', skeletonClass)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
