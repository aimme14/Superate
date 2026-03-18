import { useState, lazy, Suspense } from 'react'
import { ThemeContextProps } from '@/interfaces/context.interface'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  Building,
  Lock,
  BarChart3,
  Home,
  BookOpen,
  Brain,
  Loader2,
  FileText,
  FolderOpen,
  ChevronDown,
  Settings,
  Sparkles,
  ClipboardList,
  Construction,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// AdminOverviewTab importado solo para restaurar después del mantenimiento
// import AdminOverviewTab from '@/components/admin/AdminOverviewTab'

// Lazy por costo: evita montajes/lecturas hasta que el usuario entre al tab
const UserManagement = lazy(() => import('@/components/admin/UserManagement'))
const InstitutionManagement = lazy(() => import('@/components/admin/InstitutionManagement'))
const StudentPhaseReports = lazy(() => import('@/components/admin/StudentPhaseReports'))
const RegistrationSettings = lazy(() => import('@/components/admin/RegistrationSettings'))

// Lazy: cargar solo al abrir cada tab
const QuestionBank = lazy(() => import('@/components/admin/QuestionBank'))
const PhaseAuthorizationManagement = lazy(() => import('@/components/admin/PhaseAuthorizationManagement'))
const StudyPlanAuthorizationManagement = lazy(() => import('@/components/admin/StudyPlanAuthorizationManagement'))
const AdminRecursos = lazy(() => import('@/components/admin/AdminRecursos'))
const AdminHerramientasIA = lazy(() => import('@/components/admin/AdminHerramientasIA'))
const AdminSimulacros = lazy(() => import('@/components/admin/AdminSimulacros'))

interface AdminDashboardProps extends ThemeContextProps {}

export default function AdminDashboard({ theme }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Dashboard Administrador
          </h1>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Panel de control del sistema educativo
          </p>
        </div>
        <Badge variant="secondary" className={cn("text-sm", theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>
          Rol: Administrador
        </Badge>
      </div>

      {/* Tabs Navigation - Barra con menús desplegables horizontales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <nav
          className={cn(
            "flex w-full items-center justify-evenly gap-2 rounded-lg border p-1 text-sm font-medium",
            theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-muted border-border/30 shadow-sm'
          )}
        >
          {/* Inicio - sin desplegable */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === 'overview'
                ? theme === 'dark'
                  ? 'bg-teal-600/80 text-white'
                  : 'bg-primary text-primary-foreground'
                : theme === 'dark'
                  ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                  : 'text-black hover:bg-gray-100'
            )}
          >
            <Home className="h-4 w-4" />
            <span>Inicio</span>
          </button>

          {/* Nos conforman: Usuarios, Instituciones, Registro */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['users', 'institutions', 'settings'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <Users className="h-4 w-4" />
                <span>Nos conforman</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('users')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'users' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Users className="mr-2 h-4 w-4" />
                Usuarios
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('institutions')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'institutions' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Building className="mr-2 h-4 w-4" />
                Instituciones
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'settings' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Settings className="mr-2 h-4 w-4" />
                Registro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Estudio: Preguntas, Fases, Planes de Estudio, Recursos */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['questions', 'phases', 'study-plans', 'recursos', 'herramientas-ia', 'simulacros', 'temas-estudio'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <BookOpen className="h-4 w-4" />
                <span>Estudio</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('questions')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'questions' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Preguntas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('phases')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'phases' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Lock className="mr-2 h-4 w-4" />
                Fases
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('study-plans')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'study-plans' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Brain className="mr-2 h-4 w-4" />
                Planes de Estudio
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('recursos')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'recursos' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Recursos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('herramientas-ia')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'herramientas-ia' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Centro de Herramientas IA
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('simulacros')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'simulacros' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Simulacros
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab('temas-estudio')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'temas-estudio' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Temas de estudio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resultados: Análisis, Resúmenes PDF */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  ['analytics', 'reports'].includes(activeTab)
                    ? theme === 'dark'
                      ? 'bg-teal-600/80 text-white'
                      : 'bg-primary text-primary-foreground'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:bg-zinc-700 hover:text-white'
                      : 'text-black hover:bg-gray-100'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Resultados</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                "min-w-[10rem] rounded-lg shadow-lg",
                theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'bg-white border-gray-200'
              )}
            >
              <DropdownMenuItem
                onClick={() => setActiveTab('reports')}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-2",
                  activeTab === 'reports' && (theme === 'dark' ? 'bg-teal-600/30 text-teal-300' : 'bg-primary/10 text-primary')
                )}
              >
                <FileText className="mr-2 h-4 w-4" />
                Resúmenes PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Inicio: temporalmente en mantenimiento */}
        <TabsContent value="overview" className="space-y-6">
          <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-muted/30 border-border/50')}>
            <CardHeader className="text-center py-16">
              <div className="flex justify-center mb-4">
                <Construction className={cn('h-16 w-16', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
              </div>
              <CardTitle className={cn('text-2xl', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                En mantenimiento
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Esta sección está temporalmente en mantenimiento. Pronto estará disponible nuevamente.
              </CardDescription>
            </CardHeader>
          </Card>
          {/* Contenido original comentado para restaurar después:
          <AdminOverviewTab theme={theme} />
          */}
        </TabsContent>

        <TabsContent value="users">
          {activeTab === 'users' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <UserManagement theme={theme} />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="institutions">
          {activeTab === 'institutions' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <InstitutionManagement theme={theme} />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="questions">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <QuestionBank theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="phases">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <PhaseAuthorizationManagement theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="study-plans">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <StudyPlanAuthorizationManagement theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="recursos" className="space-y-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <AdminRecursos theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="herramientas-ia" className="space-y-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <AdminHerramientasIA theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="simulacros" className="space-y-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <AdminSimulacros theme={theme} />
          </Suspense>
        </TabsContent>

        <TabsContent value="temas-estudio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Temas de estudio</CardTitle>
              <CardDescription>Contenido próximamente.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          {activeTab === 'reports' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <StudentPhaseReports theme={theme} />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {activeTab === 'settings' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <RegistrationSettings theme={theme} />
            </Suspense>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

