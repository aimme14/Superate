import { useForgotPasswordForm } from '@/hooks/core/form/useAuthForm'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { DialogField } from '@/interfaces/props.interface'
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

import InputField from '#/common/fields/Input'
import Dialog from '#/common/elements/Dialog'
import { CardFooter } from '#/ui/card'
import { Button } from '#/ui/button'

const FooterSection = ({ theme }: ThemeContextProps) => {
  const [showForgotDialog, setShowForgotDialog] = useState(false)
  const { methods, onSubmit } = useForgotPasswordForm()

  return (
    <CardFooter className="flex flex-col pb-4">
      <div className={cn('text-center',
        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
      )}>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowForgotDialog(true)}>
          ¿Olvidaste tu contraseña?
          <Mail className="h-4 w-4" />
        </Button>

        <Dialog
          theme={theme}
          iconSpan="info"
          open={showForgotDialog}
          fields={fields({ theme })}
          form={{ methods, onSubmit }}
          onOpenChange={setShowForgotDialog}
          labelSubmit="Enviar enlace"
          title="Recuperar contraseña"
          description="Ingresa tu email para recibir un enlace de recuperación"
        />
      </div>
    </CardFooter>
  )
}

export default FooterSection
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
const fields = ({ theme }: ThemeContextProps): DialogField[] => [
  {
    name: "email",
    component: (
      <InputField
        icon={Mail}
        type="email"
        name="email"
        label="Email"
        theme={theme}
        placeholder="Ej: example@gmail.com"
      />
    )
  }
]