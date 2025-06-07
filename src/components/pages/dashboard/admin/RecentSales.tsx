import { Avatar, AvatarFallback, AvatarImage } from '#/ui/avatar'

export function RecentSales() {
  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/01.png" alt="Avatar" />
          <AvatarFallback>OM</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Olivia Martínez</p>
          <p className="text-sm text-muted-foreground">
            Mantenimiento realizado: Equipo Dental A
          </p>
        </div>
        <div className="ml-auto font-medium">Hace 2h</div>
      </div>
      <div className="flex items-center">
        <Avatar className="flex h-9 w-9 items-center justify-center space-y-0 border">
          <AvatarImage src="/avatars/02.png" alt="Avatar" />
          <AvatarFallback>JL</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Javier López</p>
          <p className="text-sm text-muted-foreground">Informe generado: Rayos X</p>
        </div>
        <div className="ml-auto font-medium">Hace 5h</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/03.png" alt="Avatar" />
          <AvatarFallback>IN</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Isabel Núñez</p>
          <p className="text-sm text-muted-foreground">
            Nuevo equipo registrado: Esterilizador
          </p>
        </div>
        <div className="ml-auto font-medium">Hace 1d</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/04.png" alt="Avatar" />
          <AvatarFallback>WK</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">William Keller</p>
          <p className="text-sm text-muted-foreground">Mantenimiento programado: Compresor</p>
        </div>
        <div className="ml-auto font-medium">Hace 2d</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9">
          <AvatarImage src="/avatars/05.png" alt="Avatar" />
          <AvatarFallback>SD</AvatarFallback>
        </Avatar>
        <div className="ml-4 space-y-1">
          <p className="text-sm font-medium leading-none">Sofía Díaz</p>
          <p className="text-sm text-muted-foreground">Informe actualizado: Sillón Odontológico</p>
        </div>
        <div className="ml-auto font-medium">Hace 3d</div>
      </div>
    </div>
  )
}