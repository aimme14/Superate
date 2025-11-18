import { Card, CardDescription, CardHeader, CardTitle } from "#/ui/card"
import { ThemeContextProps } from "@/interfaces/context.interface"
import HeaderCustom from "./HeaderCustom"
import { cn } from "@/lib/utils"

interface HeaderFormProps extends ThemeContextProps {
  breadcrumbs?: { description: string }[]
  description: string
  className?: string
  title: string
}
const HeaderForm = ({
  description,
  breadcrumbs,
  className,
  theme,
  title
}: HeaderFormProps) => {
  return (
    <>
      {/* -------------------- Header form -------------------- */}
      <Card className={cn('border-none rounded-lg rounded-b-none shadow-none',
        theme === 'dark' ? 'bg-zinc-950/40' : 'bg-zinc-300/30',
        className
      )}>
        <HeaderText
          theme={theme}
          title={title}
          description={description}
        />
      </Card>

      {/* -------------------- Breadcrumbs -------------------- */}
      {breadcrumbs && (
        <Card className={cn('border-none rounded-none shadow-none',
          theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-200/30'
        )}>
          <div className="flex p-2 justify-between">
            {breadcrumbs.map((breadcrumb, index) => (
              <HeaderCustom
                muted
                key={index}
                theme={theme}
                to="component"
                className="text-sm"
                title={breadcrumb.description}
              />
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

export default HeaderForm
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface HeaderTextProps extends ThemeContextProps {
  title: string,
  description: string
}
const HeaderText = ({ title, description, theme }: HeaderTextProps) => {
  return (
    <CardHeader className="space-y-1 pb-2 pt-3 px-6">
      <CardTitle className={cn(
        'text-3xl font-bold text-center',
        'bg-gradient-to-r bg-clip-text text-transparent',
        'tracking-tight',
        theme === 'dark' 
          ? 'from-purple-800 via-purple-100 to-indigo-200' 
          : 'from-purple-700 via-purple-600 to-indigo-700'
      )}>
        {title}
      </CardTitle>

      <CardDescription className={cn(
        'text-center text-sm',
        'leading-tight',
        theme === 'dark'
          ? 'text-zinc-300'
          : 'text-gray-600'
      )}>
        {description}
      </CardDescription>
    </CardHeader>
  )
}