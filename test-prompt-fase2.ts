/**
 * Script de prueba para visualizar el prompt completo de Fase II
 * Este archivo simula cómo se ve el prompt que se envía a la IA
 */

// Simulación de datos de entrada
const normalizedResults = [
  {
    materia: "Matemáticas",
    nivel: "Alto",
    competencias: {
      "Álgebra": "Alto",
      "Geometría": "Superior",
      "Trigonometría": "Básico"
    }
  },
  {
    materia: "Lenguaje",
    nivel: "Superior",
    competencias: {
      "Comprensión lectora": "Superior",
      "Análisis textual": "Alto"
    }
  },
  {
    materia: "Ciencias Sociales",
    nivel: "Alto",
    competencias: {
      "Historia de Colombia": "Alto",
      "Geografía": "Alto"
    }
  },
  {
    materia: "Biologia",
    nivel: "Alto",
    competencias: {
      "Biología celular": "Alto",
      "Genética": "Básico"
    }
  },
  {
    materia: "Quimica",
    nivel: "Básico",
    competencias: {
      "Química orgánica": "Básico",
      "Estequiometría": "Bajo"
    }
  },
  {
    materia: "Física",
    nivel: "Alto",
    competencias: {
      "Mecánica": "Alto",
      "Termodinámica": "Básico"
    }
  },
  {
    materia: "Inglés",
    nivel: "Básico",
    competencias: {
      "Comprensión lectora": "Básico",
      "Gramática": "Bajo"
    }
  }
];

const globalMetrics = {
  promedioGeneral: 68.3,
  materiasFuertes: ["Matemáticas", "Lenguaje", "Ciencias Sociales", "Biologia", "Física"],
  materiasDebiles: ["Quimica", "Inglés"],
  temasFuertes: [],
  temasDebiles: [],
  nivelGeneralDesempeno: "Alto"
};

const academicContext = {
  grado: "11",
  nivel: "Undécimo grado"
};

// Simulación de métricas de Fase I (anterior)
const previousPhaseMetrics = {
  phase: "Fase I",
  metrics: {
    promedioGeneral: 55.2,
    materiasFuertes: ["Lenguaje", "Ciencias Sociales"],
    materiasDebiles: ["Física", "Quimica", "Inglés", "Matemáticas"],
    temasFuertes: [],
    temasDebiles: [],
    nivelGeneralDesempeno: "Básico"
  }
};

// Construir el prompt como lo haría el código real
const phaseName = 'Fase II';

// Construir mapa de niveles de Fase II por materia para comparación
const phase2MateriaLevels: { [key: string]: string } = {};
normalizedResults.forEach(r => {
  phase2MateriaLevels[r.materia] = r.nivel;
});

// Construir sección de contexto comparativo
const comparativeContextSection = `
═══════════════════════════════════════════════════════════════
CONTEXTO COMPARATIVO - ${previousPhaseMetrics.phase}
═══════════════════════════════════════════════════════════════

Para enriquecer tu análisis, aquí están las métricas generales de la fase anterior (${previousPhaseMetrics.phase}):

- Nivel general de desempeño en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.nivelGeneralDesempeno}
- Materias con desempeño favorable en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requerían fortalecimiento en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.materiasDebiles.join(', ') || 'Ninguna'}

📊 COMPARACIÓN DETALLADA MATERIA POR MATERIA (${previousPhaseMetrics.phase} → Fase II):

Las siguientes materias fueron identificadas como DÉBILES en ${previousPhaseMetrics.phase} y requirieron intervención pedagógica mediante planes de estudio personalizados. Compara su desempeño actual en Fase II:

${previousPhaseMetrics.metrics.materiasDebiles.map(materia => {
  const nivelFase2 = phase2MateriaLevels[materia] || 'No evaluada';
  return `- **${materia}**: 
  • Nivel en ${previousPhaseMetrics.phase}: Requería fortalecimiento (Básico o Bajo)
  • Nivel en Fase II: ${nivelFase2}`;
}).join('\n\n')}

⚠️ IMPORTANTE: Usa esta información para tu análisis comparativo explícito en la sección correspondiente.

⚠️ NOTA: Este contexto es para referencia comparativa. Tu análisis debe basarse PRINCIPALMENTE en los resultados de ${phaseName} que se muestran a continuación. Puedes mencionar mejoras o cambios respecto a la fase anterior, pero sin mencionar puntajes numéricos específicos.
`;

// Sección especial para Fase II sobre análisis comparativo
const phase2ComparativeAnalysisSection = `
═══════════════════════════════════════════════════════════════
⚠️ ANÁLISIS COMPARATIVO OBLIGATORIO PARA FASE II
═══════════════════════════════════════════════════════════════

ES FUNDAMENTAL que incorpores en tu análisis un apartado explícito de comparación del desempeño del estudiante, específicamente:

🎯 PROPÓSITO: Evaluar el impacto real del proceso de intervención pedagógica implementado a través de los planes de estudio personalizados desarrollados después de Fase I.

📋 DEBES EVIDENCIAR EXPLÍCITAMENTE:

Para cada materia que fue identificada como DÉBIL en Fase I (y que recibió intervención pedagógica):
1. ¿El rendimiento MEJORÓ en Fase II? 
   - Si mejoró: Describe cómo evolucionó el nivel (ej: "de Básico a Alto", "evidencia fortalecimiento competencial")
   - Si se mantuvo: Indica que se mantiene en el mismo nivel y analiza por qué podría no haber mejorado
   - Si disminuyó: Identifica retroceso y posibles causas

2. EVALUACIÓN DEL IMPACTO DE LA INTERVENCIÓN:
   - Evalúa la efectividad del plan de estudio implementado
   - Identifica qué aspectos de la intervención fueron más efectivos
   - Señala áreas donde la intervención no tuvo el impacto esperado (si aplica)

3. CONCLUSIÓN EXPLÍCITA:
   - Deja claro si el estudiante mejoró o no en las áreas de debilidad identificadas
   - Valora si la intervención pedagógica fue exitosa, parcialmente exitosa o requiere ajustes
   - Proporciona evidencia específica basada en la comparación de niveles de desempeño

⚠️ IMPORTANTE: 
- Este análisis comparativo debe ser EXPLÍCITO y DETALLADO
- No uses puntajes numéricos, pero sí menciona claramente los cambios en niveles de desempeño
- El propósito es demostrar si el plan de estudio personalizado tuvo impacto positivo
- Debe aparecer tanto en el "analisis_competencial" como de forma destacada en el "resumen_general"
`;

const roleDescription = `Actúa como un Doctor en Ciencias de la Educación, especialista en evaluación estandarizada tipo ICFES / Saber 11, con más de 20 años de experiencia como docente, evaluador institucional y asesor académico.`;

const expertiseDescription = `Tienes dominio experto en:
- Marco de competencias del ICFES Saber 11
- Interpretación de resultados por competencias y niveles de desempeño
- Análisis integral del rendimiento estudiantil
- Elaboración de informes académicos institucionales claros, objetivos y orientados a la mejora
- Análisis longitudinal del progreso estudiantil`;

const writingStyle = `Tu redacción debe ser:
- Formal e institucional
- Clara y comprensible para estudiantes, familias y docentes
- Coherente con el lenguaje usado en reportes tipo ICFES
- Enfocada en competencias, no en memorización`;

const materiasData = normalizedResults.map(r => ({
  materia: r.materia,
  nivel: r.nivel,
  competencias: r.competencias,
}));

// Construir instrucciones de análisis
const analysisInstructions = `🎯 ANÁLISIS INTEGRAL CON ENFOQUE EN EVALUACIÓN DE INTERVENCIÓN PEDAGÓGICA

Analiza integralmente el desempeño del estudiante en ${phaseName}, considerando:

1. ANÁLISIS BASE DE FASE II:
- Niveles de desempeño por materia (BASADOS EN Fase II)
- Fortalezas y debilidades por competencias (IDENTIFICADAS EN Fase II)
- Coherencia entre materias evaluadas en Fase II
- Estado general frente a las exigencias del modelo Saber 11

2. ⚠️ ANÁLISIS COMPARATIVO OBLIGATORIO - EVALUACIÓN DE INTERVENCIÓN PEDAGÓGICA:
Esta es la sección MÁS IMPORTANTE para Fase II. Debes incluir un análisis EXPLÍCITO y DETALLADO que:

a) Para cada materia que fue DÉBIL en Fase I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ')}):
   - Compara el nivel de desempeño: ¿Mejoró de "Básico/Bajo" a "Alto/Superior"?
   - ¿Se mantuvo en el mismo nivel?
   - ¿Disminuyó o retrocedió?
   - EVIDENCIA ESPECÍFICA: Menciona claramente el cambio de nivel (ej: "evolucionó de nivel Básico a nivel Alto", "se mantiene en nivel Básico", "retrocedió a nivel Bajo")

b) EVALUACIÓN DEL IMPACTO DE LA INTERVENCIÓN:
   - Valora la efectividad del plan de estudio personalizado implementado
   - Identifica qué aspectos de la intervención pedagógica fueron exitosos
   - Señala áreas donde la intervención no tuvo el impacto esperado (si aplica)
   - Analiza si el proceso de intervención pedagógica cumplió su objetivo

c) CONCLUSIÓN EXPLÍCITA SOBRE EL PROGRESO:
   - Deja CLARO si el estudiante mejoró o no en las áreas de debilidad identificadas en Fase I
   - Determina si la intervención pedagógica fue: exitosa, parcialmente exitosa, o requiere ajustes
   - Proporciona evidencia específica basada en la comparación de niveles de desempeño entre fases

⚠️ RESTRICCIONES CRÍTICAS:
- Tu análisis debe basarse PRINCIPALMENTE en los resultados de Fase II
- El análisis comparativo es OBLIGATORIO y debe ser EXPLÍCITO
- NO menciones puntajes numéricos explícitos, pero SÍ menciona cambios en niveles (Superior, Alto, Básico, Bajo)
- NO realices comparaciones con otros estudiantes
- NO utilices lenguaje clínico o psicológico
- NO uses juicios de valor personal
- NO incluyas saludos ni despedidas
- El análisis comparativo debe aparecer de forma destacada tanto en "resumen_general" como en "analisis_competencial"
- ESPECIALMENTE PARA INGLÉS: Debes identificar el nivel de competencia del estudiante según el Marco Común Europeo de Referencia (MCER): A1, A2, B1, B2, C1 o C2. NO menciones "pruebas del 1 al 7" ni referencias a números de pruebas. En su lugar, identifica y menciona el nivel MCER correspondiente (ej: "El estudiante se encuentra en nivel A2", "demuestra competencia en nivel B1", etc.). El análisis debe centrarse en el nivel de dominio del idioma, no en referencias numéricas a pruebas.
- Responde SOLO con JSON válido`;

// Construir formato de respuesta
const responseFormat = `Responde ÚNICAMENTE con un objeto JSON en este formato exacto:

{
  "resumen_general": "Descripción global del estado académico del estudiante en Fase II, en relación con las competencias evaluadas bajo el enfoque Saber 11. DEBE INCLUIR un análisis comparativo EXPLÍCITO que evidencie si las materias que eran débiles en Fase I mejoraron, se mantuvieron o empeoraron en Fase II. Evalúa el impacto de la intervención pedagógica implementada y valora la efectividad del plan de estudio personalizado. Deja claro si el estudiante mejoró o no en las áreas de debilidad identificadas previamente. Menciona específicamente las materias que fueron débiles en Fase I: ${previousPhaseMetrics.metrics.materiasDebiles.join(', ')} y compara su estado actual en Fase II. (100 palabras exactas)",
  
  "analisis_competencial": "Análisis pedagógico CENTRADO EN EVALUACIÓN DE INTERVENCIÓN PEDAGÓGICA. Debe incluir:

1. Desarrollo de competencias en Fase II, coherencia entre materias y temas, patrones de desempeño.

2. ⚠️ ANÁLISIS COMPARATIVO OBLIGATORIO Y EXPLÍCITO:
   Para cada materia que fue DÉBIL en Fase I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ')}), debes:
   - Comparar EXPLÍCITAMENTE el nivel de desempeño: ¿mejoró (ej: de Básico a Alto), se mantuvo, o disminuyó?
   - EVIDENCIAR el cambio de nivel usando los términos: Superior, Alto, Básico, Bajo
   - EVALUAR el impacto de la intervención pedagógica y la efectividad del plan de estudio implementado
   - Determinar si la intervención fue exitosa, parcialmente exitosa o requiere ajustes
   - Dejar CLARO si el estudiante mejoró o no en las áreas de debilidad

Usa lenguaje típico de informes ICFES (ej. 'evidencia avances en...', 'presenta dificultades en...', 'evolucionó de nivel X a nivel Y', 'la intervención pedagógica demostró efectividad en...'). (250-350 palabras)",
  
  "fortalezas_academicas": [
    "Competencia o habilidad 1 donde el estudiante muestra desempeño favorable en Fase II (redactada en términos competenciales)",
    "Competencia o habilidad 2...",
    "..."
  ],
  
  "aspectos_por_mejorar": [
    "Área o competencia 1 que requiere fortalecimiento en Fase II (lenguaje constructivo y orientado al aprendizaje)",
    "Área o competencia 2...",
    "..."
  ],
  
  "recomendaciones_enfoque_saber11": [
    "Sugerencia pedagógica 1 alineada con desarrollo de competencias y práctica tipo Saber 11, considerando el desempeño en Fase II",
    "Sugerencia pedagógica 2...",
    "..."
  ]
}`;

// Construir el prompt completo
const fullPrompt = `${roleDescription}

${expertiseDescription}

${writingStyle}

═══════════════════════════════════════════════════════════════
CONTEXTO ACADÉMICO DEL ESTUDIANTE
═══════════════════════════════════════════════════════════════

Fase evaluativa ACTUAL: ${phaseName}
Grado: ${academicContext.grado}
Nivel: ${academicContext.nivel}

${comparativeContextSection}
${phase2ComparativeAnalysisSection}
═══════════════════════════════════════════════════════════════
RESULTADOS POR MATERIA - ${phaseName}
═══════════════════════════════════════════════════════════════

⚠️ NOTA CRÍTICA: Los siguientes resultados son EXCLUSIVAMENTE de ${phaseName}. Tu análisis debe basarse en estos datos.

${materiasData.map(r => `
**${r.materia}**
- Nivel de desempeño: ${r.nivel}
- Competencias evaluadas: ${Object.keys(r.competencias).join(', ') || 'No especificadas'}
`).join('\n')}

═══════════════════════════════════════════════════════════════
MÉTRICAS GLOBALES CALCULADAS - ${phaseName}
═══════════════════════════════════════════════════════════════

Estas métricas fueron calculadas determinísticamente basándose SOLO en los resultados de ${phaseName}:

- Nivel general de desempeño: ${globalMetrics.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${globalMetrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requieren fortalecimiento: ${globalMetrics.materiasDebiles.join(', ') || 'Ninguna'}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES PARA EL ANÁLISIS
═══════════════════════════════════════════════════════════════

${analysisInstructions}

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════

${responseFormat}

═══════════════════════════════════════════════════════════════

Genera el JSON con tu análisis completo de ${phaseName} ahora:`;

// Mostrar el prompt
console.log("=".repeat(80));
console.log("PROMPT COMPLETO PARA FASE II - SIMULACIÓN");
console.log("=".repeat(80));
console.log("\n");
console.log(fullPrompt);
console.log("\n");
console.log("=".repeat(80));
console.log("FIN DEL PROMPT");
console.log("=".repeat(80));

// Exportar para uso
export { fullPrompt };

