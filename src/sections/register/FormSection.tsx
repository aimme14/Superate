import { ThemeContextProps } from '@/interfaces/context.interface'     
import SelectField from '#/common/fields/Select'
import InputField from '#/common/fields/Input'
import { CardContent } from '#/ui/card'
import { Button } from '#/ui/button'
import { motion } from 'framer-motion'

import { LogIn, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useInstitutionOptions, useCampusOptions, useGradeOptions } from '@/hooks/query/useInstitutionQuery'
import { useWatch } from 'react-hook-form'

interface FormSectionProps extends ThemeContextProps { }

const FormSection = ({ theme }: FormSectionProps) => {
  const navigate = useNavigate()
  
  // Obtener opciones dinámicas de instituciones - solo activas para registro
  const { options: institutionOptions, isLoading: institutionsLoading } = useInstitutionOptions(true)
  
  // Observar cambios en los campos del formulario
  const selectedInstitution = useWatch({ name: 'inst' })
  const selectedCampus = useWatch({ name: 'campus' })
  const selectedGrade = useWatch({ name: 'grade' })
  
  // Obtener opciones de sedes basadas en la institución seleccionada
  const { options: campusOptions, isLoading: campusLoading } = useCampusOptions(selectedInstitution || '')
  
  // Obtener opciones de grados basadas en la sede seleccionada
  const { options: gradeOptions, isLoading: gradeLoading } = useGradeOptions(
    selectedInstitution || '', 
    selectedCampus || ''
  )

  return (
    <CardContent className="space-y-3 px-6 pb-3">
      <div className="[&>div]:space-y-1">
        <InputField
          name="username"
          label="Nombre completo"
          placeholder="Nombre completo"
          theme={theme}
        />
      </div>
      <div className="[&>div]:space-y-1">
        <InputField
          name="userdoc"
          label="Número de documento"
          placeholder="Número de documento"
          theme={theme}
        />
      </div>
      <div className="[&>div]:space-y-1">
        <InputField
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="@example.com"
          icon={LogIn}
          theme={theme}
        />
      </div>
      <div className="[&>div]:space-y-1">
        <InputField
          name="representativePhone"
          label="Número de teléfono del representante"
          placeholder="Ej: +57 300 1234567"
          theme={theme}
        />
      </div>
      <div className="[&>div]:space-y-1">
        <SelectField
          name='inst'
          theme={theme}
          label='Institución educativa'
          placeholder={institutionsLoading ? 'Cargando instituciones...' : 'Seleccionar institución educativa'}
          options={institutionOptions}
          disabled={institutionsLoading}
        />
      </div>

      {selectedInstitution && (
        <div className="[&>div]:space-y-1">
          <SelectField
            name='campus'
            theme={theme}
            label='Sede'
            placeholder={campusLoading ? 'Cargando sedes...' : 'Seleccionar sede'}
            options={campusOptions}
            disabled={campusLoading}
          />
        </div>
      )}

      {selectedCampus && (
        <div className="[&>div]:space-y-1">
          <SelectField
            name='grade'
            theme={theme}
            label='Grado'
            placeholder={gradeLoading ? 'Cargando grados...' : 'Seleccionar grado'}
            options={gradeOptions}
            disabled={gradeLoading}
          />
        </div>
      )}

      {selectedGrade && (
        <div className="[&>div]:space-y-1">
          <SelectField
            name='jornada'
            theme={theme}
            label='Jornada'
            placeholder='Seleccionar jornada'
            options={[
              { value: 'mañana', label: 'Mañana' },
              { value: 'tarde', label: 'Tarde' },
              { value: 'única', label: 'Única' }
            ]}
          />
        </div>
      )}

      <div className="[&>div]:space-y-1">
        <InputField
          name="academicYear"
          type="number"
          label="Año académico (Cohorte) *"
          placeholder="Ej: 2026"
          theme={theme}
        />
        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          Año en el que el estudiante se matricula (4 dígitos, ej: 2026). Campo obligatorio.
        </p>
      </div>

      {/* -------------------- Submit -------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        whileHover={{ scale: 1.02 }}
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
            Registrar cuenta
            <UserPlus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
          </span>
          {/* Efecto de brillo al hover */}
          <div className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            'bg-gradient-to-r from-transparent via-white/20 to-transparent',
            'translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700'
          )} />
        </Button>
      </motion.div>

      {/* -------------------- go to login -------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          type="button"
          onClick={() => navigate('/auth/login')}
          className={cn(
            'w-full relative overflow-hidden',
            'transition-all duration-300',
            'shadow-md hover:shadow-lg',
            'group border-2 h-10',
            theme === 'dark'
              ? 'text-white bg-transparent border-purple-600 hover:bg-purple-600/20 hover:border-purple-500'
              : 'text-purple-600 bg-transparent border-purple-500 hover:bg-purple-500/10 hover:border-purple-600'
          )}
        >
          <span className="relative z-10 flex items-center justify-center">
            Ya tengo una cuenta
            <LogIn className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Button>
      </motion.div>
    </CardContent>
  )
}

export default FormSection