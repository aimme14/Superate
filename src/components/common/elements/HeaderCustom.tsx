import { InfoIcon, SirenIcon, TriangleAlertIcon } from "lucide-react"
import { LabelHTMLAttributes } from "react"
import { FormLabel } from "#/ui/form"
import { cn } from "@/lib/utils";

import { ThemeContextProps } from "@/interfaces/context.interface";
import { HeaderSpanProps } from "@/interfaces/props.interface";

interface HeaderCustomProps extends ThemeContextProps, HeaderSpanProps, Pick<LabelHTMLAttributes<HTMLLabelElement>, 'htmlFor'> {
  to: 'input' | 'component';
  className_span?: string;
  className?: string;
  muted?: boolean;
  title?: string;
}
/**
 * This component is a customizable "Header" that use a title at left side and an optional description with respective icon.
 * It can be used as a section header or as a component header.
 * @param {HeaderCustomProps} props - The properties of the component.
 * @param {string} props.iconSpan - Represents the icon that will be displayed next to the description.
 * @param {string} props.to - Correspond where the header will be placed, it can be 'section' or 'component'.
 * @param {string} props.className_span - Is the class name to add at description, is optional.
 * @param {boolean} props.muted - Is the class name to add at description, is optional.
 * @param {string} props.className - Is the class name to add at header, is optional.
 * @param {string} props.htmlFor - Is the id of the label to associate later with the field.
 * @param {string} props.title - Corresponds to the label or principal text of the field.
 * @param {string} props.theme - Have the current theme, could be 'ligth' or 'dark'
 * @param {string} props.span - Corresponds to the description of the header, if it is not passed, the iconSpan will not be displayed.
 */
const HeaderCustom = ({
  iconSpan = 'none',
  to = 'component',
  className_span,
  muted = false,
  className,
  htmlFor,
  title,
  theme,
  span
}: HeaderCustomProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between">
      {/* -------------------- Header (mode input or component) -------------------- */}
      <div>
        {title && (
          to === 'input' ? (
            //label to asocciate at input =>
            <FormLabel
              htmlFor={htmlFor}
              className={cn(
                className,
                theme === 'dark'
                  ? muted
                    ? 'text-zinc-400'
                    : 'text-zinc-200'
                  : muted
                    ? 'text-gray-500'
                    : 'text-gray-700'
              )}>
              {title}
            </FormLabel>
          ) : (
            //Text free customizable to display =>
            <span className={cn(
              className,
              theme === 'dark'
                ? muted
                  ? 'text-zinc-400'
                  : 'text-zinc-200'
                : muted
                  ? 'text-gray-500'
                  : 'text-gray-700'
            )}>
              {title}
            </span>
          )
        )}
      </div>
      {/* ---------------------------------------------------------------- */}

      {/* Description of section or component - remember that this is optional */}
      <div>
        {span && (
          <span
            className={cn(
              className_span,
              'flex text-sm md:items-center gap-2',
              theme === 'dark' ? 'text-zinc-300' : 'text-gray-500'
            )}
          >
            {span}
            {iconSpan !== 'none' ? (<RenderIconSpan iconSpan={iconSpan} />) : (<></>)}
          </span>
        )}
      </div>
      {/* ---------------------------------------------------------------- */}
    </div >
  )
}
export default HeaderCustom
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
interface RenderIconSpanProps extends HeaderSpanProps { }
const RenderIconSpan = ({ iconSpan }: RenderIconSpanProps) => {
  return (
    <>
      {iconSpan === 'info'
        ? <InfoIcon className="w-5 h-5 md:w-7 md:h-7 text-sky-300" />
        : (iconSpan === 'warn'
          ? <TriangleAlertIcon className="w-5 h-5 md:w-7 md:h-7 text-yellow-300" />
          : <SirenIcon className="w-5 h-5 md:w-7 md:h-7 text-red-300" />
        )
      }
    </>
  )
}