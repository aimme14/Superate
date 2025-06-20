import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, Leaf } from "lucide-react"
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
                  <Leaf className="w-16 h-16 text-amber-500" />
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
  title: "Examen de ciencias naturales",
  description: "Evaluación de habilidades en ciencias naturales",
  timeLimit: 30, // minutos
  module: "Módulo de ciencias naturales",
  questions: [
    {
      id: 1,
      text: "El sistema respiratorio permite el intercambio de gases entre el cuerpo y el ambiente. Los pulmones absorben oxígeno y liberan dióxido de carbono durante la respiración. ¿Cuál es la función principal de los pulmones?",
      options: [
        { id: "a", text: "Transportar la sangre." },
        { id: "b", text: "Regular la temperatura." },
        { id: "c", text: "Intercambiar gases." },
        { id: "d", text: "Producir glóbulos blancos." },
      ],
      correctAnswer: "c",

    },

    /**{ 
      id: 2,
      text: "Una persona tiene una dieta rica en grasas y azúcares, pero baja en fibra y vitaminas. Su médico detecta altos niveles de colesterol y obesidad. ¿Cuál es la consecuencia biológica más probable de esta dieta?",
      options: [
        { id: "a", text: "Mejora del sistema inmune." },
        { id: "b", text: "Problemas circulatorios y metabólicos." },
        { id: "c", text: "Mayor agilidad física." },
        { id: "d", text: "Fortalecimiento óseo." },
      ],
      correctAnswer: "b",
    },

    {
      id: 3,
      text: "Se propone que los colegios promuevan el consumo de frutas y verduras en las cafeterías para mejorar la salud de los estudiantes. ¿Cuál sería un argumento biológico que respalde esta propuesta?",
      options: [
        { id: "a", text: "Las frutas son más baratas." },
        { id: "b", text: "Las verduras no se echan a perder fácilmente." },
        { id: "c", text: "Aportan nutrientes que fortalecen el sistema inmunológico." },
        { id: "d", text: "Evitan que los estudiantes compren gaseosas." },
      ],
      correctAnswer: "c"
    },

    {
      id: 4,
      text: "Un ciclista desciende por una colina. A medida que baja, su velocidad aumenta. ¿Qué tipo de fuerza actúa para aumentar su velocidad?",
      options: [
        { id: "a", text: "Fricción." },
        { id: "b", text: "Gravedad." },
        { id: "c", text: "Resistencia del aire." },
        { id: "d", text: "Fuerza centrífuga." },
      ],
      correctAnswer: "b",
    },

    {
      id: 5,
      text: "Cuando un balón es lanzado hacia arriba, disminuye su velocidad hasta detenerse, luego cae. ¿Qué fenómeno explica este comportamiento?",
      options: [
        { id: "a", text: "La ausencia de gravedad." },
        { id: "b", text: "La acción del impulso." },
        { id: "c", text: "La aceleración negativa provocada por la gravedad." },
        { id: "d", text: "La fuerza centrífuga terrestre." },
      ],
      correctAnswer: "c",
    },


    {
      id: 6,
      text: "Se desea reducir el consumo de energía en una escuela. Se propone reemplazar bombillos tradicionales por luces LED. ¿Cuál es una razón física que respalda esta medida?",
      options: [
        { id: "a", text: "Las luces LED emiten calor." },
        { id: "b", text: "Las luces LED iluminan menos." },
        { id: "c", text: "Las luces LED consumen menos energía al producir la misma cantidad de luz." },
        { id: "d", text: "Las luces LED cambian de color." },
      ],
      correctAnswer: "c",
    },

    {
      id: 7,
      text: "Al hervir agua, esta se convierte en vapor. El volumen aumenta y se observa vapor saliendo de la olla. ¿Qué tipo de cambio ocurre al hervir el agua?",
      options: [
        { id: "a", text: "Cambio químico." },
        { id: "b", text: "Fusión." },
        { id: "c", text: "Evaporación (cambio físico)." },
        { id: "d", text: "Combustión." },
      ],
      correctAnswer: "c",
    },

    {
      id: 8,
      text: "En un laboratorio, un estudiante mezcla vinagre y bicarbonato. La reacción genera burbujas y libera gas. ¿Qué evidencia indica que ocurrió una reacción química?",
      options: [
        { id: "a", text: "El cambio de estado." },
        { id: "b", text: "El burbujeo y la formación de gas." },
        { id: "c", text: "El color del recipiente." },
        { id: "d", text: "La temperatura del ambiente." },
      ],
      correctAnswer: "b",
    },

    {
      id: 9,
      text: "Para disminuir la contaminación, se propone reemplazar plásticos convencionales por materiales biodegradables como el almidón de maíz. ¿Qué propiedad química hace que esta propuesta sea viable?",
      options: [
        { id: "a", text: "El almidón resiste el calor." },
        { id: "b", text: "El almidón no conduce electricidad." },
        { id: "c", text: "El almidón se degrada más fácilmente por acción de microorganismos." },
        { id: "d", text: "El almidón es inflamable." },
      ],
      correctAnswer: "c",
    },

    {
      id: 10,
      text: "Un ecosistema equilibrado tiene múltiples especies que se alimentan unas de otras. Si desaparece una especie clave, otras pueden disminuir o desaparecer. ¿Qué puede causar la desaparición de varias especies?",
      options: [
        { id: "a", text: "El aumento de la biodiversidad." },
        { id: "b", text: "La extinción de una especie fundamental." },
        { id: "c", text: "La llegada del invierno." },
        { id: "d", text: "La contaminación visual." },
      ],
      correctAnswer: "b",
    },

    {
      id: 11,
      text: "En una comunidad, se eliminó el uso de bolsas plásticas y se promovieron bolsas de tela reutilizables. ¿Qué beneficio ecológico tiene esta medida?",
      options: [
        { id: "a", text: "Mejora el aspecto de los supermercados." },
        { id: "b", text: "Aumenta el consumo de ropa." },
        { id: "c", text: "Reduce la contaminación de suelos y mares." },
        { id: "d", text: "Aumenta la venta de telas." },
      ],
      correctAnswer: "c",
    },

    {
      id: 12,
      text: "Se desea restaurar una zona deforestada. Se plantea sembrar especies nativas en lugar de árboles exóticos. ¿Cuál es una razón ecológica que respalda esta decisión?",
      options: [
        { id: "a", text: "Las especies nativas son más bonitas." },
        { id: "b", text: "Las especies nativas requieren más agua." },
        { id: "c", text: "Las especies nativas se integran mejor al ecosistema." },
        { id: "d", text: "Las especies exóticas crecen más rápido." },
      ],
      correctAnswer: "c",
    },

    {
      id: 13,
      text: "El descubrimiento de la penicilina permitió tratar infecciones bacterianas y salvó millones de vidas. ¿Cómo influyó este descubrimiento en la sociedad?",
      options: [
        { id: "a", text: "Generó nuevas epidemias." },
        { id: "b", text: "Aumentó la resistencia bacteriana." },
        { id: "c", text: "Mejoró la esperanza de vida." },
        { id: "d", text: "Reemplazó todas las medicinas." },
      ],
      correctAnswer: "c",
    },


    {
      id: 15,
      text: "En un proyecto escolar se propone diseñar un filtro casero para purificar agua usando materiales como arena, carbón activado y grava. ¿Qué principio científico fundamenta esta propuesta?",
      options: [
        { id: "a", text: "El filtrado permite separar sólidos suspendidos en líquidos." },
        { id: "b", text: "El agua es inflamable." },
        { id: "c", text: "El carbón absorbe olores." },
        { id: "d", text: "La arena acelera la evaporación." },
      ],
      correctAnswer: "a",
    },**/

  ],
}