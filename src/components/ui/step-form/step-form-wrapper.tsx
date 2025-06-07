import { ThemeContextProps } from "@/interfaces/context.interface"
import { motion } from "framer-motion"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

const formVariants = {
  hidden: { x: -50, opacity: 0 },
  visible: { x: 0, opacity: 1 },
  exit: { x: 50, opacity: 0, transition: { ease: "easeOut" } }
}

interface FormWrapperProps extends ThemeContextProps {
  description: string;
  children: ReactNode;
  title: string;
}
const FormWrapper = ({ title, description, children, theme }: FormWrapperProps) => {
  return (
    <motion.div
      className="flex flex-col gap-5"
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="flex flex-col gap-1">
        <h2 className={cn("text-xl md:text-2xl font-semibold",
          theme === 'dark' ? 'text-zinc-100' : 'text-zinc-700'
        )}>
          {title}
        </h2>
        <p className={cn("text-sm md:text-base",
          theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
        )}>
          {description}
        </p>
      </div>
      {children}
    </motion.div>
  )
}

export default FormWrapper