import { Alert, AlertDescription, AlertTitle } from "#/ui/alert"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GroupedQuestionRange } from "@/utils/quizGroupedQuestions"

export interface GroupedQuestionNoticeProps {
  /** Rango de preguntas del grupo (start y end, 1-based) */
  range: GroupedQuestionRange
  /** Tema para estilos (dark/light) */
  theme?: 'dark' | 'light'
  /** Clases CSS adicionales para el contenedor */
  className?: string
}

/**
 * Aviso visual que indica al usuario que las siguientes preguntas
 * se responden con base en el mismo texto/información.
 * Se muestra antes de grupos de preguntas de comprensión de lectura.
 */
export function GroupedQuestionNotice({
  range,
  theme = 'light',
  className
}: GroupedQuestionNoticeProps) {
  const isDark = theme === 'dark'

  return (
    <Alert
      className={cn(
        "mb-4",
        isDark ? "border-blue-800 bg-blue-900/30" : "border-blue-200 bg-blue-50",
        className
      )}
    >
      <AlertCircle className="h-4 w-4 text-blue-600" />
      <AlertTitle className={cn(isDark ? "text-blue-300" : "text-blue-800")}>
        Preguntas Agrupadas
      </AlertTitle>
      <AlertDescription className={cn(isDark ? "text-blue-200" : "text-blue-700")}>
        Las siguientes preguntas ({range.start} a {range.end}) se responden con base en el mismo texto / información.
      </AlertDescription>
    </Alert>
  )
}
