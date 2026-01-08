import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "#/ui/dropdown-menu"
import { ThemeContextProps, User } from "@/interfaces/context.interface"
import { Avatar, AvatarFallback, AvatarImage } from "#/ui/avatar"
import { useAuthContext } from "@/context/AuthContext"
import { LogOut, Palette } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "#/ui/button"
import { useState, useEffect } from "react"
import { ColorPaletteSelector, SERIOUS_PALETTES, type ColorPalette } from "@/components/common/ColorPaletteSelector"

const UserMenu = ({ }: ThemeContextProps) => {
  const { user = {} as User, signout } = useAuthContext()
  const navigate = useNavigate()
  const [selectedPalette, setSelectedPalette] = useState<string>(
    localStorage.getItem('dashboard-color-palette') || 'navy-blue'
  )

  useEffect(() => {
    // Aplicar paleta guardada al cargar
    const savedPaletteId = localStorage.getItem('dashboard-color-palette') || 'navy-blue'
    const palette = SERIOUS_PALETTES.find(p => p.id === savedPaletteId) || SERIOUS_PALETTES[0]
    if (palette) {
      document.documentElement.style.setProperty('--dashboard-header', palette.colors.header)
      document.documentElement.style.setProperty('--dashboard-welcome', palette.colors.welcome)
      document.documentElement.style.setProperty('--dashboard-primary', palette.colors.primary)
      document.documentElement.style.setProperty('--dashboard-secondary', palette.colors.secondary)
      document.documentElement.style.setProperty('--dashboard-accent', palette.colors.accent)
    }
  }, [])

  const handleLogout = async () => {
    await signout()
    // Redirigir a la página de inicio después de cerrar sesión
    navigate('/', { replace: true })
  }

  const handlePaletteChange = (palette: ColorPalette) => {
    setSelectedPalette(palette.id)
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-80">
            <ColorPaletteSelector 
              selectedPalette={selectedPalette}
              onPaletteChange={handlePaletteChange}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenu