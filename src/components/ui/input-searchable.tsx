import * as React from "react"
import { cn } from "@/lib/utils"

export interface Option {
  value: string
  label: string
}

interface InputSearchableProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void
  className?: string
  options: Option[]
  value?: string
}

const InputSearchable = React.forwardRef<HTMLInputElement, InputSearchableProps>(({
  value: propValue,
  onValueChange,
  onChange,
  className,
  options,
  ...props
}, ref) => {
  const [displayValue, setDisplayValue] = React.useState("")
  const optionsMap = React.useMemo(() => new Map(
    options.map(opt => [opt.label, opt.value])
  ), [options])
  const id = React.useId()

  // Cuando cambia el valor externo (propValue), actualizar el displayValue
  React.useEffect(() => {
    if (!propValue) return
    const option = options.find(opt => opt.value === propValue)
    option && setDisplayValue(option.label)
  }, [propValue, options])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)

    // if match label, so set value
    const actualValue = optionsMap.get(inputValue) || inputValue
    const syntheticEvent = { ...e, target: { ...e.target, value: actualValue } }
    onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>)
    onValueChange?.(actualValue)
  }

  return (
    <div className="relative w-full">
      <input
        {...props}
        ref={ref}
        list={id}
        value={displayValue}
        onChange={handleChange}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </div>
  )
}
)

InputSearchable.displayName = "InputSearchable"

export { InputSearchable }
