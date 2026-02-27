import { lazy, Suspense } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import Header from "@/sections/quiz/Header"

// Lazy load: solo se carga el formulario de la materia seleccionada
const ExamFormLecture = lazy(() => import("@/sections/quizLectura/fromExamLengua"))
const ExamFormSociales = lazy(() => import("@/sections/quizSociales/fromExamSocialesNew"))
const ExamFormNaturales = lazy(() => import("@/sections/quizNaturales/fromExamNaturales"))
const ExamFormIngles = lazy(() => import("@/sections/quizIngles/fromExamIngles"))
const ExamFormMath = lazy(() => import("@/sections/quizMatematicas/fromExamMatematicas"))
const ExamFormBiologia = lazy(() => import("@/sections/quizBiologia/fromExamBiologia"))
const ExamFormFisica = lazy(() => import("@/sections/quizFisica/fromExamFisica"))
const ExamFormQuimica = lazy(() => import("@/sections/quizQuimica/fromExamQuimica"))
const DynamicQuizForm = lazy(() => import("@/components/quiz/DynamicQuizForm"))

const QuizFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    <p className="mt-4 text-muted-foreground">Cargando examen...</p>
  </div>
)

const Quiz = () => {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  
  // Obtener parámetros para cuestionarios dinámicos
  const subject = searchParams.get('subject');
  const phase = searchParams.get('phase') as 'first' | 'second' | 'third' | null;
  const grade = searchParams.get('grade');
  
  // Si hay parámetros de cuestionario dinámico, usar el componente específico
  if (subject && phase) {
    return (
      <>
        <Header />
        <Suspense fallback={<QuizFallback />}>
          {subject === 'Lenguaje' ? (
            <ExamFormLecture />
          ) : subject === 'Matemáticas' || subject === 'Matematicas' ? (
            <ExamFormMath />
          ) : subject === 'Ciencias Sociales' ? (
            <ExamFormSociales />
          ) : subject === 'Ciencias Naturales' ? (
            <ExamFormNaturales />
          ) : subject === 'Inglés' ? (
            <ExamFormIngles />
          ) : subject === 'Biologia' ? (
            <ExamFormBiologia />
          ) : subject === 'Física' ? (
            <ExamFormFisica />
          ) : subject === 'Quimica' ? (
            <ExamFormQuimica />
          ) : (
            <DynamicQuizForm
              subject={subject}
              phase={phase}
              grade={grade || undefined}
            />
          )}
        </Suspense>
      </>
    )
  }

  return (
    <>
      <Header />
      <Suspense fallback={<QuizFallback />}>
        {id === 'lectura' ? (
          <ExamFormLecture />
        ) : id === 'quiz' ? (
          <ExamFormMath />
        ) : id === 'sociales' ? (
          <ExamFormSociales />
        ) : id === 'naturales' ? (
          <ExamFormNaturales />
        ) : id === 'ingles' ? (
          <ExamFormIngles />
        ) : (
          <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-2xl font-bold">No se encontró el examen</h1>
          </div>
        )}
      </Suspense>
    </>
  )
}

export default Quiz