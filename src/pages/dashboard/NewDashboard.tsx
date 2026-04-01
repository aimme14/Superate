import { lazy, Suspense, useEffect } from "react"
import { AlertCircle } from "lucide-react"

const InnovativeHero = lazy(() => import("../inovativeGero"))
const Prueba = lazy(() => import("../prueba"))
const Intento = lazy(() => import("../Intento"))
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import { StudentNav } from "@/components/student/StudentNav"
import { StudentMobileQuickNav } from "@/components/student/StudentMobileQuickNav"

export function Home() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const target = document.querySelector(hash)
      if (target) {
        target.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [])
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution()
  const { theme } = useThemeContext()

  return (
    <div
      className={cn("flex flex-col md:min-h-screen", theme === "dark" ? "bg-zinc-900" : "")}
    >
      {/* Sección 1: Encabezado y Navegación */}
      <header className={cn("shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-b border-zinc-700' : 'bg-white')}>
        <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={institutionLogo} 
              width="40" 
              height="40" 
              alt={`Logo de ${institutionName}`} 
              className="mr-2 w-8 h-8 sm:w-12 sm:h-12 object-contain"
              onError={(e) => {
                e.currentTarget.src = '/assets/agustina.png'
              }}
            />
            <span className={cn("font-bold text-sm sm:text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>

          <StudentNav theme={theme || "light"} />
        </div>
      </header>

      {/* Sección 2: Contenido Principal */}
      <main className="flex-grow max-md:flex-grow-0">
        {/* Banner de Práctica */}
        <section>
          <Suspense fallback={null}>
            <InnovativeHero />
          </Suspense>
        </section>

        {/* Alert Section Mejorado — oculto en móvil */}
        <section
          className={cn(
            "hidden md:block py-6 sm:py-8",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50'
          )}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div
              className={cn("rounded-xl p-4 sm:p-6 shadow-md", theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-blue-200/50')}
            >
              <div className="flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Información Importante</h3>
                  <p className={cn("leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Este examen evalúa todas las competencias del Saber 11.°. En las preguntas encontrarás situaciones donde deberás
                    aplicar tus conocimientos para tomar decisiones y elegir la respuesta correcta simulando la prueba ICFES.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tarjetas de Contenido */}
        <section
          id="evaluacion"
          className={cn(
            "hidden md:block py-8 sm:py-12",
            theme === "dark" ? "bg-zinc-900" : ""
          )}
        >
          <div className="container mx-auto px-4">
            {/* Título Principal */}
            <div className="text-center mb-10 sm:mb-16">
              <h2 className={cn("text-3xl sm:text-4xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Módulos de{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Seguimiento Académico
                </span>
              </h2>
              <p className={cn("text-lg sm:text-xl max-w-3xl mx-auto", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Selecciona un módulo para comenzar tu evaluación solo cuando el docente de aula lo hay indicado .
              </p>
              <Suspense fallback={null}>
                <Intento />
                <Prueba />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <StudentMobileQuickNav theme={theme || "light"} />
    </div>
  )
}


