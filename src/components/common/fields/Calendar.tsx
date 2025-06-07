import { Popover, PopoverContent, PopoverTrigger } from "#/ui/popover"
import HeaderCustom from "#/common/elements/HeaderCustom"
import { FormItem, FormMessage } from '#/ui/form'
import { Calendar } from "#/ui/calendar"
import { Button } from "#/ui/button"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { useFormContext, Controller } from 'react-hook-form'
import { CalendarIcon } from "lucide-react"
import * as React from "react"

interface CalendarFieldProps extends HeaderSpanProps, ThemeContextProps {
  placeholder?: string
  fromYear?: number
  toYear?: number
  label: string
  name: string
}

const CalendarField = React.forwardRef<HTMLButtonElement, CalendarFieldProps>(({
  placeholder = "Seleccionar fecha",
  iconSpan = 'none',
  fromYear = 1960,
  toYear = 2030,
  theme,
  label,
  name,
  span,
}, ref) => {
  const { control } = useFormContext()

  return (
    <FormItem>
      {/* Header label */}
      <HeaderCustom
        to="input"
        theme={theme}
        title={label}
        span={span}
        iconSpan={iconSpan}
        htmlFor={`${name}-calendar`}
      />

      {/* Calendar customizable */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  ref={ref}
                  variant={"outline"}
                  id={`${name}-calendar`}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !field.value && "text-muted-foreground",
                    theme === 'dark'
                      ? 'bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? format(field.value, "PPP") : <span>{placeholder}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className={cn("w-auto p-0", theme === 'dark' ? 'bg-zinc-800' : 'bg-white')}>
                <Calendar
                  mode="single"
                  toYear={toYear}
                  fromYear={fromYear}
                  selected={field.value}
                  onSelect={field.onChange}
                  captionLayout="dropdown-buttons"
                  className={cn(theme === 'dark' && 'dark')}
                  classNames={{ caption_label: "hidden", caption_dropdowns: cn(theme === 'dark' && 'text-black') }}
                />
              </PopoverContent>
            </Popover>
            {error && <FormMessage>{error.message}</FormMessage>}
          </>
        )}
      />
    </FormItem>
  )
})

CalendarField.displayName = 'CalendarField'

export default CalendarField