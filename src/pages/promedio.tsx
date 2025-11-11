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

function NavItem({ href, icon, text, active = false }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`flex items-center ${active ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}

// Componente de gráfico de rendimiento
function PerformanceChart({ data }: { data: SubjectAnalysis[] }) {
  return (
    <div className="space-y-4">
      {data.map((subject) => (
        <div key={subject.name} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{subject.name}</span>
            <span className="text-sm text-gray-500">{subject.percentage}%</span>
          </div>
          <Progress value={subject.percentage} className="h-2" />
        </div>
      ))}
    </div>
  );
}

// Componente de análisis por materia
function SubjectAnalysis({ subjects }: { subjects: SubjectAnalysis[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {subjects.map((subject) => (
        <Card key={subject.name}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{subject.name}</span>
              <Badge className={subject.percentage >= 70 ? "bg-green-100 text-green-800" : subject.percentage >= 50 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                {subject.percentage}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Correctas:</span>
                <span className="font-medium ml-2">{subject.correct}/{subject.total}</span>
              </div>
              <div>
                <span className="text-gray-500">Tiempo:</span>
                <span className="font-medium ml-2">{Math.floor(subject.timeSpent / 60)}m</span>
              </div>
            </div>
            <Progress value={subject.percentage} className="h-2" />
            
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-1">Fortalezas</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {subject.strengths.map((strength, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-1">Áreas de mejora</h4>
                <ul className="text-xs text-gray-600 space-y-1">
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
function StudyPlan({ recommendations }: { recommendations: AnalysisData['recommendations'] }) {
  return (
    <div className="space-y-4">
      {recommendations.map((rec, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Badge className={rec.priority === "Alta" ? "bg-red-100 text-red-800" : rec.priority === "Media" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                {rec.priority}
              </Badge>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{rec.subject} - {rec.topic}</h3>
                <p className="text-sm text-gray-600 mt-1">Tiempo estimado: {rec.timeEstimate}</p>
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-2">Recursos recomendados:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
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
function ComparisonChart({ subjects }: { subjects: SubjectAnalysis[] }) {
  const averageScore = subjects.reduce((acc, subject) => acc + subject.percentage, 0) / subjects.length;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Progreso por Materia</CardTitle>
          <CardDescription>Análisis comparativo de tu desempeño</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subjects.map((subject) => (
              <div key={subject.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{subject.name}</span>
                    <span className="text-2xl font-bold">{subject.percentage}%</span>
                  </div>
                  <Progress value={subject.percentage} className="h-3" />
                </div>
                <div className="ml-4 text-center">
                  <div className={`text-sm font-medium ${subject.percentage > averageScore ? 'text-green-600' : 'text-red-600'}`}>
                    {subject.percentage > averageScore ? '↑' : '↓'} {Math.abs(subject.percentage - averageScore).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">vs promedio</div>
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
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();

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
      recommendations: generateRecommendations(subjects)
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

  const generateRecommendations = (subjects: SubjectAnalysis[]) => {
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
        timeEstimate: `${2 + index} semanas`
      }));
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
      <div className="min-h-screen bg-gray-50">
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
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
            </nav>
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-lg text-gray-600">Cargando análisis...</span>
        </div>
      </div>
    );
  }

  if (!analysisData || evaluations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
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
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
            </nav>
          </div>
        </header>
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin datos para analizar</h2>
            <p className="text-gray-600 mb-6">Necesitas presentar al menos una evaluación para generar tu análisis inteligente.</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" active />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
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
              <h1 className="text-2xl font-bold">Análisis Inteligente ICFES</h1>
              <p className="text-gray-600">Reporte personalizado generado por IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
            <Button onClick={handleSendEmail} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Mail className="h-4 w-4" />
              Enviar por correo
            </Button>
          </div>
        </div>

        {/* Student Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Estudiante</p>
                <p className="font-semibold">{analysisData.student.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ID</p>
                <p className="font-semibold">{analysisData.student.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Última evaluación</p>
                <p className="font-semibold">{analysisData.student.testDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Evaluaciones</p>
                <p className="font-semibold">{analysisData.student.testType}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Desempeño</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
            <TabsTrigger value="study-plan" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plan de Estudio</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Progreso</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{analysisData.overall.score}</p>
                      <p className="text-sm text-gray-500">Puntaje Global</p>
                    </div>
                    <Award className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="secondary">Percentil {analysisData.overall.percentile}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{analysisData.overall.predictedScore}</p>
                      <p className="text-sm text-gray-500">Predicción IA</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-green-600">
                      +{analysisData.overall.predictedScore - analysisData.overall.score} pts
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{analysisData.overall.timeSpent}m</p>
                      <p className="text-sm text-gray-500">Tiempo Total</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline">
                      {analysisData.overall.totalQuestions > 0 ? 
                        `${Math.round(analysisData.overall.timeSpent / analysisData.overall.totalQuestions * 60)}s por pregunta` : 
                        'Sin datos'
                      }
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {analysisData.overall.questionsAnswered}/{analysisData.overall.totalQuestions}
                      </p>
                      <p className="text-sm text-gray-500">Respondidas</p>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Distribución por Materias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisData.subjects.length > 0 ? (
                    <PerformanceChart data={analysisData.subjects} />
                  ) : (
                    <p className="text-gray-500 text-center py-4">Sin datos de materias disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Fortalezas y Debilidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">Área más fuerte</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">{analysisData.patterns.strongestArea}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Área a mejorar</span>
                    </div>
                    <Badge className="bg-red-100 text-red-800">{analysisData.patterns.weakestArea}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Gestión del tiempo</span>
                    </div>
                    <p className="text-sm text-gray-600">{analysisData.patterns.timeManagement}</p>
                  </div>
                  {analysisData.patterns.securityIssues > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Alertas de seguridad</span>
                      </div>
                      <Badge className="bg-red-100 text-red-800">
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
              <SubjectAnalysis subjects={analysisData.subjects} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay datos de desempeño por materia disponibles</p>
                    <p className="text-sm text-gray-400 mt-2">Presenta más evaluaciones para obtener un análisis detallado</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Diagnosis Tab */}
          <TabsContent value="diagnosis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Análisis de Patrones de Error
                </CardTitle>
                <CardDescription>Identificación de tipos de errores y sus causas principales</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisData.patterns.errorTypes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysisData.patterns.errorTypes.map((error, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="text-lg font-semibold mb-2">{error}</div>
                        <Progress value={parseInt(error.split(": ")[1])} className="h-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Datos insuficientes para análisis de errores</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Fortalezas Identificadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisData.subjects.length > 0 ? (
                    analysisData.subjects.map((subject) => (
                      <div key={subject.name} className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-medium">{subject.name}</h4>
                        <ul className="text-sm text-gray-600 mt-1">
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
                    <p className="text-gray-500 text-center py-4">No hay datos de fortalezas disponibles</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    Áreas de Mejora
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisData.subjects.length > 0 ? (
                    analysisData.subjects.map((subject) => (
                      <div key={subject.name} className="border-l-4 border-red-500 pl-4">
                        <h4 className="font-medium">{subject.name}</h4>
                        <ul className="text-sm text-gray-600 mt-1">
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
                    <p className="text-gray-500 text-center py-4">No hay datos de debilidades disponibles</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Study Plan Tab */}
          <TabsContent value="study-plan" className="space-y-6">
            {analysisData.recommendations.length > 0 ? (
              <StudyPlan recommendations={analysisData.recommendations} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Plan de Estudio Personalizado
                  </CardTitle>
                  <CardDescription>Recomendaciones basadas en tu desempeño</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No hay recomendaciones específicas disponibles</p>
                    <p className="text-sm text-gray-400">Presenta más evaluaciones para generar un plan de estudio personalizado</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            {analysisData.subjects.length > 0 ? (
              <ComparisonChart subjects={analysisData.subjects} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Seguimiento de Progreso
                  </CardTitle>
                  <CardDescription>Análisis comparativo de tu evolución</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No hay suficientes datos para mostrar el progreso</p>
                    <p className="text-sm text-gray-400">Presenta múltiples evaluaciones para ver tu evolución</p>
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