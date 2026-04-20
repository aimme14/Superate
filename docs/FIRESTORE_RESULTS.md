# Colección `results` en Firestore

## Uso

La colección **`results`** almacena los resultados de las pruebas presentadas por los estudiantes:

- **Ruta:** `results / {userId} / {phaseName} / {docId}`
- **phaseName:** `fase I`, `Fase II` o `fase III`
- **docId:** slug de materia (`matematicas`, `lenguaje`, `ciencias_sociales`, `biologia`, `quimica`, `fisica`, `ingles`) — **como máximo 7 documentos por fase**, un intento por materia. El ID del cuestionario generado se guarda en el campo `examId` dentro del documento.
- Cada documento en una subcolección de fase representa el resultado completado de esa materia en esa fase (un reintento sobrescribe el mismo doc y elimina duplicados previos con el mismo slug al guardar).

## Permisos necesarios

Cualquier herramienta o script que **lea** la colección **`results`** y sus subcolecciones por fase (`results/{userId}/fase I`, `Fase II`, `fase III`) necesita reglas que permitan esas lecturas en el contexto correspondiente (por ejemplo, administrador o backend con Admin SDK).

## Desempeño y lecturas (cliente estudiante)

- `fetchEvaluationsFromStudentSummary` / `useStudentEvaluations` **solo** leen `userLookup` + `studentSummaries/{studentId}` (2 documentos) y reconstruyen `ExamResult[]` desde `examSnapshot` por fase y materia. El resumen debe mantenerse actualizado en backend al presentar cada examen.
- Si no hay institución, no existe el resumen o hay error de lectura, la lista de evaluaciones queda **vacía** hasta que exista un resumen válido.

### Punto 8 (legacy vs fuente actual)

- **Legacy:** el documento raíz `results/{uid}` con todos los exámenes embebidos **no** debe usarse en el cliente para listar o analizar intentos.
- **Fuente correcta en UI:** reconstruir desde **`studentSummaries`** (vía `fetchEvaluationsFromStudentSummary`). La colección **`results/{uid}/{fase}/…`** sigue siendo la ruta de **escritura** al guardar cada examen y la base del resumen que actualiza el backend.
- **Admin (pantallas que listan por estudiante):** informes por fase y el diálogo de detalle en análisis usan la misma reconstrucción desde resumen, no lecturas directas a subcolecciones de `results` por estudiante.

## Desempeño y lecturas (cliente administrador — totales)

- Un conteo global de pruebas requeriría agregaciones o consultas administradas; el resumen por estudiante sigue yendo por `studentSummaries` (y orígenes alineados con el análisis en el admin). La colección `examRegistry` (si existen documentos legacy) ya no se escribe desde el cliente.
