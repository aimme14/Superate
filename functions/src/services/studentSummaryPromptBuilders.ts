/**
 * Prompts por fase para el resumen académico con IA.
 *
 * CAMBIOS v2 respecto a la versión anterior:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Fase I: el bloque de materias ya NO envía puntajes numéricos crudos ni
 *    conteos de correctas/total. Solo descripciones cualitativas pre-interpretadas.
 *    → El modelo genera insight pedagógico en lugar de repetir números.
 *
 * 2. Fase I: se agrega REGLA CRÍTICA anti-redundancia entre resumen_general y
 *    analisis_competencial.
 *
 * 3. Fase II: el contexto de Fase I se reduce a lo imprescindible para la comparación;
 *    no se incluye el análisis largo de IA de Fase I (evita parafraseo).
 *
 * 4. Fase III: analisis_competencial como objeto por materia (consistencia con
 *    Fases I y II). Se agrega sintesis_institucional para el texto continuo formal.
 *
 * 5. formatPhase1MateriasBlock → cualitativo (formatPhase1MateriasBlockQualitative).
 * ─────────────────────────────────────────────────────────────────────────────
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

/**
 * Payload por materia para Fase I.
 * puntaje y conteos se usan internamente para derivar etiquetas;
 * NO se serializan directamente en el prompt (ver formatPhase1MateriasBlockQualitative).
 */
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

/** Payload reducido para Fase II y III — solo nivel cualitativo y competencias */
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
    };
  };
}

export const INGLES_MCER_RULE =
  'Inglés: enfócate exclusivamente en el nivel MCER (A1–C2). ' +
  'Identifica el nivel, explícalo en lenguaje claro para la familia y sugiere la ruta de avance al siguiente nivel. ' +
  'Prohibido referirse a "prueba 1", "pruebas del 1 al 7" o numeración de ítems.';

export const JSON_OUTPUT_CLOSING =
  'Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto fuera del JSON).';

/** Convierte un puntaje numérico a descripción de severidad cualitativa. */
function severityLabel(pct: number): string {
  if (pct >= 80) return 'área consolidada (nivel Superior)';
  if (pct >= 60) return 'buen dominio con oportunidades puntuales (nivel Alto)';
  if (pct >= 40) return 'comprensión parcial, requiere refuerzo (nivel Básico)';
  if (pct >= 35) return 'debilidad leve — muy cerca del umbral Básico (nivel Bajo)';
  if (pct > 0) return 'debilidad estructural — fundamentos por construir (nivel Bajo)';
  return 'sin aciertos registrados — intervención inmediata (nivel Bajo)';
}

function patronLabel(patron?: string): string {
  if (patron === 'impulsivo') return 'respuestas rápidas e incorrectas (impulsividad)';
  if (patron === 'dificultad_cognitiva') return 'respuestas lentas e incorrectas (dificultad cognitiva)';
  return 'tiempo de respuesta normal';
}

/**
 * Serializa Fase I en formato cualitativo (sin % ni fracciones crudas en el prompt).
 */
function formatPhase1MateriasBlockQualitative(rows: MateriaPhase1Payload[]): string {
  return rows
    .map((r) => {
      const temas = r.temasDetallados
        .map((t) => {
          const sev = severityLabel(t.puntaje);
          const patronInfo = t.patronTiempo ? ` | patrón: ${patronLabel(t.patronTiempo)}` : '';
          return `  • ${t.tema}: ${sev}${patronInfo}`;
        })
        .join('\n');

      const impPct = r.patronesTiempo?.impulsividad ?? 0;
      const difPct = r.patronesTiempo?.dificultadCognitiva ?? 0;
      let patronGlobal = '';
      if (impPct > 15) {
        patronGlobal = `\n- Patrón global: impulsividad marcada (afecta ${
          impPct > 50 ? 'más de la mitad' : 'parte considerable'
        } de las respuestas)`;
      } else if (difPct > 15) {
        patronGlobal = '\n- Patrón global: dificultad cognitiva (tiempo elevado en respuestas incorrectas)';
      }

      return (
        `**${r.materia}** — Nivel general: ${r.nivel}` +
        `\nTemas evaluados:\n${temas}` +
        patronGlobal
      );
    })
    .join('\n\n');
}

/**
 * Serializa Fase II / III: materia, nivel global y competencias (sin puntajes).
 */
export function formatPhase23MateriasBlock(rows: MateriaPhase23Payload[]): string {
  return rows
    .map((r) =>
      JSON.stringify({ materia: r.materia, nivel: r.nivel, competencias: r.competencias }, null, 2)
    )
    .join('\n\n');
}

function formatGlobalMetricsPhase1(gm: PromptGlobalMetrics): string {
  let s =
    `- Nivel general: ${gm.nivelGeneralDesempeno}\n` +
    `- Materias con desempeño favorable: ${gm.materiasFuertes.join(', ') || 'Ninguna'}\n` +
    `- Materias que requieren fortalecimiento: ${gm.materiasDebiles.join(', ') || 'Ninguna'}`;

  if (gm.debilidadesLeves.length > 0) {
    s +=
      '\n- Debilidades leves (cerca del umbral Básico): ' +
      gm.debilidadesLeves.map((d) => `${d.materia} — ${d.tema}`).join(', ');
  }
  if (gm.debilidadesEstructurales.length > 0) {
    s +=
      '\n- Debilidades estructurales (sin base conceptual): ' +
      gm.debilidadesEstructurales.map((d) => `${d.materia} — ${d.tema}`).join(', ');
  }
  if (gm.patronesGlobalesTiempo) {
    const p = gm.patronesGlobalesTiempo;
    s += '\n- Patrones de tiempo globales:';
    if (p.porcentajeImpulsividad > 10) {
      s += `\n  • Impulsividad significativa (respuestas rápidas e incorrectas) — ${
        p.porcentajeImpulsividad > 50 ? 'mayoría' : 'parte importante'
      } de las preguntas`;
    }
    if (p.porcentajeDificultadCognitiva > 10) {
      s += '\n  • Dificultad cognitiva (respuestas lentas e incorrectas) detectada';
    }
    if (p.porcentajeImpulsividad <= 10 && p.porcentajeDificultadCognitiva <= 10) {
      s += '\n  • Sin patrones de tiempo problemáticos';
    }
  }
  return s;
}

function formatGlobalMetricsPhase23(gm: PromptGlobalMetrics): string {
  return (
    `- Nivel general: ${gm.nivelGeneralDesempeno}\n` +
    `- Materias con desempeño favorable: ${gm.materiasFuertes.join(', ') || 'Ninguna'}\n` +
    `- Materias que requieren fortalecimiento: ${gm.materiasDebiles.join(', ') || 'Ninguna'}`
  );
}

/** Fase I — diagnóstico pedagógico */
export function buildPhase1Prompt(params: {
  materiasData: MateriaPhase1Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
}): string {
  const { materiasData, globalMetrics, academicContext, materiasLista } = params;

  return `Eres un doctor en educación especialista en diagnóstico pedagógico y evaluación tipo ICFES/Saber 11.
Tu rol es generar un informe diagnóstico que oriente la intervención docente y comunique con claridad a las familias.
Redacción: técnica pero comprensible; explica términos como "competencias", "desempeño", "nivel MCER" la primera vez que los uses.

═══════════════════════════════════════════════════════
CONTEXTO
═══════════════════════════════════════════════════════
Fase evaluativa: Fase I (diagnóstico inicial)
${academicContext.grado ? `Grado: ${academicContext.grado}` : ''}

═══════════════════════════════════════════════════════
PERFIL POR MATERIA — Fase I
═══════════════════════════════════════════════════════
${formatPhase1MateriasBlockQualitative(materiasData)}

═══════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase I
═══════════════════════════════════════════════════════
${formatGlobalMetricsPhase1(globalMetrics)}

═══════════════════════════════════════════════════════
REGLAS OBLIGATORIAS
═══════════════════════════════════════════════════════
1. ANTI-REDUNDANCIA: "resumen_general" describe SOLO tendencias globales (nivel general, patrón de tiempo dominante, distribución de fortalezas). NO menciona materias específicas ni temas concretos; esos detalles van exclusivamente en "analisis_competencial".
2. "analisis_competencial" es un objeto con una clave por materia (${materiasLista}). Cada valor analiza ESA materia: qué competencias dominó, cuáles le fallan, qué patrón de tiempo se observa y qué tipo de actividad sería más efectiva. Sin mencionar puntajes exactos en el texto.
3. ${INGLES_MCER_RULE}
4. No compares con otros estudiantes. Sin saludos ni despedidas. Sin lenguaje clínico.
5. Diferencia debilidades leves (cerca del umbral básico) de estructurales (sin base conceptual) — y propón distintas estrategias para cada tipo.

═══════════════════════════════════════════════════════
FORMATO JSON ESPERADO
═══════════════════════════════════════════════════════
{
  "resumen_general": "120-150 palabras. Tendencia global únicamente: nivel general, patrón de tiempo dominante, distribución entre áreas. Cierra con frase motivadora orientada al estudio estratégico. Sin mencionar materias o temas específicos.",

  "analisis_competencial": {
    "Matemáticas": "80-110 palabras: competencias dominadas, vacíos detectados, patrón de tiempo si aplica, actividad recomendada.",
    "Lenguaje": "80-110 palabras",
    "Ciencias Sociales": "80-110 palabras",
    "Biologia": "80-110 palabras",
    "Quimica": "80-110 palabras",
    "Física": "80-110 palabras",
    "Inglés": "80-110 palabras — incluye nivel MCER y ruta al siguiente nivel"
  },

  "fortalezas_academicas": [
    "Fortaleza 1 (tema específico + materia + descripción breve del dominio demostrado)",
    "Fortaleza 2",
    "Fortaleza 3"
  ],

  "aspectos_por_mejorar": [
    "Aspecto 1 (qué mejorar + por qué importa para Saber 11)",
    "Aspecto 2",
    "Aspecto 3"
  ],

  "recomendaciones_enfoque_saber11": [
    "Recomendación 1 — acción concreta y aplicable",
    "Recomendación 2",
    "Recomendación 3"
  ]
}

${JSON_OUTPUT_CLOSING}`;
}

/** Fase II — comparación con Fase I (contexto compacto de Fase I, sin análisis IA completo) */
export function buildPhase2Prompt(params: {
  materiasData: MateriaPhase23Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
  previousPhase: PreviousPhaseBundle;
}): string {
  const { materiasData, globalMetrics, academicContext, materiasLista, previousPhase } = params;

  const debiles = previousPhase.metrics.materiasDebiles;
  const debilesStr = debiles.length ? debiles.join(', ') : 'ninguna';

  const impRaw = previousPhase.metrics.patronesGlobalesTiempo?.porcentajeImpulsividad ?? 0;
  const phase1ContextCompact = [
    `Nivel general en Fase I: ${previousPhase.metrics.nivelGeneralDesempeno}`,
    `Materias débiles en Fase I: ${debilesStr}`,
    previousPhase.metrics.debilidadesEstructurales.length > 0
      ? `Vacíos estructurales en Fase I: ${previousPhase.metrics.debilidadesEstructurales
          .slice(0, 4)
          .map((d) => `${d.materia}/${d.tema}`)
          .join(', ')}`
      : '',
    impRaw > 20 ? 'Patrón dominante en Fase I: impulsividad' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const reglaPrimeraOracion =
    debiles.length > 0
      ? `REGLA — materias débiles en Fase I (${debilesStr}): en "analisis_competencial", el texto de CADA UNA de esas materias debe comenzar declarando explícitamente si el desempeño mejoró, se mantuvo o empeoró respecto a Fase I. Varía la redacción entre materias. Si mejoró: reconocimiento breve. Si se mantuvo o empeoró: énfasis en hábitos y estrategia, sin culpar el plan de estudio.`
      : '';

  return `Eres un doctor en educación especialista en evaluación ICFES/Saber 11.
Comunica con claridad a familias: explica términos técnicos entre paréntesis la primera vez.

═══════════════════════════════════════════════════════
CONTEXTO
═══════════════════════════════════════════════════════
Fase evaluativa: Fase II (seguimiento y comparación)
${academicContext.grado ? `Grado: ${academicContext.grado}` : ''}

REFERENCIA FASE I (usar solo para comparación — no reproducir):
${phase1ContextCompact}
⚠️ No copies ni parafrasees el análisis narrativo completo de Fase I. Genera análisis nuevo basado en los resultados de Fase II.

═══════════════════════════════════════════════════════
RESULTADOS POR MATERIA — Fase II
═══════════════════════════════════════════════════════
${formatPhase23MateriasBlock(materiasData)}

═══════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase II
═══════════════════════════════════════════════════════
${formatGlobalMetricsPhase23(globalMetrics)}

═══════════════════════════════════════════════════════
REGLAS OBLIGATORIAS
═══════════════════════════════════════════════════════
1. ANTI-REDUNDANCIA: "resumen_general" y "analisis_competencial" no deben repetir los mismos puntos. El resumen describe la tendencia general de Fase II vs Fase I; el análisis entra al detalle por materia.
2. ${reglaPrimeraOracion ? `${reglaPrimeraOracion}\n3. ` : ''}${INGLES_MCER_RULE}
${reglaPrimeraOracion ? '4.' : '3.'} Sin puntajes numéricos explícitos en el texto. Sin comparar con otros estudiantes. Sin saludos.

═══════════════════════════════════════════════════════
FORMATO JSON ESPERADO
═══════════════════════════════════════════════════════
{
  "resumen_general": "~100 palabras en 2-3 párrafos: (1) tendencia general de Fase II; (2) evolución de las materias débiles (${debilesStr}) — mejora, estabilidad o retroceso; (3) cierre motivador o de reconocimiento según el caso.",

  "analisis_competencial": {
    "Matemáticas": "70-100 palabras: estado actual en Fase II + comparación puntual con Fase I si aplica.",
    "Lenguaje": "70-100 palabras",
    "Ciencias Sociales": "70-100 palabras",
    "Biologia": "70-100 palabras",
    "Quimica": "70-100 palabras",
    "Física": "70-100 palabras",
    "Inglés": "70-100 palabras — nivel MCER actual y avance o retroceso vs Fase I"
  },

  "fortalezas_academicas": ["Fortaleza 1", "Fortaleza 2"],
  "aspectos_por_mejorar": ["Aspecto 1", "Aspecto 2"],
  "recomendaciones_enfoque_saber11": ["Recomendación 1", "Recomendación 2"]
}

Incluye obligatoriamente las 7 materias en "analisis_competencial": ${materiasLista}.

${JSON_OUTPUT_CLOSING}`;
}

/** Fase III — informe estilo Saber 11 / trayectoria */
export function buildPhase3Prompt(params: {
  materiasData: MateriaPhase23Payload[];
  globalMetrics: PromptGlobalMetrics;
  academicContext: AcademicContextPrompt;
  materiasLista: string;
  trajectoryBlock: string;
}): string {
  const { materiasData, globalMetrics, academicContext, materiasLista, trajectoryBlock } = params;

  return `Eres un evaluador institucional con enfoque ICFES / Ministerio de Educación.
Redacta un informe riguroso, formal y comprensible para familias. Explica brevemente los términos técnicos.

═══════════════════════════════════════════════════════
CONTEXTO
═══════════════════════════════════════════════════════
Fase evaluativa: Fase III (informe final — proyección Saber 11)
${academicContext.grado ? `Grado: ${academicContext.grado}` : ''}

${trajectoryBlock}

═══════════════════════════════════════════════════════
RESULTADOS POR MATERIA — Fase III
═══════════════════════════════════════════════════════
${formatPhase23MateriasBlock(materiasData)}

═══════════════════════════════════════════════════════
MÉTRICAS GLOBALES — Fase III
═══════════════════════════════════════════════════════
${formatGlobalMetricsPhase23(globalMetrics)}

═══════════════════════════════════════════════════════
REGLAS OBLIGATORIAS
═══════════════════════════════════════════════════════
1. Integra la trayectoria Fase I → II → III de forma narrativa, sin citar puntajes numéricos explícitos.
2. "analisis_competencial" es un objeto con una clave por materia — igual que en Fases I y II: análisis breve por área y trayectoria.
3. "sintesis_institucional" es el texto continuo formal estilo informe Saber (300-400 palabras), voz institucional; no repitas listado por materia (eso va en analisis_competencial).
4. "resumen_general" es síntesis breve (150-200 palabras): estado tras las tres fases y posicionamiento frente a Saber 11; no dupliques la síntesis institucional completa.
5. ${INGLES_MCER_RULE}
6. Sin comparar con otros estudiantes. Sin saludos ni despedidas.

═══════════════════════════════════════════════════════
FORMATO JSON ESPERADO
═══════════════════════════════════════════════════════
{
  "resumen_general": "150-200 palabras: estado final tras las tres fases, posicionamiento frente a Saber 11, trayectoria global (sin repetir el detalle por materia).",

  "analisis_competencial": {
    "Matemáticas": "80-100 palabras: trayectoria y estado final en Fase III.",
    "Lenguaje": "80-100 palabras",
    "Ciencias Sociales": "80-100 palabras",
    "Biologia": "80-100 palabras",
    "Quimica": "80-100 palabras",
    "Física": "80-100 palabras",
    "Inglés": "80-100 palabras — nivel MCER final y proyección"
  },

  "sintesis_institucional": "300-400 palabras en texto continuo formal. Integra competencias, niveles, coherencia entre áreas y preparación para Saber 11. Puede usar términos técnicos con explicación breve.",

  "fortalezas_academicas": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
  "aspectos_por_mejorar": ["Aspecto 1", "Aspecto 2"],
  "recomendaciones_enfoque_saber11": ["Recomendación 1", "Recomendación 2", "Recomendación 3"]
}

Materias cubiertas: ${materiasLista}.

${JSON_OUTPUT_CLOSING}`;
}
