import { ThemeContextProps } from '@/interfaces/context.interface'
import InputField from '#/common/fields/Input'
import { CardContent } from '#/ui/card'
import { Button } from '#/ui/button'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

import { LogIn, Lock, ChevronRight } from 'lucide-react'

const FormSection = ({ theme }: ThemeContextProps) => {

  return (
    <CardContent className="space-y-3 px-6 pb-3">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="[&>div]:space-y-1"
      >
        <InputField
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="@example.com"
          icon={LogIn}
          theme={theme}
        />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="[&>div]:space-y-1"
      >
        <InputField
          name="password"
          type="password"
          label="Contraseña"
          icon={Lock}
          theme={theme}
        />
      </motion.div>

      {/* -------------------- Submit -------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        whileHover={{ scale: 1 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          type="submit"
          className={cn(
            'text-white w-full relative overflow-hidden',
            'transition-all duration-300',
            'shadow-lg hover:shadow-xl',
            'group h-10',
            theme === 'dark'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
              : 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800'
          )}
        >
          <span className="relative z-10 flex items-center justify-center">
            Iniciar sesión 
            <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
          {/* Efecto de brillo al hover */}
          <div className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            'bg-gradient-to-r from-transparent via-white/20 to-transparent',
            'translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700'
          )} />
        </Button>
      </motion.div>
    </CardContent>
  )
}

export default FormSection