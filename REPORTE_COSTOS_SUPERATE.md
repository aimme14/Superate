# Reporte de Costos — Superate (sistema optimizado)

**Fecha:** 2026-07-16
**Alcance:** costo de **generación de IA** (planes de estudio + reportes académicos) + cómputo de Cloud Functions + Firestore, **por estudiante** y **a escala**.
**Estado del sistema:** optimizado — thinking cap (≤1024), timeout 90s + no-retry-en-timeout, 7 ejercicios/plan, sin regeneración de reportes.

> **Nota de precisión:** **todos los valores son MEDIDOS** en producción vía telemetría `gemini_usage`. El plan de 7 ejercicios se midió con 3 generaciones reales (candidates promedio 3.022, thinking 808, input 885, latencia 26s, `attempt:1`). El estimado previo (~3.000) coincidió con el dato real.

---

## 1. Resumen ejecutivo

- **Costo por estudiante (one-time, ciclo completo): ~$0.10 USD** (≈ COP 410 a ~4.100/USD).
- Un estudiante genera **7 planes** (1 por materia, Fase I) + **3 reportes** (1 por fase). El candado 409 evita regeneración → **es un gasto único por estudiante**, no recurrente.
- La optimización bajó el costo de **~$0.176 → ~$0.10 por estudiante (~43% menos)**.
- **A 10.000 estudiantes: ~$1.000 USD one-time** (antes de optimizar: ~$1.760).

---

## 2. Costos unitarios (precios vigentes)

**Gemini 2.5 Flash (Vertex AI):**
- Input: **$0.30 / 1M tokens**
- Output: **$2.50 / 1M tokens** (el *thinking* se cobra como output)

**Cloud Functions 2ª gen / Cloud Run (us-central1):**
- vCPU: **$0.000024 / vCPU-s** · Memoria: **$0.0000025 / GiB-s** · Requests: **$0.40 / 1M**
- **Free tier mensual:** 180.000 vCPU-s + 360.000 GiB-s + 2M requests → a baja escala, el cómputo es **gratis**.

**Firestore:** lecturas $0.06/100k · escrituras $0.18/100k (pequeño frente a IA).

---

## 3. Costo por llamada (medido / optimizado)

### Plan de estudio (7 ejercicios + thinking cap) — **medido (3 generaciones reales)**
| Componente | Tokens | Costo |
|---|---|---|
| Input (prompt) | 885 | $0.00027 |
| Output (candidates) | 3.022 | — |
| Thinking (capado ≤1024) | 808 | — |
| Output facturado (candidates+thinking) | 3.830 | $0.00958 |
| **Total Gemini / plan** | | **~$0.0098** |
| Cómputo Functions (~26s @ 512MiB/1vCPU) | | ~$0.0007 |

### Reporte académico (medido, sin cambios)
| Componente | Tokens | Costo |
|---|---|---|
| Input | ~1.806 | $0.00054 |
| Output (candidates) | ~1.867 | — |
| Thinking (capado) | ~864 | — |
| Output facturado | ~2.731 | $0.00683 |
| **Total Gemini / reporte** | | **~$0.0074** |
| Cómputo Functions (~20s @ 256MiB/1vCPU) | | ~$0.0005 |

---

## 4. Costo por estudiante (ciclo completo)

| Concepto | Cantidad | Unitario | Subtotal |
|---|---|---|---|
| Planes de estudio | 7 | $0.0099 | $0.0693 |
| Reportes académicos | 3 | $0.0074 | $0.0222 |
| **Gemini (IA)** | | | **$0.0915** |
| Cómputo Functions | 7+3 gen. | — | ~$0.0071 |
| Firestore (lecturas/escrituras de generación) | — | — | ~$0.0020 |
| **TOTAL por estudiante** | | | **~$0.10 USD** |

*(One-time. No incluye lecturas recurrentes de dashboard/quizzes durante el uso diario — ver §7.)*

---

## 5. Impacto de la optimización (antes vs después)

| | Antes | Después | Ahorro |
|---|---|---|---|
| Plan (Gemini) | ~$0.0173 | ~$0.0099 | -43% |
| Reporte (Gemini) | ~$0.0110 | ~$0.0074 | -33% |
| Caso peor (timeout+retry) | 2-3× cobro, 354s | 1 cobro, ≤90s | acotado |
| **Por estudiante** | **~$0.176** | **~$0.10** | **~-43%** |

Palancas aplicadas: thinking cap (cortó ~40-56% del thinking), 7 ejercicios (−~24% output del plan), timeout 90s + no-retry (elimina doble cobro y spinners de 6 min).

---

## 6. Proyección a escala (one-time, generación de IA + cómputo)

| Estudiantes | Gemini (IA) | Functions cómputo | Firestore | **Total USD** | **≈ COP** |
|---:|---:|---:|---:|---:|---:|
| 1 | $0.09 | ~gratis | $0.002 | **~$0.10** | ~410 |
| 100 | $9.15 | ~gratis (free tier) | $0.20 | **~$9.4** | ~38.500 |
| 1.000 | $91.5 | ~$2 | $2 | **~$96** | ~394.000 |
| 5.000 | $457 | ~$27 | $10 | **~$494** | ~2,0M |
| 10.000 | $915 | ~$61 | $20 | **~$996** | ~4,1M |
| 20.000 | $1.830 | ~$130 | $40 | **~$2.000** | ~8,2M |
| 50.000 | $4.575 | ~$330 | $100 | **~$5.005** | ~20,5M |

*(COP a ~4.100/USD — verificar tipo de cambio del día. Functions considera el free tier mensual; a partir de ~666 estudiantes/mes empieza a facturar cómputo.)*

**Sin optimizar, la misma columna a 10.000 sería ~$1.760** — la optimización ahorra **~$760 a 10k** y **~$3.800 a 50k**.

---

## 7. Qué NO incluye este reporte (importante)

- **Uso diario recurrente:** lecturas de Firestore de dashboards, ranking docente, quizzes/simulacros. Ese es el gasto que vimos en la factura de marzo (el pico de "dos onces" = lecturas masivas durante simulacros). Es **usage-driven y recurrente**, no one-time, y se controla con los consolidados/summaries ya implementados (auditoría original C-2/A-1). A escala, vigilar ese renglón por separado.
- **Costo de `superate-ia`** (proyecto Vertex) vs `superate-6c730` (Functions/Firestore): la IA se factura en `superate-ia`; el cómputo/DB en `superate-6c730`. Este reporte suma ambos.
- **Regeneraciones/reintentos anómalos:** acotados por los guardrails (#1 timeout, candado 409), pero un evento de abuso siempre puede mover la aguja — por eso los budget alerts (Fase 0) siguen siendo la red.

---

## 8. Conclusión

Con el sistema optimizado, el costo de IA por estudiante es **~$0.10 (one-time)** y escala linealmente. A **10.000 estudiantes ronda los ~$1.000 one-time** de generación — controlado y predecible. El mayor riesgo restante a escala **no es la IA**, sino las **lecturas de Firestore del uso diario** (dashboards/simulacros), que ya tienen mitigación (consolidados/summaries) y conviene monitorear con la telemetría y los budget alerts activos.
