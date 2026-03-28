# Colección `results` en Firestore

## Uso

La colección **`results`** almacena los resultados de las pruebas presentadas por los estudiantes:

- **Ruta:** `results / {userId} / {phaseName} / {docId}`
- **phaseName:** `fase I`, `Fase II` o `fase III`
- **docId:** slug de materia (`matematicas`, `lenguaje`, `ciencias_sociales`, `biologia`, `quimica`, `fisica`, `ingles`) — **como máximo 7 documentos por fase**, un intento por materia. El ID del cuestionario generado se guarda en el campo `examId` dentro del documento.
- Cada documento en una subcolección de fase representa el resultado completado de esa materia en esa fase (un reintento sobrescribe el mismo doc y elimina duplicados previos con el mismo slug al guardar).

El **dashboard del administrador** muestra el total de "Pruebas presentadas" usando:

1. **Contador central:** documento `examRegistry/examCounter` (campo `count`), actualizado cada vez que se guarda un examen vía `examResults.service`.
2. **Fallback (conteo manual):** si el contador no está disponible o es 0, se cuenta leyendo todos los documentos en `results/{userId}/{phaseName}` para cada estudiante y cada fase.

## Permisos necesarios

Para que el conteo de pruebas funcione correctamente:

- El contexto que ejecuta **getAdminStats** / **getTotalCompletedExams** (backend con Admin SDK o cliente con usuario admin) debe tener **lectura** en:
  - Colección **`results`** (lista de documentos por estudiante)
  - Subcolecciones **`results/{userId}/fase I`**, **`results/{userId}/Fase II`**, **`results/{userId}/fase III`**

Si el dashboard muestra 0 pruebas cuando sí hay exámenes guardados, revisar:

1. Que las reglas de Firestore permitan leer la colección `results` y sus subcolecciones para el rol/contexto del administrador.
2. Que no exista un error en consola o en los logs del backend al ejecutar el conteo (por ejemplo, permisos denegados).

Si se usa **Firebase Admin SDK** en el backend para obtener las estadísticas, las reglas de seguridad de cliente no aplican a esas lecturas; en ese caso, el fallo suele ser por entorno (proyecto distinto) o por error de red/servicio.

## Desempeño y lecturas (cliente estudiante)

- `fetchEvaluationsFromStudentSummary` / `useStudentEvaluations` **solo** leen `userLookup` + `studentSummaries/{studentId}` (2 documentos) y reconstruyen `ExamResult[]` desde `examSnapshot` por fase y materia. El resumen debe mantenerse actualizado en backend al presentar cada examen.
- Si no hay institución, no existe el resumen o hay error de lectura, la lista de evaluaciones queda **vacía** hasta que exista un resumen válido.

### Punto 8 (legacy vs fuente actual)

- **Legacy:** el documento raíz `results/{uid}` con todos los exámenes embebidos **no** debe usarse en el cliente para listar o analizar intentos.
- **Fuente correcta en UI:** reconstruir desde **`studentSummaries`** (vía `fetchEvaluationsFromStudentSummary`). La colección **`results/{uid}/{fase}/…`** sigue siendo la ruta de **escritura** al guardar cada examen y la base del resumen que actualiza el backend.
- **Admin (pantallas que listan por estudiante):** informes por fase y el diálogo de detalle en análisis usan la misma reconstrucción desde resumen, no lecturas directas a subcolecciones de `results` por estudiante.

## Desempeño y lecturas (cliente administrador — total global)

- El total **“Pruebas presentadas”** sigue pudiendo leer **`examRegistry/examCounter`** (preferido). El fallback que escanea `results/` es costoso y solo aplica si ese contador no existe; no sustituye al resumen por estudiante anterior.
