import { ThemeContextProps } from "@/interfaces/context.interface"
import { HeaderSpanProps } from "@/interfaces/props.interface"
import { useFormContext, Controller } from "react-hook-form"
import HeaderCustom from "#/common/elements/HeaderCustom"
import { InputSearchable } from "#/ui/input-searchable"
import { FormItem, FormMessage } from "#/ui/form"
import { cn } from "@/lib/utils"
import React from "react"

interface InputSearchableFieldProps extends HeaderSpanProps, ThemeContextProps {
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  disabled?: boolean
  label?: string
  name: string
}

const InputSearchableField = React.forwardRef<HTMLInputElement, InputSearchableFieldProps>(({
  iconSpan = 'none',
  placeholder,
  className,
  disabled,
  options,
  theme,
  label,
  name,
  span,
}, ref) => {
  const { control } = useFormContext()

  return (
    <FormItem>
      {/* Header */}
      <HeaderCustom
        to="input"
        span={span}
        title={label}
        theme={theme}
        iconSpan={iconSpan}
        htmlFor={name}
      />

      {/* Input */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <InputSearchable
              {...field}
              ref={ref}
              options={options}
              value={field.value}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => { field.onChange(e.target.value) }}
              className={cn(
                theme === 'dark'
                  ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                  : 'bg-gray-100 border-gray-300 text-gray-900',
                disabled && "opacity-50 cursor-not-allowed",
                error && "border-red-500",
                className
              )}
            />
            {error && (
              <FormMessage className={cn(theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                {error.message}
              </FormMessage>
            )}
          </>
        )}
      />
    </FormItem>
  )
})

InputSearchableField.displayName = "InputSearchableField"

export default InputSearchableField
