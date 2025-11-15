import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ContactRound, NotepadText, BarChart2, Apple, TrendingUp, ArrowUp, Target, Award, Minus, ArrowDown, CheckCircle2, AlertTriangle, Loader2, Home, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseApp } from "@/services/firebase/db.service";
import { CartesianGrid, Bar, ResponsiveContainer, XAxis, YAxis, LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Tooltip } from "recharts";
import { useUserInstitution } from "@/hooks/query/useUserInstitution";
import { useThemeContext } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const db = getFirestore(firebaseApp);

// Interfaces para tipar los datos
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

// Mapeo de temas a materias principales
const topicToSubject = {
  'MATEMATICAS': 'Matemáticas',
  'LECTURA_CRITICA': 'Lectura Crítica',
  'CIENCIAS_NATURALES': 'Ciencias Naturales',
  'CIENCIAS_SOCIALES': 'Ciencias Sociales',
  'INGLES': 'Inglés'
};

// Componente de navegación
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

const ExamAnalyzer = () => {
  const [evaluations, setEvaluations] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { institutionName, institutionLogo, isLoading: isLoadingInstitution } = useUserInstitution();
  const { theme } = useThemeContext();

  useEffect(() => {
    const fetchEvaluations = async () => {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setEvaluations([]);
        setLoading(false);
        return;
      }

      try {
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
        } else {
          setEvaluations([]);
        }
      } catch (error) {
        console.error("Error al obtener las evaluaciones:", error);
        setError("Error al cargar los datos");
        setEvaluations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluations();
  }, []);

  // Procesar datos para análisis
  const processAnalysisData = () => {
    if (evaluations.length === 0) return null;

    // Agrupar evaluaciones por materia/tema
    const subjectData: { [key: string]: ExamResult[] } = {};
    
    evaluations.forEach(exam => {
      const subject = topicToSubject[exam.topic as keyof typeof topicToSubject] || exam.topic;
      if (!subjectData[subject]) {
        subjectData[subject] = [];
      }
      subjectData[subject].push(exam);
    });

    // Calcular estadísticas por materia
    const subjectStats = Object.entries(subjectData).map(([subject, exams]) => {
      const sortedExams = exams.sort((a, b) => a.timestamp - b.timestamp);
      const firstExam = sortedExams[0];
      const lastExam = sortedExams[sortedExams.length - 1];
      
      const improvement = lastExam.score.overallPercentage - firstExam.score.overallPercentage;
      
      // Analizar fortalezas y debilidades basado en los temas de las preguntas
      const topicPerformance: { [topic: string]: { correct: number, total: number } } = {};
      
      lastExam.questionDetails.forEach(question => {
        if (!topicPerformance[question.topic]) {
          topicPerformance[question.topic] = { correct: 0, total: 0 };
        }
        topicPerformance[question.topic].total++;
        if (question.isCorrect) {
          topicPerformance[question.topic].correct++;
        }
      });

      const topicStats = Object.entries(topicPerformance).map(([topic, stats]) => ({
        topic,
        score: Math.round((stats.correct / stats.total) * 100)
      }));

      const strengths = topicStats.filter(t => t.score >= 70).sort((a, b) => b.score - a.score);
      const weaknesses = topicStats.filter(t => t.score < 70).sort((a, b) => a.score - b.score);

      return {
        name: subject,
        score: lastExam.score.overallPercentage,
        previousScore: firstExam.score.overallPercentage,
        improvement: improvement,
        examsCount: exams.length,
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 3),
        lastExamDate: lastExam.timestamp,
        averageTimeSpent: Math.round(exams.reduce((sum, exam) => sum + exam.timeSpent, 0) / exams.length)
      };
    });

    // Datos de evolución temporal
    const evolutionData = evaluations
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6) // Últimas 6 evaluaciones
      .map((exam, index) => ({
        prueba: `Evaluación ${index + 1}`,
        puntaje: exam.score.overallPercentage,
        fecha: new Date(exam.timestamp).toLocaleDateString(),
        materia: topicToSubject[exam.topic as keyof typeof topicToSubject] || exam.topic
      }));

    // Radar de competencias
    const competencyData = subjectStats.map(subject => ({
      competencia: subject.name,
      anterior: subject.previousScore,
      actual: subject.score,
      objetivo: Math.min(100, subject.score + 20)
    }));

    // Estadísticas generales
    const totalImprovement = subjectStats.reduce((sum, subject) => sum + subject.improvement, 0);
    const averageScore = subjectStats.reduce((sum, subject) => sum + subject.score, 0) / subjectStats.length;
    const subjectsImproved = subjectStats.filter(subject => subject.improvement > 0).length;
    const totalExams = evaluations.length;

    return {
      subjectStats,
      evolutionData,
      competencyData,
      totalImprovement: Math.round(totalImprovement),
      averageScore: Math.round(averageScore * 10) / 10,
      subjectsImproved,
      totalExams,
      totalSubjects: subjectStats.length
    };
  };

  const getImprovementIcon = (improvement: number) => {
    if (improvement > 0) {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    } else if (improvement < 0) {
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
        {/* Header igual al de EvaluationsTab */}
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
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active theme={theme} />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
            </nav>
          </div>
        </header>

        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className={cn("h-8 w-8 animate-spin mx-auto mb-4", theme === 'dark' ? 'text-purple-400' : '')} />
            <p className={cn(theme === 'dark' ? 'text-gray-400' : '')}>Cargando análisis de progreso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active theme={theme} />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
            </nav>
          </div>
        </header>

        <div className="flex items-center justify-center py-20">
          <div className={cn("text-center", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
            <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
            <p>Error al cargar los datos: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const analysisData = processAnalysisData();

  if (!analysisData || evaluations.length === 0) {
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
              <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active theme={theme} />
              <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
              <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
            </nav>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn("text-lg mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay datos suficientes para el análisis</p>
            <p className={cn("mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Necesitas presentar al menos una evaluación para ver tu progreso</p>
            <Link to="/dashboard#evaluacion">
              <button className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white px-6 py-2 rounded-lg">
                Presentar Evaluación
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
      {/* Header igual al de EvaluationsTab */}
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
            <NavItem href="/exam-analyzer" icon={<Home className="w-5 h-5" />} text="Mi progreso" active theme={theme} />
            <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" theme={theme} />
            <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" theme={theme} />
          </nav>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Título */}
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Mi Progreso Académico</h1>
          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Análisis detallado de tu evolución y rendimiento</p>
        </div>

        {/* Resumen General */}
        <Card className={cn("shadow-lg border-l-4", theme === 'dark' ? 'bg-zinc-800 border-zinc-700 border-l-green-500' : 'border-l-green-500')}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
              <TrendingUp className="h-6 w-6 text-green-600" />
              Resumen de Progreso General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={cn("text-center p-4 rounded-lg", theme === 'dark' ? 'bg-green-900/30 border border-green-800' : 'bg-green-50')}>
                <div className={cn("text-3xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                  {analysisData.totalImprovement > 0 ? '+' : ''}{analysisData.totalImprovement}
                </div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-green-300' : 'text-green-600')}>Puntos de mejora total</div>
              </div>
              <div className={cn("text-center p-4 rounded-lg", theme === 'dark' ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50')}>
                <div className={cn("text-3xl font-bold", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>{analysisData.averageScore}</div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-blue-300' : 'text-blue-600')}>Puntaje promedio actual</div>
              </div>
              <div className={cn("text-center p-4 rounded-lg", theme === 'dark' ? 'bg-purple-900/30 border border-purple-800' : 'bg-purple-50')}>
                <div className={cn("text-3xl font-bold", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                  {analysisData.subjectsImproved}/{analysisData.totalSubjects}
                </div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-purple-300' : 'text-purple-600')}>Materias con mejora</div>
              </div>
              <div className={cn("text-center p-4 rounded-lg", theme === 'dark' ? 'bg-orange-900/30 border border-orange-800' : 'bg-orange-50')}>
                <div className={cn("text-3xl font-bold", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>{analysisData.totalExams}</div>
                <div className={cn("text-sm", theme === 'dark' ? 'text-orange-300' : 'text-orange-600')}>Evaluaciones presentadas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolución Temporal */}
        {analysisData.evolutionData.length > 1 && (
          <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                <Target className="h-5 w-5 text-blue-600" />
                Evolución de Puntajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysisData.evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="prueba" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="puntaje" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      name="Puntaje" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Radar de Competencias */}
        {analysisData.competencyData.length > 0 && (
          <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
                <Award className="h-5 w-5 text-purple-600" />
                Radar de Competencias por Materia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={analysisData.competencyData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="competencia" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Puntaje Anterior"
                      dataKey="anterior"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Puntaje Actual"
                      dataKey="actual"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.2}
                      strokeWidth={3}
                    />
                    <Radar
                      name="Objetivo"
                      dataKey="objetivo"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progreso por Materia */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysisData.subjectStats.map((subject) => (
            <Card key={subject.name} className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={cn("text-lg", theme === 'dark' ? 'text-white' : '')}>{subject.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getImprovementIcon(subject.improvement)}
                    <Badge className={subject.improvement > 0 ? "bg-green-100 text-green-700" : subject.improvement < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
                      {subject.improvement > 0 ? '+' : ''}{Math.round(subject.improvement)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comparación de Puntajes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={cn("text-center p-3 rounded-lg", theme === 'dark' ? 'bg-red-900/30 border border-red-800' : 'bg-red-50')}>
                    <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-red-400' : 'text-red-600')}>{Math.round(subject.previousScore)}</div>
                    <div className={cn("text-sm", theme === 'dark' ? 'text-red-300' : 'text-red-600')}>Puntaje Inicial</div>
                  </div>
                  <div className={cn("text-center p-3 rounded-lg", theme === 'dark' ? 'bg-green-900/30 border border-green-800' : 'bg-green-50')}>
                    <div className={cn("text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>{Math.round(subject.score)}</div>
                    <div className={cn("text-sm", theme === 'dark' ? 'text-green-300' : 'text-green-600')}>Puntaje Actual</div>
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Progreso hacia objetivo (80 pts)</span>
                    <span className="text-sm text-gray-500">{Math.round((subject.score / 80) * 100)}%</span>
                  </div>
                  <Progress value={(subject.score / 80) * 100} className="h-3" />
                </div>

                {/* Información adicional */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={cn("text-center p-2 rounded", theme === 'dark' ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50')}>
                    <div className={cn("font-bold", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>{subject.examsCount}</div>
                    <div className={cn(theme === 'dark' ? 'text-blue-300' : 'text-blue-600')}>Evaluaciones</div>
                  </div>
                  <div className={cn("text-center p-2 rounded", theme === 'dark' ? 'bg-purple-900/30 border border-purple-800' : 'bg-purple-50')}>
                    <div className={cn("font-bold", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>{Math.floor(subject.averageTimeSpent / 60)}m</div>
                    <div className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-600')}>Tiempo promedio</div>
                  </div>
                </div>

                {/* Fortalezas */}
                {subject.strengths.length > 0 && (
                  <div>
                    <h5 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Fortalezas
                    </h5>
                    <div className="space-y-1">
                      {subject.strengths.map((strength, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                          <span className="text-green-800">{strength.topic}</span>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {strength.score}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Debilidades */}
                {subject.weaknesses.length > 0 && (
                  <div>
                    <h5 className="font-medium text-orange-600 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Áreas de mejora
                    </h5>
                    <div className="space-y-1">
                      {subject.weaknesses.map((weakness, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded text-sm">
                          <span className="text-orange-800">{weakness.topic}</span>
                          <Badge className="bg-orange-100 text-orange-800 text-xs">
                            {weakness.score}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Velocidad de Mejora */}
        <Card className={cn("shadow-lg", theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : '')}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", theme === 'dark' ? 'text-white' : '')}>
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Velocidad de Mejora por Materia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisData.subjectStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey="improvement" 
                    fill="#3b82f6" 
                    name="Puntos de Mejora"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamAnalyzer;