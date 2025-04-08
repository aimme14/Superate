import { useAuthContext } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import "../styles/DashboardAdmin.css";

const DashboardAdminPage = () => {
  const { signout, user, getUser, testState, toggleTestState  } = useAuthContext()
  const [userData, setUserData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    user?.uid && getUser(user.uid).then((user) => setUserData(user))
  }, [user])

  const handleToggleTest = async (testNumber) => {
    await toggleTestState(testNumber)
  }

  return (
    <div className="dashboard-container">
      <div className="header">
        <img src="assets/img/cerebro_white_only.png" alt="Left Logo" />
        <div className="header-title">
          <h1>Administrador: {userData ? userData.name + ' ' + userData.lastName : 'usuario no encontrado'}</h1>
          <div className="test-buttons">
            <button 
              type='button' 
              className={`toggle-button ${testState.test_1 ? 'active' : ''}`}
              onClick={() => handleToggleTest(1)}
            >
              PRUEBA 1 {testState.test_1 ? '(Activa)' : '(Inactiva)'}
            </button>
            <button 
              type='button'
              className={`toggle-button ${testState.test_2 ? 'active' : ''}`}
              onClick={() => handleToggleTest(2)}
            >
              PRUEBA 2 {testState.test_2 ? '(Activa)' : '(Inactiva)'}
            </button>
            <button 
              type='button'
              className={`toggle-button ${testState.test_3 ? 'active' : ''}`}
              onClick={() => handleToggleTest(3)}
            >
              PRUEBA 3 {testState.test_3 ? '(Activa)' : '(Inactiva)'}
            </button>
          </div>
        </div>
        <img src="assets/img/escudo.png" alt="Right Logo" />
      </div>

      <button className='btn' onClick={() => { signout(); navigate('/') }}>Cerrar sesión</button>
    </div>
  )
}

export default DashboardAdminPage