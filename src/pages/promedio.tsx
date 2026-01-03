import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Link } from "react-router-dom"
import { doc, getDoc, getFirestore, collection, getDocs } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { firebaseApp } from "@/services/firebase/db.service"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { getUserById } from "@/controllers/user.controller"
import { dbService } from "@/services/firebase/db.service"
import { studyPlanAuthorizationService } from "@/services/studyPlan/studyPlanAuthorization.service"
import { SubjectName, StudyPlanPhase } from "@/interfaces/studyPlan.interface"
import { cn } from "@/lib/utils"
import { geminiService } from "@/services/ai/gemini.service"
import { getAllPhases, getPhaseType } from "@/utils/firestoreHelpers"
import { SubjectTopicsAccordion } from "@/components/charts/SubjectTopicsAccordion"
import { StrengthsRadarChart } from "@/components/charts/StrengthsRadarChart"
import { SubjectsProgressChart } from "@/components/charts/SubjectsProgressChart"
import { SubjectsDetailedSummary } from "@/components/charts/SubjectsDetailedSummary"
import { studentSummaryService } from "@/services/studentSummary/studentSummary.service"
import { useNotification } from "@/hooks/ui/useNotification"
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
  ContactRound,
  NotepadText,
  BarChart2,
  Apple,
  Shield,
  Link as LinkIcon,
  Eye,
  Lock,
  Info,
  Loader2
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
  questionTimeTracking?: { [key: string]: { timeSpent: number; startTime?: number; endTime?: number } }; // Tiempo por pregunta
  questionDetails: Array<{
    questionId: number | string;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    topic: string;
    isCorrect: boolean;
    answered: boolean;
    timeSpent?: number; // Tiempo en segundos que se demoró en esta pregunta
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
  neutrals: string[]; // Temas intermedios (60% - 69%)
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
    luckPercentage: number; // Porcentaje de respuestas "con suerte" (< 10 segundos)
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
        // Filtrar materias que tengan al menos fortalezas, debilidades o neutros
        const hasData = subject.strengths.length > 0 || subject.weaknesses.length > 0 || subject.neutrals.length > 0;
        
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
                  {subject.neutrals.length > 0 && (
                    <Badge className={cn("text-xs", theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800 border-gray-200")}>
                      {subject.neutrals.length} intermedio{subject.neutrals.length > 1 ? 's' : ''}
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
                
                {/* Neutros/Intermedios - Siempre mostrar si hay */}
                {subject.neutrals.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')}>
                        Intermedios ({subject.neutrals.length})
                      </span>
                    </div>
                    <ul className={cn("space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {subject.neutrals.map((neutral, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                          <Clock className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                          <span>{neutral}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Intermedios
                      </span>
                    </div>
                    <p className={cn("text-xs italic", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                      No se identificaron temas intermedios en esta materia
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

// Tipos para el plan de estudio
interface StudyPlanData {
  student_info: {
    studentId: string;
    phase: string;
    subject: string;
    weaknesses: Array<{
      topic: string;
      percentage: number;
      correct: number;
      total: number;
    }>;
  };
  diagnostic_summary: string;
  study_plan_summary: string;
  video_resources: Array<{
    title: string;
    url: string;
    description: string;
  }>;
  practice_exercises: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    topic: string;
  }>;
  study_links: Array<{
    title: string;
    url: string;
    description: string;
  }>;
}

// Componente de resumen de planes de estudio para "Todas las Fases"
function StudyPlanSummary({
  phase1Data,
  phase2Data,
  user,
  theme
}: {
  phase1Data: AnalysisData | null;
  phase2Data: AnalysisData | null;
  user: any;
  theme: 'light' | 'dark';
}) {
  const [phase1Stats, setPhase1Stats] = useState({ deployed: 0, pending: 0, loading: true });
  const [phase2Stats, setPhase2Stats] = useState({ deployed: 0, pending: 0, loading: true });
  const FUNCTIONS_URL = 'https://us-central1-superate-ia.cloudfunctions.net';

  // Función para verificar si un plan está completo
  const isPlanComplete = (plan: any): boolean => {
    if (!plan) return false;
    const hasVideos = plan.video_resources && Array.isArray(plan.video_resources) && plan.video_resources.length > 0;
    const hasLinks = plan.study_links && Array.isArray(plan.study_links) && plan.study_links.length > 0;
    const hasExercises = plan.practice_exercises && Array.isArray(plan.practice_exercises) && plan.practice_exercises.length > 0;
    return hasVideos && hasLinks && hasExercises;
  };

  // Cargar estadísticas de Fase I
  useEffect(() => {
    const loadPhase1Stats = async () => {
      if (!phase1Data?.subjectsWithTopics || !user?.uid) {
        setPhase1Stats({ deployed: 0, pending: 0, loading: false });
        return;
      }

      setPhase1Stats({ deployed: 0, pending: 0, loading: true });
      const subjectsWithWeaknesses = phase1Data.subjectsWithTopics.filter(s => s.weaknesses.length > 0);
      let deployed = 0;

      for (const subject of subjectsWithWeaknesses) {
        try {
          const response = await fetch(
            `${FUNCTIONS_URL}/getStudyPlan?studentId=${user.uid}&phase=first&subject=${encodeURIComponent(subject.name)}`
          );
          const result = await response.json();
          if (result.success && result.data && isPlanComplete(result.data)) {
            deployed++;
          }
        } catch (error) {
          console.error(`Error verificando plan para ${subject.name} (Fase I):`, error);
        }
      }

      setPhase1Stats({
        deployed,
        pending: subjectsWithWeaknesses.length - deployed,
        loading: false
      });
    };

    loadPhase1Stats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase1Data, user?.uid]);

  // Cargar estadísticas de Fase II
  useEffect(() => {
    const loadPhase2Stats = async () => {
      if (!phase2Data?.subjectsWithTopics || !user?.uid) {
        setPhase2Stats({ deployed: 0, pending: 0, loading: false });
        return;
      }

      setPhase2Stats({ deployed: 0, pending: 0, loading: true });
      const subjectsWithWeaknesses = phase2Data.subjectsWithTopics.filter(s => s.weaknesses.length > 0);
      let deployed = 0;

      for (const subject of subjectsWithWeaknesses) {
        try {
          const response = await fetch(
            `${FUNCTIONS_URL}/getStudyPlan?studentId=${user.uid}&phase=second&subject=${encodeURIComponent(subject.name)}`
          );
          const result = await response.json();
          if (result.success && result.data && isPlanComplete(result.data)) {
            deployed++;
          }
        } catch (error) {
          console.error(`Error verificando plan para ${subject.name} (Fase II):`, error);
        }
      }

      setPhase2Stats({
        deployed,
        pending: subjectsWithWeaknesses.length - deployed,
        loading: false
      });
    };

    loadPhase2Stats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase2Data, user?.uid]);

  const totalPhase1Subjects = phase1Data?.subjectsWithTopics?.length || 0;
  const totalPhase2Subjects = phase2Data?.subjectsWithTopics?.length || 0;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "rounded-2xl shadow-xl p-6 sm:p-8",
          theme === 'dark' 
            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-purple-500/50' 
            : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200'
        )}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            "p-3 rounded-xl",
            theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
          )}>
            <BookOpen className={cn(
              "w-8 h-8",
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            )} />
          </div>
          <div>
            <h3 className={cn(
              "text-2xl sm:text-3xl font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Resumen de Planes de Estudio
            </h3>
            <p className={cn(
              "text-sm sm:text-base mt-1",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Disponibles para Fase I y Fase II
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Fase I */}
          <Card className={cn(
            theme === 'dark' 
              ? 'bg-zinc-800/50 border-zinc-700' 
              : 'bg-white/80 border-gray-200'
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                  )}>
                    <Target className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                    )} />
                  </div>
                  <h4 className={cn(
                    "font-semibold text-lg",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Fase I
                  </h4>
                </div>
                <Badge className={cn(
                  "bg-blue-500 text-white"
                )}>
                  Diagnóstico
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Materias evaluadas
                  </span>
                  <span className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {totalPhase1Subjects}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Planes desplegados
                  </span>
                  <span className={cn(
                    "font-semibold text-blue-500",
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )}>
                    {phase1Stats.loading ? '...' : phase1Stats.deployed}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Planes por desplegar
                  </span>
                  <span className={cn(
                    "font-semibold text-orange-500",
                    theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                  )}>
                    {phase1Stats.loading ? '...' : phase1Stats.pending}
                  </span>
                </div>
              </div>
              <p className={cn(
                "text-xs mt-4 pt-4 border-t",
                theme === 'dark' ? 'text-gray-500 border-zinc-700' : 'text-gray-500 border-gray-200'
              )}>
                Selecciona "Fase I" para ver y generar planes de estudio personalizados
              </p>
            </CardContent>
          </Card>

          {/* Fase II */}
          <Card className={cn(
            theme === 'dark' 
              ? 'bg-zinc-800/50 border-zinc-700' 
              : 'bg-white/80 border-gray-200'
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                  )}>
                    <TrendingUp className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? 'text-green-400' : 'text-green-600'
                    )} />
                  </div>
                  <h4 className={cn(
                    "font-semibold text-lg",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Fase II
                  </h4>
                </div>
                <Badge className={cn(
                  "bg-green-500 text-white"
                )}>
                  Refuerzo
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Materias evaluadas
                  </span>
                  <span className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {totalPhase2Subjects}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Planes desplegados
                  </span>
                  <span className={cn(
                    "font-semibold text-green-500",
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )}>
                    {phase2Stats.loading ? '...' : phase2Stats.deployed}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Planes por desplegar
                  </span>
                  <span className={cn(
                    "font-semibold text-orange-500",
                    theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                  )}>
                    {phase2Stats.loading ? '...' : phase2Stats.pending}
                  </span>
                </div>
              </div>
              <p className={cn(
                "text-xs mt-4 pt-4 border-t",
                theme === 'dark' ? 'text-gray-500 border-zinc-700' : 'text-gray-500 border-gray-200'
              )}>
                Selecciona "Fase II" para ver y generar planes de estudio personalizados
              </p>
            </CardContent>
          </Card>
        </div>

        <div className={cn(
          "mt-6 p-4 rounded-lg",
          theme === 'dark' 
            ? 'bg-zinc-800/50 border border-zinc-700' 
            : 'bg-white/60 border border-gray-200'
        )}>
          <div className="flex items-start gap-3">
            <Info className={cn(
              "w-5 h-5 mt-0.5 flex-shrink-0",
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )} />
            <div>
              <p className={cn(
                "text-sm font-medium mb-1",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Información importante
              </p>
              <p className={cn(
                "text-xs leading-relaxed",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Los planes de estudio personalizados están disponibles únicamente para la <strong>Fase I</strong> (Diagnóstico) y la <strong>Fase II</strong> (Refuerzo Personalizado). 
                La <strong>Fase III</strong> (Simulacro ICFES) es una evaluación final y no requiere plan de estudio adicional. 
                Selecciona una fase específica arriba para ver y generar tus planes personalizados.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Componente de plan de estudio personalizado
function PersonalizedStudyPlan({ 
  subjectsWithTopics, 
  phase, 
  studentId, 
  theme = 'light' 
}: { 
  subjectsWithTopics: SubjectWithTopics[];
  phase: 'first' | 'second' | 'third';
  studentId: string;
  theme?: 'light' | 'dark';
}) {
  const [studyPlans, setStudyPlans] = useState<Record<string, StudyPlanData>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [expandedSection] = useState<Record<string, string | null>>({});
  // Estados para ejercicios de práctica: rastrear respuestas expandidas y selecciones del estudiante
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loadingPlans, setLoadingPlans] = useState<boolean>(true);
  // Estado para controlar qué materias están expandidas en el acordeón
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  // Estado para almacenar las autorizaciones de planes de estudio por materia
  const [subjectAuthorizations, setSubjectAuthorizations] = useState<Record<string, boolean>>({});
  const [loadingAuthorizations, setLoadingAuthorizations] = useState<boolean>(true);

  // URL base de Cloud Functions
  const FUNCTIONS_URL = 'https://us-central1-superate-ia.cloudfunctions.net';

  // Verificar si un plan está completo (tiene videos, enlaces y ejercicios)
  const isPlanComplete = (plan: StudyPlanData | undefined): boolean => {
    if (!plan) return false;
    
    const hasVideos = plan.video_resources && Array.isArray(plan.video_resources) && plan.video_resources.length > 0;
    const hasLinks = plan.study_links && Array.isArray(plan.study_links) && plan.study_links.length > 0;
    const hasExercises = plan.practice_exercises && Array.isArray(plan.practice_exercises) && plan.practice_exercises.length > 0;
    
    return hasVideos && hasLinks && hasExercises;
  };

  // Cargar autorizaciones de planes de estudio
  useEffect(() => {
    const loadAuthorizations = async () => {
      setLoadingAuthorizations(true);
      const authorizations: Record<string, boolean> = {};
      
      try {
        // Obtener información del estudiante para obtener el gradeId
        const userResult = await dbService.getUserById(studentId);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data;
          const gradeId = studentData.gradeId || studentData.grade;
          
          if (gradeId) {
            // Solo verificar autorización para Fase I y Fase II
            // Convertir phase a StudyPlanPhase (solo 'first' o 'second' son válidos)
            const studyPlanPhase: StudyPlanPhase | null = 
              phase === 'first' ? 'first' : 
              phase === 'second' ? 'second' : 
              null;
            
            if (studyPlanPhase) {
              // Verificar autorización para cada materia en la fase actual
              for (const subject of subjectsWithTopics) {
                if (subject.weaknesses.length > 0) {
                  try {
                    const authResult = await studyPlanAuthorizationService.isStudyPlanAuthorized(
                      gradeId,
                      studyPlanPhase,
                      subject.name as SubjectName
                    );
                    authorizations[subject.name] = authResult.success ? authResult.data : false;
                  } catch (error) {
                    console.error(`Error verificando autorización para ${subject.name}:`, error);
                    authorizations[subject.name] = false;
                  }
                }
              }
            } else {
              // Si es Fase III, no hay autorizaciones de planes de estudio
              console.log('Fase III no requiere autorización de planes de estudio');
              subjectsWithTopics.forEach(subject => {
                authorizations[subject.name] = false;
              });
            }
          } else {
            console.warn('No se encontró gradeId para el estudiante');
            // Si no hay gradeId, no autorizar ninguna materia
            subjectsWithTopics.forEach(subject => {
              authorizations[subject.name] = false;
            });
          }
        } else {
          console.error('Error obteniendo información del estudiante');
          subjectsWithTopics.forEach(subject => {
            authorizations[subject.name] = false;
          });
        }
      } catch (error) {
        console.error('Error cargando autorizaciones:', error);
        subjectsWithTopics.forEach(subject => {
          authorizations[subject.name] = false;
        });
      }
      
      setSubjectAuthorizations(authorizations);
      setLoadingAuthorizations(false);
    };

    if (studentId && subjectsWithTopics.length > 0) {
      loadAuthorizations();
    } else {
      setLoadingAuthorizations(false);
    }
  }, [studentId, subjectsWithTopics]);

  // Cargar planes existentes al montar (solo planes completos)
  useEffect(() => {
    const loadStudyPlans = async () => {
      setLoadingPlans(true);
      const plans: Record<string, StudyPlanData> = {};
      
      for (const subject of subjectsWithTopics) {
        // Solo cargar planes para materias con debilidades
        if (subject.weaknesses.length > 0) {
          try {
            const response = await fetch(
              `${FUNCTIONS_URL}/getStudyPlan?studentId=${studentId}&phase=${phase}&subject=${encodeURIComponent(subject.name)}`
            );
            const result = await response.json();
            if (result.success && result.data) {
              // Solo cargar el plan si está completo
              if (isPlanComplete(result.data)) {
                plans[subject.name] = result.data;
                console.log(`✅ Plan completo encontrado para ${subject.name} en ${phase}`);
              } else {
                console.log(`⚠️ Plan incompleto para ${subject.name} en ${phase} (no se mostrará)`);
              }
            } else {
              console.log(`ℹ️ No hay plan para ${subject.name} en ${phase}`);
            }
          } catch (error) {
            console.error(`Error cargando plan para ${subject.name}:`, error);
          }
        }
      }
      
      setStudyPlans(plans);
      setLoadingPlans(false);
    };

    if (studentId && subjectsWithTopics.length > 0) {
      loadStudyPlans();
    } else {
      setLoadingPlans(false);
    }
  }, [studentId, phase, subjectsWithTopics]);

  // Generar plan de estudio para una materia
  const generateStudyPlan = async (subject: string) => {
    setGeneratingFor(subject);
    try {
      // Iniciar generación del plan (esto puede tardar varios minutos)
      const response = await fetch(`${FUNCTIONS_URL}/generateStudyPlan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          phase,
          subject,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.data) {
        // El backend ya generó y guardó el plan completo
        // Usar directamente el plan retornado
        setStudyPlans(prev => ({
          ...prev,
          [subject]: result.data,
        }));
        console.log(`✅ Plan completo cargado para ${subject}`);
      } else {
        alert(`Error: ${result.error?.message || 'No se pudo generar el plan de estudio'}`);
      }
    } catch (error: any) {
      console.error('Error generando plan de estudio:', error);
      alert(`Error: ${error.message || 'Error al generar el plan de estudio'}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  // Obtener materias con debilidades
  const subjectsWithWeaknesses = subjectsWithTopics.filter(s => s.weaknesses.length > 0);

  // Orden de materias para mostrar (solo para orden visual, no para cascada)
  const subjectOrder: Record<string, number> = {
    'Matemáticas': 1,
    'Lenguaje': 2,
    'Ciencias Sociales': 3,
    'Biologia': 4,
    'Quimica': 5,
    'Física': 6,
    'Inglés': 7
  };

  // Ordenar materias según el orden predefinido (solo para orden visual)
  const sortedSubjects = [...subjectsWithWeaknesses].sort((a, b) => {
    const orderA = subjectOrder[a.name] || 999;
    const orderB = subjectOrder[b.name] || 999;
    return orderA - orderB;
  });

  if (subjectsWithWeaknesses.length === 0) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Trophy className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
            <p className={cn("mb-2 font-medium", theme === 'dark' ? 'text-white' : 'text-gray-800')}>
              ¡Excelente trabajo!
            </p>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              No se identificaron debilidades. Continúa así.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar loading mientras se verifican los planes en la base de datos
  if (loadingPlans) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Verificando planes de estudio en la base de datos...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Accordion 
      type="multiple" 
      className="w-full"
      value={expandedSubjects}
      onValueChange={setExpandedSubjects}
    >
      <div className="space-y-3">
      {sortedSubjects.map((subject) => {
        const plan = studyPlans[subject.name];
        const isGenerating = generatingFor === subject.name;
        const isAuthorized = subjectAuthorizations[subject.name] ?? false;
        // Mostrar el botón solo si:
        // 1. NO hay plan en la base de datos
        // 2. La materia está autorizada para el grado y fase del estudiante
        // 3. Se han cargado las autorizaciones
        // NO hay lógica de cascada - cada materia se habilita independientemente según la autorización del admin
        const shouldShowButton = !plan && !loadingPlans && !loadingAuthorizations && isAuthorized;

        return (
          <AccordionItem 
            key={subject.name}
            value={subject.name}
            className={cn(
              "border rounded-lg overflow-hidden transition-all border-b-0",
              theme === 'dark' ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800' : 'bg-white/90 border-gray-200 hover:bg-white shadow-md'
            )}
          >
            <AccordionTrigger 
              className={cn(
                "px-4 py-3 hover:no-underline",
                theme === 'dark' ? 'hover:bg-zinc-700/50' : 'hover:bg-gray-50'
              )}
            >
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <BookOpen className={cn("h-5 w-5 flex-shrink-0", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                  <div>
                    <h3 className={cn("font-semibold text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {subject.name}
                    </h3>
                    <p className={cn("text-sm mt-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {subject.weaknesses.length} debilidad(es) identificada(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {shouldShowButton && (
                    <Button
                      onClick={() => generateStudyPlan(subject.name)}
                      disabled={isGenerating}
                      size="sm"
                      className={cn(
                        theme === 'dark' 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      )}
                    >
                      {isGenerating ? (
                        <>
                          <div className={cn("animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2")}></div>
                          Generando...
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3 mr-2" />
                          Generar Plan
                        </>
                      )}
                    </Button>
                  )}
                  {!plan && !shouldShowButton && (
                    <div className={cn("text-sm px-3 py-1.5 rounded-lg", theme === 'dark' ? 'bg-zinc-700/50 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                      {loadingAuthorizations ? (
                        <>
                          <div className={cn("animate-spin rounded-full h-3 w-3 border-b-2 inline-block mr-2", theme === 'dark' ? 'border-gray-400' : 'border-gray-600')}></div>
                          Verificando...
                        </>
                      ) : !isAuthorized ? (
                        <>
                          <Lock className="h-3 w-3 inline mr-2" />
                          No autorizado
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 inline mr-2" />
                          En espera
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className={cn(
                "px-4 pb-4 pt-2",
                theme === 'dark' ? 'bg-zinc-900/30' : 'bg-gray-50/50'
              )}>

                {isGenerating && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
                    <div>
                      <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Generando plan de estudio personalizado...
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Estamos creando un plan detallado con videos, enlaces web y ejercicios de práctica. Esto puede tardar varios minutos. El plan aparecerá automáticamente cuando esté completo.
                      </p>
                    </div>
                  </div>
                )}

                {plan && !isGenerating && (
                  <div className="space-y-6">
                {/* Resumen del diagnóstico */}
                <div className={cn("p-4 rounded-lg", theme === 'dark' ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-purple-50 border border-purple-200')}>
                  <h3 className={cn("font-semibold mb-2 flex items-center gap-2", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                    <Target className="h-4 w-4" />
                    Resumen del Diagnóstico
                  </h3>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    {plan.diagnostic_summary}
                  </p>
                </div>

                {/* Resumen del plan */}
                <div>
                  <h3 className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : '')}>
                    Resumen del Plan de Estudio
                  </h3>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                    {plan.study_plan_summary}
                  </p>
                </div>

                {/* Videos */}
                <Accordion type="single" collapsible value={expandedSection[`${subject.name}-videos`] || undefined}>
                  <AccordionItem value="videos">
                    <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Videos Educativos ({plan.video_resources?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {plan.video_resources?.map((video, idx) => (
                          <a
                            key={idx}
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "block p-3 rounded-lg border transition-colors",
                              theme === 'dark' 
                                ? 'bg-zinc-700/50 border-zinc-600 hover:bg-zinc-700' 
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            <h4 className={cn("font-medium mb-1", theme === 'dark' ? 'text-white' : '')}>
                              {video.title}
                            </h4>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {video.description}
                            </p>
                            <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                              {video.url}
                            </p>
                          </a>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Enlaces de estudio */}
                <Accordion type="single" collapsible value={expandedSection[`${subject.name}-links`] || undefined}>
                  <AccordionItem value="links">
                    <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Recursos Web ({plan.study_links?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {plan.study_links?.map((link, idx) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "block p-3 rounded-lg border transition-colors",
                              theme === 'dark' 
                                ? 'bg-zinc-700/50 border-zinc-600 hover:bg-zinc-700' 
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            <h4 className={cn("font-medium mb-1", theme === 'dark' ? 'text-white' : '')}>
                              {link.title}
                            </h4>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {link.description}
                            </p>
                            <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                              {link.url}
                            </p>
                          </a>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Ejercicios de práctica */}
                <Accordion type="single" collapsible value={expandedSection[`${subject.name}-exercises`] || undefined}>
                  <AccordionItem value="exercises">
                    <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
                      <div className="flex items-center gap-2">
                        <NotepadText className="h-4 w-4" />
                        Ejercicios de Práctica ({plan.practice_exercises?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {plan.practice_exercises?.map((exercise, idx) => {
                          const exerciseKey = `${subject.name}-${idx}`;
                          const isExpanded = expandedExercises[exerciseKey] || false;
                          const selectedAnswer = selectedAnswers[exerciseKey] || '';
                          const showAnswer = isExpanded;

                          return (
                            <Card key={idx} className={cn(theme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-gray-50 border-gray-200')}>
                              <CardContent className="pt-4">
                                <div className="space-y-3">
                                  <div>
                                    <Badge className={cn("mb-2", theme === 'dark' ? 'bg-purple-700 text-purple-200' : 'bg-purple-100 text-purple-700')}>
                                      {exercise.topic}
                                    </Badge>
                                    <p className={cn("font-medium mb-3", theme === 'dark' ? 'text-white' : '')}>
                                      {exercise.question}
                                    </p>
                                    <div className="space-y-2">
                                      {exercise.options?.map((option, optIdx) => {
                                        const isSelected = selectedAnswer === option;
                                        // Verificar si es la opción correcta: debe empezar con "A) ", "B) ", etc.
                                        // Manejar tanto el caso donde correctAnswer es "A" y la opción es "A) Texto"
                                        // como el caso donde correctAnswer podría ser "A) Texto" completo
                                        const correctAnswerLetter = exercise.correctAnswer?.trim().charAt(0).toUpperCase();
                                        const isCorrectOption = option.trim().toUpperCase().startsWith(`${correctAnswerLetter}) `) ||
                                                              option.trim().toUpperCase().startsWith(correctAnswerLetter + ')');
                                        const shouldHighlightCorrect = showAnswer && isCorrectOption;
                                        const shouldHighlightIncorrect = showAnswer && isSelected && !isCorrectOption;

                                        return (
                                          <div
                                            key={optIdx}
                                            onClick={() => {
                                              if (!isExpanded) {
                                                setSelectedAnswers(prev => ({
                                                  ...prev,
                                                  [exerciseKey]: option
                                                }));
                                              }
                                            }}
                                            className={cn(
                                              "p-3 rounded border transition-colors cursor-pointer",
                                              !isExpanded && "hover:opacity-80",
                                              isExpanded && "cursor-default",
                                              shouldHighlightCorrect
                                                ? theme === 'dark'
                                                  ? 'bg-green-900/30 border-green-700'
                                                  : 'bg-green-50 border-green-200'
                                                : shouldHighlightIncorrect
                                                ? theme === 'dark'
                                                  ? 'bg-red-900/30 border-red-700'
                                                  : 'bg-red-50 border-red-200'
                                                : isSelected && !isExpanded
                                                ? theme === 'dark'
                                                  ? 'bg-blue-900/30 border-blue-700'
                                                  : 'bg-blue-50 border-blue-200'
                                                : theme === 'dark'
                                                ? 'bg-zinc-800/50 border-zinc-600'
                                                : 'bg-white border-gray-200'
                                            )}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className={cn(
                                                "font-medium",
                                                shouldHighlightCorrect
                                                  ? theme === 'dark' ? 'text-green-300' : 'text-green-700'
                                                  : shouldHighlightIncorrect
                                                  ? theme === 'dark' ? 'text-red-300' : 'text-red-700'
                                                  : isSelected && !isExpanded
                                                  ? theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                                                  : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                              )}>
                                                {option}
                                              </span>
                                              {shouldHighlightCorrect && (
                                                <CheckCircle2 className={cn("h-5 w-5", theme === 'dark' ? 'text-green-300' : 'text-green-700')} />
                                              )}
                                              {shouldHighlightIncorrect && (
                                                <AlertTriangle className={cn("h-5 w-5", theme === 'dark' ? 'text-red-300' : 'text-red-700')} />
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  
                                  {/* Botón para ver respuesta y explicación */}
                                  {!isExpanded && (
                                    <Button
                                      onClick={() => {
                                        setExpandedExercises(prev => ({
                                          ...prev,
                                          [exerciseKey]: true
                                        }));
                                      }}
                                      className={cn(
                                        "w-full",
                                        theme === 'dark' 
                                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                                      )}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver respuesta y explicación
                                    </Button>
                                  )}

                                  {/* Explicación (solo visible cuando está expandido) */}
                                  {isExpanded && (
                                    <div className={cn("p-3 rounded-lg mt-3", theme === 'dark' ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-blue-50 border border-blue-200')}>
                                      <p className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                                        Explicación:
                                      </p>
                                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                        {exercise.explanation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  </Accordion>
                  </div>
                )}

                {!plan && !isGenerating && (
                  <div>
                <div className="text-center py-6">
                  {shouldShowButton ? (
                    <>
                      <p className={cn("text-sm mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Haz clic en "Generar Plan" para crear un plan de estudio personalizado basado en tus debilidades.
                      </p>
                      <div className={cn("p-3 rounded-lg", theme === 'dark' ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-yellow-50 border border-yellow-200')}>
                        <p className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700')}>
                          Debilidades identificadas:
                        </p>
                        <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {subject.weaknesses.map((weakness, idx) => {
                            const topicData = subject.topics.find(t => t.name === weakness);
                            return (
                              <li key={idx}>
                                • {weakness} ({topicData?.percentage || 0}%)
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={cn("flex items-center justify-center gap-2 mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        <Clock className="h-5 w-5" />
                        <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          El plan de estudio estará disponible después de generar el plan de la materia anterior.
                        </p>
                      </div>
                      <div className={cn("p-3 rounded-lg", theme === 'dark' ? 'bg-zinc-700/30 border border-zinc-600/50' : 'bg-gray-50 border border-gray-200')}>
                        <p className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Debilidades identificadas:
                        </p>
                        <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          {subject.weaknesses.map((weakness, idx) => {
                            const topicData = subject.topics.find(t => t.name === weakness);
                            return (
                              <li key={idx}>
                                • {weakness} ({topicData?.percentage || 0}%)
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  )}
                  </div>
                </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
      </div>
    </Accordion>
  );
}
/**
 * Función para preparar datos de gráficos por materia y tema
 * Agrupa el rendimiento de cada TEMA de cada materia a través de las 3 fases
 */
function prepareSubjectTopicsData(
  phase1Data: AnalysisData | null,
  phase2Data: AnalysisData | null,
  phase3Data: AnalysisData | null
): Array<{
  subjectName: string;
  topics: Array<{ topic: string; phase1: number | null; phase2: number | null; phase3: number | null }>;
  averagePerformance: number;
  trend: 'up' | 'down' | 'stable';
}> {
  // Obtener todas las materias únicas de las 3 fases
  const allSubjects = new Set<string>();
  
  if (phase1Data) {
    phase1Data.subjectsWithTopics?.forEach(s => allSubjects.add(s.name));
  }
  if (phase2Data) {
    phase2Data.subjectsWithTopics?.forEach(s => allSubjects.add(s.name));
  }
  if (phase3Data) {
    phase3Data.subjectsWithTopics?.forEach(s => allSubjects.add(s.name));
  }

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

  // Procesar cada materia
  const result = Array.from(allSubjects).map(subjectName => {
    // Buscar los datos de esta materia en cada fase
    const phase1Subject = phase1Data?.subjectsWithTopics?.find(s => s.name === subjectName);
    const phase2Subject = phase2Data?.subjectsWithTopics?.find(s => s.name === subjectName);
    const phase3Subject = phase3Data?.subjectsWithTopics?.find(s => s.name === subjectName);

    // Obtener todos los temas únicos de esta materia
    const allTopics = new Set<string>();
    phase1Subject?.topics.forEach(t => allTopics.add(t.name));
    phase2Subject?.topics.forEach(t => allTopics.add(t.name));
    phase3Subject?.topics.forEach(t => allTopics.add(t.name));

    // Crear array de datos de temas
    const topics = Array.from(allTopics).map(topicName => {
      const phase1Topic = phase1Subject?.topics.find(t => t.name === topicName);
      const phase2Topic = phase2Subject?.topics.find(t => t.name === topicName);
      const phase3Topic = phase3Subject?.topics.find(t => t.name === topicName);

      return {
        topic: topicName,
        phase1: phase1Topic ? phase1Topic.percentage : null,
        phase2: phase2Topic ? phase2Topic.percentage : null,
        phase3: phase3Topic ? phase3Topic.percentage : null,
      };
    });

    // Calcular promedio general de la materia (usando datos de subjectsWithTopics)
    const phase1Percentage = phase1Subject?.percentage ?? null;
    const phase2Percentage = phase2Subject?.percentage ?? null;
    const phase3Percentage = phase3Subject?.percentage ?? null;

    const validPercentages = [phase1Percentage, phase2Percentage, phase3Percentage].filter(
      (p): p is number => p !== null
    );
    const averagePerformance = validPercentages.length > 0
      ? validPercentages.reduce((sum, p) => sum + p, 0) / validPercentages.length
      : 0;

    // Calcular tendencia de la materia
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let firstPhase: number | null = null;
    let lastPhase: number | null = null;

    if (phase1Percentage !== null) firstPhase = phase1Percentage;
    
    if (phase3Percentage !== null) {
      lastPhase = phase3Percentage;
    } else if (phase2Percentage !== null) {
      lastPhase = phase2Percentage;
    } else if (phase1Percentage !== null) {
      lastPhase = phase1Percentage;
    }

    if (firstPhase !== null && lastPhase !== null && firstPhase !== lastPhase) {
      const difference = lastPhase - firstPhase;
      const percentageChange = (difference / firstPhase) * 100;

      if (Math.abs(percentageChange) >= 2) {
        trend = percentageChange > 0 ? 'up' : 'down';
      }
    }

    return {
      subjectName,
      topics,
      averagePerformance,
      trend,
    };
  });

  // Ordenar por el orden predefinido de materias
  result.sort((a, b) => {
    const orderA = subjectOrder[a.subjectName] || 999;
    const orderB = subjectOrder[b.subjectName] || 999;
    return orderA - orderB;
  });

  return result;
}

export default function ICFESAnalysisInterface() {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('all');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [phase1Data, setPhase1Data] = useState<AnalysisData | null>(null);
  const [phase2Data, setPhase2Data] = useState<AnalysisData | null>(null);
  const [phase3Data, setPhase3Data] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLoadingAI] = useState(false);
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const [studentRank, setStudentRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [isLoadingRank, setIsLoadingRank] = useState(false);
  const [currentMotivationalIndex, setCurrentMotivationalIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPDFPhaseDialogOpen, setIsPDFPhaseDialogOpen] = useState(false);
  const [selectedPhasesForPDF, setSelectedPhasesForPDF] = useState<Array<'first' | 'second' | 'third'>>([]);
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();
  const { user } = useAuthContext();
  const { notifySuccess, notifyError } = useNotification();

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

  // Función para calcular el puntaje global de un estudiante para una fase específica
  const calculateStudentGlobalScoreForPhase = async (studentId: string, phase: 'first' | 'second' | 'third'): Promise<number> => {
    try {
      const evaluations = await getPhaseEvaluations(studentId, phase);
      
      if (evaluations.length === 0) {
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

      // Agrupar resultados por materia y tomar el mejor puntaje de cada una
      const subjectScores: { [subject: string]: number } = {};

      evaluations.forEach(evalData => {
        const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '');
        
        let percentage = 0;
        if (evalData.score?.overallPercentage !== undefined) {
          percentage = evalData.score.overallPercentage;
        } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
          const total = evalData.score.totalQuestions;
          const correct = evalData.score.correctAnswers;
          percentage = total > 0 ? (correct / total) * 100 : 0;
        } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
          const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length;
          const total = evalData.questionDetails.length;
          percentage = total > 0 ? (correct / total) * 100 : 0;
        }

        // Guardar el mejor puntaje de cada materia
        if (!subjectScores[subject] || percentage > subjectScores[subject]) {
          subjectScores[subject] = percentage;
        }
      });

      // Calcular puntaje global
      let globalScore = 0;
      
      Object.entries(subjectScores).forEach(([subject, percentage]) => {
        let pointsForSubject: number;
        if (NATURALES_SUBJECTS.includes(subject)) {
          pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT;
        } else {
          pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
        }
        
        globalScore += pointsForSubject;
      });

      return Math.round(globalScore * 100) / 100;
    } catch (error) {
      console.error('Error calculando puntaje del estudiante para fase:', error);
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
        
        // Determinar la fase actual basada en los datos disponibles
        // Priorizar Fase III, luego Fase II, luego Fase I
        let currentPhase: 'first' | 'second' | 'third' = 'third';
        if (phase3Data) {
          currentPhase = 'third';
        } else if (phase2Data) {
          currentPhase = 'second';
        } else if (phase1Data) {
          currentPhase = 'first';
        }
        
        // Calcular puntaje global de cada estudiante para la fase actual
        const studentScores: { studentId: string; score: number }[] = [];
        
        for (const classmate of classmates) {
          const studentId = (classmate as any).id || (classmate as any).uid;
          if (studentId) {
            const score = await calculateStudentGlobalScoreForPhase(studentId, currentPhase);
            if (score > 0) { // Solo incluir estudiantes con evaluaciones en esta fase
              studentScores.push({ studentId, score });
            }
          }
        }

        // Ordenar por puntaje (mayor a menor)
        studentScores.sort((a, b) => b.score - a.score);

        // Encontrar el puesto del estudiante actual
        const currentStudentIndex = studentScores.findIndex(s => s.studentId === user.uid);
        if (currentStudentIndex !== -1) {
          setStudentRank(currentStudentIndex + 1); // +1 porque el puesto empieza en 1
          setTotalStudents(studentScores.length); // Actualizar con el total real de estudiantes con evaluaciones
        } else {
          setStudentRank(null);
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
  }, [analysisData, user?.uid, phase1Data, phase2Data, phase3Data]);

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

        // Verificar y mostrar resumen del tiempo por pregunta
        console.log('📊 Resumen de tiempo por pregunta:');
        evaluationsArray.forEach(exam => {
          if (exam.questionDetails && exam.questionDetails.length > 0) {
            const questionsWithTime = exam.questionDetails.filter((q: { timeSpent?: number }) => q.timeSpent && q.timeSpent > 0);
            const totalTimeQuestions = questionsWithTime.reduce((sum: number, q: { timeSpent?: number }) => sum + (q.timeSpent || 0), 0);
            const avgTimePerQuestion = questionsWithTime.length > 0 ? totalTimeQuestions / questionsWithTime.length : 0;
            
            console.log(`  📝 ${exam.examTitle || exam.examId} (${exam.subject || 'Sin materia'}):`, {
              totalQuestions: exam.questionDetails.length,
              questionsWithTime: questionsWithTime.length,
              avgTimePerQuestion: `${Math.round(avgTimePerQuestion)}s`,
              totalTimeQuestions: `${Math.round(totalTimeQuestions)}s`,
              hasQuestionTimeTracking: !!exam.questionTimeTracking
            });
          }
        });

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
        
        const phase3Evals = evaluationsArray.filter(e => {
          const phase = e.phase || '';
          return phase === 'third' || 
                 phase === 'fase III' || 
                 phase === 'Fase III' ||
                 getPhaseType(phase) === 'third';
        });

        // Procesar datos por fase
        let phase1Processed: AnalysisData | null = null;
        let phase2Processed: AnalysisData | null = null;
        let phase3Processed: AnalysisData | null = null;

        if (phase1Evals.length > 0) {
          phase1Processed = processEvaluationData(phase1Evals, user);
          setPhase1Data(phase1Processed);
        }
        
        if (phase2Evals.length > 0) {
          phase2Processed = processEvaluationData(phase2Evals, user);
          setPhase2Data(phase2Processed);
        }
        
        if (phase3Evals.length > 0) {
          phase3Processed = processEvaluationData(phase3Evals, user);
          setPhase3Data(phase3Processed);
        }

        // Calcular datos consolidados para "Todas las Fases"
        const consolidatedData = calculateAllPhasesData(phase1Processed, phase2Processed, phase3Processed, user);
        setAnalysisData(consolidatedData);
        
        // Establecer fase inicial automáticamente
        if (phase3Evals.length > 0) {
          setSelectedPhase('phase3');
        } else if (phase2Evals.length > 0) {
          setSelectedPhase('phase2');
        } else if (phase1Evals.length > 0) {
          setSelectedPhase('phase1');
        }
        
        // Generar recomendaciones con IA si está disponible
        if (geminiService.isAvailable() && consolidatedData.subjects.length > 0) {
          generateAIRecommendations(consolidatedData);
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
    let totalTimeSpent = 0; // Tiempo total en segundos (suma de todos los questionDetails[].timeSpent)
    let totalTimeFromQuestions = 0; // Tiempo total calculado desde questionDetails
    let totalQuestionsWithTime = 0; // Total de preguntas que tienen tiempo registrado
    let totalAnswered = 0;
    let securityIssues = 0;
    let luckAnswers = 0; // Respuestas respondidas en < 10 segundos
    let totalAnswersWithTime = 0; // Total de respuestas que tienen tiempo registrado

    // Agrupar resultados por fase y materia para calcular puntos
    // Usamos el mejor resultado de cada materia por fase
    const phaseSubjectResults: { [phase: string]: { [subject: string]: { correct: number; total: number; percentage: number } } } = {};

    evaluations.forEach(exam => {
      // Obtener la materia normalizada al inicio para usarla en los cálculos
      const rawSubject = exam.subject || exam.examTitle || 'General';
      const subject = normalizeSubjectName(rawSubject);
      
      // Calcular tiempo desde questionDetails si está disponible
      if (exam.questionDetails && exam.questionDetails.length > 0) {
        exam.questionDetails.forEach(question => {
          if (question.timeSpent && question.timeSpent > 0) {
            totalTimeFromQuestions += question.timeSpent; // tiempo en segundos
            totalQuestionsWithTime++;
            
            // Contar respuestas "con suerte" (< 10 segundos) si la pregunta fue respondida
            // Excluir la materia de Inglés porque en esta materia las respuestas rápidas son válidas
            if (question.answered && subject !== 'Inglés') {
              totalAnswersWithTime++;
              if (question.timeSpent < 10) {
                luckAnswers++;
              }
            }
          }
        });
      }
      
      // Mantener compatibilidad con tiempo total del examen (fallback)
      totalTimeSpent += exam.timeSpent;
      totalAnswered += exam.score.totalAnswered;
      totalQuestions += exam.score.totalQuestions;
      totalCorrect += exam.score.correctAnswers;
      
      if (exam.tabChangeCount > 0) securityIssues++;

      // Agrupar por fase y materia para calcular puntos
      const phase = exam.phase || 'unknown';
      
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

      // Calcular fortalezas (temas con >= 70%), debilidades (temas con < 60%) y neutros (60% - 69%)
      // Los rangos son mutuamente excluyentes y cubren todos los casos posibles:
      // - Debilidades: 0% - 59%
      // - Intermedios: 60% - 69%
      // - Fortalezas: 70% - 100%
      const strengths = topicAnalyses
        .filter(topic => topic.percentage >= 70)
        .map(topic => topic.name);
      
      const weaknesses = topicAnalyses
        .filter(topic => topic.percentage < 60)
        .map(topic => topic.name);
      
      const neutrals = topicAnalyses
        .filter(topic => topic.percentage >= 60 && topic.percentage < 70)
        .map(topic => topic.name);
      
      // Validación: todos los temas deben estar clasificados en alguna categoría
      const classifiedTopics = strengths.length + weaknesses.length + neutrals.length;
      if (classifiedTopics !== topicAnalyses.length) {
        console.warn(`⚠️ Algunos temas no fueron clasificados correctamente en ${subject}. Total temas: ${topicAnalyses.length}, Clasificados: ${classifiedTopics}`);
      }

        return {
          name: subject,
          percentage: subjectPercentage,
          topics: topicAnalyses,
          strengths,
          weaknesses,
          neutrals
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
        // Usar tiempo de questionDetails si está disponible, sino usar tiempo total del examen
        timeSpent: totalQuestionsWithTime > 0 
          ? (totalTimeFromQuestions / totalQuestionsWithTime) / 60 // Promedio por pregunta en minutos (desde segundos)
          : totalTimeSpent / 60, // Fallback: tiempo total en minutos
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
        securityIssues,
        luckPercentage: totalAnswersWithTime > 0 ? Math.round((luckAnswers / totalAnswersWithTime) * 100) : 0
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
        securityIssues: 0,
        luckPercentage: 0
      },
      recommendations: []
    };
  };

  /**
   * Calcula datos consolidados para "Todas las Fases"
   * PROMEDIA el puntaje global de las 3 fases
   */
  const calculateAllPhasesData = (
    phase1: AnalysisData | null,
    phase2: AnalysisData | null,
    phase3: AnalysisData | null,
    user: any
  ): AnalysisData => {
    const phases = [phase1, phase2, phase3].filter(p => p !== null) as AnalysisData[];
    
    if (phases.length === 0) {
      return getEmptyAnalysisData(user);
    }

    // Normalizar nombres de materias
    const normalizeSubjectName = (subject: string): string => {
      const normalized = subject.trim().toLowerCase();
      const subjectMap: Record<string, string> = {
        'biologia': 'Biologia',
        'biología': 'Biologia',
        'quimica': 'Quimica',
        'química': 'Quimica',
        'fisica': 'Física',
        'física': 'Física',
        'matematicas': 'Matemáticas',
        'matemáticas': 'Matemáticas',
        'lenguaje': 'Lenguaje',
        'ciencias sociales': 'Ciencias Sociales',
        'sociales': 'Ciencias Sociales',
        'ingles': 'Inglés',
        'inglés': 'Inglés',
      };
      return subjectMap[normalized] || subject;
    };

    // ✅ CORRECCIÓN: Promediar el puntaje global de las 3 fases
    const globalScores = phases.map(p => p.overall.score);
    const globalScore = globalScores.reduce((sum, score) => sum + score, 0) / globalScores.length;

    // Agrupar materias por nombre y promediar su rendimiento
    const subjectAverages: { [subject: string]: number[] } = {};
    
    phases.forEach(phase => {
      phase.subjects.forEach(subject => {
        const normalized = normalizeSubjectName(subject.name);
        if (!subjectAverages[normalized]) {
          subjectAverages[normalized] = [];
        }
        subjectAverages[normalized].push(subject.percentage);
      });
    });

    // Consolidar métricas
    const totalQuestions = phases.reduce((sum, p) => sum + p.overall.totalQuestions, 0);
    const totalAnswered = phases.reduce((sum, p) => sum + p.overall.questionsAnswered, 0);
    const totalTimeSpent = phases.reduce((sum, p) => sum + p.overall.timeSpent * p.overall.totalQuestions, 0);
    const securityIssues = phases.reduce((sum, p) => sum + p.patterns.securityIssues, 0);
    // Calcular promedio de porcentaje de suerte entre todas las fases
    const luckPercentages = phases.map(p => p.patterns.luckPercentage);
    const avgLuckPercentage = luckPercentages.length > 0 
      ? Math.round(luckPercentages.reduce((sum, p) => sum + p, 0) / luckPercentages.length)
      : 0;

    // Calcular materias únicas completadas
    const completedSubjects = new Set<string>();
    phases.forEach(phase => {
      phase.subjects.forEach(subject => {
        completedSubjects.add(normalizeSubjectName(subject.name));
      });
    });

    // Combinar subjectsWithTopics de todas las fases
    const allSubjectsWithTopics: SubjectWithTopics[] = [];
    Object.keys(subjectAverages).forEach(subjectName => {
      // Buscar esta materia en cada fase
      const phase1Subject = phase1?.subjectsWithTopics?.find(s => normalizeSubjectName(s.name) === subjectName);
      const phase2Subject = phase2?.subjectsWithTopics?.find(s => normalizeSubjectName(s.name) === subjectName);
      const phase3Subject = phase3?.subjectsWithTopics?.find(s => normalizeSubjectName(s.name) === subjectName);

      // Obtener todos los temas únicos
      const allTopics = new Set<string>();
      [phase1Subject, phase2Subject, phase3Subject].forEach(phase => {
        phase?.topics.forEach(t => allTopics.add(t.name));
      });

      // Crear array de temas con promedios
      const topics: TopicAnalysis[] = Array.from(allTopics).map(topicName => {
        const topicPercentages: number[] = [];
        let totalCorrect = 0;
        let totalQuestions = 0;

        [phase1Subject, phase2Subject, phase3Subject].forEach(phase => {
          const topic = phase?.topics.find(t => t.name === topicName);
          if (topic) {
            topicPercentages.push(topic.percentage);
            totalCorrect += topic.correct;
            totalQuestions += topic.total;
          }
        });

        const avgPercentage = topicPercentages.length > 0
          ? Math.round(topicPercentages.reduce((sum, p) => sum + p, 0) / topicPercentages.length)
          : 0;

        return {
          name: topicName,
          percentage: avgPercentage,
          correct: totalCorrect,
          total: totalQuestions
        };
      });

      // Calcular promedio de la materia
      const subjectAvgPercentage = Math.round(
        subjectAverages[subjectName].reduce((sum, p) => sum + p, 0) / subjectAverages[subjectName].length
      );

      // Clasificar temas
      // Rangos mutuamente excluyentes: Debilidades (< 60%), Intermedios (60-69%), Fortalezas (>= 70%)
      const strengths = topics.filter(t => t.percentage >= 70).map(t => t.name);
      const weaknesses = topics.filter(t => t.percentage < 60).map(t => t.name);
      const neutrals = topics.filter(t => t.percentage >= 60 && t.percentage < 70).map(t => t.name);
      
      // Validación: todos los temas deben estar clasificados
      const classifiedTopics = strengths.length + weaknesses.length + neutrals.length;
      if (classifiedTopics !== topics.length) {
        console.warn(`⚠️ Algunos temas no fueron clasificados correctamente en ${subjectName} (consolidado). Total temas: ${topics.length}, Clasificados: ${classifiedTopics}`);
      }

      allSubjectsWithTopics.push({
        name: subjectName,
        percentage: subjectAvgPercentage,
        topics,
        strengths,
        weaknesses,
        neutrals
      });
    });

    // Ordenar materias
    const subjectOrder: Record<string, number> = {
      'Matemáticas': 1,
      'Lenguaje': 2,
      'Ciencias Sociales': 3,
      'Biologia': 4,
      'Quimica': 5,
      'Física': 6,
      'Inglés': 7
    };
    allSubjectsWithTopics.sort((a, b) => {
      const orderA = subjectOrder[a.name] || 999;
      const orderB = subjectOrder[b.name] || 999;
      return orderA - orderB;
    });

    // Crear subjects para compatibilidad
    const subjects: SubjectAnalysis[] = allSubjectsWithTopics.map(subject => ({
      name: subject.name,
      score: subject.percentage,
      maxScore: 100,
      correct: subject.topics.reduce((sum, t) => sum + t.correct, 0),
      total: subject.topics.reduce((sum, t) => sum + t.total, 0),
      timeSpent: 0,
      percentage: subject.percentage,
      strengths: subject.strengths,
      weaknesses: subject.weaknesses,
      improvement: ''
    }));

    const avgPercentage = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
    const bestSubject = subjects.reduce((best, current) => current.percentage > best.percentage ? current : best, subjects[0]);
    const worstSubject = subjects.reduce((worst, current) => current.percentage < worst.percentage ? current : worst, subjects[0]);

    return {
      student: {
        name: user?.displayName || user?.email || "Usuario",
        id: user?.uid?.substring(0, 8) || "N/A",
        testDate: new Date().toLocaleDateString('es-ES'),
        testType: `${phases.length} Fases Completadas`
      },
      overall: {
        score: Math.round(globalScore),
        percentile: Math.min(95, Math.max(5, avgPercentage + Math.random() * 20 - 10)),
        phasePercentage: Math.round((completedSubjects.size / 7) * 100),
        currentPhase: 'III',
        timeSpent: totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0,
        questionsAnswered: totalAnswered,
        totalQuestions,
        averagePercentage: avgPercentage
      },
      subjects,
      subjectsWithTopics: allSubjectsWithTopics,
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
        securityIssues,
        luckPercentage: avgLuckPercentage
      },
      recommendations: generateBasicRecommendations(subjects)
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

  // Lista de las 7 materias requeridas
  const ALL_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];

  // Función para verificar si una fase tiene las 7 materias completadas
  const isPhaseComplete = (phaseData: AnalysisData | null): boolean => {
    if (!phaseData || !phaseData.subjects || phaseData.subjects.length === 0) {
      return false;
    }
    const subjectsInPhase = new Set(phaseData.subjects.map(s => s.name));
    return ALL_SUBJECTS.every(subject => subjectsInPhase.has(subject));
  };

  // Verificar qué fases están completas
  const phase1Complete = isPhaseComplete(phase1Data);
  const phase2Complete = isPhaseComplete(phase2Data);
  const phase3Complete = isPhaseComplete(phase3Data);

  // Obtener fases completas disponibles
  const availablePhases = [
    ...(phase1Complete ? ['first' as const] : []),
    ...(phase2Complete ? ['second' as const] : []),
    ...(phase3Complete ? ['third' as const] : []),
  ];

  const handleExportPDFClick = () => {
    // Resetear selecciones al abrir el modal
    setSelectedPhasesForPDF([]);
    setIsPDFPhaseDialogOpen(true);
  };


  const handlePhaseToggle = (phase: 'first' | 'second' | 'third') => {
    setSelectedPhasesForPDF(prev => {
      if (prev.includes(phase)) {
        return prev.filter(p => p !== phase);
      } else {
        return [...prev, phase];
      }
    });
  };

  const handleSelectAllPhases = () => {
    if (selectedPhasesForPDF.length === availablePhases.length) {
      // Si todas están seleccionadas, deseleccionar todas
      setSelectedPhasesForPDF([]);
    } else {
      // Seleccionar todas las fases disponibles
      setSelectedPhasesForPDF([...availablePhases]);
    }
  };

  // Función helper para obtener evaluaciones de una fase específica
  const getPhaseEvaluations = async (studentId: string, phase: 'first' | 'second' | 'third'): Promise<any[]> => {
    const phaseVariants: Record<string, string[]> = {
      first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
      second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
      third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
    };

    const evaluations: any[] = [];
    const phaseNames = phaseVariants[phase] || [];

    for (const phaseName of phaseNames) {
      try {
        const phaseRef = collection(db, "results", studentId, phaseName);
        const phaseSnap = await getDocs(phaseRef);
        
        if (!phaseSnap.empty) {
          phaseSnap.docs.forEach(doc => {
            const examData = doc.data();
            const isCompleted = examData.isCompleted !== false && examData.completed !== false;
            if (isCompleted && examData.subject) {
              evaluations.push({
                ...examData,
                examId: doc.id,
                phase: phase,
              });
            }
          });
        }
      } catch (error: any) {
        console.warn(`⚠️ Error buscando en fase ${phaseName}:`, error.message);
      }
    }

    return evaluations;
  };

  // Función helper para calcular métricas de una fase específica
  const calculatePhaseMetrics = (evaluations: any[]): {
    globalScore: number;
    phasePercentage: number;
    averageTimePerQuestion: number;
    fraudAttempts: number;
    luckPercentage: number;
    completedSubjects: number;
    totalQuestions: number;
  } => {
    const normalizeSubjectName = (subject: string): string => {
      const normalized = subject.trim().toLowerCase();
      const subjectMap: Record<string, string> = {
        'biologia': 'Biologia',
        'biología': 'Biologia',
        'quimica': 'Quimica',
        'química': 'Quimica',
        'fisica': 'Física',
        'física': 'Física',
        'matematicas': 'Matemáticas',
        'matemáticas': 'Matemáticas',
        'lenguaje': 'Lenguaje',
        'ciencias sociales': 'Ciencias Sociales',
        'sociales': 'Ciencias Sociales',
        'ingles': 'Inglés',
        'inglés': 'Inglés'
      };
      return subjectMap[normalized] || subject;
    };

    const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física'];
    const POINTS_PER_NATURALES_SUBJECT = 100 / 3;
    const POINTS_PER_REGULAR_SUBJECT = 100;
    const TOTAL_SUBJECTS = 7;

    let totalTimeFromQuestions = 0;
    let totalQuestionsWithTime = 0;
    let luckAnswers = 0;
    let totalAnswersWithTime = 0;
    let fraudAttempts = 0;
    let totalQuestions = 0;

    const subjectScores: { [key: string]: { percentage: number } } = {};
    const completedSubjectsSet = new Set<string>();

    evaluations.forEach(evalData => {
      const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '');
      
      // Calcular porcentaje
      let percentage = 0;
      if (evalData.score?.overallPercentage !== undefined) {
        percentage = evalData.score.overallPercentage;
      } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
        const total = evalData.score.totalQuestions;
        const correct = evalData.score.correctAnswers;
        percentage = total > 0 ? (correct / total) * 100 : 0;
        totalQuestions += total;
      } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
        const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length;
        const total = evalData.questionDetails.length;
        percentage = total > 0 ? (correct / total) * 100 : 0;
        totalQuestions += total;
      }

      // Guardar mejor puntaje de cada materia
      if (!subjectScores[subject] || percentage > subjectScores[subject].percentage) {
        subjectScores[subject] = { percentage };
      }

      // Contar materias completadas
      const validSubjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
      if (validSubjects.includes(subject)) {
        completedSubjectsSet.add(subject);
      }

      // Calcular tiempo y suerte desde questionDetails
      if (evalData.questionDetails && Array.isArray(evalData.questionDetails)) {
        evalData.questionDetails.forEach((question: any) => {
          if (question.timeSpent && question.timeSpent > 0) {
            totalTimeFromQuestions += question.timeSpent;
            totalQuestionsWithTime++;
            
            if (question.answered && subject !== 'Inglés') {
              totalAnswersWithTime++;
              if (question.timeSpent < 10) {
                luckAnswers++;
              }
            }
          }
        });
      }

      // Contar intentos de fraude
      // Se considera fraude si hay cambios de pestaña o si el examen fue bloqueado por cambio de pestaña
      if (evalData.tabChangeCount > 0 || evalData.lockedByTabChange === true) {
        fraudAttempts++;
      }
    });

    // Calcular puntaje global
    let globalScore = 0;
    Object.entries(subjectScores).forEach(([subject, data]) => {
      let pointsForSubject: number;
      if (NATURALES_SUBJECTS.includes(subject)) {
        pointsForSubject = (data.percentage / 100) * POINTS_PER_NATURALES_SUBJECT;
      } else {
        pointsForSubject = (data.percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
      }
      globalScore += pointsForSubject;
    });
    globalScore = Math.round(globalScore);

    // Calcular porcentaje de fase completada
    const phasePercentage = Math.round((completedSubjectsSet.size / TOTAL_SUBJECTS) * 100);

    // Calcular tiempo promedio por pregunta en minutos
    const averageTimePerQuestion = totalQuestionsWithTime > 0 
      ? (totalTimeFromQuestions / totalQuestionsWithTime) / 60 
      : 0;

    // Calcular porcentaje de suerte
    const luckPercentage = totalAnswersWithTime > 0 
      ? Math.round((luckAnswers / totalAnswersWithTime) * 100) 
      : 0;

    return {
      globalScore,
      phasePercentage,
      averageTimePerQuestion,
      fraudAttempts,
      luckPercentage,
      completedSubjects: completedSubjectsSet.size,
      totalQuestions
    };
  };

  // Función helper para obtener el trofeo y colores según el puesto
  const getRankTrophyAndColors = (rank: number) => {
    if (rank === 1) {
      return {
        trophy: '🏆',
        bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderColor: '#fbbf24',
        textColor: '#92400e',
        detailColor: '#78350f'
      };
    } else if (rank === 2) {
      return {
        trophy: '🥈',
        bgGradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        borderColor: '#94a3b8',
        textColor: '#475569',
        detailColor: '#334155'
      };
    } else if (rank === 3) {
      return {
        trophy: '🥉',
        bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
        borderColor: '#fb923c',
        textColor: '#9a3412',
        detailColor: '#7c2d12'
      };
    } else {
      return {
        trophy: '🏅',
        bgGradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
        borderColor: '#9ca3af',
        textColor: '#4b5563',
        detailColor: '#374151'
      };
    }
  };

const generatePhase1And2PDFHTML = (
    summary: any,
    studentName: string,
    studentId: string,
    institutionName: string,
    currentDate: Date,
    phaseName: string,
    phaseMetrics: {
      globalScore: number;
      phasePercentage: number;
      averageTimePerQuestion: number;
      fraudAttempts: number;
      luckPercentage: number;
      completedSubjects: number;
      totalQuestions: number;
    },
    studentRank: number | null,
    totalStudents: number | null,
    subjectScores: Array<{ name: string; score: number; percentage: number }>
  ): string => {
    // Convertir tiempo promedio a formato legible (0.1m)
    const timeMinutes = phaseMetrics.averageTimePerQuestion.toFixed(1);
    
    // Arrays de frases filosóficas y versículos bíblicos
    const philosophicalQuotes = [
      { quote: "La excelencia no es un acto, sino un hábito. Somos lo que repetidamente hacemos.", author: "Aristóteles" },
      { quote: "El único modo de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
      { quote: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
      { quote: "No te preocupes por los fracasos, preocúpate por las oportunidades que pierdes cuando ni siquiera lo intentas.", author: "Jack Canfield" },
      { quote: "La diferencia entre lo imposible y lo posible reside en la determinación de una persona.", author: "Tommy Lasorda" },
      { quote: "El único lugar donde el éxito viene antes que el trabajo es en el diccionario.", author: "Vidal Sassoon" },
      { quote: "El futuro pertenece a aquellos que creen en la belleza de sus sueños.", author: "Eleanor Roosevelt" },
      { quote: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", author: "Nelson Mandela" },
      { quote: "El aprendizaje nunca agota la mente.", author: "Leonardo da Vinci" },
      { quote: "No esperes el momento perfecto, comienza ahora. Hazlo ahora.", author: "George Herbert" }
    ];
    
    const bibleVerses = [
      { verse: "Todo lo puedo en Cristo que me fortalece.", reference: "Filipenses 4:13" },
      { verse: "El Señor es mi fortaleza y mi escudo; en él confía mi corazón.", reference: "Salmos 28:7" },
      { verse: "Con Dios todas las cosas son posibles.", reference: "Mateo 19:26" },
      { verse: "El Señor te bendecirá y te guardará.", reference: "Números 6:24" },
      { verse: "Fíate del Señor de todo corazón, y no te apoyes en tu propia prudencia.", reference: "Proverbios 3:5" },
      { verse: "Porque yo sé los planes que tengo para ti... planes de bienestar y no de mal, para darte un futuro y una esperanza.", reference: "Jeremías 29:11" },
      { verse: "Encomienda al Señor tu camino, confía en él, y él actuará.", reference: "Salmos 37:5" },
      { verse: "El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.", reference: "Filipenses 1:6" },
      { verse: "Esforzaos y cobrad ánimo; no temáis ni os intimidéis, porque el Señor tu Dios está contigo.", reference: "Josué 1:9" }
    ];
    
    // Función simple para generar un índice determinístico basado en studentId
    const getIndex = (str: string, arrayLength: number): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) % arrayLength;
    };
    
    // Seleccionar frase y versículo basado en studentId
    const selectedQuote = philosophicalQuotes[getIndex(studentId, philosophicalQuotes.length)];
    const selectedVerse = bibleVerses[getIndex(studentId + 'verse', bibleVerses.length)];
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        <title>Resumen Académico - ${phaseName} - ${studentName}</title>
          <style>
              @page {
            size: Letter;
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
              }
          * {
                margin: 0;
            padding: 0;
            box-sizing: border-box;
            }
            body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
          }
          .pdf-container {
            width: 100%;
            max-width: 17cm;
              margin: 0 auto;
            }
            .header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 15px;
            border-top: 3px solid #1e40af;
            border-bottom: 3px solid #1e40af;
            padding: 12px;
            margin-bottom: 15px;
            position: relative;
          }
          .header-logo {
            width: 100px;
            height: 100px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .header-text {
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 130px);
          }
          .header-text h1 {
            font-size: 19pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
            text-align: center;
          }
          .header-text .subtitle {
            font-size: 11pt;
            color: #1e40af;
            font-weight: bold;
            text-align: center;
          }
          .student-info {
            background-color: #f3f4f6;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            margin-bottom: 15px;
            font-size: 8pt;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px 15px;
          }
          .student-info p {
            margin: 0;
            line-height: 1.4;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .metric-card {
            background-color: transparent;
            color: #000;
            padding: 6px;
            border: 2px solid #1e40af;
            border-radius: 6px;
            position: relative;
            min-width: 0;
          }
          .metric-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
            gap: 4px;
          }
          .metric-card-title {
            font-size: 6pt;
            font-weight: bold;
            color: #374151;
            line-height: 1.2;
            flex: 1;
          }
          .metric-card-icon {
            font-size: 11pt;
            flex-shrink: 0;
          }
          .metric-card-value {
            font-size: 15pt;
            font-weight: bold;
            margin-bottom: 3px;
            line-height: 1;
          }
          .metric-card-detail {
            background-color: #f3f4f6;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 5pt;
            border: 1px solid #d1d5db;
            line-height: 1.2;
            word-wrap: break-word;
            color: #6b7280;
          }
          .metric-card-value.global {
            color: #1e40af;
          }
          .metric-card-value.rank {
            color: #3b82f6;
          }
          .metric-card-value.time {
            color: #1e40af;
          }
          .metric-card-value.fraud {
            color: #ef4444;
          }
          .metric-card-value.luck {
            color: #f59e0b;
          }
          .subject-scores-box {
            border: 2px solid #1e40af;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 15px;
            background-color: #f9fafb;
            page-break-inside: avoid;
          }
          .subject-scores-title {
            font-size: 11pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
            text-align: center;
          }
          .subject-scores-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
          }
          .subject-score-item {
            text-align: center;
            padding: 6px 4px;
            background-color: #fff;
            border: 1px solid #d1d5db;
            border-radius: 4px;
          }
          .subject-score-name {
            font-size: 6pt;
            font-weight: bold;
            color: #374151;
            margin-bottom: 3px;
            line-height: 1.2;
            word-break: break-word;
            hyphens: auto;
            text-align: center;
          }
          .subject-score-value {
            font-size: 13pt;
            font-weight: bold;
            color: #1e40af;
            line-height: 1;
          }
            .section {
              margin-bottom: 20px;
            page-break-inside: avoid;
            }
            .section h2 {
            font-size: 15pt;
            font-weight: bold;
              color: #1e40af;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .section h3 {
            font-size: 13pt;
            font-weight: bold;
              color: #3b82f6;
              margin-top: 15px;
              margin-bottom: 8px;
            }
            .section p {
              text-align: justify;
              margin-bottom: 12px;
            font-size: 10pt;
            }
            ul, ol {
            margin-left: 25px;
              margin-bottom: 12px;
            }
            li {
              margin-bottom: 6px;
            font-size: 10pt;
          }
          .fortalezas {
            background-color: #d1fae5;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #10b981;
            page-break-inside: avoid;
          }
          .mejoras {
            background-color: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            page-break-inside: avoid;
          }
          .recomendaciones {
            background-color: #dbeafe;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
            page-break-inside: avoid;
            }
          .metadata {
            background-color: #f3f4f6;
            padding: 15px;
            border: 1px solid #d1d5db;
            margin-top: 30px;
            font-size: 9pt;
            color: #4b5563;
            page-break-inside: avoid;
          }
          .inspirational-section {
            margin-top: 25px;
            text-align: center;
            padding: 15px 15px;
            page-break-inside: avoid;
          }
          .philosophical-quote {
            font-style: italic;
            font-size: 10pt;
            color: #374151;
            margin-bottom: 15px;
            line-height: 1.6;
            font-family: Georgia, serif;
          }
          .bible-verse {
            font-size: 11pt;
            color: #1e40af;
            font-weight: bold;
            font-style: italic;
            line-height: 1.6;
            margin-top: 10px;
          }
          .inspirational-section {
            margin-top: 25px;
            text-align: center;
            padding: 15px 15px;
            page-break-inside: avoid;
          }
          .philosophical-quote {
            font-style: italic;
            font-size: 10pt;
            color: #374151;
            margin-bottom: 15px;
            line-height: 1.6;
            font-family: Georgia, serif;
          }
          .bible-verse {
            font-size: 11pt;
            color: #1e40af;
            font-weight: bold;
            font-style: italic;
            line-height: 1.6;
            margin-top: 10px;
          }
          .page-break {
            page-break-before: always;
          }
          @media print {
            .page-break {
              page-break-before: always;
            }
            .section {
              page-break-inside: avoid;
            }
            .metrics-grid {
              page-break-inside: avoid;
              grid-template-columns: repeat(5, 1fr);
            }
          }
        </style>
      </head>
      <body>
        <div class="pdf-container">
          <!-- Encabezado con Logo -->
          <div class="header">
            <img src="/assets/cerebro_negro.png" alt="SUPERATE.IA" class="header-logo" onerror="this.style.display='none'; this.nextElementSibling.style.marginLeft='0';" />
            <div class="header-text">
              <h1>SUPERATE.IA</h1>
              <div class="subtitle">REPORTE DE RESULTADOS ESTUDIANTE</div>
            </div>
          </div>

          <!-- Información del Estudiante -->
          <div class="student-info">
            <p><strong>${phaseName === 'Fase I' ? 'Fase I - Diagnóstico de Habilidades Académicas' : phaseName === 'Fase II' ? 'Fase II - Refuerzo Personalizado' : 'Fase III - Simulacro ICFES'}</strong></p>
            <p><strong>Fecha de publicación de resultados:</strong> ${currentDate.toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }).toUpperCase()}</p>
            <p><strong>Apellidos y nombres:</strong> ${studentName.toUpperCase()}</p>
            <p><strong>Institución educativa:</strong> ${institutionName || 'No especificada'}</p>
            ${summary.contextoAcademico?.grado ? `<p><strong>Grado:</strong> ${summary.contextoAcademico.grado}</p>` : ''}
          </div>

          <!-- Tarjetas de Métricas -->
          <div class="metrics-grid">
            <!-- Puntaje Global -->
            <div class="metric-card global">
              <div class="metric-card-header">
                <div class="metric-card-title">Puntaje Global</div>
                <div class="metric-card-icon">🏅</div>
              </div>
              <div class="metric-card-value global">${phaseMetrics.globalScore}</div>
              <div class="metric-card-detail">De 500 puntos</div>
            </div>

            <!-- Puesto entre estudiantes -->
            <div class="metric-card rank">
              <div class="metric-card-header">
                <div class="metric-card-title">Puesto</div>
                <div class="metric-card-icon">📊</div>
              </div>
              <div class="metric-card-value rank">${studentRank !== null && totalStudents !== null ? `${studentRank}°` : 'N/A'}</div>
              <div class="metric-card-detail">${studentRank !== null && totalStudents !== null ? `De ${totalStudents} estudiantes` : 'No disponible'}</div>
            </div>

            <!-- Tiempo Promedio por Pregunta -->
            <div class="metric-card time">
              <div class="metric-card-header">
                <div class="metric-card-title">Tiempo Promedio</div>
                <div class="metric-card-icon">⏱️</div>
              </div>
              <div class="metric-card-value time">${timeMinutes}m</div>
              <div class="metric-card-detail">Por pregunta</div>
            </div>

            <!-- Intento de Fraude -->
            <div class="metric-card fraud">
              <div class="metric-card-header">
                <div class="metric-card-title">Intento de fraude</div>
                <div class="metric-card-icon">🛡️</div>
              </div>
              <div class="metric-card-value fraud">${phaseMetrics.fraudAttempts}</div>
              <div class="metric-card-detail">${phaseMetrics.fraudAttempts === 1 ? '1 evaluación' : `${phaseMetrics.fraudAttempts} evaluaciones`}</div>
            </div>

            <!-- Porcentaje de Suerte -->
            <div class="metric-card luck">
              <div class="metric-card-header">
                <div class="metric-card-title">Porcentaje de Suerte</div>
                <div class="metric-card-icon">⚡</div>
              </div>
              <div class="metric-card-value luck">${phaseMetrics.luckPercentage}%</div>
              <div class="metric-card-detail">${phaseMetrics.luckPercentage >= 50 ? 'Muchas rápidas' : phaseMetrics.luckPercentage >= 20 ? 'Algunas rápidas' : 'Pocas rápidas'}</div>
            </div>
          </div>

          <!-- Puntajes por Materia -->
          <div class="subject-scores-box">
            <div class="subject-scores-title">Puntaje por Materia</div>
            <div class="subject-scores-grid">
              ${subjectScores.map(subj => `
                <div class="subject-score-item">
                  <div class="subject-score-name">${subj.name}</div>
                  <div class="subject-score-value">${subj.score}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Resumen General -->
          <div class="section">
            <h2>Resumen General</h2>
            <p>${summary.resumen.resumen_general}</p>
          </div>

          <!-- Diagnóstico de Desempeño Académico -->
          <div class="section">
            <h2>Diagnóstico de Desempeño Académico</h2>
            ${(() => {
              // Verificar si analisis_competencial es un objeto (estructura nueva) o string (backward compatibility)
              if (typeof summary.resumen.analisis_competencial === 'object' && summary.resumen.analisis_competencial !== null) {
                // Estructura nueva: objeto por materias
                const analisisPorMaterias = summary.resumen.analisis_competencial as { [materia: string]: string };
                return subjectScores.map(subj => {
                  // Buscar el análisis de esta materia (probando diferentes variaciones del nombre)
                  const analisisMateria = analisisPorMaterias[subj.name] || 
                                         analisisPorMaterias[subj.name.toLowerCase()] ||
                                         Object.entries(analisisPorMaterias).find(([key]) => 
                                           key.toLowerCase() === subj.name.toLowerCase()
                                         )?.[1] || '';
                  if (analisisMateria) {
                    return `
                      <div style="margin-bottom: 15px;">
                        <h3 style="font-size: 12pt; font-weight: bold; color: #1e40af; margin-bottom: 8px;">${subj.name}:</h3>
                        <p style="text-align: justify; line-height: 1.6;">${analisisMateria}</p>
                      </div>
                    `;
                  }
                  return '';
                }).filter(html => html).join('');
              } else {
                // Backward compatibility: si es string, mostrar el texto completo
                return `<p style="text-align: justify; line-height: 1.6;">${summary.resumen.analisis_competencial}</p>`;
              }
            })()}
          </div>

          <!-- Fortalezas Académicas -->
          <div class="section fortalezas">
            <h3>Fortalezas Académicas</h3>
            <ul>
              ${summary.resumen.fortalezas_academicas.map((f: string) => `<li>${f}</li>`).join('')}
            </ul>
          </div>

          <!-- Aspectos por Mejorar -->
          <div class="section mejoras">
            <h3>Aspectos por Mejorar</h3>
            <ul>
              ${summary.resumen.aspectos_por_mejorar.map((a: string) => `<li>${a}</li>`).join('')}
            </ul>
          </div>

          <!-- Recomendaciones -->
          <div class="section recomendaciones">
            <h3>Recomendaciones - Enfoque Saber 11</h3>
            <ul>
              ${summary.resumen.recomendaciones_enfoque_saber11.map((r: string) => `<li>${r}</li>`).join('')}
            </ul>
          </div>

          ${summary.metricasGlobales ? `
          <!-- Métricas de Desempeño -->
          <div class="section">
            <h2>Métricas de Desempeño</h2>
            <p><strong>Nivel general:</strong> ${summary.metricasGlobales.nivelGeneralDesempeno}</p>
            ${summary.metricasGlobales.materiasFuertes.length > 0 ? `
              <p><strong>Materias con desempeño favorable:</strong> ${summary.metricasGlobales.materiasFuertes.join(', ')}</p>
            ` : ''}
            ${summary.metricasGlobales.materiasDebiles.length > 0 ? `
              <p><strong>Materias que requieren fortalecimiento:</strong> ${summary.metricasGlobales.materiasDebiles.join(', ')}</p>
            ` : ''}
          </div>
          ` : ''}

          <!-- Frase Inspiradora -->
          <div class="inspirational-section">
            <div class="philosophical-quote">
              "${selectedQuote.quote}"
            </div>
            <div class="bible-verse">
              "${selectedVerse.verse}"<br>
              <span style="font-size: 8pt; color: #6b7280;">${selectedVerse.reference}</span>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `;
  };

  // Función helper para generar HTML del PDF para Fase III
  const generatePhase3PDFHTML = (
    summary: any,
    studentName: string,
    studentId: string,
    institutionName: string,
    currentDate: Date,
    sortedSubjects: any[],
    globalScore: number,
    _globalPercentile: number,
    phase1Subjects?: Array<{ name: string; percentage: number }>,
    phase2Subjects?: Array<{ name: string; percentage: number }>,
    _phaseMetrics?: { averageTimePerQuestion: number; fraudAttempts: number; luckPercentage: number },
    studentRank?: number | null,
    totalStudents?: number | null
  ): string => {
    // Arrays de frases filosóficas y versículos bíblicos
    const philosophicalQuotes = [
      { quote: "La excelencia no es un acto, sino un hábito. Somos lo que repetidamente hacemos.", author: "Aristóteles" },
      { quote: "El único modo de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
      { quote: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
      { quote: "No te preocupes por los fracasos, preocúpate por las oportunidades que pierdes cuando ni siquiera lo intentas.", author: "Jack Canfield" },
      { quote: "La diferencia entre lo imposible y lo posible reside en la determinación de una persona.", author: "Tommy Lasorda" },
      { quote: "El único lugar donde el éxito viene antes que el trabajo es en el diccionario.", author: "Vidal Sassoon" },
      { quote: "El futuro pertenece a aquellos que creen en la belleza de sus sueños.", author: "Eleanor Roosevelt" },
      { quote: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", author: "Nelson Mandela" },
      { quote: "El aprendizaje nunca agota la mente.", author: "Leonardo da Vinci" },
      { quote: "No esperes el momento perfecto, comienza ahora. Hazlo ahora.", author: "George Herbert" }
    ];
    
    const bibleVerses = [
      { verse: "Todo lo puedo en Cristo que me fortalece.", reference: "Filipenses 4:13" },
      { verse: "El Señor es mi fortaleza y mi escudo; en él confía mi corazón.", reference: "Salmos 28:7" },
      { verse: "Con Dios todas las cosas son posibles.", reference: "Mateo 19:26" },
      { verse: "El Señor te bendecirá y te guardará.", reference: "Números 6:24" },
      { verse: "Fíate del Señor de todo corazón, y no te apoyes en tu propia prudencia.", reference: "Proverbios 3:5" },
      { verse: "Porque yo sé los planes que tengo para ti... planes de bienestar y no de mal, para darte un futuro y una esperanza.", reference: "Jeremías 29:11" },
      { verse: "Encomienda al Señor tu camino, confía en él, y él actuará.", reference: "Salmos 37:5" },
      { verse: "El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.", reference: "Filipenses 1:6" },
      { verse: "Esforzaos y cobrad ánimo; no temáis ni os intimidéis, porque el Señor tu Dios está contigo.", reference: "Josué 1:9" }
    ];
    
    // Función simple para generar un índice determinístico basado en studentId
    const getIndex = (str: string, arrayLength: number): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) % arrayLength;
    };
    
    // Seleccionar frase y versículo basado en studentId
    const selectedQuote = philosophicalQuotes[getIndex(studentId, philosophicalQuotes.length)];
    const selectedVerse = bibleVerses[getIndex(studentId + 'verse', bibleVerses.length)];

    // Preparar datos para las gráficas
    const phase3Subjects = sortedSubjects.map(s => ({ name: s.name, percentage: s.percentage }));
    
    // Función helper para generar SVG del gráfico de evolución
    const generateEvolutionChartSVG = () => {
      const width = 600;
      const height = 240;
      const margin = { top: 20, right: 30, bottom: 50, left: 50 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      
      const subjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
      // Colores similares a SubjectsProgressChart (HSL convertidos a hex aproximados)
      const colors = ['#3b82f6', '#9333ea', '#22c55e', '#fbbf24', '#ef4444', '#fb923c', '#06b6d4'];
      
      // Encontrar máximo valor
      const allValues = [
        ...(phase1Subjects || []).map(s => s.percentage),
        ...(phase2Subjects || []).map(s => s.percentage),
        ...phase3Subjects.map(s => s.percentage)
      ];
      const maxValue = Math.max(...allValues, 100);
      
      const getValue = (phase: 'phase1' | 'phase2' | 'phase3', subjectName: string) => {
        const data = phase === 'phase1' ? phase1Subjects : phase === 'phase2' ? phase2Subjects : phase3Subjects;
        if (!data) return null;
        const subject = data.find(s => s.name === subjectName);
        return subject ? subject.percentage : null;
      };
      
      const phasePositions = { phase1: chartWidth * 0.05, phase2: chartWidth * 0.5, phase3: chartWidth * 0.95 };
      const dataPositions = { phase1: chartWidth * 0.0, phase2: chartWidth * 0.5, phase3: chartWidth * 0.9 };
      const scaleY = (value: number) => chartHeight - (value / maxValue) * chartHeight;
      
      let lines = '';
      let dots = '';
      let labels = '';
      
      subjects.forEach((subject, subjectIndex) => {
        const color = colors[subjectIndex % colors.length];
        const points: Array<{ x: number; y: number; value: number | null }> = [];
        
        ['phase1', 'phase2', 'phase3'].forEach(phase => {
          const value = getValue(phase as 'phase1' | 'phase2' | 'phase3', subject);
          if (value !== null) {
            points.push({
              x: dataPositions[phase as keyof typeof dataPositions],
              y: scaleY(value),
              value
            });
          }
        });
        
        // Dibujar línea con curva suave (similar a monotone en Recharts)
        if (points.length > 1) {
          let path = `M ${points[0].x} ${points[0].y}`;
          for (let i = 1; i < points.length; i++) {
            const prevPoint = points[i - 1];
            const currPoint = points[i];
            // Usar curva de Bézier para línea más suave
            const cp1x = prevPoint.x + (currPoint.x - prevPoint.x) * 0.5;
            const cp1y = prevPoint.y;
            const cp2x = prevPoint.x + (currPoint.x - prevPoint.x) * 0.5;
            const cp2y = currPoint.y;
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currPoint.x} ${currPoint.y}`;
          }
          lines += `<path d="${path}" stroke="${color}" stroke-width="2" fill="none"/>`;
        }
        
        // Dibujar puntos (sin valores encima, igual que en diagnóstico)
        points.forEach(point => {
          if (point.value !== null) {
            dots += `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;
          }
        });
      });
      
      // Etiquetas de fases con color claro para fondo oscuro
      labels += `<text x="${phasePositions.phase1}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase I</text>`;
      labels += `<text x="${phasePositions.phase2}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase II</text>`;
      labels += `<text x="${phasePositions.phase3}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase III</text>`;
      
      // Grid lines con fondo oscuro
      let gridLines = '';
      for (let i = 0; i <= 5; i++) {
        const y = (chartHeight / 5) * i;
        const value = maxValue - (maxValue / 5) * i;
        gridLines += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#4b5563" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
        gridLines += `<text x="-10" y="${y + 4}" text-anchor="end" font-size="11" fill="#9ca3af" font-weight="500">${Math.round(value)}</text>`;
      }
      
      // Generar leyenda horizontal al final (debajo de las etiquetas de fase)
      const legendItems = subjects.map((subject, index) => {
        const color = colors[index % colors.length];
        // Distribuir uniformemente desde el inicio, con espacio para 7 materias
        // Ajustar para que todas las materias quepan, especialmente "Inglés"
        const availableWidth = width - margin.left - margin.right - 10; // Restar 10px para margen de seguridad
        const spacing = availableWidth / 6; // Dividir entre 6 espacios (7 materias = 6 espacios entre ellas)
        const x = margin.left + (index * spacing) + 2; // Empezar casi desde el borde izquierdo
        const y = margin.top + chartHeight + 42 + Math.floor(index / 7) * 18;
        return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>
                <text x="${x + 8}" y="${y + 4}" font-size="10" fill="#e5e7eb">${subject.length > 15 ? subject.substring(0, 15) + '...' : subject}</text>`;
      }).join('');
      
      return `<svg width="100%" height="${height + 40}" viewBox="0 0 ${width} ${height + 40}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="background-color: #2d2d2d; display: block; min-height: ${height + 40}px;">
        <rect width="100%" height="100%" fill="#2d2d2d"/>
        <g transform="translate(${margin.left},${margin.top})">
          ${gridLines}
          ${lines}
          ${dots}
          ${labels}
        </g>
        <g>${legendItems}</g>
      </svg>`;
    };
    
    // Generar gráfica de evolución si hay datos de fases anteriores
    const evolutionSVG = phase1Subjects && phase2Subjects ? generateEvolutionChartSVG() : null;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>REPORTE DE RESULTADOS ESTUDIANTE • SABER 11° - ${studentName}</title>
        <style>
          @page {
            size: Letter;
            margin: 2.5cm 2cm 2.5cm 2cm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
          }
          .pdf-container {
            width: 100%;
            max-width: 17cm;
            margin: 0 auto;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 15px;
            border-top: 3px solid #1e40af;
            border-bottom: 3px solid #1e40af;
            padding: 12px;
            margin-bottom: 15px;
            position: relative;
          }
          .header-logo {
            width: 100px;
            height: 100px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .header-text {
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 130px);
          }
          .header-text h1 {
            font-size: 19pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
            text-align: center;
          }
          .header-text .subtitle {
            font-size: 11pt;
            color: #1e40af;
            font-weight: bold;
            text-align: center;
          }
          .student-info {
            background-color: #f3f4f6;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            margin-bottom: 15px;
            font-size: 8pt;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px 15px;
          }
          .student-info p {
            margin: 0;
            line-height: 1.4;
          }
          .global-results {
            background-color: #eff6ff;
            padding: 10px 15px;
            border: 2px solid #3b82f6;
            border-radius: 8px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .global-score {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0;
            gap: 15px;
          }
          .global-score-left {
            flex: 1;
          }
          .global-score-label {
            font-size: 10pt;
            color: #374151;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .global-score-number {
            font-size: 32pt;
            font-weight: bold;
            color: #1e40af;
            line-height: 1;
            margin-bottom: 1px;
          }
          .global-score-detail {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 0;
          }
          .percentile-bar {
            padding: 10px;
            background-color: #fff;
            border: 1px solid #d1d5db;
            border-radius: 4px;
          }
          .percentile-label {
            font-size: 11pt;
            margin-bottom: 8px;
            font-weight: bold;
          }
          .percentile-scale {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #6b7280;
            margin-bottom: 5px;
          }
          .percentile-line {
            height: 8px;
            background: linear-gradient(to right, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%);
            position: relative;
            border: 1px solid #9ca3af;
          }
          .percentile-marker {
            position: absolute;
            top: -4px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 12px solid #000;
            transform: translateX(-8px);
          }
          .subject-results {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .subject-results h2 {
            font-size: 16pt;
            font-weight: bold;
            color: #1e40af;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10pt;
          }
          table th {
            background-color: #1e40af;
            color: #000;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            border-top: 1px solid #1e3a8a;
            border-bottom: 1px solid #1e3a8a;
            border-left: none;
            border-right: none;
          }
          table th:nth-child(2),
          table th:nth-child(3),
          table th:nth-child(4) {
            font-weight: normal;
            color: #000;
          }
          table td {
            padding: 10px 8px;
            border-top: 1px solid #d1d5db;
            border-bottom: 1px solid #d1d5db;
            border-left: none;
            border-right: none;
            vertical-align: middle;
          }
          table tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .subject-name {
            font-weight: bold;
            color: #1e40af;
            text-align: center;
          }
          .score-value {
            font-size: 11pt;
            font-weight: normal;
            color: #000;
          }
          .score-detail {
            font-size: 9pt;
            color: #6b7280;
          }
          .charts-container {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 20px;
            margin-bottom: 30px;
            page-break-inside: avoid;
            align-items: start;
          }
          .metrics-cards-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            flex: 1;
          }
          .metric-card {
            background-color: #fff;
            border: 1px solid #3b82f6;
            border-radius: 6px;
            padding: 8px;
            position: relative;
            min-width: 0;
          }
          .metric-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
            gap: 4px;
          }
          .metric-card-title {
            font-size: 7pt;
            font-weight: bold;
            color: #374151;
            line-height: 1.2;
            flex: 1;
          }
          .metric-card-icon {
            font-size: 14pt;
            flex-shrink: 0;
          }
          .metric-card-value {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 4px;
            line-height: 1;
          }
          .metric-card-value.rank {
            color: #3b82f6;
          }
          .metric-card-value.time {
            color: #1e40af;
          }
          .metric-card-value.fraud {
            color: #ef4444;
          }
          .metric-card-value.luck {
            color: #f59e0b;
          }
          .metric-card-detail {
            background-color: #f3f4f6;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 6pt;
            border: 1px solid #d1d5db;
            line-height: 1.2;
            word-wrap: break-word;
            color: #6b7280;
          }
          .chart-box {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 15px;
            background-color: #fff;
          }
          .chart-box.evolution-box {
            background-color: #2d2d2d !important;
            border: 0.5px solid #404040;
            border-radius: 4px;
            padding: 8px 0 0 0;
            margin: 0;
            width: 100%;
            overflow: hidden;
          }
          .chart-box.evolution-box .chart-title,
          .chart-box.evolution-box .chart-subtitle {
            padding: 0 8px;
            background-color: #2d2d2d;
            margin: 0;
          }
          .chart-box.evolution-box .chart-content {
            background-color: #2d2d2d !important;
            width: 100%;
            margin: 0;
            padding: 0;
            display: block;
            justify-content: stretch;
            align-items: stretch;
          }
          .chart-box.evolution-box .chart-content svg {
            display: block;
            width: 100%;
            height: auto;
            background-color: #2d2d2d !important;
            margin: 0;
            padding: 0;
          }
          .chart-box.evolution-box .chart-title {
            font-size: 10pt;
            font-weight: bold;
            color: #e5e7eb;
            margin-bottom: 4px;
            text-align: center;
          }
          .chart-box.evolution-box .chart-subtitle {
            font-size: 8pt;
            color: #9ca3af;
            margin-bottom: 8px;
            text-align: center;
          }
          .chart-title {
            font-size: 12pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 10px;
            text-align: center;
          }
          .chart-subtitle {
            font-size: 9pt;
            color: #6b7280;
            margin-bottom: 15px;
            text-align: center;
          }
          .chart-content {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section h2 {
            font-size: 16pt;
            font-weight: bold;
            color: #1e40af;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .section h3 {
            font-size: 14pt;
            font-weight: bold;
            color: #3b82f6;
            margin-top: 20px;
            margin-bottom: 10px;
          }
          .section p {
            text-align: justify;
            margin-bottom: 15px;
            font-size: 11pt;
          }
          ul, ol {
            margin-left: 25px;
            margin-bottom: 15px;
          }
          li {
            margin-bottom: 8px;
            font-size: 11pt;
            }
            .fortalezas {
              background-color: #d1fae5;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #10b981;
            page-break-inside: avoid;
            }
            .mejoras {
              background-color: #fef3c7;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #f59e0b;
            page-break-inside: avoid;
            }
            .recomendaciones {
              background-color: #dbeafe;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #3b82f6;
            page-break-inside: avoid;
          }
          .metadata {
            background-color: #f3f4f6;
            padding: 15px;
            border: 1px solid #d1d5db;
            margin-top: 30px;
            font-size: 10pt;
            color: #4b5563;
            page-break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
          }
          @media print {
            .page-break {
              page-break-before: always;
            }
            .section {
              page-break-inside: avoid;
            }
            }
          </style>
        </head>
        <body>
        <div class="pdf-container">
          <!-- Encabezado con Logo -->
          <div class="header">
            <img src="/assets/cerebro_negro.png" alt="SUPERATE.IA" class="header-logo" onerror="this.style.display='none'; this.nextElementSibling.style.marginLeft='0';" />
            <div class="header-text">
              <h1>SUPERATE.IA</h1>
              <div class="subtitle">REPORTE DE RESULTADOS ESTUDIANTE</div>
            </div>
          </div>

          <!-- Información del Estudiante -->
          <div class="student-info">
            <p><strong>Fase III - Simulacro ICFES</strong></p>
            <p><strong>Fecha de publicación de resultados:</strong> ${currentDate.toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }).toUpperCase()}</p>
            <p><strong>Apellidos y nombres:</strong> ${studentName.toUpperCase()}</p>
            <p><strong>Institución educativa:</strong> ${institutionName || 'No especificada'}</p>
            ${summary.contextoAcademico?.grado ? `<p><strong>Grado:</strong> ${summary.contextoAcademico.grado}</p>` : ''}
          </div>

          <!-- Resultado Final del Simulacro ICFES -->
          <div class="global-results">
            <div class="global-score">
              <div class="global-score-left">
                <div class="global-score-label">RESULTADO FINAL DEL SIMULACRO ICFES</div>
                <div class="global-score-number">${globalScore}</div>
                <div class="global-score-detail">De 500 puntos posibles, su puntaje global es ${globalScore}</div>
              </div>
              ${studentRank !== null && totalStudents !== null ? (() => {
                const currentRank = studentRank as number;
                const rankStyle = getRankTrophyAndColors(currentRank);
                return `
              <div style="flex: 0.8; margin-left: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${rankStyle.bgGradient}; border-radius: 12px; padding: 8px 16px; border: 2px solid ${rankStyle.borderColor}; transform: scale(0.8); transform-origin: center;">
                <div style="font-size: 26pt; margin-bottom: 6px;">${rankStyle.trophy}</div>
                <div style="font-weight: bold; font-size: 14pt; color: ${rankStyle.textColor}; margin-bottom: 3px;">Puesto ${currentRank}</div>
                <div style="font-size: 8pt; color: ${rankStyle.detailColor}; text-align: center;">de ${totalStudents} estudiantes de su grado</div>
              </div>
              `;
              })() : ''}
            </div>
          </div>

          <!-- Gráfica de Evolución por Materia -->
          ${evolutionSVG ? `
          <div class="chart-box evolution-box" style="margin: 0; width: 100%; background-color: #2d2d2d !important; padding: 8px 0 0 0;">
            <div class="chart-title" style="color: #e5e7eb; padding: 0 8px; margin: 0;">Evolución por Materia</div>
            <div class="chart-subtitle" style="color: #9ca3af; padding: 0 8px; margin: 0 0 4px 0;">7 materias evaluadas</div>
            <div class="chart-content" style="background-color: #2d2d2d !important; width: 100%; margin: 0; padding: 0;">
              ${evolutionSVG}
            </div>
          </div>
          ` : ''}

          <!-- Resultados por Prueba -->
          <div class="subject-results">
            <h2>RESULTADOS POR PRUEBA</h2>
            <table>
              <thead>
                <tr>
                  <th>PRUEBA</th>
                  <th>PUNTAJE</th>
                  <th>POSICIÓN EN EL GRUPO</th>
                  <th>NIVELES DE DESEMPEÑO</th>
                </tr>
              </thead>
              <tbody>
                ${sortedSubjects.map((subj: any) => {
                  const hasPosition = subj.position !== null && subj.totalStudentsInSubject !== null;
                  const positionText = hasPosition 
                    ? `Ranking: ${subj.position} / ${subj.totalStudentsInSubject}` 
                    : 'Ranking: N/A';
                  const performanceLevel = getPerformanceLevel(subj.percentage);
                  return `
                  <tr>
                    <td class="subject-name" style="text-align: center; vertical-align: middle;">${subj.name}</td>
                    <td style="text-align: center; vertical-align: middle;">
                      <div class="score-value">${subj.score}/100</div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <div style="font-size: 10pt; font-weight: normal; text-align: center; display: flex; align-items: center; justify-content: center; height: 100%;">
                        ${positionText}
                      </div>
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                      <div style="font-size: 9pt; font-weight: normal; text-align: center;">
                        <div style="font-weight: bold; margin-bottom: 3px;">${performanceLevel.level}</div>
                        <div style="font-size: 8pt; color: #4b5563;">${performanceLevel.definition}</div>
                      </div>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Salto de página -->
          <div class="page-break"></div>

          <!-- Resumen General -->
          <div class="section">
            <h2>Resumen General</h2>
            <p>${summary.resumen.resumen_general}</p>
          </div>

          <!-- Fortalezas Académicas -->
          <div class="section fortalezas">
            <h3>Fortalezas Académicas</h3>
            <ul>
              ${summary.resumen.fortalezas_academicas.map((f: string) => `<li>${f}</li>`).join('')}
            </ul>
          </div>

          <!-- Aspectos por Mejorar -->
          <div class="section mejoras">
            <h3>Aspectos por Mejorar</h3>
            <ul>
              ${summary.resumen.aspectos_por_mejorar.map((a: string) => `<li>${a}</li>`).join('')}
            </ul>
          </div>

          <!-- Recomendaciones -->
          <div class="section recomendaciones">
            <h3>Recomendaciones - Enfoque Saber 11</h3>
            <ul>
              ${summary.resumen.recomendaciones_enfoque_saber11.map((r: string) => `<li>${r}</li>`).join('')}
            </ul>
          </div>

          ${summary.metricasGlobales ? `
          <!-- Métricas de Desempeño -->
          <div class="section">
            <h2>Métricas de Desempeño</h2>
            <p><strong>Nivel general:</strong> ${summary.metricasGlobales.nivelGeneralDesempeno}</p>
            ${summary.metricasGlobales.materiasFuertes.length > 0 ? `
              <p><strong>Materias con desempeño favorable:</strong> ${summary.metricasGlobales.materiasFuertes.join(', ')}</p>
            ` : ''}
            ${summary.metricasGlobales.materiasDebiles.length > 0 ? `
              <p><strong>Materias que requieren fortalecimiento:</strong> ${summary.metricasGlobales.materiasDebiles.join(', ')}</p>
            ` : ''}
          </div>
          ` : ''}

          <!-- Frase Inspiradora -->
          <div class="inspirational-section">
            <div class="philosophical-quote">
              "${selectedQuote.quote}"
            </div>
            <div class="bible-verse">
              "${selectedVerse.verse}"<br>
              <span style="font-size: 8pt; color: #6b7280;">${selectedVerse.reference}</span>
            </div>
          </div>

          <!-- Metadatos -->
          <div class="metadata">
            <p><strong>Información del reporte:</strong></p>
            <p>Materias analizadas: ${summary.metadata.materiasAnalizadas} de 7</p>
            <p>Modelo de IA: ${summary.metadata.modeloIA}</p>
            <p>Versión: ${summary.version}</p>
          </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
        </html>
      `;
  };

  // Función helper para determinar el nivel de desempeño basado en el puntaje
  const getPerformanceLevel = (score: number): { level: string; definition: string } => {
    if (score >= 80) {
      return {
        level: 'Nivel Alto',
        definition: 'Demuestra dominio adecuado de las competencias evaluadas.'
      };
    } else if (score >= 60) {
      return {
        level: 'Nivel Medio',
        definition: 'Evidencia comprensión adecuada de los contenidos evaluados con algunas áreas de mejora.'
      };
    } else if (score >= 40) {
      return {
        level: 'Nivel Básico',
        definition: 'Evidencia comprensión parcial de los contenidos fundamentales.'
      };
    } else {
      return {
        level: 'Nivel Bajo',
        definition: 'Requiere refuerzo en los contenidos fundamentales de la materia.'
      };
    }
  };

  // Función helper para calcular percentil aproximado basado en puntaje (0-100)
  const calculatePercentile = (score: number): number => {
    // Aproximación simple: asumimos distribución normal
    // Esta es una aproximación, no el percentil real del país
    if (score >= 90) return 95;
    if (score >= 85) return 90;
    if (score >= 80) return 85;
    if (score >= 75) return 78;
    if (score >= 70) return 70;
    if (score >= 65) return 62;
    if (score >= 60) return 55;
    if (score >= 55) return 47;
    if (score >= 50) return 40;
    if (score >= 45) return 33;
    if (score >= 40) return 27;
    if (score >= 35) return 20;
    if (score >= 30) return 15;
    return Math.max(5, Math.round(score / 2));
  };

  // Función helper para calcular la posición por materia respecto a compañeros del mismo grado
  const calculateSubjectRanks = async (
    studentId: string,
    subjectScores: { [key: string]: { score: number; percentage: number } }
  ): Promise<{ [subjectName: string]: { position: number; totalStudents: number } }> => {
    try {
      // Obtener datos del estudiante actual
      const userResult = await getUserById(studentId);
      if (!userResult.success || !userResult.data) {
        return {};
      }

      const studentData = userResult.data as any;
      const institutionId = studentData.inst || studentData.institutionId;
      const campusId = studentData.campus || studentData.campusId;
      const gradeId = studentData.grade || studentData.gradeId;

      if (!institutionId || !campusId || !gradeId) {
        return {};
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
        return {};
      }

      const classmates = studentsResult.data;
      const subjectRanks: { [subjectName: string]: { position: number; totalStudents: number } } = {};

      // Normalizar nombres de materias
      const normalizeSubjectName = (subject: string): string => {
        const normalized = subject.trim().toLowerCase();
        const subjectMap: Record<string, string> = {
          'biologia': 'Biologia',
          'biología': 'Biologia',
          'quimica': 'Quimica',
          'química': 'Quimica',
          'fisica': 'Física',
          'física': 'Física',
          'matematicas': 'Matemáticas',
          'matemáticas': 'Matemáticas',
          'lenguaje': 'Lenguaje',
          'ciencias sociales': 'Ciencias Sociales',
          'sociales': 'Ciencias Sociales',
          'ingles': 'Inglés',
          'inglés': 'Inglés'
        };
        return subjectMap[normalized] || subject;
      };

      // Para cada materia, calcular la posición del estudiante
      for (const [subjectName, currentScore] of Object.entries(subjectScores)) {
        const subjectScoresList: { studentId: string; score: number }[] = [];

        // Obtener puntajes de todos los compañeros para esta materia
        for (const classmate of classmates) {
          const classmateId = (classmate as any).id || (classmate as any).uid;
          if (classmateId) {
            try {
              const evaluations = await getPhaseEvaluations(classmateId, 'third');
              let bestScore = 0;

              evaluations.forEach(evalData => {
                const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '');
                if (subject === subjectName) {
                  let percentage = 0;
                  if (evalData.score?.overallPercentage !== undefined) {
                    percentage = evalData.score.overallPercentage;
                  } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
                    const total = evalData.score.totalQuestions;
                    const correct = evalData.score.correctAnswers;
                    percentage = total > 0 ? (correct / total) * 100 : 0;
                  } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
                    const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length;
                    const total = evalData.questionDetails.length;
                    percentage = total > 0 ? (correct / total) * 100 : 0;
                  }
                  if (percentage > bestScore) {
                    bestScore = percentage;
                  }
                }
              });

              if (bestScore > 0) {
                subjectScoresList.push({ studentId: classmateId, score: bestScore });
              }
            } catch (error) {
              console.warn(`Error obteniendo puntaje de ${classmateId} para ${subjectName}:`, error);
            }
          }
        }

        // Agregar el puntaje del estudiante actual
        subjectScoresList.push({ studentId, score: currentScore.percentage });

        // Ordenar por puntaje (mayor a menor)
        subjectScoresList.sort((a, b) => b.score - a.score);

        // Encontrar la posición del estudiante actual
        const currentStudentIndex = subjectScoresList.findIndex(s => s.studentId === studentId);
        if (currentStudentIndex !== -1) {
          subjectRanks[subjectName] = {
            position: currentStudentIndex + 1, // +1 porque el puesto empieza en 1
            totalStudents: subjectScoresList.length
          };
        }
      }

      return subjectRanks;
    } catch (error) {
      console.error('Error calculando posiciones por materia:', error);
      return {};
    }
  };

  const handleExportPDF = async (phase: 'first' | 'second' | 'third', keepDialogOpen: boolean = false) => {
    if (!user?.uid) {
      notifyError({
        title: 'Error',
        message: 'No se pudo identificar al estudiante'
      });
      return;
    }

    if (!keepDialogOpen) {
      setIsPDFPhaseDialogOpen(false);
    }
    setIsGeneratingPDF(true);

    try {
      const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III';
      
      // Primero intentar obtener el resumen desde Firestore
      let summaryResult = await studentSummaryService.getSummary(user.uid, phase);
      
      // Si no existe, intentar generarlo automáticamente
      if (!summaryResult.success || !summaryResult.data) {
        notifySuccess({
          title: 'Generando resumen',
          message: `El resumen de ${phaseName} no existe. Generándolo ahora, por favor espera...`
        });

        // Intentar generar el resumen
        const generateResult = await studentSummaryService.generateSummary(user.uid, phase, false);
        
        if (!generateResult.success || !generateResult.data) {
          notifyError({
            title: 'Error al generar resumen',
            message: generateResult.success === false && 'error' in generateResult 
              ? generateResult.error.message 
              : `No se pudo generar el resumen académico de ${phaseName}. Asegúrate de haber completado las 7 evaluaciones requeridas.`
          });
          setIsGeneratingPDF(false);
          return;
        }

        // Usar el resumen recién generado
        summaryResult = { success: true, data: generateResult.data };
      }

      if (!summaryResult.success || !summaryResult.data) {
        notifyError({
          title: 'Resumen no disponible',
          message: `No se encontró un resumen académico para ${phaseName}. Asegúrate de haber completado las 7 evaluaciones.`
        });
        setIsGeneratingPDF(false);
        return;
      }

      const summary = summaryResult.data;

      // Obtener evaluaciones de la fase para mostrar puntajes reales
      const evaluations = await getPhaseEvaluations(user.uid, phase);
      
      // Calcular métricas de la fase
      const phaseMetrics = calculatePhaseMetrics(evaluations);
      
      // Determinar si es Fase III o no (para usar diseño diferente)
      const isPhase3 = phase === 'third';
      
      // Normalizar nombres de materias y obtener mejores puntajes
      const normalizeSubjectName = (subject: string): string => {
        const normalized = subject.trim().toLowerCase();
        const subjectMap: Record<string, string> = {
          'biologia': 'Biologia',
          'biología': 'Biologia',
          'quimica': 'Quimica',
          'química': 'Quimica',
          'fisica': 'Física',
          'física': 'Física',
          'matematicas': 'Matemáticas',
          'matemáticas': 'Matemáticas',
          'lenguaje': 'Lenguaje',
          'ciencias sociales': 'Ciencias Sociales',
          'sociales': 'Ciencias Sociales',
          'ingles': 'Inglés',
          'inglés': 'Inglés'
        };
        return subjectMap[normalized] || subject;
      };

      // Calcular puntajes por materia
      const subjectScores: { [key: string]: { score: number; percentage: number } } = {};
      evaluations.forEach(evalData => {
        const subject = normalizeSubjectName(evalData.subject || evalData.examTitle || '');
        let percentage = 0;
        
        if (evalData.score?.overallPercentage !== undefined) {
          percentage = evalData.score.overallPercentage;
        } else if (evalData.score?.correctAnswers !== undefined && evalData.score?.totalQuestions !== undefined) {
          const total = evalData.score.totalQuestions;
          const correct = evalData.score.correctAnswers;
          percentage = total > 0 ? (correct / total) * 100 : 0;
        } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
          const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length;
          const total = evalData.questionDetails.length;
          percentage = total > 0 ? (correct / total) * 100 : 0;
        }

        // Guardar el mejor puntaje de cada materia
        if (!subjectScores[subject] || percentage > subjectScores[subject].percentage) {
          subjectScores[subject] = {
            score: Math.round(percentage),
            percentage: percentage
          };
        }
      });

      // Calcular posiciones por materia respecto a compañeros del mismo grado (solo para Fase III)
      const subjectRanks = isPhase3 ? await calculateSubjectRanks(user.uid, subjectScores) : {};

      // Ordenar materias según el orden estándar
      const subjectOrder = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
      const sortedSubjects = subjectOrder.filter(subj => subjectScores[subj]).map(subj => {
        const rankInfo = subjectRanks[subj];
        return {
          name: subj,
          ...subjectScores[subj],
          percentile: calculatePercentile(subjectScores[subj].percentage), // Mantener para compatibilidad
          position: rankInfo?.position || null,
          totalStudentsInSubject: rankInfo?.totalStudents || null
        };
      });

      // Calcular puntaje global (similar al cálculo en promedio.tsx)
      const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física'];
      const POINTS_PER_NATURALES_SUBJECT = 100 / 3;
      const POINTS_PER_REGULAR_SUBJECT = 100;
      let globalScore = 0;
      
      sortedSubjects.forEach(({ name, percentage }) => {
        let pointsForSubject: number;
        if (NATURALES_SUBJECTS.includes(name)) {
          pointsForSubject = (percentage / 100) * POINTS_PER_NATURALES_SUBJECT;
        } else {
          pointsForSubject = (percentage / 100) * POINTS_PER_REGULAR_SUBJECT;
        }
        globalScore += pointsForSubject;
      });

      globalScore = Math.round(globalScore);
      const globalPercentile = calculatePercentile((globalScore / 500) * 100);

      // Crear una ventana nueva con el contenido del PDF
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        notifyError({
          title: 'Error',
          message: 'No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes.'
        });
        return;
      }

      // Obtener datos del estudiante para el PDF
      const userResult = await getUserById(user.uid);
      let studentName = 'Estudiante';
      let studentId = user.uid;
      if (userResult.success && userResult.data) {
        const userData = userResult.data as any;
        studentName = userData.name || 'Estudiante';
        studentId = userData.idNumber || userData.identification || user.uid;
      }

      const currentDate = new Date();

      // Calcular el puesto del estudiante para esta fase específica
      let pdfStudentRank: number | null = null;
      let pdfTotalStudents: number | null = null;
      
      try {
        const userResult = await getUserById(user.uid);
        if (userResult.success && userResult.data) {
          const studentData = userResult.data as any;
          const institutionId = studentData.inst || studentData.institutionId;
          const campusId = studentData.campus || studentData.campusId;
          const gradeId = studentData.grade || studentData.gradeId;

          if (institutionId && campusId && gradeId) {
            // Obtener todos los estudiantes del mismo colegio, sede y grado
            const { getFilteredStudents } = await import('@/controllers/student.controller');
            const studentsResult = await getFilteredStudents({
              institutionId,
              campusId,
              gradeId,
              isActive: true
            });

            if (studentsResult.success && studentsResult.data) {
              const classmates = studentsResult.data;
              
              // Calcular puntaje global de cada estudiante para esta fase específica
              const studentScores: { studentId: string; score: number }[] = [];
              
              for (const classmate of classmates) {
                const classmateId = (classmate as any).id || (classmate as any).uid;
                if (classmateId) {
                  const score = await calculateStudentGlobalScoreForPhase(classmateId, phase);
                  if (score > 0) { // Solo incluir estudiantes con evaluaciones en esta fase
                    studentScores.push({ studentId: classmateId, score });
                  }
                }
              }

              // Ordenar por puntaje (mayor a menor)
              studentScores.sort((a, b) => b.score - a.score);

              // Encontrar el puesto del estudiante actual
              const currentStudentIndex = studentScores.findIndex(s => s.studentId === user.uid);
              if (currentStudentIndex !== -1) {
                pdfStudentRank = currentStudentIndex + 1; // +1 porque el puesto empieza en 1
                pdfTotalStudents = studentScores.length; // Total real de estudiantes con evaluaciones
              }
            }
          }
        }
      } catch (error) {
        console.error('Error calculando puesto para PDF:', error);
        // Si hay error, usar los valores del estado (pueden ser de otra fase)
        pdfStudentRank = studentRank;
        pdfTotalStudents = totalStudents;
      }

      // Para Fase III, obtener datos de las fases anteriores para las gráficas
      let phase1SubjectsData: Array<{ name: string; percentage: number }> | undefined = undefined;
      let phase2SubjectsData: Array<{ name: string; percentage: number }> | undefined = undefined;
      
      if (isPhase3) {
        // Obtener datos de Fase I si están disponibles
        if (phase1Data && phase1Data.subjects) {
          phase1SubjectsData = phase1Data.subjects.map(s => ({ 
            name: s.name, 
            percentage: s.percentage 
          }));
        }
        
        // Obtener datos de Fase II si están disponibles
        if (phase2Data && phase2Data.subjects) {
          phase2SubjectsData = phase2Data.subjects.map(s => ({ 
            name: s.name, 
            percentage: s.percentage 
          }));
        }
      }

      // Generar HTML del PDF según la fase
      // Para Fase I y II: diseño simplificado con tarjetas de métricas
      // Para Fase III: diseño completo con tabla de resultados
      const pdfHTML = isPhase3 
        ? generatePhase3PDFHTML(summary, studentName, studentId, institutionName, currentDate, sortedSubjects, globalScore, globalPercentile, phase1SubjectsData, phase2SubjectsData, phaseMetrics, pdfStudentRank, pdfTotalStudents)
        : generatePhase1And2PDFHTML(summary, studentName, studentId, institutionName, currentDate, phaseName, phaseMetrics, pdfStudentRank, pdfTotalStudents, sortedSubjects);

      printWindow.document.write(pdfHTML);
      printWindow.document.close();

      // Solo mostrar notificación si no es parte de una descarga múltiple
      if (!keepDialogOpen) {
        notifySuccess({
          title: 'PDF generado',
          message: 'El resumen académico se abrirá en una nueva ventana para imprimir o guardar como PDF.'
        });
      }
    } catch (error: any) {
      console.error('Error generando PDF:', error);
      notifyError({
        title: 'Error',
        message: error.message || 'Error al generar el PDF. Por favor, inténtalo de nuevo.'
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportSelectedPhases = async () => {
    if (selectedPhasesForPDF.length === 0) {
      notifyError({
        title: 'No hay fases seleccionadas',
        message: 'Por favor, selecciona al menos una fase para descargar.'
      });
      return;
    }

    setIsPDFPhaseDialogOpen(false);
    setIsGeneratingPDF(true);

    try {
      // Descargar cada fase seleccionada
      for (let i = 0; i < selectedPhasesForPDF.length; i++) {
        const phase = selectedPhasesForPDF[i];
        const isLast = i === selectedPhasesForPDF.length - 1;
        
        // Para la última descarga, no mantener el diálogo abierto
        await handleExportPDF(phase, !isLast);
        
        // Pequeña pausa entre descargas para evitar saturar (excepto en la última)
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      const phaseNames = selectedPhasesForPDF.map(p => 
        p === 'first' ? 'Fase I' : p === 'second' ? 'Fase II' : 'Fase III'
      ).join(', ');

      notifySuccess({
        title: 'Descarga completada',
        message: `Se descargaron ${selectedPhasesForPDF.length} fase(s): ${phaseNames}`
      });

      // Resetear selecciones después de descargar
      setSelectedPhasesForPDF([]);
    } catch (error: any) {
      console.error('Error descargando fases seleccionadas:', error);
      notifyError({
        title: 'Error',
        message: 'Hubo un error al descargar algunas fases. Intenta descargarlas nuevamente.'
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSendEmail = () => {
    // Implementar envío por correo
    alert("Función de envío por correo en desarrollo");
  };

  // Función helper para obtener los datos según la fase seleccionada
  const getCurrentPhaseData = (): AnalysisData | null => {
    if (selectedPhase === 'phase1' && phase1Data) return phase1Data;
    if (selectedPhase === 'phase2' && phase2Data) return phase2Data;
    if (selectedPhase === 'phase3' && phase3Data) return phase3Data;
    if (selectedPhase === 'all') {
      // ✅ USAR DATOS CONSOLIDADOS que ya incluyen suma de intentos de fraude
      return analysisData;
    }
    // Si no hay datos para la fase seleccionada, intentar con otra fase disponible
    if (phase3Data) return phase3Data;
    if (phase2Data) return phase2Data;
    if (phase1Data) return phase1Data;
    return analysisData;
  };

  // Funciones duplicadas eliminadas - las correctas están arriba

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
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Desempeño" active theme={theme} />
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
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Desempeño" active theme={theme} />
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
              <Button className="bg-purple-600 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-500 hover:shadow-lg">
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
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Desempeño" active theme={theme} />
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
            <Button 
              onClick={handleExportPDFClick} 
              className="flex items-center gap-2"
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </>
              )}
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
                <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Seleccionar Fase
                </h3>
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
                  onClick={() => setSelectedPhase('phase3')}
                  variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
                  className={cn(
                    selectedPhase === 'phase3'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase3Data}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Fase III
                  {phase3Data && (
                    <Badge className={cn("ml-2", selectedPhase === 'phase3' ? 'bg-orange-500' : 'bg-gray-500')}>
                      {phase3Data.subjects.length} materias
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
          <TabsList className={cn("grid w-full grid-cols-2 md:grid-cols-3", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/80 border-gray-200 shadow-md backdrop-blur-sm')}>
            <TabsTrigger value="overview" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 border-gray-200')}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-green-100 data-[state=active]:text-green-700 border-gray-200')}>
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
            <TabsTrigger value="study-plan" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 border-gray-200')}>
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plan de Estudio</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                        {selectedPhase === 'all' 
                          ? (() => {
                              // Para "Todas las Fases", calcular el porcentaje real basándose en materias completadas vs materias esperadas
                              // Asumimos 7 materias por fase (las 7 materias estándar del ICFES)
                              const EXPECTED_SUBJECTS_PER_PHASE = 7;
                              let totalExpected = 0;
                              let totalCompleted = 0;
                              
                              // Contar materias completadas y esperadas por fase
                              if (phase1Data) {
                                totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                                totalCompleted += phase1Data.subjects.length;
                              }
                              if (phase2Data) {
                                totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                                totalCompleted += phase2Data.subjects.length;
                              }
                              if (phase3Data) {
                                totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                                totalCompleted += phase3Data.subjects.length;
                              }
                              
                              const percentage = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
                              return `${percentage}%`;
                            })()
                          : `${currentData.overall.phasePercentage}%`
                        }
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedPhase === 'all' 
                          ? 'Completitud General'
                          : `Porcentaje de Fase ${currentData.overall.currentPhase}`
                        }
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={selectedPhase === 'all' 
                        ? (() => {
                            const EXPECTED_SUBJECTS_PER_PHASE = 7;
                            let totalExpected = 0;
                            let totalCompleted = 0;
                            
                            if (phase1Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase1Data.subjects.length;
                            }
                            if (phase2Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase2Data.subjects.length;
                            }
                            if (phase3Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase3Data.subjects.length;
                            }
                            
                            return totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
                          })()
                        : currentData.overall.phasePercentage
                      } 
                      className={cn("h-2", theme === 'dark' ? '' : '')}
                    />
                    <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {selectedPhase === 'all'
                        ? (() => {
                            const EXPECTED_SUBJECTS_PER_PHASE = 7;
                            let totalExpected = 0;
                            let totalCompleted = 0;
                            
                            if (phase1Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase1Data.subjects.length;
                            }
                            if (phase2Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase2Data.subjects.length;
                            }
                            if (phase3Data) {
                              totalExpected += EXPECTED_SUBJECTS_PER_PHASE;
                              totalCompleted += phase3Data.subjects.length;
                            }
                            
                            return `${totalCompleted} de ${totalExpected} materias completadas`;
                          })()
                        : `${Math.round((currentData.overall.phasePercentage / 100) * 7)} de 7 materias completadas`
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200 shadow-md')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {currentData.overall.timeSpent.toFixed(1)}m
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedPhase === 'all' ? 'Tiempo Promedio por Pregunta' : `Tiempo Promedio por Pregunta - Fase ${currentData.overall.currentPhase}`}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-white/50')}>
                      {currentData.overall.totalQuestions > 0 ? 
                        `Promedio de ${currentData.overall.totalQuestions} preguntas` : 
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

              <Card className={cn(
                theme === 'dark' 
                  ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg'
                  : currentData.patterns.luckPercentage < 20 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md'
                    : currentData.patterns.luckPercentage <= 40
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md'
                    : 'bg-gradient-to-br from-orange-50 to-red-50 border-gray-200 shadow-md'
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        currentData.patterns.luckPercentage < 20
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : currentData.patterns.luckPercentage <= 40
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-orange-400' : 'text-orange-700'
                      )}>
                        {currentData.patterns.luckPercentage}%
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Suerte</p>
                    </div>
                    <Zap className={cn(
                      "h-8 w-8",
                      currentData.patterns.luckPercentage < 20
                        ? 'text-green-500'
                        : currentData.patterns.luckPercentage <= 40
                        ? 'text-yellow-500'
                        : 'text-orange-500'
                    )} />
                  </div>
                  <div className="mt-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        theme === 'dark' ? 'border-zinc-600' : 'border-gray-300',
                        currentData.patterns.luckPercentage < 20
                          ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-50 text-green-800 border-green-200'
                          : currentData.patterns.luckPercentage <= 40
                          ? theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          : theme === 'dark' ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-50 text-orange-800 border-orange-200'
                      )}
                    >
                      {currentData.patterns.luckPercentage < 20
                        ? 'Excelente análisis' 
                        : currentData.patterns.luckPercentage <= 40
                        ? 'Respuestas reflexivas'
                        : 'Muchas respuestas rápidas'
                      }
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mostrar tarjetas ORIGINALES para fases individuales (Fase I, II, III) */}
            {selectedPhase !== 'all' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <PieChart className="h-5 w-5" />
                      Rendimiento académico por materia
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
            )}

            {/* Gráfico de Evolución por Materia y Temas - SOLO para "Todas las Fases" */}
            {selectedPhase === 'all' && (() => {
              const phasesWithData = [phase1Data, phase2Data, phase3Data].filter(p => p !== null).length;
              if (phasesWithData >= 2) {
                const subjectTopicsData = prepareSubjectTopicsData(phase1Data, phase2Data, phase3Data);
                
                // Filtrar materias que tienen al menos un tema con datos
                const subjectsWithValidData = subjectTopicsData.filter(subject => 
                  subject.topics.length > 0 && 
                  subject.topics.some(topic => 
                    topic.phase1 !== null || topic.phase2 !== null || topic.phase3 !== null
                  )
                );

                if (subjectsWithValidData.length > 0) {
                  return (
                    <Card className={cn(
                      theme === 'dark' 
                        ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' 
                        : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm'
                    )}>
                      <CardHeader>
                        <CardTitle className={cn(
                          "flex items-center gap-2",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          <TrendingUp className="h-5 w-5 text-purple-500" />
                          Rendimiento por Materia
                        </CardTitle>
                        <CardDescription className={cn(
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Evolución de temas a través de las 3 fases evaluativas
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <SubjectTopicsAccordion 
                          subjects={subjectsWithValidData}
                          theme={theme}
                        />
                      </CardContent>
                    </Card>
                  );
                }
              }
              return null;
            })()}
                </>
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
                  {/* Primera Fila: Radar Chart y Tarjeta de Riesgo */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar Chart de Fortalezas/Debilidades */}
                    {currentData.subjects.length > 0 && (
                      <StrengthsRadarChart
                        subjects={currentData.subjects}
                        theme={theme}
                      />
                    )}

                    {/* Gráfico de Evolución por Materia */}
                    <SubjectsProgressChart
                      phase1Data={phase1Data ? { 
                        phase: 'phase1' as const, 
                        subjects: phase1Data.subjects.map(s => ({ 
                          name: s.name, 
                          percentage: s.percentage 
                        })) 
                      } : null}
                      phase2Data={phase2Data ? { 
                        phase: 'phase2' as const, 
                        subjects: phase2Data.subjects.map(s => ({ 
                          name: s.name, 
                          percentage: s.percentage 
                        })) 
                      } : null}
                      phase3Data={phase3Data ? { 
                        phase: 'phase3' as const, 
                        subjects: phase3Data.subjects.map(s => ({ 
                          name: s.name, 
                          percentage: s.percentage 
                        })) 
                      } : null}
                      theme={theme}
                    />
                  </div>

                  {/* Análisis Detallado por Materia */}
                  <SubjectsDetailedSummary
                    subjects={currentData.subjects}
                    subjectsWithTopics={currentData.subjectsWithTopics}
                    theme={theme}
                  />
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
                        <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos disponibles para esta fase</p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta evaluaciones para generar un plan de estudio personalizado</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Determinar la fase actual
              const currentPhase = selectedPhase === 'phase1' ? 'first' 
                : selectedPhase === 'phase2' ? 'second' 
                : selectedPhase === 'phase3' ? 'third' 
                : 'first'; // Default a first si es 'all'

              // Si es "Todas las Fases", mostrar resumen de planes disponibles
              if (selectedPhase === 'all') {
                return (
                  <StudyPlanSummary 
                    phase1Data={phase1Data}
                    phase2Data={phase2Data}
                    user={user}
                    theme={theme}
                  />
                );
              }

              // Si es Fase III, mostrar mensaje de ánimo en lugar del plan de estudio
              if (currentPhase === 'third') {
                return (
                  <div className="flex items-center justify-center min-h-[60vh] px-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className={cn(
                        "max-w-4xl w-full text-center p-8 sm:p-12 rounded-3xl shadow-2xl",
                        theme === 'dark' 
                          ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-blue-500/50' 
                          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200'
                      )}
                    >
                      <motion.div
                        animate={{ 
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 1
                        }}
                        className="mb-6"
                      >
                        <Trophy className={cn(
                          "w-20 h-20 mx-auto",
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )} />
                      </motion.div>
                      
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={cn(
                          "text-3xl sm:text-4xl md:text-5xl font-bold mb-6",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}
                      >
                        ¡SIGUE ADELANTE!
                      </motion.h2>
                      
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn(
                          "text-xl sm:text-2xl md:text-3xl font-semibold",
                          theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                        )}
                      >
                        TU ESFUERZO TE LLEVARÁ AL ÉXITO
                      </motion.p>
                      
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-8"
                      >
                        <p className={cn(
                          "text-base sm:text-lg",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>
                          ¡NUNCA DEJES QUE LOS DEMAS DECIDAN EN QUIEN TE CONVERTIRÁS!.
                        </p>
                        <p className={cn(
                          "text-base sm:text-lg mt-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>
                          Sigue estudiando, repasando y fortaleciendo tus conocimientos. ¡El éxito está en tus manos!
                        </p>
                      </motion.div>
                    </motion.div>
                  </div>
                );
              }

              return (
                <PersonalizedStudyPlan
                  subjectsWithTopics={currentData.subjectsWithTopics}
                  phase={currentPhase}
                  studentId={user?.uid || ''}
                  theme={theme}
                />
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

      {/* Dialog para seleccionar fase al descargar PDF */}
      <Dialog open={isPDFPhaseDialogOpen} onOpenChange={setIsPDFPhaseDialogOpen}>
        <DialogContent className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white')}>
          <DialogHeader>
            <DialogTitle className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Seleccionar Fase para PDF
            </DialogTitle>
            <DialogDescription className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Selecciona una o más fases académicas para las cuales deseas generar el resumen en PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {/* Checkbox para seleccionar todas las fases */}
            {availablePhases.length > 1 && (
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-300 dark:border-zinc-600">
                <Checkbox
                  id="select-all"
                  checked={selectedPhasesForPDF.length === availablePhases.length && availablePhases.length > 0}
                  onCheckedChange={handleSelectAllPhases}
                  disabled={isGeneratingPDF || availablePhases.length === 0}
                />
                <label
                  htmlFor="select-all"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || availablePhases.length === 0) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Seleccionar todas las fases ({availablePhases.length})
                </label>
              </div>
            )}

            {/* Checkboxes individuales por fase */}
            <div className="space-y-3">
              {/* Fase I */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phase1Complete && "opacity-50"
              )}>
                <Checkbox
                  id="phase-first"
                  checked={selectedPhasesForPDF.includes('first')}
                  onCheckedChange={() => handlePhaseToggle('first')}
                  disabled={isGeneratingPDF || !phase1Complete}
                />
                <label
                  htmlFor="phase-first"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phase1Complete) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )} />
                  Fase I
                  {!phase1Complete && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                </label>
              </div>

              {/* Fase II */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phase2Complete && "opacity-50"
              )}>
                <Checkbox
                  id="phase-second"
                  checked={selectedPhasesForPDF.includes('second')}
                  onCheckedChange={() => handlePhaseToggle('second')}
                  disabled={isGeneratingPDF || !phase2Complete}
                />
                <label
                  htmlFor="phase-second"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phase2Complete) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )} />
                  Fase II
                  {!phase2Complete && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                </label>
              </div>

              {/* Fase III */}
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                theme === 'dark' 
                  ? 'border-zinc-600 hover:bg-zinc-700/50' 
                  : 'border-gray-300 hover:bg-gray-50',
                !phase3Complete && "opacity-50"
              )}>
                <Checkbox
                  id="phase-third"
                  checked={selectedPhasesForPDF.includes('third')}
                  onCheckedChange={() => handlePhaseToggle('third')}
                  disabled={isGeneratingPDF || !phase3Complete}
                />
                <label
                  htmlFor="phase-third"
                  className={cn(
                    "text-sm font-medium cursor-pointer flex-1 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900',
                    (isGeneratingPDF || !phase3Complete) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Target className={cn(
                    "h-4 w-4",
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                  Fase III
                  {!phase3Complete && (
                    <span className="ml-auto text-xs opacity-75">(Incompleta)</span>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPDFPhaseDialogOpen(false);
                setSelectedPhasesForPDF([]);
              }}
              disabled={isGeneratingPDF}
              className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : '')}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportSelectedPhases}
              disabled={isGeneratingPDF || selectedPhasesForPDF.length === 0}
              className={cn(
                "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white",
                (isGeneratingPDF || selectedPhasesForPDF.length === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar {selectedPhasesForPDF.length > 0 ? `(${selectedPhasesForPDF.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

