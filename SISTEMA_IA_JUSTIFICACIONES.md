# Sistema de Justificaciones con IA - Supérate

## 📋 Descripción General

Sistema completo para la generación automática de justificaciones educativas utilizando **Gemini AI**. El sistema analiza preguntas de opción múltiple y genera explicaciones detalladas de:

- ✅ Por qué la respuesta correcta es correcta
- ❌ Por qué cada respuesta incorrecta es incorrecta
- 🎯 Conceptos clave que los estudiantes deben dominar
- 📊 Análisis de dificultad y confianza

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA GENERAL                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  Gemini AI   │
│  (React/TS)  │     │  (Functions) │     │   (Google)   │
└──────────────┘     └──────────────┘     └──────────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │  Firestore   │
                     │  (Database)  │
                     └──────────────┘
```

### Componentes Principales

#### 1. **Servicios Core** (`functions/src/services/`)

- **`question.service.ts`**: Gestión de preguntas en Firestore
- **`gemini.service.ts`**: Interacción con Gemini AI
- **`justification.service.ts`**: Orquestación del proceso completo

#### 2. **Configuración** (`functions/src/config/`)

- **`firebase.config.ts`**: Configuración de Firebase Admin
- **`gemini.config.ts`**: Cliente y configuración de Gemini AI

#### 3. **Tipos TypeScript** (`functions/src/types/`)

- **`question.types.ts`**: Interfaces y tipos del sistema

#### 4. **Endpoints HTTP** (`functions/src/index.ts`)

Funciones serverless desplegadas en Firebase:

- `generateJustification`: Genera justificación para una pregunta
- `processBatch`: Procesa múltiples preguntas
- `regenerateJustification`: Regenera una justificación existente
- `justificationStats`: Obtiene estadísticas
- `validateJustification`: Valida una justificación
- `health`: Health check del sistema

#### 5. **Scripts** (`functions/src/scripts/`)

- **`generateJustifications.ts`**: Script para procesamiento masivo

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18 o superior
- Firebase CLI: `npm install -g firebase-tools`
- Cuenta de Firebase con Firestore habilitado
- API Key de Gemini AI

### Paso 1: Configurar Gemini AI

1. Obtén tu API Key en: https://makersuite.google.com/app/apikey
2. Guárdala de forma segura

### Paso 2: Configurar Variables de Entorno

```bash
cd functions
cp .env.example .env
```

Edita `.env` y añade tu API key:

```env
GEMINI_API_KEY=tu_api_key_real_aqui
```

### Paso 3: Instalar Dependencias

```bash
cd functions
npm install
```

### Paso 4: Compilar TypeScript

```bash
npm run build
```

### Paso 5: Configurar Firebase Functions

Configura la variable de entorno en Firebase:

```bash
firebase functions:config:set gemini.api_key="TU_API_KEY_AQUI"
```

## 📦 Despliegue

### Desarrollo Local

```bash
# Compilar y servir localmente con emuladores
cd functions
npm run serve
```

### Despliegue a Producción

```bash
# Desplegar todas las functions
firebase deploy --only functions

# Desplegar una function específica
firebase deploy --only functions:generateJustification
```

## 🔧 Uso del Sistema

### Opción 1: Mediante HTTP Endpoints

#### Generar Justificación Individual

```bash
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "ABC123",
    "force": false
  }'
```

#### Procesar Lote de Preguntas

```bash
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/processBatch \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 10,
    "delayBetweenBatches": 2000,
    "filters": {
      "subject": "Matemáticas",
      "level": "Fácil"
    }
  }'
```

#### Obtener Estadísticas

```bash
curl https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats?subject=Matemáticas
```

### Opción 2: Mediante Script CLI

#### Ver Estadísticas (Dry Run)

```bash
cd functions
npm run generate-justifications -- --dry-run
```

#### Generar Todas las Justificaciones Faltantes

```bash
npm run generate-justifications
```

#### Filtrar por Materia

```bash
npm run generate-justifications -- --subject Matemáticas
```

#### Filtrar por Nivel

```bash
npm run generate-justifications -- --level Fácil --batch-size 20
```

#### Filtrar por Grado

```bash
npm run generate-justifications -- --grade 0 --delay 3000
```

### Opción 3: Integración en el Frontend

```typescript
// Generar justificación desde el frontend
const generateJustification = async (questionId: string) => {
  const response = await fetch(
    'https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, force: false }),
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Justificación generada:', result.data);
  } else {
    console.error('Error:', result.error.message);
  }
};
```

## 📊 Estructura de Datos

### Pregunta en Firestore

```typescript
{
  id: "ABC123",
  code: "MAAL1F001",
  subject: "Matemáticas",
  topic: "Álgebra",
  level: "Fácil",
  questionText: "¿Cuánto es 2 + 2?",
  options: [
    { id: "A", text: "3", isCorrect: false },
    { id: "B", text: "4", isCorrect: true },
    { id: "C", text: "5", isCorrect: false },
    { id: "D", text: "6", isCorrect: false }
  ],
  aiJustification: {
    correctAnswerExplanation: "La respuesta correcta es 4 porque...",
    incorrectAnswersExplanation: [
      {
        optionId: "A",
        explanation: "3 es incorrecto porque..."
      },
      // ... más explicaciones
    ],
    keyConcepts: ["Suma básica", "Aritmética"],
    perceivedDifficulty: "Fácil",
    generatedAt: "2025-12-10T...",
    generatedBy: "gemini-1.5-flash",
    confidence: 0.95,
    promptVersion: "2.0.0"
  }
}
```

## 🎯 Prompts Optimizados

El sistema utiliza prompts cuidadosamente diseñados que:

1. **Establecen Contexto**: Gemini actúa como experto educador
2. **Proporcionan Estructura**: JSON claramente definido
3. **Dan Directrices**: Claridad, precisión, enfoque educativo
4. **Incluyen Ejemplos**: Formato esperado de respuesta
5. **Especifican Restricciones**: Solo JSON, sin markdown

Ver código completo en `functions/src/services/gemini.service.ts`

## 🔒 Seguridad

### Rate Limiting

El sistema implementa rate limiting automático:

- Máximo 15 requests por minuto a Gemini
- Delay de 1 segundo entre cada request
- Backoff exponencial en caso de errores

### Validación

- Validación de estructura de respuestas de Gemini
- Verificación de campos requeridos
- Análisis de confianza (confidence)

### Permisos de Firestore

Asegúrate de que las reglas de Firestore permitan:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /superate/auth/questions/{questionId} {
      // Permitir lectura a usuarios autenticados
      allow read: if request.auth != null;
      
      // Solo Cloud Functions pueden escribir aiJustification
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['aiJustification', 'updatedAt']);
    }
  }
}
```

## 📈 Monitoreo y Logging

### Ver Logs en Tiempo Real

```bash
firebase functions:log --only generateJustification
```

### Métricas en Firebase Console

- Invocaciones
- Tiempo de ejecución
- Errores
- Uso de memoria

## 🐛 Solución de Problemas

### Error: "GEMINI_API_KEY no está configurada"

**Solución**: Configura la API key en Functions:

```bash
firebase functions:config:set gemini.api_key="TU_API_KEY"
firebase deploy --only functions
```

### Error: "Rate limit exceeded"

**Solución**: El sistema maneja esto automáticamente con delays. Si persiste:

1. Aumenta `delayBetweenBatches` en la configuración
2. Reduce `batchSize`

### Error: "Timeout al generar contenido"

**Solución**: 

1. Verifica tu conexión a internet
2. El sistema reintenta automáticamente hasta 3 veces
3. Considera aumentar el timeout en `gemini.config.ts`

### Las justificaciones son de baja calidad

**Solución**:

1. Revisa el prompt en `gemini.service.ts`
2. Ajusta la temperatura en `gemini.config.ts`
3. Usa `regenerateJustification` para mejorarlas

## 🔄 Mejores Prácticas

### 1. Procesamiento Gradual

No proceses todas las preguntas a la vez:

```bash
# Primero: ver cuántas faltan
npm run generate-justifications -- --dry-run

# Luego: procesar en lotes pequeños
npm run generate-justifications -- --batch-size 10
```

### 2. Validar Antes de Usar

```typescript
// Validar justificación antes de mostrarla
const validation = await validateJustification(questionId);
if (!validation.isValid) {
  console.log('Issues:', validation.issues);
  // Considerar regenerar
}
```

### 3. Monitorear Costos

Gemini tiene costos asociados. Monitorea:

- Número de requests
- Tokens utilizados
- Establece límites de presupuesto

### 4. Backup de Datos

Antes de procesar masivamente:

```bash
# Exportar datos de Firestore
firebase firestore:export gs://your-bucket/backups/$(date +%Y%m%d)
```

## 🚦 Función Programada (Cron)

El sistema incluye una función que se ejecuta automáticamente:

```typescript
// Se ejecuta diariamente a las 2:00 AM
scheduledJustificationGeneration
```

Para deshabilitarla:

```bash
firebase functions:delete scheduledJustificationGeneration
```

## 📚 Recursos Adicionales

- [Documentación de Gemini AI](https://ai.google.dev/docs)
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Soporte

Para problemas o preguntas:

1. Revisa la sección de solución de problemas
2. Consulta los logs: `firebase functions:log`
3. Contacta al equipo de desarrollo

## 📄 Licencia

Sistema propietario de Supérate © 2025

---

**Última actualización**: Diciembre 10, 2025
**Versión del sistema**: 2.0.0
**Versión del prompt**: 2.0.0

