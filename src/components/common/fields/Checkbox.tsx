import HeaderCustom from '#/common/elements/HeaderCustom'
import { FormItem, FormMessage } from '#/ui/form'
import { Checkbox } from '#/ui/checkbox'

import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { useFormContext, Controller } from 'react-hook-form'
import { cn } from '@/lib/utils'
import React from 'react'

interface CheckboxFieldProps extends HeaderSpanProps, ThemeContextProps {
  name: string
  label?: string
  options?: string[]
  className?: string
  description?: string
  isMultiple?: boolean
}

const CheckboxField = React.forwardRef<HTMLButtonElement, CheckboxFieldProps>(({
  isMultiple = false,
  iconSpan = 'none',
  options = [],
  description,
  className,
  theme,
  label,
  name,
  span
}, ref) => {
  const { control } = useFormContext()

  return (
    <FormItem className={className}>
      {/* Header label */}
      {label && (
        <HeaderCustom
          to="input"
          theme={theme}
          title={label}
          span={span}
          iconSpan={iconSpan}
          htmlFor={`${name}-checkbox`}
        />
      )}

      {/* Checkbox */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            {options.length > 0 ? (
              /* Multiple checkboxes */
              <div className="flex flex-wrap gap-4 pt-2">
                {options.map((option, index) => (
                  <CheckboxOption
                    ref={ref}
                    key={index}
                    theme={theme}
                    label={option}
                    id={`${name}-${index}`}
                    checked={isMultiple
                      ? field.value?.includes(option)
                      : field.value === option
                    }
                    onChecked={(checked) => {
                      if (isMultiple) {
                        const currentValue = field.value || []
                        field.onChange(checked
                          ? [...currentValue, option]
                          : currentValue.filter((value: string) => value !== option)
                        )
                      } else {
                        field.onChange(checked ? option : null)
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              /* Single checkbox */
              <div className="flex justify-center">
                <CheckboxOption
                  ref={ref}
                  id={name}
                  theme={theme}
                  label={description || ''}
                  checked={field.value}
                  onChecked={field.onChange}
                />
              </div>
            )}

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

CheckboxField.displayName = 'CheckboxField'

export default CheckboxField
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface CheckboxOptionProps extends ThemeContextProps {
  id: string
  label: string
  checked?: boolean
  onChecked: (checked: boolean) => void
}

const CheckboxOption = React.forwardRef<HTMLButtonElement, CheckboxOptionProps>(({
  id,
  theme,
  label,
  checked,
  onChecked
}, ref) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      id={id}
      ref={ref}
      checked={checked}
      onCheckedChange={onChecked}
      className={cn(
        theme === 'dark'
          ? 'border-zinc-600 data-[state=checked]:bg-zinc-700'
          : 'border-gray-300 data-[state=checked]:bg-purple-600'
      )}
    />
    <label
      htmlFor={id}
      className={cn(
        'text-sm font-medium leading-none cursor-pointer',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        theme === 'dark' ? 'text-zinc-200' : 'text-gray-700'
      )}
    >
      {label}
    </label>
  </div>
))

CheckboxOption.displayName = 'CheckboxOption'