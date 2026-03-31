import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthContext } from "@/context/AuthContext"
import { useCurrentUser } from "@/hooks/query/useCurrentUser"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import type { User } from "@/interfaces/db.interface"

/** Perfil Firestore enriquecido (nombres resueltos, legacy `inst`, etc.) */
type UserProfileRow = User & {
  representativePhone?: string
  institutionName?: string
  inst?: string
  campusName?: string
  campus?: string
  gradeName?: string
  grade?: string
  academicYear?: number
  userdoc?: string
}

export default function InfoTab() {
  const { user } = useAuthContext()
  const { theme } = useThemeContext()
  const { data: raw } = useCurrentUser(user?.uid, Boolean(user?.uid))
  const userData = raw as UserProfileRow | undefined

  const labelMobile = "max-md:text-xs"
  const inputMobile =
    "max-md:h-8 max-md:min-h-[2rem] max-md:text-xs max-md:px-2.5 max-md:py-0"
  /** En móvil: franja de etiqueta compacta + menos hueco vertical entre filas */
  const labelSlotRow =
    "max-md:flex max-md:min-h-[1.75rem] max-md:items-end max-md:leading-tight"
  const fieldCol = "flex min-w-0 flex-col gap-1.5 max-md:gap-px"

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      <div className="container mx-auto max-md:px-3 max-md:py-1.5 px-4 py-5 md:py-8">
        <Card
          className={cn(
            theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '',
            'max-md:rounded-lg max-md:shadow-sm'
          )}
        >
          <CardHeader className="max-md:space-y-0 max-md:pb-1.5 max-md:pt-1.5 max-md:px-3 md:p-6">
            <CardTitle
              className={cn(
                theme === 'dark' ? 'text-white' : '',
                'max-md:text-base md:text-xl'
              )}
            >
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="max-md:space-y-0 max-md:p-2.5 max-md:pt-0 space-y-4 md:p-6 md:pt-0">
            <div className="grid grid-cols-1 gap-3 max-md:gap-1 md:grid-cols-2 md:gap-4">
              <div className="col-span-1 grid min-w-0 gap-2 max-md:grid-cols-[7fr_3fr] max-md:gap-1 md:col-span-2 md:grid-cols-2 md:gap-4">
                <div className={fieldCol}>
                  <div className={labelSlotRow}>
                    <Label htmlFor="email" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                      <span className="md:hidden">Correo</span>
                      <span className="hidden md:inline">Correo electrónico</span>
                    </Label>
                  </div>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    readOnly
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                  />
                </div>
                <div className={fieldCol}>
                  <div className={labelSlotRow}>
                    <Label
                      htmlFor="representativePhone"
                      className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}
                    >
                      <span className="md:hidden">Tel. representante</span>
                      <span className="hidden md:inline">Número de teléfono del representante</span>
                    </Label>
                  </div>
                  <Input
                    id="representativePhone"
                    value={userData?.representativePhone || 'No registrado'}
                    readOnly
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                  />
                </div>
              </div>
              <div className={cn(fieldCol, "md:col-span-2")}>
                <div className={labelSlotRow}>
                  <Label htmlFor="name" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                    Nombre
                  </Label>
                </div>
                <Input
                  id="name"
                  value={user?.displayName || ''}
                  readOnly
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                />
              </div>
              <div className={fieldCol}>
                <div className={labelSlotRow}>
                  <Label htmlFor="inst" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                    Institució educativa
                  </Label>
                </div>
                <Input
                  id="inst"
                  value={userData?.institutionName || userData?.inst || ''}
                  readOnly
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                />
              </div>
              <div className={fieldCol}>
                <div className={labelSlotRow}>
                  <Label htmlFor="campus" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                    Sede
                  </Label>
                </div>
                <Input
                  id="campus"
                  value={userData?.campusName || userData?.campus || ''}
                  readOnly
                  className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                />
              </div>
              <div className="col-span-1 grid min-w-0 grid-cols-3 gap-2 max-md:gap-1 md:col-span-2 md:gap-4">
                <div className={fieldCol}>
                  <div className={labelSlotRow}>
                    <Label htmlFor="grade" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                      Grado
                    </Label>
                  </div>
                  <Input
                    id="grade"
                    value={userData?.gradeName || userData?.grade || ''}
                    readOnly
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                  />
                </div>
                <div className={fieldCol}>
                  <div className={labelSlotRow}>
                    <Label htmlFor="academicYear" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                      <span className="md:hidden">Año cohorte</span>
                      <span className="hidden md:inline">Año académico (Cohorte)</span>
                    </Label>
                  </div>
                  <Input
                    id="academicYear"
                    value={userData?.academicYear || ''}
                    readOnly
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                  />
                </div>
                <div className={fieldCol}>
                  <div className={labelSlotRow}>
                    <Label htmlFor="doc" className={cn(theme === 'dark' ? 'text-gray-300' : '', labelMobile)}>
                      Documento
                    </Label>
                  </div>
                  <Input
                    id="doc"
                    value={(userData?.userdoc || '').replace(/0$/, '')}
                    readOnly
                    className={cn(theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white' : '', inputMobile)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}