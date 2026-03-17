# Propuesta 4: Agregados en backend para promedios y ranking

## Objetivo

Reducir las **miles de lecturas** que hace el dashboard del rector (y otros roles) al calcular promedios institucionales, rankings y evolución por materia. Hoy el cliente lee `results/{studentId}/{phase}` por cada estudiante y por cada fase (p. ej. 300 × 5 exámenes por fase, y 3 fases para evolución), lo que dispara el costo en Firestore.

La idea es **precalcular** esos agregados en el backend y que el cliente solo lea **un documento (o pocos) por vista**.

---

## Cómo funcionaría

### 1. Dónde vivirían los agregados

En Firestore (o en otro almacenamiento que prefieras), documentos de **estadísticas por institución** (y opcionalmente por sede/grado/jornada), por ejemplo:

- **Promedio institucional por fase**
  - Ruta sugerida: `superate/stats/institutions/{institutionId}/phaseAverages`
  - Documento por fase, p. ej. `fase I`, `Fase II`, `fase III`, con estructura:
    - `averageGlobalScore`, `studentCount`, `lastUpdated`, y opcionalmente desglose por grado/jornada.

- **Ranking por institución/fase/filtros**
  - Ruta sugerida: `superate/stats/institutions/{institutionId}/rankings/{phase}_{gradeId}_{jornada}_{year}`
  - Contenido: array (o subcolección) de `{ studentId, globalScore, totalExams, completedSubjects }` ordenado por `globalScore` descendente.

- **Evolución por materia (promedios por fase y materia)**
  - Ruta sugerida: `superate/stats/institutions/{institutionId}/evolution/{year}_{jornada}_{gradeId}`
  - Contenido: por fase y materia, promedios ya calculados (p. ej. `phase1.Matematicas`, `phase2.Lenguaje`, etc.) para pintar el gráfico sin leer todos los `results` de cada estudiante.

Así, el cliente en lugar de hacer cientos/miles de lecturas en `results`, haría **1 getDoc** (o unos pocos) por vista.

### 2. Quién escribe los agregados: Cloud Functions

- **Disparador por escritura en `results`**  
  Cada vez que se escribe (o se actualiza) un documento en `results/{studentId}/{phaseName}/{examId}`:
  1. La función lee el contexto (institución del estudiante, grado, jornada, año).
  2. Recalcula solo los agregados afectados (esa institución, esa fase, ese grado/jornada si aplica).
  3. Actualiza los documentos de estadísticas correspondientes (promedio, ranking, evolución).

- **Alternativa o complemento: job programado**  
  Un **scheduled function** (p. ej. cada hora o cada noche) que:
  1. Lista instituciones (o las que tengan actividad reciente).
  2. Para cada una, lee los `results` necesarios (en lotes) y recalcula promedios, rankings y evolución.
  3. Escribe/actualiza los documentos de `superate/stats/...`.

La primera opción da datos “casi en tiempo real”; la segunda simplifica la lógica y reduce coste de escrituras, a cambio de estadísticas con algo de retraso.

### 3. Flujo del cliente (dashboard rector)

1. **Promedio institucional**  
   En lugar de leer `results` de 300 estudiantes:
   - `getDoc(stats/institutions/{institutionId}/phaseAverages/fase I)` (y opcionalmente Fase II, fase III).
   - Mostrar `averageGlobalScore` y `studentCount`.

2. **Ranking**  
   En lugar de `getFilteredStudents` + 300 × 5 lecturas en `results`:
   - `getDoc(stats/institutions/{institutionId}/rankings/{phase}_{gradeId}_{jornada}_{year})`.
   - El documento trae el array ordenado; el cliente solo cruza con la lista de estudiantes ya en memoria (nombres, etc.) si hace falta.

3. **Evolución por materia**  
   En lugar de 300 × 3 × 5 lecturas:
   - `getDoc(stats/institutions/{institutionId}/evolution/{year}_{jornada}_{gradeId})`.
   - El cliente pinta el gráfico con los promedios por fase y materia que vienen en el documento.

### 4. Consideraciones

- **Seguridad**  
  Reglas de Firestore (o tu capa API) deben permitir solo lectura de stats a usuarios con rol rector/coordinador/admin de esa institución.

- **Coste**  
  - Menos lecturas en el cliente → gran ahorro en Firestore.
  - Más escrituras en el backend (cada nuevo resultado actualiza agregados). Se puede amortiguar con batching o con el job programado.

- **Consistencia**  
  Si usas disparadores on-write, los agregados reflejan siempre los últimos resultados. Si usas solo job programado, hay que asumir un retraso (p. ej. “estadísticas con datos hasta hace 1 hora”).

- **Estructura de documentos**  
  Mantener documentos de agregados por debajo del límite de 1 MiB de Firestore; si un ranking es muy largo, usar subcolecciones o dividir por rangos (p. ej. top 100, siguiente 100).

---

## Resumen

| Hoy (cliente)              | Con propuesta 4 (cliente)     |
|---------------------------|-------------------------------|
| Miles de lecturas en `results` por sesión | 1–3 getDoc por vista (stats precalculados) |
| Cálculo en el navegador   | Cálculo en Cloud Functions / job |
| Coste de lectura alto     | Coste de lectura bajo; coste de escritura en backend |

La implementación requiere definir bien la estructura de `superate/stats/...`, implementar las Cloud Functions (on-write y/o scheduled) y cambiar el dashboard para consumir esos documentos en lugar de calcular desde `results` en el cliente.
