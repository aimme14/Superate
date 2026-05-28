# 📊 Implementación de Gráficos de Temas por Materia

## 🎯 Objetivo Actualizado

Implementar **un gráfico de líneas por cada materia**, donde cada línea representa un **tema específico** de esa materia, mostrando su evolución a través de las 3 fases evaluativas.

### Ejemplo Visual:

```
📚 Matemáticas (85%) ↑ [Expandir ▼]
  ├─ Gráfico con 4 líneas:
  │   ├─ Línea 1: Álgebra (Fase I: 75%, Fase II: 82%, Fase III: 88%)
  │   ├─ Línea 2: Geometría (Fase I: 80%, Fase II: 85%, Fase III: 90%)
  │   ├─ Línea 3: Estadística (Fase I: 70%, Fase II: 75%, Fase III: 80%)
  │   └─ Línea 4: Cálculo (Fase I: 85%, Fase II: 88%, Fase III: 92%)

📚 Lenguaje (72%) → [Expandir ▼]
  ├─ Gráfico con 3 líneas:
  │   ├─ Línea 1: Comprensión Lectora
  │   ├─ Línea 2: Gramática
  │   └─ Línea 3: Producción Textual
```

---

## 🏗️ Arquitectura de la Solución

### 1. **Componente: `TopicProgressChart`**

**Ubicación:** `src/components/charts/TopicProgressChart.tsx`

**Propósito:** Mostrar el gráfico de líneas de los temas de UNA materia específica.

**Características:**
- ✅ Múltiples líneas (una por cada tema de la materia)
- ✅ Eje X: Fases (Fase I, Fase II, Fase III)
- ✅ Eje Y: Porcentaje de rendimiento (0-100%)
- ✅ Paleta de 12 colores para diferenciar temas
- ✅ Tooltip personalizado por tema
- ✅ Indicador de tendencia de la materia
- ✅ Manejo de valores `null` (temas no evaluados en ciertas fases)

**Props:**
```typescript
interface TopicProgressChartProps {
  subjectName: string;    // Nombre de la materia (ej: "Matemáticas")
  data: TopicPhaseData[]; // Array de temas con sus rendimientos por fase
  theme?: 'light' | 'dark';
  showTrend?: boolean;
}

interface TopicPhaseData {
  topic: string;          // Nombre del tema (ej: "Álgebra")
  phase1: number | null;  // Rendimiento en Fase I
  phase2: number | null;  // Rendimiento en Fase II
  phase3: number | null;  // Rendimiento en Fase III
}
```

**Paleta de Colores:**
1. Azul
2. Púrpura
3. Verde
4. Amarillo
5. Rojo
6. Naranja
7. Rosa
8. Cian
9. Lima
10. Ámbar
11. Índigo
12. Fucsia

---

### 2. **Componente: `SubjectTopicsAccordion`**

**Ubicación:** `src/components/charts/SubjectTopicsAccordion.tsx`

**Propósito:** Mostrar un acordeón con todas las materias, cada una expandible para ver su gráfico de temas.

**Características:**
- ✅ Acordeón expandible/colapsable
- ✅ Muestra nombre de la materia
- ✅ Badge con promedio de rendimiento
- ✅ Ícono de tendencia (↑ ↓ →)
- ✅ Número de temas registrados
- ✅ Al expandir: muestra el gráfico de temas
- ✅ Diseño responsive

**Props:**
```typescript
interface SubjectTopicsAccordionProps {
  subjects: SubjectWithTopics[];
  theme?: 'light' | 'dark';
}

interface SubjectWithTopics {
  subjectName: string;           // Nombre de la materia
  topics: TopicPhaseData[];      // Temas con sus datos
  averagePerformance: number;    // Promedio general de la materia
  trend: 'up' | 'down' | 'stable'; // Tendencia
}
```

---

### 3. **Función: `prepareSubjectTopicsData`**

**Ubicación:** `src/pages/promedio.tsx`

**Propósito:** Procesar los datos de las 3 fases y agruparlos por materia y tema.

**Lógica:**
1. Obtener todas las materias únicas de las 3 fases
2. Para cada materia:
   - Obtener todos los temas únicos
   - Para cada tema:
     - Buscar su rendimiento en cada fase
     - Si no existe, asignar `null`
   - Calcular promedio general de la materia
   - Calcular tendencia de la materia
3. Ordenar materias según orden predefinido
4. Retornar estructura lista para los componentes

**Entrada:**
```typescript
phase1Data: AnalysisData | null
phase2Data: AnalysisData | null
phase3Data: AnalysisData | null
```

**Salida:**
```typescript
[
  {
    subjectName: "Matemáticas",
    topics: [
      { topic: "Álgebra", phase1: 75, phase2: 82, phase3: 88 },
      { topic: "Geometría", phase1: 80, phase2: 85, phase3: 90 },
      { topic: "Estadística", phase1: 70, phase2: 75, phase3: 80 },
      { topic: "Cálculo", phase1: 85, phase2: 88, phase3: 92 }
    ],
    averagePerformance: 85.5,
    trend: 'up'
  },
  {
    subjectName: "Lenguaje",
    topics: [
      { topic: "Comprensión Lectora", phase1: 68, phase2: 71, phase3: 75 },
      { topic: "Gramática", phase1: 72, phase2: 74, phase3: null },
      { topic: "Producción Textual", phase1: 70, phase2: 73, phase3: 76 }
    ],
    averagePerformance: 72.3,
    trend: 'up'
  }
]
```

---

## 📊 Flujo de Datos

```
Firestore (results/{userId}/{phase})
         ↓
fetchDataAndAnalyze() - Lee resultados de todas las fases
         ↓
processEvaluationData() - Procesa cada fase, agrupa por materia y tema
         ↓
phase1Data.subjectsWithTopics
phase2Data.subjectsWithTopics  
phase3Data.subjectsWithTopics
         ↓
prepareSubjectTopicsData() - Agrupa temas por materia a través de fases
         ↓
SubjectWithTopics[] - Formato para el acordeón
         ↓
SubjectTopicsAccordion - Renderiza acordeón
         ↓
TopicProgressChart - Renderiza gráfico de cada materia
```

---

## 🎨 Diseño de la Interfaz

### Vista Colapsada (Acordeón Cerrado)

```
┌─────────────────────────────────────────────────────────┐
│ 📚 Matemáticas                    85.5%  ↑    [▼]       │
│    4 temas registrados                                   │
├─────────────────────────────────────────────────────────┤
│ 📚 Lenguaje                       72.3%  ↑    [▼]       │
│    3 temas registrados                                   │
├─────────────────────────────────────────────────────────┤
│ 📚 Ciencias Sociales              78.0%  →    [▼]       │
│    5 temas registrados                                   │
└─────────────────────────────────────────────────────────┘
```

### Vista Expandida (Acordeón Abierto)

```
┌─────────────────────────────────────────────────────────┐
│ 📚 Matemáticas                    85.5%  ↑    [▲]       │
│    4 temas registrados                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  Seguimiento de temas a través de las fases         │ │
│ │                                                       │ │
│ │  100% ┤                                              │ │
│ │       │         ●────●────●  Cálculo                 │ │
│ │   75% ┤    ●────●────●     Geometría                │ │
│ │       │   ●────●────●      Álgebra                   │ │
│ │   50% ┤  ●────●────●       Estadística              │ │
│ │       │                                               │ │
│ │    0% └──────┬─────┬─────┬                           │ │
│ │           Fase I  Fase II Fase III                   │ │
│ │                                                       │ │
│ │  ↑ Rendimiento en aumento de 12.5%                   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Casos de Uso

### Caso 1: Materia con 4 Temas en 3 Fases
```
Matemáticas:
- Álgebra: Fase I (75%) → Fase II (82%) → Fase III (88%)
- Geometría: Fase I (80%) → Fase II (85%) → Fase III (90%)
- Estadística: Fase I (70%) → Fase II (75%) → Fase III (80%)
- Cálculo: Fase I (85%) → Fase II (88%) → Fase III (92%)

✅ Muestra 4 líneas de colores diferentes
✅ Permite identificar qué tema mejora más
✅ Muestra tendencia general de la materia: ↑
```

### Caso 2: Tema No Evaluado en una Fase
```
Lenguaje:
- Gramática: Fase I (72%) → Fase II (74%) → Fase III (null)

✅ La línea se interrumpe en Fase III
✅ No conecta puntos inexistentes
✅ Tooltip no muestra Fase III para este tema
```

### Caso 3: Materia con 1 Solo Tema
```
Inglés:
- Vocabulario: Fase I (80%) → Fase II (85%) → Fase III (88%)

✅ Muestra 1 línea
✅ Funciona correctamente
✅ Gráfico sigue siendo útil para ver evolución
```

---

## 💡 Ventajas Pedagógicas

### Para el Estudiante:
1. **Identificación Precisa:** Ve exactamente qué tema necesita reforzar
2. **Motivación Visual:** Las líneas ascendentes motivan a seguir estudiando
3. **Comparación de Temas:** Puede comparar su rendimiento entre temas
4. **Planificación de Estudio:** Sabe en qué tema enfocarse más

### Para el Docente:
1. **Diagnóstico Detallado:** Identifica debilidades específicas por tema
2. **Seguimiento Individual:** Ve el progreso de cada estudiante por tema
3. **Planificación Curricular:** Ajusta el énfasis en temas débiles
4. **Evaluación de Estrategias:** Ve si las intervenciones funcionan

---

## 🔧 Características Técnicas

### Manejo de Datos Nulos
```typescript
// Si un tema no tiene datos en una fase, se asigna null
{ topic: "Álgebra", phase1: 75, phase2: null, phase3: 88 }

// El gráfico no conecta la línea entre Fase I y Fase III
// Muestra un espacio vacío en Fase II
```

### Cálculo de Tendencia
```typescript
// Compara el promedio de la primera fase con la última fase
const firstPhaseAvg = 75.5
const lastPhaseAvg = 85.5
const change = ((85.5 - 75.5) / 75.5) * 100 = 13.2%

// Si el cambio es >= 2%: 'up' o 'down'
// Si el cambio es < 2%: 'stable'
```

### Ordenamiento de Materias
```typescript
const subjectOrder = {
  'Matemáticas': 1,
  'Lenguaje': 2,
  'Ciencias Sociales': 3,
  'Biologia': 4,
  'Quimica': 5,
  'Física': 6,
  'Inglés': 7
}
// Materias no listadas aparecen al final
```

---

## 📱 Responsive Design

### Desktop (>1024px)
- Acordeón con ancho completo
- Gráficos de 350px de altura
- Leyenda horizontal debajo del gráfico

### Tablet (768-1024px)
- Acordeón se ajusta automáticamente
- Gráficos mantienen proporción
- Leyenda puede ajustarse

### Mobile (<768px)
- Acordeón ocupa ancho completo
- Gráficos de 300px de altura
- Leyenda se ajusta verticalmente si es necesario
- Nombres de temas se truncan con tooltip

---

## 🎨 Paleta de Colores por Tema

Los colores se asignan automáticamente en orden:

1. **Tema 1:** Azul (`hsl(217, 91%, 50%)`)
2. **Tema 2:** Púrpura (`hsl(271, 91%, 55%)`)
3. **Tema 3:** Verde (`hsl(142, 76%, 46%)`)
4. **Tema 4:** Amarillo (`hsl(48, 96%, 43%)`)
5. **Tema 5:** Rojo (`hsl(0, 84%, 50%)`)
6. **Tema 6:** Naranja (`hsl(24, 95%, 43%)`)
7. **Tema 7:** Rosa (`hsl(280, 87%, 55%)`)
8. **Tema 8:** Cian (`hsl(189, 94%, 33%)`)
9. **Tema 9:** Lima (`hsl(84, 81%, 34%)`)
10. **Tema 10:** Ámbar (`hsl(45, 93%, 37%)`)
11. **Tema 11:** Índigo (`hsl(262, 83%, 48%)`)
12. **Tema 12:** Fucsia (`hsl(338, 82%, 50%)`)

Si hay más de 12 temas, los colores se repiten cíclicamente.

---

## 🚀 Uso del Sistema

### 1. Navegar a Desempeño
```
Dashboard → Desempeño → Pestaña "Resumen"
```

### 2. Visualizar Acordeón
```
- Se muestra automáticamente si hay datos de al menos 2 fases
- Cada materia aparece como un ítem colapsable
```

### 3. Expandir Materia
```
- Clic en el nombre de la materia
- Se despliega el gráfico de temas
- Hover sobre las líneas para ver detalles
```

### 4. Interpretar Gráfico
```
- Líneas ascendentes: Mejora en ese tema
- Líneas descendentes: Descenso en ese tema
- Líneas horizontales: Rendimiento estable
- Espacios vacíos: Tema no evaluado en esa fase
```

---

## 📊 Ejemplo Completo de Datos

### Entrada (desde Firestore):
```typescript
// Fase I
{
  subjectsWithTopics: [
    {
      name: "Matemáticas",
      percentage: 75,
      topics: [
        { name: "Álgebra", percentage: 75, correct: 15, total: 20 },
        { name: "Geometría", percentage: 80, correct: 16, total: 20 },
        { name: "Estadística", percentage: 70, correct: 14, total: 20 }
      ]
    }
  ]
}

// Fase II
{
  subjectsWithTopics: [
    {
      name: "Matemáticas",
      percentage: 82,
      topics: [
        { name: "Álgebra", percentage: 82, correct: 16, total: 20 },
        { name: "Geometría", percentage: 85, correct: 17, total: 20 },
        { name: "Estadística", percentage: 75, correct: 15, total: 20 },
        { name: "Cálculo", percentage: 88, correct: 18, total: 20 } // Nuevo tema
      ]
    }
  ]
}

// Fase III
{
  subjectsWithTopics: [
    {
      name: "Matemáticas",
      percentage: 88,
      topics: [
        { name: "Álgebra", percentage: 88, correct: 18, total: 20 },
        { name: "Geometría", percentage: 90, correct: 18, total: 20 },
        { name: "Estadística", percentage: 80, correct: 16, total: 20 },
        { name: "Cálculo", percentage: 92, correct: 19, total: 20 }
      ]
    }
  ]
}
```

### Salida (para el gráfico):
```typescript
{
  subjectName: "Matemáticas",
  topics: [
    { topic: "Álgebra", phase1: 75, phase2: 82, phase3: 88 },
    { topic: "Geometría", phase1: 80, phase2: 85, phase3: 90 },
    { topic: "Estadística", phase1: 70, phase2: 75, phase3: 80 },
    { topic: "Cálculo", phase1: null, phase2: 88, phase3: 92 } // null en Fase I
  ],
  averagePerformance: 85.5,
  trend: 'up'
}
```

---

## ✅ Checklist de Implementación

- [x] Crear componente `TopicProgressChart`
- [x] Crear componente `SubjectTopicsAccordion`
- [x] Implementar función `prepareSubjectTopicsData`
- [x] Integrar en `promedio.tsx`
- [x] Agregar soporte para tema claro/oscuro
- [x] Implementar tooltip personalizado
- [x] Agregar indicador de tendencia por materia
- [x] Manejar valores nulos (temas no evaluados)
- [x] Implementar paleta de colores para temas
- [x] Ordenar materias correctamente
- [x] Diseño responsive
- [x] Documentar código
- [x] Verificar linter (sin errores)

---

## 🎉 Resultado Final

El sistema ahora muestra:

✅ **Un acordeón con todas las materias**
✅ **Cada materia es expandible**
✅ **Al expandir: gráfico de líneas con todos los temas**
✅ **Cada línea = un tema diferente**
✅ **Eje X = Fases (I, II, III)**
✅ **Eje Y = Rendimiento (%)**
✅ **Colores diferenciados para cada tema**
✅ **Tooltip con información detallada**
✅ **Indicador de tendencia por materia**
✅ **Manejo de datos faltantes**

---

## 🔮 Mejoras Futuras Sugeridas

1. **Filtros:** Filtrar por rango de rendimiento
2. **Exportar:** Descargar gráficos como imagen
3. **Comparación:** Comparar con promedio de la clase
4. **Alertas:** Notificar cuando un tema baja significativamente
5. **Metas:** Establecer metas por tema
6. **Predicción:** Usar IA para predecir rendimiento futuro
7. **Recomendaciones:** Sugerir recursos por tema débil

---

**Desarrollado con ❤️ siguiendo las mejores prácticas de desarrollo web y pedagogía**

