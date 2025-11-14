import ExamFormLecture from "@/sections/quizLectura/fromExamLengua"
import ExamFormSociales from "@/sections/quizSociales/fromExamSocialesNew"
import ExamFormNaturales from "@/sections/quizNaturales/fromExamNaturales"
import ExamFormIngles from "@/sections/quizIngles/fromExamIngles"
import ExamFormMath from "@/sections/quizMatematicas/fromExamMatematicas"
import ExamFormBiologia from "@/sections/quizBiologia/fromExamBiologia"
import ExamFormFisica from "@/sections/quizFisica/fromExamFisica"
import ExamFormQuimica from "@/sections/quizQuimica/fromExamQuimica"
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
      <>
        <Header />
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
      </>
    )
  }
  
  return (
    <>
      <Header />
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
    </>
  )
}

export default Quiz