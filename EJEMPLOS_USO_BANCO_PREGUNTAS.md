# 💡 Ejemplos de Uso - Sistema de Banco de Preguntas

Este documento contiene ejemplos prácticos y casos de uso reales del sistema de banco de preguntas.

## 📑 Tabla de Contenidos

1. [Casos de Uso Completos](#casos-de-uso-completos)
2. [Integración con Exámenes](#integración-con-exámenes)
3. [Flujos de Trabajo](#flujos-de-trabajo)
4. [Componentes Reutilizables](#componentes-reutilizables)
5. [Scripts de Utilidad](#scripts-de-utilidad)

---

## 🎯 Casos de Uso Completos

### Caso 1: Crear Examen de Matemáticas para Grado 11

```typescript
import { questionService } from '@/services/firebase/question.service';

/**
 * Función para crear un examen automático de Matemáticas
 * Mezcla preguntas de diferentes temas y niveles
 */
async function crearExamenMatematicas11() {
  // 1. Obtener preguntas de Álgebra (40%)
  const algebraFacil = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'AL',
    grade: '1',
    levelCode: 'F'
  }, 4);

  const algebraMedio = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'AL',
    grade: '1',
    levelCode: 'M'
  }, 4);

  // 2. Obtener preguntas de Trigonometría (30%)
  const trigonometriaFacil = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'TR',
    grade: '1',
    levelCode: 'F'
  }, 2);

  const trigonometriaMedio = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'TR',
    grade: '1',
    levelCode: 'M'
  }, 2);

  // 3. Obtener preguntas de Cálculo (30%)
  const calculoMedio = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'CA',
    grade: '1',
    levelCode: 'M'
  }, 2);

  const calculoDificil = await questionService.getRandomQuestions({
    subjectCode: 'MA',
    topicCode: 'CA',
    grade: '1',
    levelCode: 'D'
  }, 1);

  // 4. Mezclar todas las preguntas
  const todasLasPreguntas = [
    ...algebraFacil.data,
    ...algebraMedio.data,
    ...trigonometriaFacil.data,
    ...trigonometriaMedio.data,
    ...calculoMedio.data,
    ...calculoDificil.data
  ];

  // 5. Barajar aleatoriamente
  const preguntasMezcladas = todasLasPreguntas.sort(() => Math.random() - 0.5);

  // 6. Crear objeto de examen
  const examen = {
    id: `EXAM_${Date.now()}`,
    title: 'Examen de Matemáticas - Undécimo Grado',
    subject: 'Matemáticas',
    grade: '1',
    timeLimit: 90, // minutos
    totalQuestions: preguntasMezcladas.length,
    questions: preguntasMezcladas.map((q, index) => ({
      number: index + 1,
      questionId: q.id,
      code: q.code,
      points: q.levelCode === 'F' ? 1 : q.levelCode === 'M' ? 2 : 3,
      ...q
    })),
    totalPoints: preguntasMezcladas.reduce((sum, q) => 
      sum + (q.levelCode === 'F' ? 1 : q.levelCode === 'M' ? 2 : 3), 0
    ),
    createdAt: new Date(),
    isActive: true
  };

  console.log('Examen creado:', examen.title);
  console.log(`Total preguntas: ${examen.totalQuestions}`);
  console.log(`Puntos totales: ${examen.totalPoints}`);
  console.log('Distribución:');
  console.log(`- Álgebra: ${algebraFacil.data.length + algebraMedio.data.length} preguntas`);
  console.log(`- Trigonometría: ${trigonometriaFacil.data.length + trigonometriaMedio.data.length} preguntas`);
  console.log(`- Cálculo: ${calculoMedio.data.length + calculoDificil.data.length} preguntas`);

  return examen;
}
```

### Caso 2: Simulacro de Prueba ICFES

```typescript
/**
 * Crear un simulacro tipo ICFES con preguntas de todas las materias
 */
async function crearSimulacroICFES(grado: '0' | '1') {
  const materiasICFES = [
    { codigo: 'MA', nombre: 'Matemáticas', preguntas: 20 },
    { codigo: 'LE', nombre: 'Lenguaje', preguntas: 20 },
    { codigo: 'CN', nombre: 'Ciencias Naturales', preguntas: 15 },
    { codigo: 'CS', nombre: 'Ciencias Sociales', preguntas: 15 },
    { codigo: 'IN', nombre: 'Inglés', preguntas: 15 }
  ];

  const preguntasSimulacro = [];

  for (const materia of materiasICFES) {
    // Obtener preguntas mixtas (diferentes niveles)
    const preguntasMateria = await questionService.getRandomQuestions({
      subjectCode: materia.codigo,
      grade: grado
    }, materia.preguntas);

    if (preguntasMateria.success) {
      preguntasSimulacro.push(...preguntasMateria.data);
    }
  }

  const simulacro = {
    id: `ICFES_${Date.now()}`,
    title: `Simulacro ICFES - Grado ${grado === '0' ? 'Décimo' : 'Undécimo'}`,
    type: 'ICFES',
    totalQuestions: preguntasSimulacro.length,
    questions: preguntasSimulacro,
    timeLimit: 270, // 4.5 horas
    createdAt: new Date()
  };

  return simulacro;
}
```

### Caso 3: Crear Pregunta con Imágenes Paso a Paso

```typescript
/**
 * Guía completa para crear una pregunta con múltiples imágenes
 */
async function crearPreguntaConImagenes() {
  const userId = 'admin-uid-123';

  // 1. Preparar archivos de imagen (estos vendrían de un formulario)
  const imagenInformativa = new File([/* blob */], 'contexto.jpg', { type: 'image/jpeg' });
  const imagenPregunta = new File([/* blob */], 'grafico.jpg', { type: 'image/jpeg' });
  const imagenOpcionA = new File([/* blob */], 'respuesta-a.jpg', { type: 'image/jpeg' });
  const imagenOpcionB = new File([/* blob */], 'respuesta-b.jpg', { type: 'image/jpeg' });

  // 2. Subir imagen informativa
  const urlInformativa = await questionService.uploadImage(
    imagenInformativa,
    `questions/informative/${Date.now()}_contexto.jpg`
  );

  if (!urlInformativa.success) {
    console.error('Error subiendo imagen informativa');
    return;
  }

  // 3. Subir imagen de pregunta
  const urlPregunta = await questionService.uploadImage(
    imagenPregunta,
    `questions/question/${Date.now()}_grafico.jpg`
  );

  if (!urlPregunta.success) {
    console.error('Error subiendo imagen de pregunta');
    return;
  }

  // 4. Subir imágenes de opciones
  const urlOpcionA = await questionService.uploadImage(
    imagenOpcionA,
    `questions/options/${Date.now()}_A.jpg`
  );

  const urlOpcionB = await questionService.uploadImage(
    imagenOpcionB,
    `questions/options/${Date.now()}_B.jpg`
  );

  // 5. Crear la pregunta con todas las URLs
  const pregunta = {
    subject: 'Ciencias Naturales',
    subjectCode: 'CN',
    topic: 'Biología',
    topicCode: 'BI',
    grade: '9' as const,
    level: 'Medio' as const,
    levelCode: 'M' as const,
    
    informativeText: 'Observe el siguiente esquema del sistema circulatorio humano:',
    informativeImages: [urlInformativa.data],
    
    questionText: 'Según el gráfico anterior, identifique cuál es la válvula que impide el retorno de sangre del ventrículo izquierdo a la aurícula izquierda:',
    questionImages: [urlPregunta.data],
    
    answerType: 'MCQ' as const,
    options: [
      {
        id: 'A' as const,
        text: null,
        imageUrl: urlOpcionA.data,
        isCorrect: true
      },
      {
        id: 'B' as const,
        text: null,
        imageUrl: urlOpcionB.data,
        isCorrect: false
      },
      {
        id: 'C' as const,
        text: 'Válvula tricúspide',
        imageUrl: null,
        isCorrect: false
      },
      {
        id: 'D' as const,
        text: 'Válvula pulmonar',
        imageUrl: null,
        isCorrect: false
      }
    ]
  };

  // 6. Guardar en Firestore
  const resultado = await questionService.createQuestion(pregunta, userId);

  if (resultado.success) {
    console.log('✅ Pregunta creada exitosamente');
    console.log('Código:', resultado.data.code);
    console.log('ID:', resultado.data.id);
  }

  return resultado;
}
```

---

## 🎓 Integración con Exámenes

### Hook Personalizado para Gestión de Exámenes

```typescript
// src/hooks/useExamManager.ts
import { useState, useEffect } from 'react';
import { questionService, Question } from '@/services/firebase/question.service';

interface ExamConfig {
  subjectCode: string;
  grade: string;
  topics: Array<{
    topicCode: string;
    questionCount: number;
    distribution: {
      easy: number;    // Porcentaje
      medium: number;  // Porcentaje
      hard: number;    // Porcentaje
    };
  }>;
}

export function useExamManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateExam = async (config: ExamConfig) => {
    setLoading(true);
    setError(null);

    try {
      const allQuestions: Question[] = [];

      for (const topic of config.topics) {
        // Calcular cantidad por nivel
        const easyCount = Math.round(topic.questionCount * topic.distribution.easy / 100);
        const mediumCount = Math.round(topic.questionCount * topic.distribution.medium / 100);
        const hardCount = topic.questionCount - easyCount - mediumCount;

        // Obtener preguntas fáciles
        if (easyCount > 0) {
          const easy = await questionService.getRandomQuestions({
            subjectCode: config.subjectCode,
            topicCode: topic.topicCode,
            grade: config.grade,
            levelCode: 'F'
          }, easyCount);
          
          if (easy.success) {
            allQuestions.push(...easy.data);
          }
        }

        // Obtener preguntas medias
        if (mediumCount > 0) {
          const medium = await questionService.getRandomQuestions({
            subjectCode: config.subjectCode,
            topicCode: topic.topicCode,
            grade: config.grade,
            levelCode: 'M'
          }, mediumCount);
          
          if (medium.success) {
            allQuestions.push(...medium.data);
          }
        }

        // Obtener preguntas difíciles
        if (hardCount > 0) {
          const hard = await questionService.getRandomQuestions({
            subjectCode: config.subjectCode,
            topicCode: topic.topicCode,
            grade: config.grade,
            levelCode: 'D'
          }, hardCount);
          
          if (hard.success) {
            allQuestions.push(...hard.data);
          }
        }
      }

      // Mezclar preguntas
      const shuffled = allQuestions.sort(() => Math.random() - 0.5);

      return {
        success: true,
        questions: shuffled,
        totalQuestions: shuffled.length
      };
    } catch (err) {
      setError('Error generando el examen');
      return {
        success: false,
        questions: [],
        totalQuestions: 0
      };
    } finally {
      setLoading(false);
    }
  };

  return { generateExam, loading, error };
}
```

### Uso del Hook

```typescript
// src/pages/CreateExam.tsx
import { useExamManager } from '@/hooks/useExamManager';

function CreateExam() {
  const { generateExam, loading } = useExamManager();

  const handleCreateExam = async () => {
    const config = {
      subjectCode: 'MA',
      grade: '1',
      topics: [
        {
          topicCode: 'AL',
          questionCount: 10,
          distribution: { easy: 40, medium: 40, hard: 20 }
        },
        {
          topicCode: 'TR',
          questionCount: 5,
          distribution: { easy: 20, medium: 50, hard: 30 }
        }
      ]
    };

    const exam = await generateExam(config);
    
    if (exam.success) {
      console.log('Examen generado:', exam.questions);
      // Guardar el examen en Firestore o usar directamente
    }
  };

  return (
    <button onClick={handleCreateExam} disabled={loading}>
      {loading ? 'Generando...' : 'Crear Examen'}
    </button>
  );
}
```

---

## 📋 Flujos de Trabajo

### Flujo 1: Docente Crea Evaluación Semanal

```typescript
/**
 * Flujo completo: desde la creación hasta la asignación
 */
async function flujoEvaluacionSemanal() {
  // PASO 1: Docente crea preguntas nuevas
  console.log('📝 Paso 1: Crear preguntas nuevas');
  
  const pregunta1 = await questionService.createQuestion({
    subject: 'Matemáticas',
    subjectCode: 'MA',
    topic: 'Álgebra',
    topicCode: 'AL',
    grade: '9',
    level: 'Medio',
    levelCode: 'M',
    questionText: '¿Cuál es el valor de x en 3x + 7 = 22?',
    answerType: 'MCQ',
    options: [
      { id: 'A', text: 'x = 4', imageUrl: null, isCorrect: false },
      { id: 'B', text: 'x = 5', imageUrl: null, isCorrect: true },
      { id: 'C', text: 'x = 6', imageUrl: null, isCorrect: false },
      { id: 'D', text: 'x = 7', imageUrl: null, isCorrect: false },
    ]
  }, 'teacher-uid');

  // PASO 2: Buscar preguntas existentes del mismo tema
  console.log('🔍 Paso 2: Buscar preguntas existentes');
  
  const preguntasExistentes = await questionService.getFilteredQuestions({
    subjectCode: 'MA',
    topicCode: 'AL',
    grade: '9',
    levelCode: 'M',
    limit: 10
  });

  // PASO 3: Seleccionar 5 preguntas aleatorias (incluyendo la nueva)
  console.log('🎲 Paso 3: Seleccionar preguntas para la evaluación');
  
  const todasLasPreguntas = [...preguntasExistentes.data];
  const preguntasSeleccionadas = todasLasPreguntas
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);

  // PASO 4: Crear la evaluación
  console.log('📊 Paso 4: Crear evaluación');
  
  const evaluacion = {
    id: `EVAL_${Date.now()}`,
    title: 'Evaluación Semanal - Álgebra',
    subject: 'Matemáticas',
    topic: 'Álgebra',
    grade: '9',
    teacherId: 'teacher-uid',
    questions: preguntasSeleccionadas,
    timeLimit: 30,
    totalPoints: preguntasSeleccionadas.length * 2,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 semana
    isActive: true,
    studentsAssigned: [],
    createdAt: new Date()
  };

  // PASO 5: Asignar a estudiantes
  console.log('👥 Paso 5: Asignar a estudiantes');
  
  const studentIds = ['student1', 'student2', 'student3']; // IDs de estudiantes
  evaluacion.studentsAssigned = studentIds;

  // PASO 6: Guardar evaluación en Firestore
  // (aquí irá la lógica de guardado)

  console.log('✅ Evaluación creada y asignada exitosamente');
  console.log(`Total preguntas: ${evaluacion.questions.length}`);
  console.log(`Estudiantes asignados: ${evaluacion.studentsAssigned.length}`);

  return evaluacion;
}
```

### Flujo 2: Sistema de Revisión de Preguntas

```typescript
/**
 * Sistema para que otros docentes revisen y aprueben preguntas
 */
interface QuestionReview {
  questionId: string;
  reviewerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comments: string;
  approved: boolean;
  reviewedAt: Date;
}

async function flujoRevisionPreguntas(questionId: string) {
  // PASO 1: Obtener la pregunta
  const pregunta = await questionService.getQuestionById(questionId);
  
  if (!pregunta.success) {
    console.error('Pregunta no encontrada');
    return;
  }

  // PASO 2: Mostrar pregunta para revisión
  console.log('📋 Pregunta a revisar:');
  console.log(`Código: ${pregunta.data.code}`);
  console.log(`Pregunta: ${pregunta.data.questionText}`);
  
  // PASO 3: Recoger feedback del revisor
  const review: QuestionReview = {
    questionId: pregunta.data.id!,
    reviewerId: 'reviewer-uid',
    rating: 4,
    comments: 'Buena pregunta, pero la opción B podría ser más clara',
    approved: true,
    reviewedAt: new Date()
  };

  // PASO 4: Si es aprobada, marcar como lista para usar
  if (review.approved) {
    await questionService.updateQuestion(questionId, {
      // Agregar metadatos de revisión (necesitarías extender el modelo)
      // reviewed: true,
      // reviewCount: 1,
      // averageRating: review.rating
    });
  }

  // PASO 5: Notificar al creador
  console.log('✅ Revisión completada y creador notificado');

  return review;
}
```

---

## 🔧 Componentes Reutilizables

### Componente de Vista Previa de Pregunta

```typescript
// src/components/QuestionPreview.tsx
import { Question } from '@/services/firebase/question.service';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { GRADE_CODE_TO_NAME } from '@/utils/subjects.config';

interface QuestionPreviewProps {
  question: Question;
  showAnswer?: boolean;
  onSelect?: (question: Question) => void;
}

export function QuestionPreview({ 
  question, 
  showAnswer = false, 
  onSelect 
}: QuestionPreviewProps) {
  return (
    <div 
      className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onSelect?.(question)}
    >
      {/* Header con metadatos */}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="font-mono text-xs">
          {question.code}
        </Badge>
        <Badge variant="secondary">{question.subject}</Badge>
        <Badge variant="secondary">{question.topic}</Badge>
        <Badge variant="secondary">
          {GRADE_CODE_TO_NAME[question.grade]}
        </Badge>
        <Badge 
          variant={
            question.level === 'Fácil' ? 'default' : 
            question.level === 'Medio' ? 'secondary' : 
            'destructive'
          }
        >
          {question.level}
        </Badge>
      </div>

      {/* Texto informativo */}
      {question.informativeText && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <p className="text-sm">{question.informativeText}</p>
        </div>
      )}

      {/* Imágenes informativas */}
      {question.informativeImages && question.informativeImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {question.informativeImages.map((url, index) => (
            <img 
              key={index} 
              src={url} 
              alt={`Info ${index}`} 
              className="w-full h-24 object-cover rounded"
            />
          ))}
        </div>
      )}

      {/* Pregunta */}
      <div className="mb-3">
        <p className="font-medium text-lg">{question.questionText}</p>
        
        {/* Imágenes de la pregunta */}
        {question.questionImages && question.questionImages.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {question.questionImages.map((url, index) => (
              <img 
                key={index} 
                src={url} 
                alt={`Question ${index}`} 
                className="w-full h-32 object-cover rounded"
              />
            ))}
          </div>
        )}
      </div>

      {/* Opciones */}
      <div className="space-y-2">
        {question.options.map((option) => (
          <div 
            key={option.id}
            className={`
              p-2 border rounded flex items-center gap-2
              ${showAnswer && option.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}
            `}
          >
            <span className="font-medium">{option.id})</span>
            {option.text && <span className="flex-1">{option.text}</span>}
            {option.imageUrl && (
              <img 
                src={option.imageUrl} 
                alt={`Opción ${option.id}`} 
                className="w-20 h-20 object-cover rounded"
              />
            )}
            {showAnswer && option.isCorrect && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 text-xs text-gray-500 flex justify-between">
        <span>ID: {question.id}</span>
        <span>{new Date(question.createdAt).toLocaleDateString('es-ES')}</span>
      </div>
    </div>
  );
}
```

### Componente de Selector de Preguntas

```typescript
// src/components/QuestionSelector.tsx
import { useState, useEffect } from 'react';
import { questionService, Question, QuestionFilters } from '@/services/firebase/question.service';
import { QuestionPreview } from './QuestionPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface QuestionSelectorProps {
  onSelect: (questions: Question[]) => void;
  maxSelection?: number;
  filters?: QuestionFilters;
}

export function QuestionSelector({ 
  onSelect, 
  maxSelection = 10,
  filters = {} 
}: QuestionSelectorProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [filters]);

  const loadQuestions = async () => {
    setLoading(true);
    const result = await questionService.getFilteredQuestions(filters);
    if (result.success) {
      setQuestions(result.data);
    }
    setLoading(false);
  };

  const toggleSelection = (questionId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      if (newSelected.size < maxSelection) {
        newSelected.add(questionId);
      }
    }
    setSelected(newSelected);
  };

  const handleConfirm = () => {
    const selectedQuestions = questions.filter(q => selected.has(q.id!));
    onSelect(selectedQuestions);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Seleccionar Preguntas</h3>
          <p className="text-sm text-gray-500">
            {selected.size} de {maxSelection} seleccionadas
          </p>
        </div>
        <Button onClick={handleConfirm} disabled={selected.size === 0}>
          Confirmar Selección
        </Button>
      </div>

      {/* Lista de preguntas */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p>Cargando preguntas...</p>
        ) : (
          questions.map(question => (
            <div key={question.id} className="relative">
              {selected.has(question.id!) && (
                <Badge 
                  className="absolute top-2 right-2 z-10" 
                  variant="default"
                >
                  Seleccionada
                </Badge>
              )}
              <QuestionPreview
                question={question}
                onSelect={() => toggleSelection(question.id!)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## 🛠️ Scripts de Utilidad

### Script para Importar Preguntas desde CSV

```typescript
// scripts/importQuestionsFromCSV.ts
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { questionService } from '@/services/firebase/question.service';

/**
 * Formato del CSV:
 * subject,subjectCode,topic,topicCode,grade,level,levelCode,questionText,optionA,optionB,optionC,optionD,correctAnswer
 */

interface CSVRow {
  subject: string;
  subjectCode: string;
  topic: string;
  topicCode: string;
  grade: string;
  level: string;
  levelCode: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

async function importQuestionsFromCSV(filePath: string, userId: string) {
  try {
    // Leer archivo CSV
    const fileContent = readFileSync(filePath, 'utf-8');
    const rows: CSVRow[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`📁 Archivo cargado: ${rows.length} preguntas encontradas`);

    let successCount = 0;
    let errorCount = 0;

    // Procesar cada fila
    for (const [index, row] of rows.entries()) {
      try {
        const questionData = {
          subject: row.subject,
          subjectCode: row.subjectCode,
          topic: row.topic,
          topicCode: row.topicCode,
          grade: row.grade as any,
          level: row.level as any,
          levelCode: row.levelCode as any,
          questionText: row.questionText,
          answerType: 'MCQ' as const,
          options: [
            {
              id: 'A' as const,
              text: row.optionA,
              imageUrl: null,
              isCorrect: row.correctAnswer === 'A'
            },
            {
              id: 'B' as const,
              text: row.optionB,
              imageUrl: null,
              isCorrect: row.correctAnswer === 'B'
            },
            {
              id: 'C' as const,
              text: row.optionC,
              imageUrl: null,
              isCorrect: row.correctAnswer === 'C'
            },
            {
              id: 'D' as const,
              text: row.optionD,
              imageUrl: null,
              isCorrect: row.correctAnswer === 'D'
            }
          ]
        };

        const result = await questionService.createQuestion(questionData, userId);

        if (result.success) {
          successCount++;
          console.log(`✅ [${index + 1}/${rows.length}] Pregunta creada: ${result.data.code}`);
        } else {
          errorCount++;
          console.error(`❌ [${index + 1}/${rows.length}] Error en pregunta ${index + 1}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [${index + 1}/${rows.length}] Error procesando fila:`, error);
      }
    }

    console.log('\n📊 Resumen de importación:');
    console.log(`Total: ${rows.length}`);
    console.log(`✅ Exitosas: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
  } catch (error) {
    console.error('Error leyendo el archivo CSV:', error);
  }
}

// Ejemplo de uso:
// importQuestionsFromCSV('./preguntas.csv', 'admin-uid');
```

### Script para Exportar Preguntas a JSON

```typescript
// scripts/exportQuestionsToJSON.ts
import { questionService } from '@/services/firebase/question.service';
import { writeFileSync } from 'fs';

async function exportQuestionsToJSON(outputPath: string) {
  try {
    console.log('📥 Exportando preguntas...');

    // Obtener todas las preguntas
    const result = await questionService.getFilteredQuestions({});

    if (!result.success) {
      console.error('Error obteniendo preguntas');
      return;
    }

    const questions = result.data;

    // Crear objeto de exportación con metadatos
    const exportData = {
      exportDate: new Date().toISOString(),
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        ...q,
        createdAt: q.createdAt.toISOString()
      }))
    };

    // Escribir archivo JSON
    writeFileSync(
      outputPath,
      JSON.stringify(exportData, null, 2),
      'utf-8'
    );

    console.log(`✅ ${questions.length} preguntas exportadas a ${outputPath}`);
  } catch (error) {
    console.error('Error exportando preguntas:', error);
  }
}

// Ejemplo de uso:
// exportQuestionsToJSON('./banco_preguntas_backup.json');
```

---

## 📞 Contacto y Contribuciones

¿Tienes más casos de uso o ejemplos útiles? ¡Compártelos con el equipo!

---

**Última actualización:** Enero 2024  
**Versión:** 1.0.0

