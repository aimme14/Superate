import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookMarked }  from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useNotification } from "@/hooks/ui/useNotification"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useQueryUser } from '@/hooks/query/useAuthQuery'
import { useAuthContext } from "@/context/AuthContext"


const ExamForm = () => {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(examData.timeLimit * 60)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const { notifySuccess, notifyError } = useNotification()
  const navigate = useNavigate()


  // Prevenir que el usuario salga de la página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!examSubmitted) {
        e.preventDefault()
        e.returnValue = "¿Estás seguro que deseas salir? Tu progreso se perderá."
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => { window.removeEventListener("beforeunload", handleBeforeUnload) }
  }, [examSubmitted])

  // Simulación de temporizador
  useEffect(() => {
    if (timeLeft > 0 && !examSubmitted) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !examSubmitted) {
      handleSubmit(true)
    }
  }, [timeLeft, examSubmitted])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [examData.questions[currentQuestion].id]: value })
    setShowWarning(false)
  }

  const goToNextQuestion = () => {
    if (currentQuestion < examData.questions.length - 1) { setCurrentQuestion(currentQuestion + 1) }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestion > 0) { setCurrentQuestion(currentQuestion - 1) }
  }

  const handleSubmit = (timeExpired = false) => {
    // Si es un envío manual (no por tiempo expirado), verificar que todas las preguntas estén respondidas
    if (!timeExpired && Object.keys(answers).length < examData.questions.length) {
      setShowWarning(true)
      notifyError({
        title: "Preguntas sin responder",
        message: "Debes responder todas las preguntas antes de enviar el examen."
      })
      return
    }

    // Enviar las respuestas seleccionadas (incluso si no están todas respondidas)
    setExamSubmitted(true)

    if (timeExpired) {
      notifyError({
        title: "Tiempo agotado",
        message: `El examen ha finalizado. Se han enviado ${Object.keys(answers).length} de ${examData.questions.length} respuestas.`,
      })
    } else {
      notifySuccess({
        title: "Examen enviado",
        message: "Tus respuestas han sido registradas correctamente.",
      })
    }

    // Aquí iría la lógica para enviar las respuestas al servidor
    console.log("Respuestas enviadas:", answers)
  }

  const progress = ((currentQuestion + 1) / examData.questions.length) * 100
  const question = examData.questions[currentQuestion]
  const answeredQuestions = Object.keys(answers).length
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Contenido principal del examen */}
      <div className="flex-1">
        {!examSubmitted ? (
          <>
            {/* Módulo con miniatura */}
            <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                  <BookMarked className="w-16 h-16 text-amber-500" />
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
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>¡Examen completado!</CardTitle>
              <CardDescription>
                Has finalizado el examen "{examData.title}". Tus respuestas han sido registradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <Brain className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-medium mb-2">Gracias por completar el examen</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Tus resultados serán procesados y podrás consultarlos en tu perfil próximamente.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button onClick={() => navigate('/new-dashboard')} className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
                Volver al inicio
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Panel lateral derecho con navegación de preguntas */}
      {!examSubmitted && (
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
      )}
    </div>
  )
}

export default ExamForm
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
// Datos de ejemplo para el examen
const examData = {
  title: "Examen de ciencias ciudadanas",
  description: "Evaluación de habilidades de ciencias socihumanisticas",
  timeLimit: 30, // minutos
  module: "Módulo de ciencias sociales",
  questions: [
    {
      id: 1,
      text: "La Revolución Industrial se originó con la invención de la máquina de vapor y la concentración del capital, lo que permitió la producción mecanizada. Esto llevó a que muchas personas se trasladaran del campo a las ciudades para trabajar en fábricas ¿Cuál fue una consecuencia social de la Revolución Industrial?",
      options: [
        { id: "a", text: "Regreso masivo a actividades agrícolas." },
        { id: "b", text: "Migración del campo a las ciudades y surgimiento del proletariado." },
        { id: "c", text: "Reducción del trabajo urbano." },
        { id: "d", text: "Aumento inmediato de salarios rurales." },
      ],
      correctAnswer: "b",
    },
  /**
    {
      id: 2, 
      text: "Durante la Guerra Fría, el Muro de Berlín representó una división política entre el bloque comunista y el occidental. Este muro separó familias y simbolizó la tensión entre dos modelos económicos y sociales ¿Qué simboliza el Muro de Berlín en el contexto político mundial?",
      options: [
        { id: "a", text: "La prosperidad económica." },
        { id: "b", text: "La división ideológica entre capitalismo y comunismo." },
        { id: "c", text: "La unión de Alemania." },
        { id: "d", text: "La independencia africana." },
      ],
      correctAnswer: "b",
    },

    {
      id: 3,
      text: "Tras la Primera Guerra Mundial, varios países adoptaron modelos de Estado federal. Un ejemplo fue la Constitución de Rionegro (1863) en Colombia, que otorgó gran autonomía a los estados regionales, permitiéndoles acuñar moneda y manejar sus propias fuerzas militares ¿Qué principio político inspiraba la Constitución de Rionegro?",
      options: [
        { id: "a", text: "Centralismo fuerte." },
        { id: "b", text: "Federalismo y descentralización." },
        { id: "c", text: "Monarquía constitucional." },
        { id: "d", text: "Autocracia regional." },
      ],
      correctAnswer: "b",
    },

    {
      id: 4,
      text: "La «tutela» en Colombia es un mecanismo que permite a una persona solicitar protección judicial inmediata cuando considera que un derecho fundamental ha sido vulnerado ¿Para qué sirve la acción de tutela?",
      options: [
        { id: "a", text: "Sancionar al juez." },
        { id: "b", text: "Defender rápidamente derechos fundamentales." },
        { id: "c", text: "Elegir alcaldes." },
        { id: "d", text: "Reformar leyes nacionales." },
      ],
      correctAnswer: "b",
    },

    {
      id: 5,
      text: "La objeción de conciencia permite que un médico, por motivos religiosos o éticos, se niegue a practicar procedimientos como la eutanasia, siempre que no afecte gravemente a terceros ¿En qué situación aplica la objeción de conciencia?",
      options: [
        { id: "a", text: "Cuando se trata de un paciente que ha pedido voluntariamente la eutanasia." },
        { id: "b", text: "Cuando el médico considera que el paciente no está en condiciones de consentir." },
        { id: "c", text: "Cuando el médico cree que la eutanasia es éticamente correcta." },
        { id: "d", text: "Cuando el médico está dispuesto a practicar la eutanasia sin importar las consecuencias." },
      ],
      correctAnswer: "b",
    },

    {
      id: 6,
      text: "En la Constitución de Rionegro (1863), el poder regional pierda control sobre armar su propia milicia; sin embargo, la falta de poder centralizó la autoridad y favoreció tensiones internas ¿Qué limitación del federalismo evidente en esta constitución pudo generar conflictos?",
      options: [
        { id: "a", text: "La imposición cultural." },
        { id: "b", text: "La descentralización sin coordinación efectiva." },
        { id: "c", text: "La unión económica regional." },
        { id: "d", text: "La falta de elecciones locales." },
      ],
      correctAnswer: "b",
    },

    {
      id: 7,
      text: "Muchas ciudades colombianas han expandido sus fronteras a costa de bosques y zonas verdes, lo que ha generado problemas ambientales como aumento de temperatura y pérdida de hábitats. ¿Qué problema se evidencia en este proceso?",
      options: [
        { id: "a", text: "Mayor biodiversidad urbana." },
        { id: "b", text: "Desertificación mejorada." },
        { id: "c", text: "Efecto de isla urbana y pérdida de fauna." },
        { id: "d", text: "Mejora del clima local." },
      ],
      correctAnswer: "c",
    },

    {
      id: 8,
      text: "En Colombia, los títulos mineros se concentran en la región andina, mientras que en la Amazonia las áreas adjudicadas son mínimas ¿Qué explica mejor esta distribución de actividades mineras?",
      options: [
        { id: "a", text: "La Amazonia tiene más biodiversidad lo que impide minería." },
        { id: "b", text: "La Región Andina es más accesible y rica en minerales." },
        { id: "c", text: "Solo se explota el carbón en la Amazonia." },
        { id: "d", text: "La minería no requiere permisos." },
      ],
      correctAnswer: "b",
    },

    {
      id: 9,
      text: "La construcción de represas en territorios indígenas plantea un conflicto entre desarrollo energético y protección de ecosistemas y culturas locales ¿Qué dilema refleja esta situación?",
      options: [
        { id: "a", text: "Entre progreso y defensa cultural/ambiental." },
        { id: "b", text: "Entre crecimiento agrícola y urbano." },
        { id: "c", text: "Entre educación y salud." },
        { id: "d", text: "Entre turismo y pesca." },
      ],
      correctAnswer: "a",
    },
    {
      id: 10,
      text: "El sistema de salud colombiano impone “cuotas moderadoras” para que el usuario pague según su ingreso, pero esto incentiva que las farmacéuticas cobren precios elevados al sistema ¿Qué efecto provoca este mecanismo?",
      options: [
        { id: "a", text: "Regulación perfecta de precios." },
        { id: "b", text: "Sobreprecio de medicamentos." },
        { id: "c", text: "Apoyo total a usuarios de estrato alto." },
        { id: "d", text: "Caída del sistema de salud." },
      ],
      correctAnswer: "b",
    },

    {
      id: 11,
      text: "El alquiler de tierras por multinacionales sin regulación puede aumentar la desigualdad al concentrar riqueza en pocos actores económicos ¿Qué problema social puede causar esta concentración de tierras?",
      options: [
        { id: "a", text: "Mayor diversidad rural." },
        { id: "b", text: "Centralización de recursos y desplazamiento campesino." },
        { id: "c", text: "Disminución del desempleo." },
        { id: "d", text: "Mayor producción agrícola." },
      ],
      correctAnswer: "b",
    },

    {
      id: 12,
      text: "Varios países usan impuestos progresivos y programas sociales para redistribuir ingresos, reduciendo la brecha entre ricos y pobres. ¿Cuál es el propósito de estas políticas públicas?",
      options: [
        { id: "a", text:"incentivar la concentración de riqueza"},
        { id: "b", text:"Reducir desigualdad y promover equidad"},
        { id: "c", text:"Aumentar el gasto militar"},
        { id: "d", text:"Privar a los pobres de beneficios"},
      ],
      correctAnswer: "b",
    },
    {
      id: 13,
      text: "En una junta de vecindario, los residentes deciden pintar el parque y limpiar sus alrededores. ¿Qué valor se promueve con esta acción?",
      options: [
        { id: "a", text: "Individualismo." },
        { id: "b", text: "Participación ciudadana." },
        { id: "c", text: "Autoritarismo." },
        { id: "d", text: "Aislamiento social." },
      ],
      correctAnswer: "b",
    },
    {
      id: 14,
      text: "Una estudiante denuncia en redes que su colegio no cumple normas de seguridad, pero la institución amenaza con sancionarla por “dañar su imagen”. ¿Qué derecho está en riesgo?",
      options: [
        { id: "a", text: "Derecho al voto." },
        { id: "b", text: "Libertad de expresión." },
        { id: "c", text: "Derecho a la intimidad." },
        { id: "d", text: "Derecho a recibir sanciones." },
      ],
      correctAnswer: "b",
    },
    {
      id: 15,
      text: "Comunidades indígenas negociaron con el Gobierno la reubicación por la construcción de una represa, tras un proceso de conciliación que definió su nuevo asentamiento ¿Qué principio constitucional se evidencia en este proceso?",
      options: [
        { id: "a", text: "Exclusión de comunidades" },
        { id: "b", text: "Consulta previa y derecho colectivo" },
        { id: "c", text: "Inacción estatal" },
        { id: "d", text: "Imposición de proyectos sin diálogo" },
      ],
      correctAnswer: "b",
    },**/
  ]      
}