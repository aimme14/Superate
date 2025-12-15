import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-all [&_svg]:duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 focus-visible:ring-gray-400 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 dark:shadow-black/40",
        destructive:
          "bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:from-red-500 hover:via-red-400 hover:to-red-500 focus-visible:ring-red-400 dark:from-red-700 dark:via-red-600 dark:to-red-700 dark:shadow-red-600/40",
        success:
          "bg-gradient-to-r from-green-600 via-green-500 to-green-600 text-green-50 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:from-green-500 hover:via-green-400 hover:to-green-500 focus-visible:ring-green-400 dark:from-green-700 dark:via-green-600 dark:to-green-700 dark:shadow-green-600/40",
        outline:
          "border-2 border-input bg-background shadow-sm hover:shadow-md hover:border-teal-400 hover:bg-gradient-to-r hover:from-teal-50/50 hover:via-blue-50/50 hover:to-cyan-50/50 hover:text-teal-700 focus-visible:ring-teal-400 dark:hover:from-teal-950/50 dark:hover:via-blue-950/50 dark:hover:to-cyan-950/50 dark:hover:text-teal-300 dark:hover:border-teal-500",
        secondary:
          "bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 text-gray-900 shadow-sm hover:shadow-md hover:from-gray-200 hover:via-gray-100 hover:to-gray-200 focus-visible:ring-gray-400 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 dark:text-gray-100 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700",
        ghost: 
          "hover:bg-gradient-to-r hover:from-accent/80 hover:via-accent/60 hover:to-accent/80 hover:shadow-md focus-visible:ring-accent",
        link: 
          "text-primary underline-offset-4 hover:underline transition-transform duration-200",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const hasGradientEffect = variant === 'default' || variant === 'destructive' || variant === 'success' || variant === 'secondary'
    
    // Si es Slot (asChild), solo pasamos las clases
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }
    
    // Si es button normal, agregamos los efectos visuales
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Efecto de brillo animado para botones con gradiente */}
        {hasGradientEffect && (
          <span className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300 pointer-events-none z-0" />
        )}
        {/* Contenido del botón */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
