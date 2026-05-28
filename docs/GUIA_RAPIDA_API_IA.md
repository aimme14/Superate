# Guía Rápida - API de Justificaciones con IA

## 🚀 Endpoints Disponibles

### Base URL

```
https://us-central1-superate-5a48d.cloudfunctions.net
```

---

## 1️⃣ Generar Justificación Individual

**Endpoint**: `/generateJustification`  
**Método**: `POST`  
**Descripción**: Genera justificación para una pregunta específica

### Request

```json
{
  "questionId": "ABC123",
  "force": false
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `questionId` | string | ✅ | ID del documento en Firestore |
| `force` | boolean | ❌ | Si es `true`, regenera aunque ya exista. Default: `false` |

### Response (Éxito)

```json
{
  "success": true,
  "data": {
    "correctAnswerExplanation": "La respuesta B es correcta porque...",
    "incorrectAnswersExplanation": [
      {
        "optionId": "A",
        "explanation": "Esta opción es incorrecta porque..."
      },
      {
        "optionId": "C",
        "explanation": "Esta opción es incorrecta porque..."
      }
    ],
    "keyConcepts": [
      "Concepto 1",
      "Concepto 2",
      "Concepto 3"
    ],
    "perceivedDifficulty": "Medio",
    "generatedAt": "2025-12-10T10:30:00.000Z",
    "generatedBy": "gemini-1.5-flash",
    "confidence": 0.92,
    "promptVersion": "2.0.0"
  },
  "metadata": {
    "processingTime": 3450,
    "timestamp": "2025-12-10T10:30:00.000Z"
  }
}
```

### Response (Error)

```json
{
  "success": false,
  "error": {
    "message": "Pregunta no encontrada"
  }
}
```

### Ejemplo con cURL

```bash
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "ABC123",
    "force": false
  }'
```

### Ejemplo con JavaScript/TypeScript

```typescript
async function generateJustification(questionId: string, force = false) {
  const response = await fetch(
    'https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, force }),
    }
  );
  
  const result = await response.json();
  return result;
}

// Uso
const result = await generateJustification('ABC123');
if (result.success) {
  console.log('Justificación:', result.data);
}
```

---

## 2️⃣ Procesar Lote de Preguntas

**Endpoint**: `/processBatch`  
**Método**: `POST`  
**Descripción**: Procesa múltiples preguntas sin justificación

### Request

```json
{
  "batchSize": 10,
  "delayBetweenBatches": 2000,
  "maxRetries": 3,
  "filters": {
    "subject": "Matemáticas",
    "level": "Fácil",
    "grade": "0"
  }
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `batchSize` | number | ❌ | Preguntas por lote. Default: `10` |
| `delayBetweenBatches` | number | ❌ | Milisegundos entre requests. Default: `2000` |
| `maxRetries` | number | ❌ | Reintentos máximos. Default: `3` |
| `filters` | object | ❌ | Filtros de búsqueda |

#### Filtros Disponibles

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| `subject` | string | Nombre de la materia (ej: "Matemáticas") |
| `subjectCode` | string | Código de materia (ej: "MA") |
| `topic` | string | Nombre del tema |
| `topicCode` | string | Código del tema |
| `grade` | string | Grado: "6", "7", "8", "9", "0", "1" |
| `level` | string | Nivel: "Fácil", "Medio", "Difícil" |

### Response

```json
{
  "success": true,
  "data": {
    "totalProcessed": 10,
    "successful": 9,
    "failed": 1,
    "skipped": 0,
    "errors": [
      {
        "questionId": "XYZ789",
        "questionCode": "MAAL1F005",
        "error": "Timeout al generar contenido"
      }
    ],
    "startTime": "2025-12-10T10:00:00.000Z",
    "endTime": "2025-12-10T10:05:30.000Z",
    "durationMs": 330000
  },
  "metadata": {
    "timestamp": "2025-12-10T10:05:30.000Z"
  }
}
```

### Ejemplo con cURL

```bash
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/processBatch \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 5,
    "filters": {
      "subject": "Matemáticas",
      "level": "Fácil"
    }
  }'
```

---

## 3️⃣ Regenerar Justificación

**Endpoint**: `/regenerateJustification`  
**Método**: `POST`  
**Descripción**: Fuerza la regeneración de una justificación existente

### Request

```json
{
  "questionId": "ABC123"
}
```

### Response

Igual que `generateJustification`

---

## 4️⃣ Obtener Estadísticas

**Endpoint**: `/justificationStats`  
**Método**: `GET`  
**Descripción**: Obtiene estadísticas de justificaciones generadas

### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `subject` | string | Filtrar por materia |
| `level` | string | Filtrar por nivel |
| `grade` | string | Filtrar por grado |

### Response

```json
{
  "success": true,
  "data": {
    "total": 150,
    "withJustification": 120,
    "withoutJustification": 30,
    "bySubject": {
      "Matemáticas": {
        "total": 50,
        "withJustification": 40
      },
      "Ciencias": {
        "total": 40,
        "withJustification": 35
      }
    },
    "byLevel": {
      "Fácil": {
        "total": 60,
        "withJustification": 55
      },
      "Medio": {
        "total": 50,
        "withJustification": 40
      },
      "Difícil": {
        "total": 40,
        "withJustification": 25
      }
    },
    "byGrade": {
      "0": {
        "total": 30,
        "withJustification": 25
      }
    },
    "averageConfidence": 0.89
  },
  "metadata": {
    "timestamp": "2025-12-10T10:00:00.000Z"
  }
}
```

### Ejemplo con cURL

```bash
# Todas las estadísticas
curl https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats

# Filtradas por materia
curl "https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats?subject=Matemáticas"

# Filtradas por nivel
curl "https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats?level=Fácil"
```

---

## 5️⃣ Validar Justificación

**Endpoint**: `/validateJustification`  
**Método**: `POST`  
**Descripción**: Valida la calidad de una justificación existente

### Request

```json
{
  "questionId": "ABC123"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": [],
    "suggestions": [
      "Se recomienda añadir más conceptos clave"
    ]
  },
  "metadata": {
    "timestamp": "2025-12-10T10:00:00.000Z"
  }
}
```

---

## 6️⃣ Health Check

**Endpoint**: `/health`  
**Método**: `GET`  
**Descripción**: Verifica el estado del sistema

### Response

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "gemini": "available",
      "firestore": "available"
    },
    "timestamp": "2025-12-10T10:00:00.000Z"
  }
}
```

---

## 7️⃣ Información del Sistema de IA

**Endpoint**: `/aiInfo`  
**Método**: `GET`  
**Descripción**: Obtiene información sobre el sistema de IA

### Response

```json
{
  "success": true,
  "data": {
    "available": true,
    "clientInfo": {
      "isAvailable": true,
      "model": "gemini-1.5-flash",
      "promptVersion": "2.0.0",
      "requestCount": 45,
      "lastRequestTime": 1702209600000
    },
    "config": {
      "model": "gemini-1.5-flash",
      "promptVersion": "2.0.0",
      "maxRequestsPerMinute": 15
    }
  },
  "metadata": {
    "timestamp": "2025-12-10T10:00:00.000Z"
  }
}
```

---

## 🔐 Autenticación

Actualmente los endpoints son públicos. Para producción, considera:

1. **Firebase Auth**: Verificar tokens de Firebase
2. **API Keys**: Implementar sistema de API keys
3. **CORS**: Configurar dominios permitidos

### Ejemplo con Firebase Auth

```typescript
import { getAuth } from 'firebase/auth';

async function callAPI(endpoint: string, data: any) {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('Usuario no autenticado');
  }
  
  const token = await user.getIdToken();
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

---

## 📊 Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| `200` | Éxito |
| `204` | Sin contenido (CORS preflight) |
| `400` | Solicitud incorrecta (parámetros faltantes) |
| `404` | Recurso no encontrado |
| `405` | Método no permitido |
| `500` | Error interno del servidor |

---

## 🎯 Ejemplos de Integración

### React Component

```typescript
import React, { useState } from 'react';

function JustificationGenerator({ questionId }: { questionId: string }) {
  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        'https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setJustification(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={generate} disabled={loading}>
        {loading ? 'Generando...' : 'Generar Justificación'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {justification && (
        <div className="justification">
          <h3>Respuesta Correcta:</h3>
          <p>{justification.correctAnswerExplanation}</p>
          
          <h3>Respuestas Incorrectas:</h3>
          {justification.incorrectAnswersExplanation.map((exp: any) => (
            <div key={exp.optionId}>
              <strong>Opción {exp.optionId}:</strong>
              <p>{exp.explanation}</p>
            </div>
          ))}
          
          <h3>Conceptos Clave:</h3>
          <ul>
            {justification.keyConcepts.map((concept: string, i: number) => (
              <li key={i}>{concept}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 📝 Notas Importantes

1. **Rate Limiting**: El sistema tiene rate limiting interno (15 req/min)
2. **Timeouts**: Las functions tienen timeout de 9 minutos máximo
3. **Costos**: Gemini AI tiene costos asociados, monitorea tu uso
4. **Validación**: Siempre valida las justificaciones antes de mostrarlas
5. **Backups**: Mantén backups de Firestore antes de procesar masivamente

---

**Documentación actualizada**: Diciembre 10, 2025

