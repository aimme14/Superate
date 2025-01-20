import { useLoginForm } from '../hooks/auth/useLoginForm'
import { useAuthContext } from '../context/AuthContext'
import { FormProvider } from 'react-hook-form'
import { Link } from 'react-router-dom'
import '@/styles/Home.css'

const HomePage = () => {
  const { methods, onSubmit } = useLoginForm()
  const { user, signout } = useAuthContext()

  console.log(user)

  // if (user) {return <Navigate to="/dashboard" />}

  return (
    <>
      {/* <!-- Contenedor de las imágenes (izquierda) --> */}
      <div className="images-container">
        {/* <!-- Imagen superior con texto "SUPÉRATE" --> */}
        <div className="image-birrete">
          <h1>SUPÉRATE</h1>
          <img src="assets/img/image.png" alt="Logo de SUPÉRATE" />
        </div>

        {/* <!-- Imagen inferior más grande --> */}
        <img className="image-ai" src="assets/img/cerebro_white_only.png" alt="Imagen de Inteligencia Artificial" />
      </div>

      {/* <!-- Cuadro negro (derecha) --> */}
      <div className="container">
        <h1>SUPÉRATE</h1>
        <p>¡Bienvenido!</p>

        <div className="form-group">
          <label htmlFor="document-type">Tipo de documento</label>
          <select id="document-type" name="document-type">
            <option value="">Selecciona</option>
            <option value="cc">Cédula de ciudadanía</option>
            <option value="ti">Tarjeta de identidad</option>
            <option value="pp">Pasaporte</option>
          </select>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <input {...methods.register('email')} type="text" id="document" name="email" placeholder="Correo electrónico" />
            </div>
            <div className="form-group">
              <input {...methods.register('password')} type="password" id="password" name="password" placeholder="Contraseña" />
            </div>

            <button type="submit" className="btn">Ingresar</button>
          </form>

          <div className="register">
            <p>O</p>
            <Link to="/registro">Regístrate</Link>
          </div>

          <button onClick={() => signout()}>Cerrar sesión</button>
        </FormProvider>
      </div>
    </>
  )
}

export default HomePage