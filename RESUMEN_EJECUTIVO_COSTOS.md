# Superate — Resumen ejecutivo de costos (empresa)

*Dos capas: **infraestructura** (Firebase + IA) y **operación** (equipo + hosting + empresa). USD y COP (≈ 4.100 COP/USD, verificar cambio del día). Precio de referencia usado: **COP 3.000/estudiante/mes** (ajustable).*

---

## 1. Costo de INFRAESTRUCTURA por estudiante (por año)

Incluye estudiante (7 planes + 21 exámenes: 7 materias × 3 fases + materiales) + docente (3 reportes) + rector (dashboards). Todo en un número:

| Componente | USD/año | COP/año |
|---|---:|---:|
| IA — 7 planes + 3 reportes (Gemini) | $0.091 | ~373 |
| Firestore — exámenes + materiales + dashboards (~5.000 lecturas) | $0.008 | ~33 |
| Egress (descarga de exámenes con imágenes)* | $0.003 | ~12 |
| Cómputo Cloud Functions | $0.015 | ~62 |
| Subtotal | $0.112 | ~459 |
| + Margen tolerancia (~40%) | $0.045 | ~185 |
| **TOTAL infra / estudiante / año** | **~$0.16** | **~COP 656** |

> **~COP 55/estudiante/mes** de infra, todo incluido. *El egress cae ~90% tras migrar imágenes a Storage (en curso). La infra la domina la IA (~80%), no las lecturas.*

---

## 2. Costos OPERATIVOS de empresa (OpEx)

| Concepto | Costo | Notas |
|---|---|---|
| **Ingeniería** | **COP 3,5M/mes por ingeniero** (COP 42M/año) | 1 ingeniero por cada ~10.000 usuarios (mín. 1). Es el costo fijo dominante. |
| **Hosting Vercel** | **~$20 USD/mes** (COP ~984k/año) desde 1.000+ usuarios | Antes de 1.000: free tier. A 20k+ puede sumar ancho de banda. |
| **Pasarela de pago** | **~3% de los ingresos** | Wompi/PayU Colombia (~2,99-3,49%). Escala con ingresos, no con usuarios. |
| **GTM / marketing / ventas** | *a definir* | Adquisición de instituciones. Suele ser el rubro grande y variable. |
| **Soporte / legal / admin / herramientas** | *a definir* | Puede empezar dentro del rol del ingeniero/fundador. |

---

## 3. Panorama completo — P&L a COP 3.000/estudiante/mes

| Usuarios | Ingreso/año | Infra | Vercel | Ingenieros | Ing. costo | Pasarela (3%) | **Costo total** | **Ganancia neta/año** |
|---:|---:|---:|---:|:--:|---:|---:|---:|---:|
| 1.000 | 36 M | 0,7 M | 1 M | 1 | 42 M | 1,1 M | ~44,8 M | **−8,8 M (pérdida)** |
| 5.000 | 180 M | 3,3 M | 1 M | 1 | 42 M | 5,4 M | ~51,7 M | **+128 M** |
| 10.000 | 360 M | 6,6 M | 1 M | 1 | 42 M | 10,8 M | ~60,4 M | **+300 M** |
| 20.000 | 720 M | 13,1 M | 1,5 M | 2 | 84 M | 21,6 M | ~120 M | **+600 M** |
| 50.000 | 1.800 M | 32,8 M | 2 M | 5 | 210 M | 54 M | ~299 M | **+1.501 M** |

**Break-even ≈ 1.250 estudiantes** (a COP 3.000/mes). El costo fijo dominante es **1 ingeniero (COP 42M/año)** — por debajo de ~1.250 alumnos no se cubre; por encima, el negocio es **fuertemente rentable** (75-85% de margen neto a partir de 10k).

*(GTM/marketing no está en la tabla — es el rubro que definís vos y el que más mueve la rentabilidad real en la fase temprana.)*

---

## 4. Sensibilidad al precio (poblaciones vulnerables)

El break-even sube si bajás el precio. A distintos precios asequibles:

| Precio/mes | Break-even (cubrir 1 ing. + infra) |
|---:|---:|
| COP 3.000 | ~1.250 estudiantes |
| COP 2.000 | ~1.950 estudiantes |
| COP 1.000 | ~4.400 estudiantes |

> Podés servir a bajos recursos a COP 1.000-2.000/mes; solo necesitás más volumen para cubrir el ingeniero. Una vez cubierto, cada alumno extra es ~97% ganancia (la infra es centavos).

---

## 5. ¿Es viable a esa escala?

**Sí — con un matiz clave: el límite NO es la tecnología, es el volumen para cubrir el equipo.**

- **Infraestructura:** trivial y lineal (~COP 55/alumno/mes). Nunca es el cuello de botella, ni a 50.000.
- **El costo real es el equipo (OpEx fijo).** Por eso el negocio necesita **~1.250 alumnos** (a COP 3.000/mes) para sostener 1 ingeniero. Superado eso, escala con márgenes netos de 75-85%.
- **A 10.000 alumnos:** ~COP 300M/año de ganancia neta. A 50.000: ~COP 1.500M/año.

**Honesto para el inversor:** la tecnología está resuelta y es barata. La inversión se justifica por el **go-to-market** (llegar a las instituciones) y por llegar al volumen de break-even — no por costos de servidores. El modelo tiene unit economics excelentes una vez pasado el punto de equilibrio.

---

## Conclusión

**Infra: ~COP 55/alumno/mes. Break-even: ~1.250 alumnos (a COP 3.000/mes), dominado por 1 ingeniero. Pasado eso, margen neto 75-85% y ~COP 300M/año de ganancia a 10k, ~COP 1.500M a 50k. La viabilidad la define el volumen y el go-to-market, no la tecnología — que ya está optimizada y escala barata.**

*Supuestos ajustables: precio COP 3.000/mes, 1 ingeniero/10k @ COP 3,5M/mes, Vercel $20/mes desde 1k, pasarela 3%. GTM/soporte/legal a definir. Precios IA/infra: Gemini Flash $0.30/$2.50 por 1M tokens; Cloud Run $0.000024/vCPU-s.*
