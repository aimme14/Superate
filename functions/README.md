# Cloud Functions - Sistema de Justificaciones con IA

Este directorio contiene las Cloud Functions de Firebase que implementan el sistema de generación automática de justificaciones con Gemini AI.

## 📁 Estructura de Archivos

```
functions/
├── src/                          # Código fuente TypeScript
│   ├── config/                   # Configuraciones
│   │   ├── firebase.config.ts    # Firebase Admin SDK
│   │   └── gemini.config.ts      # Cliente de Gemini AI
│   │
│   ├── services/                 # Lógica de negocio
│   │   ├── question.service.ts   # CRUD de preguntas
│   │   ├── gemini.service.ts     # Generación con IA
│   │   └── justification.service.ts  # Orquestación
│   │
│   ├── types/                    # Definiciones TypeScript
│   │   └── question.types.ts     # Interfaces y tipos
│   │
│   ├── scripts/                  # Scripts CLI
│   │   └── generateJustifications.ts
│   │
│   └── index.ts                  # Endpoints HTTP
│
├── lib/                          # Código compilado (generado)
├── node_modules/                 # Dependencias
├── .env.example                  # Ejemplo de variables de entorno
├── .gitignore                    # Archivos ignorados por Git
├── package.json                  # Dependencias y scripts
├── tsconfig.json                 # Configuración TypeScript
└── README.md                     # Este archivo
```

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
# Edita .env y añade tu GEMINI_API_KEY
```

### 3. Compilar TypeScript

```bash
npm run build
```

### 4. Probar Localmente

```bash
npm run serve
```

### 5. Desplegar a Producción

```bash
# Desde la raíz del proyecto
firebase deploy --only functions
```

## 📦 Scripts Disponibles

```bash
# Desarrollo
npm run build           # Compilar TypeScript
npm run build:watch     # Compilar en modo watch
npm run serve           # Servidor local con emuladores

# Producción
npm run deploy          # Desplegar a Firebase
npm run logs            # Ver logs de producción

# Utilidades
npm run generate-justifications  # Script CLI
npm run lint            # Linter
npm run lint:fix        # Linter con auto-fix
```

## 🔧 Configuración de Variables de Entorno

### Desarrollo Local (.env)

```env
GEMINI_API_KEY=tu_api_key_aqui
FIREBASE_STORAGE_BUCKET=superate-5a48d.appspot.com
```

### Producción (Firebase Config)

```bash
firebase functions:config:set gemini.api_key="TU_API_KEY"
firebase functions:config:set firebase.storage_bucket="superate-5a48d.appspot.com"
```

Para ver la configuración actual:

```bash
firebase functions:config:get
```

## 🌐 Endpoints HTTP

Todas las funciones están desplegadas en:

```
https://us-central1-superate-5a48d.cloudfunctions.net/
```

### Funciones Disponibles

| Función | Método | Descripción |
|---------|--------|-------------|
| `generateJustification` | POST | Genera justificación para una pregunta |
| `processBatch` | POST | Procesa múltiples preguntas |
| `regenerateJustification` | POST | Regenera una justificación |
| `justificationStats` | GET | Obtiene estadísticas |
| `validateJustification` | POST | Valida una justificación |
| `aiInfo` | GET | Info del sistema de IA |
| `health` | GET | Health check |

Ver documentación completa en: `GUIA_RAPIDA_API_IA.md`

## 🔨 Desarrollo

### Añadir Nueva Función

1. **Crear el servicio** (si es necesario):

```typescript
// src/services/mi-servicio.service.ts
class MiServicio {
  async miMetodo() {
    // Lógica aquí
  }
}

export const miServicio = new MiServicio();
```

2. **Añadir endpoint en index.ts**:

```typescript
// src/index.ts
export const miNuevaFuncion = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // Lógica del endpoint
  });
```

3. **Compilar y desplegar**:

```bash
npm run build
firebase deploy --only functions:miNuevaFuncion
```

## 🧪 Testing Local

### Emuladores de Firebase

```bash
npm run serve
```

Esto inicia:
- Functions Emulator en http://localhost:5001
- UI de emuladores en http://localhost:4000

### Probar un Endpoint

```bash
curl -X POST http://localhost:5001/superate-5a48d/us-central1/generateJustification \
  -H "Content-Type: application/json" \
  -d '{"questionId": "ABC123"}'
```

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```bash
firebase functions:log --only generateJustification
```

### Métricas en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Functions > Tablero
4. Revisa: invocaciones, errores, tiempo de ejecución

## 🔒 Seguridad

### Rate Limiting

Implementado automáticamente en `gemini.config.ts`:

- Máximo 15 requests por minuto
- Delay de 1 segundo entre requests
- Backoff exponencial en errores

### Autenticación (Opcional)

Para añadir autenticación:

```typescript
// Middleware de autenticación
async function verifyAuth(req: functions.https.Request) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) throw new Error('No autorizado');
  
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken;
}

// Usar en endpoint
export const miEndpoint = functions.https.onRequest(async (req, res) => {
  try {
    const user = await verifyAuth(req);
    // ... lógica del endpoint
  } catch (error) {
    res.status(401).json({ error: 'No autorizado' });
  }
});
```

## 🐛 Debugging

### Logs Detallados

El sistema usa `console.log`, `console.error` para logging:

```typescript
console.log('✅ Operación exitosa');
console.error('❌ Error:', error);
```

### Firebase Debugger

```bash
# Ver logs en tiempo real
firebase functions:log

# Ver logs de una función específica
firebase functions:log --only generateJustification

# Seguir logs (tail)
firebase functions:log --follow
```

## 📈 Optimización

### Mejorar Performance

1. **Memoria**: Ajusta en `index.ts`

```typescript
.runWith({
  memory: '1GB',  // 256MB, 512MB, 1GB, 2GB, 4GB
  timeoutSeconds: 540,
})
```

2. **Concurrencia**: Para procesamiento paralelo

```typescript
const results = await Promise.all(
  questions.map(q => generateJustification(q))
);
```

3. **Cache**: Implementar cache con Redis o Firestore

## 🔄 CI/CD

### GitHub Actions (Ejemplo)

```yaml
name: Deploy Functions

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd functions
          npm ci
      
      - name: Build
        run: |
          cd functions
          npm run build
      
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

## 📚 Recursos

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Gemini AI Docs](https://ai.google.dev/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- Documentación del proyecto: `../SISTEMA_IA_JUSTIFICACIONES.md`

## 🤝 Contribuir

1. Crea una rama: `git checkout -b feature/mi-feature`
2. Haz cambios y commit: `git commit -m "feat: mi feature"`
3. Push: `git push origin feature/mi-feature`
4. Crea un Pull Request

## 📄 Licencia

Sistema propietario de Supérate © 2025

---

**Última actualización**: Diciembre 10, 2025

