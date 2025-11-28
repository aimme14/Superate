import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/ui/card';
import { Progress } from '#/ui/progress';
import { Badge } from '#/ui/badge';
import { Button } from '#/ui/button';
import { CheckCircle2, Clock, BookOpen, Calculator, BookMarked, Leaf, BookCheck, AlertCircle } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/services/firebase/db.service';
import { quizGeneratorService } from '@/services/quiz/quizGenerator.service';
import { Link } from 'react-router-dom';
import { getAllPhases, getPhaseType } from '@/utils/firestoreHelpers';

const db = getFirestore(firebaseApp);

interface QuizResult {
  examId: string;
  examTitle: string;
  subject: string;
  phase: string;
  score: {
    correctAnswers: number;
    totalQuestions: number;
    overallPercentage: number;
  };
  completed: boolean;
  timestamp: number;
}

interface SubjectProgress {
  subject: string;
  phases: {
    first: QuizResult | null;
    second: QuizResult | null;
    third: QuizResult | null;
  };
  overallProgress: number;
  nextPhase: 'first' | 'second' | 'third' | 'completed';
}

const subjectIcons = {
  'Matemáticas': Calculator,
  'Lenguaje': BookOpen,
  'Ciencias Sociales': BookMarked,
  'Biologia': Leaf,
  'Quimica': Leaf,
  'Física': Leaf,
  'Inglés': BookCheck,
};

const phaseNames = {
  first: 'Primera Ronda',
  second: 'Segunda Ronda', 
  third: 'Tercera Ronda'
};

const phaseDescriptions = {
  first: 'Evaluación inicial para determinar tu nivel',
  second: 'Refuerzo de áreas débiles identificadas',
  third: 'Simulacro tipo ICFES final'
};

const QuizProgressTracker = () => {
  const { user } = useAuthContext();
  const [progress, setProgress] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadProgress();
    }
  }, [user?.uid]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      
      // Obtener resultados de todas las subcolecciones de fases
      const phases = getAllPhases();
      const userResults: QuizResult[] = [];
      
      // Leer de las subcolecciones de fases
      for (const phaseName of phases) {
        const phaseRef = collection(db, "results", user!.uid, phaseName);
        const phaseSnap = await getDocs(phaseRef);
        phaseSnap.docs.forEach(doc => {
          const examData = doc.data();
          userResults.push({
            ...examData,
            examId: doc.id,
            phase: getPhaseType(phaseName) || phaseName,
          } as QuizResult);
        });
      }
      
      // También leer de la estructura antigua para compatibilidad
      const oldDocRef = doc(db, "results", user!.uid);
      const oldDocSnap = await getDoc(oldDocRef);
      if (oldDocSnap.exists()) {
        const oldData = oldDocSnap.data();
        Object.entries(oldData).forEach(([examId, examData]: [string, any]) => {
          userResults.push({
            ...examData,
            examId,
          } as QuizResult);
        });
      }
      
      // Obtener materias disponibles
      const availableSubjects = quizGeneratorService.getAvailableSubjects();
      
      // Procesar progreso por materia
      const subjectProgress: SubjectProgress[] = availableSubjects.map(subject => {
        const phases = {
          first: null as QuizResult | null,
          second: null as QuizResult | null,
          third: null as QuizResult | null,
        };
        
        // Buscar resultados para esta materia
        userResults.forEach(result => {
          if (result.subject === subject) {
            if (result.phase === 'first') phases.first = result;
            else if (result.phase === 'second') phases.second = result;
            else if (result.phase === 'third') phases.third = result;
          }
        });
        
        // Calcular progreso general
        const completedPhases = [phases.first, phases.second, phases.third].filter(Boolean).length;
        const overallProgress = (completedPhases / 3) * 100;
        
        // Determinar siguiente fase
        let nextPhase: 'first' | 'second' | 'third' | 'completed' = 'first';
        if (phases.first && !phases.second) nextPhase = 'second';
        else if (phases.second && !phases.third) nextPhase = 'third';
        else if (phases.third) nextPhase = 'completed';
        
        return {
          subject,
          phases,
          overallProgress,
          nextPhase
        };
      });
      
      setProgress(subjectProgress);
    } catch (error) {
      console.error('Error cargando progreso:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPhaseStatus = (phaseResult: QuizResult | null) => {
    if (!phaseResult) return { status: 'pending', color: 'bg-gray-100', textColor: 'text-gray-600' };
    if (phaseResult.completed) return { status: 'completed', color: 'bg-green-100', textColor: 'text-green-600' };
    return { status: 'incomplete', color: 'bg-orange-100', textColor: 'text-orange-600' };
  };


  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Progreso de Evaluaciones</CardTitle>
            <CardDescription>Cargando tu progreso...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Progreso de Evaluaciones
          </CardTitle>
          <CardDescription>
            Seguimiento de tu progreso en las tres rondas de evaluación por materia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {progress.map((subjectProgress) => {
            const IconComponent = subjectIcons[subjectProgress.subject as keyof typeof subjectIcons] || BookOpen;
            
            return (
              <Card key={subjectProgress.subject} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{subjectProgress.subject}</CardTitle>
                        <CardDescription>
                          {subjectProgress.overallProgress === 100 
                            ? 'Completado - ¡Felicitaciones!' 
                            : `Progreso: ${Math.round(subjectProgress.overallProgress)}%`
                          }
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(subjectProgress.overallProgress)}%
                      </div>
                      <Progress 
                        value={subjectProgress.overallProgress} 
                        className="w-24 h-2 mt-1"
                      />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {(['first', 'second', 'third'] as const).map((phase) => {
                      const phaseResult = subjectProgress.phases[phase];
                      const phaseStatus = getPhaseStatus(phaseResult);
                      const isNextPhase = subjectProgress.nextPhase === phase;
                      
                      return (
                        <div key={phase} className="relative">
                          <div className={`p-4 rounded-lg border-2 transition-all ${
                            isNextPhase 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-200 bg-white'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">
                                {phaseNames[phase]}
                              </h4>
                              <Badge 
                                variant={phaseStatus.status === 'completed' ? 'default' : 'secondary'}
                                className={phaseStatus.color}
                              >
                                {phaseStatus.status === 'completed' ? 'Completado' : 
                                 phaseStatus.status === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3">
                              {phaseDescriptions[phase]}
                            </p>
                            
                            {phaseResult && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Puntuación:</span>
                                  <span className="font-medium">
                                    {phaseResult.score.correctAnswers}/{phaseResult.score.totalQuestions}
                                    <span className="text-gray-500 ml-1">
                                      ({phaseResult.score.overallPercentage}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Fecha:</span>
                                  <span className="font-medium">
                                    {new Date(phaseResult.timestamp).toLocaleDateString('es-ES')}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {isNextPhase && !phaseResult && (
                              <div className="mt-3">
                                <Link 
                                  to={`/quiz?subject=${encodeURIComponent(subjectProgress.subject)}&phase=${phase}`}
                                >
                                  <Button 
                                    size="sm" 
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                  >
                                    Iniciar {phaseNames[phase]}
                                  </Button>
                                </Link>
                              </div>
                            )}
                            
                            {phaseResult && phaseResult.completed && (
                              <div className="mt-3 flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-sm font-medium">Completado</span>
                              </div>
                            )}
                          </div>
                          
                          {isNextPhase && (
                            <div className="absolute -top-2 -right-2">
                              <Badge className="bg-blue-600 text-white animate-pulse">
                                Siguiente
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Resumen de progreso */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Progreso general:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={subjectProgress.overallProgress} 
                          className="w-32 h-2"
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {Math.round(subjectProgress.overallProgress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {progress.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay evaluaciones disponibles
              </h3>
              <p className="text-gray-600">
                Comienza con la primera ronda de evaluación en cualquier materia.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizProgressTracker;
