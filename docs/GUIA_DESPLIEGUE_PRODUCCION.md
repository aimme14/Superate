# Guía de Despliegue a Producción

## 📋 Checklist Pre-Despliegue

### ✅ Requisitos Previos

- [ ] Node.js 18+ instalado
- [ ] Firebase CLI instalado: `npm install -g firebase-tools`
- [ ] Cuenta de Firebase activa
- [ ] API Key de Gemini AI obtenida
- [ ] Proyecto de Firebase creado
- [ ] Firestore habilitado
- [ ] Acceso de administrador al proyecto

### ✅ Configuración Local

- [ ] Repositorio clonado
- [ ] Dependencias instaladas: `npm install`
- [ ] Variables de entorno configuradas
- [ ] Código compilando sin errores: `npm run build`
- [ ] Tests pasando (si existen)

### ✅ Configuración de Firebase

- [ ] Firebase project ID correcto
- [ ] Reglas de Firestore configuradas
- [ ] Reglas de Storage configuradas (si aplica)
- [ ] Plan de facturación configurado (Blaze)

---

## 🚀 Proceso de Despliegue Paso a Paso

### Paso 1: Autenticación con Firebase

```bash
# Login a Firebase
firebase login

# Verificar que estés autenticado
firebase projects:list
```

**Resultado esperado:**
```
✔ Success! Logged in as tu-email@ejemplo.com
```

### Paso 2: Seleccionar Proyecto

```bash
# Ver proyectos disponibles
firebase projects:list

# Seleccionar proyecto (o usar .firebaserc)
firebase use superate-5a48d

# Verificar proyecto actual
firebase use
```

**Resultado esperado:**
```
Now using project superate-5a48d
```

### Paso 3: Configurar Variables de Entorno en Firebase

```bash
# Configurar API Key de Gemini
firebase functions:config:set gemini.api_key="TU_API_KEY_REAL_AQUI"

# Configurar otras variables (opcional)
firebase functions:config:set firebase.storage_bucket="superate-5a48d.appspot.com"

# Verificar configuración
firebase functions:config:get
```

**Resultado esperado:**
```json
{
  "gemini": {
    "api_key": "AI..."
  }
}
```

### Paso 4: Compilar TypeScript

```bash
cd functions
npm run build
```

**Resultado esperado:**
```
✔ TypeScript compiled successfully
```

**Verificar:**
```bash
# Debe existir carpeta lib/ con archivos .js
ls -la lib/
```

### Paso 5: Desplegar Functions

```bash
# Desde la raíz del proyecto
firebase deploy --only functions
```

**Esto desplegará:**
- ✅ generateJustification
- ✅ processBatch
- ✅ regenerateJustification
- ✅ justificationStats
- ✅ validateJustification
- ✅ scheduledJustificationGeneration
- ✅ aiInfo
- ✅ health

**Resultado esperado:**
```
✔  Deploy complete!

Functions URLs:
generateJustification: https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification
processBatch: https://us-central1-superate-5a48d.cloudfunctions.net/processBatch
...
```

### Paso 6: Verificar Despliegue

```bash
# Ver funciones desplegadas
firebase functions:list

# Probar health check
curl https://us-central1-superate-5a48d.cloudfunctions.net/health
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "gemini": "available",
      "firestore": "available"
    }
  }
}
```

### Paso 7: Probar Generación de Justificación

```bash
# Reemplaza ABC123 con un ID real de pregunta
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification \
  -H "Content-Type: application/json" \
  -d '{"questionId": "ABC123", "force": false}'
```

### Paso 8: Configurar Reglas de Firestore

```bash
# Desplegar reglas de Firestore
firebase deploy --only firestore:rules
```

**Contenido de firestore.rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /superate/auth/questions/{questionId} {
      // Lectura: usuarios autenticados
      allow read: if request.auth != null;
      
      // Cloud Functions pueden actualizar aiJustification
      allow update: if request.resource.data.diff(resource.data)
        .affectedKeys().hasOnly(['aiJustification', 'updatedAt']);
      
      // Solo admins pueden crear/eliminar
      allow create, delete: if request.auth.token.admin == true;
    }
  }
}
```

### Paso 9: Configurar Monitoreo

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Functions > Configuración
4. Configura alertas:
   - Errores > 5% en 1 hora
   - Tiempo de ejecución > 30s
   - Invocaciones > 1000/día

### Paso 10: Verificar Logs

```bash
# Ver logs en tiempo real
firebase functions:log --follow

# Ver logs de una función específica
firebase functions:log --only generateJustification
```

---

## 🔧 Configuración de firebase.json

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      "*.local"
    ],
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

---

## 📊 Monitoreo Post-Despliegue

### Métricas a Vigilar (Primeras 24h)

1. **Tasa de Error**
   - Objetivo: < 1%
   - Alerta si: > 5%

2. **Tiempo de Respuesta**
   - Objetivo: < 5s (p95)
   - Alerta si: > 30s

3. **Invocaciones**
   - Monitorear patrón de uso
   - Verificar costos

4. **Logs de Error**
   - Revisar cada 6 horas
   - Investigar errores recurrentes

### Dashboard de Firebase Console

```
Firebase Console > Functions
├── Tablero
│   ├── Invocaciones (gráfica)
│   ├── Tiempo de ejecución (gráfica)
│   ├── Errores (gráfica)
│   └── Uso de memoria
│
├── Logs
│   ├── Filtrar por severidad
│   ├── Filtrar por función
│   └── Búsqueda de texto
│
└── Configuración
    ├── Variables de entorno
    ├── Memoria asignada
    └── Timeout
```

---

## 🔒 Seguridad Post-Despliegue

### 1. Rotar API Keys Regularmente

```bash
# Cada 3 meses
firebase functions:config:set gemini.api_key="NUEVA_API_KEY"
firebase deploy --only functions
```

### 2. Auditar Permisos

```bash
# Ver usuarios con acceso al proyecto
firebase projects:get superate-5a48d

# Ver roles IAM
gcloud projects get-iam-policy superate-5a48d
```

### 3. Habilitar Logs de Auditoría

```bash
# En Google Cloud Console
# IAM & Admin > Audit Logs
# Habilitar:
# - Admin Read
# - Data Read
# - Data Write
```

### 4. Configurar Alertas de Seguridad

En Firebase Console > Configuración > Integraciones:
- Slack para notificaciones críticas
- Email para alertas de seguridad

---

## 💰 Optimización de Costos

### 1. Estimar Costos

**Gemini AI:**
- Modelo: gemini-1.5-flash
- Costo: ~$0.00001 por request
- 1000 justificaciones ≈ $0.01

**Cloud Functions:**
- Primeras 2M invocaciones: gratis
- Después: $0.40 por millón

**Firestore:**
- Lecturas: $0.06 por 100K
- Escrituras: $0.18 por 100K
- Almacenamiento: $0.18 GB/mes

### 2. Configurar Presupuesto

```bash
# En Google Cloud Console
# Facturación > Presupuestos y alertas
# Crear presupuesto:
# - Nombre: "Superate Functions"
# - Monto: $50/mes
# - Alertas: 50%, 90%, 100%
```

### 3. Optimizar Uso

```typescript
// En gemini.config.ts
export const GEMINI_CONFIG = {
  // Reducir requests si es necesario
  MAX_REQUESTS_PER_MINUTE: 10, // En lugar de 15
  
  // Aumentar delay entre requests
  DELAY_BETWEEN_REQUESTS_MS: 1500, // En lugar de 1000
};
```

---

## 🔄 Actualizaciones Futuras

### Proceso de Actualización

```bash
# 1. Desarrollar cambios localmente
git checkout -b feature/nueva-funcionalidad

# 2. Probar localmente
cd functions
npm run serve

# 3. Commit y push
git add .
git commit -m "feat: nueva funcionalidad"
git push origin feature/nueva-funcionalidad

# 4. Merge a main (después de code review)
git checkout main
git merge feature/nueva-funcionalidad

# 5. Desplegar a staging (si existe)
firebase use staging
firebase deploy --only functions

# 6. Probar en staging
./scripts/test-staging.sh

# 7. Desplegar a producción
firebase use production
firebase deploy --only functions

# 8. Monitorear
firebase functions:log --follow
```

### Rollback en Caso de Problemas

```bash
# Ver versiones anteriores
firebase functions:list

# Rollback a versión anterior
gcloud functions rollback FUNCTION_NAME \
  --region=us-central1 \
  --project=superate-5a48d

# O redesplegar versión anterior del código
git checkout v1.0.0
cd functions && npm run build
firebase deploy --only functions
```

---

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY no está configurada"

```bash
# Verificar configuración
firebase functions:config:get

# Si está vacía, configurar
firebase functions:config:set gemini.api_key="TU_API_KEY"

# Redesplegar
firebase deploy --only functions
```

### Error: "Permission denied"

```bash
# Verificar roles IAM
firebase projects:get superate-5a48d

# Añadir rol de editor si es necesario
gcloud projects add-iam-policy-binding superate-5a48d \
  --member="user:tu-email@ejemplo.com" \
  --role="roles/editor"
```

### Error: "Quota exceeded"

```bash
# Ver cuotas
gcloud compute project-info describe --project=superate-5a48d

# Solicitar aumento de cuota en Google Cloud Console
# IAM & Admin > Quotas
```

### Functions muy lentas

1. **Aumentar memoria:**
```typescript
// En index.ts
.runWith({
  memory: '2GB', // En lugar de 1GB
  timeoutSeconds: 300,
})
```

2. **Optimizar código:**
```typescript
// Usar Promise.all para operaciones paralelas
const [question, stats] = await Promise.all([
  getQuestion(id),
  getStats()
]);
```

3. **Implementar caché:**
```typescript
// Cache con Cloud Memorystore
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);
```

---

## 📝 Checklist Post-Despliegue

### Inmediatamente después del despliegue:

- [ ] Verificar health endpoint
- [ ] Probar generateJustification con pregunta real
- [ ] Verificar logs: `firebase functions:log`
- [ ] Confirmar aiJustification en Firestore
- [ ] Probar desde frontend (si aplica)

### Primeras 24 horas:

- [ ] Monitorear errores cada 6 horas
- [ ] Verificar costos en Firebase Console
- [ ] Revisar tiempo de respuesta promedio
- [ ] Confirmar que scheduled function ejecutó (si aplica)

### Primera semana:

- [ ] Analizar patrones de uso
- [ ] Optimizar si es necesario
- [ ] Recopilar feedback de usuarios
- [ ] Documentar issues encontrados
- [ ] Planear mejoras

---

## 🎯 Métricas de Éxito

**KPIs a medir:**

1. **Tasa de éxito**: > 95%
2. **Tiempo de respuesta**: < 5s (p95)
3. **Cobertura**: > 80% de preguntas con justificación
4. **Confianza promedio**: > 0.85
5. **Costo por justificación**: < $0.01

---

## 📞 Soporte

**En caso de problemas críticos:**

1. Revisar logs: `firebase functions:log`
2. Verificar Firebase Console > Functions > Estado
3. Consultar documentación: `/SISTEMA_IA_JUSTIFICACIONES.md`
4. Rollback si es necesario
5. Contactar al equipo de desarrollo

---

**Última actualización**: Diciembre 10, 2025
**Versión**: 2.0.0

