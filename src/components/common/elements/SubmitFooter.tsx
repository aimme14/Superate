import { ThemeContextProps } from "@/interfaces/context.interface"
import { useIsMobile } from "@/hooks/ui/use-mobile"
import { Ban, CheckSquare } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { CardFooter } from "#/ui/card"
import { Button } from "#/ui/button"
import { cn } from "@/lib/utils"

interface SubmitFooterProps extends ThemeContextProps {
  onCancel?: () => void
  disabled?: boolean
  to?: string
}

const SubmitFooter = ({ theme, onCancel, to = '/', disabled = false }: SubmitFooterProps) => {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  return (
    <CardFooter className="flex justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={() => { onCancel && onCancel(); navigate(to) }}
        className={cn('hover:scale-105', theme === 'dark'
          ? 'bg-zinc-700 border border-zinc-600 text-zinc-100 hover:bg-zinc-900'
          : 'bg-white border border-gray-200 text-gray-900 hover:bg-white'
        )}
      >
        <Ban className="text-red-600 mr-2 h-4 w-4" />
        {isMobile ? '' : 'Cancelar'}
      </Button>

      <Button
        type="submit"
        disabled={disabled}
        className={cn('hover:scale-105', theme === 'dark'
          ? 'bg-zinc-700 border border-zinc-600 text-zinc-100 hover:bg-zinc-900'
          : 'bg-white border border-gray-200 text-gray-900 hover:bg-white'
        )}
      >
        <CheckSquare className="text-green-600 mr-2 h-4 w-4" />
        {isMobile ? '' : 'Guardar'}
      </Button>
    </CardFooter>
  )
}

export default SubmitFooter