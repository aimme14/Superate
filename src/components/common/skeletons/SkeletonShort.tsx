import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardContent } from '#/ui/card'
import { Skeleton } from '#/ui/skeleton'
import { cn } from '@/lib/utils'

const SkeletonShort = ({ theme }: ThemeContextProps) => {
  return (
    <Card
      className={cn(
        'relative w-full my-10',
        'backdrop-filter backdrop-blur-lg',
        theme === 'dark'
          ? 'bg-zinc-800/90 hover:shadow-purple-900/60'
          : 'bg-white hover:shadow-purple-500/60'
      )}
    >
      <HeaderSkeleton />
      <FormSkeleton />
      <FooterSkeleton />
    </Card>
  )
}

export default SkeletonShort
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
const HeaderSkeleton = () => (
  <div className="space-y-2 p-6 pb-4">
    <Skeleton className="h-8 w-[200px]" /> {/* Title */}
    <Skeleton className="h-4 w-[300px]" /> {/* Description */}
  </div>
)

const FormSkeleton = () => (
  <CardContent className="space-y-6">
    {/* Username field */}
    <FormFieldSkeleton />
    {/* Email field */}
    <FormFieldSkeleton />
    {/* Password field */}
    <FormFieldSkeleton />
    {/* Role select */}
    <FormFieldSkeleton hasSelect />
    {/* Client select */}
    <FormFieldSkeleton hasSelect />
    {/* Submit buttons */}
    <div className="space-y-4 pt-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  </CardContent>
)

const FooterSkeleton = () => (
  <div className="p-6 pt-0">
    <Skeleton className="h-[1px] w-full mb-4" /> {/* Separator */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-[120px]" />
      <Skeleton className="h-4 w-[100px]" />
    </div>
  </div>
)

/*--------------------------------------------------tools--------------------------------------------------*/

interface FormFieldSkeletonProps {
  hasSelect?: boolean
}

const FormFieldSkeleton = ({ hasSelect = false }: FormFieldSkeletonProps) => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[100px]" /> {/* Label */}
    <Skeleton
      className={cn(
        "h-10 w-full",
        hasSelect && "rounded-lg" // Añade bordes redondeados para selects
      )}
    />
  </div>
)