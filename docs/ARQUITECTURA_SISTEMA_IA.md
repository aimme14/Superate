# Arquitectura del Sistema de IA - Supérate

## 🏗️ Visión General

El sistema de justificaciones con IA está diseñado con una arquitectura modular, escalable y mantenible que separa claramente las responsabilidades y facilita la extensión futura.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA COMPLETA                         │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │   Frontend   │
     │  (React/TS)  │
     └───────┬──────┘
             │ HTTP/HTTPS
             │
     ┌───────▼──────────────────────────────────────┐
     │         Firebase Cloud Functions             │
     │                                               │
     │  ┌──────────────────────────────────────┐   │
     │  │         index.ts                      │   │
     │  │  (Endpoints HTTP + Scheduled Jobs)    │   │
     │  └──────┬───────────────────────────┬───┘   │
     │         │                           │        │
     │  ┌──────▼─────────┐        ┌───────▼──────┐│
     │  │ Justification  │        │   Gemini     ││
     │  │    Service     │◄───────┤   Service    ││
     │  └──────┬─────────┘        └───────┬──────┘│
     │         │                           │        │
     │  ┌──────▼─────────┐        ┌───────▼──────┐│
     │  │   Question     │        │   Gemini     ││
     │  │    Service     │        │   Client     ││
     │  └──────┬─────────┘        └──────────────┘│
     │         │                                    │
     └─────────┼────────────────────────────────────┘
               │
     ┌─────────▼────────┐         ┌───────────────┐
     │   Firestore      │         │  Gemini AI    │
     │   (Database)     │         │   (Google)    │
     └──────────────────┘         └───────────────┘
```

## 🔷 Capas de la Arquitectura

### 1. Capa de Presentación (Frontend)

**Responsabilidades:**
- Interfaz de usuario
- Llamadas a las Cloud Functions
- Visualización de justificaciones
- Gestión de estados de carga/error

**Tecnologías:**
- React
- TypeScript
- Firebase SDK (Client)

### 2. Capa de API (Cloud Functions)

**Responsabilidades:**
- Exponer endpoints HTTP
- Validación de requests
- Manejo de errores
- CORS y seguridad
- Rate limiting

**Componentes:**
```typescript
// index.ts
├── generateJustification     (POST)
├── processBatch              (POST)
├── regenerateJustification   (POST)
├── justificationStats        (GET)
├── validateJustification     (POST)
├── aiInfo                    (GET)
├── health                    (GET)
└── scheduledJustificationGeneration (Cron)
```

### 3. Capa de Lógica de Negocio (Services)

**Responsabilidades:**
- Orquestación de procesos
- Lógica de negocio
- Transformación de datos
- Coordinación entre capas

**Componentes:**

#### a) Justification Service
```typescript
class JustificationService {
  // Operaciones principales
  generateAndSaveJustification(questionId, force)
  processBatch(config)
  processAllQuestionsWithoutJustification(config)
  regenerateJustification(questionId)
  deleteJustification(questionId)
  
  // Utilidades
  getStats(filters)
  validateAllJustifications(filters)
}
```

**Flujo:**
1. Recibe request de API
2. Obtiene pregunta de QuestionService
3. Genera justificación con GeminiService
4. Guarda en Firestore
5. Retorna resultado

#### b) Gemini Service
```typescript
class GeminiService {
  // Generación de contenido
  generateQuestionJustification(data)
  generateBatchJustifications(questions, onProgress)
  
  // Construcción de prompts
  private buildJustificationPrompt(data, correctOption, incorrectOptions)
  
  // Validación y mejora
  validateJustification(question, justification)
  improveJustification(question, currentJustification)
  
  // Info del sistema
  getInfo()
}
```

**Flujo:**
1. Construye prompt optimizado
2. Aplica rate limiting
3. Llama a Gemini AI
4. Parsea respuesta JSON
5. Valida estructura
6. Retorna justificación

#### c) Question Service
```typescript
class QuestionService {
  // CRUD
  getQuestionById(questionId)
  getQuestionByCode(code)
  getQuestions(filters)
  updateQuestionJustification(questionId, justification)
  
  // Consultas especializadas
  getQuestionsWithoutJustification(limit, filters)
  
  // Estadísticas
  getJustificationStats(filters)
  getTotalCount(filters)
  
  // Utilidades
  questionToGenerationData(question)
  hasJustification(questionId)
}
```

### 4. Capa de Configuración (Config)

**Responsabilidades:**
- Inicialización de servicios externos
- Configuración global
- Constantes del sistema

**Componentes:**

#### a) Firebase Config
```typescript
// Inicialización
- Firebase Admin SDK
- Firestore
- Storage
- Auth

// Constantes
- COLLECTIONS
- FIRESTORE_PATHS
```

#### b) Gemini Config
```typescript
// Cliente
class GeminiClient {
  initialize()
  generateContent(prompt, options)
  private applyRateLimiting()
}

// Configuración
- API_KEY
- MODEL_NAME
- PROMPT_VERSION
- Rate limiting params
- Retry params
- Safety settings
```

### 5. Capa de Datos (Firestore + Gemini AI)

**Firestore:**
- Almacenamiento de preguntas
- Almacenamiento de justificaciones
- Contadores y metadata

**Gemini AI:**
- Generación de texto
- Análisis de contenido
- Razonamiento educativo

### 6. Capa de Tipos (TypeScript)

**Responsabilidades:**
- Type safety
- Documentación de estructuras
- Validación en compile-time

**Tipos Principales:**
```typescript
Question
AIJustification
QuestionGenerationData
JustificationGenerationResult
BatchProcessingConfig
BatchProcessingResult
QuestionFilters
JustificationStats
APIResponse
```

## 🔄 Flujos de Datos

### Flujo 1: Generación Individual

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐
│Frontend │────▶│   API   │────▶│Justification │────▶│Question │
│         │     │         │     │   Service    │     │ Service │
└─────────┘     └─────────┘     └──────┬───────┘     └────┬────┘
                                       │                   │
                                       │                   │
                                ┌──────▼────────┐    ┌────▼────┐
                                │    Gemini     │    │Firestore│
                                │    Service    │    │         │
                                └──────┬────────┘    └────┬────┘
                                       │                   │
                                ┌──────▼────────┐          │
                                │   Gemini AI   │          │
                                │   (Google)    │          │
                                └───────────────┘          │
                                                           │
                                       ┌───────────────────┘
                                       │
                                ┌──────▼────────┐
                                │    UPDATE     │
                                │  Firestore    │
                                └───────────────┘
```

**Pasos:**
1. Frontend llama a `generateJustification`
2. API valida y llama a `JustificationService`
3. `JustificationService` obtiene pregunta de Firestore
4. `JustificationService` llama a `GeminiService`
5. `GeminiService` construye prompt y llama a Gemini AI
6. Gemini AI genera justificación
7. `GeminiService` parsea y valida respuesta
8. `JustificationService` guarda en Firestore
9. API retorna resultado al Frontend

### Flujo 2: Procesamiento Batch

```
┌─────────┐     ┌─────────┐     ┌──────────────┐
│Frontend │────▶│   API   │────▶│Justification │
│  /CLI   │     │         │     │   Service    │
└─────────┘     └─────────┘     └──────┬───────┘
                                       │
                                ┌──────▼────────┐
                                │  Get N        │
                                │  Questions    │
                                └──────┬────────┘
                                       │
                              ┌────────▼──────────┐
                              │   FOR EACH        │
                              │   Question        │
                              └────────┬──────────┘
                                       │
                          ┌────────────▼───────────────┐
                          │  Generate Individual       │
                          │  (Ver Flujo 1)             │
                          │  + Rate Limiting           │
                          └────────────┬───────────────┘
                                       │
                                ┌──────▼────────┐
                                │  Accumulate   │
                                │   Results     │
                                └───────────────┘
```

**Características:**
- Procesamiento secuencial (evita saturar la API)
- Rate limiting automático
- Manejo de errores individual
- Reintentos configurables
- Reportes detallados

### Flujo 3: Script CLI

```
┌─────────┐     ┌──────────────┐     ┌──────────┐
│   CLI   │────▶│    Script    │────▶│  Stats   │
│  User   │     │              │     │          │
└─────────┘     └──────┬───────┘     └──────────┘
                       │
                ┌──────▼────────┐
                │  Parse Args   │
                └──────┬────────┘
                       │
           ┌───────────▼────────────┐
           │  if --dry-run          │
           │    Show Stats Only     │
           │  else                  │
           │    Process All Batches │
           └────────────────────────┘
```

## 🎯 Patrones de Diseño Utilizados

### 1. Singleton Pattern

```typescript
class QuestionService {
  private static instance: QuestionService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new QuestionService();
    }
    return this.instance;
  }
}

export const questionService = QuestionService.getInstance();
```

**Ventajas:**
- Una sola instancia del servicio
- Punto de acceso global
- Inicialización lazy

### 2. Repository Pattern

```typescript
class QuestionService {
  // Abstrae el acceso a datos
  async getQuestionById(id: string): Promise<Question | null>
  async getQuestions(filters: QuestionFilters): Promise<Question[]>
  async updateQuestionJustification(id: string, data: AIJustification)
}
```

**Ventajas:**
- Separación de concerns
- Fácil testing con mocks
- Cambio de DB transparente

### 3. Service Layer Pattern

```typescript
class JustificationService {
  // Orquesta múltiples servicios
  async generateAndSaveJustification(questionId: string) {
    const question = await questionService.getQuestionById(questionId);
    const generationData = questionService.questionToGenerationData(question);
    const result = await geminiService.generateQuestionJustification(generationData);
    await questionService.updateQuestionJustification(questionId, result.justification);
    return result;
  }
}
```

**Ventajas:**
- Lógica de negocio centralizada
- Reutilización de código
- Transacciones implícitas

### 4. Builder Pattern

```typescript
buildJustificationPrompt(
  data: QuestionGenerationData,
  correctOption: QuestionOption,
  incorrectOptions: QuestionOption[]
): string {
  // Construye prompt complejo paso a paso
  const contextInfo = this.buildContext(data);
  const optionsText = this.buildOptions(data.options);
  const directrices = this.buildDirectives(data.level);
  
  return `${contextInfo}\n${optionsText}\n${directrices}`;
}
```

**Ventajas:**
- Construcción compleja de objetos
- Código legible
- Fácil modificación

### 5. Strategy Pattern

```typescript
// Diferentes estrategias de rate limiting
interface RateLimitStrategy {
  applyLimit(): Promise<void>;
}

class ExponentialBackoff implements RateLimitStrategy {
  async applyLimit() { /* ... */ }
}

class FixedDelay implements RateLimitStrategy {
  async applyLimit() { /* ... */ }
}
```

## 🔐 Seguridad

### Niveles de Seguridad

```
┌──────────────────────────────────────┐
│  1. CORS                              │
│     - Dominios permitidos             │
│     - Métodos permitidos              │
└──────────────────────────────────────┘
             │
┌──────────────▼───────────────────────┐
│  2. Autenticación (Opcional)          │
│     - Firebase Auth tokens            │
│     - API Keys                        │
└──────────────────────────────────────┘
             │
┌──────────────▼───────────────────────┐
│  3. Rate Limiting                     │
│     - 15 req/min a Gemini             │
│     - Delays automáticos              │
└──────────────────────────────────────┘
             │
┌──────────────▼───────────────────────┐
│  4. Validación de Datos               │
│     - TypeScript types                │
│     - Runtime validation              │
└──────────────────────────────────────┘
             │
┌──────────────▼───────────────────────┐
│  5. Firestore Rules                   │
│     - Permisos granulares             │
│     - Validación de schema            │
└──────────────────────────────────────┘
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /superate/auth/questions/{questionId} {
      // Lectura: usuarios autenticados
      allow read: if request.auth != null;
      
      // Escritura: solo Cloud Functions
      allow create: if request.auth.token.admin == true;
      
      // Update de justificaciones: solo Functions
      allow update: if request.resource.data.diff(resource.data)
        .affectedKeys().hasOnly(['aiJustification', 'updatedAt'])
        && request.auth.token.admin == true;
      
      // Delete: solo administradores
      allow delete: if request.auth.token.admin == true;
    }
  }
}
```

## 📊 Escalabilidad

### Estrategias de Escalado

#### 1. Escalado Horizontal (Cloud Functions)

Firebase escala automáticamente:
- Múltiples instancias según demanda
- Load balancing automático
- Sin intervención manual

#### 2. Procesamiento Asíncrono

```typescript
// En lugar de procesar todo de una vez:
const results = await Promise.all(
  questions.map(q => processQuestion(q))
);

// Procesar en lotes:
for (const batch of batches) {
  await processBatch(batch);
  await delay(batchDelay);
}
```

#### 3. Cache (Futuro)

```typescript
// Implementar cache con Redis
const cached = await cache.get(questionId);
if (cached) return cached;

const justification = await generateJustification(questionId);
await cache.set(questionId, justification, TTL);
```

#### 4. Queue System (Futuro)

```typescript
// Usar Cloud Tasks para procesamiento en cola
import { CloudTasksClient } from '@google-cloud/tasks';

await cloudTasks.createTask({
  task: {
    httpRequest: {
      url: 'https://..../generateJustification',
      body: Buffer.from(JSON.stringify({ questionId })),
    },
  },
});
```

## 📈 Monitoreo y Observabilidad

### Métricas Clave

```
┌─────────────────────────────────────┐
│  Performance Metrics                 │
├─────────────────────────────────────┤
│  - Tiempo de respuesta (avg/p95/p99)│
│  - Throughput (req/min)              │
│  - Error rate (%)                    │
│  - Success rate (%)                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Business Metrics                    │
├─────────────────────────────────────┤
│  - Justificaciones generadas/día     │
│  - Confianza promedio                │
│  - Preguntas sin justificación       │
│  - Costo por justificación           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  AI Metrics                          │
├─────────────────────────────────────┤
│  - Tokens utilizados                 │
│  - Latencia de Gemini               │
│  - Rate de validación exitosa        │
│  - Regeneraciones necesarias         │
└─────────────────────────────────────┘
```

### Logging Estructurado

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  service: 'gemini-service',
  function: 'generateJustification',
  questionId: 'ABC123',
  duration: 3450,
  status: 'success',
}));
```

## 🔮 Extensibilidad Futura

### 1. Múltiples Modelos de IA

```typescript
interface AIProvider {
  generateJustification(data: QuestionGenerationData): Promise<AIJustification>;
}

class GeminiProvider implements AIProvider { /* ... */ }
class OpenAIProvider implements AIProvider { /* ... */ }
class ClaudeProvider implements AIProvider { /* ... */ }

// Factory Pattern
class AIProviderFactory {
  static create(type: 'gemini' | 'openai' | 'claude'): AIProvider {
    // ...
  }
}
```

### 2. Justificaciones Multiidioma

```typescript
interface JustificationRequest {
  questionId: string;
  language: 'es' | 'en' | 'fr';
}

// El prompt se ajusta según idioma
buildPrompt(data: QuestionGenerationData, language: string) {
  const promptTemplates = {
    es: spanishPrompt,
    en: englishPrompt,
    fr: frenchPrompt,
  };
  // ...
}
```

### 3. Análisis de Aprendizaje

```typescript
interface StudentAnalysis {
  studentId: string;
  weakConcepts: string[];
  strongConcepts: string[];
  recommendedQuestions: string[];
}

async analyzeStudentPerformance(
  studentId: string
): Promise<StudentAnalysis> {
  // Analizar respuestas del estudiante
  // Identificar patrones
  // Generar recomendaciones personalizadas
}
```

## 📝 Decisiones de Arquitectura (ADR)

### ADR-001: TypeScript para Todo el Backend

**Decisión**: Usar TypeScript en lugar de JavaScript

**Razones**:
- Type safety
- Mejor tooling y autocompletado
- Documentación implícita
- Menos bugs en runtime
- Mejor refactoring

### ADR-002: Singleton Services

**Decisión**: Usar patrón Singleton para servicios

**Razones**:
- Evitar múltiples instancias
- Estado compartido cuando necesario
- Inicialización única
- Fácil acceso global

### ADR-003: Procesamiento Secuencial en Batch

**Decisión**: Procesar preguntas secuencialmente en lugar de paralelo

**Razones**:
- Respetar rate limiting de Gemini
- Evitar costos excesivos
- Control fino de errores
- Logs más claros

### ADR-004: JSON como Formato de Respuesta de IA

**Decisión**: Forzar a Gemini a responder en JSON

**Razones**:
- Parsing consistente
- Validación estructural
- Fácil integración
- Menos ambigüedad

---

**Documentación actualizada**: Diciembre 10, 2025
**Versión de la arquitectura**: 2.0.0

