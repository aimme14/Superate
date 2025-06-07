import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Calendar, X, MenuIcon } from "lucide-react"
import { useUserActivities } from "@/hooks/format/user/useUserActivities"
import { ThemeContextProps } from "@/interfaces/context.interface"
import { useCalendar, Event } from "@/hooks/ui/useCalendar"
import { useState } from "react"

const CalendarSection = ({ theme }: ThemeContextProps) => {
  const handleEventClick = (event: Event) => { setSelectedEvent(event) }
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const {
    weekDays,
    monthDays,
    timeSlots,
    currentDate,
    displayDate,
    currentView,
    displayMonth,
    selectedEvent,
    miniCalendarInfo,
    isSameDay,
    goToNext,
    goToToday,
    goToPrevious,
    setCurrentView,
    setCurrentDate,
    setSelectedEvent,
    calculateEventStyle
  } = useCalendar()

  const { events, isLoading } = useUserActivities()
  if (isLoading) return <div>Loading...</div>
  return (
    <div className="max-w-8xl mx-auto">
      <div className={`bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden ${theme === "dark" ? "dark" : ""}`}>
        {/* Header del calendario */}
        <div className="p-4 flex flex-col sm:flex-row items-center justify-between border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center mb-4 sm:mb-0">
            <button
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 mr-1"
              onClick={goToPrevious}
            >
              <ChevronLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <button
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 mr-4"
              onClick={goToNext}
            >
              <ChevronRight className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
            </button>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-white">
              {currentView === "month" ? displayMonth : displayDate}
            </h2>
          </div>

          <div className="flex items-center">
            <button
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md mr-2"
              onClick={goToToday}
            >
              Today
            </button>
            <div className="hidden md:flex space-x-1 bg-zinc-100 dark:bg-zinc-700 rounded-md p-1">
              <button
                className={`px-3 py-1 text-sm font-medium rounded-md ${currentView === "day" ? "bg-white dark:bg-zinc-600 shadow" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => setCurrentView("day")}
              >
                Day
              </button>
              <button
                className={`px-3 py-1 text-sm font-medium rounded-md ${currentView === "week" ? "bg-white dark:bg-zinc-600 shadow" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => setCurrentView("week")}
              >
                Week
              </button>
              <button
                className={`px-3 py-1 text-sm font-medium rounded-md ${currentView === "month" ? "bg-white dark:bg-zinc-600 shadow" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => setCurrentView("month")}
              >
                Month
              </button>
            </div>
            <button
              className="md:hidden p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 ml-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <MenuIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Menú móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
            <div className="flex justify-center space-x-1 p-2">
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${currentView === "day" ? "bg-zinc-100 dark:bg-zinc-700" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => {
                  setCurrentView("day")
                  setIsMobileMenuOpen(false)
                }}
              >
                Day
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${currentView === "week" ? "bg-zinc-100 dark:bg-zinc-700" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => {
                  setCurrentView("week")
                  setIsMobileMenuOpen(false)
                }}
              >
                Week
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${currentView === "month" ? "bg-zinc-100 dark:bg-zinc-700" : "text-zinc-700 dark:text-zinc-200"}`}
                onClick={() => {
                  setCurrentView("month")
                  setIsMobileMenuOpen(false)
                }}
              >
                Month
              </button>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div className="flex flex-col md:flex-row">
          {/* Sidebar con mini calendario */}
          <div className="md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-700">
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="font-medium text-zinc-900 dark:text-white">{displayMonth}</h3>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={i}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array(miniCalendarInfo.firstDayOffset)
                  .fill(null)
                  .map((_, i) => (
                    <div key={`empty-${i}`} className="h-7 w-7"></div>
                  ))}
                {miniCalendarInfo.days
                  .filter((day) => day !== null)
                  .map((day, i) => {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day as number)
                    const isToday = isSameDay(date, new Date())
                    const isSelected = isSameDay(date, currentDate)

                    return (
                      <div
                        key={`day-${i}`}
                        className={`h-7 w-7 flex items-center justify-center text-xs rounded-full cursor-pointer
                            ${isToday ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300" : ""}
                            ${isSelected ? "bg-blue-500 text-white" : ""}
                            ${!isToday && !isSelected ? "hover:bg-zinc-100 dark:hover:bg-zinc-700" : ""}
                          `}
                        onClick={() => setCurrentDate(date)}
                      >
                        {day}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Próximos eventos */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-3">Upcoming Events</h3>
              <div className="space-y-3">
                {events
                  .filter((event) => event.date >= new Date())
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .slice(0, 3)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="p-2 rounded-md cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex items-start">
                        <div className={`${event.color} w-3 h-3 rounded-full mt-1 mr-2`}></div>
                        <div>
                          <h4 className="font-medium text-zinc-900 dark:text-white text-sm">{event.title}</h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                            }).format(event.date)}{" "}
                            · {event.startTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Vista principal del calendario */}
          <div className="flex-1 overflow-auto">
            <div className="h-full">
              {/* Vista diaria */}
              {currentView === "day" && (
                <div className="flex flex-col h-full">
                  <div className="border-b border-zinc-200 dark:border-zinc-700 p-4 text-center">
                    <h3 className="font-medium text-zinc-900 dark:text-white">
                      {new Intl.DateTimeFormat("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }).format(currentDate)}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="relative" style={{ height: "calc(9 * 60px)" }}>
                      {/* Líneas de hora */}
                      {timeSlots.map((hour) => (
                        <div
                          key={hour}
                          className="absolute w-full border-t border-zinc-200 dark:border-zinc-700 flex"
                          style={{ top: `${(hour - 8) * 60}px` }}
                        >
                          <div className="w-16 pr-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
                            {hour}:00
                          </div>
                          <div className="flex-1"></div>
                        </div>
                      ))}

                      {/* Eventos */}
                      {events
                        .filter((event) => isSameDay(event.date, currentDate))
                        .map((event) => {
                          const style = calculateEventStyle(event.startTime, event.endTime)
                          return (
                            <div
                              key={event.id}
                              className={`absolute left-16 right-4 ${event.color} rounded-md p-2 text-white cursor-pointer`}
                              style={{ top: style.top, height: style.height }}
                              onClick={() => handleEventClick(event)}
                            >
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <p className="text-xs">
                                {event.startTime} - {event.endTime}
                              </p>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Vista semanal */}
              {currentView === "week" && (
                <div className="flex flex-col h-full">
                  <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
                    {weekDays.map((day, i) => {
                      const isToday = isSameDay(day.date, new Date())
                      return (
                        <div
                          key={i}
                          className={`p-2 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                          onClick={() => {
                            setCurrentDate(day.date)
                            setCurrentView("day")
                          }}
                        >
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{day.dayName}</div>
                          <div
                            className={`text-sm font-medium ${isToday ? "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto" : "text-zinc-900 dark:text-white"}`}
                          >
                            {day.dayNumber}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="relative" style={{ height: "calc(9 * 60px)" }}>
                      {/* Líneas de hora */}
                      {timeSlots.map((hour) => (
                        <div
                          key={hour}
                          className="absolute w-full border-t border-zinc-200 dark:border-zinc-700 flex"
                          style={{ top: `${(hour - 8) * 60}px` }}
                        >
                          <div className="w-16 pr-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
                            {hour}:00
                          </div>
                          <div className="flex-1 grid grid-cols-7 gap-0">
                            {Array(7)
                              .fill(0)
                              .map((_, i) => (
                                <div key={i} className="border-l border-zinc-200 dark:border-zinc-700 h-full"></div>
                              ))}
                          </div>
                        </div>
                      ))}

                      {/* Eventos */}
                      {events.map((event) => {
                        // Encontrar el índice del día en la semana
                        const dayIndex = weekDays.findIndex((day) => isSameDay(day.date, event.date))
                        if (dayIndex === -1) return null

                        const style = calculateEventStyle(event.startTime, event.endTime)
                        const leftPosition = `calc(${(dayIndex / 7) * 100}% + 16px)`
                        const width = `calc(${100 / 7}% - 4px)`

                        return (
                          <div
                            key={event.id}
                            className={`absolute ${event.color} rounded-md p-1 text-white cursor-pointer overflow-hidden`}
                            style={{
                              top: style.top,
                              height: style.height,
                              left: leftPosition,
                              width: width,
                            }}
                            onClick={() => handleEventClick(event)}
                          >
                            <h4 className="font-medium text-xs truncate">{event.title}</h4>
                            <p className="text-xs truncate">
                              {event.startTime} - {event.endTime}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Vista mensual */}
              {currentView === "month" && (
                <div className="grid grid-cols-7 auto-rows-fr h-full">
                  {/* Encabezados de día */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                    <div
                      key={i}
                      className="p-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Días del mes */}
                  {monthDays.map((day, i) => {
                    const isToday = isSameDay(day.date, new Date())
                    const dayEvents = events.filter((event) => isSameDay(event.date, day.date))

                    return (
                      <div
                        key={i}
                        className={`border-b border-r border-zinc-200 dark:border-zinc-700 p-1 overflow-hidden ${day.currentMonth ? "bg-white dark:bg-zinc-800" : "bg-zinc-50 dark:bg-zinc-900"} ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                        onClick={() => {
                          setCurrentDate(day.date)
                          setCurrentView("day")
                        }}
                      >
                        <div
                          className={`text-sm font-medium ${day.currentMonth ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"} ${isToday ? "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}`}
                        >
                          {day.date.getDate()}
                        </div>

                        {/* Show max 3 events per day in month view */}
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((event, eventIndex) => (
                            <div
                              key={eventIndex}
                              className={`${event.color} rounded px-1 py-0.5 text-white text-[10px] truncate cursor-pointer`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEventClick(event)
                              }}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 pl-1">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de detalles del evento */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`${selectedEvent.color} p-6 rounded-lg shadow-xl max-w-md w-full mx-4`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-white">{selectedEvent.title}</h3>
                <button
                  className="text-white hover:bg-white/20 rounded-full p-1"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-white">
                <p className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  {`${selectedEvent.startTime} - ${selectedEvent.endTime}`}
                </p>
                <p className="flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  {selectedEvent.location}
                </p>
                <p className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }).format(selectedEvent.date)}
                </p>
                <p className="flex items-start">
                  <Users className="mr-2 h-5 w-5 mt-1" />
                  <span>
                    <strong>Attendees:</strong>
                    <br />
                    {selectedEvent.attendees.join(", ") || "No attendees"}
                  </span>
                </p>
                <p>
                  <strong>Organizer:</strong> {selectedEvent.organizer}
                </p>
                <p>
                  <strong>Description:</strong> {selectedEvent.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarSection