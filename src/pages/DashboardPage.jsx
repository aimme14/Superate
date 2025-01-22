import { useAuthContext } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import "../styles/Dashboard.css";

const DashboardPage = () => {
  const { signout, user, getUser } = useAuthContext()
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    user?.uid && getUser(user.uid).then((user) => setUserData(user))
  }, [user])

  return (
    <div className="dashboard-container">
      <div className="header">
        <img src="assets/img/cerebro_white_only.png" alt="Left Logo" />
        <div className="header-title">
          <h1>Estudiante: {userData ? userData.name + ' ' + userData.lastName : 'usuario no encontrado'}</h1>
          <p>Puntuación Total: <span>0</span></p>
          <div className="test-buttons">
            <button>PRUEBA 1</button>
            <button>PRUEBA 2</button>
            <button>PRUEBA 3</button>
          </div>
        </div>
        <img src="assets/img/escudo.png" alt="Right Logo" />
      </div>
      <div className="main-content">
        <div className="card-container">
          <div className="card">
            <h3>Matemáticas</h3>
            <span>0</span>
          </div>
          <div className="card">
            <h3>Naturales</h3>
            <span>0</span>
          </div>
          <div className="card">
            <h3>Lectura Crítica</h3>
            <span>0</span>
          </div>
          <div className="card">
            <h3>Competencias Ciudadanas</h3>
            <span>0</span>
          </div>
          <div className="card">
            <h3>Inglés</h3>
            <span>0</span>
          </div>
        </div>
        <div className="actions">
          <button>Análisis del desempeño<img src="assets/img/logotipo.png" alt="Icono" /></button>
          <button>Plan de estudio personalizado <img src="assets/img/logotipo.png" alt="Icono" /></button>
          <button>Recomendaciones<img src="assets/img/logotipo.png" alt="Icono" /></button>
        </div>
      </div>

      <button className='btn' onClick={() => { signout(); navigate('/') }}>Cerrar sesión</button>
    </div>
  )
}

export default DashboardPage