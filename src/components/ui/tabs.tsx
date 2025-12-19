import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      "border border-border/30 shadow-sm shadow-black/2 dark:shadow-black/10",
      "transition-all duration-200 ease-in-out overflow-hidden",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 ease-in-out",
      "border-2 border-transparent box-border overflow-hidden",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
      "disabled:pointer-events-none disabled:opacity-50",
      // Estados inactivos - hover más visible en modo claro con borde de color
      "hover:bg-gray-100 hover:shadow-md hover:border-black/60",
      // Modo oscuro - texto gris para tabs inactivos
      "dark:data-[state=inactive]:text-muted-foreground",
      // Modo claro - texto negro y negrita para mejor visibilidad
      "data-[state=inactive]:text-black data-[state=inactive]:font-bold",
      // Efecto hover más pronunciado en modo claro
      "hover:text-foreground hover:font-semibold",
      // Estados activos con gradientes y efectos más sutiles
      "data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-400/80 data-[state=active]:via-blue-400/80 data-[state=active]:to-cyan-400/80",
      "data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-teal-500/20",
      "data-[state=active]:border-transparent",
      // Modo oscuro - hover más visible con borde de color
      "dark:hover:bg-accent/40 dark:hover:text-white dark:hover:border-white/60",
      "dark:data-[state=active]:from-teal-500/70 dark:data-[state=active]:via-blue-500/70 dark:data-[state=active]:to-cyan-500/70",
      "dark:data-[state=active]:shadow-teal-400/25",
      // Iconos dentro del tab - animaciones más sutiles
      "[&_svg]:transition-all [&_svg]:duration-200",
      "group-hover:[&_svg]:scale-105",
      "data-[state=active]:[&_svg]:scale-105",
      className
    )}
    {...props}
  >
    {/* Contenido del tab */}
    <span className="relative z-10 flex items-center justify-center gap-2">
      {children}
    </span>
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
