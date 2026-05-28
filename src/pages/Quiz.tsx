import { lazy, Suspense } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import Header from "@/sections/quiz/Header"

const UnifiedExamForm = lazy(() => import("@/sections/quiz/UnifiedExamForm"))
const DynamicQuizForm = lazy(() => import("@/components/quiz/DynamicQuizForm"))

const QuizFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    <p className="mt-4 text-muted-foreground">Cargando examen...</p>
  </div>
)

const UNIFIED_SUBJECTS = new Set([
  'Lenguaje', 'Matemáticas', 'Matematicas', 'Ciencias Sociales',
  'Biologia', 'Física', 'Quimica', 'Inglés',
])

const Quiz = () => {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()

  const subject = searchParams.get('subject')
  const phase = searchParams.get('phase') as 'first' | 'second' | 'third' | null
  const grade = searchParams.get('grade')

  // Ruta dinámica con subject + phase
  if (subject && phase) {
    return (
      <>
        <Header />
        <Suspense fallback={<QuizFallback />}>
          {UNIFIED_SUBJECTS.has(subject) ? (
            <UnifiedExamForm />
          ) : (
            <DynamicQuizForm subject={subject} phase={phase} grade={grade ?? undefined} />
          )}
        </Suspense>
      </>
    )
  }

  // Rutas legacy por id (compatibilidad)
  const ID_TO_SUBJECT: Record<string, string> = {
    lectura:  'Lenguaje',
    quiz:     'Matemáticas',
    sociales: 'Ciencias Sociales',
    ingles:   'Inglés',
  }

  return (
    <>
      <Header />
      <Suspense fallback={<QuizFallback />}>
        {ID_TO_SUBJECT[id] ? (
          <UnifiedExamForm />
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