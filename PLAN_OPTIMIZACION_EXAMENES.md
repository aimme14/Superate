# Plan maestro — Optimización de la carga de exámenes (lecturas)

**Principio:** el examen es un evento **one-time por materia/fase**. No hay repetición que cachear → el ahorro NO está en caché por-vista, está en hacer **barata la llamada única**. Objetivo: de **~100-200 lecturas por examen → ~1**.

---

## Diagnóstico (medido en código)

- Un examen se arma con `fetchQuestionsWithFallback` (batch principal + **loop por-tópico**), cada llamada = `getRandomQuestions(filters, count × 2)` → **overfetch ×2** + N queries por-tópico.
- Total por examen (cache-miss, que es el caso **normal** porque es one-time): **~100-200 lecturas**.
- La caché `sessionStorage` actual **no ayuda** al caso one-time (cada alumno/sesión lee de cero).
- **En ráfaga** (simulacro de 1.000 alumnos a la vez): ~150.000 lecturas en minutos → pico de latencia + costo.

---

## Arquitectura recomendada: **pool consolidado + ensamblado en servidor**

### Pieza 1 — Pool consolidado por (grado, materia)
Un doc `superate/auth/questionPools/{grado}_{materiaCode}` con las preguntas de esa materia/grado.
- Mantenido por **trigger** `onQuestionWrite` → reconstruye el pool de esa materia (igual patrón que tus `consolidado_*` existentes). Las preguntas las crea el **admin** (baja frecuencia) → rebuilds raros y baratos.
- **Regla de seguridad del pool: `allow read: if false`** → solo Cloud Functions (Admin SDK) lo leen. El cliente **nunca** lo lee directo.

### Pieza 2 — Cloud Function `getExam(grade, subject, phase, studentId)`
- Lee el pool → **1 lectura Firestore**.
- Aplica en servidor la lógica que hoy hace el cliente: muestreo random + distribución por-tópico + exclusión de preguntas ya vistas.
- Devuelve al cliente **solo el examen muestreado**.
- **1 lectura por examen**, sin importar el tamaño → de ~150 → **1**.

### Por qué servidor y no cliente directo (decisión senior)
Si el cliente leyera el pool directo (1 lectura), también sería barato — **pero expondría TODO el banco + respuestas en una sola lectura** (un alumno podría scrapear el banco entero de su grado/materia). Eso es una **regresión de seguridad**. Ensamblar en servidor mantiene el pool server-only y devuelve solo la muestra. **Costo del Function: 1 invocación + 1 lectura + cómputo mínimo = centavos.** Vale la pena por seguridad + control.

> **Nota:** si hoy la calificación es client-side (el cliente ya recibe las respuestas correctas), esta función es la oportunidad de **calificar en servidor** (no mandar `isCorrect` al cliente) — cierra un hueco de trampa que probablemente ya existe. Opcional, pero recomendado.

---

## Resultados (tu punto sobre "cachear después de presentar")

**No hace falta localStorage.** El `result` ya guarda `questionDetails` (preguntas + respuestas del alumno) al enviar → la vista de resultados lee **1 doc** (el result), self-contained. Guardarlo en localStorage sería redundante. Donde tiene que vivir ya vive: en el result.

*(Único uso legítimo de localStorage aquí: persistir el examen EN CURSO para sobrevivir un refresh a mitad de examen — resiliencia, no ahorro de lecturas. Opcional, menor.)*

---

## Trade-offs (honesto)

| | Beneficio | Costo |
|---|---|---|
| Pool consolidado | Exam load ~150 → 1 lectura; ráfaga de simulacro cae ~150× | 1 trigger + storage del pool (pequeño) |
| Ensamblado en servidor | Seguro (no scrapear banco), calificación server-side opcional | 1 Function call/examen (centavos) |
| Límite 1 MiB del pool | — | Materia con >~500 preguntas → particionar por nivel/tópico. **Medir primero** el tamaño real del banco por materia |

---

## Orden de ejecución sugerido

1. **Medir** — script read-only: cuántas preguntas por (grado, materia), tamaño estimado del pool. Confirma viabilidad del 1 MiB y si hay que particionar.
2. **Pool + trigger** — crear `questionPools/*` + `onQuestionWrite` que reconstruye. Backfill inicial (script).
3. **Function `getExam`** — mueve el muestreo/distribución/exclusión al servidor, lee el pool, devuelve la muestra. (Opcional: calificación server-side.)
4. **Cliente** — reemplazar `fetchQuestionsWithFallback`/`getRandomQuestions` por la llamada a `getExam`. Mantener la caché de examen-en-curso (sessionStorage) para el refresh.
5. **Validar** — telemetría: lecturas por examen deben caer a ~1; probar un simulacro concurrente.

---

## Veredicto senior

El ahorro real está exactamente donde dijiste: **en la llamada única del examen.** El pool consolidado + ensamblado en servidor lleva esa llamada de **~150 lecturas a 1**, y de paso **cierra el pico de ráfaga** de los simulacros (lo que realmente golpeaba a escala) y **puede cerrar un hueco de trampa** (calificación server-side). No es por plata por-estudiante (Firestore es barato) — es por **ráfaga, latencia, headroom a 50k y seguridad**. Ese es el trabajo que vale la pena.
