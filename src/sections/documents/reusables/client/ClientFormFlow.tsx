import { ThemeContextProps } from "@/interfaces/context.interface"
import FormWrapper from "#/ui/step-form/step-form-wrapper"
import CardIterable from "#/common/fields/CardIterable"
import InputField from "#/common/fields/Input"
import ImageField from "#/common/fields/Image"
import { Mail } from "lucide-react"

const ClientForm = ({ theme }: ThemeContextProps) => {
  return (
    <FormWrapper theme={theme} title="Cliente" description="Proporcione la información del cliente.">
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            icon={Mail}
            theme={theme}
            type="email"
            label="Email"
            name="client.email"
            placeholder="Email del cliente"
          />
          <InputField
            icon={Mail}
            theme={theme}
            type="password"
            label="Password"
            name="client.password"
            placeholder="Password del cliente"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            theme={theme}
            label="Nombre"
            name="client.username"
            placeholder="Nombre del cliente"
          />
          <InputField
            theme={theme}
            label="Teléfono"
            name="client.phone"
            placeholder="Teléfono del cliente"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="NIT"
            theme={theme}
            name="client.nit"
            placeholder="NIT del cliente"
          />
          <InputField
            readOnly
            label="Rol"
            theme={theme}
            value="client"
            name="client.role"
            placeholder={`Selecciona el rol`}
          />
        </div>
        <CardIterable
          theme={theme}
          name="client.photoUrl"
          titleButton="Agregar imagen"
          fields={fields.map(field => ({ name: field.name, component: <ImageField {...field} theme={theme} /> }))}
        />
      </div>
    </FormWrapper>
  )
}

export default ClientForm
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
const fields = [{ name: "client.photoUrl.file", label: "Imagen del equipo", sizeImage: "w-60 h-60" }]