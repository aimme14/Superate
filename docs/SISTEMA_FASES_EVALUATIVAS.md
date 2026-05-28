# 📚 Sistema de Evaluación por Fases Estilo ICFES con IA

## 📋 Resumen Ejecutivo

Sistema completo de evaluación en cascada con tres fases evaluativas, análisis de IA y generación personalizada de cuestionarios. El sistema permite a los administradores autorizar fases por grado y controla el acceso de estudiantes basado en la completitud de fases anteriores.

---

## 🏗️ Arquitectura del Sistema

### 1. **Interfaces y Tipos** (`src/interfaces/phase.interface.ts`)

#### Interfaces Principales:
- `PhaseAuthorization`: Autorización de fases por grado
- `StudentPhaseProgress`: Progreso del estudiante en cada fase
- `GradePhaseCompletion`: Estado de completitud por grado
- `Phase1Analysis`: Análisis de resultados de Fase 1
- `ImprovementPlan`: Plan de mejoramiento generado por IA
- `Phase2QuestionDistribution`: Distribución personalizada de preguntas
- `ProgressAnalysis`: Análisis de avance entre fases
- `Phase3ICFESResult`: Resultados finales con puntuación ICFES (0-500)
- `PhaseComparison`: Comparativo entre las tres fases

---

### 2. **Servicios Backend**

#### A. Servicio de Autorización (`src/services/phase/phaseAuthorization.service.ts`)

**Funcionalidades:**
- ✅ `authorizePhase()`: Autoriza una fase para un grado específico
- ✅ `revokePhaseAuthorization()`: Revoca autorización de fase
- ✅ `isPhaseAuthorized()`: Verifica si una fase está autorizada
- ✅ `getGradeAuthorizations()`: Obtiene todas las autorizaciones de un grado
- ✅ `updateStudentPhaseProgress()`: Actualiza progreso de estudiante
- ✅ `getStudentPhaseProgress()`: Obtiene progreso de estudiante
- ✅ `checkGradePhaseCompletion()`: Verifica completitud de fase por grado
- ✅ `canStudentAccessPhase()`: Verifica si estudiante puede acceder a fase

**Colecciones Firebase:**
- `phaseAuthorizations`: Autorizaciones de fases
- `studentPhaseProgress`: Progreso de estudiantes

---

#### B. Servicio de Análisis (`src/services/phase/phaseAnalysis.service.ts`)

**Funcionalidades:**
- ✅ `analyzePhase1Results()`: Analiza resultados de Fase 1
  - Identifica fortalezas y debilidades por tema
  - Calcula porcentajes de rendimiento
  - Genera plan de mejoramiento con IA
  
- ✅ `generatePhase2Distribution()`: Genera distribución personalizada
  - 50% preguntas de debilidad principal
  - 50% distribuidas en otros temas
  
- ✅ `analyzeProgress()`: Analiza avance entre Fase 1 y Fase 2
  - Compara puntuaciones
  - Identifica mejoras por tema
  - Genera insights con IA
  
- ✅ `generatePhase3Result()`: Genera resultado ICFES
  - Calcula puntaje 0-500
  - Genera diagnóstico final con IA
  - Calcula puntajes por tema
  
- ✅ `generatePhaseComparison()`: Comparativo entre las tres fases

**Colecciones Firebase:**
- `phase1Analyses`: Análisis de Fase 1
- `phase2Distributions`: Distribuciones de Fase 2
- `progressAnalyses`: Análisis de progreso
- `phase3Results`: Resultados ICFES

---

#### C. Extensión del Servicio de IA (`src/services/ai/gemini.service.ts`)

**Nuevos Métodos:**
- ✅ `generateImprovementRoute()`: Genera ruta de mejoramiento personalizada
  - Recursos por tipo (video, quiz, ejercicio, material, lectura)
  - Plan de estudio semanal
  - Metas y actividades
  
- ✅ `analyzePhaseProgress()`: Analiza progreso con insights
  - Identifica áreas de mejora
  - Detecta debilidades persistentes
  - Genera recomendaciones
  
- ✅ `generateICFESDiagnosis()`: Diagnóstico final ICFES
  - Interpretación de puntaje
  - Fortalezas y debilidades
  - Recomendaciones y próximos pasos

---

#### D. Generación de Cuestionarios (`src/services/quiz/quizGenerator.service.ts`)

**Mejoras:**
- ✅ `generatePersonalizedPhase2Quiz()`: Genera cuestionario personalizado Fase 2
  - Usa distribución basada en debilidades
  - 50% preguntas de tema débil
  - 50% distribuidas equitativamente
  
- ✅ Integración con `phaseAnalysisService`
- ✅ Soporte para Inglés (niveles fácil/medio/difícil)

---

### 3. **Componentes de UI**

#### A. Componente de Administración (`src/components/admin/PhaseAuthorizationManagement.tsx`)

**Características:**
- ✅ Filtros por institución, sede y grado
- ✅ Visualización de estado de cada fase (autorizada/bloqueada)
- ✅ Indicadores de progreso por grado
- ✅ Botones para autorizar/revocar fases
- ✅ Validación: no permite autorizar fase siguiente sin completar anterior
- ✅ Barra de progreso mostrando estudiantes completados/en progreso/pendientes

**Uso:**
```tsx
<PhaseAuthorizationManagement theme={theme} />
```

---

#### B. Dashboard de Estudiante (`src/components/student/PhaseDashboard.tsx`)

**Características:**
- ✅ Visualización de estado de cada fase
- ✅ Control de acceso: muestra si puede acceder o está bloqueada
- ✅ Progreso por materia (completadas/en progreso)
- ✅ Botones para iniciar/continuar fases
- ✅ Información sobre cada fase
- ✅ Navegación a resultados cuando está completada

**Estados de Fase:**
- 🔒 **Bloqueada**: No autorizada o fase anterior no completada
- ▶️ **Disponible**: Lista para iniciar
- ⏱️ **En progreso**: Algunas materias completadas
- ✅ **Completada**: Todas las materias completadas

**Uso:**
```tsx
<PhaseDashboard theme={theme} />
```

---

#### C. Visualizador de Rutas de Mejoramiento (`src/components/student/ImprovementPlanViewer.tsx`)

**Características:**
- ✅ Visualización de planes por materia
- ✅ Recursos agrupados por tipo (video, quiz, ejercicio, material, lectura)
- ✅ Plan de estudio semanal con temas, actividades y metas
- ✅ Priorización de recursos (alta/media/baja)
- ✅ Enlaces a recursos externos
- ✅ Diseño responsive con tabs por materia

**Uso:**
```tsx
<ImprovementPlanViewer theme={theme} />
// O para una materia específica:
<ImprovementPlanViewer theme={theme} subject="Matemáticas" />
```

---

### 4. **Hooks Personalizados** (`src/hooks/query/usePhaseQuery.ts`)

**Hooks Disponibles:**
- ✅ `useStudentPhaseProgress()`: Progreso de estudiante
- ✅ `usePhaseAccess()`: Verificar acceso a fase
- ✅ `useGradeAuthorizations()`: Autorizaciones de grado
- ✅ `useGradePhaseCompletion()`: Completitud de fase
- ✅ `usePhaseAuthorizationMutations()`: Mutaciones de autorización
- ✅ `useStudentProgressMutations()`: Actualizar progreso
- ✅ `usePhaseAnalysisMutations()`: Análisis de resultados

---

## 🔄 Flujo del Sistema

### Fase 1: Diagnóstico
1. **Administrador autoriza** Fase 1 para un grado
2. **Estudiante accede** y presenta evaluación en todas las materias
3. **Sistema analiza** resultados con IA:
   - Identifica fortalezas y debilidades
   - Genera plan de mejoramiento personalizado
   - Guarda análisis en Firebase
4. **Administrador verifica** que todos los estudiantes completaron
5. **Administrador autoriza** Fase 2

### Fase 2: Refuerzo Personalizado
1. **Sistema genera** distribución personalizada:
   - 50% preguntas de debilidad principal
   - 50% distribuidas en otros temas
2. **Estudiante presenta** evaluación personalizada
3. **Sistema analiza** progreso:
   - Compara Fase 1 vs Fase 2
   - Identifica mejoras
   - Genera insights con IA
4. **Administrador verifica** completitud
5. **Administrador autoriza** Fase 3

### Fase 3: Simulacro ICFES
1. **Sistema genera** cuestionario completo
2. **Estudiante presenta** simulacro
3. **Sistema calcula** puntaje ICFES (0-500)
4. **Sistema genera** diagnóstico final con IA
5. **Sistema crea** comparativo de las tres fases

---

## 📊 Lógica de Distribución de Preguntas

### Materias Normales (excepto Inglés)
**Fase 1:**
- Distribución equitativa por temas
- Nivel: Fácil

**Fase 2:**
- 50% preguntas de debilidad principal
- 50% distribuidas equitativamente en otros temas
- Nivel: Medio

**Fase 3:**
- Distribución equitativa por temas
- Nivel: Difícil
- Puntuación ICFES (0-500)

### Inglés
**Fase 1:**
- Preguntas nivel Fácil
- Misma cantidad que Fase 2

**Fase 2:**
- Preguntas nivel Medio
- Misma cantidad que Fase 1

**Fase 3:**
- Por definir (pendiente según requerimientos)

---

## 🔐 Control de Acceso

### Reglas de Acceso:
1. **Fase 1**: Disponible si está autorizada por administrador
2. **Fase 2**: Requiere:
   - Autorización del administrador
   - Completitud de Fase 1 (todas las materias)
   - Todos los estudiantes del grado completaron Fase 1
3. **Fase 3**: Requiere:
   - Autorización del administrador
   - Completitud de Fase 2 (todas las materias)
   - Todos los estudiantes del grado completaron Fase 2

---

## 🎯 Integración con Componentes Existentes

### Para usar en componentes de Quiz:

```typescript
// Después de completar un examen
import { usePhaseAnalysisMutations } from '@/hooks/query/usePhaseQuery';
import { useStudentProgressMutations } from '@/hooks/query/usePhaseQuery';

const { analyzePhase1, generatePhase3Result } = usePhaseAnalysisMutations();
const { updateProgress } = useStudentProgressMutations();

// Al completar Fase 1
if (phase === 'first') {
  // Analizar resultados
  await analyzePhase1.mutateAsync({
    studentId: user.uid,
    subject: examResult.subject,
    examResult: examResult,
  });
  
  // Actualizar progreso
  await updateProgress.mutateAsync({
    gradeId: studentData.gradeId,
    phase: 'first',
    subject: examResult.subject,
    completed: true,
  });
}

// Al completar Fase 3
if (phase === 'third') {
  await generatePhase3Result.mutateAsync({
    studentId: user.uid,
    subject: examResult.subject,
    examResult: examResult,
  });
}
```

---

## 📝 Próximos Pasos de Integración

1. **Integrar en componentes de Quiz existentes:**
   - Llamar a análisis después de completar examen
   - Actualizar progreso automáticamente
   - Verificar acceso antes de permitir iniciar examen

2. **Agregar a dashboards:**
   - Agregar `PhaseAuthorizationManagement` al dashboard de admin
   - Agregar `PhaseDashboard` al dashboard de estudiante
   - Agregar `ImprovementPlanViewer` a página de resultados

3. **Configurar rutas:**
   - Ruta para gestión de fases (admin)
   - Ruta para visualización de fases (estudiante)
   - Ruta para planes de mejoramiento

---

## 🧪 Testing Recomendado

1. **Flujo completo:**
   - Autorizar Fase 1 → Estudiantes completan → Autorizar Fase 2 → etc.

2. **Control de acceso:**
   - Intentar acceder a Fase 2 sin completar Fase 1
   - Verificar que se bloquea correctamente

3. **Generación personalizada:**
   - Completar Fase 1 con debilidades específicas
   - Verificar que Fase 2 tiene 50% de preguntas de debilidad

4. **Análisis de IA:**
   - Verificar que se generan planes de mejoramiento
   - Verificar que se generan diagnósticos ICFES

---

## 📚 Archivos Creados

### Interfaces:
- `src/interfaces/phase.interface.ts`

### Servicios:
- `src/services/phase/phaseAuthorization.service.ts`
- `src/services/phase/phaseAnalysis.service.ts`
- `src/services/ai/gemini.service.ts` (extendido)
- `src/services/quiz/quizGenerator.service.ts` (extendido)

### Componentes:
- `src/components/admin/PhaseAuthorizationManagement.tsx`
- `src/components/student/PhaseDashboard.tsx`
- `src/components/student/ImprovementPlanViewer.tsx`

### Hooks:
- `src/hooks/query/usePhaseQuery.ts`

---

## ✅ Estado de Implementación

- ✅ Interfaces y tipos
- ✅ Servicio de autorización
- ✅ Servicio de análisis
- ✅ Extensión de servicio de IA
- ✅ Generación personalizada de cuestionarios
- ✅ Sistema de puntuación ICFES
- ✅ Componente de administración
- ✅ Dashboard de estudiante
- ✅ Visualizador de rutas de mejoramiento
- ✅ Hooks personalizados

**Pendiente de integración:**
- Integrar en componentes de Quiz existentes
- Agregar a dashboards principales
- Configurar rutas de navegación

---

## 🎉 ¡Sistema Completo!

El sistema de evaluación por fases está completamente implementado y listo para integrarse con los componentes existentes. Todos los servicios, componentes y hooks están documentados y listos para usar.


