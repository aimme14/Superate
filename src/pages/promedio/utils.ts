/**
 * Utilidades para el módulo de análisis ICFES.
 */

import { TEST_NAME_MAP } from "./constants";
import type { AnalysisData, SubjectWithTopics } from "./types";

/** Mapea nombres de pruebas a nombres descriptivos para visualización. */
export function getTestDisplayName(testName: string): string {
  return TEST_NAME_MAP[testName] || testName;
}

/** Extrae el dominio de una URL de forma segura para mostrarlo en UI. */
export function getLinkDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Obtiene trofeo y colores según el puesto en ranking. */
export function getRankTrophyAndColors(rank: number) {
  if (rank === 1) {
    return {
      trophy: "🏆",
      bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      borderColor: "#fbbf24",
      textColor: "#92400e",
      detailColor: "#78350f",
    };
  }
  if (rank === 2) {
    return {
      trophy: "🥈",
      bgGradient: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
      borderColor: "#94a3b8",
      textColor: "#475569",
      detailColor: "#334155",
    };
  }
  if (rank === 3) {
    return {
      trophy: "🥉",
      bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)",
      borderColor: "#fb923c",
      textColor: "#9a3412",
      detailColor: "#7c2d12",
    };
  }
  return {
    trophy: "🏅",
    bgGradient: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
    borderColor: "#9ca3af",
    textColor: "#4b5563",
    detailColor: "#374151",
  };
}

/** Determina el nivel de desempeño basado en el puntaje. */
export function getPerformanceLevel(score: number): { level: string; definition: string } {
  if (score >= 80) {
    return {
      level: "Nivel Alto",
      definition: "Demuestra dominio adecuado de las competencias evaluadas.",
    };
  }
  if (score >= 60) {
    return {
      level: "Nivel Medio",
      definition: "Evidencia comprensión adecuada de los contenidos evaluados con algunas áreas de mejora.",
    };
  }
  if (score >= 40) {
    return {
      level: "Nivel Básico",
      definition: "Evidencia comprensión parcial de los contenidos fundamentales.",
    };
  }
  return {
    level: "Nivel Bajo",
    definition: "Requiere refuerzo en los contenidos fundamentales de la materia.",
  };
}

const SUBJECT_ORDER: Record<string, number> = {
  Matemáticas: 1,
  Lenguaje: 2,
  "Ciencias Sociales": 3,
  Biologia: 4,
  Quimica: 5,
  Física: 6,
  Inglés: 7,
};

/** Prepara datos de gráficos por materia y tema a través de las 3 fases. */
export function prepareSubjectTopicsData(
  phase1Data: AnalysisData | null,
  phase2Data: AnalysisData | null,
  phase3Data: AnalysisData | null
): Array<{
  subjectName: string;
  topics: Array<{
    topic: string;
    phase1: number | null;
    phase2: number | null;
    phase3: number | null;
  }>;
  averagePerformance: number;
  trend: "up" | "down" | "stable";
}> {
  const allSubjects = new Set<string>();
  [phase1Data, phase2Data, phase3Data].forEach((data) => {
    data?.subjectsWithTopics?.forEach((s: SubjectWithTopics) => allSubjects.add(s.name));
  });

  const result = Array.from(allSubjects).map((subjectName) => {
    const phase1Subject = phase1Data?.subjectsWithTopics?.find((s) => s.name === subjectName);
    const phase2Subject = phase2Data?.subjectsWithTopics?.find((s) => s.name === subjectName);
    const phase3Subject = phase3Data?.subjectsWithTopics?.find((s) => s.name === subjectName);

    const allTopics = new Set<string>();
    [phase1Subject, phase2Subject, phase3Subject].forEach((s) => {
      s?.topics.forEach((t) => allTopics.add(t.name));
    });

    const topics = Array.from(allTopics).map((topicName) => {
      const phase1Topic = phase1Subject?.topics.find((t) => t.name === topicName);
      const phase2Topic = phase2Subject?.topics.find((t) => t.name === topicName);
      const phase3Topic = phase3Subject?.topics.find((t) => t.name === topicName);
      return {
        topic: topicName,
        phase1: phase1Topic ? phase1Topic.percentage : null,
        phase2: phase2Topic ? phase2Topic.percentage : null,
        phase3: phase3Topic ? phase3Topic.percentage : null,
      };
    });

    const phase1Percentage = phase1Subject?.percentage ?? null;
    const phase2Percentage = phase2Subject?.percentage ?? null;
    const phase3Percentage = phase3Subject?.percentage ?? null;
    const validPercentages = [phase1Percentage, phase2Percentage, phase3Percentage].filter(
      (p): p is number => p !== null
    );
    const averagePerformance =
      validPercentages.length > 0
        ? validPercentages.reduce((sum, p) => sum + p, 0) / validPercentages.length
        : 0;

    let trend: "up" | "down" | "stable" = "stable";
    let firstPhase: number | null = null;
    let lastPhase: number | null = null;
    if (phase1Percentage !== null) firstPhase = phase1Percentage;
    lastPhase =
      phase3Percentage ?? phase2Percentage ?? phase1Percentage ?? null;

    if (firstPhase !== null && lastPhase !== null && firstPhase !== lastPhase) {
      const difference = lastPhase - firstPhase;
      const percentageChange = (difference / firstPhase) * 100;
      if (Math.abs(percentageChange) >= 2) {
        trend = percentageChange > 0 ? "up" : "down";
      }
    }

    return {
      subjectName,
      topics,
      averagePerformance,
      trend,
    };
  });

  result.sort((a, b) => {
    const orderA = SUBJECT_ORDER[a.subjectName] ?? 999;
    const orderB = SUBJECT_ORDER[b.subjectName] ?? 999;
    return orderA - orderB;
  });

  return result;
}
