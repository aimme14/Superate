# Plan de Escalabilidad y Optimización — Superate

**Auditor:** Arquitectura senior (Vite/React + Firebase + Vercel)
**Fecha:** 2026-07-13
**Objetivo de escala:** de ~70 cuentas activas → 5.000 con holgura → 10.000 sin reescritura.
**Regla de oro de este documento:** nada se toca todavía. Esto es el mapa quirúrgico. La ejecución va después, por fases, con rollback definido.

---

## 0. Veredicto ejecutivo (léelo primero)

**No necesitas migrar de base de datos, ni cambiar de nube, ni añadir servidores.** Firestore + Cloud Functions + Vercel escalan a 10.000 usuarios sin despeinarse **si** se corrige el *patrón de acceso*, no la infraestructura. El problema no es la tecnología: es que hoy el **cliente hace demasiadas lecturas en cascada** y hay **endpoints de IA sin candado**. Migrar a Postgres/otra nube sería gastar 3 meses resolviendo un problema que no tienes y creando cinco que sí tendrías.

Lo que realmente decide si escalas o revientas la factura son **cinco cosas**, en este orden:

1. **[CRÍTICO — SEGURIDAD/COSTO] Endpoints de IA sin autenticación + CORS `*`.** Hoy cualquiera en internet puede llamar a `/generateJustification`, `/generateStudyPlan`, `/generateWebLinks` y quemar tu presupuesto de Gemini/OpenAI. Esto no aparecía en tu auditoría y es el riesgo #1. A 70 usuarios nadie lo ha encontrado; a 10.000 (más visibilidad pública) es cuestión de tiempo.
2. **[CRÍTICO — COSTO] Ranking N+1 en el cliente** (`studentRanking.service.ts`). Escala lineal con el tamaño del grado y multiplica por hasta 4 (variantes de nombre de fase). Es tu bomba de lecturas Firestore.
3. **[CRÍTICO — DISPONIBILIDAD] Contador único de códigos de pregunta** (`question.service.ts`). Documento caliente con límite físico de ~1 escritura/seg. Es el "se queda pensando" al crear preguntas. No se arregla con más reintentos; se arregla con sharding o IDs sin contador.
4. **[ALTO — COSTO OCULTO] Reglas de Firestore con muchos `get()`/`exists()`.** Cada lectura de un estudiante dispara hasta 6 lecturas de documentos *facturadas* solo para autorizar. Multiplicas tu factura por un factor invisible en cada acceso.
5. **[ALTO — VISIBILIDAD] Cero observabilidad de errores en producción.** Si algo se rompe a escala, te enteras por un WhatsApp de un rector, no por una alerta.

Si solo tienes tiempo para atacar tres cosas antes de escalar: **#1, #2 y #3**. Con eso pasas de 70 a 5.000 sin drama.

---

## 1. Cómo leer cada hallazgo

Cada uno trae:
1. **Qué y dónde** — archivo/módulo exacto.
2. **Impacto real** — costo, lentitud o caída, cuantificado cuando se puede.
3. **Solución concreta** — código/config, no teoría.
4. **Prioridad** — Crítico / Alto / Medio / Mejora incremental.

Prioridades: **Crítico** = bloquea escalar o es riesgo de caída/factura. **Alto** = duele a escala. **Medio** = deuda que conviene pagar. **Mejora** = pulido.

---

## 2. ESCALABILIDAD — qué se rompe primero al multiplicar el tráfico x10

### C-1 · Endpoints de IA sin autenticación + CORS abierto `*` `[CRÍTICO]`

**Qué y dónde.** `functions/src/http/superateHttpApp.ts`. Las rutas de generación con IA no tienen middleware de auth. Solo las de `studentSummary*` lo tienen (`...studentSummaryAuth`):

```
app.post('/generateJustification', ...)      // sin auth
app.post('/processBatch', ...)               // sin auth
app.post('/regenerateJustification', ...)    // sin auth
app.post('/generateStudyPlan', ...)          // sin auth
app.post('/generateWebLinks', ...)           // sin auth
app.post('/studentSummary', ...studentSummaryAuth, ...)   // SÍ auth
```

Y encima, CORS totalmente abierto en todas:

```js
res.set('Access-Control-Allow-Origin', '*');
```

**Impacto real.** Cualquier persona con la URL (`https://<region>-<project>.cloudfunctions.net/superateHttp/generateStudyPlan`) puede hacer POST y disparar llamadas a Gemini/OpenAI a tu cuenta. Cada `generateStudyPlan` es una llamada larga (timeout de hasta 540s) y cara. Un script sencillo puede convertir tu meta de "~$10–20/mes" en una factura de tres o cuatro cifras en una noche, además de saturar tus instancias de Functions (denegación de servicio por agotamiento de cuota). A 70 usuarios y URL semi-oculta, nadie lo ha explotado. A 10.000 usuarios, con la app más expuesta y la URL viajando en el bundle del cliente, es el primer sitio por donde te van a sangrar. **Este es el hallazgo #1 y no estaba en tu auditoría.**

**Solución concreta.** Dos capas.

1. **Verificar App Check + ID token en TODAS las rutas que cuesten dinero.** Reutiliza el patrón que ya tienes en `studentSummaryAuth.middleware.ts` y aplícalo a las rutas de IA:

```ts
// superateHttpApp.ts — aplicar el middleware existente a las rutas caras
app.post('/generateJustification', ...requireAuth, handleGenerateJustification);
app.post('/generateStudyPlan',    ...requireAuth, handleGenerateStudyPlan);
app.post('/generateWebLinks',     ...requireAuth, handleGenerateWebLinks);
app.post('/processBatch',         ...requireAdmin, handleProcessBatch); // solo admin/profesor
```

Donde `requireAuth` valida el `Authorization: Bearer <idToken>` con `admin.auth().verifyIdToken(...)` y rechaza si no hay claims válidos (ya lo haces en el summary; solo hay que reusarlo).

2. **Cerrar CORS a tus dominios reales** en vez de `*`:

```js
const ALLOWED = new Set([
  'https://superate.vercel.app',
  'https://<tu-dominio-de-produccion>',
  // dev:
  'http://localhost:5173',
]);
const origin = req.headers.origin;
if (origin && ALLOWED.has(origin)) {
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
}
```

3. **Activá Firebase App Check** (reCAPTCHA v3 en web) para que solo tu app pueda invocar las Functions. Es la defensa más barata contra bots.

4. **Rate limiting por usuario** en las rutas de IA (ver C-5). Un rector no genera 500 planes de estudio en 10 minutos; un abusador sí.

**Esfuerzo:** medio. **Riesgo de no hacerlo:** factura descontrolada + posible baneo de la API de IA + caída por agotamiento de cuota.

---

### C-2 · Ranking del estudiante: N+1 en el navegador `[CRÍTICO]`

> **Estado (actualización):** el servicio quedó **desconectado** (sin consumidores) y luego **borrado** (ver `PLAN_EJECUCION_C1.md`, Fase 2 / C2). El costo de Firestore de este N+1 **ya está mitigado** porque no se ejecuta en producción. **Ojo:** C-2 tal como está escrito abajo (materializar `rankings/*`, N×4 → 1 doc) NO está hecho ni es necesario hoy — es un **ticket de producto futuro** que solo aplica si se decide volver a mostrar el puesto al alumno. Si eso pasa, se implementa lectura de **1 doc materializado o summaries en memoria** (estilo `fetchTeacherRanking`), **nunca** reactivando el service borrado. No confundir "borrado (hecho)" con "materialización (pendiente de producto, sin consumidor)".

**Qué y dónde.** `src/services/ranking/studentRanking.service.ts`, función `fetchStudentRanking` (líneas ~155-240) y `getPhaseEvaluationsForRanking` (líneas ~68-95).

El flujo para *un solo estudiante* que quiere ver su puesto:

```
fetchStudentRanking(userId, phase)
  → getUserById(userId)                         // 1 lectura
  → getFilteredStudents({inst, campus, grade})  // N lecturas (todos los compañeros)
  → studentIds.map(async id =>
        getPhaseEvaluationsForRanking(id, phase) // ← N × (hasta 4 getDocs)
    )
```

`getPhaseEvaluationsForRanking` prueba **hasta 4 nombres de fase** (`"fase I"`, `"Fase I"`, `"fase 1"`, `"first"`) haciendo un `getDocs` por variante hasta encontrar datos. Cada `getDocs` de la subcolección factura *una lectura por documento devuelto*.

**Impacto real.** Para un grado de 300 estudiantes, un único alumno viendo su ranking dispara del orden de **300 × (1 a 4) `getDocs` = 300–1.200 operaciones de colección**, cada una devolviendo varios documentos de examen. Y esto corre **en el cliente, cada vez que se abre la vista**, sin caché entre alumnos. Si 300 alumnos del mismo grado abren su ranking el mismo día, estás recalculando el mismo ranking 300 veces desde cero: **decenas de miles de lecturas para un dato que es idéntico para todos**. Esto es, casi con seguridad, la causa principal de tus picos de factura y del histórico `resource-exhausted`. Escala **cuadráticamente** con el tamaño del grado por el día.

**Solución concreta.** El ranking es un dato compartido por grado+fase; hay que **precalcularlo una vez en backend** y que el cliente lo lea en **1 documento**. Ya tienes la infraestructura: `gradeSummary.service.ts` y `studentProgressSummary`.

1. **Materializar el ranking en el trigger que ya recalcula summaries.** Cuando se escribe un resultado (`onExamResultWrite...`), recalcula y guarda un doc `rankings/{institutionId}_{gradeId}_{phase}_{academicYear}`:

```ts
// functions: al recalcular gradeSummary, ordena y persiste el ranking
type RankRow = { studentId: string; globalScore: number; rank: number };
const rows: RankRow[] = studentsWithScores
  .sort((a, b) => b.globalScore - a.globalScore)
  .map((s, i) => ({ studentId: s.id, globalScore: s.globalScore, rank: i + 1 }));

await db.doc(`rankings/${institutionId}_${gradeId}_${phase}_${year}`)
        .set({ rows, totalInGrade: rows.length, updatedAt: FieldValue.serverTimestamp() });
```

2. **El cliente lee 1 documento** en lugar de N×4:

```ts
export async function fetchStudentRanking({ userId, phase }): Promise<StudentRankingResult> {
  const { institutionId, gradeId, academicYear } = await getStudentContext(userId);
  const snap = await getDoc(doc(db, 'rankings', `${institutionId}_${gradeId}_${phase}_${academicYear}`));
  if (!snap.exists()) return { rank: null, totalInPhase: 0, totalInGrade: 0 };
  const { rows, totalInGrade } = snap.data();
  const me = rows.find(r => r.studentId === userId);
  return { rank: me?.rank ?? null, totalInPhase: rows.length, totalInGrade };
}
```

De **300–1.200 lecturas por vista → 1 lectura**. Con caché de TanStack Query, 0 durante minutos.

3. **Elimina la búsqueda por variantes de nombre de fase.** El hecho de probar 4 nombres es deuda de datos legacy. Corre **una migración única** (`scripts/`) que normalice `results/{studentId}/{phase}` a los nombres canónicos y borra el bucle `for (const phaseName of PHASE_NAMES[phase])`. Cada variante extra es 4× más lecturas de por vida.

**Esfuerzo:** medio (ya existe el trigger; se le añade la materialización). **Ganancia:** el mayor recorte de factura de todo el plan.

---

### C-3 · Contador único de código de pregunta = documento caliente `[CRÍTICO]`

**Qué y dónde.** `src/services/firebase/question.service.ts`, `generateQuestionCode` (líneas ~420-470). Un único documento por combinación:

```ts
const counterRef = doc(db, 'superate', 'auth', 'counters', counterKey);
await runTransaction(db, async (t) => {
  const c = await t.get(counterRef);
  const n = (c.data()?.count || 0) + 1;
  t.set(counterRef, { count: n }, { merge: true });
});
// con executeTransactionWithRetry(fn, 5, 2000) → 5 reintentos, backoff 2s
```

**Impacto real.** Firestore permite **~1 escritura por segundo sostenida sobre un mismo documento**. Cuando varios profesores crean preguntas del mismo `subject+topic+grade+level` a la vez, todas compiten por el *mismo* `counterKey`. La transacción falla por contención, reintenta con backoff de 2s… hasta 5 veces = hasta **10 segundos colgado** antes de rendirse. Eso es exactamente el "se queda pensando" y los timeouts de ~30s (sumado a la subida a Storage). Los reintentos **no resuelven** el problema, solo lo maquillan; a mayor concurrencia, peor. No escala.

**Solución concreta.** Quitar el contador global del camino crítico. Tres opciones, de menor a mayor esfuerzo:

- **Opción A (recomendada, mínimo cambio): ID autogenerado, sin contador.** El código legible no necesita ser un consecutivo perfecto. Usa `doc(collection(...))` (ID aleatorio de Firestore, sin contención) y, si necesitas un código humano, deriva uno de timestamp + sufijo aleatorio corto:

```ts
const questionRef = doc(collection(db, 'superate', 'auth', 'questions'));
const code = `${counterKey}${Date.now().toString(36).slice(-4).toUpperCase()}`;
```
Cero transacciones, cero contención, latencia constante.

- **Opción B: contador distribuido (sharding).** Ya conoces el patrón — de hecho `firestore.indexes.json` tiene un `fieldOverride` sobre `ejercicios.shard`. Aplica lo mismo al contador: N shards (`counters/{key}/shards/{0..9}`), incrementas uno al azar, y el valor real es la suma. Aumenta el throughput a ~N escrituras/seg. Más complejo si de verdad necesitas el consecutivo exacto.

- **Opción C: mover la generación a una Cloud Function callable** con el contador, para al menos centralizar y quitar la lógica del cliente — pero **no** resuelve la contención por sí sola; combínala con A o B.

**Recomendación:** Opción A. Es la que elimina el problema de raíz y de paso saca lógica de negocio del navegador.

**Esfuerzo:** bajo (Opción A). **Riesgo de no hacerlo:** timeouts persistentes y peor a medida que crece el equipo de profesores.

---

### A-1 · Reglas de Firestore con `get()`/`exists()` en cascada = costo invisible `[ALTO]`

**Qué y dónde.** `firestore.rules`. Las funciones de autorización hacen múltiples lecturas de documentos por evaluación. Ejemplo del helper de pertenencia a institución (líneas ~68-82):

```
let lookup = get(.../userLookup/$(request.auth.uid)).data;   // 1 lectura
... exists(.../rectores/$(uid)) && get(.../rectores/$(uid))  // +2
||  exists(.../profesores/$(uid)) && get(.../profesores/$(uid)) // +2
||  exists(.../estudiantes/$(uid)) && get(.../estudiantes/$(uid)) // +2
```

**Impacto real.** Cada `get()` y `exists()` dentro de una regla **cuenta como una lectura de documento facturada**, además de sumar latencia. Un solo acceso de un estudiante puede disparar hasta ~6 lecturas de reglas *antes* de leer el dato que quería. A escala x10, esto multiplica tanto la factura como el p95 de latencia de forma que no ves en tu código de aplicación (está "escondido" en las reglas). Firestore cachea algunos `get()` repetidos dentro de la misma evaluación, pero el patrón sigue siendo caro.

**Solución concreta.** Mueve la autorización a **custom claims del token**, que son gratis y no leen documentos. Ya tienes `setUserClaims` como blocking function (`firebase.json` → `beforeSignIn`). Aprovéchalo:

1. En `setUserClaims`, escribe en el token `role`, `institutionId`, `isActive`:
```ts
await admin.auth().setCustomUserClaims(uid, { role, institutionId, isActive: true });
```
2. En las reglas, lee del token en vez de la base de datos:
```
function isActiveMember(instId) {
  return request.auth.token.isActive == true
      && request.auth.token.institutionId == instId;
}
allow read: if isActiveMember(institutionId);   // 0 lecturas de documentos
```
Esto convierte ~6 lecturas por acceso en **0**. Cuidado: los claims se refrescan al renovar el token (hasta 1h), así que para revocación inmediata (baja de un usuario) mantén el chequeo de `isActive` en un doc *solo* en las operaciones sensibles, no en toda lectura.

**Esfuerzo:** medio. **Ganancia:** recorte directo de factura y latencia en *cada* operación autenticada.

---

### A-2 · Rate limiting y protección de endpoints — hoy inexistente `[ALTO]`

**Confirmado en auditoría:** no hay rate limiting en ninguna parte. Las Functions HTTP (`superateHttpApp.ts`) aceptan cualquier volumen de peticiones. Combinado con C-1 (sin auth), es el vector de abuso más directo.

**Impacto real.** Sin límites: un usuario (o bot) puede saturar las instancias de Functions (contención, cold starts en cadena, cuota de Gemini agotada) y tumbar el servicio para todos. A 70 usuarios no pasa; a 10.000 con actores impredecibles, sí.

**Solución concreta.**
1. **`maxInstances` en las Functions caras** para poner un techo de gasto (hoy no hay límite → factura sin tope):
```ts
export const superateHttp = onRequest(
  { region: REGION, memory: '512MiB', timeoutSeconds: 540, maxInstances: 10 },
  app
);
```
2. **Rate limit por usuario** en las rutas de IA. Simple y efectivo con un doc de Firestore por usuario+ventana, o con un contador en memoria por instancia para ráfagas:
```ts
// pseudocódigo middleware
const key = `ratelimit/${uid}/${Math.floor(Date.now()/60000)}`; // ventana 1 min
const n = await bumpAndGet(key);           // incrementa TTL corto
if (n > MAX_PER_MINUTE) return res.status(429).json({ error: 'Demasiadas solicitudes' });
```
3. **Firebase App Check** (ya mencionado en C-1) como primera barrera contra tráfico no-app.

**Esfuerzo:** medio.

---

### A-3 · Índices compuestos: bien para `questions/links/videos`, huecos en flujos de listado `[MEDIO]`

**Qué y dónde.** `firestore.indexes.json`. Están bien cubiertos los índices de `questions` (grade/subjectCode/rand), `links` y `videos` (grado/materia/topic/createdAt), y `studentSummaries` (gradeId, academicYear). Los `COLLECTION_GROUP` sobre `uid` para roles están.

**Hallazgos.**
- **Bien:** la estrategia de `rand` para muestreo aleatorio de preguntas es correcta y evita escaneos.
- **Hueco:** cuando materialices `rankings` (C-2) y listados por institución/rol/año, verifica que cada `where(...).orderBy(...)` tenga su compuesto; si no, Firestore lanzará error con el link para crearlo — no lo ignores, créalo (el error es barato, el escaneo completo no).
- **Riesgo:** `getAllUsers`/listados por rol iteran roles×instituciones en bucle (`db.service.ts`). A escala, prefiere una query única con `COLLECTION_GROUP` + índice sobre `estudiantes`/`profesores` (ya tienes el índice de `uid`; añade los campos por los que filtras: `institutionId`, `gradeId`, `isActive`).

**Solución concreta.** Antes de escalar, corre los flujos críticos con la **consola de Firestore en modo debug** o revisa logs de "missing index" en Functions, y añade lo que falte. Es trabajo de 1-2 horas que evita escaneos O(n) en producción.

**Esfuerzo:** bajo.

---

### Límites de Firestore que podrías golpear (referencia)

| Límite | Valor | ¿Te afecta? |
|---|---|---|
| Escrituras sostenidas por documento | ~1/seg | **SÍ** — contador de preguntas (C-3). También cualquier "documento consolidado" muy escrito. |
| Escrituras por segundo por colección | Sin límite duro (autoescala ~500/s y sube) | Bajo riesgo con 10k usuarios si distribuyes IDs. |
| Tamaño máximo de documento | 1 MiB | **Vigilar** los `consolidado_*` y el nuevo `rankings/*`: 5.000 estudiantes en un solo doc de ranking puede acercarse. Particiona por grado (ya lo hace la clave) — un grado nunca son 5.000, así que OK. |
| Lecturas por query | Sin límite, pero facturas por doc | **SÍ** — ranking N+1 (C-2), listados. |
| Profundidad de transacción / contención | Reintentos | **SÍ** — C-3. |

**Documentos calientes a vigilar al crecer:** el contador de preguntas (C-3, crítico), y cualquier `consolidado_*` que se reescriba entero en cada cambio. Si un consolidado se actualiza con mucha frecuencia desde varias fuentes, aplícale la misma lógica: escribe deltas o particiona.

---

## 3. ARQUITECTURA — refinando tu propia auditoría

Tu Auditoría 1 es sólida y la comparto casi entera. Añado matices y accionables.

### A-4 · `db.service.ts` (god object, ~3.144 líneas) `[MEDIO]`

**Confirmado:** 3.144 líneas mezclando usuarios, instituciones, profesores, lookups, estudiantes filtrados. Rompe SRP, imposible de testear por unidad, y el `getFilteredStudents` interno (líneas ~153+) aplica filtros **en memoria** tras traer todos los estudiantes de la institución — a 5.000 alumnos por institución grande, eso es traer y filtrar miles de docs en el cliente.

**Impacto real.** No es un problema de *runtime* inmediato (excepto el filtrado en memoria), sino de **velocidad de cambio y riesgo de regresión**: cada arreglo toca un archivo de 3k líneas sin red de tests. A escala de equipo, es donde nacen los bugs.

**Solución concreta.**
1. **Empuja el filtrado al query, no a la memoria.** En vez de traer todos y filtrar con `if (matches)`, construye la query con `where('gradeId','==',...).where('isActive','==',true)` y deja que Firestore filtre (requiere los índices de A-3). Recorta lecturas y memoria.
2. **Divide por dominio** sin reescribir todo de golpe: extrae `user.repo.ts`, `institution.repo.ts`, `student.repo.ts` reexportando desde `db.service.ts` para no romper imports. Refactor incremental, PRs pequeños.
3. **Mueve creación de usuarios vía Auth cliente → Cloud Function.** Crear usuarios con el SDK de Auth en el navegador es frágil y expone lógica; una callable `createUser` con `firebase-admin` es más segura y testeable.

**Esfuerzo:** alto (pero incremental y no urgente para escalar).

---

### A-5 · Monolito HTTP `superateHttp` (512 MiB, 540s) `[MEDIO]`

**Confirmado.** Un solo Express (`superateHttpApp.ts`) sirve `/health`, `/getVocabularyWords`, `/getTipsICFES` (ligeras) junto a `/generateStudyPlan`, `/generateJustification` (IA, pesadas). `functions/src/index.ts` lo despliega con 512 MiB y timeout largo.

**Impacto real.** Un hit frío a `/health` paga el cold start del **bundle completo**, incluyendo SDKs de OpenAI/Gemini que esa ruta no usa → arranques más lentos y peor experiencia. Además, *blast radius*: un bug en una ruta puede tumbar el deploy de todas.

**Solución concreta.** Divide en dos funciones por perfil de carga:
```ts
// Ligeras: health, vocabulario, tips, getStudyPlan (lectura), getStudentSummary
export const superateHttpLight = onRequest(
  { region: REGION, memory: '256MiB', timeoutSeconds: 30, minInstances: 1 }, lightApp);

// Pesadas IA: generateJustification, generateStudyPlan, generateWebLinks, processBatch
export const superateHttpAI = onRequest(
  { region: REGION, memory: '512MiB', timeoutSeconds: 540, maxInstances: 10 }, aiApp);
```
- `minInstances: 1` **solo** en la ligera (health/lecturas calientes) elimina cold starts donde importa, a costo bajo (una instancia templada 24/7 de 256 MiB es barata).
- No pongas `minInstances` en la de IA: es cara y su latencia ya está dominada por el modelo, no por el cold start.

**Esfuerzo:** medio. Es "valorar el split" que tú mismo dejaste pendiente; la recomendación es hacerlo.

---

### A-6 · Timeouts de IA — están bien, no los toques `[N/A / OK]`

Coincido con tu veredicto: 540s/300s están **alineados con Gemini**, no mal configurados. El único problema era que rutas ligeras compartían la instancia pesada — eso lo resuelve el split A-5, no cambiar los timeouts. Déjalos.

---

### A-7 · Observabilidad de errores en producción — el punto ciego `[ALTO]`

**Confirmado:** hay disciplina de errores en código (patrón `Result`, `ErrorAPI`, `installProductionErrorHandler`, `ErrorBoundary`) pero **cero telemetría centralizada**. En `studentRanking.service.ts` los errores de lectura se tragan en silencio (`catch { /* silently ignore */ }`) — a escala, fallos invisibles.

**Impacto real.** Cuando algo se rompa con 5.000 usuarios, no tendrás forma de saber qué, para quién, ni con qué frecuencia. Debug a ciegas. El `catch` vacío del ranking, por ejemplo, podría estar ocultando ahora mismo lecturas fallidas que distorsionan puestos sin que nadie lo note.

**Solución concreta.**
1. **Sentry** (plan free/Team alcanza para esta escala) en frontend y en Functions. 30 min de setup:
```ts
// main.tsx
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1,
  environment: import.meta.env.MODE });
```
Conecta el `ErrorBoundary` existente a `Sentry.captureException` en lugar de solo loguear local.
2. **Reemplaza los `catch` vacíos** (empezando por ranking) por `logger.error` + `Sentry.captureException`. Nunca tragues un error de lectura en silencio.
3. **Alertas de presupuesto en GCP/Firebase** (Budget Alerts) a tu correo: umbral en, p. ej., $30 y $60/mes. Es tu red de seguridad contra C-1/C-2 mientras se corrigen.

**Esfuerzo:** bajo (Sentry) + bajo (budget alerts). Alta relación valor/esfuerzo.

---

### A-8 · Lógica de negocio pesada en el navegador `[MEDIO]`

**Confirmado:** quiz generator, cálculo de ranking, creación de usuarios vía Auth cliente. `quizGenerator.service.ts` (1.416 líneas) hace muchas queries por tópico/grado al arrancar un examen.

**Impacto real.** Lecturas masivas del banco en el arranque de cada quiz (coste + latencia percibida), y lógica sensible expuesta en el bundle. A 10.000 usuarios haciendo simulacros, el arranque de examen es un pico de lecturas concurrente.

**Solución concreta.**
1. **Cachea el banco de preguntas por (grado, materia, tópico)** con TanStack Query con `staleTime` alto (el banco cambia poco). Ya usas Query persist — súbele el `staleTime` de estos queries a horas.
2. **Considera pre-generar "sets de examen" en backend** (una Function que arma el set y lo cachea en un doc), para que el cliente lea 1 doc en vez de correr N queries de muestreo. Es la misma filosofía que C-2.
3. Migra la creación de usuarios a callable (ver A-4.3).

**Esfuerzo:** medio.

---

## 4. DISEÑO / UX TÉCNICO

Tienes `lighthouse-*.json` en el repo (buena señal de que mides). Puntos a cerrar antes de escalar:

### U-1 · Estados de carga y errores visibles `[MEDIO]`
- **Bien:** hay `ErrorBoundary` y recuperación de chunk load.
- **Falta:** verifica que cada vista que dispara lecturas (dashboards, ranking, quizzes) tenga **skeletons**, no spinners genéricos ni pantallas en blanco. Con más usuarios y latencia variable, el "parece colgado" mata la percepción. TanStack Query da `isLoading`/`isFetching` — úsalos para skeletons por sección.
- **Falta:** errores de lectura visibles al usuario con opción de reintento, no `catch` silenciosos (A-7). Un toast "No pudimos cargar tu ranking — reintentar" es mejor que un cero silencioso.

### U-2 · Responsive real `[MEDIO]`
- El público objetivo (estudiantes de colegio en Colombia) es **mayoritariamente móvil y de gama media/baja**. No basta "se ve bien en mi pantalla".
- **Acción:** prueba en viewport 360×640 (móvil económico) las vistas pesadas: `QuestionBank.tsx` (9.997 líneas — casi seguro pensada para escritorio), `promedio.tsx`, dashboards. Usa las DevTools con throttling 4G/CPU 4x.
- La virtualización ya está disponible (`@tanstack/react-virtual`) — asegúrate de que las listas largas (banco, estudiantes) la usen; sin ella, 5.000 filas en el DOM congelan un móvil.

### U-3 · Accesibilidad básica `[MEJORA]`
- Radix ya aporta accesibilidad en componentes (foco, ARIA). Aprovéchalo y no lo rompas con divs clicables.
- Mínimos para público estudiantil: contraste AA, navegación por teclado en el quiz, `alt` en imágenes de preguntas, tamaño de toque ≥44px en móvil. Corre el audit de accesibilidad de Lighthouse (ya lo tienes) y cierra lo rojo.

### U-4 · Peso del bundle `[MEDIO]`
- **Confirmado parcial:** ya hay `manualChunks`, lazy routes, Query persist, `chunkSizeWarningLimit: 600`. Bien encaminado.
- **Riesgo:** el stack de UI es **doble** — MUI (`@mui/material`, `@mui/icons-material`, `material-react-table`, `x-date-pickers`) **y** Radix + Tailwind, más `echarts`, `framer-motion`, `mathlive`, `quill`, `katex`. Eso es mucho JS para un móvil de gama baja.
- **Acción:** corre `npx vite-bundle-visualizer`. Objetivo: converger a **un solo sistema de UI** a mediano plazo (elegir MUI *o* Radix, no ambos) y cargar `echarts`/`mathlive`/`quill` solo en las rutas que los usan (lazy). Es el mayor recorte de bundle disponible.

---

## 5. ¿Más servidores? ¿Migrar de nube? ¿Otra base de datos?

Respuesta directa a tu pregunta, sin ambigüedad:

**Servidores adicionales: NO.** Cloud Functions es serverless y autoescala. Tu problema no es falta de cómputo; es exceso de lecturas y falta de candados. Lo que sí harás es *acotar* con `maxInstances` (techo de gasto) y *templar* con `minInstances: 1` en la ruta ligera. Cero servidores que administrar.

**Migrar de nube (a AWS/otro): NO.** No hay ninguna razón técnica. Vercel para el SPA estático es óptimo y barato; Firebase te da Auth + DB + Functions + Storage integrados con reglas de seguridad. Migrar significaría reconstruir Auth, reglas, triggers y storage por cero beneficio a esta escala. Sería el error más caro que podrías cometer ahora.

**Migrar de base de datos (a Postgres/Supabase/Mongo): NO — con matiz.** Firestore es correcto para tu caso (multi-tenant por institución, lecturas por clave, escala elástica, tiempo real). Tus dolores (factura, `resource-exhausted`, contención) **no son límites de Firestore; son patrones de acceso mal diseñados** — se resuelven con materialización (C-2), sharding/IDs (C-3) y reglas por claims (A-1). *Matiz:* si en el futuro necesitas **analítica compleja** (rankings cruzados, reportes ad-hoc, agregaciones históricas por muchas dimensiones), Firestore es malo para eso — pero la solución no es migrar, es **exportar a BigQuery** (extensión oficial Firebase→BigQuery) y hacer la analítica ahí, dejando Firestore como base operacional. Ese es el patrón correcto: Firestore para operar, BigQuery para analizar.

**Región (`us-central1`): OK por ahora.** Añade ~80-120ms de latencia a Colombia. No es bloqueante y cambiar de región implica migrar datos. Déjalo salvo que midas que la latencia molesta; si algún día importa, evalúa `southamerica-east1` (São Paulo).

**Resumen de infraestructura:** te quedas exactamente donde estás. Vercel + Firebase (Firestore/Auth/Functions/Storage) llega cómodo a 10.000 usuarios. La palanca es **disciplina de lecturas + seguridad de endpoints**, no infraestructura nueva. Cuando llegues a analítica pesada, sumas BigQuery *al lado*, no en reemplazo.

---

## 6. Mejores técnicas de desarrollo a implementar (aplicadas a lo encontrado)

No es una lista genérica; cada una ataca un hallazgo concreto:

- **CQRS ligero / vistas materializadas** (ataca C-2, A-8): separa *escritura canónica* (`results/`) de *lectura optimizada* (`rankings/`, `summaries/`). El cliente **solo lee documentos precalculados**; los triggers los mantienen. Es la técnica central de este plan.
- **Backend-for-Frontend / callables como frontera** (ataca A-4, A-8, C-3): toda escritura sensible y todo cálculo pesado pasa por Functions. El cliente lee directo (rápido) pero **no escribe lógica de negocio**. Frontera clara: "solo backend escribe agregados; el cliente lee".
- **Autorización por claims, no por lecturas** (ataca A-1): el token lleva `role`/`institutionId`/`isActive`; las reglas no leen documentos.
- **Idempotencia + IDs sin contención** (ataca C-3): IDs autogenerados o sharded; nada de contadores globales en el camino crítico.
- **Rate limiting + App Check + CORS estricto + budget alerts** (ataca C-1, A-2): defensa en profundidad para el gasto de IA.
- **Caché por capas** (ataca A-8, C-2): TanStack Query con `staleTime` alto para datos que cambian poco (banco de preguntas, tips, ranking), + persistencia (ya la tienes).
- **Observabilidad primero** (ataca A-7): Sentry + budget alerts *antes* de escalar, no después del incidente.
- **Refactor incremental con tests de caracterización** (ataca A-4): antes de partir `db.service.ts`, escribe tests que fijen el comportamiento actual; luego divide con red de seguridad. Nada de reescrituras de big-bang.
- **Feature flags + despliegue por fases** (transversal): cada cambio de este plan detrás de un flag, activado primero para una institución piloto, con rollback de un clic.

---

## 7. Tabla resumen — ordenada por prioridad

| # | Hallazgo | Dónde | Impacto si no se corrige | Prioridad | Esfuerzo |
|---|---|---|---|---|---|
| C-1 | Endpoints IA sin auth + CORS `*` | `functions/src/http/superateHttpApp.ts` | Factura de IA descontrolada, DoS por cuota, baneo de API | **Crítico** | Medio |
| C-2 | Ranking N+1 en el cliente (×4 variantes de fase) | `src/services/ranking/studentRanking.service.ts` | Decenas de miles de lecturas/día, `resource-exhausted`, factura alta | **Crítico** | Medio |
| C-3 | Contador único de código de pregunta (doc caliente) | `src/services/firebase/question.service.ts` | Timeouts al crear preguntas; empeora con más profesores | **Crítico** | Bajo (Opción A) |
| A-1 | Reglas con `get()`/`exists()` en cascada | `firestore.rules` | Costo y latencia invisibles ×N en cada acceso | **Alto** | Medio |
| A-2 | Sin rate limiting ni `maxInstances` | `functions/src/index.ts`, `superateHttpApp.ts` | Saturación, gasto sin techo | **Alto** | Medio |
| A-7 | Sin observabilidad de errores en prod | frontend + functions | Debug a ciegas a escala; errores silenciosos | **Alto** | Bajo |
| A-3 | Huecos de índices en listados/ranking | `firestore.indexes.json` | Escaneos O(n), errores de query en prod | **Medio** | Bajo |
| A-5 | Monolito HTTP (cold start pesado) | `functions/src/index.ts` | Cold starts lentos, blast radius amplio | **Medio** | Medio |
| A-4 | `db.service.ts` god object + filtrado en memoria | `src/services/firebase/db.service.ts` | Lecturas/memoria excesivas; riesgo de regresión | **Medio** | Alto |
| A-8 | Lógica pesada en el navegador (quiz gen) | `src/services/quiz/quizGenerator.service.ts` | Picos de lecturas al iniciar exámenes | **Medio** | Medio |
| U-1 | Skeletons/errores visibles incompletos | vistas con lecturas | "Parece colgado", mala percepción | **Medio** | Bajo |
| U-2 | Responsive en móvil gama baja no verificado | `QuestionBank.tsx`, `promedio.tsx`, dashboards | Vistas rotas/lentas en el dispositivo real del público | **Medio** | Medio |
| U-4 | Bundle: doble stack UI (MUI + Radix) | `package.json`, `vite.config.ts` | Carga lenta en móvil, más JS del necesario | **Medio** | Alto |
| A-6 | Timeouts de IA | `functions/src/index.ts` | — (están bien; no tocar) | OK | — |
| U-3 | Accesibilidad básica | componentes UI | Barreras para parte del público | **Mejora** | Bajo |

---

## 8. Orden de ataque recomendado (por fases, quirúrgico)

**Fase 0 — Blindaje (esta semana, antes de invitar a nadie más).** Bajo esfuerzo, corta el riesgo de sangrado.
1. Budget alerts en GCP/Firebase (A-7) — 15 min, tu red de seguridad.
2. Auth + CORS estricto + App Check en endpoints de IA (C-1).
3. `maxInstances` en Functions caras (A-2).
4. Sentry en frontend + functions, y matar los `catch` vacíos del ranking (A-7).

**Fase 1 — Cortar la factura (semana 2-3).** El grueso del ahorro.
5. Materializar `rankings/*` en el trigger y leer 1 doc en el cliente (C-2).
6. Migración única de nombres de fase canónicos + borrar el bucle de variantes (C-2).
7. Contador de preguntas → IDs sin contención, Opción A (C-3).

**Fase 2 — Endurecer (semana 4-5).**
8. Reglas por custom claims (A-1).
9. Split `superateHttpLight` / `superateHttpAI` + `minInstances:1` en la ligera (A-5).
10. Rate limiting por usuario en IA (A-2).
11. Índices que falten, verificados con logs (A-3).

**Fase 3 — Deuda y UX (continuo).**
12. Filtrado en query (no en memoria) + partir `db.service.ts` con tests de caracterización (A-4).
13. Caché del banco + pre-generación de sets de examen (A-8).
14. Skeletons, responsive móvil real, virtualización de listas largas (U-1, U-2).
15. Convergencia de UI y lazy de librerías pesadas para bundle (U-4); accesibilidad (U-3).

**Regla de ejecución:** una fase, un conjunto de PRs pequeños, cada cambio detrás de flag, probado primero con una institución piloto, con rollback definido. Nada de big-bang. Medir factura de Firestore y latencia antes/después de cada fase para confirmar el impacto.

---

## 9. Qué NO hacer (para que no se malgaste esfuerzo)

- **No migres de base de datos ni de nube.** Resolvería un problema que no tienes.
- **No añadas servidores dedicados.** Serverless ya escala; solo hay que acotarlo.
- **No cambies los timeouts de IA.** Están bien; el problema era el acoplamiento de rutas, no el timeout.
- **No sigas subiendo los reintentos del contador.** Es maquillaje; el fix es quitar la contención.
- **No reescribas `db.service.ts` de golpe.** Refactor incremental con tests, o introducirás bugs nuevos.

---

*Fin del plan. Cuando decidas el orden, puedo ejecutar cualquier fase de forma quirúrgica: un cambio a la vez, con su PR, su flag y su rollback. No se ha modificado ningún archivo del proyecto para producir este documento.*





