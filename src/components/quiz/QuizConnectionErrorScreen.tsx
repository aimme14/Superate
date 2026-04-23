import { WifiOff } from 'lucide-react'
import { Button } from '#/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#/ui/card'
import { Alert, AlertDescription, AlertTitle } from '#/ui/alert'
import { cn } from '@/lib/utils'
import { EXAM_CONNECTION_HINT } from '@/constants/networkMessages'
import { isBrowserOffline } from '@/utils/networkError'

type QuizConnectionErrorScreenProps = {
  variant: 'dark' | 'light'
  onRetry: () => void
  onGoDashboard: () => void
}

export function QuizConnectionErrorScreen({
  variant,
  onRetry,
  onGoDashboard,
}: QuizConnectionErrorScreenProps) {
  const isDark = variant === 'dark'
  const offlineHint = isBrowserOffline()

  return (
    <div className="max-w-2xl mx-auto">
      <Card
        className={cn(
          'shadow-lg',
          isDark ? 'bg-zinc-800 border-zinc-700 border-orange-900/80' : 'border-orange-200'
        )}
      >
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center',
                isDark ? 'bg-orange-950/60' : 'bg-orange-100'
              )}
            >
              <WifiOff className={cn('h-8 w-8', isDark ? 'text-orange-400' : 'text-orange-600')} />
            </div>
          </div>
          <CardTitle className={cn('text-2xl', isDark ? 'text-orange-300' : 'text-orange-900')}>
            Sin conexión o conexión inestable
          </CardTitle>
          <CardDescription className={cn('text-lg', isDark ? 'text-gray-400' : '')}>
            {EXAM_CONNECTION_HINT}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offlineHint && (
            <Alert className={cn(isDark ? 'border-blue-900 bg-blue-950/40' : 'border-blue-200 bg-blue-50')}>
              <AlertTitle className={cn(isDark ? 'text-blue-300' : 'text-blue-900')}>
                Estado del navegador
              </AlertTitle>
              <AlertDescription className={cn(isDark ? 'text-blue-100/90' : 'text-blue-900/90')}>
                Tu navegador reporta que no hay conexión a la red.
              </AlertDescription>
            </Alert>
          )}
          <Alert className={cn(isDark ? 'border-orange-900 bg-orange-950/30' : 'border-orange-100 bg-orange-50')}>
            <AlertTitle className={cn(isDark ? 'text-orange-200' : 'text-orange-900')}>Qué puedes hacer</AlertTitle>
            <AlertDescription className={cn(isDark ? 'text-orange-100/85' : 'text-orange-950/85')}>
              Conéctate a Wi‑Fi o datos móviles, espera unos segundos y usa Reintentar. Si el problema continúa,
              prueba desde otro lugar o más tarde.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={onRetry}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            Reintentar
          </Button>
          <Button
            type="button"
            onClick={onGoDashboard}
            variant="outline"
            className={cn('w-full', isDark ? 'bg-zinc-700 text-white border-zinc-600 hover:bg-zinc-600' : '')}
          >
            Volver al panel
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
