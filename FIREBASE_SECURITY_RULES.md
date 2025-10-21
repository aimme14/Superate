# 🔒 Reglas de Seguridad de Firebase - Sistema de Banco de Preguntas

Este documento contiene las reglas de seguridad completas para el sistema de banco de preguntas.

## Firestore Security Rules

Copia estas reglas en tu archivo `firestore.rules` en la consola de Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función auxiliar para verificar si el usuario está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Función auxiliar para verificar si el usuario es administrador
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Función auxiliar para verificar si el usuario es docente
    function isTeacher() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'teacher';
    }
    
    // Función auxiliar para verificar si el usuario es coordinador
    function isPrincipal() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'principal';
    }
    
    // Función auxiliar para verificar si el usuario es rector
    function isRector() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'rector';
    }
    
    // Función para verificar si el usuario puede crear preguntas
    function canCreateQuestions() {
      return isAdmin() || isTeacher() || isPrincipal() || isRector();
    }
    
    // Colección de preguntas
    match /superate/auth/questions/{questionId} {
      // Lectura: Todos los usuarios autenticados pueden leer preguntas
      allow read: if isAuthenticated();
      
      // Creación: Solo usuarios autorizados pueden crear preguntas
      allow create: if canCreateQuestions() && 
        request.resource.data.keys().hasAll([
          'code', 'subject', 'subjectCode', 'topic', 'topicCode',
          'grade', 'level', 'levelCode', 'questionText', 'answerType',
          'options', 'createdBy', 'createdAt'
        ]) &&
        request.resource.data.answerType == 'MCQ' &&
        request.resource.data.options.size() == 4 &&
        request.resource.data.createdBy == request.auth.uid &&
        // Validar que exactamente una opción sea correcta
        request.resource.data.options.toSet().hasAny([
          ['isCorrect', true]
        ]);
      
      // Actualización: Solo el creador o un admin pueden actualizar
      allow update: if (isAdmin() || 
        resource.data.createdBy == request.auth.uid) &&
        // No permitir cambiar el código o el creador
        request.resource.data.code == resource.data.code &&
        request.resource.data.createdBy == resource.data.createdBy;
      
      // Eliminación: Solo administradores pueden eliminar
      allow delete: if isAdmin();
    }
    
    // Colección de contadores para códigos únicos
    match /superate/auth/counters/{counterId} {
      // Solo usuarios autorizados pueden acceder a contadores
      allow read: if canCreateQuestions();
      
      // Solo usuarios autorizados pueden incrementar contadores
      allow write: if canCreateQuestions();
    }
    
    // Colección de usuarios
    match /superate/auth/users/{userId} {
      // Los usuarios pueden leer su propia información
      allow read: if isAuthenticated() && request.auth.uid == userId;
      
      // Solo admins pueden leer información de otros usuarios
      allow read: if isAdmin();
      
      // Los usuarios pueden actualizar su propia información (campos limitados)
      allow update: if isAuthenticated() && 
        request.auth.uid == userId &&
        // No permitir cambiar el rol
        request.resource.data.role == resource.data.role;
      
      // Solo admins pueden crear o eliminar usuarios
      allow create, delete: if isAdmin();
    }
    
    // Colección de instituciones
    match /superate/auth/institutions/{institutionId} {
      // Todos los usuarios autenticados pueden leer instituciones
      allow read: if isAuthenticated();
      
      // Solo admins pueden crear, actualizar o eliminar instituciones
      allow create, update, delete: if isAdmin();
    }
    
    // Regla por defecto: denegar acceso a todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Firebase Storage Rules

Copia estas reglas en tu archivo `storage.rules` en la consola de Firebase:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Función auxiliar para verificar autenticación
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Función auxiliar para verificar si el usuario es administrador
    function isAdmin() {
      return isAuthenticated() && 
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Función auxiliar para verificar si el usuario puede subir preguntas
    function canUploadQuestions() {
      return isAuthenticated() && (
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin' ||
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'teacher' ||
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'principal' ||
        firestore.get(/databases/(default)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'rector'
      );
    }
    
    // Función para validar imágenes
    function isValidImage() {
      return request.resource.size < 5 * 1024 * 1024 && // 5MB máximo
             request.resource.contentType.matches('image/.*');
    }
    
    // Carpeta de preguntas
    match /questions/{allPaths=**} {
      // Lectura: Todos los usuarios autenticados pueden ver imágenes
      allow read: if isAuthenticated();
      
      // Escritura: Solo usuarios autorizados pueden subir imágenes
      allow write: if canUploadQuestions() && isValidImage();
      
      // Eliminación: Solo administradores pueden eliminar imágenes
      allow delete: if isAdmin();
    }
    
    // Carpeta específica de imágenes informativas
    match /questions/informative/{imageId} {
      allow read: if isAuthenticated();
      allow write: if canUploadQuestions() && isValidImage();
      allow delete: if isAdmin();
    }
    
    // Carpeta específica de imágenes de preguntas
    match /questions/question/{imageId} {
      allow read: if isAuthenticated();
      allow write: if canUploadQuestions() && isValidImage();
      allow delete: if isAdmin();
    }
    
    // Carpeta específica de imágenes de opciones
    match /questions/options/{imageId} {
      allow read: if isAuthenticated();
      allow write: if canUploadQuestions() && isValidImage();
      allow delete: if isAdmin();
    }
    
    // Regla por defecto: denegar acceso a todo lo demás
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Explicación de las Reglas

### Firestore

#### 1. Funciones Auxiliares

Las funciones auxiliares (`isAdmin()`, `isTeacher()`, etc.) facilitan la verificación de roles de usuario en las reglas.

#### 2. Reglas de Preguntas

- **Lectura**: Cualquier usuario autenticado puede leer preguntas
- **Creación**: Solo usuarios con permisos (admin, teacher, principal, rector) pueden crear preguntas
  - Se valida que todos los campos requeridos estén presentes
  - Se valida que haya exactamente 4 opciones
  - Se valida que el creador sea el usuario autenticado
- **Actualización**: Solo el creador o un administrador pueden actualizar
  - No se permite cambiar el código o el creador
- **Eliminación**: Solo administradores pueden eliminar

#### 3. Reglas de Contadores

Los contadores son críticos para la generación de códigos únicos:
- Solo usuarios autorizados pueden leer y escribir contadores
- Esto previene que usuarios no autorizados manipulen las secuencias

### Storage

#### 1. Validación de Imágenes

La función `isValidImage()` valida:
- **Tamaño máximo**: 5MB
- **Tipo de contenido**: Solo imágenes (image/*)

#### 2. Estructura de Carpetas

```
questions/
  ├── informative/     # Imágenes de texto informativo
  ├── question/        # Imágenes de preguntas
  └── options/         # Imágenes de opciones
```

#### 3. Permisos por Carpeta

- **Lectura**: Todos los usuarios autenticados
- **Escritura**: Solo usuarios autorizados con validación de imagen
- **Eliminación**: Solo administradores

## Pruebas de Seguridad

### Probar Reglas de Firestore

Usa el simulador de reglas en la consola de Firebase:

```javascript
// Test 1: Usuario autenticado puede leer preguntas
// Ubicación: /superate/auth/questions/test123
// Tipo: get
// Auth: { uid: 'test-user-id' }
// Resultado esperado: Permitido

// Test 2: Usuario no autenticado no puede leer
// Ubicación: /superate/auth/questions/test123
// Tipo: get
// Auth: null
// Resultado esperado: Denegado

// Test 3: Admin puede crear pregunta
// Ubicación: /superate/auth/questions/new-question
// Tipo: create
// Auth: { uid: 'admin-user-id' }
// Data: { code: 'TEST001', ..., createdBy: 'admin-user-id' }
// Resultado esperado: Permitido

// Test 4: Usuario regular no puede crear pregunta
// Ubicación: /superate/auth/questions/new-question
// Tipo: create
// Auth: { uid: 'regular-user-id' }
// Resultado esperado: Denegado
```

### Probar Reglas de Storage

```javascript
// Test 1: Usuario autenticado puede leer imagen
// Ruta: /questions/question/test.jpg
// Tipo: read
// Auth: { uid: 'test-user-id' }
// Resultado esperado: Permitido

// Test 2: Usuario autorizado puede subir imagen válida
// Ruta: /questions/question/new-image.jpg
// Tipo: write
// Auth: { uid: 'teacher-id' }
// Resource: { size: 2MB, contentType: 'image/jpeg' }
// Resultado esperado: Permitido

// Test 3: Usuario no puede subir archivo demasiado grande
// Ruta: /questions/question/large-image.jpg
// Tipo: write
// Auth: { uid: 'teacher-id' }
// Resource: { size: 10MB, contentType: 'image/jpeg' }
// Resultado esperado: Denegado

// Test 4: Usuario no puede subir archivo no-imagen
// Ruta: /questions/question/document.pdf
// Tipo: write
// Auth: { uid: 'teacher-id' }
// Resource: { size: 1MB, contentType: 'application/pdf' }
// Resultado esperado: Denegado
```

## Actualización de Reglas

### Pasos para Actualizar

1. **Backup de reglas actuales**
   ```bash
   firebase firestore:rules:get > firestore.rules.backup
   firebase storage:rules:get > storage.rules.backup
   ```

2. **Crear archivos locales**
   ```bash
   # firestore.rules
   # Pegar las reglas de Firestore aquí
   
   # storage.rules
   # Pegar las reglas de Storage aquí
   ```

3. **Desplegar reglas**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```

4. **Verificar en la consola**
   - Ve a Firebase Console
   - Verifica que las reglas se hayan actualizado correctamente

## Mejores Prácticas

### 1. Nunca Confíes en el Cliente

Las reglas de seguridad son la última línea de defensa. Siempre valida en el servidor (reglas de Firebase).

### 2. Principio de Menor Privilegio

Da solo los permisos necesarios. Si un usuario no necesita eliminar, no le des permisos de eliminación.

### 3. Valida Todos los Campos

Asegúrate de validar:
- Tipos de datos
- Tamaños de archivos
- Contenido de campos
- Relaciones entre documentos

### 4. Usa Funciones Auxiliares

Las funciones auxiliares hacen el código más legible y mantenible.

### 5. Prueba Exhaustivamente

Prueba todos los casos:
- Usuario autenticado vs no autenticado
- Diferentes roles
- Diferentes operaciones (read, write, update, delete)
- Casos límite (archivos grandes, datos inválidos)

### 6. Monitorea el Uso

Revisa regularmente:
- Logs de seguridad en Firebase Console
- Intentos de acceso denegados
- Patrones de uso anormales

## Troubleshooting de Seguridad

### Error: "Missing or insufficient permissions"

**Causa:** El usuario no tiene permisos para la operación.

**Soluciones:**
1. Verifica que el usuario esté autenticado
2. Verifica que el usuario tenga el rol correcto
3. Revisa las reglas de seguridad
4. Usa el simulador de reglas para depurar

### Error: "Permission denied: Resource validation failed"

**Causa:** Los datos enviados no cumplen las validaciones de las reglas.

**Soluciones:**
1. Verifica que todos los campos requeridos estén presentes
2. Verifica que los tipos de datos sean correctos
3. Revisa las validaciones personalizadas en las reglas

### Las imágenes no se suben

**Posibles causas:**
1. Archivo demasiado grande (>5MB)
2. Tipo de archivo no válido
3. Usuario no tiene permisos
4. Ruta incorrecta

**Soluciones:**
1. Comprime la imagen
2. Verifica que sea una imagen válida (JPEG, PNG, WEBP)
3. Verifica el rol del usuario
4. Verifica la ruta de destino

## Contacto y Soporte

Para problemas de seguridad críticos, contacta inmediatamente al equipo de desarrollo.

---

**Última actualización:** Enero 2024  
**Versión:** 1.0.0

