import React from 'react';
import '../styles/Welcome.css';
import { Link } from 'react-router-dom';

const Welcome = () => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1>¡Bienvenido!</h1>
        <p className="subtitle">Nos alegra tenerte aquí</p>
        <p className="content">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        </p>
        
        <div className="cta-buttons">
          <Link to="/dashboard">
            <button className="primary-btn">Comenzar</button>
          </Link>
        </div>
        
      </div>
    </div>
  );
};

export default Welcome;     