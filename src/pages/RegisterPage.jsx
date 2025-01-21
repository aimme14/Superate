import { Link } from 'react-router-dom'
import '../styles/Register.css'

const RegisterPage = () => {
  const { methods, onSubmit } = useRegisterForm()

  console.log(methods.formState.errors)
  console.log(methods.getValues())
  return (
    <div className="container">
      <h2>Crear Cuenta</h2>
      
      <FormProvider {...methods}>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="typeDocument">Tipo de documento</label>
            <select {...methods.register('typeDocument')} id="typeDocument" name="typeDocument">
              <option value="">Selecciona</option>
              <option value="cc">Cédula de ciudadanía</option>
              <option value="pp">Cédula extranjera</option>
              <option value="ti">Tarjeta de identidad</option>
              <option value="pp">Pasaporte</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="document">Documento</label>
            <input {...methods.register('document')} type="text" id="document" name="document" placeholder="Ingresa tu documento" />
          </div>

          <div className="form-group">
            <label htmlFor="name">Nombres </label>
            <input {...methods.register('name')} type="name" id="name" name="name" placeholder="Ingrese su nombre" />
          </div>

          <div className="form-group">
            <label htmlFor="last-name">Apellidos </label>
            <input {...methods.register('lastName')} type="last-name" id="last-name" name="last-name" placeholder="Ingrese su apellido" />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input {...methods.register('email')} type="email" id="email" name="email" placeholder="Ingresa tu correo electrónico" />
          </div>

          <button type="submit" className="btn">Registrarme</button>

          <div className="login">
            <p>¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link></p>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}

export default RegisterPage