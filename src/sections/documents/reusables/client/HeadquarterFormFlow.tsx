import { ThemeContextProps } from "@/interfaces/context.interface"
import InputSearchableField from "#/common/fields/InputSearchable"
import FormWrapper from "#/ui/step-form/step-form-wrapper"
import IterableCard from "#/common/fields/CardIterable"
import InputField from "#/common/fields/Input"
import { useMemo } from "react"

interface HeadquarterFormProps extends ThemeContextProps {
  options: { cities: any[] }
}

const HeadquarterForm = ({ theme, options }: HeadquarterFormProps) => {
  const cityOptions = useMemo(() =>
    options.cities?.map((c) => ({
      value: c?._id,
      label: `${c.name || 'sin nombre'} - ${c.state?.name || 'sin departamento'} - ${c.state?.country?.name || 'sin país'}`
    })) || [],
    [options.cities]
  )

  return (
    <FormWrapper
      title="Sede"
      theme={theme}
      description="Proporcione la información de la sede."
    >
      <IterableCard
        limit={50}
        theme={theme}
        name="headquarter"
        titleButton="Añadir sede para este cliente"
        fields={[
          {
            name: `headquarter.name`,
            component: <InputField
              theme={theme}
              label="Nombre"
              name={`headquarter.name`}
              placeholder="Nombre de la sede"
            />
          },
          {
            name: `headquarter.address`,
            component: <InputField
              theme={theme}
              label="Dirección"
              name={`headquarter.address`}
              placeholder="Dirección de la sede"
            />
          },
          {
            name: `headquarter.city`,
            component: <InputSearchableField
              theme={theme}
              label="Ciudad"
              options={cityOptions}
              name={`headquarter.city`}
              placeholder="Selecciona la ciudad"
            />
          }
        ]}
      />
    </FormWrapper>
  )
}

export default HeadquarterForm