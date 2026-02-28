import type { Question } from '@/services/firebase/question.service'
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config'

/** Extrae solo el texto sin tags HTML */
export function stripHtmlTags(html: string): string {
  if (!html) return ''
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  return tempDiv.textContent || tempDiv.innerText || ''
}

/** Extrae el texto real del usuario de matching/columnas (formato: MATCHING_COLUMNS_GROUP_ID|texto) */
export function extractMatchingText(informativeText: string | undefined | null): string {
  if (!informativeText) return ''
  if (informativeText.includes('|')) {
    const parts = informativeText.split('|')
    return parts.slice(1).join('|')
  }
  return ''
}

/** Extrae el identificador de grupo de matching/columnas */
export function extractMatchingGroupId(informativeText: string | undefined | null): string {
  if (!informativeText) return ''
  if (informativeText.includes('|')) {
    return informativeText.split('|')[0]
  }
  return informativeText
}

/** Ordena preguntas por orden de creación (más antigua primero), con soporte para huecos en cloze */
export function sortQuestionsByCreationOrder(a: Question, b: Question): number {
  const aMatch = a.questionText?.match(/hueco \[(\d+)\]/)
  const bMatch = b.questionText?.match(/hueco \[(\d+)\]/)
  if (aMatch && bMatch) {
    return parseInt(aMatch[1]) - parseInt(bMatch[1])
  }
  const dateA = new Date(a.createdAt).getTime()
  const dateB = new Date(b.createdAt).getTime()
  if (dateA !== dateB) return dateA - dateB
  return (a.code || '').localeCompare(b.code || '')
}

/** Verifica si la justificación de IA tiene problemas de calidad */
export function hasAIIssues(question: Question): boolean {
  const j = question.aiJustification
  if (!j) return false
  return (
    j.confidence < 0.7 ||
    !j.correctAnswerExplanation ||
    j.correctAnswerExplanation.length < 50 ||
    !j.incorrectAnswersExplanation ||
    j.incorrectAnswersExplanation.length === 0 ||
    !j.keyConcepts ||
    j.keyConcepts.length < 2
  )
}

export interface GroupEntry {
  type: 'group'
  groupKey: string
  groupQuestions: Question[]
  latestDate: number
  isMatchingColumns: boolean
  isClozeTest: boolean
  isOtherSubjectsReadingComprehension: boolean
  isSingleOtherSubjectQuestion: boolean
  groupName: string
  firstQuestion: Question
}

export interface QuestionEntry {
  type: 'question'
  question: Question
  latestDate: number
}

export type CombinedItem = GroupEntry | QuestionEntry

/**
 * Agrupa preguntas relacionadas (Cloze Test, Comprensión de Lectura, Matching/Columnas)
 * y retorna un array ordenado por fecha (más reciente primero)
 */
export function getCombinedItems(
  filteredQuestions: Question[],
  allQuestions: Question[]
): CombinedItem[] {
  const groupedQuestions: Record<string, Question[]> = {}
  const ungroupedQuestions: Question[] = []
  const processedIds = new Set<string>()

  for (const question of filteredQuestions) {
    if (processedIds.has(question.id || '')) continue

    const isMatchingColumns =
      question.subjectCode === 'IN' &&
      question.informativeText &&
      typeof question.informativeText === 'string' &&
      (question.informativeText.startsWith('MATCHING_COLUMNS_') ||
        question.informativeText.includes('MATCHING_COLUMNS_'))

    const isClozeTest =
      question.subjectCode === 'IN' && question.questionText?.includes('completar el hueco')

    const isEnglishReadingComprehension =
      question.subjectCode === 'IN' && question.informativeText && !isMatchingColumns && !isClozeTest

    const hasMultipleWithSameInformativeText = allQuestions.some(
      (q) =>
        q.informativeText === question.informativeText &&
        q.id !== question.id &&
        q.subjectCode === question.subjectCode &&
        q.topicCode === question.topicCode &&
        q.grade === question.grade &&
        q.levelCode === question.levelCode
    )

    const isOtherSubjectsReadingComprehension =
      question.subjectCode !== 'IN' &&
      question.informativeText &&
      typeof question.informativeText === 'string' &&
      question.informativeText.trim().length > 0 &&
      !question.informativeText.includes('MATCHING_COLUMNS_') &&
      !question.questionText?.includes('completar el hueco') &&
      hasMultipleWithSameInformativeText

    const shouldGroup =
      question.informativeText &&
      (isMatchingColumns ||
        isClozeTest ||
        isOtherSubjectsReadingComprehension ||
        isEnglishReadingComprehension ||
        (question.subjectCode === 'IN' &&
          allQuestions.some(
            (q) => q.informativeText === question.informativeText && q.id !== question.id
          )))

    if (shouldGroup) {
      const groupKey = isMatchingColumns
        ? `${extractMatchingGroupId(question.informativeText)}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`
        : `${question.informativeText}_${question.subjectCode}_${question.topicCode}_${question.grade}_${question.levelCode}`

      if (!groupedQuestions[groupKey]) groupedQuestions[groupKey] = []

      const related = filteredQuestions.filter((q) => {
        if (
          q.subjectCode !== question.subjectCode ||
          q.topicCode !== question.topicCode ||
          q.grade !== question.grade ||
          q.levelCode !== question.levelCode ||
          processedIds.has(q.id || '')
        ) {
          return false
        }
        if (isMatchingColumns) {
          return (
            extractMatchingGroupId(q.informativeText) ===
            extractMatchingGroupId(question.informativeText)
          )
        }
        if (isClozeTest) {
          return (
            q.informativeText === question.informativeText &&
            JSON.stringify(q.informativeImages || []) ===
              JSON.stringify(question.informativeImages || []) &&
            q.questionText?.includes('completar el hueco')
          )
        }
        if (isEnglishReadingComprehension) {
          return (
            q.subjectCode === 'IN' &&
            q.informativeText === question.informativeText &&
            JSON.stringify(q.informativeImages || []) ===
              JSON.stringify(question.informativeImages || []) &&
            !q.questionText?.includes('completar el hueco') &&
            !q.informativeText?.includes('MATCHING_COLUMNS_')
          )
        }
        if (isOtherSubjectsReadingComprehension) {
          return (
            q.subjectCode !== 'IN' &&
            q.informativeText === question.informativeText &&
            JSON.stringify(q.informativeImages || []) ===
              JSON.stringify(question.informativeImages || []) &&
            !q.questionText?.includes('completar el hueco') &&
            !q.informativeText?.includes('MATCHING_COLUMNS_')
          )
        }
        return (
          q.informativeText === question.informativeText &&
          JSON.stringify(q.informativeImages || []) ===
            JSON.stringify(question.informativeImages || [])
        )
      })

      for (const q of related) {
        groupedQuestions[groupKey].push(q)
        processedIds.add(q.id || '')
      }
      groupedQuestions[groupKey].sort(sortQuestionsByCreationOrder)
    } else {
      ungroupedQuestions.push(question)
      processedIds.add(question.id || '')
    }
  }

  const groupEntries: GroupEntry[] = Object.entries(groupedQuestions).map(
    ([groupKey, groupQuestions]) => {
      const firstQuestion = groupQuestions[0]
      const isMatchingColumns = groupQuestions.some(
        (q) =>
          q.subjectCode === 'IN' &&
          q.informativeText &&
          typeof q.informativeText === 'string' &&
          (q.informativeText.startsWith('MATCHING_COLUMNS_') ||
            q.informativeText.includes('MATCHING_COLUMNS_'))
      )
      const isClozeTest = groupQuestions.some((q) =>
        q.questionText?.includes('completar el hueco')
      )
      const hasOtherSubjectsWithInformativeText = groupQuestions.some(
        (q) =>
          q.subjectCode !== 'IN' &&
          q.informativeText &&
          !q.questionText?.includes('completar el hueco') &&
          !q.informativeText?.includes('MATCHING_COLUMNS_')
      )
      const isOtherSubjectsReadingComprehension =
        hasOtherSubjectsWithInformativeText && groupQuestions.length > 1
      const isSingleOtherSubjectQuestion =
        hasOtherSubjectsWithInformativeText && groupQuestions.length === 1

      let groupName: string
      if (isMatchingColumns) {
        groupName = `Inglés - matching / columnas - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
      } else if (isClozeTest) {
        groupName = `Inglés - Cloze Test / Rellenar Huecos - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
      } else if (isSingleOtherSubjectQuestion) {
        groupName = `${firstQuestion.subject} - Opción Múltiple Estándar - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
      } else if (isOtherSubjectsReadingComprehension) {
        groupName = `${firstQuestion.subject} - Comprensión de Lectura Corta - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
      } else {
        groupName = `Inglés - Comprensión de Lectura Corta - ${groupQuestions.length} pregunta${groupQuestions.length > 1 ? 's' : ''} - ${GRADE_CODE_TO_NAME[firstQuestion.grade]} - ${firstQuestion.level}`
      }

      return {
        type: 'group',
        groupKey,
        groupQuestions,
        latestDate: Math.max(...groupQuestions.map((q) => new Date(q.createdAt).getTime())),
        isMatchingColumns,
        isClozeTest,
        isOtherSubjectsReadingComprehension,
        isSingleOtherSubjectQuestion,
        groupName,
        firstQuestion,
      }
    }
  )

  const questionEntries: QuestionEntry[] = ungroupedQuestions.map((question) => ({
    type: 'question',
    question,
    latestDate: new Date(question.createdAt).getTime(),
  }))

  const combined: CombinedItem[] = [...groupEntries, ...questionEntries].sort(
    (a, b) => b.latestDate - a.latestDate
  )

  return combined
}
