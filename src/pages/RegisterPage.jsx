import { Link } from 'react-router-dom'
import '../styles/Register.css'

const RegisterPage = () => {
  return (
    <div className="container">
      <h2>Crear Cuenta</h2>
      <form>
        <div className="form-group">
          <label htmlFor="document-type">Tipo de documento</label>
          <select id="document-type" name="document-type">
            <option value="">Selecciona</option>
            <option value="cc">Cédula de ciudadanía</option>
            <option value="pp">Cédula extranjera</option>
            <option value="ti">Tarjeta de identidad</option>
            <option value="pp">Pasaporte</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="document">Documento</label>
          <input type="text" id="document" name="document" placeholder="Ingresa tu documento" />
        </div>

        <div className="form-group">
          <label htmlFor="name">Nombres </label>
          <input type="name" id="name" name="name" placeholder="Ingrese su nombre" />
        </div>

        <div className="form-group">
          <label htmlFor="last-name">Apellidos </label>
          <input type="last-name" id="last-name" name="last-name" placeholder="Ingrese su apellido" />
        </div>

        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input type="email" id="email" name="email" placeholder="Ingresa tu correo electrónico" />
        </div>

        <button type="submit" className="btn">Registrarme</button>

        <div className="login">
          <p>¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link></p>
        </div>
      </form>
    </div>
  )
}

export default RegisterPage