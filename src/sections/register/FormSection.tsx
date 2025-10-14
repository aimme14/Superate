import { ThemeContextProps } from '@/interfaces/context.interface'     
import SelectField from '#/common/fields/Select'
import InputField from '#/common/fields/Input'
import { CardContent } from '#/ui/card'
import { Button } from '#/ui/button'

import { LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useInstitutionOptions, useCampusOptions, useGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useWatch } from 'react-hook-form'

interface FormSectionProps extends ThemeContextProps { }

const FormSection = ({ theme }: FormSectionProps) => {
  const navigate = useNavigate()
  
  // Obtener opciones dinámicas de instituciones
  const { options: institutionOptions, isLoading: institutionsLoading } = useInstitutionOptions()
  
  // Observar cambios en los campos del formulario
  const selectedInstitution = useWatch({ name: 'inst' })
  const selectedCampus = useWatch({ name: 'campus' })
  
  // Obtener opciones de sedes basadas en la institución seleccionada
  const { options: campusOptions, isLoading: campusLoading } = useCampusOptions(selectedInstitution || '')
  
  // Obtener opciones de grados basadas en la sede seleccionada
  const { options: gradeOptions, isLoading: gradeLoading } = useGradeOptions(
    selectedInstitution || '', 
    selectedCampus || ''
  )

  return (
    <CardContent className="space-y-6">
      <SelectField
        name='role'
        theme={theme}
        label='Rol de Usuario'
        placeholder='Seleccionar rol'
        options={[
          { label: 'Estudiante', value: 'student' },
        ]}
      />
      <InputField
        name="userdoc"
        label="Número de documento"
        placeholder="Número de documento"
        theme={theme}
      />
      <InputField
        name="username"
        label="Nombre completo"
        placeholder="Nombre completo"
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
        placeholder={institutionsLoading ? 'Cargando instituciones...' : 'Seleccionar institución educativa'}
        options={institutionOptions}
        disabled={institutionsLoading}
      />

      {selectedInstitution && (
        <SelectField
          name='campus'
          theme={theme}
          label='Sede'
          placeholder={campusLoading ? 'Cargando sedes...' : 'Seleccionar sede'}
          options={campusOptions}
          disabled={campusLoading}
        />
      )}

      {selectedCampus && (
        <SelectField
          name='grade'
          theme={theme}
          label='Grado'
          placeholder={gradeLoading ? 'Cargando grados...' : 'Seleccionar grado'}
          options={gradeOptions}
          disabled={gradeLoading}
        />
      )}

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