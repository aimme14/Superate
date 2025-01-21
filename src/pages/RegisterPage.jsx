import { useRegisterForm } from '../hooks/auth/useRegisterForm'
import { FormProvider } from 'react-hook-form'
import { Link } from 'react-router-dom'
import '../styles/Register.css'

const RegisterPage = () => {
  const { methods, onSubmit } = useRegisterForm()

  return (
    <div className="container">
      <h2>Crear Cuenta</h2>

      <FormProvider {...methods}>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Tipo de documento</label>
            <select
              id="typeDocument"
              name="typeDocument"
              {...methods.register('typeDocument')}
            >
              <option value="">Selecciona</option>
              <option value="cc">Cédula de Ciudadanía</option>
              <option value="ti">Tarjeta de Identidad</option>
              <option value="cc">Cédula de ciudadanía</option>
              <option value="pp">Cédula extranjera</option>
              <option value="ti">Tarjeta de identidad</option>
              <option value="pp">Pasaporte</option>
            </select>
            {methods.formState.errors.typeDocument && <p style={{ color: 'yellow' }} className="error">{methods.formState.errors.typeDocument.message}</p>}
          </div>

          <div className="form-group">
            <label>Documento</label>
            <input
              id="document"
              name="document"
              type="text"
              placeholder="Ingresa tu documento"
              {...methods.register('document')}
            />
            {methods.formState.errors.document && <p style={{ color: 'yellow' }} className="error">{methods.formState.errors.document.message}</p>}
          </div>

          <div className="form-group">
            <label>Nombres</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Ingrese su nombre"
              {...methods.register('name')}
            />
            {methods.formState.errors.name && <p style={{ color: 'yellow' }} className="error">{methods.formState.errors.name.message}</p>}
          </div>

          <div className="form-group">
            <label>Apellidos</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Ingrese su apellido"
              {...methods.register('lastName')}
            />
            {methods.formState.errors.lastName && <p style={{ color: 'yellow' }} className="error">{methods.formState.errors.lastName.message}</p>}
          </div>

          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              {...methods.register('email')}
              placeholder="Ingresa tu correo electrónico"
            />
            {methods.formState.errors.email && <p style={{ color: 'red' }} className="error">{methods.formState.errors.email.message}</p>}
          </div>

          <button type="submit" className="btn">REGISTRARME</button>
        </form>
      </FormProvider>
      <p className="login">
        ¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link>
      </p>
    </div>
  )
}

export default RegisterPage;