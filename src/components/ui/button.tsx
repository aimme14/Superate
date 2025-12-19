import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-all [&_svg]:duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-gray-900 text-white hover:bg-gradient-to-r hover:from-gray-800 hover:via-gray-700 hover:to-gray-800 hover:shadow-lg hover:shadow-black/30 focus-visible:ring-gray-400 dark:bg-gray-800 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700 dark:hover:shadow-black/40",
        destructive:
          "bg-red-600 text-white hover:bg-gradient-to-r hover:from-red-500 hover:via-red-400 hover:to-red-500 hover:shadow-lg hover:shadow-red-500/40 focus-visible:ring-red-400 dark:bg-red-700 dark:hover:from-red-600 dark:hover:via-red-500 dark:hover:to-red-600 dark:hover:shadow-red-600/40",
        success:
          "bg-green-600 text-green-50 hover:bg-gradient-to-r hover:from-green-500 hover:via-green-400 hover:to-green-500 hover:shadow-lg hover:shadow-green-500/40 focus-visible:ring-green-400 dark:bg-green-700 dark:hover:from-green-600 dark:hover:via-green-500 dark:hover:to-green-600 dark:hover:shadow-green-600/40",
        outline:
          "border-2 border-input bg-background hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md focus-visible:ring-teal-400 dark:hover:bg-teal-950 dark:hover:text-teal-300 dark:hover:border-teal-500",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gradient-to-r hover:from-gray-200 hover:via-gray-100 hover:to-gray-200 hover:shadow-md focus-visible:ring-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:hover:from-gray-700 dark:hover:via-gray-600 dark:hover:to-gray-700",
        ghost: 
          "hover:bg-accent hover:shadow-md focus-visible:ring-accent",
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
    
    // Si es button normal, agregamos los efectos visuales (sin shimmer)
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Contenido del botón - sin efecto shimmer */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
