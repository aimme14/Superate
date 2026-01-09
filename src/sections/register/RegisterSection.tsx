import { ThemeContextProps } from "@/interfaces/context.interface"
import { useUserForm } from "@/hooks/core/form/useAuthForm"
import { FormProvider } from "react-hook-form"
import { motion } from 'framer-motion'
import { cn } from "@/lib/utils"

import AlertDialog from "#/common/elements/AlertDialog"
import HeaderForm from "#/common/elements/HeaderForm"
import { Card } from "#/ui/card"

import FooterSection from "./FooterSection"
import FormSection from "./FormSection"

interface RegisterSectionProps extends ThemeContextProps { id: string | undefined }

const RegisterSection = ({ theme, id }: RegisterSectionProps) => {
  const { open, methods, setOpen, onConfirm, handleSubmit } = useUserForm(id)
  return (
    <>
      <FormProvider {...methods}>
        <motion.form 
          onSubmit={handleSubmit}
          className="relative w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {/* Efecto de brillo sutil en el borde */}
            <div className={cn(
              'absolute -inset-0.5 rounded-2xl blur-xl opacity-30 transition-opacity',
              theme === 'dark'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600'
                : 'bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-400'
            )} />
            
            <Card
              className={cn(
                'relative w-full my-0',
                'backdrop-blur-xl backdrop-saturate-150',
                'border border-white/10',
                'shadow-2xl',
                'transition-all duration-300',
                theme === 'dark'
                  ? 'bg-zinc-900/70 hover:bg-zinc-900/80 hover:shadow-purple-900/50'
                  : 'bg-white/80 hover:bg-white/90 hover:shadow-purple-500/30'
              )}
            >
              {/* Overlay de gradiente sutil */}
              <div className={cn(
                'absolute inset-0 rounded-lg pointer-events-none',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-purple-900/10 via-transparent to-indigo-900/10'
                  : 'bg-gradient-to-br from-purple-50/30 via-transparent to-indigo-50/30'
              )} />
              
              <div className="relative z-10">
                <HeaderForm
                  theme={theme}
                  title="Registro Estudiante"
                  className="bg-transparent/0"
                  description="Diligencia la información para registrar al estudiante"
                />
                <FormSection theme={theme} />
                <FooterSection theme={theme} />
              </div>
            </Card>
          </motion.div>
        </motion.form>
      </FormProvider>

      <AlertDialog
        open={open}
        theme={theme}
        onConfirm={onConfirm}
        onOpenChange={() => setOpen(false)}
        description={`¿Estás seguro? ${id ? "Se guardará los cambios" : "Se creará un nuevo usuario"}`}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        title="Confirmación"
      />
    </>
  )
}

export default RegisterSection