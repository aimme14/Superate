import { ThemeContextProps } from "@/interfaces/context.interface";
import { RoughNotation } from "react-rough-notation";
import { cn } from "@/lib/utils";

// Definición de tipos
export interface Step { title: string, label: string, id: number }
interface StepColor { tailwind: string, css: string }

interface StepFormSidebarProps extends ThemeContextProps {
  goTo: (index: number) => void
  currentStepIndex: number
  className?: string
  steps: Step[]
}

interface StepFormSidebarItemProps extends ThemeContextProps {
  onClick: () => void
  isActive: boolean
  color: StepColor
  step: Step
}

// Colores para los diferentes pasos
const STEP_COLORS: Record<number, StepColor> = {
  0: { css: "#6fe79f", tailwind: "text-green-400" },
  1: { css: "#3b82f6", tailwind: "text-blue-500" },
  2: { css: "#fdba74", tailwind: "text-orange-400" },
  3: { css: "#f5d6ff", tailwind: "text-purple-200" },
  4: { css: "#bd284d", tailwind: "text-red-600" },
  5: { css: "#E7B8FF", tailwind: "text-indigo-300" },
  6: { css: "#c4b5fd", tailwind: "text-pink-400" },
}

// Componente principal del SideBar
const StepFormSidebar = ({ goTo, theme, steps, className, currentStepIndex }: StepFormSidebarProps) => {
  return (
    <div className={cn(className, "absolute -top-20 left-0 w-full md:w-[25%] md:relative md:top-0 md:left-0")}>
      <nav className={cn("h-full py-5 md:p-5 md:sticky md:top-20 rounded-md border",
        theme === 'dark'
          ? 'bg-zinc-900 hover:shadow-purple-900/60'
          : 'bg-zinc-100 hover:shadow-purple-500/60'
      )}>
        <ul className="flex justify-center gap-2 md:flex-col">
          {steps.map((step) => (
            <StepFormSidebarItem
              step={step}
              key={step.id}
              theme={theme}
              onClick={() => goTo(step.id)}
              isActive={currentStepIndex === step.id}
              color={STEP_COLORS[step.id] || STEP_COLORS[0]}
            />
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default StepFormSidebar
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
// Componente para cada paso individual
const StepFormSidebarItem = ({ theme, step, isActive, color, onClick }: StepFormSidebarItemProps) => (
  <li className="flex flex-col items-start font-medium">
    <span className="hidden text-neutral-500 uppercase text-sm md:flex">
      {step.label}
    </span>
    <button
      tabIndex={0}
      onClick={onClick}
      className={cn(
        "text-sm md:text-base font-semibold",
        isActive ? color.tailwind : theme === 'dark' ? 'text-white' : 'text-zinc-600'
      )}
    >
      <RoughNotation
        type="underline"
        color={color.css}
        show={isActive}
      >
        {step.title}
      </RoughNotation>
    </button>
  </li>
)