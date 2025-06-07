import { Drawer as DrawerPrimitive, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "#/ui/drawer"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { motion } from "framer-motion"
import { Button } from "#/ui/button"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type React from "react"
import { X } from "lucide-react"

/** Interfaz para las opciones de cronograma */
interface CronogramaOption {
  icon: React.ElementType
  description: string
  gradient: string
  stats: string
  title: string
  path: string
  id: string
}

/** Interfaz para las propiedades del componente Drawer */
interface DrawerProps extends ThemeContextProps {
  // Control props
  onOpenChange: (open: boolean) => void
  open: boolean

  // Content props
  title?: string
  footer?: ReactNode
  children: ReactNode
  description?: string
  showCloseButton?: boolean
  closeButtonLabel?: string

  // Style props
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
  position?: 'bottom' | 'top' | 'left' | 'right'
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'full'
}

/**
 * Componente Drawer reutilizable
 * Permite crear un drawer personalizable para diferentes contextos
 */
const CustomDrawer = ({
  // Control props
  open,
  onOpenChange,

  // Content props
  title,
  description,
  children,
  footer,
  showCloseButton = false,
  closeButtonLabel = 'Cerrar',

  // Style props
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  position = 'bottom',
  size = 'default',
  theme = 'light',
}: DrawerProps) => {
  return (
    <DrawerPrimitive open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(positionClasses[position], sizeClasses[size], themeClasses({ theme }), "mx-auto",
          contentClassName,
          className
        )}
      >
        {/* Indicador de arrastre */}
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-700 my-4" />

        {/* Header */}
        {(title || description) && (
          <DrawerHeader className={cn(headerClassName)}>
            {title && (
              <DrawerTitle className={cn("text-lg font-semibold", theme === "dark" ? "text-white" : "text-gray-800")}>
                {title}
              </DrawerTitle>
            )}

            {description && (
              <DrawerDescription className={cn("text-sm", theme === "dark" ? "text-gray-400" : "text-gray-500")}>
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
        )}

        {/* Contenido principal */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer */}
        {(footer || showCloseButton) && (
          <DrawerFooter className={cn(theme === "dark"
            ? "border-zinc-800 bg-zinc-950/50"
            : "border-gray-100 bg-gray-50",
            footerClassName
          )}>
            {footer}

            {showCloseButton && (
              <DrawerClose asChild>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" className={cn("w-full", theme === "dark"
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-200 border-zinc-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"
                  )}
                  >
                    {closeButtonLabel}
                    <X className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </DrawerClose>
            )}
          </DrawerFooter>
        )}
      </DrawerContent>
    </DrawerPrimitive >
  )
}

export { CustomDrawer, type DrawerProps, type CronogramaOption }
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
// Determinar clases según la posición
const positionClasses = {
  bottom: "inset-x-0 bottom-0 rounded-t-xl border-t",
  top: "inset-x-0 top-0 rounded-b-xl border-b",
  left: "inset-y-0 left-0 h-full rounded-r-xl border-r",
  right: "inset-y-0 right-0 h-full rounded-l-xl border-l",
}

// Determinar clases según el tamaño
const sizeClasses: Record<string, string> = {
  sm: "sm:max-w-sm",
  default: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  full: "max-w-full",
}

// Determinar clases según el tema
const themeClasses = ({ theme }: ThemeContextProps) => theme === "dark"
  ? "bg-zinc-900 border-zinc-800 text-zinc-50"
  : "bg-white border-gray-200 text-gray-900"