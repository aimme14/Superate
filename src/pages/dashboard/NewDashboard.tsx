import { BookOpen, HousePlug, ContactRound, Calculator, CheckCircle, NotepadText, BarChart2, BookCheck, BookMarked, Leaf, ChevronRight, Brain, Award, TrendingUp, Zap, Lightbulb } from "lucide-react"
import { useQueryUser } from "@/hooks/query/useAuthQuery"
import { useAuthContext } from "@/context/AuthContext"
import { User } from "@/interfaces/context.interface"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import InnovativeHero from "../inovativeGero"
import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"
import Prueba from "../prueba"

export default function Home() {
  const { user } = useAuthContext()

  const userId = user?.uid
  const { data: userFound } = useQueryUser().fetchUserById<User>(userId as string, !!user)

  console.log(userFound)
  return (
    <div className="min-h-screen flex flex-col">
      {/* Sección 1: Encabezado y Navegación */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/assets/agustina.png" width="80" height="80" alt="ICFES Logo" className="mr-2" />
            <span className="text-red-600 font-bold text-2xl">I.E. Colegio Agustina Ferro</span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" />
            <NavItem href="/dashboard" icon={<HousePlug className="w-5 h-5" />} text="Presenta tus evaluaciones" active/>
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="promedio" />
          </nav>
        </div>
      </header>

      {/* Sección 2: Contenido Principal */}
      <main className="flex-grow">
        {/* Banner de Práctica */}
        <section className="bg-[#e8f5d9] py-12">
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
        <section className="py-12">
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
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tarjeta 1 */}
              <ContentCard
                title="Objetivos de la prueba"
                icon={<CheckCircle className="w-16 h-16 text-amber-500" />}
                description="Poder prepararte a la hora de presentar el examen saber 11°"
                buttonLink="#"
                buttonText="Clic aquí"
              />

              {/* Tarjeta 2 */}
              <ContentCard
                title="Lectura Crítica"
                buttonLink="/quiz/lectura"
                status={userFound?.statusExams?.lectura}
                buttonText="Cuestionario"
                icon={<BookOpen className="w-16 h-16 text-purple-500" />}
                description="Con este formulario pondrás a prueba tu capacidad para analizar y comprender textos. 
                Desarrolla tu pensamiento crítico enfrentándote a situaciones donde deberás interpretar, argumentar y decidir con claridad."
              />

              {/* Tarjeta 3 */}
              <ContentCard
                title="Matemáticas"
                buttonLink="/quiz/quiz"
                buttonText="Cuestionario"
                icon={<Calculator className="w-16 h-16 text-purple-500" />}
                description="Con este formulario pondrás a prueba tu razonamiento lógico y tus habilidades numéricas.
                Aplica fórmulas, analiza datos y resuelve problemas que retarán tu mente paso a paso."
              />

              {/* Tarjeta 4 */}
              <ContentCard
                buttonLink="/quiz/sociales"
                title="Ciencias Sociales"
                buttonText="Cuestionario"
                icon={<BookMarked className="w-16 h-16 text-purple-500" />}
                description="Con este formulario pondrás a prueba tu conocimiento sobre historia, sociedad y ciudadanía.
                Interpreta contextos, toma decisiones informadas y demuestra tu comprensión del mundo que te rodea."
              />

              {/* Tarjeta 5 */}
              <ContentCard
                buttonLink="/quiz/naturales"
                title="Ciencias Naturales"
                buttonText="Cuestionario"
                icon={<Leaf className="w-16 h-16 text-purple-500" />}
                description="Con este formulario pondrás a prueba tu entendimiento de la ciencia y sus fenómenos.
                Reta tus conocimientos de biología, física y química a través de situaciones que requieren análisis y lógica."
              />

              {/* Tarjeta 6 */}
              <ContentCard
                buttonLink="/quiz/ingles"
                title="Inglés"
                buttonText="Cuestionario"
                icon={<BookCheck className="w-16 h-16 text-purple-500" />}
                description="Con este formulario pondrás a prueba tu comprensión lectora en inglés.
                Interpreta textos, identifica ideas clave y toma decisiones acertadas en otro idioma."
              />
            </div>
            <Prueba />
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

function HomeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


interface ContentCardProps {
  buttons?: { text: string; link: string }[]
  icon: React.ReactNode
  description: string
  buttonLink: string
  buttonText: string
  status?: boolean
  title: string
}
function ContentCard({ title, icon, description, buttonText, buttonLink, buttons = [], status }: ContentCardProps) {
  console.log(status)
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-bold flex-grow">{title}</h2>
          <div className="bg-blue-100 rounded-full p-4">{icon}</div>
        </div>

        <p className="text-gray-700 mb-6">{description}</p>

        {buttonText && buttonLink && (
          <Link
            to={buttonLink}
            className="inline-block bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-full transition-colors"
          >
            {buttonText}
          </Link>
        )}

        {buttons.length > 0 && (
          <div className="space-y-3">
            {buttons.map((button, index) => (
              <Link
                key={index}
                to={button.link}
                className={cn(status ? "hidden" : "block", "w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors")}
              >
                {button.text}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}