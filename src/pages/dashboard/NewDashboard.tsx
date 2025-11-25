import { HousePlug, ContactRound, NotepadText, BarChart2, Apple, Target } from "lucide-react"
import { useQueryUser } from "@/hooks/query/useAuthQuery"
import { useAuthContext } from "@/context/AuthContext"
import { User } from "@/interfaces/context.interface"
import { Link } from "react-router-dom"
import InnovativeHero from "../inovativeGero"
import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"
import Prueba from "../prueba"
import Intento from "../Intento"
import { useEffect } from "react"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import PhaseDashboard from "@/components/student/PhaseDashboard"
  

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
  const { user } = useAuthContext()
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution()
  const { theme } = useThemeContext()

  const userId = user?.uid
  const { data: userFound } = useQueryUser().fetchUserById<User>(userId as string, !!user)

  console.log(userFound)
  return (
    <div className={cn("min-h-screen flex flex-col", theme === 'dark' ? 'bg-zinc-900' : '')}>
      {/* Sección 1: Encabezado y Navegación */}
      <header className={cn("shadow-sm", theme === 'dark' ? 'bg-zinc-800 border-b border-zinc-700' : 'bg-white')}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={institutionLogo} 
              width="80" 
              height="80" 
              alt={`Logo de ${institutionName}`} 
              className="mr-2"
              onError={(e) => {
                e.currentTarget.src = '/assets/agustina.png'
              }}
            />
            <span className={cn("font-bold text-2xl", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/dashboard#fases" icon={<Target className="w-5 h-5" />} text="Fases Evaluativas" theme={theme} />
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" theme={theme} />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" theme={theme} />
            <NavItem href="/exam-analyzer" icon={<HousePlug className="w-5 h-5" />} text="Mi progreso" theme={theme}/>
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" active theme={theme}/>
          </nav>
        </div>
      </header>

      {/* Sección 2: Contenido Principal */}
      <main className="flex-grow">
        {/* Banner de Práctica */}
        <section>
          <InnovativeHero />
        </section>

        {/* Sección de Fases Evaluativas */}
        <section id="fases" className={cn("py-12", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h2 className={cn("text-4xl font-bold mb-4 text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Sistema de{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Evaluación por Fases
                </span>
              </h2>
              <p className={cn("text-xl max-w-3xl mx-auto text-center", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Completa cada fase para desbloquear la siguiente. Tu progreso será analizado por IA para generar planes de mejoramiento personalizados.
              </p>
            </motion.div>
            <PhaseDashboard theme={theme} />
          </div>
        </section>

        {/* Alert Section Mejorado */}
        <section className={cn("py-8", theme === 'dark' ? 'bg-zinc-900' : 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50')}>
          <div className="max-w-6xl mx-auto px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("backdrop-blur-sm rounded-xl p-6 shadow-lg", theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-white/80 border border-blue-200/50')}
            >
              <div className="flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Información Importante</h3>
                  <p className={cn("leading-relaxed", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    El examen Saber 11.° evalúa competencias. En las preguntas encontrarás situaciones donde deberás
                    aplicar tus conocimientos para tomar decisiones y elegir la respuesta correcta.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tarjetas de Contenido */}
        <section id="evaluacion" className={cn("py-12", theme === 'dark' ? 'bg-zinc-900' : '')}>
          <div className="container mx-auto px-4">
            {/* Título Principal */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
              <h2 className={cn("text-4xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Módulos de{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Evaluación
                </span>
              </h2>
              <p className={cn("text-xl max-w-3xl mx-auto", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                Selecciona un módulo para comenzar tu evaluación. Nuestra IA analizará tus respuestas en tiempo real.
              </p>
              <Intento />
              <Prueba />
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  )
}

interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
  theme?: 'light' | 'dark';
}

// Componentes auxiliares
function NavItem({ href, icon, text, active = false, theme = 'light' }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center",
        active 
          ? theme === 'dark' ? "text-red-400 font-medium" : "text-red-600 font-medium"
          : theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  )
}




