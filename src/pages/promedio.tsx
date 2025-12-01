import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Link } from "react-router-dom"
import { doc, getDoc, getFirestore, collection, getDocs } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { firebaseApp } from "@/services/firebase/db.service"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { getUserById } from "@/controllers/user.controller"
import { cn } from "@/lib/utils"
import { geminiService } from "@/services/ai/gemini.service"
import { getAllPhases, getPhaseType } from "@/utils/firestoreHelpers"
import {
  Brain,
  Download,
  Mail,
  TrendingUp,
  Clock,
  Target,
  BookOpen,
  Award,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart,
  Star,
  Zap,
  Trophy,
  Medal,
  Home,
  ContactRound,
  NotepadText,
  BarChart2,
  Apple,
  Shield
} from "lucide-react"

const db = getFirestore(firebaseApp);

interface ExamScore {
  correctAnswers: number;
  totalAnswered: number;
  totalQuestions: number;
  percentage: number;
  overallPercentage: number;
}

interface ExamResult {
  userId: string;
  examId: string;
  examTitle: string;
  subject?: string; // Materia del examen
  phase?: string; // Fase del examen (first, second, third)
  answers: { [key: string]: string };
  score: ExamScore;
  topic: string;
  timeExpired: boolean;
  lockedByTabChange: boolean;
  tabChangeCount: number;
  startTime: string;
  endTime: string;
  timeSpent: number;
  completed: boolean;
  timestamp: number;
  questionDetails: Array<{
    questionId: number;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
  }>;
}

interface UserResults {
  [examId: string]: ExamResult;
}

interface SubjectAnalysis {
  name: string;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  timeSpent: number;
  percentage: number;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
}

interface TopicAnalysis {
  name: string;
  percentage: number;
  correct: number;
  total: number;
}

interface SubjectWithTopics {
  name: string;
  percentage: number;
  topics: TopicAnalysis[];
  strengths: string[]; // Temas que son fortalezas (>= 70%)
  weaknesses: string[]; // Temas que son debilidades (< 60%)
}

interface AnalysisData {
  student: {
    name: string;
    id: string;
    testDate: string;
    testType: string;
  };
  overall: {
    score: number;
    percentile: number;
    phasePercentage: number; // Porcentaje de completitud de fase (0-100%)
    currentPhase: string; // Fase actual del estudiante (I, II o III)
    timeSpent: number;
    questionsAnswered: number;
    totalQuestions: number;
    averagePercentage: number;
  };
  subjects: SubjectAnalysis[];
  subjectsWithTopics: SubjectWithTopics[]; // Materias agrupadas con sus temas
  patterns: {
    timeManagement: string;
    errorTypes: string[];
    strongestArea: string;
    weakestArea: string;
    completionRate: number;
    securityIssues: number;
  };
  recommendations: Array<{
    priority: string;
    subject: string;
    topic: string;
    resources: string[];
    timeEstimate: string;
  }>;
}

// Componente auxiliar para navegación
interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
}

function NavItem({ href, icon, text, active = false, theme = 'light' }: NavItemProps & { theme?: 'light' | 'dark' }) {
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
  );
}

// Componente de gráfico de rendimiento con materias expandibles
function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: SubjectAnalysis[], theme?: 'light' | 'dark', subjectsWithTopics?: SubjectWithTopics[] }) {
  // Si tenemos datos agrupados por materia y tema, usar esos
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject) => (
          <AccordionItem key={subject.name} value={subject.name} className={cn("border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
            <AccordionTrigger className={cn("hover:no-underline", theme === 'dark' ? 'text-white' : '')}>
              <div className="flex items-center justify-between w-full pr-4">
                <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
                <span className={cn("text-sm font-semibold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>{subject.percentage}%</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className={cn("space-y-3 pt-2", theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border-gray-200')}>
                {subject.topics.map((topic) => (
                  <div key={topic.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{topic.name}</span>
                      <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{topic.percentage}%</span>
                    </div>
                    <Progress value={topic.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  // Fallback al formato anterior si no hay datos agrupados
  return (
    <div className="space-y-4">
      {data.map((subject) => (
        <div key={subject.name} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
            <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{subject.percentage}%</span>
          </div>
          <Progress value={subject.percentage} className="h-2" />
        </div>
      ))}
    </div>
  );
}

// Componente de fortalezas y debilidades por materia
function StrengthsWeaknessesChart({ subjectsWithTopics, theme = 'light' }: { subjectsWithTopics: SubjectWithTopics[], theme?: 'light' | 'dark' }) {
  return (
    <Accordion type="multiple" className="w-full">
      {subjectsWithTopics.map((subject) => {
        // Filtrar materias que tengan al menos fortalezas o debilidades
        const hasData = subject.strengths.length > 0 || subject.weaknesses.length > 0;
        
        return (
          <AccordionItem key={subject.name} value={subject.name} className={cn("border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
            <AccordionTrigger className={cn("hover:no-underline", theme === 'dark' ? 'text-white' : '')}>
              <div className="flex items-center justify-between w-full pr-4">
                <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
                <div className="flex items-center gap-3">
                  {subject.strengths.length > 0 && (
                    <Badge className={cn("text-xs", theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200")}>
                      {subject.strengths.length} fortaleza{subject.strengths.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {subject.weaknesses.length > 0 && (
                    <Badge className={cn("text-xs", theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200")}>
                      {subject.weaknesses.length} debilidad{subject.weaknesses.length > 1 ? 'es' : ''}
                    </Badge>
                  )}
                  {!hasData && (
                    <Badge variant="outline" className={cn("text-xs", theme === 'dark' ? 'border-zinc-600 text-gray-400' : 'border-gray-300')}>
                      Sin datos
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className={cn("space-y-4 pt-2", theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border-gray-200')}>
                {/* Fortalezas - Siempre mostrar si hay */}
                {subject.strengths.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                        Fortalezas ({subject.strengths.length})
                      </span>
                    </div>
                    <ul className={cn("space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {subject.strengths.map((strength, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Fortalezas
                      </span>
                    </div>
                    <p className={cn("text-xs italic", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                      No se identificaron fortalezas en esta materia
                    </p>
                  </div>
                )}
                
                {/* Debilidades - Siempre mostrar si hay */}
                {subject.weaknesses.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                        Debilidades ({subject.weaknesses.length})
                      </span>
                    </div>
                    <ul className={cn("space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {subject.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-gray-400" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Debilidades
                      </span>
                    </div>
                    <p className={cn("text-xs italic", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                      No se identificaron debilidades en esta materia
                    </p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

// Componente de análisis por materia
function SubjectAnalysis({ subjects, theme = 'light' }: { subjects: SubjectAnalysis[], theme?: 'light' | 'dark' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {subjects.map((subject) => (
        <Card key={subject.name} className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
          <CardHeader>
            <CardTitle className={cn("flex items-center justify-between", theme === 'dark' ? 'text-white' : '')}>
              <span>{subject.name}</span>
              <Badge className={subject.percentage >= 70 ? (theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200") : subject.percentage >= 50 ? (theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800 border-gray-200") : (theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200")}>
                {subject.percentage}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Correctas:</span>
                <span className={cn("font-medium ml-2", theme === 'dark' ? 'text-white' : '')}>{subject.correct}/{subject.total}</span>
              </div>
              <div>
                <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tiempo:</span>
                <span className={cn("font-medium ml-2", theme === 'dark' ? 'text-white' : '')}>{Math.floor(subject.timeSpent / 60)}m</span>
              </div>
            </div>
            <Progress value={subject.percentage} className="h-2" />
            
            <div className="space-y-3">
              <div>
                <h4 className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>Fortalezas</h4>
                <ul className={cn("text-xs space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {subject.strengths.map((strength, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>Áreas de mejora</h4>
                <ul className={cn("text-xs space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {subject.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Componente de plan de estudio
function StudyPlan({ recommendations, theme = 'light', loadingAI = false }: { recommendations: AnalysisData['recommendations'], theme?: 'light' | 'dark', loadingAI?: boolean }) {
  if (loadingAI) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
            <div>
              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Generando recomendaciones con IA...</p>
              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Gemini 3.0 Pro está analizando tu rendimiento</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, index) => (
        <Card key={index} className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Badge className={rec.priority === "Alta" ? (theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200") : rec.priority === "Media" ? (theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800 border-gray-200") : (theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200")}>
                {rec.priority}
              </Badge>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-semibold text-lg", theme === 'dark' ? 'text-white' : '')}>{rec.subject} - {rec.topic}</h3>
                  {(() => {
                    const hasExplanation = 'explanation' in rec && rec.explanation && typeof rec.explanation === 'string';
                    return hasExplanation ? (
                      <Badge variant="outline" className={cn("text-xs", theme === 'dark' ? 'border-purple-500 text-purple-300' : 'border-gray-300 text-purple-600')}>
                        <Zap className="h-3 w-3 mr-1" />
                        IA
                      </Badge>
                    ) : null;
                  })()}
                </div>
                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>Tiempo estimado: {rec.timeEstimate}</p>
                {(() => {
                  const hasExplanation = 'explanation' in rec && rec.explanation && typeof rec.explanation === 'string';
                  const explanation = hasExplanation ? String(rec.explanation) : null;
                  return explanation ? (
                    <div className={cn("mt-3 p-3 rounded-lg bg-gradient-to-r", theme === 'dark' ? 'from-purple-900/30 to-blue-900/30 border border-purple-700/50' : 'from-purple-50 to-blue-50 border border-purple-200')}>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <strong className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-600')}>Análisis IA:</strong> {explanation}
                      </p>
                    </div>
                  ) : null;
                })()}
                <div className="mt-3">
                  <h4 className={cn("text-sm font-medium mb-2", theme === 'dark' ? 'text-white' : '')}>Recursos recomendados:</h4>
                  <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    {rec.resources.map((resource, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <BookOpen className="h-3 w-3" />
                        {resource}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Componente de comparación/progreso
function ComparisonChart({ subjects, theme = 'light' }: { subjects: SubjectAnalysis[], theme?: 'light' | 'dark' }) {
  const averageScore = subjects.reduce((acc, subject) => acc + subject.percentage, 0) / subjects.length;
  
  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardHeader>
          <CardTitle className={cn(theme === 'dark' ? 'text-white' : '')}>Progreso por Materia</CardTitle>
          <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Análisis comparativo de tu desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subjects.map((subject) => (
              <div key={subject.name} className={cn("flex items-center justify-between p-4 border rounded-lg", theme === 'dark' ? 'border-zinc-700' : '')}>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
                    <span className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>{subject.percentage}%</span>
                  </div>
                  <Progress value={subject.percentage} className="h-3" />
                </div>
                <div className="ml-4 text-center">
                  <div className={cn("text-sm font-medium", subject.percentage > averageScore ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600'))}>
                    {subject.percentage > averageScore ? '↑' : '↓'} {Math.abs(subject.percentage - averageScore).toFixed(1)}%
                  </div>
                  <div className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>vs promedio</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ICFESAnalysisInterface() {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'all'>('all');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [phase1Data, setPhase1Data] = useState<AnalysisData | null>(null);
  const [phase2Data, setPhase2Data] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const [phase1Evaluations, setPhase1Evaluations] = useState<ExamResult[]>([]);
  const [phase2Evaluations, setPhase2Evaluations] = useState<ExamResult[]>([]);
  const [studentRank, setStudentRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [isLoadingRank, setIsLoadingRank] = useState(false);
  const [currentMotivationalIndex, setCurrentMotivationalIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();
  const { user } = useAuthContext();

  // Frases motivadoras para estudiantes
  const motivationalMessages = [
    "El temor a Dios es el inicio de la sabiduría.",
    "Cree en ti. Ya estás más cerca de lo que imaginas.",
    "Cada página que estudias te acerca un paso más al éxito.",
    "Tu esfuerzo de hoy es tu logro de mañana.",
    "Los limites están solo en tu mente.",
    "No hay metas imposibles, solo pasos que aún no diste.",
    "El conocimiento te abre puertas, el esfuerzo las mantiene abiertas.",
    "Nunca es tarde para volver a intentarlo.",
    "Sigue adelante, aunque el camino se vuelva cuesta arriba.",
    "La constancia vence al talento cuando el talento no trabaja duro.",
    "Tu actitud puede cambiarlo todo.",
    "El éxito no es un destino, es un viaje decides recorrer.",
    "Cada error te enseña algo nuevo.",
    "Tu dedicación de hoy construye tu futuro de mañana.",
    "Los grandes logros comienzan con pequeños pasos.",
    "Confía en tu proceso, estás en el camino correcto."
  ];

  // Cambiar mensaje motivador cada 8 segundos con animación
  useEffect(() => {
    const interval = setInterval(() => {
      // Iniciar animación de salida
      setIsTransitioning(true);
      
      // Después de la animación de salida, cambiar el mensaje
      setTimeout(() => {
        setCurrentMotivationalIndex((prevIndex) => (prevIndex + 1) % motivationalMessages.length);
        // Activar estado de entrada para que el nuevo mensaje empiece desde la derecha
        setIsEntering(true);
        // Pequeño delay para que React actualice el DOM
        setTimeout(() => {
          setIsTransitioning(false);
          // Desactivar entrada para que el mensaje entre
          setTimeout(() => {
            setIsEntering(false);
          }, 10);
        }, 20);
      }, 500); // Tiempo completo de salida
    }, 7000)

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función para calcular el puntaje global de un estudiante
  const calculateStudentGlobalScore = async (studentId: string): Promise<number> => {
    try {
      const phases = getAllPhases();
      const evaluationsArray: any[] = [];

      // Leer resultados de todas las fases del estudiante
      for (const phaseName of phases) {
        const phaseRef = collection(db, "results", studentId, phaseName);
        const phaseSnap = await getDocs(phaseRef);
        phaseSnap.docs.forEach(doc => {
          const examData = doc.data();
          evaluationsArray.push({
            ...examData,
            examId: doc.id,
            phase: getPhaseType(phaseName) || phaseName,
          });
        });
      }

      // También leer de la estructura antigua para compatibilidad
      const oldDocRef = doc(db, "results", studentId);
      const oldDocSnap = await getDoc(oldDocRef);
      if (oldDocSnap.exists()) {
        const oldData = oldDocSnap.data() as UserResults;
        Object.entries(oldData).forEach(([examId, examData]) => {
          evaluationsArray.push({
            ...examData,
            examId,
          });
        });
      }

      if (evaluationsArray.length === 0) {
        return 0;
      }

      // Materias de naturales (dividen 100 puntos entre las 3)
      const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física'];
      const POINTS_PER_NATURALES_SUBJECT = 100 / 3;
      const POINTS_PER_REGULAR_SUBJECT = 100;

      // Normalizar nombres de materias
      const normalizeSubjectName = (subject: string): string => {
        const normalized = subject.trim().toLowerCase();
        const subjectMap: Record<string, string> = {
          'biologia': 'Biologia',
          'biología': 'Biologia',
          'biology': 'Biologia',
          'quimica': 'Quimica',
          'química': 'Quimica',
          'chemistry': 'Quimica',
          'fisica': 'Física',
          'física': 'Física',
          'physics': 'Física',
          'matematicas': 'Matemáticas',
          'matemáticas': 'Matemáticas',
          'math': 'Matemáticas',
          'lenguaje': 'Lenguaje',
          'language': 'Lenguaje',
          'ciencias sociales': 'Ciencias Sociales',
          'sociales': 'Ciencias Sociales',
          'ingles': 'Inglés',
          'inglés': 'Inglés',
          'english': 'Inglés'
        };
        return subjectMap[normalized] || subject;
      };

      // Agrupar resultados por fase y materia
      const phaseSubjectResults: { [phase: string]: { [subject: string]: { correct: number; total: number; percentage: number } } } = {};

      evaluationsArray.forEach(exam => {
        const phase = exam.phase || 'unknown';
        const rawSubject = exam.subject || exam.examTitle || 'General';
        const subject = normalizeSubjectName(rawSubject);
        
        if (!phaseSubjectResults[phase]) {
          phaseSubjectResults[phase] = {};
        }

        const correctAnswers = exam.score.correctAnswers;
        const totalQuestionsInExam = exam.score.totalQuestions;
        const percentage = totalQuestionsInExam > 0 ? (correctAnswers / totalQuestionsInExam) * 100 : 0;

        // Guardar el mejor resultado de cada materia por fase
        if (!phaseSubjectResults[phase][subject] || percentage > phaseSubjectResults[phase][subject].percentage) {
          phaseSubjectResults[phase][subject] = {
            correct: correctAnswers,
            total: totalQuestionsInExam,
            percentage: percentage
          };
        }
      });

      // Calcular puntaje global
      let globalScore = 0;
      
      Object.entries(phaseSubjectResults).forEach(([_phase, subjects]) => {
        Object.entries(subjects).forEach(([subject, stats]) => {
          if (stats.total > 0) {
            const percentage = stats.percentage;
            
            let pointsForSubject: number;
            if (NATURALES_SUBJECTS.includes(subject)) {
              pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT;
            } else {
              pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
            }
            
            globalScore += pointsForSubject;
          }
        });
      });

      return Math.round(globalScore * 100) / 100;
    } catch (error) {
      console.error('Error calculando puntaje del estudiante:', error);
      return 0;
    }
  };

  // Calcular el puesto del estudiante
  useEffect(() => {
    const calculateRank = async () => {
      if (!user?.uid || !analysisData) {
        return;
      }

      setIsLoadingRank(true);
      try {
        // Obtener datos del estudiante actual
        const userResult = await getUserById(user.uid);
        if (!userResult.success || !userResult.data) {
          setIsLoadingRank(false);
          return;
        }

        const studentData = userResult.data as any;
        const institutionId = studentData.inst || studentData.institutionId;
        const campusId = studentData.campus || studentData.campusId;
        const gradeId = studentData.grade || studentData.gradeId;

        if (!institutionId || !campusId || !gradeId) {
          setIsLoadingRank(false);
          return;
        }

        // Obtener todos los estudiantes del mismo colegio, sede y grado
        const { getFilteredStudents } = await import('@/controllers/student.controller');
        const studentsResult = await getFilteredStudents({
          institutionId,
          campusId,
          gradeId,
          isActive: true
        });

        if (!studentsResult.success || !studentsResult.data) {
          setIsLoadingRank(false);
          return;
        }

        const classmates = studentsResult.data;
        
        // Guardar el total de estudiantes
        setTotalStudents(classmates.length);
        
        // Calcular puntaje global de cada estudiante
        const studentScores: { studentId: string; score: number }[] = [];
        
        for (const classmate of classmates) {
          const studentId = (classmate as any).id || (classmate as any).uid;
          if (studentId) {
            const score = await calculateStudentGlobalScore(studentId);
            studentScores.push({ studentId, score });
          }
        }

        // Ordenar por puntaje (mayor a menor)
        studentScores.sort((a, b) => b.score - a.score);

        // Encontrar el puesto del estudiante actual
        const currentStudentIndex = studentScores.findIndex(s => s.studentId === user.uid);
        if (currentStudentIndex !== -1) {
          setStudentRank(currentStudentIndex + 1); // +1 porque el puesto empieza en 1
        }
      } catch (error) {
        console.error('Error calculando puesto del estudiante:', error);
      } finally {
        setIsLoadingRank(false);
      }
    };

    if (analysisData && user?.uid) {
      calculateRank();
    }
  }, [analysisData, user?.uid]);

  useEffect(() => {
    const fetchDataAndAnalyze = async () => {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Obtener resultados de todas las subcolecciones de fases
        const phases = getAllPhases();
        const evaluationsArray: any[] = [];

        // Leer de las subcolecciones de fases
        for (const phaseName of phases) {
          const phaseRef = collection(db, "results", user.uid, phaseName);
          const phaseSnap = await getDocs(phaseRef);
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data();
            evaluationsArray.push({
              ...examData,
              examId: doc.id,
              phase: getPhaseType(phaseName) || phaseName,
            });
          });
        }

        // También leer de la estructura antigua para compatibilidad
        const oldDocRef = doc(db, "results", user.uid);
        const oldDocSnap = await getDoc(oldDocRef);
        if (oldDocSnap.exists()) {
          const oldData = oldDocSnap.data() as UserResults;
          Object.entries(oldData).forEach(([examId, examData]) => {
            evaluationsArray.push({
              ...examData,
              examId,
            });
          });
        }

        evaluationsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setEvaluations(evaluationsArray);

        // Filtrar evaluaciones por fase
        const phase1Evals = evaluationsArray.filter(e => {
          const phase = e.phase || '';
          return phase === 'first' || 
                 phase === 'fase I' || 
                 phase === 'Fase I' ||
                 getPhaseType(phase) === 'first';
        });
        
        const phase2Evals = evaluationsArray.filter(e => {
          const phase = e.phase || '';
          return phase === 'second' || 
                 phase === 'fase II' || 
                 phase === 'Fase II' ||
                 getPhaseType(phase) === 'second';
        });

        setPhase1Evaluations(phase1Evals);
        setPhase2Evaluations(phase2Evals);

        // Procesar datos para el análisis general
        const processedData = processEvaluationData(evaluationsArray, user);
        setAnalysisData(processedData);
        
        // Procesar datos por fase
        if (phase1Evals.length > 0) {
          const phase1Processed = processEvaluationData(phase1Evals, user);
          setPhase1Data(phase1Processed);
        }
        
        if (phase2Evals.length > 0) {
          const phase2Processed = processEvaluationData(phase2Evals, user);
          setPhase2Data(phase2Processed);
        }
        
        // Establecer fase inicial automáticamente
        if (phase2Evals.length > 0) {
          setSelectedPhase('phase2');
        } else if (phase1Evals.length > 0) {
          setSelectedPhase('phase1');
        }
        
        // Generar recomendaciones con IA si está disponible
        if (geminiService.isAvailable() && processedData.subjects.length > 0) {
          generateAIRecommendations(processedData);
        }
      } catch (error) {
        console.error("Error al obtener los datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDataAndAnalyze();
  }, []);

  const processEvaluationData = (evaluations: ExamResult[], user: any): AnalysisData => {
    if (evaluations.length === 0) {
      return getEmptyAnalysisData(user);
    }

    // Materias de naturales (dividen 100 puntos entre las 3)
    // Normalizar nombres de materias para comparación
    const normalizeSubjectName = (subject: string): string => {
      const normalized = subject.trim().toLowerCase();
      const subjectMap: Record<string, string> = {
        'biologia': 'Biologia',
        'biología': 'Biologia',
        'biology': 'Biologia',
        'quimica': 'Quimica',
        'química': 'Quimica',
        'chemistry': 'Quimica',
        'fisica': 'Física',
        'física': 'Física',
        'physics': 'Física',
        'matematicas': 'Matemáticas',
        'matemáticas': 'Matemáticas',
        'math': 'Matemáticas',
        'lenguaje': 'Lenguaje',
        'language': 'Lenguaje',
        'ciencias sociales': 'Ciencias Sociales',
        'sociales': 'Ciencias Sociales',
        'ingles': 'Inglés',
        'inglés': 'Inglés',
        'english': 'Inglés'
      };
      return subjectMap[normalized] || subject;
    };

    const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física'];
    const POINTS_PER_NATURALES_SUBJECT = 100 / 3; // 33.33 puntos cada una
    const POINTS_PER_REGULAR_SUBJECT = 100; // 100 puntos para las demás materias

    // Agrupar preguntas por materia y luego por tema
    const subjectTopicGroups: { [subject: string]: { [topic: string]: any[] } } = {};
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTimeSpent = 0;
    let totalAnswered = 0;
    let securityIssues = 0;

    // Agrupar resultados por fase y materia para calcular puntos
    // Usamos el mejor resultado de cada materia por fase
    const phaseSubjectResults: { [phase: string]: { [subject: string]: { correct: number; total: number; percentage: number } } } = {};

    evaluations.forEach(exam => {
      totalTimeSpent += exam.timeSpent;
      totalAnswered += exam.score.totalAnswered;
      totalQuestions += exam.score.totalQuestions;
      totalCorrect += exam.score.correctAnswers;
      
      if (exam.tabChangeCount > 0) securityIssues++;

      // Agrupar por fase y materia para calcular puntos
      const phase = exam.phase || 'unknown';
      const rawSubject = exam.subject || exam.examTitle || 'General';
      const subject = normalizeSubjectName(rawSubject);
      
      if (!phaseSubjectResults[phase]) {
        phaseSubjectResults[phase] = {};
      }

      // Calcular porcentaje de este examen
      const correctAnswers = exam.score.correctAnswers;
      const totalQuestionsInExam = exam.score.totalQuestions;
      const percentage = totalQuestionsInExam > 0 ? (correctAnswers / totalQuestionsInExam) * 100 : 0;

      // Guardar el mejor resultado de cada materia por fase
      if (!phaseSubjectResults[phase][subject] || percentage > phaseSubjectResults[phase][subject].percentage) {
        phaseSubjectResults[phase][subject] = {
          correct: correctAnswers,
          total: totalQuestionsInExam,
          percentage: percentage
        };
      }

      // Agrupar preguntas por materia y tema
      exam.questionDetails.forEach(question => {
        const topic = question.topic || 'General';
        
        if (!subjectTopicGroups[subject]) {
          subjectTopicGroups[subject] = {};
        }
        if (!subjectTopicGroups[subject][topic]) {
          subjectTopicGroups[subject][topic] = [];
        }
        subjectTopicGroups[subject][topic].push(question);
      });
    });

    // Calcular puntaje global: sumatoria de puntos por fase
    // Sumamos los puntos de todas las fases (cada fase puede tener hasta 500 puntos)
    let globalScore = 0;
    
    Object.entries(phaseSubjectResults).forEach(([_phase, subjects]) => {
      Object.entries(subjects).forEach(([subject, stats]) => {
        if (stats.total > 0) {
          const percentage = stats.percentage;
          
          // Determinar puntos según el tipo de materia
          let pointsForSubject: number;
          if (NATURALES_SUBJECTS.includes(subject)) {
            // Materias de naturales: 33.33 puntos máximo
            pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT;
          } else {
            // Otras materias: 100 puntos máximo
            pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
          }
          
          globalScore += pointsForSubject;
        }
      });
    });

    // Redondear el puntaje global
    globalScore = Math.round(globalScore * 100) / 100; // Redondear a 2 decimales

    // Calcular porcentaje de fase: contar materias únicas completadas
    // Las 7 materias son: Matemáticas, Lenguaje, Ciencias Sociales, Biologia, Quimica, Física, Inglés
    const TOTAL_SUBJECTS = 7;
    const completedSubjectsSet = new Set<string>();
    
    Object.entries(phaseSubjectResults).forEach(([_phase, subjects]) => {
      Object.keys(subjects).forEach(subject => {
        const normalizedSubject = normalizeSubjectName(subject);
        // Solo contar materias válidas (excluir 'General' y otras no válidas)
        const validSubjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
        if (validSubjects.includes(normalizedSubject)) {
          completedSubjectsSet.add(normalizedSubject);
        }
      });
    });
    
    const phasePercentage = Math.round((completedSubjectsSet.size / TOTAL_SUBJECTS) * 100);

    // Determinar la fase actual del estudiante
    // La fase actual es la más alta en la que tiene resultados
    let currentPhase = 'I'; // Por defecto fase I
    const phaseOrder: Record<string, number> = {
      'first': 1,
      'second': 2,
      'third': 3,
      'unknown': 0
    };
    
    let highestPhase = 0;
    Object.keys(phaseSubjectResults).forEach(phase => {
      const phaseNum = phaseOrder[phase] || 0;
      if (phaseNum > highestPhase && Object.keys(phaseSubjectResults[phase]).length > 0) {
        highestPhase = phaseNum;
        // Convertir a formato romano
        if (phase === 'first') currentPhase = 'I';
        else if (phase === 'second') currentPhase = 'II';
        else if (phase === 'third') currentPhase = 'III';
      }
    });

    // Orden de materias para mostrar
    const subjectOrder: Record<string, number> = {
      'Matemáticas': 1,
      'Lenguaje': 2,
      'Ciencias Sociales': 3,
      'Biologia': 4,
      'Quimica': 5,
      'Física': 6,
      'Inglés': 7
    };

    // Procesar materias con sus temas
    const subjectsWithTopics: SubjectWithTopics[] = Object.entries(subjectTopicGroups)
      .map(([subject, topics]) => {
      // Calcular estadísticas por tema
      const topicAnalyses: TopicAnalysis[] = Object.entries(topics).map(([topic, questions]) => {
        const correct = questions.filter((q: any) => q.isCorrect).length;
        const total = questions.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        return {
          name: topic,
          percentage,
          correct,
          total
        };
      });

      // Calcular porcentaje general de la materia (promedio de todos los temas)
      const totalCorrect = topicAnalyses.reduce((sum, topic) => sum + topic.correct, 0);
      const totalQuestions = topicAnalyses.reduce((sum, topic) => sum + topic.total, 0);
      const subjectPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

      // Calcular fortalezas (temas con >= 70%) y debilidades (temas con < 60%)
      const strengths = topicAnalyses
        .filter(topic => topic.percentage >= 70)
        .map(topic => topic.name);
      
      const weaknesses = topicAnalyses
        .filter(topic => topic.percentage < 60)
        .map(topic => topic.name);

        return {
          name: subject,
          percentage: subjectPercentage,
          topics: topicAnalyses,
          strengths,
          weaknesses
        };
      })
      .sort((a, b) => {
        const orderA = subjectOrder[a.name] || 999;
        const orderB = subjectOrder[b.name] || 999;
        return orderA - orderB;
      });

    // Mantener compatibilidad con el código existente - crear SubjectAnalysis para otras partes
    const subjects: SubjectAnalysis[] = subjectsWithTopics.map(subject => {
      const totalCorrect = subject.topics.reduce((sum, topic) => sum + topic.correct, 0);
      const total = subject.topics.reduce((sum, topic) => sum + topic.total, 0);
      
      return {
        name: subject.name,
        score: subject.percentage,
        maxScore: 100,
        correct: totalCorrect,
        total: total,
        timeSpent: Math.round(totalTimeSpent / evaluations.length),
        percentage: subject.percentage,
        strengths: [],
        weaknesses: [],
        improvement: ''
      };
    });

    const averagePercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const bestSubject = subjects.reduce((best, current) => current.percentage > best.percentage ? current : best, subjects[0]);
    const worstSubject = subjects.reduce((worst, current) => current.percentage < worst.percentage ? current : worst, subjects[0]);

    // Calcular percentil (simulado basado en rendimiento)
    const percentile = Math.min(95, Math.max(5, averagePercentage + Math.random() * 20 - 10));

    return {
      student: {
        name: user.displayName || user.email || "Usuario",
        id: user.uid.substring(0, 8),
        testDate: new Date(evaluations[0]?.timestamp || Date.now()).toLocaleDateString('es-ES'),
        testType: `${evaluations.length} Evaluación${evaluations.length > 1 ? 'es' : ''} ICFES`
      },
      overall: {
        score: Math.round(globalScore), // Puntaje global como sumatoria de puntos por fase
        percentile: Math.round(percentile),
        phasePercentage, // Porcentaje de completitud de fase
        currentPhase, // Fase actual (I, II o III)
        timeSpent: Math.round(totalTimeSpent / 60), // En minutos
        questionsAnswered: totalAnswered,
        totalQuestions,
        averagePercentage
      },
      subjects,
      subjectsWithTopics, // Materias agrupadas con sus temas
      patterns: {
        timeManagement: totalTimeSpent > (totalQuestions * 5 * 60) ? 
          "Necesita mejorar gestión del tiempo" : "Buen manejo del tiempo",
        errorTypes: [
          `Conceptual: ${Math.round(Math.random() * 30 + 35)}%`,
          `Interpretativo: ${Math.round(Math.random() * 20 + 25)}%`,
          `Cálculo: ${Math.round(Math.random() * 15 + 15)}%`
        ],
        strongestArea: bestSubject?.name || "Sin datos",
        weakestArea: worstSubject?.name || "Sin datos",
        completionRate: totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0,
        securityIssues
      },
      recommendations: generateBasicRecommendations(subjects)
    };
  };

  const getEmptyAnalysisData = (user: any): AnalysisData => {
    return {
      student: {
        name: user?.displayName || user?.email || "Usuario",
        id: user?.uid?.substring(0, 8) || "N/A",
        testDate: new Date().toLocaleDateString('es-ES'),
        testType: "Sin evaluaciones"
      },
      overall: {
        score: 0,
        percentile: 0,
        phasePercentage: 0,
        currentPhase: 'I',
        timeSpent: 0,
        questionsAnswered: 0,
        totalQuestions: 0,
        averagePercentage: 0
      },
      subjects: [],
      subjectsWithTopics: [],
      patterns: {
        timeManagement: "Sin datos suficientes",
        errorTypes: [],
        strongestArea: "Sin datos",
        weakestArea: "Sin datos",
        completionRate: 0,
        securityIssues: 0
      },
      recommendations: []
    };
  };

  // Función de respaldo para generar recomendaciones básicas
  const generateBasicRecommendations = (subjects: SubjectAnalysis[]) => {
    return subjects
      .filter(subject => subject.percentage < 70)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3)
      .map((subject, index) => ({
        priority: index === 0 ? "Alta" : index === 1 ? "Media" : "Baja",
        subject: subject.name,
        topic: subject.weaknesses[0] || "Refuerzo general",
        resources: [
          `Videos educativos sobre ${subject.name}`,
          `Ejercicios prácticos`,
          `Simulacros específicos`
        ],
        timeEstimate: `${2 + index} semanas`,
        explanation: `Se recomienda enfocarse en mejorar el rendimiento en ${subject.name}`
      }));
  };

  // Generar recomendaciones con IA usando Gemini
  const generateAIRecommendations = async (data: AnalysisData) => {
    if (!geminiService.isAvailable()) {
      return;
    }

    setLoadingAI(true);
    try {
      const result = await geminiService.generateRecommendations({
        subjects: data.subjects.map(subject => ({
          name: subject.name,
          percentage: subject.percentage,
          strengths: subject.strengths,
          weaknesses: subject.weaknesses
        })),
        overall: {
          averagePercentage: data.overall.averagePercentage,
          score: data.overall.score
        },
        patterns: {
          strongestArea: data.patterns.strongestArea,
          weakestArea: data.patterns.weakestArea,
          timeManagement: data.patterns.timeManagement
        }
      });

      if (result.success && result.recommendations) {
        setAnalysisData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            recommendations: result.recommendations || []
          };
        });
      } else {
        console.warn('No se pudieron generar recomendaciones con IA, usando recomendaciones básicas');
        // Usar recomendaciones básicas como respaldo
        setAnalysisData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            recommendations: generateBasicRecommendations(prev.subjects)
          };
        });
      }
    } catch (error) {
      console.error('Error al generar recomendaciones con IA:', error);
      // Usar recomendaciones básicas como respaldo
      setAnalysisData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recommendations: generateBasicRecommendations(prev.subjects)
        };
      });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleExportPDF = () => {
    // Implementar exportación a PDF
    alert("Función de exportación a PDF en desarrollo");
  };

  const handleSendEmail = () => {
    // Implementar envío por correo
    alert("Función de envío por correo en desarrollo");
  };

  // Función helper para obtener los datos según la fase seleccionada
  const getCurrentPhaseData = (): AnalysisData | null => {
    if (selectedPhase === 'phase1' && phase1Data) return phase1Data;
    if (selectedPhase === 'phase2' && phase2Data) return phase2Data;
    if (selectedPhase === 'all' && analysisData) return analysisData;
    // Si no hay datos para la fase seleccionada, intentar con otra fase disponible
    if (phase2Data) return phase2Data;
    if (phase1Data) return phase1Data;
    return analysisData;
  };

  const getCurrentPhaseEvaluations = (): ExamResult[] => {
    if (selectedPhase === 'phase1' && phase1Evaluations.length > 0) return phase1Evaluations;
    if (selectedPhase === 'phase2' && phase2Evaluations.length > 0) return phase2Evaluations;
    if (selectedPhase === 'all' && evaluations.length > 0) return evaluations;
    // Si no hay datos para la fase seleccionada, intentar con otra fase disponible
    if (phase2Evaluations.length > 0) return phase2Evaluations;
    if (phase1Evaluations.length > 0) return phase1Evaluations;
    return evaluations;
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
        <header className={cn("shadow-sm backdrop-blur-sm", theme === 'dark' ? 'bg-zinc-800/90 border-b border-zinc-700/50' : 'bg-white/95 border-b border-gray-200')}>
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
              <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" theme={theme} />
              <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" theme={theme} />
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" theme={theme} />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" active theme={theme} />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
            </nav>
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <div className={cn("animate-spin rounded-full h-12 w-12 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
          <span className={cn("ml-3 text-lg", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cargando análisis...</span>
        </div>
      </div>
    );
  }

  if (!analysisData || evaluations.length === 0) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
        <header className={cn("shadow-sm backdrop-blur-sm", theme === 'dark' ? 'bg-zinc-800/90 border-b border-zinc-700/50' : 'bg-white/95 border-b border-gray-200')}>
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
              <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" theme={theme} />
              <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" theme={theme} />
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" theme={theme} />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" active theme={theme} />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
            </nav>
          </div>
        </header>
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <Brain className={cn("h-16 w-16 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <h2 className={cn("text-2xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Sin datos para analizar</h2>
            <p className={cn("mb-6", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Necesitas presentar al menos una evaluación para generar tu análisis inteligente.</p>
            <Link to="/dashboard#evaluacion">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600">
                Presentar Primera Evaluación
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      {/* Header */}
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
            <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" theme={theme} />
            <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" theme={theme} />
            <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" theme={theme} />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" active theme={theme} />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
          </nav>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>Análisis Inteligente </h1>
              <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Reporte de rendimiento académico</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button onClick={handleSendEmail} variant="outline" className={cn("flex items-center gap-2", theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300')}>
              <Mail className="h-4 w-4" />
              Enviar por correo
            </Button>
          </div>
        </div>

        {/* Selector de Fase */}
        <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm mb-6')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={cn("text-lg font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Seleccionar Fase
                </h3>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Elige la fase para ver su análisis completo
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setSelectedPhase('phase1')}
                  variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
                  className={cn(
                    selectedPhase === 'phase1'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase1Data}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Fase I
                  {phase1Data && (
                    <Badge className={cn("ml-2", selectedPhase === 'phase1' ? 'bg-blue-500' : 'bg-gray-500')}>
                      {phase1Data.subjects.length} materias
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedPhase('phase2')}
                  variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
                  className={cn(
                    selectedPhase === 'phase2'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase2Data}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Fase II
                  {phase2Data && (
                    <Badge className={cn("ml-2", selectedPhase === 'phase2' ? 'bg-green-500' : 'bg-gray-500')}>
                      {phase2Data.subjects.length} materias
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedPhase('all')}
                  variant={selectedPhase === 'all' ? 'default' : 'outline'}
                  className={cn(
                    selectedPhase === 'all'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Todas las Fases
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-2 md:grid-cols-5", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/80 border-gray-200 shadow-md backdrop-blur-sm')}>
            <TabsTrigger value="overview" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 border-gray-200')}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 border-gray-200')}>
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Desempeño</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-green-100 data-[state=active]:text-green-700 border-gray-200')}>
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
            <TabsTrigger value="study-plan" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 border-gray-200')}>
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plan de Estudio</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-700 border-gray-200')}>
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Progreso</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {(() => {
              const currentData = getCurrentPhaseData();
              if (!currentData) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Target className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No hay datos disponibles para esta fase
                        </p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          Presenta evaluaciones para ver el resumen
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md')}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{currentData.overall.score}</p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Puntaje Global</p>
                          </div>
                          <Award className="h-8 w-8 text-yellow-500" />
                        </div>
                  <div className="mt-3">
                    {isLoadingRank ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-700/50">
                        <div className={cn("animate-spin rounded-full h-4 w-4 border-b-2", theme === 'dark' ? 'border-yellow-400' : 'border-yellow-600')}></div>
                        <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Calculando puesto...</span>
                      </div>
                    ) : studentRank !== null && totalStudents !== null ? (
                      <div className={cn(
                        "flex items-center gap-2 p-2 rounded-lg",
                        studentRank === 1 
                          ? theme === 'dark' ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
                          : studentRank <= 3
                          ? theme === 'dark' ? 'bg-orange-900/30 border border-orange-700' : 'bg-orange-50 border border-orange-200'
                          : theme === 'dark' ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                      )}>
                        <Trophy className={cn(
                          "h-5 w-5",
                          studentRank === 1 ? 'text-yellow-500' : studentRank <= 3 ? 'text-orange-500' : 'text-blue-500'
                        )} />
                        <div className="flex-1">
                          <div className={cn(
                            "flex items-baseline gap-1",
                            studentRank === 1 
                              ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                              : studentRank <= 3
                              ? theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                              : theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )}>
                            <span className="text-lg font-bold">{studentRank}°</span>
                            <span className="text-xs">de {totalStudents} estudiantes</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={cn("flex items-center gap-2 p-2 rounded-lg", theme === 'dark' ? 'bg-zinc-700/50' : 'bg-gray-100')}>
                        <Trophy className="h-5 w-5 text-gray-400" />
                        <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Puesto no disponible</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>{currentData.overall.phasePercentage}%</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Porcentaje de Fase {currentData.overall.currentPhase}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={currentData.overall.phasePercentage} 
                      className={cn("h-2", theme === 'dark' ? '' : '')}
                    />
                    <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {Math.round((currentData.overall.phasePercentage / 100) * 7)} de 7 materias completadas
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200 shadow-md')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{currentData.overall.timeSpent}m</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tiempo Total</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-white/50')}>
                      {currentData.overall.totalQuestions > 0 ? 
                        `${(currentData.overall.timeSpent / currentData.overall.totalQuestions).toFixed(2)}m por pregunta` : 
                        'Sin datos'
                      }
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                theme === 'dark' 
                  ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg'
                  : currentData.patterns.securityIssues === 0 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md'
                    : currentData.patterns.securityIssues <= 2
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md'
                    : 'bg-gradient-to-br from-red-50 to-rose-50 border-gray-200 shadow-md'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        currentData.patterns.securityIssues === 0 
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : currentData.patterns.securityIssues <= 2
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-red-400' : 'text-red-700'
                      )}>
                        {currentData.patterns.securityIssues}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Intento de fraude</p>
                    </div>
                    <Shield className={cn(
                      "h-8 w-8",
                      currentData.patterns.securityIssues === 0 
                        ? 'text-green-500'
                        : currentData.patterns.securityIssues <= 2
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    )} />
                  </div>
                  <div className="mt-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        theme === 'dark' ? 'border-zinc-600' : 'border-gray-300',
                        currentData.patterns.securityIssues === 0 
                          ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-50 text-green-800 border-green-200'
                          : currentData.patterns.securityIssues <= 2
                          ? theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          : theme === 'dark' ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-50 text-red-800 border-red-200'
                      )}
                    >
                      {currentData.patterns.securityIssues === 0 
                        ? 'Sin incidentes' 
                        : currentData.patterns.securityIssues === 1
                        ? '1 evaluación con incidentes'
                        : `${currentData.patterns.securityIssues} evaluaciones con incidentes`
                      }
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <PieChart className="h-5 w-5" />
                    Rendimiento académico por matería
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentData.subjectsWithTopics.length > 0 ? (
                    <PerformanceChart data={currentData.subjects} subjectsWithTopics={currentData.subjectsWithTopics} theme={theme} />
                  ) : currentData.subjects.length > 0 ? (
                    <PerformanceChart data={currentData.subjects} theme={theme} />
                  ) : (
                    <p className={cn("text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sin datos de materias disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <Zap className="h-5 w-5" />
                    Fortalezas y Debilidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentData.subjectsWithTopics.length > 0 ? (
                    <StrengthsWeaknessesChart subjectsWithTopics={currentData.subjectsWithTopics} theme={theme} />
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Área más fuerte</span>
                        </div>
                        <Badge className={theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200"}>{currentData.patterns.strongestArea}</Badge>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Área a mejorar</span>
                        </div>
                        <Badge className={theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200"}>{currentData.patterns.weakestArea}</Badge>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Gestión del tiempo</span>
                        </div>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{currentData.patterns.timeManagement}</p>
                      </div>
                      {currentData.patterns.securityIssues > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-red-500" />
                            <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Alertas de seguridad</span>
                          </div>
                          <Badge className={theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200"}>
                            {currentData.patterns.securityIssues} evaluación{currentData.patterns.securityIssues > 1 ? 'es' : ''} con incidentes
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
                </>
              );
            })()}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {(() => {
              const currentData = getCurrentPhaseData();
              if (!currentData) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <BarChart3 className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de desempeño disponibles para esta fase</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return currentData.subjects.length > 0 ? (
                <SubjectAnalysis subjects={currentData.subjects} theme={theme} />
              ) : (
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <BarChart3 className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de desempeño por materia disponibles</p>
                      <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta más evaluaciones para obtener un análisis detallado</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* Diagnosis Tab */}
          <TabsContent value="diagnosis" className="space-y-6">
            {(() => {
              const currentData = getCurrentPhaseData();
              if (!currentData) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Target className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de diagnóstico disponibles para esta fase</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <>
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardHeader>
                      <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                        <Target className="h-5 w-5" />
                        Análisis de Patrones de Error
                      </CardTitle>
                      <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Identificación de tipos de errores y sus causas principales</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {currentData.patterns.errorTypes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {currentData.patterns.errorTypes.map((error, index) => (
                      <div key={index} className={cn("p-4 border rounded-lg", theme === 'dark' ? 'border-zinc-700 bg-zinc-900' : '')}>
                        <div className={cn("text-lg font-semibold mb-2", theme === 'dark' ? 'text-white' : '')}>{error}</div>
                        <Progress value={parseInt(error.split(": ")[1])} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn("text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Datos insuficientes para análisis de errores</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    <CheckCircle2 className="h-5 w-5" />
                    Fortalezas Identificadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentData.subjects.length > 0 ? (
                    currentData.subjects.map((subject) => (
                      <div key={subject.name} className="border-l-4 border-green-500 pl-4">
                        <h4 className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</h4>
                        <ul className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {subject.strengths.map((strength, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className={cn("text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de fortalezas disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                    <AlertTriangle className="h-5 w-5" />
                    Áreas de Mejora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentData.subjects.length > 0 ? (
                    currentData.subjects.map((subject) => (
                      <div key={subject.name} className="border-l-4 border-red-500 pl-4">
                        <h4 className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</h4>
                        <ul className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {subject.weaknesses.map((weakness, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className={cn("text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de debilidades disponibles</p>
                  )}
                </CardContent>
              </Card>
            </div>
                </>
              );
            })()}
          </TabsContent>

          {/* Study Plan Tab */}
          <TabsContent value="study-plan" className="space-y-6">
            {(() => {
              const currentData = getCurrentPhaseData();
              if (!currentData) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay recomendaciones disponibles para esta fase</p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta evaluaciones para generar un plan de estudio personalizado</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return loadingAI || (currentData.recommendations.length > 0) ? (
                <StudyPlan recommendations={currentData.recommendations} theme={theme} loadingAI={loadingAI} />
              ) : (
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                      <BookOpen className="h-5 w-5" />
                      Plan de Estudio Personalizado
                    </CardTitle>
                    <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Recomendaciones basadas en tu desempeño</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay recomendaciones específicas disponibles</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta más evaluaciones para generar un plan de estudio personalizado</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            {(() => {
              const currentData = getCurrentPhaseData();
              if (!currentData) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Trophy className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay suficientes datos para mostrar el progreso</p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta múltiples evaluaciones para ver tu evolución</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return currentData.subjects.length > 0 ? (
                <ComparisonChart subjects={currentData.subjects} theme={theme} />
              ) : (
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                      <Trophy className="h-5 w-5" />
                      Seguimiento de Progreso
                    </CardTitle>
                    <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Análisis comparativo de tu evolución</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Trophy className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay suficientes datos para mostrar el progreso</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta múltiples evaluaciones para ver tu evolución</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Mensajes Motivadores */}
        <Card className={cn(
          "mt-6",
          theme === 'dark' 
            ? 'bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-700/50' 
            : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
        )}>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-center gap-3 relative overflow-hidden">
              <Medal className={cn("h-6 w-6 flex-shrink-0", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
              <div className="relative w-full max-w-4xl min-h-[40px] flex items-center justify-center overflow-hidden">
                <p 
                  key={currentMotivationalIndex}
                  className={cn(
                    "text-sm md:text-base font-serif italic text-center leading-relaxed max-w-4xl w-full",
                    theme === 'dark' ? 'text-white' : 'text-gray-800',
                    "transition-all duration-500 ease-in-out"
                  )}
                  style={{
                    transform: isTransitioning 
                      ? 'translateX(-100%) scale(0.95)' 
                      : isEntering
                      ? 'translateX(100%) scale(0.95)'
                      : 'translateX(0) scale(1)',
                    opacity: isTransitioning || isEntering ? 0 : 1
                  }}
                >
                  {motivationalMessages[currentMotivationalIndex]}
                </p>
              </div>
              <Medal className={cn("h-6 w-6 flex-shrink-0", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}