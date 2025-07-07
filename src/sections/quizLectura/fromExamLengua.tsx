import { Clock, ChevronLeft, ChevronRight, Send, Brain, AlertCircle, CheckCircle2, BookOpen, Play, Users, Timer, HelpCircle, Maximize, X, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseApp } from "@/services/firebase/db.service";
import { useAuthContext } from "@/context/AuthContext";

const db = getFirestore(firebaseApp);


// Verifica si el usuario ya presentó el examen
const checkExamStatus = async (userId: string, examId: string) => {
  const docRef = doc(db, "results", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data[examId] || null;
  }
  return null;
};

// Guarda los resultados del examen
const saveExamResults = async (userId: string, examId: string, examData: any) => {
  const docRef = doc(db, "results", userId);
  await setDoc(
    docRef,
    {
      [examId]: {
        ...examData,
        timestamp: Date.now(),
      },
    },
    { merge: true }
  );
  return { success: true, id: `${userId}_${examId}` };
};

// Datos de ejemplo para el examen
const examData = {
  id: "exam_lengua_001", // ID único del examen
  title: "Examen de Lengua",
  description: "Evaluación de habilidades de pensamiento crítico y comprensión lectora",
  timeLimit: 30, // minutos
  module: "Módulo de Lengua",
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

    /**  {
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
       text: "“Un youtuber dijo: ‘Los videojuegos hacen que los niños se vuelven violentos’. Sin embargo, no presentó estudios ni pruebas. Solo compartió su opinión.”¿Qué le falta al argumento del youtuber para ser válido?",
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

const ExamWithFirebase = () => {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [examState, setExamState] = useState('loading') // loading, welcome, active, completed, already_taken
  const [timeLeft, setTimeLeft] = useState(examData.timeLimit * 60)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [showFullscreenExit, setShowFullscreenExit] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTabChangeWarning, setShowTabChangeWarning] = useState(false)
  const [tabChangeCount, setTabChangeCount] = useState(0)
  const [examLocked, setExamLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuthContext();
  const userId = user?.uid;
  const [existingExamData, setExistingExamData] = useState<ExamData | null>(null);
  

  // Verificar al cargar si el examen ya fue presentado
  useEffect(() => {
    if (!userId) return; // Don't run if userId is undefined
  
    const fetchExamStatus = async () => {
      try {
        const existingExam = await checkExamStatus(userId, examData.id);
        if (existingExam) {
          setExistingExamData(existingExam)
          setExamState('already_taken')
        } else {
          setExamState('welcome')
        }
      } catch (error) {
        console.error('Error verificando estado del examen:', error)
        setExamState('welcome') // Permitir continuar en caso de error
      }
    }
  
    fetchExamStatus()
  }, [userId])

  // Función para calcular la puntuación
  const calculateScore = () => {
    let correctAnswers = 0
    let totalAnswered = 0

    examData.questions.forEach(question => {
      if (answers[question.id]) {
        totalAnswered++
        if (answers[question.id] === question.correctAnswer) {
          correctAnswers++
        }
      }
    })

    return {
      correctAnswers,
      totalAnswered,
      totalQuestions: examData.questions.length,
      percentage: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      overallPercentage: Math.round((correctAnswers / examData.questions.length) * 100)
    }
  }

  // Función para guardar resultados en Firebase
  const saveToFirebase = async (timeExpired = false, lockedByTabChange = false) => {
    setIsSubmitting(true)
    try {
      const score = calculateScore()
      const examResult = {
        userId,
        examId: examData.id,
        examTitle: examData.title,
        answers,
        score,
        timeExpired,
        lockedByTabChange,
        tabChangeCount,
        startTime: new Date(Date.now() - (examData.timeLimit * 60 - timeLeft) * 1000).toISOString(),
        endTime: new Date().toISOString(),
        timeSpent: examData.timeLimit * 60 - timeLeft, // en segundos
        completed: true,
        // Detalles por pregunta
        questionDetails: examData.questions.map(question => ({
          questionId: question.id,
          questionText: question.text,
          userAnswer: answers[question.id] || null,
          correctAnswer: question.correctAnswer,
          isCorrect: answers[question.id] === question.correctAnswer,
          answered: !!answers[question.id]
        }))
      }

      if (!userId || !examData.id) {
        throw new Error("Falta userId o examData.id");
      }
      const result = await saveExamResults(userId, examData.id, examResult);
      console.log('Examen guardado exitosamente:', result)
      return result
    } catch (error) {
      console.error('Error guardando examen:', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Función para entrar en pantalla completa
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;

      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).msRequestFullscreen) {
        (el as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error("Error entering fullscreen:", error);
    }
  };

  // Función para salir de pantalla completa
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
    }
  };

  // Detectar cambios de pestaña y pérdida de foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (examState === 'active' && document.hidden) {
        setTabChangeCount(prev => prev + 1);
        setShowTabChangeWarning(true);

        if (tabChangeCount >= 2) {
          setExamLocked(true);
          handleSubmit(true, true);
        }
      }
    };

    const handleWindowBlur = () => {
      if (examState === 'active') {
        setTabChangeCount(prev => prev + 1);
        setShowTabChangeWarning(true);

        if (tabChangeCount >= 2) {
          setExamLocked(true);
          handleSubmit(true, true);
        }
      }
    };

    const handleWindowFocus = () => {
      if (examState === 'active' && showTabChangeWarning && !examLocked) {
        // El warning se mantiene visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [examState, tabChangeCount, showTabChangeWarning, examLocked]);

  // Detectar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;

      const isCurrentlyFullscreen = !!fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      if (examState === 'active' && !isCurrentlyFullscreen) {
        setShowFullscreenExit(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [examState]);

  // Iniciar examen y entrar en pantalla completa
  const startExam = async () => {
    await enterFullscreen()
    setExamState('active')
  }

  // Manejar salida de pantalla completa durante el examen
  const handleExitFullscreen = async () => {
    setShowFullscreenExit(false)
    await handleSubmit(false, false)
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
    await handleSubmit(true, true)
  }

  // Pantalla de carga
  const LoadingScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Verificando estado del examen...</CardTitle>
          <CardDescription>
            Por favor espera mientras verificamos si ya has presentado este examen
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Pantalla cuando ya se presentó el examen
  const AlreadyTakenScreen = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-amber-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-amber-800">Examen Ya Presentado</CardTitle>
          <CardDescription className="text-lg">
            Ya has completado este examen anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Información del Examen</AlertTitle>
            <AlertDescription className="text-amber-700">
              Solo se permite una presentación por examen. Tu intento anterior ya fue registrado.
            </AlertDescription>
          </Alert>

          {existingExamData && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Detalles de tu presentación:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Fecha:</span>
                  <div className="font-medium">
                    {new Date(existingExamData.endTime).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Puntuación:</span>
                  <div className="font-medium text-lg">
                    {existingExamData.score.correctAnswers}/{existingExamData.score.totalQuestions}
                    <span className="text-sm text-gray-500 ml-1">
                      ({existingExamData.score.overallPercentage}%)
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Tiempo usado:</span>
                  <div className="font-medium">
                    {Math.floor(existingExamData.timeSpent / 60)}:{(existingExamData.timeSpent % 60).toString().padStart(2, '0')} min
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Estado:</span>
                  <div className="font-medium text-green-600">Completado</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          >
            Volver a las demas pruebas
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

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
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-purple-400 rounded-full flex items-center justify-center">
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

          {/* Advertencia de una sola presentación */}
          <Alert className="border-green-200 bg-green-50">
            <Database className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Una Sola Oportunidad</AlertTitle>
            <AlertDescription className="text-green-700">
              Solo puedes presentar este examen una vez. Tus respuestas se guardarán automáticamente y no podrás volver a intentarlo.
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
      handleSubmit(true, false)
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

  const handleSubmit = async (timeExpired = false, lockedByTabChange = false) => {
    if (!timeExpired && !lockedByTabChange && Object.keys(answers).length < examData.questions.length) {
      setShowWarning(true)
      return
    }

    try {
      await saveToFirebase(timeExpired, lockedByTabChange)
      setExamState('completed')
      await exitFullscreen()
    } catch (error) {
      console.error('Error al guardar el examen:', error)
      // Aquí puedes mostrar un mensaje de error al usuario
      alert('Error al guardar el examen. Por favor, inténtalo de nuevo.')
    }
  }
  const progress = ((currentQuestion + 1) / examData.questions.length) * 100

  // Pantalla de resultados
  const ResultsScreen = () => {
    const score = calculateScore()
    
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-green-800 mb-2">
              ¡Examen Completado!
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Tus respuestas han sido guardadas exitosamente
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Puntuación principal */}
            <div className="bg-white rounded-lg p-6 border shadow-sm text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {score.correctAnswers}/{score.totalQuestions}
              </div>
              <div className="text-xl text-gray-700 mb-1">Respuestas correctas</div>
              <div className="text-lg text-gray-500">
                Puntuación: {score.overallPercentage}%
              </div>
            </div>

            {/* Estadísticas detalladas */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="font-semibold text-2xl text-blue-600">{score.totalAnswered}</div>
                <div className="text-sm text-gray-500">Preguntas respondidas</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="font-semibold text-2xl text-green-600">{score.correctAnswers}</div>
                <div className="text-sm text-gray-500">Respuestas correctas</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border shadow-sm">
                <div className="font-semibold text-2xl text-orange-600">
                  {Math.floor((examData.timeLimit * 60 - timeLeft) / 60)}:{((examData.timeLimit * 60 - timeLeft) % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-gray-500">Tiempo utilizado</div>
              </div>
            </div>

            {/* Desglose por pregunta */}
            <div className="bg-white rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Desglose de respuestas
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {examData.questions.map((question, index) => {
                  const userAnswer = answers[question.id]
                  const isCorrect = userAnswer === question.correctAnswer
                  const wasAnswered = !!userAnswer
                  
                  return (
                    <div key={question.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          !wasAnswered ? 'bg-gray-300 text-gray-600' :
                          isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="text-sm text-gray-700">
                          Pregunta {index + 1}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!wasAnswered ? (
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            Sin responder
                          </span>
                        ) : isCorrect ? (
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                            Correcta
                          </span>
                        ) : (
                          <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                            Incorrecta
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Información adicional si hubo problemas */}
            {(tabChangeCount > 0 || examLocked) && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Información adicional</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {examLocked && "El examen fue finalizado automáticamente por superar el límite de cambios de pestaña. "}
                  {tabChangeCount > 0 && `Cambios de pestaña detectados: ${tabChangeCount}`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex justify-center pt-6">
            <Button
              onClick={() => navigate('/dashboard')}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white px-8 py-3 text-lg font-semibold"
            >
              Volver a las demas pruebas
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Pantalla principal del examen con diseño mejorado
  const ExamScreen = () => {
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    const question = examData.questions[currentQuestion]
    const answeredQuestions = Object.keys(answers).length

    return (
      <div className="flex flex-col lg:flex-row gap-6 min-h-screen bg-gray-50 p-4">
        {/* Contenido principal del examen */}
        <div className="flex-1">
          {/* Módulo con miniatura */}
          <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
                <BookOpen className="w-16 h-16 text-purple-500" />
              </div>
              <div>
                <h3 className="text-sm text-gray-500 font-medium">Estás realizando:</h3>
                <h2 className="text-lg font-bold">{examData.module || examData.title}</h2>
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
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm ${
                timeLeft < 300 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white'
              }`}>
                <Clock className={`h-4 w-4 ${timeLeft < 300 ? 'text-red-500' : 'text-orange-500'}`} />
                <span className={`text-sm font-medium font-mono ${
                  timeLeft < 300 ? 'text-red-700' : ''
                }`}>
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

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Pregunta {currentQuestion + 1}</CardTitle>
              <CardDescription className="text-base font-medium text-gray-800 mt-2">
                {question.text}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={answers[question.id] || ""} 
                onValueChange={handleAnswer} 
                className="space-y-3"
              >
                {question.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <RadioGroupItem 
                      value={option.id} 
                      id={`option-${option.id}`} 
                      className="mt-1" 
                    />
                    <Label 
                      htmlFor={`option-${option.id}`} 
                      className="flex-1 cursor-pointer"
                    >
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
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              {currentQuestion < examData.questions.length - 1 ? (
                <Button 
                  onClick={goToNextQuestion} 
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Examen
                    </>
                  )}
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
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${
                    currentQuestion === index 
                      ? "bg-purple-50 border-purple-200 border" 
                      : "border hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      answers[q.id]
                        ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 border"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium truncate">Pregunta {index + 1}</div>
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
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Finalizar examen'
                )}
              </Button>

              {answeredQuestions < examData.questions.length && (
                <p className="text-xs text-center mt-2 text-orange-500">
                  Tienes {examData.questions.length - answeredQuestions} preguntas sin responder
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Warning modal actualizado
  const WarningModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-center text-amber-800">
            ¿Enviar examen incompleto?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-700 mb-4">
            Tienes {examData.questions.length - Object.keys(answers).length} preguntas sin responder.
          </p>
          <p className="text-center text-sm text-gray-600">
            ¿Estás seguro que deseas enviar el examen?
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            onClick={() => setShowWarning(false)}
            variant="outline"
            className="flex-1"
          >
            Continuar respondiendo
          </Button>
          <Button
            onClick={() => {
              setShowWarning(false)
              handleSubmit()
            }}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
          >
            Enviar ahora
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  // Renderizado principal basado en el estado
  if (examState === 'loading') {
    return <LoadingScreen />
  }

  if (examState === 'already_taken') {
    return <AlreadyTakenScreen />
  }

  if (examState === 'welcome') {
    return <WelcomeScreen />
  }

  if (examState === 'completed') {
    return <ResultsScreen />
  }

  if (examState === 'active') {
    return (
      <>
        <ExamScreen />
        {showWarning && <WarningModal />}
        {showTabChangeWarning && <TabChangeWarningModal />}
        {showFullscreenExit && <FullscreenExitModal />}
      </>
    )
  }

  return null
}

export default ExamWithFirebase