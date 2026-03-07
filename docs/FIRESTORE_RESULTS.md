# Colección `results` en Firestore

## Uso

La colección **`results`** almacena los resultados de las pruebas presentadas por los estudiantes:

- **Ruta:** `results / {userId} / {phaseName} / {examId}`
- **phaseName:** `fase I`, `Fase II` o `fase III`
- Cada documento en una subcolección de fase representa un examen completado.

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
