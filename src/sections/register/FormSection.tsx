import { ThemeContextProps } from '@/interfaces/context.interface'     
import SelectField from '#/common/fields/Select'
import InputField from '#/common/fields/Input'
import { CardContent } from '#/ui/card'
import { Button } from '#/ui/button'

import { LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface FormSectionProps extends ThemeContextProps { }

const FormSection = ({ theme }: FormSectionProps) => {
  const navigate = useNavigate()

  return (
    <CardContent className="space-y-6">
      <SelectField
        name='role'
        theme={theme}
        label='Documento'
        placeholder='Seleccionar documento'
        options={[
          { label: 'Cédula', value: 'cédula' },
          { label: 'Pasaporte', value: 'pasaporte' },
          { label: 'Tarjeta de identidad', value: 'tarjeta_identidad' },
        ]}
      />
      <InputField
        name="userdoc"
        label="Documento del estudiante"
        placeholder="Documento del estudiante"
        theme={theme}
      />
      <InputField
        name="username"
        label="Nombre completo del estudiante"
        placeholder="Nombre completo del estudiante"
        theme={theme}
      />
      <InputField
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="@example.com"
        icon={LogIn}
        theme={theme}
      />

      <SelectField
        name='inst'
        theme={theme}
        label='Institución educativa'
        placeholder='Seleccionar Institucion educativa'
        options={[
          { label: 'COLEGIO AGUSTINA FERRO', value: 'colegio_agustina_ferro' },
          { label: 'COLEGIO DIOCESANO MONSEÑOR PACHECO', value: 'colegio_diocesano_monsenor_pacheco' },
          { label: 'COLEGIO FRANCISCO FERNANDEZ DE CONTRERAS', value: 'colegio_francisco_fernandez_de_contrreras' },
          { label: 'COLEGIO JOSÉ EUSEBIO CARO', value: 'colegio_jose_eusebio_caro' },
          { label: 'COLEGIO LA INMACULADA', value: 'colegio_la_inmaculada' },
          { label: 'COLEGIO LA PRESENTACION', value: 'colegio_la_presentacion' },
          { label: 'INSTITUTO TÉCNICO ALFONSO LOPEZ', value: 'colegio_tecnico_alfonso_lopez' },
          { label: 'INSTITUTO TÉCNICO CARLOS HERNANDEZ YARURO', value: 'colegio_tecnico_carlos_hernandez_yaruro' },
        ]}
      />

      <SelectField
        name='grade'
        theme={theme}
        label='Grado°'
        placeholder='Seleccionar grado que cursa'
        options={[
          { label: '11°', value: '11' },
          { label: '10°', value: '10' },
          { label: '9°', value: '9' },
          { label: '8°', value: '8' },
          { label: '7°', value: '7' },
          { label: '6°', value: '6' },
          { label: '5°', value: '5' },
        ]}
      />

      {/* -------------------- Submit -------------------- */}
      <Button
        type="submit"
        className={cn(
          'text-white w-full',
          'transform hover:scale-105',
          theme === 'dark'
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-purple-800 hover:bg-purple-900'
        )}
      >
        Registrar cuenta
        <UserPlus className="ml-2 h-4 w-4" />
      </Button>

      {/* -------------------- go to login -------------------- */}
      <Button
        type="button"
        onClick={() => navigate('/auth/login')}
        className={cn(
          'text-white w-full',
          'transform hover:scale-105',
          theme === 'dark'
            ? 'bg-purple-800 hover:bg-purple-900'
            : 'bg-purple-400 hover:bg-purple-500'
        )}
      >
        Ya tengo una cuenta <LogIn className="ml-2 h-4 w-4" />
      </Button>
    </CardContent>
  )
}

export default FormSection