# 📚 Sistema de Banco de Preguntas - Documentación Completa

## 📑 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Configuración Inicial](#configuración-inicial)
4. [Modelo de Datos](#modelo-de-datos)
5. [Generación de Códigos](#generación-de-códigos)
6. [Servicios Backend](#servicios-backend)
7. [Interfaz Frontend](#interfaz-frontend)
8. [Reglas de Seguridad](#reglas-de-seguridad)
9. [Guía de Uso](#guía-de-uso)
10. [API Reference](#api-reference)
11. [Ejemplos de Uso](#ejemplos-de-uso)
12. [Troubleshooting](#troubleshooting)

---

## 📖 Introducción

El **Sistema de Banco de Preguntas** es un módulo completo para la gestión de preguntas de selección múltiple (MCQ) en la plataforma educativa Supérate. Permite a los administradores crear, almacenar, buscar y recuperar preguntas de manera eficiente, con soporte para imágenes y generación automática de códigos únicos.

### Características Principales

✅ **Preguntas de Selección Múltiple** con 4 opciones (A, B, C, D)  
✅ **Soporte para Imágenes** en texto informativo, preguntas y opciones  
✅ **Generación Automática de Códigos** únicos y secuenciales  
✅ **Filtrado Avanzado** por materia, tema, grado y nivel  
✅ **Recuperación Aleatoria** de preguntas para exámenes  
✅ **Almacenamiento Híbrido** (Firestore + Firebase Storage)  
✅ **Interfaz de Usuario Moderna** con React y Tailwind CSS  
✅ **Validaciones Completas** en cliente y servidor  

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  QuestionBank Component                              │   │
│  │  - Formulario de creación                            │   │
│  │  - Lista y filtros                                   │   │
│  │  - Visualización de preguntas                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              SERVICES (Firebase SDK)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  questionService.ts                                  │   │
│  │  - createQuestion()                                  │   │
│  │  - getFilteredQuestions()                            │   │
│  │  - getRandomQuestions()                              │   │
│  │  - uploadImage()                                     │   │
│  │  - generateQuestionCode()                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      FIREBASE                                │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │   FIRESTORE      │      │  FIREBASE STORAGE │            │
│  │                  │      │                   │            │
│  │ /questions       │      │ /questions/       │            │
│  │   - metadata     │      │   - images        │            │
│  │   - options      │      │                   │            │
│  │                  │      │                   │            │
│  │ /counters        │      │                   │            │
│  │   - secuencias   │      │                   │            │
│  └──────────────────┘      └──────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuración Inicial

### 1. Prerrequisitos

- Node.js 18+
- Firebase Project configurado
- Credenciales de Firebase en `.env`

### 2. Variables de Entorno

Asegúrate de tener estas variables en tu archivo `.env`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 3. Estructura de Firebase

#### Firestore Collections

```
superate/
  auth/
    questions/           # Colección principal de preguntas
      {questionId}/      # Documento de pregunta
    counters/            # Contadores para generar códigos únicos
      {counterKey}/      # Documento de contador
```

#### Storage Buckets

```
questions/
  informative/          # Imágenes de texto informativo
  question/             # Imágenes de preguntas
  options/              # Imágenes de opciones
```

---

## 📊 Modelo de Datos

### Estructura de una Pregunta

```typescript
interface Question {
  id: string                    // ID auto-generado por Firestore
  code: string                  // Código único (ej: MAAL1F001)
  
  // Clasificación
  subject: string               // "Matemáticas"
  subjectCode: string           // "MA"
  topic: string                 // "Álgebra"
  topicCode: string             // "AL"
  grade: '6' | '7' | '8' | '9' | '0' | '1'  // 6=Sexto, 1=Undécimo
  level: 'Fácil' | 'Medio' | 'Difícil'
  levelCode: 'F' | 'M' | 'D'
  
  // Contenido
  informativeText?: string      // Texto informativo opcional
  informativeImages?: string[]  // URLs de imágenes informativas
  questionText: string          // Texto principal de la pregunta
  questionImages?: string[]     // URLs de imágenes de la pregunta
  
  // Opciones
  answerType: 'MCQ'             // Tipo de respuesta (Multiple Choice Question)
  options: QuestionOption[]     // Array de 4 opciones
  
  // Metadatos
  createdBy: string             // UID del creador
  createdAt: Date               // Fecha de creación
  rand: number                  // Número aleatorio (0-1) para muestreo
}

interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D'
  text: string | null
  imageUrl: string | null
  isCorrect: boolean
}
```

### Ejemplo de Documento en Firestore

```json
{
  "id": "abc123xyz",
  "code": "MAAL1F001",
  "subject": "Matemáticas",
  "subjectCode": "MA",
  "topic": "Álgebra",
  "topicCode": "AL",
  "grade": "1",
  "level": "Fácil",
  "levelCode": "F",
  "informativeText": "El álgebra es una rama de las matemáticas...",
  "informativeImages": [],
  "questionText": "¿Cuál es el resultado de 2x + 3 = 7?",
  "questionImages": [],
  "answerType": "MCQ",
  "options": [
    {
      "id": "A",
      "text": "x = 2",
      "imageUrl": null,
      "isCorrect": true
    },
    {
      "id": "B",
      "text": "x = 3",
      "imageUrl": null,
      "isCorrect": false
    },
    {
      "id": "C",
      "text": "x = 4",
      "imageUrl": null,
      "isCorrect": false
    },
    {
      "id": "D",
      "text": "x = 5",
      "imageUrl": null,
      "isCorrect": false
    }
  ],
  "createdBy": "user123",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "rand": 0.7234
}
```

---

## 🔢 Generación de Códigos

### Formato del Código

Cada pregunta tiene un código único con el siguiente formato:

```
<MAT><TOP><GRADE><NIV><SERIE>
```

- **MAT**: 2 letras para la materia (ej: MA = Matemáticas)
- **TOP**: 2 letras para el tema (ej: AL = Álgebra)
- **GRADE**: 1 carácter para el grado (6, 7, 8, 9, 0, 1)
- **NIV**: 1 letra para el nivel (F, M, D)
- **SERIE**: 3 dígitos secuenciales (001, 002, 003...)

### Ejemplos de Códigos

| Código      | Descripción                                              |
|-------------|----------------------------------------------------------|
| `MAAL1F001` | Matemáticas - Álgebra - Undécimo - Fácil - #1          |
| `LEOR6M015` | Lenguaje - Ortografía - Sexto - Medio - #15            |
| `CNBI9D042` | Ciencias Naturales - Biología - Noveno - Difícil - #42 |
| `CSHI0F008` | Ciencias Sociales - Historia - Décimo - Fácil - #8     |

### Generación Atómica

El código se genera usando **transacciones de Firestore** para garantizar unicidad:

```typescript
const counterKey = `${subjectCode}${topicCode}${grade}${levelCode}`;
// Ejemplo: "MAAL1F"

// La transacción garantiza que dos preguntas nunca tengan el mismo código
const code = await runTransaction(db, async (transaction) => {
  const counterRef = doc(db, 'counters', counterKey);
  const counterDoc = await transaction.get(counterRef);
  
  let count = 1;
  if (counterDoc.exists()) {
    count = counterDoc.data().count + 1;
  }
  
  transaction.set(counterRef, { count }, { merge: true });
  
  return `${counterKey}${String(count).padStart(3, '0')}`;
});
```

---

## 🔧 Servicios Backend

### QuestionService

Ubicación: `src/services/firebase/question.service.ts`

#### Métodos Principales

##### 1. `createQuestion(questionData, userId)`

Crea una nueva pregunta en Firestore.

**Parámetros:**
- `questionData`: Datos de la pregunta (sin código, ID, ni metadatos)
- `userId`: UID del usuario que crea la pregunta

**Retorna:** `Result<Question>`

**Validaciones:**
- Exactamente una opción debe ser correcta
- Todas las opciones deben tener texto o imagen
- Los códigos de materia/tema/grado/nivel deben ser válidos

**Ejemplo:**
```typescript
const result = await questionService.createQuestion({
  subject: 'Matemáticas',
  subjectCode: 'MA',
  topic: 'Álgebra',
  topicCode: 'AL',
  grade: '1',
  level: 'Fácil',
  levelCode: 'F',
  questionText: '¿Cuál es el valor de x?',
  answerType: 'MCQ',
  options: [/* 4 opciones */]
}, currentUser.uid);

if (result.success) {
  console.log('Pregunta creada:', result.data.code);
}
```

##### 2. `getFilteredQuestions(filters)`

Obtiene preguntas filtradas por criterios.

**Parámetros:**
```typescript
interface QuestionFilters {
  subject?: string
  subjectCode?: string
  topic?: string
  topicCode?: string
  grade?: string
  level?: string
  levelCode?: string
  limit?: number
}
```

**Ejemplo:**
```typescript
// Obtener preguntas de Matemáticas - Álgebra - Undécimo - Fácil
const result = await questionService.getFilteredQuestions({
  subjectCode: 'MA',
  topicCode: 'AL',
  grade: '1',
  levelCode: 'F',
  limit: 10
});
```

##### 3. `getRandomQuestions(filters, count)`

Obtiene preguntas aleatorias que cumplen los filtros.

**Parámetros:**
- `filters`: Mismos filtros que `getFilteredQuestions`
- `count`: Número de preguntas a obtener

**Ejemplo:**
```typescript
// Obtener 20 preguntas aleatorias de Matemáticas nivel Medio
const result = await questionService.getRandomQuestions({
  subjectCode: 'MA',
  levelCode: 'M'
}, 20);
```

##### 4. `uploadImage(file, path)`

Sube una imagen a Firebase Storage.

**Parámetros:**
- `file`: Objeto `File` de la imagen
- `path`: Ruta donde se guardará la imagen

**Validaciones:**
- Tamaño máximo: 5MB
- Formatos permitidos: JPEG, PNG, WEBP

**Ejemplo:**
```typescript
const result = await questionService.uploadImage(
  imageFile,
  `questions/informative/${Date.now()}_${file.name}`
);

if (result.success) {
  const imageUrl = result.data;
}
```

##### 5. `getQuestionStats()`

Obtiene estadísticas del banco de preguntas.

**Retorna:**
```typescript
{
  total: number
  bySubject: Record<string, number>
  byLevel: Record<string, number>
  byGrade: Record<string, number>
}
```

---

## 🎨 Interfaz Frontend

### Componente QuestionBank

Ubicación: `src/components/admin/QuestionBank.tsx`

#### Características

1. **Dashboard de Estadísticas**
   - Total de preguntas
   - Distribución por materia
   - Distribución por nivel
   - Distribución por grado

2. **Filtros Avanzados**
   - Búsqueda por texto
   - Filtro por materia
   - Filtro por tema (dependiente de materia)
   - Filtro por grado
   - Filtro por nivel de dificultad

3. **Formulario de Creación**
   - Selección de clasificación (materia, tema, grado, nivel)
   - Texto informativo opcional
   - Subida de imágenes informativas (máx. 5)
   - Texto de pregunta
   - Subida de imágenes de pregunta (máx. 3)
   - 4 opciones de respuesta (texto o imagen)
   - Marcar respuesta correcta

4. **Lista de Preguntas**
   - Vista de tarjetas con información resumida
   - Acciones: Ver, Editar, Eliminar
   - Paginación automática con scroll

5. **Vista Detallada**
   - Visualización completa de la pregunta
   - Todas las imágenes
   - Opciones con indicador de respuesta correcta
   - Metadatos (código, fecha de creación, etc.)

#### Integración en Dashboard

La pestaña "Preguntas" está disponible en el dashboard de administrador:

```
Dashboard Admin → Pestaña "Preguntas" → QuestionBank Component
```

---

## 🔒 Reglas de Seguridad

### Firestore Rules

Añade estas reglas a tu `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /superate/auth/questions/{questionId} {
      // Solo usuarios autenticados pueden leer preguntas
      allow read: if request.auth != null;
      
      // Solo administradores pueden crear, actualizar o eliminar preguntas
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    match /superate/auth/counters/{counterId} {
      // Solo administradores pueden acceder a los contadores
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Storage Rules

Añade estas reglas a tu `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{allPaths=**} {
      // Solo usuarios autenticados pueden leer imágenes
      allow read: if request.auth != null;
      
      // Solo administradores pueden subir/eliminar imágenes
      allow write, delete: if request.auth != null && 
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
      
      // Validar tipo y tamaño de archivo
      allow write: if request.resource.size < 5 * 1024 * 1024 && // 5MB máximo
        request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 📘 Guía de Uso

### Para Administradores

#### 1. Crear una Nueva Pregunta

1. Accede al Dashboard de Administrador
2. Navega a la pestaña "Preguntas"
3. Haz clic en "Nueva Pregunta"
4. Completa el formulario:
   - **Clasificación**: Selecciona materia, tema, grado y nivel
   - **Información**: Agrega texto informativo e imágenes (opcional)
   - **Pregunta**: Escribe la pregunta y agrega imágenes (opcional)
   - **Opciones**: Completa las 4 opciones con texto o imagen
   - **Respuesta Correcta**: Marca la opción correcta
5. Haz clic en "Crear Pregunta"
6. El sistema generará un código único automáticamente

#### 2. Buscar Preguntas

1. Usa la barra de búsqueda para buscar por texto
2. Aplica filtros:
   - Por materia
   - Por tema (se habilita al seleccionar materia)
   - Por grado
   - Por nivel de dificultad
3. Haz clic en "Limpiar filtros" para resetear
4. Haz clic en "Actualizar" para recargar las preguntas

#### 3. Ver Pregunta Completa

1. Haz clic en cualquier tarjeta de pregunta
2. Se abrirá un diálogo con la vista completa
3. Verás:
   - Código y metadatos
   - Texto informativo e imágenes
   - Pregunta e imágenes
   - Todas las opciones con indicador de respuesta correcta

#### 4. Estadísticas

En la parte superior del banco de preguntas verás:
- **Total de preguntas** en el sistema
- **Distribución por materia** (top 3)
- **Distribución por nivel** (Fácil, Medio, Difícil)
- **Distribución por grado** (top 3)

---

## 📚 API Reference

### Configuración de Materias y Temas

Ubicación: `src/utils/subjects.config.ts`

#### Constantes Principales

```typescript
// Mapeo de grados
export const GRADE_MAPPING: Record<string, string>

// Mapeo inverso de códigos a nombres
export const GRADE_CODE_TO_NAME: Record<string, string>

// Niveles de dificultad
export const DIFFICULTY_LEVELS: Array<{ name: string, code: string }>

// Configuración de materias
export const SUBJECTS_CONFIG: Subject[]
```

#### Funciones Utilitarias

```typescript
// Obtiene una materia por su código
getSubjectByCode(code: string): Subject | undefined

// Obtiene un tema por su código dentro de una materia
getTopicByCode(subjectCode: string, topicCode: string): Topic | undefined

// Obtiene el nombre de un grado por su código
getGradeNameByCode(code: string): string

// Obtiene el código de un grado por su nombre
getGradeCodeByName(name: string): string

// Valida que un código de pregunta sea válido
validateQuestionCode(code: string): boolean

// Decodifica un código de pregunta en sus componentes
decodeQuestionCode(code: string): DecodedQuestion | null
```

### Materias Disponibles

| Materia              | Código | Temas Principales                                |
|---------------------|--------|--------------------------------------------------|
| Matemáticas         | MA     | Álgebra, Geometría, Trigonometría, Cálculo...  |
| Lenguaje            | LE     | Comprensión, Gramática, Literatura, Ortografía...|
| Ciencias Naturales  | CN     | Biología, Química, Física, Ecología...          |
| Ciencias Sociales   | CS     | Historia, Geografía, Economía, Política...      |
| Inglés              | IN     | Gramática, Vocabulario, Comprensión...          |

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Crear Pregunta con Solo Texto

```typescript
import { questionService } from '@/services/firebase/question.service';

const questionData = {
  subject: 'Matemáticas',
  subjectCode: 'MA',
  topic: 'Álgebra',
  topicCode: 'AL',
  grade: '1' as const,
  level: 'Fácil' as const,
  levelCode: 'F' as const,
  questionText: '¿Cuál es el valor de x en la ecuación 2x + 5 = 11?',
  answerType: 'MCQ' as const,
  options: [
    { id: 'A', text: 'x = 2', imageUrl: null, isCorrect: false },
    { id: 'B', text: 'x = 3', imageUrl: null, isCorrect: true },
    { id: 'C', text: 'x = 4', imageUrl: null, isCorrect: false },
    { id: 'D', text: 'x = 5', imageUrl: null, isCorrect: false },
  ]
};

const result = await questionService.createQuestion(questionData, userId);
console.log('Código generado:', result.data.code); // MAAL1F001
```

### Ejemplo 2: Crear Pregunta con Imágenes

```typescript
// 1. Subir imágenes primero
const questionImageResult = await questionService.uploadImage(
  questionImageFile,
  `questions/question/${Date.now()}_question.jpg`
);

const optionAImageResult = await questionService.uploadImage(
  optionAImageFile,
  `questions/options/${Date.now()}_A.jpg`
);

// 2. Crear pregunta con URLs de imágenes
const questionData = {
  subject: 'Ciencias Naturales',
  subjectCode: 'CN',
  topic: 'Biología',
  topicCode: 'BI',
  grade: '9' as const,
  level: 'Medio' as const,
  levelCode: 'M' as const,
  questionText: 'Identifica el órgano mostrado en la imagen:',
  questionImages: [questionImageResult.data],
  answerType: 'MCQ' as const,
  options: [
    { id: 'A', text: null, imageUrl: optionAImageResult.data, isCorrect: true },
    { id: 'B', text: 'Hígado', imageUrl: null, isCorrect: false },
    { id: 'C', text: 'Riñón', imageUrl: null, isCorrect: false },
    { id: 'D', text: 'Pulmón', imageUrl: null, isCorrect: false },
  ]
};

const result = await questionService.createQuestion(questionData, userId);
```

### Ejemplo 3: Obtener Preguntas para un Examen

```typescript
// Obtener 20 preguntas aleatorias de Matemáticas nivel Medio para grado 11
const examQuestions = await questionService.getRandomQuestions({
  subjectCode: 'MA',
  grade: '1',
  levelCode: 'M'
}, 20);

if (examQuestions.success) {
  console.log(`${examQuestions.data.length} preguntas obtenidas`);
  
  // Usar las preguntas en el examen
  const exam = {
    title: 'Examen de Matemáticas - Undécimo',
    questions: examQuestions.data,
    timeLimit: 60, // minutos
  };
}
```

### Ejemplo 4: Buscar Preguntas por Texto

```typescript
// 1. Obtener todas las preguntas de Lenguaje
const allQuestions = await questionService.getFilteredQuestions({
  subjectCode: 'LE'
});

// 2. Filtrar por texto en cliente
const searchTerm = 'comprensión';
const filtered = allQuestions.data.filter(q =>
  q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
  q.code.toLowerCase().includes(searchTerm.toLowerCase())
);

console.log(`${filtered.length} preguntas encontradas`);
```

### Ejemplo 5: Decodificar un Código

```typescript
import { decodeQuestionCode } from '@/utils/subjects.config';

const code = 'MAAL1F001';
const decoded = decodeQuestionCode(code);

if (decoded) {
  console.log('Materia:', decoded.subject.name);     // "Matemáticas"
  console.log('Tema:', decoded.topic.name);           // "Álgebra"
  console.log('Grado:', decoded.gradeName);           // "Undécimo"
  console.log('Nivel:', decoded.levelName);           // "Fácil"
  console.log('Serie:', decoded.serie);               // 1
}
```

---

## 🐛 Troubleshooting

### Error: "Debe haber exactamente una opción correcta"

**Causa:** No se ha marcado ninguna opción como correcta, o se han marcado múltiples opciones.

**Solución:**
1. Verifica que exactamente una opción tenga `isCorrect: true`
2. Asegúrate de marcar el radio button de la opción correcta en el formulario

### Error: "Todas las opciones deben tener texto o imagen"

**Causa:** Una o más opciones están vacías (sin texto ni imagen).

**Solución:**
1. Completa todas las opciones con texto
2. O sube una imagen para cada opción
3. Puedes mezclar: algunas con texto, otras con imagen

### Error: "El archivo es demasiado grande"

**Causa:** La imagen supera el tamaño máximo de 5MB.

**Solución:**
1. Comprime la imagen antes de subirla
2. Usa herramientas como TinyPNG o ImageOptim
3. Considera reducir la resolución de la imagen

### Error: "Tipo de archivo no válido"

**Causa:** El archivo no es una imagen JPEG, PNG o WEBP.

**Solución:**
1. Convierte la imagen a un formato compatible
2. Verifica que la extensión sea correcta (.jpg, .jpeg, .png, .webp)

### Las preguntas no se cargan

**Posibles causas y soluciones:**

1. **Permisos de Firestore**
   - Verifica que las reglas de seguridad estén configuradas correctamente
   - Asegúrate de que el usuario esté autenticado

2. **Conexión a Internet**
   - Verifica la conexión
   - Revisa la consola del navegador para errores de red

3. **Estructura de datos incorrecta**
   - Verifica que la colección `questions` exista en Firestore
   - Revisa la ruta: `superate/auth/questions`

### Los códigos no se generan

**Posibles causas:**

1. **Error en la transacción**
   - Revisa los logs de la consola
   - Verifica que la colección `counters` sea accesible

2. **Códigos duplicados**
   - Esto NO debería ocurrir gracias a las transacciones
   - Si ocurre, verifica que no haya procesos concurrentes modificando contadores

### Las imágenes no se suben

**Posibles causas:**

1. **Permisos de Storage**
   - Verifica las reglas de seguridad de Storage
   - Asegúrate de tener permisos de escritura

2. **Límites de Storage**
   - Verifica que no hayas alcanzado el límite de tu plan de Firebase
   - Revisa el uso de almacenamiento en la consola de Firebase

---

## 📊 Optimización y Mejores Prácticas

### 1. Optimización de Imágenes

**Antes de subir:**
- Comprime las imágenes para reducir tamaño
- Usa formatos modernos como WebP
- Dimensiones recomendadas:
  - Imágenes informativas: 800x600px máx
  - Imágenes de pregunta: 1200x800px máx
  - Imágenes de opciones: 400x300px máx

### 2. Paginación de Preguntas

Si el banco crece mucho, implementa paginación:

```typescript
const QUESTIONS_PER_PAGE = 20;

const getQuestionsPaginated = async (lastDoc: any = null) => {
  let q = query(
    collection(db, 'superate', 'auth', 'questions'),
    orderBy('createdAt', 'desc'),
    limit(QUESTIONS_PER_PAGE)
  );
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  
  const snapshot = await getDocs(q);
  const questions = snapshot.docs.map(doc => doc.data());
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  
  return { questions, lastVisible };
};
```

### 3. Caché de Preguntas

Implementa caché en el cliente para mejorar el rendimiento:

```typescript
import { useState, useEffect } from 'react';

const useQuestionsCache = () => {
  const [cache, setCache] = useState<Record<string, Question[]>>({});
  
  const getCachedQuestions = async (filters: QuestionFilters) => {
    const cacheKey = JSON.stringify(filters);
    
    if (cache[cacheKey]) {
      return { data: cache[cacheKey], fromCache: true };
    }
    
    const result = await questionService.getFilteredQuestions(filters);
    
    if (result.success) {
      setCache(prev => ({ ...prev, [cacheKey]: result.data }));
    }
    
    return { data: result.data, fromCache: false };
  };
  
  return { getCachedQuestions };
};
```

### 4. Validación de Datos

Siempre valida en el cliente y en el servidor:

```typescript
const validateQuestion = (question: Partial<Question>): string[] => {
  const errors: string[] = [];
  
  if (!question.questionText?.trim()) {
    errors.push('El texto de la pregunta es obligatorio');
  }
  
  if (!question.options || question.options.length !== 4) {
    errors.push('Debe haber exactamente 4 opciones');
  }
  
  const correctOptions = question.options?.filter(o => o.isCorrect) || [];
  if (correctOptions.length !== 1) {
    errors.push('Debe haber exactamente una opción correcta');
  }
  
  return errors;
};
```

---

## 🚀 Próximas Mejoras

### En desarrollo

- [ ] Importación masiva de preguntas desde Excel/CSV
- [ ] Exportación de preguntas a PDF
- [ ] Edición de preguntas existentes
- [ ] Duplicación de preguntas
- [ ] Historial de cambios
- [ ] Banco de preguntas compartido entre instituciones
- [ ] Análisis de rendimiento de preguntas en exámenes
- [ ] Sugerencias automáticas de preguntas basadas en IA
- [ ] Versionado de preguntas
- [ ] Tags y etiquetas personalizadas

### Planificadas

- [ ] Búsqueda avanzada con Algolia
- [ ] Revisión por pares de preguntas
- [ ] Comentarios y discusiones sobre preguntas
- [ ] Sistema de calificación de calidad
- [ ] Preguntas de tipo diferente (verdadero/falso, completar espacios)
- [ ] Integración con banco de preguntas ICFES

---

## 📞 Soporte

Para reportar problemas o sugerencias:

1. Abre un issue en el repositorio
2. Contacta al equipo de desarrollo
3. Revisa la documentación de Firebase

---

## 📄 Licencia

Este sistema es parte de la plataforma educativa Supérate.  
Todos los derechos reservados © 2024

---

**Última actualización:** Enero 2024  
**Versión:** 1.0.0  
**Autor:** Equipo de Desarrollo Supérate

