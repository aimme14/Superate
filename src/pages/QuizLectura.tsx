import ExamForm from "@/sections/quizLectura/fromExamLengua"
import HeaderLectura from "@/sections/quiz/Header"

const QuizLectura = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderLectura />
      <main className="container mx-auto py-8 px-4">
        <ExamForm />
      </main>
      <footer className="bg-white border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Supérate. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}

export default QuizLectura