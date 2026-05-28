# 📸 Configuración de Imágenes en el Banco de Preguntas

## ✅ Funcionalidades Implementadas

### 🎯 Características Principales
- **Imágenes Informativas**: Hasta 5 imágenes que se muestran antes de la pregunta
- **Imágenes de Pregunta**: Hasta 3 imágenes que acompañan el texto de la pregunta
- **Imágenes de Opciones**: Una imagen por opción de respuesta (A, B, C, D)
- **Galería Interactiva**: Visualización mejorada con zoom y navegación
- **Validación de Archivos**: Solo imágenes JPEG, PNG, WEBP (máximo 5MB)

### 🔧 Configuración Requerida

#### 1. **Configurar Firebase Storage CORS**

Ejecuta el script de configuración:
```bash
npm run configure-storage
```

O manualmente:
```bash
# Crear archivo cors.json
cat > cors.json << EOF
[
  {
    "origin": [
      "http://localhost:5173",
      "http://localhost:3000", 
      "http://localhost:8080",
      "https://superate-6c730.web.app",
      "https://superate-6c730.firebaseapp.com"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Aplicar configuración
gsutil cors set cors.json gs://superate-6c730.firebasestorage.app
```

#### 2. **Configurar Reglas de Firebase Storage**

Ve a **Firebase Console** → **Storage** → **Rules** y usa:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Permitir acceso a imágenes de preguntas para usuarios autenticados
    match /questions/{allPaths=**} {
      // Leer: cualquier usuario autenticado
      allow read: if request.auth != null;
      
      // Escribir: solo administradores
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Permitir acceso a otros archivos del sistema
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 🎨 Cómo Usar las Imágenes

### 📝 Crear Pregunta con Imágenes

1. **Abrir el modal de crear pregunta**
2. **Completar información básica** (materia, tema, grado, nivel)
3. **Agregar texto informativo** (opcional)
4. **Subir imágenes informativas**:
   - Hacer clic en "Subir Imágenes"
   - Seleccionar hasta 5 imágenes
   - Ver previsualizaciones
   - Eliminar imágenes con el botón X
5. **Escribir el texto de la pregunta**
6. **Subir imágenes de la pregunta**:
   - Hacer clic en "Subir Imágenes"
   - Seleccionar hasta 3 imágenes
   - Ver previsualizaciones
7. **Configurar opciones de respuesta**:
   - Escribir texto para cada opción
   - Subir imagen para cada opción (opcional)
   - Marcar la respuesta correcta
8. **Crear la pregunta**

### 👀 Visualizar Imágenes

- **En la lista de preguntas**: Indicadores de imágenes disponibles
- **En la vista detallada**: Galería interactiva con zoom
- **Navegación**: Botones para cambiar entre imágenes
- **Miniaturas**: Vista previa de todas las imágenes

## 🚀 Estructura de Almacenamiento

### 📁 Organización en Firebase Storage

```
gs://superate-6c730.firebasestorage.app/
├── questions/
│   ├── informative/
│   │   ├── 1704067200000_imagen1.jpg
│   │   └── 1704067201000_imagen2.png
│   ├── question/
│   │   ├── 1704067202000_pregunta1.jpg
│   │   └── 1704067203000_pregunta2.png
│   └── options/
│       ├── 1704067204000_A.jpg
│       ├── 1704067205000_B.jpg
│       ├── 1704067206000_C.jpg
│       └── 1704067207000_D.jpg
```

### 🗄️ Estructura en Firestore

```json
{
  "id": "question_123",
  "code": "MAAL1F001",
  "subject": "Matemáticas",
  "subjectCode": "MA",
  "topic": "Álgebra",
  "topicCode": "AL",
  "grade": "6",
  "level": "Fácil",
  "levelCode": "F",
  "informativeText": "Información adicional...",
  "informativeImages": [
    "https://firebasestorage.googleapis.com/.../imagen1.jpg",
    "https://firebasestorage.googleapis.com/.../imagen2.png"
  ],
  "questionText": "¿Cuál es el resultado de 2 + 2?",
  "questionImages": [
    "https://firebasestorage.googleapis.com/.../pregunta1.jpg"
  ],
  "options": [
    {
      "id": "A",
      "text": "3",
      "imageUrl": null,
      "isCorrect": false
    },
    {
      "id": "B", 
      "text": "4",
      "imageUrl": "https://firebasestorage.googleapis.com/.../opcion_b.jpg",
      "isCorrect": true
    },
    {
      "id": "C",
      "text": "5", 
      "imageUrl": null,
      "isCorrect": false
    },
    {
      "id": "D",
      "text": "6",
      "imageUrl": null,
      "isCorrect": false
    }
  ],
  "createdBy": "user_uid_123",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## 🔍 Componentes Técnicos

### 📦 Nuevos Componentes

1. **ImageGallery**: Componente para mostrar galerías de imágenes con zoom
2. **Configuración CORS**: Script para configurar Firebase Storage

### 🛠️ Servicios Actualizados

1. **QuestionService**: Habilitada subida de imágenes
2. **QuestionBank**: Interfaz mejorada para manejo de imágenes

## 🐛 Solución de Problemas

### ❌ Error: "CORS policy blocks the request"

**Solución**:
1. Ejecutar `npm run configure-storage`
2. Verificar reglas de Firebase Storage
3. Reiniciar el servidor de desarrollo

### ❌ Error: "Permission denied"

**Solución**:
1. Verificar que el usuario tenga rol de administrador
2. Revisar reglas de Firebase Storage
3. Verificar autenticación

### ❌ Error: "File too large"

**Solución**:
- Reducir tamaño de imagen (máximo 5MB)
- Comprimir imágenes antes de subir

## 🎯 Próximas Mejoras

- [ ] Compresión automática de imágenes
- [ ] Redimensionamiento automático
- [ ] Soporte para más formatos (GIF animados)
- [ ] Integración con CDN
- [ ] Lazy loading de imágenes
- [ ] Optimización para móviles

---

**Estado**: ✅ Implementado y funcional  
**Última actualización**: Enero 2024  
**Versión**: 1.0.0
