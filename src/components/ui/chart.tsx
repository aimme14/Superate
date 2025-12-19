import * as React from "react"
import { cn } from "@/lib/utils"

// Configuración de colores para los gráficos
export type ChartConfig = {
  [key: string]: {
    label: string
    color?: string
    icon?: React.ComponentType
  }
}

// Contexto para compartir la configuración del gráfico
const ChartContext = React.createContext<ChartConfig | null>(null)

export function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

// Contenedor principal del gráfico
interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
  children: React.ReactNode
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, children, className, ...props }, ref) => {
    return (
      <ChartContext.Provider value={config}>
        <div
          ref={ref}
          className={cn("w-full", className)}
          {...props}
        >
          {children}
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = "ChartContainer"

// Componente de Tooltip personalizado
interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

export const ChartTooltip = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & ChartTooltipProps
>(({ active, payload, label, className, ...props }, ref) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-background p-2 shadow-md",
        className
      )}
      {...props}
    >
      {label && (
        <div className="mb-2 font-medium text-sm">
          {label}
        </div>
      )}
      <div className="grid gap-2">
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-medium">{item.name}:</span>
            <span className="ml-auto font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

// Componente de Leyenda personalizado
export const ChartLegend = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", className)}
      {...props}
    />
  )
})
ChartLegendContent.displayName = "ChartLegendContent"

