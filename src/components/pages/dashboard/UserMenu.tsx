import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "#/ui/dropdown-menu"
import { ThemeContextProps, User } from "@/interfaces/context.interface"
import { Avatar, AvatarFallback, AvatarImage } from "#/ui/avatar"
import { useAuthContext } from "@/context/AuthContext"
import { LogOut, Settings } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "#/ui/button"

const UserMenu = ({ }: ThemeContextProps) => {
  const { user = {} as User, signout } = useAuthContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signout()
    // Redirigir a la página de inicio después de cerrar sesión
    navigate('/', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src='' alt={user.displayName || ''} />
            <AvatarFallback className="bg-muted-foreground font-medium text-background">
              {(user.displayName || '').charAt(0).toUpperCase() + (user.displayName || '').charAt(1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() + user.displayName.slice(1) : user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link to="/settings" className="flex items-center w-full">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenu