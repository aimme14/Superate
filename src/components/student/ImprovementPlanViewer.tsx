import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Video, 
  FileText, 
  Target, 
  Calendar,
  ExternalLink,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { ImprovementPlan, LearningResource } from '@/interfaces/phase.interface';
import { useNotification } from '@/hooks/ui/useNotification';

interface ImprovementPlanViewerProps {
  theme: 'light' | 'dark';
  subject?: string; // Si se especifica, muestra solo ese plan
}

const RESOURCE_ICONS = {
  video: Video,
  quiz: Target,
  exercise: CheckCircle2,
  material: FileText,
  reading: BookOpen,
};

const RESOURCE_COLORS = {
  video: 'text-red-500 bg-red-50 dark:bg-red-950/20',
  quiz: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
  exercise: 'text-green-500 bg-green-50 dark:bg-green-950/20',
  material: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20',
  reading: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20',
};

const PRIORITY_COLORS = {
  high: 'bg-red-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-gray-500 text-white',
};

export default function ImprovementPlanViewer({ theme, subject }: ImprovementPlanViewerProps) {
  const { user } = useAuthContext();
  const { notifyError } = useNotification();
  const [plans, setPlans] = useState<Record<string, ImprovementPlan>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadImprovementPlans();
    }
  }, [user, subject]);

  const loadImprovementPlans = async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      const db = getFirestore(firebaseApp);
      const plansCollection = collection(db, 'superate', 'auth', 'phase1Analyses');
      
      let q;
      if (subject) {
        q = query(
          plansCollection,
          where('studentId', '==', user.uid),
          where('subject', '==', subject)
        );
      } else {
        q = query(plansCollection, where('studentId', '==', user.uid));
      }

      const querySnapshot = await getDocs(q);
      const plansMap: Record<string, ImprovementPlan> = {};

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.improvementPlan) {
          plansMap[data.subject] = data.improvementPlan;
        }
      });

      setPlans(plansMap);
    } catch (error) {
      console.error('Error cargando planes de mejoramiento:', error);
      notifyError({ 
        title: 'Error',
        message: 'Error al cargar planes de mejoramiento'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const subjects = Object.keys(plans);
  
  if (subjects.length === 0) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className={cn('text-gray-500', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            {subject 
              ? `No hay plan de mejoramiento disponible para ${subject}. Completa la Fase 1 para generar tu plan personalizado.`
              : 'No hay planes de mejoramiento disponibles. Completa la Fase 1 para generar tus planes personalizados.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Rutas de Mejoramiento Personalizadas
          </CardTitle>
          <CardDescription>
            Planes de estudio generados por IA basados en tu rendimiento en la Fase 1
          </CardDescription>
        </CardHeader>
      </Card>

      {subject ? (
        <ImprovementPlanCard 
          subject={subject} 
          plan={plans[subject]} 
          theme={theme} 
        />
      ) : (
        <Tabs defaultValue={subjects[0]} className="w-full">
          <TabsList className={cn(
            'grid w-full',
            `grid-cols-${Math.min(subjects.length, 4)}`,
            theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
          )}>
            {subjects.map((subj) => (
              <TabsTrigger key={subj} value={subj}>
                {subj}
              </TabsTrigger>
            ))}
          </TabsList>
          {subjects.map((subj) => (
            <TabsContent key={subj} value={subj} className="mt-6">
              <ImprovementPlanCard 
                subject={subj} 
                plan={plans[subj]} 
                theme={theme} 
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

interface ImprovementPlanCardProps {
  subject: string;
  plan: ImprovementPlan;
  theme: 'light' | 'dark';
}

function ImprovementPlanCard({ subject, plan, theme }: ImprovementPlanCardProps) {
  const groupedResources = plan.resources.reduce((acc, resource) => {
    if (!acc[resource.type]) {
      acc[resource.type] = [];
    }
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, LearningResource[]>);

  return (
    <div className="space-y-6">
      {/* Resumen del plan */}
      <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className={cn('flex items-center gap-2 mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Target className="h-5 w-5 text-blue-500" />
                {subject} - Plan de Mejoramiento
              </CardTitle>
              <CardDescription>
                Enfoque principal: <strong>{plan.primaryWeakness}</strong>
              </CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {plan.estimatedTime}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            {plan.description}
          </p>
        </CardContent>
      </Card>

      {/* Recursos por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(groupedResources).map(([type, resources]) => {
          const Icon = RESOURCE_ICONS[type as keyof typeof RESOURCE_ICONS] || FileText;
          const colorClass = RESOURCE_COLORS[type as keyof typeof RESOURCE_COLORS] || 'text-gray-500 bg-gray-50';

          return (
            <Card key={type} className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
              <CardHeader>
                <CardTitle className={cn('flex items-center gap-2 text-base', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  <div className={cn('p-2 rounded-lg', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {type === 'video' ? 'Videos' : 
                   type === 'quiz' ? 'Cuestionarios' :
                   type === 'exercise' ? 'Ejercicios' :
                   type === 'reading' ? 'Lecturas' :
                   'Materiales'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {resources.map((resource, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border',
                      theme === 'dark' ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {resource.title}
                      </h4>
                      <Badge 
                        className={cn('text-xs', PRIORITY_COLORS[resource.priority])}
                      >
                        {resource.priority === 'high' ? 'Alta' : resource.priority === 'medium' ? 'Media' : 'Baja'}
                      </Badge>
                    </div>
                    <p className={cn('text-xs mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {resource.description}
                    </p>
                    {resource.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.open(resource.url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Abrir recurso
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Plan de estudio semanal */}
      {plan.studyPlan && plan.studyPlan.length > 0 && (
        <Card className={cn(theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Calendar className="h-5 w-5 text-green-500" />
              Plan de Estudio Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {plan.studyPlan.map((week, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-4 rounded-lg border-l-4',
                    theme === 'dark' ? 'border-blue-500 bg-zinc-800' : 'border-blue-500 bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">Semana {week.week}</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className={cn('font-medium text-sm mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Temas a trabajar:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {week.topics.map((topic, topicIndex) => (
                          <Badge key={topicIndex} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className={cn('font-medium text-sm mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Actividades:
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {week.activities.map((activity, activityIndex) => (
                          <li key={activityIndex} className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className={cn('font-medium text-sm mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Metas:
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {week.goals.map((goal, goalIndex) => (
                          <li key={goalIndex} className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {goal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

