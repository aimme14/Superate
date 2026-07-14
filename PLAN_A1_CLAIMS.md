# Plan A1 — Raíz de los claims vacíos (pipeline de claims)

> ## ✅ CONCLUSIÓN (cerrado — sin fix urgente)
> **Diagnóstico completo** vía script read-only `audit-claims` (A0 + A4):
> - **82 usuarios: 77 OK, 2 bajas legítimas, 3 vacíos** (de esos, **2 casos reales** = rector + coordinador con datos sanos; 1 huérfano sin userLookup).
> - **Zamila ya está OK** (persistentes correctos, `claimsRev:2`): se auto-curó al loguear. Su token vacío anterior fue **stale/transitorio**, no un problema vivo.
> - **Causa raíz:** los claims se vaciaron en algún evento (fallo transitorio del blocking devolviendo `{}` y/o los scripts borrados `syncAllAuthClaims`/`reconcileAuthUsers`). El pipeline **re-setea al login/cambio de dato**, así que cuentas estables no auto-curan hasta que loguean.
> - **Estado real:** **nada bloqueado.** Usuarios nuevos funcionan; los 2 stale se curan al loguear; el fallback de reglas (`sameInstitution`, fix de Josué) cubre mientras tanto.
> - **Decisión:** **no se ejecuta fix** (ni re-sync masivo ni cambios de pipeline). Queda **una mejora de robustez de baja prioridad, sin apuro**: endurecer `setUserClaims` para que en el path de fallo (`compute===null`/excepción) **no devuelva `{ customClaims: {} }`** (no pisar) y **loguee/alerte**. Ver "Fase C · punto 2" abajo.
>
> El diagnóstico-primero evitó un re-sync masivo innecesario sobre un problema que resultó ser 2 cuentas stale.

**Regla de oro:** diagnóstico primero, cero escrituras en producción hasta entender la causa raíz. La única excepción permitida es el re-sync de UN usuario (Zamira) como test aislado de bajo riesgo. Todo lo demás (fixes de pipeline, re-sync masivo) va **después** del diagnóstico, por pasos verificados: yo planeo, vos ejecutás, yo reviso.

---

## Qué sabemos (estado confirmado)

- Las reglas de Firestore exigen claims en el token (`claimsRev`, `active`, `institutionActive`, `institutionId`, `role`). Hoy funcionan porque casi todas caen a un **fallback caro** que lee Firestore (`isActiveNonAdmin` / `isMemberOfInstitution`) — mitigación de Josué, correcta, pero costosa a escala.
- El token de la docente Zamira (`v9eQ3ONFTJP8TXKmfkEleBR02jj1`) salió con **todos los claims `undefined`** (ni siquiera `claimsRev`).
- Sus **datos están sanos**: `userLookup` (institutionId + role=teacher), doc `profesores` (`isActive:true`), institución (`isActive:true`).
- `computeSuperateClaims` está **bien escrita**: con esos datos devolvería claims válidos.
- El pipeline: `setUserClaims` (blocking `beforeSignIn`) → `computeSuperateClaims`; y un path async `_syncClaimsQueue/{uid}` → `syncClaimsForUid` → `setCustomUserClaims`.

**El misterio:** datos sanos + código correcto, pero token vacío. Significa que los claims **no se están aplicando al token** — o el blocking function no corre/está mal, o los claims persistentes se limpiaron y nunca se re-sincronizaron. Hay que determinar cuál antes de tocar nada.

### ⚠️ Hallazgo crítico del código (reframe la causa raíz)

En `setUserClaims` (blocking `beforeSignIn`), el manejo es:
```ts
const claims = await computeSuperateClaims(uid);
if (claims === null) { return { customClaims: {} }; }   // ← NO loguea
return { customClaims: { ...claims } };
} catch (err) {
  console.error('[setUserClaims]', uid, err);            // ← solo esto loguea
  return { customClaims: {} };
}
```
En Identity Platform / Firebase Auth, **devolver `{ customClaims: {} }` desde un blocking `beforeSignIn` REEMPLAZA los custom claims persistentes** — no es "no tocar". Por lo tanto, si `computeSuperateClaims` da `null` **o** lanza excepción, **cada login vacía en silencio los claims buenos**. El path de `null` ni siquiera loguea.

Esto explica el síntoma de Zamira: **todo `undefined`, sin `claimsRev`** = **vaciado total**, distinto de **denegado** (que vendría con `claimsRev: 2` + `active: false`, vía `setDeniedClaims`). Vacío ≠ denegado, y esa distinción es el diagnóstico diferencial central.

**Distinción de "vacío" vs "denegado" vs "OK" (clasificar siempre):**
| Estado | Cómo se ve | Qué implica |
|---|---|---|
| **OK** | `claimsRev:2`, `active` coherente, `institutionId` presente | Pipeline sano para ese usuario |
| **Denegado** | `claimsRev:2`, `active:false` | Pasó por `setDeniedClaims`/sync con datos no válidos |
| **Vacío** | sin `claimsRev`, todo `undefined` | Blocking devolvió `{}` (null/error) y **pisó** los claims |

---

## FASE A — Diagnóstico (read-only / bajo riesgo)

### A0. Estado actual de los claims persistentes de Zamira (read-only, 30 s, ALTO valor)
- Firebase Console → **Authentication → usuario Zamira → Custom claims** (el registro de **Auth**, NO el JWT del cliente).
- Clasificar con la tabla de arriba: **OK / Denegado / Vacío**.
- *Por qué primero:* separa "los persistentes están mal" de "el token/refresh está mal". Sin A0, A3 mezcla "sync" con "token".
  - **Ya vacíos** → persistentes nunca se setearon o fueron pisados; el token solo refleja eso.
  - **Ya OK** → problema de refresh/cliente, o medimos un token viejo.

### A1. ¿Está desplegado y activo el blocking function?
- Firebase Console → **Functions**: ¿aparece `setUserClaims`? ¿Fecha de último deploy?
- Firebase Console → **Authentication → Settings → Blocking functions**: ¿`beforeSignIn` está apuntando a `setUserClaims` y **habilitado**?
- *Por qué:* si el blocking function no está activo, no setea session claims al login → tokens vacíos.

### A2. Logs de Cloud Functions
- En GCP Logging, filtrar por `setUserClaims` y `syncClaimsForUid` alrededor de un login fresco (pedir a Zamira que re-loguee, o vos).
- Buscar: ¿corrió? ¿lanzó error? ¿`computeSuperateClaims` devolvió null?
- **Tip clave:** buscá también invocaciones de `setUserClaims` **sin** un `[setUserClaims] error` asociado → eso es "corre y silencia" (devolvió `{}` por el path de `null`, que no loguea). Ese patrón = el blocking pisando claims sin dejar rastro.
- *Por qué:* distingue "no corre" de "corre pero falla" de "corre y vacía en silencio". Refuerza que la observabilidad (Fase C) es **transversal, no opcional**.

### A3. Test del path de re-sync en UN usuario (Zamira) — único write permitido en esta fase
**Partido en dos lecturas, con checkpoint Auth ANTES del re-login** (evita el falso "re-sync no funciona" cuando en realidad el login borra lo recién seteado):

1. **Encolar** (único write): crear `superate/auth/_syncClaimsQueue/v9eQ3ONFTJP8TXKmfkEleBR02jj1` (cualquier campo). El trigger corre `syncClaimsForUid` → setea persistentes desde los datos sanos → borra el doc.
2. **Checkpoint Auth (ANTES de re-login):** Firebase Console → Authentication → usuario → Custom claims.
   - **Aparecen** (`role/active/institutionId/claimsRev`) → la cola/`syncClaimsForUid` **funciona**.
   - **No aparecen** → fallo más profundo en `onClaimsSyncQueueWrite`/`syncClaimsForUid`/`setCustomUserClaims` → ir a A2 con foco en esos.
3. **Re-login** de Zamira → decodificar token.
   - **Auth OK + token OK** → pipeline de cola sano; el misterio es histórico/desync o blocking **intermitente**.
   - **Auth OK + token vacío, o Auth vuelve a `{}`** → **el blocking está pisando** en el login (hipótesis e / a / b). Este es el escenario que más encaja con Zamira.

*El paso 2 (checkpoint Auth intermedio) es lo que evita conclusiones erróneas.*

### A4. Medir el alcance (script read-only)
- Script nuevo en `functions/src/scripts/auditClaims.ts` que:
  - Recorre `admin.auth().listUsers()` (paginado).
  - Para cada usuario, lee `customClaims` y clasifica: OK (tiene `claimsRev` y `active` coherente) / vacío (sin claims) / denegado (`active:false`).
  - Cruza con `userLookup` para detectar "datos sanos pero claims vacíos" (el caso Zamira).
  - **Solo lee y cuenta — no escribe nada.**
- Salida: cuántos usuarios afectados, de qué instituciones. Define si el fix es 1 usuario, 1 institución, o masivo.

---

## FASE B — Causa raíz (según A1–A4)

Con los resultados, identificar cuál es (clasificando siempre **vacío / denegado / OK**):
- (a) Blocking function no desplegado/deshabilitado.
- (b) Blocking function corre pero `computeSuperateClaims` falla en runtime (permisos, timeout, bug).
- (c) Claims persistentes se limpiaron (¿un `syncClaimsForInstitutionMembers` que corrió con datos inconsistentes? ¿un cambio de `claimsRev`?) y no se re-sincronizaron.
- (d) Otra.
- **(e) — la más probable:** el blocking **corre**, pero en algún login `computeSuperateClaims` dio `null` o lanzó excepción → devolvió `{ customClaims: {} }` → **pisó** los claims buenos. Como los triggers de cola solo disparan ante cambios (users / userLookup / doc de rol / `isActive` de institución), un usuario **estable** (docente que no cambia) queda **vacío para siempre**. Síntoma exacto de Zamira: vaciado total, sin `claimsRev`.

**Corolario para el fix (Fase C):** si es (e), el arreglo del blocking es **no pisar en el path de fallo** — cuando `computeSuperateClaims` da null/excepción, NO devolver `{}` (que borra), sino no tocar los claims existentes (p. ej. no incluir `customClaims` en el retorno) y **loguear/alertar**. Eso, más un re-sync de los ya vaciados.

**No se diseña el fix hasta tener esto claro.**

---

## FASE C — Fix controlado (depende de B)

Opciones según la causa (se elige la que aplique):
- **Si es (a):** redeploy/habilitar el blocking function. Verificar que un login fresco produce token con claims.
- **Si es (b):** corregir el bug/permiso en `setUserClaims`/`computeSuperateClaims`; añadir manejo robusto.
- **Si es (c):** re-sync masivo controlado con `syncClaimsForInstitutionMembers(institutionId)` **por institución** (no docs a mano), verificando antes/después con el script de auditoría.
- **Transversal — Observabilidad (siempre):** que `computeSuperateClaims` devolviendo null y `setUserClaims` devolviendo `{}` **logueen/alerten** en vez de fallar en silencio. Hoy un token vacío no deja rastro visible; eso es lo que nos costó horas de debug.

---

## FASE D — Verificación

- Usuarios afectados re-loguean → decodificar token → claims presentes (`claimsRev/active/institutionId/role`).
- Confirmar que las reglas usan el **camino barato del token** (0 lecturas), no el fallback Firestore. (Se puede inferir por costo/latencia o revisando que `tokenSameInstitution` pase.)
- Re-correr el script de auditoría → 0 (o casi 0) usuarios con claims vacíos y datos sanos.

---

## FASE E — Limpieza opcional (post-fix)

- Con claims confiables, el fallback que agregó Josué en la regla `ResumenStudent` (`sameInstitution`) pasa a ser **red de seguridad redundante** — se puede dejar (no molesta) o, si se quiere el máximo ahorro, volver a `tokenSameInstitution`. **No urgente.**
- Documentar el runbook: "si un usuario reporta permisos raros, re-encolar `_syncClaimsQueue/{uid}` y pedirle re-login".

---

## Orden de ejecución

1. **A0** (Custom claims de Zamira en Auth, read-only) → clasificar vacío/denegado/OK.
2. **A1 + A2 + A3** (con el **checkpoint Auth intermedio** en A3, antes del re-login) → me pasás los resultados, yo interpreto.
3. Con eso, **B** (causa raíz) queda determinada, con taxonomía (vacío/denegado/OK) + hipótesis (a–e).
4. Escribo el detalle de **C** (el fix específico) según B → vos ejecutás → yo reviso.
5. **A4** (script de auditoría read-only) lo puedo escribir yo como plan para que ejecutes en paralelo — da el alcance.

**Nada de re-sync masivo ni cambios de pipeline hasta cerrar B.** Fase E (quitar el fallback de reglas) sigue post-fix, no ahora.

> **El riesgo principal no es "tocar prod de más" — es interpretar mal un A3 verde/rojo**, porque `setUserClaims` puede estar borrando claims en cada login. Por eso A0 + checkpoint Auth intermedio son obligatorios antes de concluir.
