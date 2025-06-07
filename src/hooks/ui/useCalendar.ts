import { useState, useEffect, useCallback } from "react"

export interface Event {
  startTime: string
  endTime: string
  title: string
  color: string
  id: number
  date: Date
  location: string
  attendees: string[]
  description: string
  organizer: string
}

export interface WeekDay {
  date: Date
  dayName: string
  dayNumber: number
}

export interface MiniCalendarInfo {
  days: (number | null)[]
  firstDayOffset: number
}

export interface MonthDay {
  date: Date
  currentMonth: boolean
}

export interface CalendarHookResult {
  // Estados
  selectedEvent: Event | null
  currentDate: Date
  currentView: string
  displayMonth: string
  displayDate: string

  // Días y slots
  weekDays: WeekDay[]
  miniCalendarInfo: MiniCalendarInfo
  monthDays: MonthDay[]
  timeSlots: number[]

  // Funciones de navegación
  goToToday: () => void
  goToPrevious: () => void
  goToNext: () => void

  // Funciones de manejo de eventos
  setSelectedEvent: (event: Event | null) => void
  setCurrentView: (view: string) => void
  setCurrentDate: (date: Date) => void

  // Utilidades
  isSameDay: (date1: Date, date2: Date) => boolean
  calculateEventStyle: (startTime: string, endTime: string) => { top: string; height: string }
}

/**
 * Hook personalizado para manejar la lógica del calendario
 * @returns Objeto con estados y funciones para manipular el calendario
 */
export function useCalendar(): CalendarHookResult {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState("week")
  const [displayMonth, setDisplayMonth] = useState("")
  const [displayDate, setDisplayDate] = useState("")

  // Función para formatear la fecha actual
  useEffect(() => {
    const formatMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentDate)
    const formatDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(currentDate)
    setDisplayMonth(formatMonth)
    setDisplayDate(formatDate)
  }, [currentDate])

  // Funciones de navegación
  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const goToPrevious = useCallback(() => {
    const newDate = new Date(currentDate)
    if (currentView === "day") {
      newDate.setDate(newDate.getDate() - 1)
    } else if (currentView === "week") {
      newDate.setDate(newDate.getDate() - 7)
    } else if (currentView === "month") {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }, [currentDate, currentView])

  const goToNext = useCallback(() => {
    const newDate = new Date(currentDate)
    if (currentView === "day") {
      newDate.setDate(newDate.getDate() + 1)
    } else if (currentView === "week") {
      newDate.setDate(newDate.getDate() + 7)
    } else if (currentView === "month") {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }, [currentDate, currentView])

  // Función para generar los días de la semana basados en la fecha actual
  const getWeekDays = useCallback(() => {
    const date = new Date(currentDate)
    const day = date.getDay() // 0 = Sunday, 6 = Saturday
    const diff = date.getDate() - day

    return Array(7)
      .fill(0)
      .map((_, i) => {
        const d = new Date(date)
        d.setDate(diff + i)
        return {
          date: d,
          dayName: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d).toUpperCase(),
          dayNumber: d.getDate(),
        }
      })
  }, [currentDate])

  // Función para generar los días del mes para el mini calendario
  const getMiniCalendarDays = useCallback(() => {
    const date = new Date(currentDate)
    date.setDate(1) // Primer día del mes

    const firstDayOfMonth = date.getDay() // 0 = Sunday, 6 = Saturday
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

    return {
      days: Array(daysInMonth + firstDayOfMonth)
        .fill(null)
        .map((_, i) => (i < firstDayOfMonth ? null : i - firstDayOfMonth + 1)),
      firstDayOffset: firstDayOfMonth,
    }
  }, [currentDate])

  // Función para generar los días del mes para la vista mensual
  const getMonthDays = useCallback(() => {
    const date = new Date(currentDate)
    date.setDate(1) // Primer día del mes

    const firstDayOfMonth = date.getDay() // 0 = Sunday, 6 = Saturday
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const prevMonthDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate()

    const days = []

    // Días del mes anterior
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(date)
      d.setMonth(d.getMonth() - 1)
      d.setDate(prevMonthDays - i)
      days.push({ date: d, currentMonth: false })
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(date)
      d.setDate(i)
      days.push({ date: d, currentMonth: true })
    }

    // Días del mes siguiente (para completar la cuadrícula de 6 semanas)
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(date)
      d.setMonth(d.getMonth() + 1)
      d.setDate(i)
      days.push({ date: d, currentMonth: false })
    }

    return days
  }, [currentDate])

  // Función para verificar si dos fechas son el mismo día
  const isSameDay = useCallback((date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }, [])

  // Helper function to calculate event position and height
  const calculateEventStyle = useCallback((startTime: string, endTime: string) => {
    const startHour = parseInt(startTime.split(":")[0])
    const endHour = parseInt(endTime.split(":")[0])
    const top = `${(startHour - 8) * 60 + parseInt(startTime.split(":")[1])}px`
    const height = `${(endHour - startHour) * 60 - parseInt(startTime.split(":")[1]) + parseInt(endTime.split(":")[1])}px`
    return { top, height }
  }, [])

  // Calcular los días y slots
  const weekDays = getWeekDays()
  const miniCalendarInfo = getMiniCalendarDays()
  const monthDays = getMonthDays()
  const timeSlots = Array.from({ length: 9 }, (_, i) => i + 8) // 8 AM to 4 PM

  return {
    // Estados
    selectedEvent,
    currentDate,
    currentView,
    displayMonth,
    displayDate,

    // Días y slots
    weekDays,
    miniCalendarInfo,
    monthDays,
    timeSlots,

    // Funciones de navegación
    goToToday,
    goToPrevious,
    goToNext,

    // Funciones de manejo de eventos
    setSelectedEvent,
    setCurrentView,
    setCurrentDate,

    // Utilidades
    isSameDay,
    calculateEventStyle
  }
}