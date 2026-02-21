import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  Target,
  Award,
  BookOpen,
  ClipboardCheck,
  Laptop,
  Headphones,
} from "lucide-react"

import { WhatsAppFab } from "@/components/WhatsAppFab"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background pt-6 pb-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-foreground mb-4">Acerca de Nosotros</h1>
          <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
            Superate es una plataforma educativa dedicada a evaluar y mejorar el rendimiento académico de estudiantes en
            toda Colombia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-12">
          <Card>
            <CardContent className="p-6">
              <Users className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-card-foreground">Nuestra Misión</h3>
              <p className="text-gray-600 dark:text-muted-foreground">
                Proporcionar herramientas de evaluación académica de alta calidad que permitan a estudiantes y
                educadores identificar fortalezas y áreas de mejora en el proceso de aprendizaje.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Target className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-card-foreground">Nuestra Visión</h3>
              <p className="text-gray-600 dark:text-muted-foreground">
                Ser la plataforma líder en evaluación académica en Colombia, contribuyendo al mejoramiento de la calidad
                educativa y al desarrollo integral de los estudiantes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Award className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-card-foreground">Nuestros Valores</h3>
              <ul className="text-gray-600 dark:text-muted-foreground space-y-1">
                <li>• Excelencia académica</li>
                <li>• Innovación tecnológica</li>
                <li>• Transparencia en los procesos</li>
                <li>• Compromiso con la educación</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <BookOpen className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-card-foreground">Nuestro Equipo</h3>
              <p className="text-gray-600 dark:text-muted-foreground">
                Contamos con un equipo multidisciplinario de educadores, psicólogos, desarrolladores y especialistas en
                evaluación académica comprometidos con la excelencia educativa.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-8">
            <h3 className="text-2xl font-semibold mb-4 text-center text-card-foreground">¿Por qué elegir Superate?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-purple-100 dark:bg-purple-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-purple-200 dark:ring-purple-800/50">
                  <ClipboardCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold mb-2 text-card-foreground">Evaluaciones Personalizadas</h4>
                <p className="text-gray-600 dark:text-muted-foreground text-sm">
                  Adaptamos nuestras evaluaciones a las necesidades específicas de cada estudiante
                </p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 dark:bg-purple-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-purple-200 dark:ring-purple-800/50">
                  <Laptop className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold mb-2 text-card-foreground">Tecnología Avanzada</h4>
                <p className="text-gray-600 dark:text-muted-foreground text-sm">
                  Utilizamos las últimas tecnologías para proporcionar resultados precisos y confiables
                </p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 dark:bg-purple-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-purple-200 dark:ring-purple-800/50">
                  <Headphones className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold mb-2 text-card-foreground">Soporte Continuo</h4>
                <p className="text-gray-600 dark:text-muted-foreground text-sm">Ofrecemos acompañamiento constante a estudiantes y educadores</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      <WhatsAppFab />
    </div>
  )
}
