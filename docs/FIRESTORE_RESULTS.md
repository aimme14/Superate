# Colección `results` en Firestore

## Uso

La colección **`results`** almacena los resultados de las pruebas presentadas por los estudiantes:

- **Ruta:** `results / {userId} / {phaseName} / {docId}`
- **phaseName:** `fase I`, `Fase II` o `fase III`
- **docId:** slug de materia (`matematicas`, `lenguaje`, `ciencias_sociales`, `biologia`, `quimica`, `fisica`, `ingles`) — **como máximo 7 documentos por fase**, un intento por materia. El ID del cuestionario generado se guarda en el campo `examId` dentro del documento.
- Cada documento en una subcolección de fase representa el resultado completado de esa materia en esa fase (un reintento sobrescribe el mismo doc y elimina duplicados previos con el mismo slug al guardar).

El registro de pruebas mantiene un **contador** en `examRegistry/examCounter` (campo `count`), actualizado al guardar cada examen vía `examResults.service` y `examRegistryService.registerExam`.

## Permisos necesarios

Cualquier herramienta o script que **lea** la colección **`results`** y sus subcolecciones por fase (`results/{userId}/fase I`, `Fase II`, `fase III`) necesita reglas que permitan esas lecturas en el contexto correspondiente (por ejemplo, administrador o backend con Admin SDK).

## Desempeño y lecturas (cliente estudiante)

- `fetchEvaluationsFromStudentSummary` / `useStudentEvaluations` **solo** leen `userLookup` + `studentSummaries/{studentId}` (2 documentos) y reconstruyen `ExamResult[]` desde `examSnapshot` por fase y materia. El resumen debe mantenerse actualizado en backend al presentar cada examen.
- Si no hay institución, no existe el resumen o hay error de lectura, la lista de evaluaciones queda **vacía** hasta que exista un resumen válido.

### Punto 8 (legacy vs fuente actual)

- **Legacy:** el documento raíz `results/{uid}` con todos los exámenes embebidos **no** debe usarse en el cliente para listar o analizar intentos.
- **Fuente correcta en UI:** reconstruir desde **`studentSummaries`** (vía `fetchEvaluationsFromStudentSummary`). La colección **`results/{uid}/{fase}/…`** sigue siendo la ruta de **escritura** al guardar cada examen y la base del resumen que actualiza el backend.
- **Admin (pantallas que listan por estudiante):** informes por fase y el diálogo de detalle en análisis usan la misma reconstrucción desde resumen, no lecturas directas a subcolecciones de `results` por estudiante.

## Desempeño y lecturas (cliente administrador — total global)

- El total **“Pruebas presentadas”** sigue pudiendo leer **`examRegistry/examCounter`** (preferido). El fallback que escanea `results/` es costoso y solo aplica si ese contador no existe; no sustituye al resumen por estudiante anterior.
