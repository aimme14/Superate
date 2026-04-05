# Vocabulario académico (HTTP unificado)

Todas las rutas van bajo **`superateHttp`** (no existen funciones sueltas como `getVocabularyWords` en la raíz).

**Base:** `https://us-central1-superate-6c730.cloudfunctions.net/superateHttp`

## Leer el banco (consolidado, 1 lectura en servidor)

```powershell
Invoke-RestMethod -Uri 'https://us-central1-superate-6c730.cloudfunctions.net/superateHttp/getVocabularyWords?materia=matematicas&all=1' -Method Get
```

## Generación masiva por API

No hay ruta `generateVocabularyBatch` en el código actual. Para poblar datos, actualiza los documentos `definitionswords/consolidado_{materia}` en Firestore (campo `items`) o usa un script propio con Admin SDK.

Ver `INSTRUCCIONES_VOCABULARIO.md`.
