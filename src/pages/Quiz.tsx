import ExamFormLecture from "@/sections/quizLectura/fromExamLengua"
import ExamFormSociales from "@/sections/quizSociales/fromExamSociales"
import ExamFormNaturales from "@/sections/quizNaturales/fromExamNaturales"
import ExamFormIngles from "@/sections/quizIngles/fromExamIngles"
import ExamFormMath from "@/sections/quiz/FormExam"
import { useParams } from "react-router-dom"
import Header from "@/sections/quiz/Header"

const Quiz = () => {
  const { id = '' } = useParams();
  
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