import { Popover, PopoverContent, PopoverTrigger } from '#/ui/popover'
import HeaderCustom from '#/common/elements/HeaderCustom'
import { FormItem, FormMessage } from '#/ui/form'
import { Calendar } from '#/ui/calendar'
import { Button } from '#/ui/button'
import { Input } from '#/ui/input'

import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { useFormContext, Controller } from 'react-hook-form'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import React from 'react'

interface DateFieldProps extends HeaderSpanProps, ThemeContextProps {
  placeholder?: string
  readOnly?: boolean
  value?: string
  label: string
  name: string
}

const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(({
  iconSpan = 'none',
  placeholder,
  readOnly,
  label,
  theme,
  value,
  name,
  span
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
        htmlFor={`${name}-date`}
      />

      {/* Date */}
      <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value: fieldValue }, fieldState: { error } }) => (
          <>
            {readOnly ? (
              <Input
                readOnly
                ref={ref}
                id={`${name}-date`}
                value={value || ''}
                className={cn(
                  'w-full',
                  theme === 'dark'
                    ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                    : 'bg-gray-100 border-gray-300 text-gray-900'
                )}
              />
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id={`${name}-date`}
                    variant={"outline"}
                    className={cn(
                      'w-full pl-3 font-normal',
                      !fieldValue && 'text-muted-foreground',
                      theme === 'dark'
                        ? 'bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600'
                        : 'bg-white border-gray-300 hover:bg-white'
                    )}
                  >
                    {fieldValue
                      ? format(fieldValue, "PPP")
                      : <span>{placeholder || "Seleccione una fecha"}</span>
                    }
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="single"
                    onSelect={onChange}
                    selected={fieldValue}
                  />
                </PopoverContent>
              </Popover>
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

DateField.displayName = 'DateField'

export default DateField