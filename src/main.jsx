import fondoAnimado from '../public/assets/gif/fondito.gif'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.jsx'
import './styles/index.css'

document.body.style.backgroundImage = `url(${fondoAnimado})`;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)