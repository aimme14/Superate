import { HousePlug, ContactRound, NotepadText, BarChart2, Apple } from "lucide-react"
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

  const userId = user?.uid
  const { data: userFound } = useQueryUser().fetchUserById<User>(userId as string, !!user)

  console.log(userFound)
  return (
    <div className="min-h-screen flex flex-col">
      {/* Sección 1: Encabezado y Navegación */}
      <header className="bg-white shadow-sm">
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
            <span className="text-red-600 font-bold text-2xl">
              {isLoadingInstitution ? 'Cargando...' : institutionName}
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" />
            <NavItem href="/exam-analyzer" icon={<HousePlug className="w-5 h-5" />} text="Mi progreso"/>
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" active/>
          </nav>
        </div>
      </header>

      {/* Sección 2: Contenido Principal */}
      <main className="flex-grow">
        {/* Banner de Práctica */}
        <section>
          <InnovativeHero />
        </section>

        {/* Alert Section Mejorado */}
        <section className="py-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="max-w-6xl mx-auto px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6 shadow-lg"
            >
              <div className="flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Información Importante</h3>
                  <p className="text-gray-700 leading-relaxed">
                    El examen Saber 11.° evalúa competencias. En las preguntas encontrarás situaciones donde deberás
                    aplicar tus conocimientos para tomar decisiones y elegir la respuesta correcta.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tarjetas de Contenido */}
        <section id="evaluacion" className="py-12">
          <div className="container mx-auto px-4">
            {/* Título Principal */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Módulos de{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Evaluación
                </span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
}

// Componentes auxiliares
function NavItem({ href, icon, text, active = false }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`flex items-center ${active ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  )
}




