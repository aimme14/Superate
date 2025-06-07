import { cn } from "@/lib/utils"
import * as React from "react"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const safeValue = Math.max(0, Math.min(100, value || 0))
    return (
      <div
        ref={ref}
        {...props}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800", className?.split(' ').filter(cls => !cls.startsWith('bg-')).join(' '))}
      >
        <div
          style={{ width: `${safeValue}%` }}
          className={cn("absolute top-0 left-0 h-full transition-all duration-300 ease-in-out", className?.split(' ').find(cls => cls.startsWith('bg-')) || 'bg-blue-600')}
        />
      </div>
    )
  }
)

Progress.displayName = "Progress"

export { Progress }
