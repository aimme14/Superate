import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useRegistrationConfig, useUpdateRegistrationConfig } from '@/hooks/query/useRegistrationConfig'
import { cn } from '@/lib/utils'
import { UserPlus, Lock, Unlock, Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface RegistrationSettingsProps extends ThemeContextProps {}

export default function RegistrationSettings({ theme }: RegistrationSettingsProps) {
  const { config, isEnabled, isLoading, error } = useRegistrationConfig()
  const { updateConfig, isLoading: isUpdating } = useUpdateRegistrationConfig()

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateConfig(enabled)
    } catch (error) {
      console.error('Error al actualizar configuración:', error)
    }
  }

  return (
    <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              theme === 'dark' ? 'bg-zinc-800' : 'bg-purple-50'
            )}>
              <UserPlus className={cn(
                "h-5 w-5",
                isEnabled 
                  ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  : theme === 'dark' ? 'text-red-400' : 'text-red-600'
              )} />
            </div>
            <div>
              <CardTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Control de Registro de Usuarios
              </CardTitle>
              <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Activa o desactiva el registro público de nuevos usuarios
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={isEnabled ? 'default' : 'secondary'}
            className={cn(
              isEnabled 
                ? theme === 'dark' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                : theme === 'dark' ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
            )}
          >
            {isEnabled ? (
              <>
                <Unlock className="h-3 w-3 mr-1" />
                Habilitado
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Deshabilitado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Error al cargar la configuración'}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className={cn("flex items-center justify-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500 mx-auto mb-2" />
              <p>Cargando configuración...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toggle Switch */}
            <div className={cn(
              "flex items-center justify-between p-4 rounded-lg border",
              theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
            )}>
              <div className="space-y-0.5 flex-1">
                <Label 
                  htmlFor="registration-toggle" 
                  className={cn(
                    "text-base font-semibold cursor-pointer",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  Permitir registro de nuevos usuarios
                </Label>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {isEnabled 
                    ? 'Los usuarios pueden registrarse desde la página de registro'
                    : 'El registro está deshabilitado. Los usuarios no podrán crear nuevas cuentas'
                  }
                </p>
              </div>
              <Switch
                id="registration-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isUpdating}
                className="ml-4"
              />
            </div>

            {/* Información adicional */}
            {config?.updatedAt && (
              <div className={cn(
                "p-3 rounded-lg border",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800/30' : 'border-gray-200 bg-gray-50'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Última actualización: {new Date(config.updatedAt).toLocaleString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {config.updatedBy && (
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Actualizado por: {config.updatedBy}
                  </p>
                )}
              </div>
            )}

            {/* Advertencia cuando está deshabilitado */}
            {!isEnabled && (
              <Alert className={cn(
                theme === 'dark' ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'
              )}>
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className={cn(theme === 'dark' ? 'text-amber-400' : 'text-amber-800')}>
                  Registro deshabilitado
                </AlertTitle>
                <AlertDescription className={cn(theme === 'dark' ? 'text-amber-300' : 'text-amber-700')}>
                  El botón "Registrarse" no será visible en el menú principal y los usuarios no podrán acceder a la página de registro.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
