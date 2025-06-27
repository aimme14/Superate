import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, Calculator, Timer, HelpCircle, Users, Play, Maximize, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate } from "react-router-dom"

// Datos de ejemplo para el examen
const examData = {
  title: "Examen de Matemáticas",
  description: "Evaluación de habilidades de pensamiento crítico y comprensión lectora",
  timeLimit: 30, // minutos
  module: "Módulo de Matemáticas",
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
      text: "María tiene 7 manzanas más que Pedro. Si Pedro tiene \( x \) manzanas, y entre los dos tienen 17, ¿cuántas manzanas tiene Pedro?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
        { id: "c", text: "7" },
        { id: "d", text: "10" },
      ],
      correctAnswer: "b",
    },
   /** {
      id: 2,
      text: "En una fábrica, el doble del número de operarios menos tres es igual a 11. ¿Cuántos operarios hay?",
      options: [
        { id: "a", text: "6" },
        { id: "b", text: "7" },
        { id: "c", text: "8" },
        { id: "d", text: "9" },
      ],
      correctAnswer: "a",
    },
    {
      id: 3,
      text: "Un jardín rectangular tiene un área representada por \( x^2 - 5x + 6 \). ¿Cuál sería la factorización de esta expresión para conocer sus dimensiones?",
      options: [
        { id: "a", text: "(x-3)(x-2)" },
        { id: "b", text: "(x+3)(x+2)" },
        { id: "c", text: "(x+3)(x-2)" },
        { id: "d", text: "(x-3)(x+2)" },
      ],
      correctAnswer: "a",
    },
    {
      id: 4,
      text: "La diferencia de edades entre Ana y su hijo es de 49 años. Si esa diferencia se representa como \( x^2 = 49 \), ¿cuántos años tiene Ana más que su hijo?",
      options: [
        { id: "a", text: "7" },
        { id: "b", text: "-7" },
        { id: "c", text: "7 y -7" },
        { id: "d", text: "0" },

      ],
      correctAnswer: "c",
    },
    {
      id: 5,
      text: "En una cuenta bancaria, al retirar 4 dólares de una cuenta con \( 3x \) dólares se obtiene lo mismo que en otra cuenta con \( 2x + 5 \) dólares. ¿Cuál es el valor de \( x \)?",
      options: [
        { id: "a", text: "1" },
        { id: "b", text: "-9" },
        { id: "c", text: "9" },
        { id: "d", text: "-1" },
      ],
      correctAnswer: "c",
    },
    {
      id: 6,
      text: "Un jardinero quiere cubrir un triángulo de césped con fertilizante. Si la base del triángulo es de 6 m y la altura es de 8 m, ¿cuál es el área a cubrir?",
      options: [
        { id: "a", text: "24 m²" },
        { id: "b", text: "36 m²" },
        { id: "c", text: "48 m²" },
        { id: "d", text: "96 m²" },

      ],
      correctAnswer: "c",
    },
    {
      id: 7,
      text: "Un terreno cuadrado tiene un perímetro de 20 m. ¿Cuánto mide cada lado?",
      options: [
        { id: "a", text: "4 m" },
        { id: "b", text: "5 m" },
        { id: "c", text: "10 m" },
        { id: "d", text: "20 m" },
      ],
      correctAnswer: "b",
    },

    {
      id: 8,
      text: "Una caja cúbica de regalos mide 3 cm de lado. ¿Cuál es su volumen?",
      options: [
        { id: "a", text: "6 cm³" },
        { id: "b", text: "9 cm³" },
        { id: "c", text: "27 cm³" },
        { id: "d", text: "81 cm³" },


      ],
      correctAnswer: "c",
    },

    {
      id: 9,
      text: "Se quiere cubrir completamente el interior de una figura hexagonal. ¿Cuánto suman todos sus ángulos internos?",
      options: [
        { id: "a", text: "360°" },
        { id: "b", text: "540°" },
        { id: "c", text: "720°" },
        { id: "d", text: "900°" },

      ],
      correctAnswer: "c",
    },

    {
      id: 10,
      text: "Dos faroles están colocados de forma que el ángulo entre sus haces de luz es de 65°. ¿Cuál es el ángulo que completa los 180°?",
      options: [
        { id: "a", text: "25°" },
        { id: "b", text: "105°" },
        { id: "c", text: "115°" },
        { id: "d", text: "135°" },


      ],
      correctAnswer: "c",
    },**/

  ],

}

const ExamWithWelcome = () => {
  const navigate = useNavigate()
  const [examState, setExamState] = useState('welcome')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(examData.timeLimit * 60)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)

  // Función para entrar en pantalla completa
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen()
      } else if (document.documentElement.msRequestFullscreen) {
        await document.documentElement.msRequestFullscreen()
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error)
    }
  }

  // Función para salir de pantalla completa
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen()
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error)
    }
  }

  // Detectar cambios de pestaña y pérdida de foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (examState === 'active' && document.hidden) {
        setTabChangeCount(prev => prev + 1)
        setShowTabChangeWarning(true)
        
        // Si es la tercera vez, bloquear el examen
        if (tabChangeCount >= 2) {
          setExamLocked(true)
          handleSubmit(true) // Finalizar automáticamente
        }
      }
    }

    const handleWindowBlur = () => {
      if (examState === 'active') {
        setTabChangeCount(prev => prev + 1)
        setShowTabChangeWarning(true)
        
        if (tabChangeCount >= 2) {
          setExamLocked(true)
          handleSubmit(true)
        }
      }
    }

    const handleWindowFocus = () => {
      if (examState === 'active' && showTabChangeWarning && !examLocked) {
        // El warning se mantiene visible hasta que el usuario decida
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [examState, tabChangeCount, showTabChangeWarning, examLocked])
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      )
      
      setIsFullscreen(isCurrentlyFullscreen)
      
      // Si el examen está activo y se sale de pantalla completa, mostrar alerta
      if (examState === 'active' && !isCurrentlyFullscreen) {
        setShowFullscreenExit(true)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [examState])

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    await enterFullscreen()
    setExamState('active')
  }

  // Manejar salida de pantalla completa durante el examen
  const handleExitFullscreen = async () => {
    setShowFullscreenExit(false)
    setExamState('completed')
    await exitFullscreen()
  }

  // Volver al examen en pantalla completa
  const returnToExam = async () => {
    setShowFullscreenExit(false)
    await enterFullscreen()
  }

  // Continuar examen después de advertencia de cambio de pestaña
  const continueExam = () => {
    setShowTabChangeWarning(false)
  }

  // Finalizar examen por cambio de pestaña
  const finishExamByTabChange = async () => {
    setShowTabChangeWarning(false)
    setExamLocked(true)
    await handleSubmit(true)
  }

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
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-blue-400 rounded-full flex items-center justify-center">
                <Calculator className="h-4 w-4 text-white" />
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

          {/* Advertencia cambio de pestaña */}
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Control de Pestañas</AlertTitle>
            <AlertDescription className="text-red-700">
              El sistema detectará si cambias de pestaña o pierdes el foco de la ventana. Después de 3 intentos, el examen se finalizará automáticamente.
            </AlertDescription>
          </Alert>
          <Alert className="border-purple-200 bg-purple-50">
            <Maximize className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-800">Modo Pantalla Completa</AlertTitle>
            <AlertDescription className="text-purple-700">
              El examen se realizará en pantalla completa. Si sales de este modo durante la prueba, se mostrará una alerta y podrás elegir entre volver al examen o finalizarlo automáticamente.
            </AlertDescription>
          </Alert>

          {/* Advertencia general */}
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
            onClick={startExam}
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

  // Modal de advertencia de cambio de pestaña
  const TabChangeWarningModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-orange-800">¡Advertencia!</CardTitle>
          <CardDescription className="text-base">
            Cambio de pestaña detectado
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="bg-orange-50 rounded-lg p-4 mb-4">
            <div className="text-sm text-orange-600 mb-1">Intentos restantes</div>
            <div className="text-2xl font-bold text-orange-800">{3 - tabChangeCount}</div>
          </div>
          <p className="text-gray-700 mb-2">
            Has cambiado de pestaña o perdido el foco de la ventana del examen.
          </p>
          <p className="text-sm text-red-600 font-medium">
            {tabChangeCount >= 2 
              ? "¡Último aviso! El próximo cambio finalizará el examen automáticamente."
              : `Después de ${3 - tabChangeCount} intentos más, el examen se finalizará automáticamente.`
            }
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={continueExam}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          >
            <Play className="h-4 w-4 mr-2" />
            Continuar Examen
          </Button>
          <Button
            onClick={finishExamByTabChange}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-2" />
            Finalizar Examen
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
  const FullscreenExitModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-800">¡Atención!</CardTitle>
          <CardDescription className="text-base">
            Has salido del modo pantalla completa
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-700 mb-4">
            Salir de la pantalla completa durante el examen puede considerarse como finalización de la prueba.
          </p>
          <p className="text-sm text-gray-600">
            ¿Qué deseas hacer?
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={returnToExam}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          >
            <Maximize className="h-4 w-4 mr-2" />
            Volver al Examen
          </Button>
          <Button
            onClick={handleExitFullscreen}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-2" />
            Salir y Finalizar
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

  // Cleanup fullscreen on component unmount
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        exitFullscreen()
      }
    }
  }, [])

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

  const handleSubmit = async (timeExpired = false) => {
    if (!timeExpired && Object.keys(answers).length < examData.questions.length) {
      setShowWarning(true)
      return
    }

    setExamState('completed')
    await exitFullscreen()
    
    // Aquí iría la lógica para enviar las respuestas
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
    <>
      {showFullscreenExit && <FullscreenExitModal />}
      {showTabChangeWarning && <TabChangeWarningModal />}
      
      <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-gray-50 p-4">
        {/* Contenido principal del examen */}
        <div className="flex-1">
          {/* Módulo con miniatura */}
          <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                <Calculator className="w-16 h-16 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm text-gray-500 font-medium">Estás realizando:</h3>
                <h2 className="text-lg font-bold">{examData.module}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{examData.timeLimit} minutos</span>
                  <span className="mx-1">•</span>
                  <span>{examData.questions.length} preguntas</span>
                  {tabChangeCount > 0 && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="text-orange-600 font-medium">
                        Advertencias: {tabChangeCount}/3
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">{examData.title}</h2>
              {examLocked && (
                <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  BLOQUEADO
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {tabChangeCount > 0 && (
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700">
                    {3 - tabChangeCount} intentos restantes
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border shadow-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">
                  {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
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
          <div className="bg-white border rounded-lg p-4 sticky top-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              Navegación
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {examData.questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${currentQuestion === index ? "bg-purple-50 border-purple-200 border" : "border hover:bg-gray-50"
                    }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${answers
                      ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 border"
                      }`}
                  >
                    {q.id}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium truncate">Pregunta {q.id}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {answers ? (
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
    </>
  )
}

export default ExamWithWelcome