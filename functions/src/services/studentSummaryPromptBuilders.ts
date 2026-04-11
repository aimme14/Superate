/**
 * Prompts por fase para el resumen académico con IA (sin condicionales de fase mezclados).
 * Separado del servicio para mantenibilidad y medición de tamaño.
 */

/** Subconjunto de métricas usado en los prompts (alineado con GlobalMetrics del servicio) */
export interface PromptGlobalMetrics {
  nivelGeneralDesempeno: string;
  materiasFuertes: string[];
  materiasDebiles: string[];
  debilidadesLeves: { materia: string; tema: string; puntaje: number }[];
  debilidadesEstructurales: { materia: string; tema: string; puntaje: number }[];
  patronesGlobalesTiempo?: {
    promedioGeneralSegundos: number;
    porcentajeImpulsividad: number;
    porcentajeDificultadCognitiva: number;
  };
}

/** Regla MCER / Inglés — referencia única en todos los prompts */
export const INGLES_MCER_RULE = `Inglés: enfócate solo en el nivel MCER (A1–C2); identifica el nivel y explícalo en lenguaje claro. Prohibido referirse a "prueba 1", "pruebas del 1 al 7" o numeración de ítems.`;

/** Pie de formato JSON compartido (estructura esperada por el parser del servicio) */
export const JSON_OUTPUT_CLOSING = `Responde ÚNICAMENTE con un objeto JSON válido (sin markdown fuera del JSON).`;

// --- Tipos locales para payloads serializados en el prompt ---

export interface MateriaPhase1Payload {
  materia: string;
  nivel: string;
  puntaje: number;
  competencias: Record<string, string>;
  temasDetallados: Array<{
    tema: string;
    puntaje: number;
    nivel: string;
    totalPreguntas: number;
    correctas: number;
    tiempoPromedioSegundos?: number;
    patronTiempo?: string;
  }>;
  tiempoPromedioPorPregunta?: number;
  patronesTiempo?: { impulsividad: number; dificultadCognitiva: number };
}

/**
 * Payload por materia **solo para Fase II y III** (lo que se envía al modelo).
 * No incluye puntajes numéricos, tiempos, temasDetallados ni conteos: únicamente
 * nivel global de la materia y mapa tema/competencia → nivel cualitativo.
 */
export interface MateriaPhase23Payload {
  materia: string;
  nivel: string;
  competencias: Record<string, string>;
}

export interface AcademicContextPrompt {
  grado?: string;
  nivel?: string;
}

export interface PreviousPhaseBundle {
  phase: string;
  metrics: PromptGlobalMetrics;
  fullSummary?: {
    resumen?: {
      resumen_general?: string;
      analisis_competencial?: string | Record<string, string>;
      fortalezas_academicas?: string[];
      aspectos_por_mejorar?: string[];
      justificacion_pedagogica?: {
        contenidos_prioritarios?: Array<{ materia: string; tema: string; justificacion: string }>;
      };
    };
  };
}

function formatPhase1MateriasBlock(rows: MateriaPhase1Payload[]): string {
  return rows
    .map(
      (r) => `**${r.materia}**
- Nivel de desempeño: ${r.nivel} (Puntaje: ${r.puntaje.toFixed(1)}%)
- Competencias/Temas evaluados:
${r.temasDetallados
  .map(
    (t) =>
      `  • ${t.tema}: ${t.puntaje.toFixed(1)}% (${t.correctas}/${t.totalPreguntas} correctas)${t.tiempoPromedioSegundos ? ` - Tiempo promedio: ${t.tiempoPromedioSegundos.toFixed(1)}s` : ''}${t.patronTiempo ? ` - Patrón: ${t.patronTiempo === 'impulsivo' ? 'Impulsividad (respuestas rápidas e incorrectas)' : t.patronTiempo === 'dificultad_cognitiva' ? 'Dificultad cognitiva (respuestas lentas e incorrectas)' : 'Normal'}` : ''}`
  )
  .join('\n')}
${r.tiempoPromedioPorPregunta ? `- Tiempo promedio por pregunta: ${r.tiempoPromedioPorPregunta.toFixed(1)} segundos` : ''}
${r.patronesTiempo ? `- Patrones de tiempo: ${r.patronesTiempo.impulsividad.toFixed(1)}% impulsividad, ${r.patronesTiempo.dificultadCognitiva.toFixed(1)}% dificultad cognitiva` : ''}`
    )
    .join('\n');
}

/**
 * Serializa únicamente { materia, nivel, competencias } por materia (nada más llega al modelo).
 */
export function formatPhase23MateriasBlock(rows: MateriaPhase23Payload[]): string {
  return rows
    .map((r) =>
      JSON.stringify(
        {
          materia: r.materia,
          nivel: r.nivel,
          competencias: r.competencias,
        },
        null,
        2
      )
    )
    .join('\n\n');
}

function formatGlobalMetricsPhase1(gm: PromptGlobalMetrics): string {
  let s = `- Nivel general de desempeño: ${gm.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${gm.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requieren fortalecimiento: ${gm.materiasDebiles.join(', ') || 'Ninguna'}`;
  if (gm.debilidadesLeves.length > 0) {
    s += `\n- Debilidades leves (35-39%): ${gm.debilidadesLeves.map((d) => `${d.materia} - ${d.tema} (${d.puntaje.toFixed(1)}%)`).join(', ')}`;
  }
  if (gm.debilidadesEstructurales.length > 0) {
    s += `\n- Debilidades estructurales (<35%): ${gm.debilidadesEstructurales.map((d) => `${d.materia} - ${d.tema} (${d.puntaje.toFixed(1)}%)`).join(', ')}`;
  }
  if (gm.patronesGlobalesTiempo) {
    s += `\n- Patrones globales de tiempo:
  • Tiempo promedio por pregunta: ${gm.patronesGlobalesTiempo.promedioGeneralSegundos.toFixed(1)} s
  • Impulsividad (rápidas e incorrectas): ${gm.patronesGlobalesTiempo.porcentajeImpulsividad.toFixed(1)}%
  • Dificultad cognitiva (lentas e incorrectas): ${gm.patronesGlobalesTiempo.porcentajeDificultadCognitiva.toFixed(1)}%`;
  }
  return s;
}

function formatGlobalMetricsPhase23(gm: PromptGlobalMetrics): string {
  return `- Nivel general de desempeño: ${gm.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${gm.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requieren fortalecimiento: ${gm.materiasDebiles.join(', ') || 'Ninguna'}`;
}

function buildJustificacionPedagogicaTemplate(gm: PromptGlobalMetrics): string {
  const imp = gm.patronesGlobalesTiempo && gm.patronesGlobalesTiempo.porcentajeImpulsividad > 10;
  const dif = gm.patronesGlobalesTiempo && gm.patronesGlobalesTiempo.porcentajeDificultadCognitiva > 10;
  const est = gm.debilidadesEstructurales.length > 0;
  const lev = gm.debilidadesLeves.length > 0;

  const parts: string[] = [];
  if (imp) parts.push(`"impulsividad": ["Estrategia 1…", "Estrategia 2…"]`);
  if (dif) parts.push(`"dificultad_cognitiva": ["Estrategia 1…", "Estrategia 2…"]`);
  if (est) parts.push(`"debilidades_estructurales": ["Estrategia 1…", "Estrategia 2…"]`);
  if (lev) parts.push(`"debilidades_leves": ["Estrategia 1…", "Estrategia 2…"]`);
  const estrategiasInner = parts.length ? parts.join(',\n      ') : '';

  return `"justificacion_pedagogica": {
    "contenidos_prioritarios": [
      {
        "materia": "Nombre de la materia",
        "tema": "Nombre del tema/competencia",
        "justificacion": "Fundamenta por qué se prioriza (40-60 palabras): severidad, impacto, estándares del grado, patrones de tiempo.",
        "tipo_actividad_recomendada": "Tipo de actividad más efectiva según el patrón (20-30 palabras)."
      }
    ]${estrategiasInner ? `,\n    "estrategias_por_patron": {\n      ${estrategiasInner}\n    }` : ''}
  }`;
}

/** Fase I — diagnóstico pedagógico */
export function buildPhase1Prompt(params: {
  materiasData: MateriaPhase1Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
}): string {
  const { materiasData, globalMetrics, academicContext, materiasLista } = params;

  return `Actúa como doctor en educación, especialista en diagnóstico pedagógico y evaluación tipo ICFES/Saber 11. Tu enfoque es comprender el perfil de desempeño para fundamentar la intervención.

Incluye competencias del ICFES, diagnóstico integral, patrones de tiempo (impulsividad vs dificultad cognitiva), estándares por grado e intervención pedagógica.

Redacción: técnica y comprensible para familias; explica términos como "competencias" o "desempeño".

═══════════════════════════════════════════════════════════════
CONTEXTO ACADÉMICO
═══════════════════════════════════════════════════════════════
Fase evaluativa ACTUAL: Fase I
${academicContext.grado ? `Grado: ${academicContext.grado}` : 'Grado: No especificado'}

═══════════════════════════════════════════════════════════════
RESULTADOS POR MATERIA — Fase I
═══════════════════════════════════════════════════════════════
${formatPhase1MateriasBlock(materiasData)}

═══════════════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase I
═══════════════════════════════════════════════════════════════
${formatGlobalMetricsPhase1(globalMetrics)}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES — Fase I (diagnóstico)
═══════════════════════════════════════════════════════════════
- Basa el análisis solo en Fase I. No compares con otros estudiantes.
- Usa porcentajes internamente para razonar; en el texto para familia prioriza lenguaje cualitativo.
- Diferencia debilidades leves (35-39%) vs estructurales (<35%).
- Interpreta patrones de tiempo e indica tipos de actividad más efectivos según el patrón.
- ${INGLES_MCER_RULE}
- Sin saludos ni despedidas; sin lenguaje clínico.
- "analisis_competencial" debe ser un objeto JSON con exactamente una clave por materia (${materiasLista}); cada valor es el análisis de esa materia.

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════
{
  "resumen_general": "150-200 palabras. Visión global del estado en las 7 materias (orden sugerido: Biología, Ciencias Sociales, Física, Matemáticas, Química, Lenguaje, Inglés con nivel MCER). Sin listar temas finos; cierra con compromiso de estudio.",
  "analisis_competencial": { "Matemáticas": "…", "Lenguaje": "…", "Ciencias Sociales": "…", "Biologia": "…", "Quimica": "…", "Física": "…", "Inglés": "…" },
  "fortalezas_academicas": ["…", "…", "…"],
  "aspectos_por_mejorar": ["…", "…", "…"],
  "recomendaciones_enfoque_saber11": ["…", "…", "…"],
  ${buildJustificacionPedagogicaTemplate(globalMetrics)}
}

${JSON_OUTPUT_CLOSING}

Genera el JSON del análisis completo de Fase I.`;
}

/** Fase II — comparación con Fase I */
export function buildPhase2Prompt(params: {
  materiasData: MateriaPhase23Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
  previousPhase: PreviousPhaseBundle;
  comparativeContextBlock: string;
  phase1AnalysisBlock: string;
}): string {
  const {
    materiasData,
    globalMetrics,
    academicContext,
    materiasLista,
    previousPhase,
    comparativeContextBlock,
    phase1AnalysisBlock,
  } = params;

  const debiles = previousPhase.metrics.materiasDebiles;
  const debilesStr = debiles.length ? debiles.join(', ') : 'ninguna';

  const reglaPrimeraOracionFaseII =
    debiles.length > 0
      ? `REGLA ÚNICA (materias débiles en Fase I: ${debilesStr}): en analisis_competencial, el texto de cada una de esas materias debe empezar declarando de forma explícita si el desempeño mejoró, se mantuvo o empeoró respecto a Fase I; no repitas el nombre de la materia (ya es la clave del JSON). Varía la redacción entre materias. Si hubo mejora, incluye un reconocimiento breve. Si se mantuvo o empeoró, enfoca en hábitos de estudio y dedicación, no en culpar el plan.`
      : '';

  return `Actúa como doctor en educación, especialista en evaluación ICFES/Saber 11. Comunica con claridad a familias: explica "competencias (habilidades)", "desempeño (rendimiento)", niveles con glosas (Superior=excelente, etc.).

═══════════════════════════════════════════════════════════════
CONTEXTO ACADÉMICO
═══════════════════════════════════════════════════════════════
Fase evaluativa ACTUAL: Fase II
${academicContext.grado ? `Grado: ${academicContext.grado}` : ''}

${comparativeContextBlock}
${phase1AnalysisBlock}

═══════════════════════════════════════════════════════════════
RESULTADOS POR MATERIA — Fase II
═══════════════════════════════════════════════════════════════
${formatPhase23MateriasBlock(materiasData)}

═══════════════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase II
═══════════════════════════════════════════════════════════════
${formatGlobalMetricsPhase23(globalMetrics)}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES — Fase II
═══════════════════════════════════════════════════════════════
- Análisis principalmente en resultados de Fase II; el contexto de Fase I es para comparación explícita donde aplique.
- ${reglaPrimeraOracionFaseII ? `${reglaPrimeraOracionFaseII}\n- ` : ''}Evita redundancia entre resumen_general y analisis_competencial.
- ${INGLES_MCER_RULE}
- Sin puntajes numéricos explícitos en el texto; sin comparar con otros estudiantes; sin saludos.

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════
{
  "resumen_general": "≈100 palabras en 3 párrafos: (1) propósito de Fase II y tendencia general vs Fase I; (2) mención de materias que eran débiles (${debilesStr}) y si mejoraron/se mantuvieron/empeoraron; (3) cierre sobre dedicación o reconocimiento.",
  "analisis_competencial": { "Matemáticas": "70-100 palabras", "Lenguaje": "…", "Ciencias Sociales": "…", "Biologia": "…", "Quimica": "…", "Física": "…", "Inglés": "…" },
  "fortalezas_academicas": ["…", "…"],
  "aspectos_por_mejorar": ["…", "…"],
  "recomendaciones_enfoque_saber11": ["…", "…"]
}

Incluye obligatoriamente las 7 materias en analisis_competencial: ${materiasLista}.

${JSON_OUTPUT_CLOSING}

Genera el JSON del análisis completo de Fase II.`;
}

/** Fase III — informe estilo Saber / trayectoria */
export function buildPhase3Prompt(params: {
  materiasData: MateriaPhase23Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
  trajectoryBlock: string;
}): string {
  const { materiasData, globalMetrics, academicContext, materiasLista, trajectoryBlock } = params;

  return `Eres un evaluador con enfoque institucional ICFES / Ministerio de Educación. Informe riguroso, formal y comprensible para familias; explica términos técnicos brevemente.

═══════════════════════════════════════════════════════════════
CONTEXTO ACADÉMICO
═══════════════════════════════════════════════════════════════
Fase evaluativa ACTUAL: Fase III
${academicContext.grado ? `Grado: ${academicContext.grado}` : ''}

${trajectoryBlock}

═══════════════════════════════════════════════════════════════
RESULTADOS POR MATERIA — Fase III
═══════════════════════════════════════════════════════════════
${formatPhase23MateriasBlock(materiasData)}

═══════════════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase III
═══════════════════════════════════════════════════════════════
${formatGlobalMetricsPhase23(globalMetrics)}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES — Fase III
═══════════════════════════════════════════════════════════════
- Simula rigor de informe oficial Saber 11: competencias, niveles, coherencia entre áreas, preparación para prueba oficial.
- Integra la trayectoria Fase I → II → III sin citar puntajes numéricos explícitos.
- ${INGLES_MCER_RULE}
- Sin comparar con otros estudiantes; sin lenguaje clínico; sin saludos.

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════
{
  "resumen_general": "300-400 palabras: estado tras Fase I y II, condición frente a Saber 11, síntesis integral.",
  "analisis_competencial": "300-400 palabras: texto continuo institucional (puede usar términos técnicos explicados).",
  "fortalezas_academicas": ["…", "…"],
  "aspectos_por_mejorar": ["…", "…"],
  "recomendaciones_enfoque_saber11": ["…", "…"]
}

${JSON_OUTPUT_CLOSING}

Materias cubiertas en datos: ${materiasLista}.

Genera el JSON del análisis completo de Fase III.`;
}
