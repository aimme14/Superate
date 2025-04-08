import { useAuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import '../styles/mate.css';

const Quiz = () => {
    const { testState, loading } = useAuthContext()
    const [answers, setAnswers] = useState({ q1: '', q2: '', q3: '' });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAnswers({ ...answers, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log(answers);
    };

    if (loading) {
        return <div>Cargando...</div>
    }
    return (
        <div>
            {testState.test_1
                ? <Primera handleSubmit={handleSubmit} handleChange={handleChange} />
                : (testState.test_2
                    ? <Segunda />
                    : (testState.test_3
                        ? <Tercera />
                        : <div>No hay pruebas</div>))}
        </div>
    );
};

export default Quiz;


const Primera = ({ handleSubmit , handleChange}) => {
    const navigate = useNavigate()
    return (
        <>
            <h1>Simulacro Tipo ICFES</h1>
            <form id="quiz-form" onSubmit={handleSubmit} onChange={handleChange}>
                <div className="question">
                    <h3>1. ¿Cuál es la capital de Colombia?</h3>
                    <label>
                        <input type="radio" name="q1" value="A" required />
                        A) Medellín
                    </label>
                    <label>
                        <input type="radio" name="q1" value="B" />
                        B) Cali
                    </label>
                    <label>
                        <input type="radio" name="q1" value="C" />
                        C) Bogotá
                    </label>
                    <label>
                        <input type="radio" name="q1" value="D" />
                        D) Barranquilla
                    </label>
                </div>

                <div className="question">
                    <h3>2. ¿Qué resultado da 3 × 4?</h3>
                    <label>
                        <input type="radio" name="q2" value="A" required />
                        A) 7
                    </label>
                    <label>
                        <input type="radio" name="q2" value="B" />
                        B) 12
                    </label>
                    <label>
                        <input type="radio" name="q2" value="C" />
                        C) 9
                    </label>
                    <label>
                        <input type="radio" name="q2" value="D" />
                        D) 6
                    </label>
                </div>

                <div className="question">
                    <h3>3. ¿Quién escribió *Cien años de soledad*?</h3>
                    <label>
                        <input type="radio" name="q3" value="A" required />
                        A) Pablo Neruda
                    </label>
                    <label>
                        <input type="radio" name="q3" value="B" />
                        B) Gabriel García Márquez
                    </label>
                    <label>
                        <input type="radio" name="q3" value="C" />
                        C) Mario Vargas Llosa
                    </label>
                    <label>
                        <input type="radio" name="q3" value="D" />
                        D) Julio Cortázar
                    </label>
                </div>

                <button onClick={() => navigate('/dashboard')} type="submit">Enviar respuestas</button>
            </form>
        </>
    )
}


const Segunda = () => {
    return (
        <div>
            <h1>Simulacro Tipo ICFES</h1>
        </div>
    )
}

const Tercera = () => {
    return (
        <div>
            <h1>Simulacro Tipo ICFES</h1>
        </div>
    )
}