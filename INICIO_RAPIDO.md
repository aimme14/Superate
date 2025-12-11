# 🚀 Inicio Rápido - Sistema de Justificaciones con IA

## ⚡ Instalación en 5 Minutos

### 1️⃣ Obtener API Key de Gemini

1. Ve a: https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Clic en "Create API Key"
4. Copia la key (empieza con "AI...")

### 2️⃣ Instalar Dependencias

```bash
cd functions
npm install
```

### 3️⃣ Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita `.env` y pega tu API key:

```env
GEMINI_API_KEY=AIzaSy...tu_key_aqui
```

### 4️⃣ Compilar

```bash
npm run build
```

### 5️⃣ Ver Estadísticas

```bash
npm run generate-justifications -- --dry-run
```

**Resultado esperado:**
```
📈 ESTADÍSTICAS ACTUALES:
  Total de preguntas: 150
  Con justificación: 0 (0.00%)
  Sin justificación: 150 (100.00%)
```

---

## 🎯 Primer Uso

### Generar 5 Justificaciones de Prueba

```bash
npm run generate-justifications -- --batch-size 5 --level Fácil
```

**Verás:**
```
🚀 Iniciando script de generación de justificaciones
📊 Encontradas 50 preguntas sin justificación

[1/5] Procesando MAAL1F001...
  ✅ Éxito (3450ms)
[2/5] Procesando MAAL1F002...
  ✅ Éxito (3200ms)
...

📊 RESUMEN DEL PROCESAMIENTO:
  Total procesadas: 5
  Exitosas: 5
  Fallidas: 0
```

### Verificar en Firestore

1. Abre Firebase Console
2. Ve a Firestore Database
3. Navega a: `superate/auth/questions/[cualquier-id]`
4. Verás el nuevo campo `aiJustification` con:
   - `correctAnswerExplanation`
   - `incorrectAnswersExplanation`
   - `keyConcepts`
   - `confidence`
   - etc.

---

## 🌐 Desplegar a Producción

### Prerequisitos

```bash
# Instalar Firebase CLI (solo una vez)
npm install -g firebase-tools

# Login
firebase login

# Verificar proyecto
firebase use
```

### Despliegue

```bash
# 1. Configurar API Key en Firebase
firebase functions:config:set gemini.api_key="TU_API_KEY"

# 2. Compilar
cd functions
npm run build

# 3. Desplegar
cd ..
firebase deploy --only functions
```

**Resultado esperado:**
```
✔  Deploy complete!

Functions URLs:
generateJustification: https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification
health: https://us-central1-superate-5a48d.cloudfunctions.net/health
...
```

### Probar Endpoint

```bash
curl https://us-central1-superate-5a48d.cloudfunctions.net/health
```

**Respuesta esperada:**
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

---

## 💻 Ejemplos de Uso

### Desde el Frontend (React)

```typescript
// hooks/useJustification.ts
import { useState } from 'react';

export function useJustification() {
  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState(null);

  const generate = async (questionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        'https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId }),
        }
      );
      const result = await res.json();
      if (result.success) {
        setJustification(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, justification };
}

// Componente
function QuestionResult({ questionId, userAnswer, correctAnswer }) {
  const { generate, loading, justification } = useJustification();

  useEffect(() => {
    if (userAnswer !== correctAnswer) {
      generate(questionId);
    }
  }, [questionId]);

  if (loading) return <div>Cargando explicación...</div>;

  if (!justification) return null;

  return (
    <div className="justification">
      <h3>¿Por qué es correcta?</h3>
      <p>{justification.correctAnswerExplanation}</p>

      <h3>¿Por qué tu respuesta es incorrecta?</h3>
      <p>
        {justification.incorrectAnswersExplanation
          .find(exp => exp.optionId === userAnswer)
          ?.explanation}
      </p>

      <h3>Conceptos clave:</h3>
      <ul>
        {justification.keyConcepts.map(concept => (
          <li key={concept}>{concept}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Desde cURL

```bash
# Generar justificación
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/generateJustification \
  -H "Content-Type: application/json" \
  -d '{"questionId": "ABC123"}'

# Ver estadísticas
curl https://us-central1-superate-5a48d.cloudfunctions.net/justificationStats

# Validar justificación
curl -X POST https://us-central1-superate-5a48d.cloudfunctions.net/validateJustification \
  -H "Content-Type: application/json" \
  -d '{"questionId": "ABC123"}'
```

---

## 🔧 Comandos Útiles

```bash
# Ver estadísticas
npm run generate-justifications -- --dry-run

# Generar todas las faltantes
npm run generate-justifications

# Generar solo Matemáticas
npm run generate-justifications -- --subject Matemáticas

# Generar solo nivel Fácil
npm run generate-justifications -- --level Fácil

# Generar para grado específico
npm run generate-justifications -- --grade 0

# Lotes más pequeños (más lento pero más seguro)
npm run generate-justifications -- --batch-size 10 --delay 3000
```

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real

```bash
firebase functions:log --follow
```

### Ver Logs de una Función Específica

```bash
firebase functions:log --only generateJustification
```

### Dashboard de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Functions > Tablero
4. Revisa:
   - Invocaciones
   - Errores
   - Tiempo de ejecución
   - Uso de memoria

---

## 🐛 Solución Rápida de Problemas

### "GEMINI_API_KEY no está configurada"

```bash
# Local: verifica tu .env
cat functions/.env

# Producción: configura en Firebase
firebase functions:config:set gemini.api_key="TU_API_KEY"
firebase deploy --only functions
```

### "Rate limit exceeded"

El sistema maneja esto automáticamente. Si persiste:

```bash
# Aumenta el delay en el script
npm run generate-justifications -- --delay 3000
```

### "Permission denied" en Firestore

Verifica las reglas de Firestore:

```javascript
// firestore.rules
allow update: if request.resource.data.diff(resource.data)
  .affectedKeys().hasOnly(['aiJustification', 'updatedAt']);
```

### Funciones no responden

```bash
# Ver estado
firebase functions:list

# Ver logs
firebase functions:log

# Redesplegar
firebase deploy --only functions --force
```

---

## 📖 Documentación Completa

- **Sistema completo**: `SISTEMA_IA_JUSTIFICACIONES.md`
- **API Reference**: `GUIA_RAPIDA_API_IA.md`
- **Arquitectura**: `ARQUITECTURA_SISTEMA_IA.md`
- **Despliegue**: `GUIA_DESPLIEGUE_PRODUCCION.md`
- **Resumen**: `RESUMEN_SISTEMA_COMPLETO.md`

---

## ✅ Checklist de Verificación

- [ ] API Key de Gemini obtenida
- [ ] Dependencias instaladas (`npm install`)
- [ ] Variables de entorno configuradas (`.env`)
- [ ] Código compilado sin errores (`npm run build`)
- [ ] Dry-run ejecutado exitosamente
- [ ] Primera justificación generada
- [ ] Justificación visible en Firestore
- [ ] Firebase CLI instalado (si vas a desplegar)
- [ ] Functions desplegadas (si aplica)
- [ ] Health endpoint respondiendo

---

## 🎯 Próximos Pasos

1. **Genera 5-10 justificaciones de prueba**
   ```bash
   npm run generate-justifications -- --batch-size 10 --level Fácil
   ```

2. **Revisa la calidad en Firestore**
   - Abre Firebase Console
   - Ve a una pregunta
   - Lee el campo `aiJustification`

3. **Integra en tu Frontend**
   - Usa el hook de ejemplo
   - Muestra justificaciones cuando el usuario falla

4. **Genera todas las faltantes**
   ```bash
   npm run generate-justifications
   ```

5. **Despliega a producción**
   ```bash
   firebase deploy --only functions
   ```

---

## 💡 Tips

1. **Empieza pequeño**: 5-10 preguntas primero
2. **Valida calidad**: Revisa las primeras manualmente
3. **Monitorea costos**: Firebase Console > Facturación
4. **Usa filtros**: Procesa por materia o nivel
5. **Backup**: Exporta Firestore antes de procesar masivamente

---

## 📞 Ayuda

Si algo no funciona:

1. Revisa la sección de problemas arriba
2. Consulta `SISTEMA_IA_JUSTIFICACIONES.md`
3. Revisa los logs: `firebase functions:log`
4. Verifica el `RESUMEN_SISTEMA_COMPLETO.md`

---

**¡Listo! Tu sistema de IA está operativo. 🚀**

**Tiempo total de setup**: ~5-10 minutos  
**Primera justificación**: ~3-5 segundos  
**Costo por 1000 justificaciones**: ~$0.01

---

**Creado**: Diciembre 10, 2025

