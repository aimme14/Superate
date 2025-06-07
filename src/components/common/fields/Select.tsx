import { HeaderSpanProps, SelectOptionProps } from "@/interfaces/props.interface"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { useFormContext, Controller } from "react-hook-form"
import { cn } from "@/lib/utils"
import React from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/ui/select"
import HeaderCustom from "#/common/elements/HeaderCustom"
import { FormItem, FormMessage } from "#/ui/form"
import { Input } from "#/ui/input"

interface SelectFieldProps<T = string> extends HeaderSpanProps, ThemeContextProps {
  options: SelectOptionProps<T>[]
  placeholder?: string
  isAnother?: boolean
  className?: string
  disabled?: boolean
  readOnly?: boolean
  label?: string
  value?: string
  name: string
}

const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(({
  placeholder,
  className,
  isAnother,
  readOnly,
  disabled,
  iconSpan,
  options,
  theme,
  value,
  label,
  name,
  span,
}, ref) => {
  const { control } = useFormContext()

  return (
    <FormItem>
      {/* Header */}
      <HeaderCustom
        to='input'
        span={span}
        theme={theme}
        title={label}
        iconSpan={iconSpan}
        className={className}
        htmlFor={`${name}-select`}
      />

      {/* Select */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => {
          // Check if current value exists in options
          const currentOption = options.find(opt => opt.value === field.value)
          const isOtherValue = !currentOption && field.value && isAnother

          // Initialize as "otro" if value exists
          // Remember that show on another input
          React.useEffect(() => {
            if (isOtherValue && !field.value?.type) field.onChange({ type: "otro", value: field.value })
          }, [])

          // Handle value changes
          const handleFieldChange = (val: string) => {
            if (val === "otro") field.onChange({ type: "otro", value: "" })
            else field.onChange(val)
          }

          // Get display value for the select
          const displayValue = field.value?.type === "otro" ? "Otro" : currentOption?.label || field.value
          return (
            <>
              {readOnly ? (
                <Input
                  readOnly
                  ref={ref as any}
                  id={`${name}-select`}
                  placeholder={placeholder}
                  value={value || displayValue || ''}
                  className={cn(
                    'w-full',
                    theme === 'dark'
                      ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                      : 'bg-gray-100 border-gray-300 text-gray-900'
                  )}
                />
              ) : (
                <div className="space-y-2">
                  <SelectWrapper
                    {...field}
                    ref={ref}
                    theme={theme}
                    disabled={disabled}
                    id={`${name}-select`}
                    placeholder={placeholder}
                    onChange={handleFieldChange}
                    value={field.value?.type === "otro" ? "otro" : field.value}
                    options={isAnother ? [...options, { label: "Otro", value: "otro" }] : options}
                  />

                  {/* Show input field when "otro" is selected or value not in options */}
                  {isAnother && (field.value?.type === "otro" || isOtherValue) && (
                    <Input
                      disabled={disabled}
                      placeholder="Especifique otro valor"
                      value={field.value?.type === "otro" ? field.value.value : field.value}
                      onChange={(e) => field.onChange({ type: "otro", value: e.target.value })}
                      className={cn(theme === 'dark'
                        ? 'bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600'
                        : 'bg-white border-gray-300 text-gray-900',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    />
                  )}
                </div>
              )}

              {error && (
                <FormMessage className={cn(theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                  {error.message}
                </FormMessage>
              )}
            </>
          )
        }}
      />
    </FormItem>
  )
})

SelectField.displayName = 'SelectField'

export default SelectField
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface SelectProps<T = string> extends ThemeContextProps {
  value: T | { type: string; value: string }
  options: SelectOptionProps<T>[]
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  id: string
}

const SelectWrapper = React.forwardRef<HTMLButtonElement, SelectProps>(({
  placeholder,
  disabled,
  onChange,
  options,
  theme,
  value,
  id,
}, ref) => (
  <Select onValueChange={onChange} value={value?.toString()} disabled={disabled}>
    <SelectTrigger
      id={id}
      ref={ref}
      disabled={disabled}
      className={cn('w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        theme === 'dark'
          ? 'bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600'
          : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-100'
      )}
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>

    {/* Content */}
    <SelectContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
      {options.map(({ label, value }) => (
        <SelectItem
          key={value as string}
          value={value as string}
          className={cn(theme === 'dark' ? 'text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100' : 'focus:bg-gray-100 focus:text-gray-900')}
        >
          {label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
))

SelectWrapper.displayName = 'SelectWrapper'