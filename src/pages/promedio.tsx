import React, { useState, useEffect, useRef, startTransition } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Link } from "react-router-dom"
import { useUserInstitution } from "@/hooks/query/useUserInstitution"
import { useStudentEvaluations } from "@/hooks/query/useStudentEvaluations"
import { useStudyPlanData } from "@/hooks/query/useStudyPlanData"
import { useThemeContext } from "@/context/ThemeContext"
import { useAuthContext } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import { getPhaseType } from "@/utils/firestoreHelpers"
import { SubjectTopicsAccordion } from "@/components/charts/SubjectTopicsAccordion"
import { StrengthsRadarChart } from "@/components/charts/StrengthsRadarChart"
import { SubjectsProgressChart } from "@/components/charts/SubjectsProgressChart"
import { SubjectsDetailedSummary } from "@/components/charts/SubjectsDetailedSummary"
import { useNotification } from "@/hooks/ui/useNotification"
import { VocabularyBank } from "@/components/studyPlan/VocabularyBank"
import { TipsICFESSection } from "@/components/studyPlan/TipsICFESSection"
import { HerramientasIASection } from "@/components/studyPlan/HerramientasIASection"
import { RutaPreparacionSubNav } from "@/components/student/RutaPreparacionSubNav"
import { RutaPreparacionPageSkeleton } from "@/components/student/RutaPreparacionPageSkeleton"
import type { TipICFES } from "@/interfaces/tipsICFES.interface"
import type { AIToolData } from "@/services/firebase/aiTools.service"
import { fetchAIToolsConsolidado1 } from "@/services/firebase/aiToolsConsolidado.service"
import { fetchTipsIAConsolidado1 } from "@/services/firebase/tipsIAConsolidado.service"
import type {
  ExamResult,
  SubjectAnalysis,
  TopicAnalysis,
  SubjectWithTopics,
  AnalysisData,
  StudyPlanData,
  ICFESAnalysisInterfaceProps,
} from './promedio/types'
import { MOTIVATIONAL_MESSAGES, STUDY_LINKS_INITIAL_PER_TOPIC, STUDY_VIDEOS_INITIAL_PER_TOPIC } from './promedio/constants'
import {
  getTestDisplayName,
  getLinkDomain,
  prepareSubjectTopicsData,
} from './promedio/utils'
import { logger } from '@/utils/logger'
import {
  clearCachedHerramientasIA,
  clearCachedIcfesTips,
} from '@/lib/rutaPreparacionLocalCache'
import { OFFLINE_USER_MESSAGE } from '@/constants/networkMessages'
import { isBrowserOffline } from '@/utils/networkError'
import {
  Brain,
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
  NotepadText,
  Shield,
  Link as LinkIcon,
  Eye,
  Lock,
  Info,
  Copy,
  ExternalLink,
  Lightbulb,
  Sparkles,
  Dumbbell,
} from "lucide-react"

// Componente de gráfico de rendimiento con materias expandibles
function PerformanceChart({ data, theme = 'light', subjectsWithTopics }: { data: SubjectAnalysis[], theme?: 'light' | 'dark', subjectsWithTopics?: SubjectWithTopics[] }) {
  // Si tenemos datos agrupados por materia y tema, usar esos
  if (subjectsWithTopics && subjectsWithTopics.length > 0) {
    return (
      <Accordion type="multiple" className="w-full">
        {subjectsWithTopics.map((subject) => (
          <AccordionItem key={subject.name} value={subject.name} className={cn("border-b", theme === 'dark' ? 'border-zinc-700' : 'border-gray-300')}>
            <AccordionTrigger className={cn("hover:no-underline py-3 md:py-2", theme === 'dark' ? 'text-white' : '')}>
              <div className="flex items-center justify-between w-full pr-4">
                <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
                <span className={cn("text-sm font-semibold", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>{subject.percentage}%</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 md:pb-2 pt-0">
              <div className={cn("space-y-3 pt-2", theme === 'dark' ? 'bg-zinc-900/50 rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3 border-gray-200')}>
                {subject.topics.map((topic) => (
                  <div key={topic.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{getTestDisplayName(topic.name)}</span>
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
            <AccordionTrigger className={cn("hover:no-underline py-3 md:py-[10px]", theme === 'dark' ? 'text-white' : '')}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-6 sm:pr-4 gap-2 sm:gap-0 text-left">
                <span className={cn("text-sm font-medium shrink-0", theme === 'dark' ? 'text-white' : '')}>{subject.name}</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                  {subject.strengths.length > 0 && (
                    <Badge className={cn("text-xs shrink-0", theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200")}>
                      {subject.strengths.length} fortaleza{subject.strengths.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {subject.neutrals.length > 0 && (
                    <Badge className={cn("text-xs shrink-0", theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800 border-gray-200")}>
                      {subject.neutrals.length} neutro{subject.neutrals.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {subject.weaknesses.length > 0 && (
                    <Badge className={cn("text-xs shrink-0", theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200")}>
                      {subject.weaknesses.length} debilidad{subject.weaknesses.length > 1 ? 'es' : ''}
                    </Badge>
                  )}
                  {!hasData && (
                    <Badge variant="outline" className={cn("text-xs shrink-0", theme === 'dark' ? 'border-zinc-600 text-gray-400' : 'border-gray-300')}>
                      Sin datos
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 md:pb-2 pt-0">
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
                          <span>{getTestDisplayName(strength)}</span>
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
                
                {/* Neutros - Siempre mostrar si hay */}
                {subject.neutrals.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')}>
                        Neutro ({subject.neutrals.length})
                      </span>
                    </div>
                    <ul className={cn("space-y-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {subject.neutrals.map((neutral, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs">
                          <Clock className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                          <span>{getTestDisplayName(neutral)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Neutro
                      </span>
                    </div>
                    <p className={cn("text-xs italic", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                      No se identificaron temas neutros en esta materia
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
                          <span>{getTestDisplayName(weakness)}</span>
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
              <Badge className={subject.percentage >= 65 ? (theme === 'dark' ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800 border-gray-200") : subject.percentage >= 50 ? (theme === 'dark' ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800 border-gray-200") : (theme === 'dark' ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800 border-gray-200")}>
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


/**
 * Sección de recursos web del plan (study_links). Grid responsive, sin tooltip nativo que solape,
 * botón copiar enlace, títulos con line-clamp y "Ver más" por tema.
 */
function StudyLinksSection({
  studyLinks,
  theme,
}: {
  studyLinks: StudyPlanData['study_links'] | undefined;
  theme: 'light' | 'dark';
}) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const { notifySuccess, notifyError } = useNotification();

  const links = studyLinks ?? [];
  if (links.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border p-4 text-center text-sm',
          theme === 'dark'
            ? 'border-zinc-600 bg-zinc-800/50 text-gray-400'
            : 'border-gray-200 bg-gray-50 text-gray-600'
        )}
      >
        No hay recursos web para esta materia. El administrador puede agregarlos en la sección de recursos (WebLinks).
      </div>
    );
  }

  const linksByTopic = links.reduce<Record<string, typeof links>>((acc, link) => {
    const topic = link.topic ?? 'Sin categorizar';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(link);
    return acc;
  }, {});
  const topics = Object.keys(linksByTopic);

  const toggleTopic = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const copyUrl = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(
      () => notifySuccess({ message: 'Enlace copiado al portapapeles' }),
      () => notifyError({ message: 'No se pudo copiar el enlace' })
    );
  };

  const isSimpleList = topics.length === 0 || (topics.length === 1 && topics[0] === 'Sin categorizar');
  const cardWrapClass = theme === 'dark'
    ? 'bg-zinc-700/50 border-zinc-600 hover:bg-zinc-700'
    : 'bg-gray-50 border-gray-200 hover:bg-gray-100';
  const titleClass = cn('font-medium line-clamp-2', theme === 'dark' ? 'text-white' : '');
  const titleClassCompact = cn('font-medium line-clamp-1 text-sm', theme === 'dark' ? 'text-white' : '');
  const descClass = cn('text-sm line-clamp-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600');
  const urlClass = cn('text-xs', theme === 'dark' ? 'text-purple-400' : 'text-purple-600');
  const iconBtnClass = cn(
    'p-1.5 rounded-md transition-colors',
    theme === 'dark' ? 'hover:bg-zinc-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
  );

  function renderLink(link: (typeof links)[number], index: number, topicLabel: string) {
    const key = link.url ? `${topicLabel}-${link.url}-${index}` : `link-${topicLabel}-${index}`;
    const domain = getLinkDomain(link.url);
    const compact = !link.description?.trim();
    return (
      <div
        key={key}
        className={cn(
          'flex flex-col rounded-lg border transition-colors',
          compact ? 'gap-1 p-2' : 'gap-2 p-3',
          cardWrapClass,
          'border'
        )}
      >
        <div className={cn('flex min-w-0', compact ? 'gap-1.5' : 'gap-2')}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('flex-1 min-w-0 flex flex-col', compact ? 'gap-0' : 'gap-0.5')}
          >
            <h4 className={compact ? titleClassCompact : titleClass}>{link.title}</h4>
            {!compact && link.description && <p className={descClass}>{link.description}</p>}
            <span className={urlClass}>{domain}</span>
          </a>
          <div className="flex flex-shrink-0 items-start gap-0.5">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={iconBtnClass}
              aria-label="Abrir enlace"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={(e) => copyUrl(e, link.url)}
              className={iconBtnClass}
              aria-label="Copiar enlace"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSimpleList) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {links.map((link, idx) => renderLink(link, idx, 'default'))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topics.map((topic) => {
        const topicLinks = linksByTopic[topic] ?? [];
        const showMore = topicLinks.length > STUDY_LINKS_INITIAL_PER_TOPIC;
        const expanded = expandedTopics.has(topic);
        const visibleLinks = showMore && !expanded
          ? topicLinks.slice(0, STUDY_LINKS_INITIAL_PER_TOPIC)
          : topicLinks;
        const hiddenCount = showMore && !expanded ? topicLinks.length - STUDY_LINKS_INITIAL_PER_TOPIC : 0;

        return (
          <div key={topic} className="space-y-3">
            <h5
              className={cn(
                'font-semibold text-sm pb-2 border-b',
                theme === 'dark' ? 'text-purple-300 border-zinc-600' : 'text-purple-700 border-gray-300'
              )}
            >
              {topic}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleLinks.map((link, idx) => renderLink(link, idx, topic))}
            </div>
            {showMore && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full text-xs',
                  theme === 'dark' ? 'text-purple-300 hover:bg-zinc-700' : 'text-purple-600 hover:bg-gray-100'
                )}
                onClick={() => toggleTopic(topic)}
              >
                {expanded ? 'Ver menos' : `Ver más (${hiddenCount} más)`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Tipo de un video del plan (video_resources). */
type PlanVideo = StudyPlanData['video_resources'][number];

/**
 * Sección de videos educativos del plan. Misma organización que Recursos Web:
 * grid responsive, botones abrir/copiar, sin tooltip que solape, "Ver más" por tema.
 */
function StudyVideosSection({
  videos,
  theme,
}: {
  videos: StudyPlanData['video_resources'] | undefined;
  theme: 'light' | 'dark';
}) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const { notifySuccess, notifyError } = useNotification();

  const list = Array.isArray(videos) ? videos : [];
  const hasVideos = list.length > 0;

  const byTopic = list.reduce<Record<string, PlanVideo[]>>((acc, video) => {
    const topic = video.topic ?? 'Sin categorizar';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(video);
    return acc;
  }, {});
  const topics = Object.keys(byTopic);

  const toggleTopic = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const copyUrl = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(
      () => notifySuccess({ message: 'Enlace copiado al portapapeles' }),
      () => notifyError({ message: 'No se pudo copiar el enlace' })
    );
  };

  const cardWrapClass = theme === 'dark'
    ? 'bg-zinc-700/50 border-zinc-600 hover:bg-zinc-700'
    : 'bg-gray-50 border-gray-200 hover:bg-gray-100';
  const titleClass = cn('font-medium line-clamp-2', theme === 'dark' ? 'text-white' : '');
  const titleClassCompact = cn('font-medium line-clamp-1 text-sm', theme === 'dark' ? 'text-white' : '');
  const descClass = cn('text-sm line-clamp-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600');
  const urlClass = cn('text-xs', theme === 'dark' ? 'text-purple-400' : 'text-purple-600');
  const iconBtnClass = cn(
    'p-1.5 rounded-md transition-colors',
    theme === 'dark' ? 'hover:bg-zinc-600 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
  );
  const isSimpleList = hasVideos && (topics.length === 0 || (topics.length === 1 && topics[0] === 'Sin categorizar'));

  function renderVideo(video: PlanVideo, index: number, topicKey: string) {
    const stableId = video.videoId || video.url || `i-${index}`;
    const key = `v-${topicKey}-${stableId}-${index}`;
    const domain = getLinkDomain(video.url);
    const compact = !video.description?.trim();
    return (
      <div
        key={key}
        className={cn(
          'flex flex-col rounded-lg border transition-colors',
          compact ? 'gap-1 p-2' : 'gap-2 p-3',
          cardWrapClass,
          'border'
        )}
      >
        <div className={cn('flex min-w-0', compact ? 'gap-1.5' : 'gap-2')}>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('flex-1 min-w-0 flex flex-col', compact ? 'gap-0' : 'gap-0.5')}
          >
            <h4 className={compact ? titleClassCompact : titleClass}>{video.title}</h4>
            {!compact && video.description && <p className={descClass}>{video.description}</p>}
            <span className={urlClass}>{domain}</span>
          </a>
          <div className="flex flex-shrink-0 items-start gap-0.5">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className={iconBtnClass}
              aria-label="Abrir video"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={(e) => copyUrl(e, video.url)}
              className={iconBtnClass}
              aria-label="Copiar enlace"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[2rem]">
      {!hasVideos && (
        <div
          className={cn(
            'rounded-lg border p-4 text-center text-sm',
            theme === 'dark'
              ? 'border-zinc-600 bg-zinc-800/50 text-gray-400'
              : 'border-gray-200 bg-gray-50 text-gray-600'
          )}
        >
          No hay videos educativos para esta materia.
        </div>
      )}
      {hasVideos && isSimpleList && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((video, idx) => renderVideo(video, idx, 'default'))}
        </div>
      )}
      {hasVideos && !isSimpleList && (
    <div className="space-y-4">
      {topics.map((topic, topicIndex) => {
        const topicVideos = byTopic[topic] ?? [];
        const topicLabel = topicVideos[0]?.topicDisplayName ?? topic;
        const showMore = topicVideos.length > STUDY_VIDEOS_INITIAL_PER_TOPIC;
        const expanded = expandedTopics.has(topic);
        const visibleVideos = showMore && !expanded
          ? topicVideos.slice(0, STUDY_VIDEOS_INITIAL_PER_TOPIC)
          : topicVideos;
        const hiddenCount = showMore && !expanded ? topicVideos.length - STUDY_VIDEOS_INITIAL_PER_TOPIC : 0;
        const sectionKey = `topic-${topicIndex}-${topic}`;

        return (
          <div key={sectionKey} className="space-y-3">
            <h5
              className={cn(
                'font-semibold text-sm pb-2 border-b',
                theme === 'dark' ? 'text-purple-300 border-zinc-600' : 'text-purple-700 border-gray-300'
              )}
            >
              {topicLabel}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleVideos.map((video, idx) => renderVideo(video, idx, topic))}
            </div>
            {showMore && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full text-xs',
                  theme === 'dark' ? 'text-purple-300 hover:bg-zinc-700' : 'text-purple-600 hover:bg-gray-100'
                )}
                onClick={() => toggleTopic(topic)}
              >
                {expanded ? 'Ver menos' : `Ver más (${hiddenCount} más)`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
      )}
    </div>
  );
}

/** Resumen de planes de estudio (solo Fase I — diagnóstico). */
function StudyPlanSummary({
  phase1Data,
  user,
  theme
}: {
  phase1Data: AnalysisData | null;
  user: any;
  theme: 'light' | 'dark';
}) {
  const [phase1Stats, setPhase1Stats] = useState({ deployed: 0, pending: 0, loading: true });
  const FUNCTIONS_URL = 'https://us-central1-superate-ia.cloudfunctions.net';

  const isPlanComplete = (plan: any): boolean => {
    if (!plan) return false;
    const hasVideos = plan.video_resources && Array.isArray(plan.video_resources) && plan.video_resources.length > 0;
    const hasLinks = plan.study_links && Array.isArray(plan.study_links) && plan.study_links.length > 0;
    const hasExercises = plan.practice_exercises && Array.isArray(plan.practice_exercises) && plan.practice_exercises.length > 0;
    return hasVideos && hasLinks && hasExercises;
  };

  useEffect(() => {
    const loadPhase1Stats = async () => {
      if (!phase1Data?.subjectsWithTopics || !user?.uid) {
        setPhase1Stats({ deployed: 0, pending: 0, loading: false });
        return;
      }

      setPhase1Stats({ deployed: 0, pending: 0, loading: true });
      const subjectsWithWeaknesses = phase1Data.subjectsWithTopics.filter((s) =>
        Array.isArray(s.weaknesses) ? s.weaknesses.length > 0 : false
      );
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
          logger.error(`Error verificando plan para ${subject.name} (Fase I):`, error);
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

  const totalPhase1Subjects = phase1Data?.subjectsWithTopics?.length || 0;

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
              Resumen de planes de estudio
            </h3>
            <p className={cn(
              "text-sm sm:text-base mt-1",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Plan personalizado con IA según tu diagnóstico (Fase I)
            </p>
          </div>
        </div>

        <Card className={cn(
          theme === 'dark' 
            ? 'bg-zinc-800/50 border-zinc-700 max-w-xl mx-auto' 
            : 'bg-white/80 border-gray-200 max-w-xl mx-auto'
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
                  Fase I — Diagnóstico
                </h4>
              </div>
              <Badge className="bg-blue-500 text-white">Plan IA</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Materias evaluadas
                </span>
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {totalPhase1Subjects}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Planes generados
                </span>
                <span className={cn("font-semibold text-blue-500", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                  {phase1Stats.loading ? '...' : phase1Stats.deployed}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Pendientes por generar
                </span>
                <span className={cn("font-semibold text-orange-500", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')}>
                  {phase1Stats.loading ? '...' : phase1Stats.pending}
                </span>
              </div>
            </div>
            <p className={cn(
              "text-xs mt-4 pt-4 border-t",
              theme === 'dark' ? 'text-gray-500 border-zinc-700' : 'text-gray-500 border-gray-200'
            )}>
              Selecciona <strong>Fase I</strong> arriba para ver y generar tu plan de estudio personalizado.
            </p>
          </CardContent>
        </Card>

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
                Información
              </p>
              <p className={cn(
                "text-xs leading-relaxed",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                El plan de estudio con inteligencia artificial se genera a partir de los resultados de la <strong>Fase I</strong>. 
                La Fase III (simulacro ICFES) no incluye plan de estudio adicional.
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
  studentId, 
  theme = 'light' 
}: { 
  subjectsWithTopics: SubjectWithTopics[];
  studentId: string;
  theme?: 'light' | 'dark';
}) {
  const phase = 'first' as const;
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [expandedSection] = useState<Record<string, string | null>>({});
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const { notifySuccess, notifyError } = useNotification();

  const {
    subjectAuthorizations,
    studyPlans,
    studentGrade,
    loadingPlans,
    loadingAuthorizations,
    addPlanLocally,
  } = useStudyPlanData(studentId, phase, subjectsWithTopics);

  const FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || 'https://us-central1-superate-ia.cloudfunctions.net';

  // Generar plan de estudio para una materia
  const generateStudyPlan = async (subject: string) => {
    const gradeForApi = studentGrade;
    if (!gradeForApi) {
      notifyError({
        title: 'Grado requerido',
        message: 'No se pudo obtener el grado del estudiante. Asigna un grado al estudiante para generar el plan de estudio.',
      });
      return;
    }
    setGeneratingFor(subject);
    let clearedInRaf = false;
    try {
      // Iniciar generación del plan (esto puede tardar varios minutos). Siempre enviamos grado en formato nombre (Sexto, Décimo, Undécimo).
      const response = await fetch(`${FUNCTIONS_URL}/generateStudyPlan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          phase,
          subject,
          grade: gradeForApi,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const planData = result.data;
        notifySuccess({
          title: 'Plan generado exitosamente',
          message: `El plan de estudio para ${subject} se ha generado correctamente.`
        });
        clearedInRaf = true;
        addPlanLocally(subject, planData);
        setTimeout(() => setGeneratingFor(null), 80);
      } else {
        const errorMessage = result.error?.message || 'No se pudo generar el plan de estudio';
        logger.error('Error generando plan:', errorMessage);
        notifyError({
          title: 'Error al generar plan',
          message: errorMessage.includes('truncada') || errorMessage.includes('mal formada')
            ? 'La respuesta del sistema fue demasiado larga. Por favor, intenta generar el plan nuevamente. El banco de vocabulario está disponible mientras tanto.'
            : errorMessage
        });
      }
    } catch (error: unknown) {
      logger.error('Error generando plan de estudio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al generar el plan de estudio';
      notifyError({
        title: 'Error al generar plan',
        message: errorMessage.includes('truncada') || errorMessage.includes('mal formada')
          ? 'La respuesta del sistema fue demasiado larga. Por favor, intenta generar el plan nuevamente. El banco de vocabulario está disponible mientras tanto.'
          : errorMessage
      });
    } finally {
      // Solo limpiar spinner aquí si no fue éxito (en éxito se limpia dentro del rAF junto con setStudyPlans)
      if (!clearedInRaf) {
        setGeneratingFor(null);
      }
    }
  };

  /** Materias con al menos una debilidad: solo estas pueden generar plan y se usan en la cascada. */
  const subjectsWithWeaknesses = subjectsWithTopics.filter((s) =>
    Array.isArray(s.weaknesses) ? s.weaknesses.length > 0 : false
  );

  /** Mensaje para materias sin debilidades: orientar al estudiante a priorizar otras materias. */
  const NO_WEAKNESSES_MESSAGE =
    'No se detectaron debilidades en esta materia. Concéntrate en fortalecer las demás materias en las que presentas debilidad.';

  // Orden de materias para mostrar (usado para cascada y listado)
  const subjectOrder: Record<string, number> = {
    'Matemáticas': 1,
    'Lenguaje': 2,
    'Ciencias Sociales': 3,
    'Biologia': 4,
    'Quimica': 5,
    'Física': 6,
    'Inglés': 7
  };

  /** Todas las materias ordenadas: se muestran en el plan (con y sin debilidades). */
  const sortedSubjects = [...subjectsWithTopics].sort((a, b) => {
    const orderA = subjectOrder[a.name] || 999;
    const orderB = subjectOrder[b.name] || 999;
    return orderA - orderB;
  });

  /** Materias con debilidades ordenadas: usadas para la lógica de cascada del botón Generar. */
  const sortedSubjectsWithWeaknesses = [...subjectsWithWeaknesses].sort((a, b) => {
    const orderA = subjectOrder[a.name] || 999;
    const orderB = subjectOrder[b.name] || 999;
    return orderA - orderB;
  });

  /**
   * Determina si una materia puede mostrar el botón "Generar Plan".
   * Solo materias con debilidades; cascada: solo la primera autorizada sin plan.
   */
  const canShowGenerateButton = (subjectName: string): boolean => {
    const hasWeaknesses = subjectsWithWeaknesses.some(s => s.name === subjectName);
    if (!hasWeaknesses) return false;

    const plan = studyPlans[subjectName];
    const isAuthorized = subjectAuthorizations[subjectName] ?? false;

    if (plan || !isAuthorized || loadingPlans || loadingAuthorizations) {
      return false;
    }

    const currentSubjectOrder = subjectOrder[subjectName] || 999;

    for (const subject of sortedSubjectsWithWeaknesses) {
      const subjectOrderValue = subjectOrder[subject.name] || 999;
      
      // Solo verificar materias anteriores en el orden
      if (subjectOrderValue >= currentSubjectOrder) {
        break; // Ya pasamos todas las materias anteriores
      }
      
      // Si hay una materia anterior autorizada sin plan, esta no puede mostrar el botón
      const isPrevAuthorized = subjectAuthorizations[subject.name] ?? false;
      const hasPrevPlan = !!studyPlans[subject.name];
      
      if (isPrevAuthorized && !hasPrevPlan) {
        return false; // Hay una materia anterior esperando
      }
    }
    
    // Si llegamos aquí, esta es la primera materia autorizada sin plan
    return true;
  };

  if (subjectsWithTopics.length === 0) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              No hay materias disponibles para el plan de estudio.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar loading mientras se cargan los planes
  if (loadingPlans) {
    return (
      <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Cargando planes de estudio...
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
        const weaknesses = Array.isArray(subject.weaknesses) ? subject.weaknesses : [];
        const hasWeaknesses = weaknesses.length > 0;
        const plan = studyPlans[subject.name];
        const isGenerating = generatingFor === subject.name;
        const isAuthorized = subjectAuthorizations[subject.name] ?? false;
        const shouldShowButton = hasWeaknesses && canShowGenerateButton(subject.name) && !!studentGrade;

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
                      {hasWeaknesses
                        ? `${weaknesses.length} debilidad(es) identificada(s)`
                        : 'Sin debilidades detectadas'}
                    </p>
                  </div>
                </div>
                {hasWeaknesses && (
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
                        ) : !studentGrade ? (
                          <>
                            <AlertTriangle className="h-3 w-3 inline mr-2" />
                            Asigna un grado al estudiante para generar el plan
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
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className={cn(
                "px-4 pb-4 pt-2",
                theme === 'dark' ? 'bg-zinc-900/30' : 'bg-gray-50/50'
              )}>

                {!hasWeaknesses && (
                  <div className="flex flex-col items-center justify-center gap-4 py-6 text-center px-2">
                    <CheckCircle2 className={cn("h-10 w-10 flex-shrink-0", theme === 'dark' ? 'text-green-400' : 'text-green-600')} aria-hidden />
                    <p className={cn("text-sm max-w-md", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {NO_WEAKNESSES_MESSAGE}
                    </p>
                    <p className={cn("text-xs max-w-md", theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}>
                      Prioriza generar el plan en las materias donde aún tengas temas débiles; así aprovechas mejor el tiempo de estudio.
                    </p>
                    <Link to="/dashboard#evaluacion">
                      <Button type="button" variant="outline" size="sm" className="gap-2">
                        Ir a evaluaciones
                      </Button>
                    </Link>
                  </div>
                )}

                {hasWeaknesses && (
                  <div key={`plan-content-${subject.name}`}>
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
                      <div key={plan.video_resources?.length ? 'videos-list' : 'videos-empty'}>
                        <StudyVideosSection videos={plan.video_resources} theme={theme} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Enlaces de estudio (fuente: WebLinks en backend) */}
                <Accordion type="single" collapsible value={expandedSection[`${subject.name}-links`] || undefined}>
                  <AccordionItem value="links">
                    <AccordionTrigger className={cn(theme === 'dark' ? 'text-white hover:text-gray-300' : '')}>
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Recursos Web ({plan.study_links?.length || 0})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <StudyLinksSection
                        studyLinks={plan.study_links}
                        theme={theme}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Banco de Vocabulario Académico (oculto para Inglés) */}
                {!['ingles', 'inglés', 'english'].includes(String(subject.name || '').trim().toLowerCase()) && (
                  <VocabularyBank materia={subject.name} theme={theme} />
                )}

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
                          const cardKey = `${subject.name}-ex-${idx}-${String(exercise.question ?? '').slice(0, 40)}`;

                          return (
                            <Card key={cardKey} className={cn(theme === 'dark' ? 'bg-zinc-700/50 border-zinc-600' : 'bg-gray-50 border-gray-200')}>
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
                              {weaknesses.map((weakness, idx) => {
                                const topicData = subject.topics.find(t => t.name === weakness);
                                return (
                                  <li key={idx}>
                                    • {getTestDisplayName(weakness)} ({topicData?.percentage || 0}%)
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={cn("flex items-center justify-center gap-2 mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {!studentGrade ? (
                              <>
                                <AlertTriangle className="h-5 w-5" />
                                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  Asigna un grado al estudiante para poder generar el plan de estudio.
                                </p>
                              </>
                            ) : (
                              <>
                                <Clock className="h-5 w-5" />
                                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  {isAuthorized
                                    ? 'El plan de estudio estará disponible después de generar el plan de la materia anterior en el orden de cascada.'
                                    : 'El plan de estudio no está autorizado para esta materia.'}
                                </p>
                              </>
                            )}
                          </div>
                          <div className={cn("p-3 rounded-lg", theme === 'dark' ? 'bg-zinc-700/30 border border-zinc-600/50' : 'bg-gray-50 border border-gray-200')}>
                            <p className={cn("text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                              Debilidades identificadas:
                            </p>
                            <ul className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {weaknesses.map((weakness, idx) => {
                                const topicData = subject.topics.find(t => t.name === weakness);
                                return (
                                  <li key={idx}>
                                    • {getTestDisplayName(weakness)} ({topicData?.percentage || 0}%)
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
export default function ICFESAnalysisInterface({ planOnly = false }: ICFESAnalysisInterfaceProps) {
  const [activeTab, setActiveTab] = useState(planOnly ? "study-plan" : "overview")
  const [selectedPhase, setSelectedPhase] = useState<'phase1' | 'phase2' | 'phase3' | 'all'>('all');
  const [mobilePhaseFilterOpen, setMobilePhaseFilterOpen] = useState(false);
  const mobilePhaseFilterRef = useRef<HTMLDivElement | null>(null);
  const [mobileOverviewDiagnosisFilterOpen, setMobileOverviewDiagnosisFilterOpen] = useState(false);
  const mobileOverviewDiagnosisFilterRef = useRef<HTMLDivElement | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [phase1Data, setPhase1Data] = useState<AnalysisData | null>(null);
  const [phase2Data, setPhase2Data] = useState<AnalysisData | null>(null);
  const [phase3Data, setPhase3Data] = useState<AnalysisData | null>(null);
  const { data: evaluationsFromQuery = [], isLoading: evaluationsLoading } = useStudentEvaluations();
  const loading = evaluationsLoading;
  const evaluations = evaluationsFromQuery;
  const { user } = useAuthContext();
  const [currentMotivationalIndex, setCurrentMotivationalIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [icfesTips, setIcfesTips] = useState<TipICFES[] | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);
  const [tipsError, setTipsError] = useState(false);
  const [herramientasIA, setHerramientasIA] = useState<AIToolData[] | null>(null);
  const [loadingHerramientasIA, setLoadingHerramientasIA] = useState(false);
  const [herramientasIAError, setHerramientasIAError] = useState(false);
  const [shouldLoadSecondary, setShouldLoadSecondary] = useState(false);
  useUserInstitution();
  const { theme } = useThemeContext();

  // Cambiar mensaje motivador cada 8 segundos con animación
  useEffect(() => {
    const interval = setInterval(() => {
      // Iniciar animación de salida
      setIsTransitioning(true);

      // Después de la animación de salida, cambiar el mensaje
      setTimeout(() => {
        setCurrentMotivationalIndex((prevIndex) => (prevIndex + 1) % MOTIVATIONAL_MESSAGES.length);
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

  // Lazy load: activar carga de Tips y Herramientas solo tras estar en tab Plan de estudio un momento
  useEffect(() => {
    if (activeTab !== 'study-plan') {
      setShouldLoadSecondary(false);
      return;
    }
    const t = setTimeout(() => setShouldLoadSecondary(true), 400);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Tips ICFES: Firestore TipsIA/consolidado_1 + caché persistente del SDK (IndexedDB); reintento fuerza servidor
  const fetchIcfesTips = React.useCallback(
    async (opts?: { forceServer?: boolean }) => {
      setLoadingTips(true);
      setTipsError(false);
      try {
        if (user?.uid) clearCachedIcfesTips(user.uid);
        const tips = await fetchTipsIAConsolidado1(opts);
        setIcfesTips(tips);
      } catch (err) {
        logger.warn('Error cargando tips ICFES:', err);
        setTipsError(true);
        setIcfesTips([]);
      } finally {
        setLoadingTips(false);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    if (activeTab !== 'study-plan' || !shouldLoadSecondary || icfesTips !== null || !user?.uid) return;
    void fetchIcfesTips();
  }, [activeTab, shouldLoadSecondary, icfesTips, user?.uid, fetchIcfesTips]);

  const loadIcfesTips = React.useCallback(() => {
    void fetchIcfesTips({ forceServer: true });
  }, [fetchIcfesTips]);

  // Herramientas IA: AI_Tools/consolidado_1 + caché persistente del SDK (IndexedDB), como TipsIA
  const loadHerramientasIA = React.useCallback(async (opts?: { forceNetwork?: boolean }) => {
    const uid = user?.uid;
    if (uid) clearCachedHerramientasIA(uid);
    setHerramientasIAError(false);
    setLoadingHerramientasIA(true);
    try {
      const tools = await fetchAIToolsConsolidado1({
        forceServer: opts?.forceNetwork === true,
      });
      const active = tools.filter((t) => t.isActive);
      setHerramientasIA(active);
    } catch {
      setHerramientasIA([]);
      setHerramientasIAError(true);
    } finally {
      setLoadingHerramientasIA(false);
    }
  }, [user?.uid]);
  useEffect(() => {
    if (activeTab !== 'study-plan' || !shouldLoadSecondary || !user?.uid) return;
    loadHerramientasIA();
  }, [activeTab, shouldLoadSecondary, loadHerramientasIA, user?.uid]);

  useEffect(() => {
    if (!mobilePhaseFilterOpen) return;

    const handlePointerOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (mobilePhaseFilterRef.current?.contains(target)) return;
      setMobilePhaseFilterOpen(false);
    };

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, [mobilePhaseFilterOpen]);

  useEffect(() => {
    if (!mobileOverviewDiagnosisFilterOpen) return;

    const handlePointerOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (mobileOverviewDiagnosisFilterRef.current?.contains(target)) return;
      setMobileOverviewDiagnosisFilterOpen(false);
    };

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, [mobileOverviewDiagnosisFilterOpen]);

  // Procesar evaluaciones desde React Query (cache compartido con Resultados)
  useEffect(() => {
    if (!user) return;

    if (evaluationsFromQuery.length === 0 && !evaluationsLoading) {
      startTransition(() => {
        setPhase1Data(null);
        setPhase2Data(null);
        setPhase3Data(null);
        setAnalysisData(null);
      });
      return;
    }

    if (evaluationsFromQuery.length === 0) return;

    const evaluationsArray = evaluationsFromQuery as ExamResult[];
    const phase1Evals = evaluationsArray.filter(e => {
      const phase = e.phase || '';
      return phase === 'first' || phase === 'fase I' || phase === 'Fase I' || getPhaseType(phase) === 'first';
    });
    const phase2Evals = evaluationsArray.filter(e => {
      const phase = e.phase || '';
      return phase === 'second' || phase === 'fase II' || phase === 'Fase II' || getPhaseType(phase) === 'second';
    });
    const phase3Evals = evaluationsArray.filter(e => {
      const phase = e.phase || '';
      return phase === 'third' || phase === 'fase III' || phase === 'Fase III' || getPhaseType(phase) === 'third';
    });

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

    const consolidatedData = calculateAllPhasesData(phase1Processed, phase2Processed, phase3Processed, user);
    /** Plan de estudio IA solo aplica a Fase I; si no hay Fase I, resumen global o Fase III según datos. */
    const phaseForPlans: 'phase1' | 'phase3' | 'all' =
      phase1Evals.length > 0 ? 'phase1' : phase3Evals.length > 0 ? 'phase3' : 'all';
    const phaseForOverview = phase3Evals.length > 0 ? 'phase3' : phase2Evals.length > 0 ? 'phase2' : phase1Evals.length > 0 ? 'phase1' : 'all';

    startTransition(() => {
      setAnalysisData(consolidatedData);
      setSelectedPhase(planOnly ? phaseForPlans : phaseForOverview);
    });

  }, [user, evaluationsFromQuery, evaluationsLoading, planOnly]);

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

      // Calcular fortalezas (temas con >= 65%), debilidades (temas con < 50%) y neutros (50% - 64%)
      // Los rangos son mutuamente excluyentes y cubren todos los casos posibles:
      // - Debilidades: 0% - 49%
      // - Neutros: 50% - 64%
      // - Fortalezas: 65% - 100%
      const strengths = topicAnalyses
        .filter(topic => topic.percentage >= 65)
        .map(topic => topic.name);
      
      const weaknesses = topicAnalyses
        .filter(topic => topic.percentage < 50)
        .map(topic => topic.name);
      
      const neutrals = topicAnalyses
        .filter(topic => topic.percentage >= 50 && topic.percentage < 65)
        .map(topic => topic.name);
      
      // Validación: todos los temas deben estar clasificados en alguna categoría
      const classifiedTopics = strengths.length + weaknesses.length + neutrals.length;
      if (classifiedTopics !== topicAnalyses.length) {
        logger.warn(`⚠️ Algunos temas no fueron clasificados correctamente en ${subject}. Total temas: ${topicAnalyses.length}, Clasificados: ${classifiedTopics}`);
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
      // Rangos mutuamente excluyentes: Debilidades (< 50%), Neutros (50-64%), Fortalezas (>= 65%)
      const strengths = topics.filter(t => t.percentage >= 65).map(t => t.name);
      const weaknesses = topics.filter(t => t.percentage < 50).map(t => t.name);
      const neutrals = topics.filter(t => t.percentage >= 50 && t.percentage < 65).map(t => t.name);
      
      // Validación: todos los temas deben estar clasificados
      const classifiedTopics = strengths.length + weaknesses.length + neutrals.length;
      if (classifiedTopics !== topics.length) {
        logger.warn(`⚠️ Algunos temas no fueron clasificados correctamente en ${subjectName} (consolidado). Total temas: ${topics.length}, Clasificados: ${classifiedTopics}`);
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

  if (loading && !planOnly) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
        <div className="container mx-auto px-4 pt-6">
          <div className="flex items-center justify-center py-20">
            <div className={cn("animate-spin rounded-full h-12 w-12 border-b-2", theme === 'dark' ? 'border-purple-400' : 'border-purple-600')}></div>
            <span className={cn("ml-3 text-lg", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Cargando análisis...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (loading && planOnly) {
    return (
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
        <div className={cn("container mx-auto", "px-3 sm:px-4 py-4 sm:py-8")}>
          <RutaPreparacionSubNav theme={theme} />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="p-1.5 md:p-2 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex-shrink-0">
                <Brain className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className={cn("text-lg md:text-xl font-bold truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Plan de estudio IA
                </h1>
                <p className={cn("hidden md:block text-xs md:text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Plan personalizado con inteligencia artificial
                </p>
              </div>
            </div>
          </div>
          <RutaPreparacionPageSkeleton theme={theme} variant="ruta" />
        </div>
      </div>
    );
  }

  if (!analysisData || evaluations.length === 0) {
    if (planOnly) {
      return (
        <div className={cn("min-h-screen", theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50')}>
          <div className={cn("container mx-auto", "px-3 sm:px-4 py-4 sm:py-8")}>
            <RutaPreparacionSubNav theme={theme} />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="p-1.5 md:p-2 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex-shrink-0">
                  <Brain className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className={cn("text-lg md:text-xl font-bold truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Plan de estudio IA
                  </h1>
                  <p className={cn("hidden md:block text-xs md:text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Plan personalizado con inteligencia artificial
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center py-12">
              <Brain className={cn("h-16 w-16 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
              <h2 className={cn("text-2xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Sin datos para el plan de estudio
              </h2>
              <p className={cn("mb-6", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Necesitas presentar al menos una evaluación para generar tu plan de estudio personalizado con IA.
              </p>
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
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <Brain className={cn("h-16 w-16 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
            <h2 className={cn("text-2xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Sin datos para analizar
            </h2>
            <p className={cn("mb-6", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Necesitas presentar al menos una evaluación para generar tu análisis inteligente.
            </p>
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
      <div
        className={cn(
          "container mx-auto",
          planOnly ? "px-3 sm:px-4 py-4 sm:py-8" : "py-4 md:py-6 px-3 md:px-4 max-w-6xl"
        )}
      >
        {planOnly && <RutaPreparacionSubNav theme={theme} />}
        {/* Título de sección: más compacto en móvil */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="p-1.5 md:p-2 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex-shrink-0">
              <Brain className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className={cn("text-lg md:text-xl font-bold truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {planOnly ? 'Plan de estudio IA' : 'Análisis Inteligente'}
              </h1>
              <p className={cn("hidden md:block text-xs md:text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {planOnly ? 'Plan personalizado con inteligencia artificial' : 'Reporte de rendimiento académico'}
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Fase: en móvil, filtro compacto seleccionable (sin desplegable) */}
        {!planOnly && (
        <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm mb-4 md:mb-8')}>
          <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
            <h3
              id="phase-selector-heading"
              className={cn("text-sm md:text-base font-semibold mb-3 md:mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}
            >
              Seleccionar Fase
            </h3>
            <div className="md:hidden grid grid-cols-2 gap-2" role="group" aria-labelledby="phase-selector-heading">
              <div className="relative" ref={mobilePhaseFilterRef}>
              <Button
                type="button"
                size="sm"
                onClick={() => setMobilePhaseFilterOpen((prev) => !prev)}
                className={cn(
                  "h-8 px-2.5 text-[11px] w-full justify-between",
                  theme === 'dark' ? 'bg-zinc-700 border border-zinc-600 text-white hover:bg-zinc-600' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                )}
                aria-expanded={mobilePhaseFilterOpen}
                aria-label="Abrir filtro de fase"
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {selectedPhase === 'phase1'
                    ? 'Fase I'
                    : selectedPhase === 'phase2'
                    ? 'Fase II'
                    : selectedPhase === 'phase3'
                    ? 'Fase III'
                    : 'Todas'}
                </span>
                <Badge className="text-[10px] bg-blue-600">
                  Filtro
                </Badge>
              </Button>

              {mobilePhaseFilterOpen && (
                <div
                  className={cn(
                    "absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-lg border p-2 shadow-md",
                    theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      onClick={() => { setSelectedPhase('phase1'); setMobilePhaseFilterOpen(false) }}
                      variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
                      size="sm"
                      className={cn("h-8 px-2 text-[11px]", selectedPhase === 'phase1' ? 'bg-blue-600 hover:bg-blue-700 text-white' : '')}
                      disabled={!phase1Data}
                    >
                      Fase I
                    </Button>
                    <Button
                      onClick={() => { setSelectedPhase('phase2'); setMobilePhaseFilterOpen(false) }}
                      variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
                      size="sm"
                      className={cn("h-8 px-2 text-[11px]", selectedPhase === 'phase2' ? 'bg-green-600 hover:bg-green-700 text-white' : '')}
                      disabled={!phase2Data || activeTab === 'study-plan'}
                    >
                      Fase II
                    </Button>
                    <Button
                      onClick={() => { setSelectedPhase('phase3'); setMobilePhaseFilterOpen(false) }}
                      variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
                      size="sm"
                      className={cn("h-8 px-2 text-[11px]", selectedPhase === 'phase3' ? 'bg-orange-600 hover:bg-orange-700 text-white' : '')}
                      disabled={!phase3Data || activeTab === 'study-plan'}
                    >
                      Fase III
                    </Button>
                    <Button
                      onClick={() => { setSelectedPhase('all'); setMobilePhaseFilterOpen(false) }}
                      variant={selectedPhase === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={cn("h-8 px-2 text-[11px]", selectedPhase === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : '')}
                      disabled={activeTab === 'study-plan' || planOnly}
                    >
                      Todas
                    </Button>
                  </div>
                </div>
              )}
              </div>
              <div
                className="relative"
                role="group"
                aria-labelledby="phase-selector-heading"
                ref={mobileOverviewDiagnosisFilterRef}
              >
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setMobileOverviewDiagnosisFilterOpen((prev) => !prev)
                    setMobilePhaseFilterOpen(false)
                  }}
                  className={cn(
                    "h-8 px-2.5 text-[11px] w-full justify-between",
                    theme === 'dark' ? 'bg-zinc-700 border border-zinc-600 text-white hover:bg-zinc-600' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                  )}
                  aria-expanded={mobileOverviewDiagnosisFilterOpen}
                  aria-label="Abrir filtro de Resumen o Diagnóstico"
                >
                  <span className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    {activeTab === 'diagnosis' ? 'Diagnóstico' : 'Resumen'}
                  </span>
                  <Badge className="text-[10px] bg-blue-600 px-1 py-0">
                    Filtro
                  </Badge>
                </Button>

                {mobileOverviewDiagnosisFilterOpen && (
                  <div
                    className={cn(
                      "absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-lg border p-2 shadow-md",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        onClick={() => {
                          setActiveTab('overview')
                          setMobileOverviewDiagnosisFilterOpen(false)
                        }}
                        variant={activeTab === 'overview' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "h-8 px-2 text-[11px]",
                          activeTab === 'overview' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
                        )}
                      >
                        Resumen
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveTab('diagnosis')
                          setMobileOverviewDiagnosisFilterOpen(false)
                        }}
                        variant={activeTab === 'diagnosis' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "h-8 px-2 text-[11px]",
                          activeTab === 'diagnosis' ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                        )}
                      >
                        Diagnóstico
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div
              className="hidden md:flex md:flex-wrap gap-2"
              role="group"
              aria-labelledby="phase-selector-heading"
            >
                <Button
                  onClick={() => setSelectedPhase('phase1')}
                  variant={selectedPhase === 'phase1' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedPhase === 'phase1'}
                  aria-label="Ver resultados de Fase I, diagnóstico"
                  className={cn(
                    "flex-shrink-0 min-h-[44px] md:min-h-0",
                    selectedPhase === 'phase1'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase1Data}
                >
                  <Target className="h-4 w-4 mr-1.5" />
                  Fase I
                  {phase1Data && (
                    <Badge className={cn("ml-1.5 text-xs", selectedPhase === 'phase1' ? 'bg-blue-500' : 'bg-gray-500')}>
                      {phase1Data.subjects.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedPhase('phase2')}
                  variant={selectedPhase === 'phase2' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedPhase === 'phase2'}
                  aria-label="Ver resultados de Fase II, refuerzo"
                  className={cn(
                    "flex-shrink-0 min-h-[44px] md:min-h-0",
                    selectedPhase === 'phase2'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase2Data || activeTab === 'study-plan'}
                >
                  <Target className="h-4 w-4 mr-1.5" />
                  Fase II
                  {phase2Data && (
                    <Badge className={cn("ml-1.5 text-xs", selectedPhase === 'phase2' ? 'bg-green-500' : 'bg-gray-500')}>
                      {phase2Data.subjects.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedPhase('phase3')}
                  variant={selectedPhase === 'phase3' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedPhase === 'phase3'}
                  aria-label="Ver resultados de Fase III, simulacro ICFES"
                  className={cn(
                    "flex-shrink-0 min-h-[44px] md:min-h-0",
                    selectedPhase === 'phase3'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={!phase3Data || activeTab === 'study-plan'}
                >
                  <Target className="h-4 w-4 mr-1.5" />
                  Fase III
                  {phase3Data && (
                    <Badge className={cn("ml-1.5 text-xs", selectedPhase === 'phase3' ? 'bg-orange-500' : 'bg-gray-500')}>
                      {phase3Data.subjects.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedPhase('all')}
                  variant={selectedPhase === 'all' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={selectedPhase === 'all'}
                  aria-label="Ver todas las fases consolidadas"
                  className={cn(
                    "flex-shrink-0 min-h-[44px] md:min-h-0",
                    selectedPhase === 'all'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : theme === 'dark' ? 'border-zinc-600 bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-transparent border-gray-300'
                  )}
                  disabled={activeTab === 'study-plan' || planOnly}
                >
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Todas
                </Button>
              </div>
          </CardContent>
        </Card>
        )}

        {/* Main Tabs o contenido de Plan de Estudio (cuando planOnly) */}
        <Tabs
          value={planOnly ? "study-plan" : activeTab}
          onValueChange={(value) => {
            if (!planOnly) setActiveTab(value);
            if (value === 'study-plan') setSelectedPhase('phase1');
          }}
          className="space-y-3 md:space-y-5"
        >
          {!planOnly && (
          <TabsList className={cn("hidden md:flex w-full flex-row items-stretch gap-2 h-auto min-h-[40px] py-1.5 md:py-0", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/80 border-gray-200 shadow-md backdrop-blur-sm')}>
            <TabsTrigger value="overview" className={cn("flex-1 min-w-0 flex items-center justify-center gap-1.5 min-h-[40px] py-2 md:py-0 text-xs md:text-sm", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 border-gray-200')}>
              <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="diagnosis" className={cn("flex-1 min-w-0 flex items-center justify-center gap-1.5 min-h-[40px] py-2 md:py-0 text-xs md:text-sm", theme === 'dark' ? 'data-[state=active]:bg-zinc-700 data-[state=active]:text-white' : 'data-[state=active]:bg-green-100 data-[state=active]:text-green-700 border-gray-200')}>
              <Target className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </TabsTrigger>
          </TabsList>
          )}

          {/* Overview Tab: tarjetas pegadas a Resumen/Diagnóstico */}
          <TabsContent value="overview" className="space-y-4 md:space-y-5 mt-0 md:mt-0">
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
                <div className="space-y-4 md:space-y-5" key="overview-content">
                  <section aria-label="Resumen de métricas">
                    <div className="grid grid-cols-6 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-3">
                    <Card className={cn("col-span-3 lg:col-span-1", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md')}>
                      <CardContent className="p-2 md:py-5 md:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("text-base md:text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{currentData.overall.score}</p>
                            <p className={cn("text-xs md:text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {selectedPhase === 'all' ? 'Puntaje Global' : `Puntaje de Fase ${currentData.overall.currentPhase}`}
                            </p>
                          </div>
                          <Award className="h-4 w-4 md:h-8 md:w-8 text-yellow-500 flex-shrink-0" />
                        </div>
                  {selectedPhase !== 'all' && (
                    <div className={cn("flex items-center gap-2 p-2 md:p-2.5 rounded-lg mt-2 md:mt-3 border-l-4", theme === 'dark' ? 'bg-amber-500/10 border-amber-400/50' : 'bg-amber-50 border-amber-500/60')}>
                      <Dumbbell className={cn("h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
                      <span className={cn("text-xs md:text-sm font-medium", theme === 'dark' ? 'text-amber-200' : 'text-amber-900')}>
                        Sigue mejorando
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cn("col-span-3 lg:col-span-1", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md')}>
                <CardContent className="p-2 md:py-5 md:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("text-base md:text-2xl font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
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
                      <p className={cn("text-xs md:text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedPhase === 'all' 
                          ? 'Completitud General'
                          : `Porcentaje de Fase ${currentData.overall.currentPhase}`
                        }
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 md:h-8 md:w-8 text-green-500 flex-shrink-0" />
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

              <Card className={cn("col-span-2 max-md:flex max-md:h-full max-md:min-h-0 max-md:flex-col lg:col-span-1", theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-gray-200 shadow-md')}>
                <CardContent className="p-2 md:py-5 md:px-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col">
                  <div className="md:hidden flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn("text-base font-bold tabular-nums leading-none", theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                        {currentData.overall.timeSpent.toFixed(1)}m
                      </p>
                      <Clock className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                    </div>
                    <p className={cn("mt-1 line-clamp-1 text-[10px] font-medium", theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                      Tiempo promedio
                    </p>
                    <div className="mt-2 flex flex-1 flex-col justify-end">
                      <Badge
                        variant="outline"
                        className={cn(
                          'flex min-h-[2.25rem] w-full items-center justify-center px-1.5 py-1 text-center text-[10px] font-normal leading-tight',
                          theme === 'dark' ? 'border-blue-800/60 bg-blue-950/40 text-blue-200' : 'border-blue-200 bg-white/80 text-blue-900'
                        )}
                      >
                        <span className="line-clamp-2">
                          {currentData.overall.totalQuestions > 0
                            ? `${currentData.overall.totalQuestions} preguntas`
                            : 'Sin datos'}
                        </span>
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-base md:text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {currentData.overall.timeSpent.toFixed(1)}m
                        </p>
                      </div>
                      <Clock className="h-4 w-4 md:h-8 md:w-8 text-blue-500 flex-shrink-0" />
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline" className={cn(theme === 'dark' ? 'border-zinc-600 bg-zinc-700/50' : 'border-gray-300 bg-white/50')}>
                        {currentData.overall.totalQuestions > 0
                          ? `Promedio de ${currentData.overall.totalQuestions} preguntas`
                          : 'Sin datos'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "col-span-2 max-md:flex max-md:h-full max-md:min-h-0 max-md:flex-col lg:col-span-1",
                theme === 'dark' 
                  ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg'
                  : currentData.patterns.securityIssues === 0 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md'
                    : currentData.patterns.securityIssues <= 2
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md'
                    : 'bg-gradient-to-br from-red-50 to-rose-50 border-gray-200 shadow-md'
              )}>
                <CardContent className="p-2 md:py-5 md:px-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col">
                  <div className="md:hidden flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn(
                        "text-base font-bold tabular-nums leading-none",
                        currentData.patterns.securityIssues === 0 
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : currentData.patterns.securityIssues <= 2
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-red-400' : 'text-red-700'
                      )}>
                        {currentData.patterns.securityIssues}
                      </p>
                      <Shield className={cn(
                        "h-4 w-4 shrink-0",
                        currentData.patterns.securityIssues === 0 
                          ? 'text-green-500'
                          : currentData.patterns.securityIssues <= 2
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      )} aria-hidden />
                    </div>
                    <p className={cn("mt-1 line-clamp-1 text-[10px] font-medium", theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                      Intento de fraude
                    </p>
                    <div className="mt-2 flex flex-1 flex-col justify-end">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'flex min-h-[2.25rem] w-full items-center justify-center px-1.5 py-1 text-center text-[10px] font-normal leading-tight',
                          currentData.patterns.securityIssues === 0 
                            ? theme === 'dark' ? 'border-green-700 bg-green-950/40 text-green-200' : 'border-green-200 bg-green-50/90 text-green-900'
                            : currentData.patterns.securityIssues <= 2
                            ? theme === 'dark' ? 'border-yellow-700 bg-yellow-950/40 text-yellow-200' : 'border-yellow-200 bg-yellow-50/90 text-yellow-900'
                            : theme === 'dark' ? 'border-red-700 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50/90 text-red-900'
                        )}
                      >
                        <span className="line-clamp-2">
                          {currentData.patterns.securityIssues === 0 
                            ? 'Sin incidentes' 
                            : currentData.patterns.securityIssues === 1
                            ? '1 con incidentes'
                            : `${currentData.patterns.securityIssues} con incidentes`}
                        </span>
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn(
                          "text-base md:text-2xl font-bold",
                          currentData.patterns.securityIssues === 0 
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                            : currentData.patterns.securityIssues <= 2
                            ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                            : theme === 'dark' ? 'text-red-400' : 'text-red-700'
                        )}>
                          {currentData.patterns.securityIssues}
                        </p>
                        <p className={cn("text-xs md:text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Intento de fraude</p>
                      </div>
                      <Shield className={cn(
                        "h-4 w-4 md:h-8 md:w-8 flex-shrink-0",
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
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "col-span-2 max-md:flex max-md:h-full max-md:min-h-0 max-md:flex-col lg:col-span-1",
                theme === 'dark' 
                  ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg'
                  : currentData.patterns.luckPercentage < 20 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-gray-200 shadow-md'
                    : currentData.patterns.luckPercentage <= 40
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-gray-200 shadow-md'
                    : 'bg-gradient-to-br from-orange-50 to-red-50 border-gray-200 shadow-md'
              )}>
                <CardContent className="p-2 md:py-5 md:px-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col">
                  <div className="md:hidden flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={cn(
                        "text-base font-bold tabular-nums leading-none",
                        currentData.patterns.luckPercentage < 20
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                          : currentData.patterns.luckPercentage <= 40
                          ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                          : theme === 'dark' ? 'text-orange-400' : 'text-orange-700'
                      )}>
                        {currentData.patterns.luckPercentage}%
                      </p>
                      <Zap className={cn(
                        "h-4 w-4 shrink-0",
                        currentData.patterns.luckPercentage < 20
                          ? 'text-green-500'
                          : currentData.patterns.luckPercentage <= 40
                          ? 'text-yellow-500'
                          : 'text-orange-500'
                      )} aria-hidden />
                    </div>
                    <p className={cn("mt-1 line-clamp-1 text-[10px] font-medium", theme === 'dark' ? 'text-zinc-400' : 'text-gray-600')}>
                      Porcentaje de suerte
                    </p>
                    <div className="mt-2 flex flex-1 flex-col justify-end">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'flex min-h-[2.25rem] w-full items-center justify-center px-1.5 py-1 text-center text-[10px] font-normal leading-tight',
                          currentData.patterns.luckPercentage < 20
                            ? theme === 'dark' ? 'border-green-700 bg-green-950/40 text-green-200' : 'border-green-200 bg-green-50/90 text-green-900'
                            : currentData.patterns.luckPercentage <= 40
                            ? theme === 'dark' ? 'border-yellow-700 bg-yellow-950/40 text-yellow-200' : 'border-yellow-200 bg-yellow-50/90 text-yellow-900'
                            : theme === 'dark' ? 'border-orange-700 bg-orange-950/40 text-orange-200' : 'border-orange-200 bg-orange-50/90 text-orange-900'
                        )}
                      >
                        <span className="line-clamp-2">
                          {currentData.patterns.luckPercentage < 20
                            ? 'Excelente análisis' 
                            : currentData.patterns.luckPercentage <= 40
                            ? 'Respuestas reflexivas'
                            : 'Respuestas rápidas'}
                        </span>
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn(
                          "text-base md:text-2xl font-bold",
                          currentData.patterns.luckPercentage < 20
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                            : currentData.patterns.luckPercentage <= 40
                            ? theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                            : theme === 'dark' ? 'text-orange-400' : 'text-orange-700'
                        )}>
                          {currentData.patterns.luckPercentage}%
                        </p>
                        <p className={cn("text-xs md:text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Porcentaje de Suerte</p>
                      </div>
                      <Zap className={cn(
                        "h-4 w-4 md:h-8 md:w-8 flex-shrink-0",
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
                          : 'Muchas respuestas rápidas'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
                  </section>

            {/* Rendimiento por materia y Fortalezas/Debilidades */}
            {selectedPhase !== 'all' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 space-y-4 md:space-y-5 lg:space-y-0">
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                    <CardTitle className={cn("flex items-center gap-2 text-sm md:text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <PieChart className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      Rendimiento académico por materia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 md:px-6 pb-4 md:pb-6 pt-0">
                    {currentData.subjectsWithTopics.length > 0 ? (
                      <PerformanceChart data={currentData.subjects} subjectsWithTopics={currentData.subjectsWithTopics} theme={theme} />
                    ) : currentData.subjects.length > 0 ? (
                      <PerformanceChart data={currentData.subjects} theme={theme} />
                    ) : (
                      <div className={cn("flex flex-col items-center justify-center py-6 md:py-12 px-4 rounded-lg border border-dashed", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/30' : 'border-gray-300 bg-gray-50')}>
                        <PieChart className={cn("h-8 w-8 md:h-10 md:w-10 mb-2 md:mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn("text-sm font-medium text-center", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Sin datos de materias disponibles
                        </p>
                        <p className={cn("text-xs text-center mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Presenta evaluaciones para ver tu rendimiento por materia
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                  <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                    <CardTitle className={cn("flex items-center gap-2 text-sm md:text-base", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <Zap className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                      Fortalezas y Debilidades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 md:px-6 pb-4 md:pb-6 pt-0">
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
              return (
                <Card className={cn(theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700 border-dashed' : 'bg-gray-50 border-gray-200 border-dashed')}>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <TrendingUp className={cn("h-12 w-12 mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                    <p className={cn("text-sm font-medium text-center", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Completa al menos 2 fases para ver tu evolución por materia
                    </p>
                    <p className={cn("text-xs text-center mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      Selecciona una fase individual arriba para ver el detalle
                    </p>
                  </CardContent>
                </Card>
              );
            })()}
                </div>
              );
            })()}
          </TabsContent>

          {/* Diagnosis Tab */}
          <TabsContent value="diagnosis" className="space-y-4 md:space-y-8 mt-1 md:mt-2">
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
                    improvementSuggestions={
                      analysisData && analysisData.recommendations.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue="">
                          <AccordionItem
                            value="improvement-suggestions"
                            className={cn(
                              "border rounded-lg overflow-hidden",
                              theme === 'dark' ? 'border-violet-700/40 bg-zinc-800/80' : 'border-violet-200 bg-white/90'
                            )}
                          >
                            <AccordionTrigger
                              className={cn(
                                "px-4 py-4 hover:no-underline",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <Sparkles className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className={cn("font-semibold text-left text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    Sugerencias de mejora
                                  </div>
                                  <p
                                    className={cn(
                                      "text-sm max-w-2xl",
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    )}
                                  >
                                    Sugerencias generadas a partir de tus materias con menor rendimiento.
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent>
                              <div
                                className={cn(
                                  "px-4 py-4 space-y-4",
                                  theme === 'dark'
                                    ? 'bg-zinc-800/80 border-x border-violet-700/40'
                                    : 'bg-white/90 border-x border-violet-200'
                                )}
                              >
                                <div className="space-y-4">
                                  {analysisData.recommendations.map((rec, idx) => (
                                    <div
                                      key={`${rec.subject}-${rec.topic}-${idx}`}
                                      className={cn(
                                        'rounded-lg border p-4',
                                        theme === 'dark'
                                          ? 'border-zinc-600 bg-zinc-900/40'
                                          : 'border-gray-200 bg-gray-50/80'
                                      )}
                                    >
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <Badge
                                          className={cn(
                                            rec.priority === 'Alta'
                                              ? 'bg-red-600'
                                              : rec.priority === 'Media'
                                                ? 'bg-amber-600'
                                                : 'bg-slate-600'
                                          )}
                                        >
                                          {rec.priority}
                                        </Badge>
                                        <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                          {rec.subject}
                                        </span>
                                        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                          · {rec.topic}
                                        </span>
                                      </div>
                                      <p className={cn('text-sm mb-3', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                        {rec.explanation}
                                      </p>
                                      <ul className={cn('text-sm list-disc list-inside mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                        {rec.resources.map((r, j) => (
                                          <li key={j}>{r}</li>
                                        ))}
                                      </ul>
                                      <p className={cn('text-xs', theme === 'dark' ? 'text-violet-400' : 'text-violet-700')}>
                                        Tiempo estimado: {rec.timeEstimate}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : null
                    }
                  />
                </>
              );
            })()}
          </TabsContent>

          {/* Study Plan Tab */}
          <TabsContent value="study-plan" className="space-y-6">
            {(() => {
              /** Fase II: sin plan IA; mensaje claro aunque no haya aún resultados de Fase II. */
              if (selectedPhase === 'phase2') {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
                      <BookOpen className={cn('h-14 w-14 mx-auto', theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                      <h3 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Plan de estudio solo en Fase I
                      </h3>
                      <p className={cn('text-sm max-w-lg mx-auto', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        El plan personalizado con IA se genera a partir del diagnóstico de <strong>Fase I</strong>.{' '}
                        Tus resultados de Fase II puedes revisarlos en la pestaña <strong>Resumen</strong> o <strong>Diagnóstico</strong>.
                      </p>
                      {phase1Data && (
                        <Button
                          type="button"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => setSelectedPhase('phase1')}
                        >
                          Ir al plan de Fase I
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              }

              if (selectedPhase === 'all') {
                return (
                  <StudyPlanSummary 
                    phase1Data={phase1Data}
                    user={user}
                    theme={theme}
                  />
                );
              }

              if (selectedPhase === 'phase3') {
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

              if (!phase1Data?.subjectsWithTopics?.length) {
                return (
                  <Card className={cn(theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700/50 shadow-lg' : 'bg-white/90 border-gray-200 shadow-md backdrop-blur-sm')}>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <BookOpen className={cn("h-12 w-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <p className={cn("mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No hay datos de Fase I para el plan de estudio
                        </p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          Presenta la evaluación de diagnóstico (Fase I) para generar tu plan personalizado con IA.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              const subjectsWithWeaknessesCount = phase1Data.subjectsWithTopics.filter((s) =>
                Array.isArray(s.weaknesses) ? s.weaknesses.length > 0 : false
              ).length;
              const subjectsBalancedCount =
                (phase1Data.subjectsWithTopics?.length ?? 0) - subjectsWithWeaknessesCount;

              return (
                <div className="space-y-6" key="study-plan-content">
                  <div
                    className={cn(
                      'rounded-xl border p-4 flex gap-3',
                      theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-violet-200 bg-violet-50/80'
                    )}
                    role="region"
                    aria-label="Información sobre el plan de estudio con IA"
                  >
                    <Info className={cn('h-5 w-5 flex-shrink-0 mt-0.5', theme === 'dark' ? 'text-violet-400' : 'text-violet-600')} />
                    <div className={cn('text-sm space-y-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      <p className="font-medium text-base">Cómo funciona tu plan</p>
                      <p>
                        El plan con <strong>videos, enlaces y ejercicios</strong> se genera por materia donde el
                        diagnóstico detecta <strong>áreas a reforzar</strong>. Si una materia va muy bien, no hace falta
                        plan ahí: puedes enfocarte en las demás.
                      </p>
                      {subjectsBalancedCount > 0 && (
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}>
                          Tienes {subjectsBalancedCount} materia{subjectsBalancedCount !== 1 ? 's' : ''} sin debilidades
                          detectadas; revisa las que muestran debilidades para generar el plan paso a paso (orden sugerido).
                        </p>
                      )}
                    </div>
                  </div>
                  <Accordion type="single" collapsible className="mb-6">
                    <AccordionItem value="tips-icfes" className={cn("border rounded-lg overflow-hidden", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/30' : 'border-gray-200 bg-white/80')}>
                      <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", theme === 'dark' ? 'hover:bg-zinc-700/50 text-white' : 'hover:bg-gray-50')}>
                        <span id="tips-icfes-heading" className="flex items-center gap-2 text-lg font-semibold">
                          <Lightbulb className={cn("h-5 w-5 flex-shrink-0", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
                          Tips para Romperla en el ICFES - Altamente Recomendados Por La Inteligencia Artificial
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-4 pb-4 pt-1">
                          {loadingTips && (
                            <div className={cn("flex items-center justify-center gap-3 py-6 rounded-lg border", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-gray-200 bg-gray-50')}>
                              <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-amber-400' : 'border-amber-600')} />
                              <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Cargando tips...</span>
                            </div>
                          )}
                          {!loadingTips && icfesTips && icfesTips.length > 0 && (
                            <TipsICFESSection tips={icfesTips} theme={theme} />
                          )}
                          {!loadingTips && (!icfesTips || icfesTips.length === 0) && (
                            <div className={cn("flex flex-col items-center justify-center gap-3 py-6 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-gray-200 bg-gray-50')}>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {tipsError ? 'No se pudieron cargar los tips. Comprueba conexión y que exista TipsIA/consolidado_1.' : 'No hay tips disponibles en este momento.'}
                              </p>
                              <Button type="button" variant="outline" size="sm" onClick={loadIcfesTips} className={theme === 'dark' ? 'border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25' : ''}>
                                Reintentar
                              </Button>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="herramientas-ia" className={cn("mt-4 border rounded-lg overflow-hidden", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/30' : 'border-gray-200 bg-white/80')}>
                      <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", theme === 'dark' ? 'hover:bg-zinc-700/50 text-white' : 'hover:bg-gray-50')}>
                        <span id="herramientas-ia-heading" className="flex items-center gap-2 text-lg font-semibold">
                          <Sparkles className={cn("h-5 w-5 flex-shrink-0", theme === 'dark' ? 'text-teal-400' : 'text-teal-600')} />
                          Herramientas IA
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="px-4 pb-4 pt-1">
                          {loadingHerramientasIA && (
                            <div className={cn("flex items-center justify-center gap-3 py-6 rounded-lg border", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-gray-200 bg-gray-50')}>
                              <div className={cn("animate-spin rounded-full h-6 w-6 border-b-2", theme === 'dark' ? 'border-teal-400' : 'border-teal-600')} />
                              <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Cargando herramientas...</span>
                            </div>
                          )}
                          {!loadingHerramientasIA && herramientasIA && herramientasIA.length > 0 && (
                            <HerramientasIASection tools={herramientasIA} theme={theme} />
                          )}
                          {!loadingHerramientasIA && (!herramientasIA || herramientasIA.length === 0) && (
                            <div className={cn("flex flex-col items-center justify-center gap-3 py-6 rounded-lg border text-center", theme === 'dark' ? 'border-zinc-600 bg-zinc-800/50' : 'border-gray-200 bg-gray-50')}>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {herramientasIAError
                                  ? isBrowserOffline()
                                    ? OFFLINE_USER_MESSAGE
                                    : 'No se pudieron cargar las herramientas. Revisa tu conexión.'
                                  : 'No hay herramientas IA disponibles en este momento.'}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => loadHerramientasIA({ forceNetwork: true })}
                                className={theme === 'dark' ? 'border-teal-400/40 bg-teal-500/15 text-teal-100 hover:bg-teal-500/25' : ''}
                              >
                                Reintentar
                              </Button>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <PersonalizedStudyPlan
                    subjectsWithTopics={phase1Data.subjectsWithTopics}
                    studentId={user?.uid || ''}
                    theme={theme}
                  />
                </div>
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
                  {MOTIVATIONAL_MESSAGES[currentMotivationalIndex]}
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

// Re-exportar funciones de generación de PDF para StudentPhaseReports y otros consumidores
export { generatePhase1And2PDFHTML } from './promedio/pdf/phase1And2'
export { generatePhase3PDFHTML } from './promedio/pdf/phase3'