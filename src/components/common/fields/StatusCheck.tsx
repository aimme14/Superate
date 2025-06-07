import { HeaderSpanProps, CheckProps } from '@/interfaces/props.interface'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { useFormContext, Controller } from 'react-hook-form'

import HeaderCustom from '#/common/elements/HeaderCustom'
import { FormItem, FormMessage } from '#/ui/form'
import { cn } from '@/lib/utils'
import React from 'react'

interface StatusCheckProps extends HeaderSpanProps, ThemeContextProps {
  options: CheckProps[]
  label: string
  name: string
}

const StatusCheck = React.forwardRef<HTMLDivElement, StatusCheckProps>(({
  iconSpan = 'none',
  options,
  label,
  theme,
  name,
  span
}, ref) => {
  const { control } = useFormContext()

  const layout = () => {
    const count = options.length
    if (count <= 1) return 'lg:grid-cols-1';
    if (count <= 2) return 'lg:grid-cols-2';
    if (count <= 3) return 'lg:grid-cols-3';
    return 'lg:grid-cols-2 xl:grid-cols-4';
  }
  return (
    <FormItem>
      {/* Header */}
      <HeaderCustom
        to='component'
        theme={theme}
        title={label}
        span={span}
        iconSpan={iconSpan}
      />

      {/* StatusCheck */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <div ref={ref} className={cn("grid gap-4", layout())}>
              {options.map((option) => (
                <StatusButton
                  key={option.name}
                  theme={theme}
                  option={option}
                  isSelected={field.value === option.name}
                  onClick={() => field.onChange(option.name)}
                />
              ))}
            </div>

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

StatusCheck.displayName = 'StatusCheck'

export default StatusCheck

/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface StatusButtonProps extends ThemeContextProps {
  option: CheckProps
  isSelected: boolean
  onClick: () => void
}

const StatusButton = ({ theme, option, isSelected, onClick }: StatusButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full p-4 px-8 rounded-lg items-center justify-center',
      'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2',
      `focus:ring-${option.color}-500`,
      theme === 'dark' ? 'text-white' : 'text-gray-800',
      !isSelected
        ? (theme === 'dark' ? `bg-zinc-700` : `bg-gray-100`)
        : (theme === 'dark' ? `bg-${option.color}-600` : `bg-${option.color}-400`)
    )}
  >
    <option.icon className={cn(
      'w-6 h-6 mr-2',
      isSelected ? 'block' : 'hidden'
    )} />
    {option.label}
  </button>
)