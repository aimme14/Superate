import { SelectMultiOptionProps } from '@/interfaces/props.interface'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { useFormContext, Controller } from 'react-hook-form'
import HeaderCustom from '#/common/elements/HeaderCustom'
import { FormMessage, FormItem } from '#/ui/form'
import { MultiSelect } from '#/ui/select-multi'
import { cn } from '@/lib/utils'
import React from 'react'

interface SelectMultiProps extends HeaderSpanProps, ThemeContextProps {
  options: SelectMultiOptionProps[]
  placeholder?: string
  className?: string
  label?: string
  name: string
}

const SelectMulti = React.forwardRef<HTMLButtonElement, SelectMultiProps>(({
  placeholder,
  className,
  options,
  iconSpan,
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
        to='input'
        span={span}
        theme={theme}
        title={label}
        iconSpan={iconSpan}
        className={className}
        htmlFor={`${name}-select`}
      />

      {/* MultiSelect */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <MultiSelect
              {...field}
              ref={ref}
              maxCount={2}
              theme={theme}
              options={options}
              variant="inverted"
              id={`${name}-select`}
              placeholder={placeholder}
              onValueChange={field.onChange}
              defaultValue={field.value || []}
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
SelectMulti.displayName = 'SelectMulti'

export default SelectMulti