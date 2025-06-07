import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookMarked }  from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/ui/card"
import { Alert, AlertTitle, AlertDescription } from "#/ui/alert"
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group"
import { useNotification } from "@/hooks/ui/useNotification"
import { useState, useEffect } from "react"
import { Progress } from "#/ui/progress"
import { Button } from "#/ui/button"
import { Label } from "#/ui/label"
import { useNavigate } from "react-router-dom"

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
              <Button onClick={() => navigate('/newDashboard')} className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
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
      text: "María tiene 7 manzanas más que Pedro. Si Pedro tiene \( x \) manzanas, y entre los dos tienen 17, ¿cuántas manzanas tiene Pedro?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
        { id: "c", text: "7" },
        { id: "d", text: "10" },
      ],
      correctAnswer: "b",
    },
  ],
}