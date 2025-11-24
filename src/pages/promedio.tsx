import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Link } from "react-router-dom"
import { doc, getDoc, getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { firebaseApp } from "@/services/firebase/db.service"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useThemeContext } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import { geminiService } from "@/services/ai/gemini.service"
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
  Home,
  ContactRound,
  NotepadText,
  BarChart2,
  Apple,
  User,
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
    predictedScore: number;
    timeSpent: number;
    questionsAnswered: number;
    totalQuestions: number;
    averagePercentage: number;
  };
  subjects: SubjectAnalysis[];
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

// Componente de gráfico de rendimiento
function PerformanceChart({ data, theme = 'light' }: { data: SubjectAnalysis[], theme?: 'light' | 'dark' }) {
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

// Componente de análisis por materia
function SubjectAnalysis({ subjects, theme = 'light' }: { subjects: SubjectAnalysis[], theme?: 'light' | 'dark' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {subjects.map((subject) => (
        <Card key={subject.name} className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader>
            <CardTitle className={cn("flex items-center justify-between", theme === 'dark' ? 'text-white' : '')}>
              <span>{subject.name}</span>
              <Badge className={subject.percentage >= 70 ? (theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800") : subject.percentage >= 50 ? (theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800") : (theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800")}>
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
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
              <Badge className={rec.priority === "Alta" ? (theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800") : rec.priority === "Media" ? (theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800") : (theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800")}>
                {rec.priority}
              </Badge>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-semibold text-lg", theme === 'dark' ? 'text-white' : '')}>{rec.subject} - {rec.topic}</h3>
                  {(() => {
                    const hasExplanation = 'explanation' in rec && rec.explanation && typeof rec.explanation === 'string';
                    return hasExplanation ? (
                      <Badge variant="outline" className={cn("text-xs", theme === 'dark' ? 'border-purple-500 text-purple-300' : 'border-purple-500 text-purple-600')}>
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
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();

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
        // Obtener resultados de Firebase
        const docRef = doc(db, "results", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserResults;
          const evaluationsArray = Object.entries(data).map(([examId, examData]) => ({
            ...examData,
            examId,
          }));

          evaluationsArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setEvaluations(evaluationsArray);

          // Procesar datos para el análisis
          const processedData = processEvaluationData(evaluationsArray, user);
          setAnalysisData(processedData);
          
          // Generar recomendaciones con IA si está disponible
          if (geminiService.isAvailable() && processedData.subjects.length > 0) {
            generateAIRecommendations(processedData);
          }
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

    // Agrupar preguntas por materia/tema
    const subjectGroups: { [key: string]: any[] } = {};
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTimeSpent = 0;
    let totalAnswered = 0;
    let securityIssues = 0;

    evaluations.forEach(exam => {
      totalTimeSpent += exam.timeSpent;
      totalAnswered += exam.score.totalAnswered;
      totalQuestions += exam.score.totalQuestions;
      totalCorrect += exam.score.correctAnswers;
      
      if (exam.tabChangeCount > 0) securityIssues++;

      exam.questionDetails.forEach(question => {
        const topic = question.topic || 'General';
        if (!subjectGroups[topic]) {
          subjectGroups[topic] = [];
        }
        subjectGroups[topic].push(question);
      });
    });

    // Procesar cada materia
    const subjects: SubjectAnalysis[] = Object.entries(subjectGroups).map(([topic, questions]) => {
      const correct = questions.filter(q => q.isCorrect).length;
      const total = questions.length;
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Análisis de fortalezas y debilidades (simplificado)
      const correctQuestions = questions.filter(q => q.isCorrect);
      const incorrectQuestions = questions.filter(q => !q.isCorrect && q.answered);
      
      const strengths = correctQuestions.length > 0 ? 
        [`Dominio en ${Math.round((correctQuestions.length / total) * 100)}% de preguntas`] : 
        ['Necesita refuerzo en esta área'];

      const weaknesses = incorrectQuestions.length > 0 ? 
        [`Dificultades en ${Math.round((incorrectQuestions.length / total) * 100)}% de preguntas`] : 
        ['Sin debilidades identificadas'];

      return {
        name: topic,
        score: percentage,
        maxScore: 100,
        correct,
        total,
        timeSpent: Math.round(totalTimeSpent / evaluations.length), // Tiempo promedio
        percentage,
        strengths,
        weaknesses,
        improvement: `+${Math.random() * 20 + 5}%` // Simulado para mejora potencial
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
        score: Math.round(averagePercentage * 5), // Escala a 500 puntos típica del ICFES
        percentile: Math.round(percentile),
        predictedScore: Math.round(averagePercentage * 5 + 30), // Predicción optimista
        timeSpent: Math.round(totalTimeSpent / 60), // En minutos
        questionsAnswered: totalAnswered,
        totalQuestions,
        averagePercentage
      },
      subjects,
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
        predictedScore: 0,
        timeSpent: 0,
        questionsAnswered: 0,
        totalQuestions: 0,
        averagePercentage: 0
      },
      subjects: [],
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

  if (loading) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
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
              <h1 className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>Análisis Inteligente ICFES</h1>
              <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Reporte personalizado generado por IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button onClick={handleSendEmail} variant="outline" className={cn("flex items-center gap-2", theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent')}>
              <Mail className="h-4 w-4" />
              Enviar por correo
            </Button>
          </div>
        </div>

        {/* Student Info Card */}
        <Card className={cn("mb-6", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estudiante</p>
                <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : '')}>{analysisData.student.name}</p>
              </div>
              <div>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>ID</p>
                <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : '')}>{analysisData.student.id}</p>
              </div>
              <div>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Última evaluación</p>
                <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : '')}>{analysisData.student.testDate}</p>
              </div>
              <div>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Evaluaciones</p>
                <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : '')}>{analysisData.student.testType}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={cn("grid w-full grid-cols-2 md:grid-cols-5", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <TabsTrigger value="overview" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Desempeño</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
            <TabsTrigger value="study-plan" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plan de Estudio</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className={cn("flex items-center gap-2", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : '')}>
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Progreso</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>{analysisData.overall.score}</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Puntaje Global</p>
                    </div>
                    <Award className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="secondary" className={cn(theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : '')}>Percentil {analysisData.overall.percentile}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>{analysisData.overall.predictedScore}</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Predicción IA</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={cn("text-green-600", theme === 'dark' ? 'border-zinc-600' : '')}>
                      +{analysisData.overall.predictedScore - analysisData.overall.score} pts
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>{analysisData.overall.timeSpent}m</p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tiempo Total</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={cn(theme === 'dark' ? 'border-zinc-600' : '')}>
                      {analysisData.overall.totalQuestions > 0 ? 
                        `${Math.round(analysisData.overall.timeSpent / analysisData.overall.totalQuestions * 60)}s por pregunta` : 
                        'Sin datos'
                      }
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : '')}>
                        {analysisData.overall.questionsAnswered}/{analysisData.overall.totalQuestions}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Respondidas</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-purple-500" />
                  </div>
                  <div className="mt-2">
                    <Progress
                      value={analysisData.overall.totalQuestions > 0 ? (analysisData.overall.questionsAnswered / analysisData.overall.totalQuestions) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                    <PieChart className="h-5 w-5" />
                    Distribución por Materias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisData.subjects.length > 0 ? (
                    <PerformanceChart data={analysisData.subjects} theme={theme} />
                  ) : (
                    <p className={cn("text-center py-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Sin datos de materias disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                    <Zap className="h-5 w-5" />
                    Fortalezas y Debilidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Área más fuerte</span>
                    </div>
                    <Badge className={theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"}>{analysisData.patterns.strongestArea}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Área a mejorar</span>
                    </div>
                    <Badge className={theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800"}>{analysisData.patterns.weakestArea}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Gestión del tiempo</span>
                    </div>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{analysisData.patterns.timeManagement}</p>
                  </div>
                  {analysisData.patterns.securityIssues > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <span className={cn("font-medium", theme === 'dark' ? 'text-white' : '')}>Alertas de seguridad</span>
                      </div>
                      <Badge className={theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800"}>
                        {analysisData.patterns.securityIssues} evaluación{analysisData.patterns.securityIssues > 1 ? 'es' : ''} con incidentes
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {analysisData.subjects.length > 0 ? (
              <SubjectAnalysis subjects={analysisData.subjects} theme={theme} />
            ) : (
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <BarChart3 className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos de desempeño por materia disponibles</p>
                    <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Presenta más evaluaciones para obtener un análisis detallado</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Diagnosis Tab */}
          <TabsContent value="diagnosis" className="space-y-6">
            <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
              <CardHeader>
                <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                  <Target className="h-5 w-5" />
                  Análisis de Patrones de Error
                </CardTitle>
                <CardDescription className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Identificación de tipos de errores y sus causas principales</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisData.patterns.errorTypes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysisData.patterns.errorTypes.map((error, index) => (
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
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    <CheckCircle2 className="h-5 w-5" />
                    Fortalezas Identificadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisData.subjects.length > 0 ? (
                    analysisData.subjects.map((subject) => (
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

              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                    <AlertTriangle className="h-5 w-5" />
                    Áreas de Mejora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisData.subjects.length > 0 ? (
                    analysisData.subjects.map((subject) => (
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
          </TabsContent>

          {/* Study Plan Tab */}
          <TabsContent value="study-plan" className="space-y-6">
            {loadingAI || (analysisData.recommendations.length > 0) ? (
              <StudyPlan recommendations={analysisData.recommendations} theme={theme} loadingAI={loadingAI} />
            ) : (
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
            )}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            {analysisData.subjects.length > 0 ? (
              <ComparisonChart subjects={analysisData.subjects} theme={theme} />
            ) : (
              <Card className={cn(theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
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
            )}
          </TabsContent>
        </Tabs>

        {/* Estadísticas adicionales */}
        {evaluations.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Estadísticas Generales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{evaluations.length}</div>
                  <div className="text-sm text-gray-500">Evaluaciones Presentadas</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analysisData.patterns.completionRate}%</div>
                  <div className="text-sm text-gray-500">Tasa de Finalización</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{analysisData.overall.averagePercentage}%</div>
                  <div className="text-sm text-gray-500">Promedio General</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{analysisData.patterns.securityIssues}</div>
                  <div className="text-sm text-gray-500">Incidentes de Seguridad</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}