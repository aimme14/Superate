# 🤖 Sistema de Justificaciones con IA - Supérate

> Sistema completo de generación automática de justificaciones educativas usando **Gemini AI**, **TypeScript**, **Firebase Functions** y **Firestore**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Functions-orange)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-purple)](https://ai.google.dev/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green)]()

---

## 🎯 ¿Qué es esto?

Un sistema de IA que analiza preguntas de opción múltiple y genera automáticamente:

- ✅ **Explicación de la respuesta correcta** (por qué es correcta)
- ❌ **Explicación de cada respuesta incorrecta** (por qué están mal)
- 🎓 **Conceptos clave** que el estudiante debe dominar
- 📊 **Análisis de dificultad** y nivel de confianza

**Resultado**: Añade automáticamente el campo `aiJustification` a cada pregunta en Firestore.

---

## ⚡ Inicio Rápido (5 minutos)

```bash
# 1. Instalar
cd functions
npm install

# 2. Configurar
cp .env.example .env
# Edita .env y añade tu GEMINI_API_KEY

# 3. Compilar
npm run build

# 4. Ver estadísticas
npm run generate-justifications -- --dry-run

# 5. Generar primeras justificaciones
npm run generate-justifications -- --batch-size 5
```

**Ver guía completa**: [`INICIO_RAPIDO.md`](./INICIO_RAPIDO.md)

---

## 📚 Documentación

### 🚀 Para Empezar

1. **[INICIO_RAPIDO.md](./INICIO_RAPIDO.md)** - Setup en 5 minutos
2. **[RESUMEN_SISTEMA_COMPLETO.md](./RESUMEN_SISTEMA_COMPLETO.md)** - Visión general

### 📖 Guías Completas

3. **[SISTEMA_IA_JUSTIFICACIONES.md](./SISTEMA_IA_JUSTIFICACIONES.md)** - Documentación completa
4. **[GUIA_RAPIDA_API_IA.md](./GUIA_RAPIDA_API_IA.md)** - Referencia de API
5. **[ARQUITECTURA_SISTEMA_IA.md](./ARQUITECTURA_SISTEMA_IA.md)** - Arquitectura técnica
6. **[GUIA_DESPLIEGUE_PRODUCCION.md](./GUIA_DESPLIEGUE_PRODUCCION.md)** - Despliegue

### 📋 Referencia

7. **[INDICE_ARCHIVOS_CREADOS.md](./INDICE_ARCHIVOS_CREADOS.md)** - Índice de archivos
8. **[functions/README.md](./functions/README.md)** - Documentación del código

---

## 🏗️ Arquitectura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  Gemini AI   │
│  (React/TS)  │     │  (Functions) │     │   (Google)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼────────┐
                     │   Firestore   │
                     │  (Database)   │
                     └───────────────┘
```

**Componentes principales:**
- 🔧 **3 Servicios** (Question, Gemini, Justification)
- 🌐 **7 Endpoints HTTP** + 1 Scheduled Function
- 📝 **20+ Interfaces TypeScript**
- 🤖 **Prompts optimizados** para educación
- 🔒 **Rate limiting** y manejo de errores

---

## 🚀 Uso

### Script CLI

```bash
# Ver estadísticas
npm run generate-justifications -- --dry-run

# Generar todas las faltantes
npm run generate-justifications

# Filtrar por materia
npm run generate-justifications -- --subject Matemáticas

# Filtrar por nivel
npm run generate-justifications -- --level Fácil

# Filtrar por grado
npm run generate-justifications -- --grade 0
```

### API HTTP

```bash
# Generar justificación
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification \
  -H "Content-Type: application/json" \
  -d '{"questionId": "ABC123"}'

# Ver estadísticas
curl https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats
```

### Integración Frontend

```typescript
import { useState, useEffect } from 'react';

function QuestionResult({ questionId }) {
  const [justification, setJustification] = useState(null);

  useEffect(() => {
    fetch('https://.../generateJustification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId }),
    })
    .then(res => res.json())
    .then(data => setJustification(data.data));
  }, [questionId]);

  return (
    <div>
      {justification && (
        <>
          <h3>Respuesta Correcta:</h3>
          <p>{justification.correctAnswerExplanation}</p>
          
          <h3>Conceptos Clave:</h3>
          <ul>
            {justification.keyConcepts.map(concept => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

---

## 📊 Ejemplo de Resultado

### Pregunta en Firestore (Antes)

```json
{
  "code": "MAAL1F001",
  "subject": "Matemáticas",
  "questionText": "¿Cuánto es 2 + 2?",
  "options": [
    { "id": "A", "text": "3", "isCorrect": false },
    { "id": "B", "text": "4", "isCorrect": true },
    { "id": "C", "text": "5", "isCorrect": false }
  ]
}
```

### Pregunta con IA (Después)

```json
{
  "code": "MAAL1F001",
  "subject": "Matemáticas",
  "questionText": "¿Cuánto es 2 + 2?",
  "options": [...],
  "aiJustification": {
    "correctAnswerExplanation": "La respuesta correcta es 4 porque...",
    "incorrectAnswersExplanation": [
      {
        "optionId": "A",
        "explanation": "3 es incorrecto porque..."
      },
      {
        "optionId": "C",
        "explanation": "5 es incorrecto porque..."
      }
    ],
    "keyConcepts": ["Suma básica", "Aritmética", "Números naturales"],
    "perceivedDifficulty": "Fácil",
    "confidence": 0.98,
    "generatedAt": "2025-12-10T10:30:00Z",
    "generatedBy": "gemini-1.5-flash"
  }
}
```

---

## 🛠️ Tecnologías

- **TypeScript 5.3** - Type safety
- **Firebase Functions** - Serverless backend
- **Firebase Admin SDK** - Firestore access
- **Gemini AI (Flash)** - Generación de contenido
- **Node.js 18** - Runtime

---

## 📦 Estructura del Proyecto

```
Superate/
├── functions/                    # Backend (Cloud Functions)
│   ├── src/
│   │   ├── config/              # Configuraciones
│   │   ├── services/            # Lógica de negocio
│   │   ├── types/               # TypeScript types
│   │   ├── scripts/             # Scripts CLI
│   │   └── index.ts             # Endpoints HTTP
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── docs/                        # Documentación
    ├── SISTEMA_IA_JUSTIFICACIONES.md
    ├── GUIA_RAPIDA_API_IA.md
    ├── ARQUITECTURA_SISTEMA_IA.md
    ├── GUIA_DESPLIEGUE_PRODUCCION.md
    ├── RESUMEN_SISTEMA_COMPLETO.md
    ├── INICIO_RAPIDO.md
    └── INDICE_ARCHIVOS_CREADOS.md
```

---

## 🔐 Seguridad

- ✅ Rate limiting automático (15 req/min)
- ✅ Reintentos con backoff exponencial
- ✅ Validación de datos multinivel
- ✅ Firestore Security Rules configuradas
- ✅ Variables de entorno protegidas
- ✅ CORS configurado

---

## 📈 Performance

- **Tiempo de generación**: 3-5 segundos por pregunta
- **Procesamiento batch**: 50-100 preguntas/hora
- **Rate limiting**: 15 requests/minuto a Gemini
- **Costos**: ~$0.01 por 1000 justificaciones

---

## 🔧 Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/generateJustification` | POST | Genera justificación individual |
| `/processBatch` | POST | Procesa múltiples preguntas |
| `/regenerateJustification` | POST | Regenera justificación |
| `/justificationStats` | GET | Obtiene estadísticas |
| `/validateJustification` | POST | Valida justificación |
| `/aiInfo` | GET | Info del sistema de IA |
| `/health` | GET | Health check |

**Ver documentación completa**: [`GUIA_RAPIDA_API_IA.md`](./GUIA_RAPIDA_API_IA.md)

---

## 🐛 Troubleshooting

### Error común: "GEMINI_API_KEY no está configurada"

```bash
# Local
echo "GEMINI_API_KEY=tu_key_aqui" > functions/.env

# Producción
firebase functions:config:set gemini.api_key="tu_key_aqui"
firebase deploy --only functions
```

**Más soluciones**: Ver sección Troubleshooting en [`SISTEMA_IA_JUSTIFICACIONES.md`](./SISTEMA_IA_JUSTIFICACIONES.md)

---

## 📞 Soporte

1. Revisa la documentación apropiada
2. Consulta los logs: `firebase functions:log`
3. Verifica el health endpoint
4. Contacta al equipo de desarrollo

---

## 📄 Licencia

Sistema propietario de Supérate © 2025

---

## 🎯 Próximos Pasos

1. **[INICIO_RAPIDO.md](./INICIO_RAPIDO.md)** - Configura en 5 minutos
2. **Genera tus primeras justificaciones** - `npm run generate-justifications -- --batch-size 5`
3. **Revisa los resultados** - Firebase Console > Firestore
4. **Integra en tu frontend** - Ver ejemplos en documentación
5. **Despliega a producción** - [`GUIA_DESPLIEGUE_PRODUCCION.md`](./GUIA_DESPLIEGUE_PRODUCCION.md)

---

## 🌟 Características Destacadas

- ✨ **Prompts optimizados** para educación de calidad
- 🚀 **Procesamiento batch** con control de rate limiting
- 📊 **Estadísticas detalladas** por materia, nivel y grado
- 🔄 **Regeneración inteligente** de justificaciones
- ✅ **Validación automática** de calidad
- 📝 **Logging completo** para debugging
- 🔒 **Seguridad robusta** en múltiples niveles
- 📚 **Documentación exhaustiva** (60+ páginas)

---

**Versión**: 2.0.0  
**Estado**: ✅ Producción  
**Última actualización**: Diciembre 10, 2025

**¡Listo para usar! 🚀**

