import ExamFormLecture from "@/sections/quizLectura/fromExamLengua"
import ExamFormSociales from "@/sections/quizSociales/fromExamSociales"
import ExamFormNaturales from "@/sections/quizNaturales/fromExamNaturales"
import ExamFormIngles from "@/sections/quizIngles/fromExamIngles"
import ExamFormMath from "@/sections/quiz/FormExam"
import DynamicQuizForm from "@/components/quiz/DynamicQuizForm"
import { useParams, useSearchParams } from "react-router-dom"
import Header from "@/sections/quiz/Header"

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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto py-8 px-4">
          {subject === 'Lenguaje' ? (
            <ExamFormLecture />
          ) : subject === 'Matemáticas' ? (
            <ExamFormMath />
          ) : subject === 'Ciencias Sociales' ? (
            <ExamFormSociales />
          ) : subject === 'Ciencias Naturales' ? (
            <ExamFormNaturales />
          ) : subject === 'Inglés' ? (
            <ExamFormIngles />
          ) : (
            <DynamicQuizForm 
              subject={subject} 
              phase={phase} 
              grade={grade || undefined} 
            />
          )}
        </main>
        <footer className="bg-white border-t py-6">
          <div className="container mx-auto px-4 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Supérate. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto py-8 px-4">
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
      </main>
      <footer className="bg-white border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Supérate. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}

export default Quiz