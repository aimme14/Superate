# Plan de Ejecución — Fases 0→5 (lo que vamos a tocar)

**Regla:** un incremento a la vez, verificado, sin perder lo aplicado. Nada de deploys sin respetar el orden. Producción con clientes.

---

## Mapa de la superficie C1 (verificado en código)

### Rutas del Express (`functions/src/http/superateHttpApp.ts`)

| Ruta | Tipo | Costo | Auth hoy | Acción |
|---|---|---|---|---|
| `POST /generateStudyPlan` | IA (Gemini) | **Alto** | ❌ ninguna | **Proteger + tope "ya hay plan"** |
| `POST /generateJustification` | IA | Alto | ❌ | Proteger (admin/teacher) |
| `POST /regenerateJustification` | IA | Alto | ❌ | Proteger (admin) |
| `POST /processBatch` | IA | Alto | ❌ | Proteger (admin) |
| `POST /validateJustification` | IA | Medio | ❌ | Proteger (admin) |
| `GET /justificationStats` | lectura admin | Bajo | ❌ | Proteger (admin) |
| `POST /generateWebLinks` | IA | Alto | ❌ | Proteger (admin/teacher) |
| `GET /aiInfo` | info | Bajo | ❌ | Proteger (auth) |
| `GET /getStudyPlan` | lectura | Bajo | ❌ | Público por ahora (diferir) |
| `GET /getTipsICFES` | lectura | Bajo | ❌ | Público por ahora |
| `GET /getVocabularyWords` | lectura | Bajo | ❌ | Público por ahora |
| `ALL /getRandomEjerciciosIA` | lectura | Bajo | ❌ | Público por ahora |
| `GET /health` | health | — | ❌ | **Sigue público** |
| `POST /rebuildSimulacrosConsolidatedHttp` | admin | — | ✅ X-Admin-Secret | OK |
| familia `/studentSummary*` | mixto | — | ✅ Bearer | OK (patrón a reusar) |

### Call sites del cliente que hoy NO mandan token

| Archivo | Línea | Endpoint | ¿Se vuelve protegido? |
|---|---|---|---|
| `src/pages/promedio.tsx` | ~954 | POST /generateStudyPlan | **SÍ** ← el crítico |
| `src/pages/promedio.tsx` | ~756 | GET /getStudyPlan | no (por ahora) |
| `src/hooks/query/useStudyPlanData.ts` | ~165 | GET /getStudyPlan | no (por ahora) |
| `src/components/studyPlan/VocabularyBank.tsx` | ~61 | GET /getVocabularyWords | no (por ahora) |
| `src/services/firebase/ejerciciosIA.service.ts` | ~37 | /getRandomEjerciciosIA | no (por ahora) |
| `src/services/firebase/resources.service.ts` / `question.service.ts` | — | justification/weblinks/tips | SÍ (admin) |

### Patrón reusable ya existente
`src/services/studentSummary/studentSummary.service.ts` → `studentSummaryAuthHeaders()` (usa `authService.auth.currentUser.getIdToken()` → `Authorization: Bearer`).
Servidor: `functions/src/http/studentSummaryAuth.middleware.ts` → `verifyBearerIdToken` (verifica con Admin SDK, adjunta `req.firebaseAuth`).

---

## ORDEN OBLIGATORIO (para no romper producción)

El cliente hoy no manda token. Si subimos el middleware antes que el cliente, se rompe la generación de planes. Por eso:

```
Paso A (cliente)  → el cliente manda Bearer   [NO rompe: el server aún lo ignora]  → deploy Vercel
Paso B (server)   → middleware exige Bearer + tope "ya hay plan" (409)  → deploy Functions
Paso C (server)   → CORS restringido a orígenes reales  → deploy Functions
Paso D (server)   → maxInstances (techo de gasto) + rate limit si hace falta
```

Cada endpoint IA se protege como **slice vertical** (cliente→server) antes de pasar al siguiente. Se empieza por `/generateStudyPlan`.

---

## Fases y tareas

- **Fase 0 — Budget alerts (acción tuya en consola GCP).** Red de seguridad. No es código.
- **Fase 1 — C1 por slices:**
  - 1.1 Helper `getAuthHeaders()` compartido + cliente manda Bearer en `/generateStudyPlan` (Paso A). *No-destructivo.*
  - 1.2 Middleware `verifyBearerIdToken` en `/generateStudyPlan` + tope "ya hay plan → 409 sin Gemini" (Paso B). *Requiere deploy tuyo.*
  - 1.3 CORS restringido (Paso C).
  - 1.4 Repetir slice para justification/weblinks/processBatch (admin).
- **Fase 2 — C2:** borrar `studentRanking.service.ts` + `useStudentRanking.ts` (código muerto). **[HECHO]** — build verde, sin referencias colgadas en `src/`. Nota: este C2 = **higiene/anti-regresión** (borrar código muerto), NO es el C-2 de `PLAN_ESCALABILIDAD` (materializar `rankings/*`). El win de costo del N+1 ya se cobró al desacoplar; la materialización es un **ticket de producto futuro** sin consumidor hoy. No reintroducir el service borrado si mañana se pide ranking de alumno: usar 1 doc materializado o summaries (estilo `fetchTeacherRanking`).
- **Fase 3 — A1:** cerrar huecos de claims (asegurar `claimsRev` en tokens, reducir fallback `get()/exists()` a lo mínimo, no duplicar lecturas en cliente).
- **Fase 4 — A2:** `maxInstances` en `superateHttp` + rate limit por uid si aparece abuso.
- **Fase 5 — (diferido) A5 split / C3 reserva de rango:** solo si se mide dolor real.

---

## Verificación por paso
- Tras cada edit de cliente: typecheck (`tsc`) + revisión de que el fetch sigue funcionando sin token (compatibilidad hacia atrás).
- Tras cada edit de server: probar en emulador/staging que 401 sin token y 200 con token; que el tope 409 no llama a Gemini.
- Nada se marca "hecho" hasta verificar.

*Estado: plan cerrado. Empezamos por 1.1 (no-destructivo).*
