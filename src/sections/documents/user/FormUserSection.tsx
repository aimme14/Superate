import { ThemeContextProps } from "@/interfaces/context.interface"
import { useCityForm } from "@/hooks/core/form/useLocationForm"
import { FormProvider } from "react-hook-form"

import SubmitFooter from "#/common/elements/SubmitFooter"
import AlertDialog from "#/common/elements/AlertDialog"
import Skeleton from "#/common/skeletons/SkeletonLarge"
import HeaderForm from "#/common/elements/HeaderForm"
import SelectField from "#/common/fields/Select"
import InputField from "#/common/fields/Input"
import { CardContent } from "#/ui/card"

interface FormCitySectionProps extends ThemeContextProps {
  id: string | undefined
  onChange: () => void
}

const FormCitySection = ({ id, theme, onChange }: FormCitySectionProps) => {
  const { open, methods, isLoading, options, setOpen, onConfirm, handleSubmit } = useCityForm(id, onChange)
  if (isLoading) return <Skeleton theme={theme} />
  return (
    <>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit}>
          {/* -------------------- Header form -------------------- */}
          <HeaderForm
            theme={theme}
            title={id ? "Edición de ciudad" : "Registro de ciudad"}
            description={id ? "Actualiza los datos de la ciudad" : "Diligencia la información para registrar una ciudad"}
          />
          {/* -------------------- Card content -------------------- */}
          <CardContent className="py-6 space-y-6">
            <InputField
              theme={theme}
              name="name"
              label="Nombre"
              placeholder="Nombre de la ciudad"
              type="text"
            />
            <SelectField
              name="state"
              theme={theme}
              options={options}
              label="Departamento"
              placeholder="Selecciona el departamento"
            />
          </CardContent>
          {/* -------------------- Footer form -------------------- */}
          <SubmitFooter
            theme={theme}
            to="/location/cities"
            disabled={!methods.formState.isDirty}
            onCancel={() => { methods.reset(); onChange() }}
          />
        </form>
      </FormProvider>

      <AlertDialog
        open={open}
        theme={theme}
        onConfirm={onConfirm}
        onOpenChange={() => setOpen(false)}
        description={`¿Estás seguro? ${id ? "Se guardará los cambios" : "Se creará una nueva ciudad"}`}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        title="Confirmación"
      />
    </>
  )
}

export default FormCitySection