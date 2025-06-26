import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookOpen, Play, Users, Timer, HelpCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"

// Datos de ejemplo para el examen
const examData = {
  title: "Examen de Lectura Crítica",
  description: "Evaluación de habilidades de pensamiento crítico y comprensión lectora",
  timeLimit: 30, // minutos
  module: "Módulo de Lectura Crítica",
  totalQuestions: 25,
  instructions: [
    "Lee cuidadosamente cada pregunta antes de responder",
    "Solo hay una respuesta correcta por pregunta",
    "Puedes navegar entre preguntas usando los botones o el panel lateral",
    "El tiempo es limitado, administra bien tu tiempo",
    "Una vez enviado el examen, no podrás modificar tus respuestas"
  ],
  questions: [
    {
      id: 1,
      text: "“Valeria disfruta leer en la biblioteca del colegio, especialmente en las tardes. Su libro favorito es Cien años de soledad, aunque confiesa que a veces se pierde entre tantos personajes. Aun así, insiste en que leerla es como entrar a otro mundo.” ¿Por qué Valeria considera especial la lectura de Cien años de soledad?",
      options: [
        { id: "a", text: "Porque la comprende perfectamente." },
        { id: "b", text: "Porque la leyó en la escuela." },
        { id: "c", text: "Porque la transporta a otro mundo." },
        { id: "d", text: "Porque odia los personajes." },
      ],
      correctAnswer: "c",
    },

    /*{
      id: 2,
      text: "“A pesar de los avances en acceso a Internet, muchos niños de zonas rurales siguen teniendo dificultades para conectarse. María, por ejemplo, debe caminar 4 kilómetros para llegar a una señal estable. Esto limita no solo su acceso a clases, sino también su oportunidad de aprender por cuenta propia.” ¿Cuál es la principal limitación educativa que enfrenta María?",
      options: [
        { id: "a", text: "No tiene computador." },
        { id: "b", text: "No sabe leer." },
        { id: "c", text: "Tiene mala señal de internet." },
        { id: "d", text: "No va a la escuela." },
      ],
      correctAnswer: "c",
    },
    {
      id: 3,
      text: "“En su ensayo, el sociólogo Manuel Castells afirma que el conocimiento ha dejado de ser una posesión exclusiva de las élites. Gracias a Internet, cualquiera puede acceder a información antes reservada para unos pocos. Sin embargo, Castells también advierte que el exceso de datos sin orientación crítica puede generar confusión en lugar de sabiduría.¿Qué advertencia hace el autor sobre el acceso libre al conocimiento?”",
      options: [
        { id: "a", text: "Que todos son sabios ahora." },
        { id: "b", text: "Que se pierde tiempo en Internet." },
        { id: "c", text: "Que el conocimiento masivo no garantiza pensamiento crítico." },
        { id: "d", text: "Que la élite aún tiene el control." },
      ],
      correctAnswer: "c",
    },
    {
      id: 4,
      text: "“Apenas salió del consultorio, Camilo llamó a su madre. Tenía la voz temblorosa, pero intentó sonar tranquilo. —‘Todo bien, ma... solo fue un chequeo’—, dijo, mientras sostenía en la otra mano una orden de exámenes urgentes.”¿Qué se puede inferir sobre Camilo?",
      options: [
        { id: "a", text: "Está feliz con los resultados." },
        { id: "b", text: "Engaña a su mamá." },
        { id: "c", text: "Está preocupado pero no lo quiere demostrar." },
        { id: "d", text: "Tiene gripa." },
      ],
      correctAnswer: "c",
    },
    {
      id: 5,
      text: "“El cielo estaba gris, y el viento agitaba con fuerza las cortinas. Marta cerró el libro, se puso su impermeable y salió sin mirar atrás.” ¿Qué elemento del ambiente condiciona la acción de Marta?",
      options: [
        { id: "a", text: "La temperatura del día." },
        { id: "b", text: "El clima lluvioso." },
        { id: "c", text: "La falta de luz." },
        { id: "d", text: "El ruido exterior." },
      ],
      correctAnswer: "b",
    },
    {
      id: 6,
      text: "“Durante la pandemia, Andrés aprendió a cocinar viendo videos en línea. Hoy, prepara platos típicos con más precisión que muchos adultos de su familia. Aunque no ha salido de su ciudad, se ha vuelto experto en recetas tailandesas, mexicanas y japonesas. Su mamá dice que, gracias a Internet, su hijo ha ‘viajado con el paladar’.” ¿Qué se puede inferir de la frase “viajado con el paladar”?",
      options: [
        { id: "a", text: "Andrés es un viajero profesional." },
        { id: "b", text: "Solo cocina comida colombiana." },
        { id: "c", text: "Su aprendizaje culinario le ha permitido explorar otras culturas." },
        { id: "d", text: "No sabe nada de cocina." },
      ],
      correctAnswer: "c",
    },
    {
      id: 7,
      text: "“Todos los mamíferos son vertebrados. Las ballenas son mamíferos. Por tanto, las ballenas son vertebrados.” ¿Qué tipo de razonamiento se emplea en este texto?",
      options: [
        { id: "a", text: "Analogía" },
        { id: "b", text: "Inducción" },
        { id: "c", text: "Deducción" },
        { id: "d", text: "Hipótesis" },
      ],
      correctAnswer: "c",
    },
    {
      id: 8,
      text: "“Algunos padres prohíben el uso del celular entre semana. Argumentan que los estudiantes se distraen más y duermen menos. Otros, en cambio, permiten su uso como parte del proceso educativo. Ambos grupos coinciden en que el control debe estar guiado por criterios claros y objetivos.”¿Cuál es el punto de coincidencia entre ambos grupos?",
      options: [
        { id: "a", text: "Que el celular solo debe usarse el fin de semana." },
        { id: "b", text: "Que los padres deben castigar más." },
        { id: "c", text: "Que el uso del celular debe tener reglas claras." },
        { id: "d", text: "Que el celular solo debe usarse en clase." },
      ],
      correctAnswer: "c",
    },
    {
      id: 9,
      text: "“La paradoja de la educación moderna es que tenemos acceso a más información que nunca, pero menos tiempo para pensarla. Leemos más titulares que artículos, más opiniones que argumentos. Tal vez la sobreinformación ha generado una especie de ‘analfabetismo crítico’: sabemos leer, pero no siempre entendemos lo que leemos.¿Cuál es la conclusión implícita del texto?”",
      options: [
        { id: "a", text: "Que hay que reducir el uso del celular." },
        { id: "b", text: "Que todos deberían estudiar filosofía." },
        { id: "c", text: "Que el exceso de información ha debilitado la comprensión crítica." },
        { id: "d", text: "Que es mejor ver televisión que leer." },
      ],
      correctAnswer: "c",
    },
    {
      id: 10,
      text: "“Un youtuber dijo: ‘Los videojuegos hacen que los niños se vuelvan violentos’. Sin embargo, no presentó estudios ni pruebas. Solo compartió su opinión.”¿Qué le falta al argumento del youtuber para ser válido?",
      options: [
        { id: "a", text: "Más suscriptores." },
        { id: "b", text: "Evidencia que lo respalde." },
        { id: "c", text: "Comentarios positivos." },
        { id: "d", text: "Lenguaje más técnico." },
      ],
      correctAnswer: "b",
    },
    {
      id: 11,
      text: "“Una campaña publicitaria afirma que su bebida es ‘más natural que el agua’. Sin embargo, contiene colorantes artificiales, conservantes y altos niveles de azúcar.”¿Cuál es la conclusión implícita del texto?",
      options: [
        { id: "a", text: "Falsa causa" },
        { id: "b", text: "Generalización apresurada" },
        { id: "c", text: "Apelación emocional" },
        { id: "d", text: "Publicidad engañosa" },
      ],
      correctAnswer: "d",
    },
    {
      id: 12,
      text: "“Una senadora afirmó que los jóvenes no leen porque tienen muchos videojuegos. Pero los datos del Ministerio muestran que el promedio de lectura entre adolescentes ha aumentado en los últimos cinco años, especialmente en formatos digitales.”¿Qué crítica hace el texto a la afirmación de la senadora?",
      options: [
        { id: "a", text: "Que los videojuegos son peligrosos." },
        { id: "b", text: "Que los jóvenes no saben leer." },
        { id: "c", text: "Que sus declaraciones no se ajustan a los datos reales." },
        { id: "d", text: "Que debería regular los videojuegos." },
      ],
      correctAnswer: "c",
    },
    {
      id: 13,
      text: "“La lectura fortalece la empatía porque permite ponerse en el lugar de otros personajes y vivir distintas realidades.”¿Qué afirmación refuerza esta idea?",
      options: [
        { id: "a", text: "Leer hace que uno se distraiga más." },
        { id: "b", text: "Los libros ayudan a entender emociones ajenas." },
        { id: "c", text: "La empatía se aprende viendo películas." },
        { id: "d", text: "Leer es obligatorio en la escuela." },
      ],
      correctAnswer: "b",
    },
    {
      id: 14,
      text: "“Los estudiantes que practican la escritura argumentativa desde jóvenes tienden a razonar mejor, analizar posturas y construir ideas con lógica.”¿Cuál de estas propuestas respalda la idea del texto?",
      options: [
        { id: "a", text: "Que los videojuegos son peligrosos." },
        { id: "b", text: "Que los jóvenes no saben leer." },
        { id: "c", text: "Que sus declaraciones no se ajustan a los datos reales." },
        { id: "d", text: "Que debería regular los videojuegos." },
      ],
      correctAnswer: "c",
    },
    {
      id: 15,
      text: "“Para fomentar la lectura crítica, se sugiere que los estudiantes analicen fake news reales. Esta estrategia no solo mejora su comprensión, sino también su criterio frente a lo que consumen en redes sociales.”¿Qué afirmación complementa y fortalece esta propuesta?",
      options: [
        { id: "a", text: "El análisis de fake news permite detectar errores argumentativos comunes." },
        { id: "b", text: "Las redes sociales son malas para los estudiantes." },
        { id: "c", text: "Todas las noticias en Internet son falsas." },
        { id: "d", text: "Es mejor no usar tecnología en clase." },
      ],
      correctAnswer: "a",
    },*/
  ]

}

const ExamWithWelcome = () => {
  const [examState, setExamState] = useState<'welcome' | 'active' | 'completed'>('welcome')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(examData.timeLimit * 60)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const navigate = useNavigate()

  // Componente de Bienvenida
  const WelcomeScreen = () => (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="h-20 w-20 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-amber-400 rounded-full flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent mb-2">
            ¡Bienvenido al {examData.title}!
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 max-w-2xl mx-auto">
            {examData.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información del examen */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <Timer className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-900">{examData.timeLimit} minutos</div>
              <div className="text-sm text-gray-500">Tiempo límite</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <HelpCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-900">{examData.questions.length} preguntas</div>
              <div className="text-sm text-gray-500">Total de preguntas</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
              <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <div className="font-semibold text-gray-900">Opción múltiple</div>
              <div className="text-sm text-gray-500">Tipo de pregunta</div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="bg-white rounded-lg p-6 border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Instrucciones importantes
            </h3>
            <ul className="space-y-3">
              {examData.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <span className="text-gray-700">{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Advertencia */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">¡Importante!</AlertTitle>
            <AlertDescription className="text-amber-700">
              Una vez que inicies el examen, el cronómetro comenzará a correr. Asegúrate de tener una conexión estable a internet y un ambiente tranquilo para concentrarte.
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex justify-center pt-6">
          <Button
            onClick={() => setExamState('active')}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Play className="h-5 w-5 mr-2" />
            Iniciar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && examState === 'active') {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && examState === 'active') {
      handleSubmit(true)
    }
  }, [timeLeft, examState])

  // Prevent page reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (examState === 'active') {
        e.preventDefault()
        e.returnValue = "¿Estás seguro que deseas salir? Tu progreso se perderá."
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => { window.removeEventListener("beforeunload", handleBeforeUnload) }
  }, [examState])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [examData.questions[currentQuestion].id]: value })
    setShowWarning(false)
  }

  const goToNextQuestion = () => {
    if (currentQuestion < examData.questions.length - 1) { 
      setCurrentQuestion(currentQuestion + 1) 
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0) { 
      setCurrentQuestion(currentQuestion - 1) 
    }
  }

  const handleSubmit = (timeExpired = false) => {
    if (!timeExpired && Object.keys(answers).length < examData.questions.length) {
      setShowWarning(true)
      return
    }

    setExamState('completed')
    
    // Aquí iría la lógica para enviar las respuestas a Firebase
    console.log("Respuestas enviadas:", answers)
  }

  const progress = ((currentQuestion + 1) / examData.questions.length) * 100
  const question = examData.questions[currentQuestion]
  const answeredQuestions = Object.keys(answers).length

  // Pantalla de bienvenida
  if (examState === 'welcome') {
    return <WelcomeScreen />
  }

  // Pantalla de examen completado
  if (examState === 'completed') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-800">¡Examen Completado!</CardTitle>
            <CardDescription className="text-lg">
              Has finalizado el {examData.title} exitosamente
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Preguntas respondidas</div>
              <div className="text-2xl font-bold text-gray-900">{answeredQuestions} de {examData.questions.length}</div>
            </div>
            <p className="text-gray-600">
              Tus respuestas han sido registradas. Los resultados serán procesados y podrás consultarlos próximamente en tu perfil.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              onClick={() => navigate('/new-dashboard')}
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              Volver al Inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Pantalla del examen activo
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Contenido principal del examen */}
      <div className="flex-1">
        {/* Módulo con miniatura */}
        <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
              <BookOpen className="w-16 h-16 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm text-gray-500 font-medium">Estás realizando:</h3>
              <h2 className="text-lg font-bold">{examData.module}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <Clock className="h-4 w-4" />
                <span>{examData.timeLimit} minutos</span>
                <span className="mx-1">•</span>
                <span>{examData.questions.length} preguntas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">{examData.title}</h2>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border shadow-sm">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">
              {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>
              Pregunta {currentQuestion + 1} de {examData.questions.length}
            </span>
            <span>{answeredQuestions} respondidas</span>
          </div>
        </div>

        {showWarning && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Preguntas sin responder</AlertTitle>
            <AlertDescription>Debes responder todas las preguntas antes de enviar el examen.</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Pregunta {question.id}</CardTitle>
            <CardDescription className="text-base font-medium text-gray-800 mt-2">{question.text}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={answers[question.id] || ""} onValueChange={handleAnswer} className="space-y-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-start space-x-2 border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <RadioGroupItem value={option.id} id={`option-${option.id}`} className="mt-1" />
                  <Label htmlFor={`option-${option.id}`} className="flex-1 cursor-pointer">
                    <span className="font-semibold">{option.id.toUpperCase()}.</span> {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestion === 0}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            {currentQuestion < examData.questions.length - 1 ? (
              <Button onClick={goToNextQuestion} className="flex items-center gap-1">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSubmit(false)}
                className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 flex items-center gap-1"
              >
                Enviar <Send className="h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Panel lateral derecho con navegación de preguntas */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <div className="bg-white border rounded-lg p-4 sticky top-20">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            Navegación
          </h3>
          <div className="space-y-3">
            {examData.questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${currentQuestion === index ? "bg-purple-50 border-purple-200 border" : "border hover:bg-gray-50"
                  }`}
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${answers[q.id]
                    ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 border"
                    }`}
                >
                  {q.id}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium truncate">Pregunta {q.id}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    {answers[q.id] ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>Respondida</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        <span>Sin responder</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500 mb-2">Progreso del examen</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {answeredQuestions}/{examData.questions.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((answeredQuestions / examData.questions.length) * 100)}%
              </span>
            </div>
            <Progress value={(answeredQuestions / examData.questions.length) * 100} className="h-2" />

            <Button
              onClick={() => handleSubmit(false)}
              disabled={Object.keys(answers).length < examData.questions.length}
              className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            >
              Finalizar examen
            </Button>

            {Object.keys(answers).length < examData.questions.length && (
              <p className="text-xs text-center mt-2 text-orange-500">
                Debes responder todas las preguntas para finalizar
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamWithWelcome