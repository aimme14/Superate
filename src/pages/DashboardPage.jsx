import { useAuthContext } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import "../styles/Dashboard.css";

const DashboardPage = () => {
  const { signout, user, getUser, getStateTest } = useAuthContext()
  const [userData, setUserData] = useState(null)
  const [testState, setTestState] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.uid) {
      getUser(user.uid).then((userData) => {
        setUserData(userData)
      })
      getStateTest().then((state) => {
        setTestState(state)
      })
    }
  }, [user])

  const handleToggleTest = async (testNumber) => {
    const key = `test_${testNumber}`
    const access = testState[key]
  }



  return (
    <div className="dashboard-container">
      <div className="header">
        <img src="public/assets/img/cerebro_negro.png" alt="Left Logo" />
        <div className="header-title">
          <h1>Estudiante: {userData ? userData.name + ' ' + userData.lastName : 'usuario no encontrado'}</h1>
          <p>Puntuación Total: <span>{0}</span></p>
          <div className="test-buttons">
            <button className={`toggle-button ${testState?.test_1 ? 'active' : ''}`} onClick={() => handleToggleTest(1)}>PRUEBA 1</button>
            <button className={`toggle-button ${testState?.test_2 ? 'active' : ''}`} onClick={() => handleToggleTest(2)}>PRUEBA 2</button>
            <button className={`toggle-button ${testState?.test_3 ? 'active' : ''}`} onClick={() => handleToggleTest(3)}>PRUEBA 3</button>
          </div>
        </div>
        <img src="assets/img/escudo.png" alt="Right Logo" />
      </div>

      <div className="main-content">
        
          <div className="card-buttons">
          <div className="card-container">
           <div className="card">
           <h5>Lectura Crítica</h5>  
           <p>en esta prueba se evaluará la capacidad de los estudiantes para comprender y analizar textos de diversos géneros y estilos, así como para identificar y evaluar argumentos y evidencias.</p>
             <button onClick={() => navigate('/mate')}>Matemáticas</button>
             <h3>0</h3>
           </div>
           <div className="card">
           <h5>Lectura Crítica</h5>  
           <p>en esta prueba se evaluará la capacidad de los estudiantes para comprender y analizar textos de diversos géneros y estilos, así como para identificar y evaluar argumentos y evidencias.</p>
             <button>Naturales</button>
             <h3>0</h3>
           </div>
           <div className="card">
            <h5>Lectura Crítica</h5>  
            <p>en esta prueba se evaluará la capacidad de los estudiantes para comprender y analizar textos de diversos géneros y estilos, así como para identificar y evaluar argumentos y evidencias.</p>
            <button>Lectura Crítica</button>
             <h3>0</h3>
           </div>
           <div className="card">
           <h5>Lectura Crítica</h5>  
           <p>en esta prueba se evaluará la capacidad de los estudiantes para comprender y analizar textos de diversos géneros y estilos, así como para identificar y evaluar argumentos y evidencias.</p>
             <button>Competencias Ciudadanas</button>
             <h3>0</h3>
           </div>
           <div className="card">
           <h5>Lectura Crítica</h5>  
           <p>en esta prueba se evaluará la capacidad de los estudiantes para comprender y analizar textos de diversos géneros y estilos, así como para identificar y evaluar argumentos y evidencias.</p>
             <button>Inglés</button>
             <h3>0</h3>
           </div>
         </div>
        </div>
        <div className="actions">
          <button onClick={() => navigate('/analysis')}>
            Análisis del desempeño
            <img src="assets/img/logotipo.png" alt="Icono" />
          </button>
          <button onClick={() => navigate('/study-plan')}>
            Plan de estudio personalizado
            <img src="assets/img/logotipo.png" alt="Icono" />
          </button>
          <button onClick={() => navigate('/recommendations')}>
            Recomendaciones
            <img src="assets/img/logotipo.png" alt="Icono" />
          </button>
        </div>
      </div>

      <button className='btn' onClick={() => { signout(); navigate('/') }}>
        Cerrar sesión
      </button>
    </div>
  )
}

export default DashboardPage