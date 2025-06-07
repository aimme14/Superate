import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { FormItem, FormMessage } from '#/ui/form'

import { useFormContext, Controller } from 'react-hook-form'
import HeaderCustom from '#/common/elements/HeaderCustom'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'

interface ImagePreviewProps extends HeaderSpanProps, ThemeContextProps {
  sizeImage?: string
  className?: string
  label?: string
  name: string
  alt?: string
}

const ImagePreview = React.forwardRef<HTMLDivElement, ImagePreviewProps>(({
  sizeImage = 'w-full h-full',
  iconSpan = 'none',
  className,
  theme,
  label,
  name,
  span,
  alt
}, ref) => {
  const { control } = useFormContext()

  return (
    <FormItem className='w-full h-full'>
      {/* Header label */}
      <HeaderCustom
        to="component"
        span={span}
        theme={theme}
        title={label}
        iconSpan={iconSpan}
        className='ml-auto'
      />

      {/* Image preview with Controller */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <div
              ref={ref}
              className={cn(
                'flex items-center justify-center',
                'overflow-hidden border rounded-md shadow-sm',
                theme === 'dark' ? 'border-zinc-600' : 'border-gray-200',
                className ?? 'mt-1',
                sizeImage
              )}
            >
              {field.value ? (
                <img
                  src={field.value}
                  alt={alt ?? "Preview image"}
                  className={cn("object-cover", sizeImage)}
                />
              ) : (
                <div
                  className={cn('flex items-center justify-center w-full h-full',
                    theme === 'dark'
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'bg-gray-50 text-gray-400'
                  )}
                >
                  <Building2 className={cn('w-16 h-16', theme === 'dark' ? 'text-zinc-300' : 'text-gray-400')} />
                </div>
              )}
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

ImagePreview.displayName = 'ImagePreview'

export default ImagePreview