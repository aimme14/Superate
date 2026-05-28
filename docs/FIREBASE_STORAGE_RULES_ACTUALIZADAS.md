# 🔧 Reglas de Firebase Storage - Configuración para localhost

## 🚨 Problema Identificado

El error de CORS indica que Firebase Storage no está configurado para permitir subidas desde `localhost:5173`. Esto se debe a que las reglas de seguridad están bloqueando las operaciones.

## 📋 Reglas de Storage Necesarias

### 1. **Reglas para Desarrollo (localhost)**

Ve a **Firebase Console** → **Storage** → **Rules** y reemplaza las reglas con:

```javascript
rules_version = '2';

// Reglas para desarrollo y producción
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

### 2. **Reglas Más Permisivas para Desarrollo**

Si las reglas anteriores no funcionan, usa estas reglas más permisivas **SOLO PARA DESARROLLO**:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Reglas permisivas para desarrollo
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🔧 Pasos para Aplicar las Reglas

### Paso 1: Acceder a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `superate-6c730`
3. En el menú lateral, haz clic en **Storage**
4. Haz clic en la pestaña **Rules**

### Paso 2: Actualizar las Reglas
1. **Copia y pega** las reglas de arriba
2. Haz clic en **Publish**
3. Espera a que se apliquen los cambios

### Paso 3: Verificar la Configuración
1. **Recarga tu aplicación** en el navegador
2. **Intenta crear una pregunta** con imagen
3. **Verifica en la consola** que no aparezcan errores de CORS

## 🚨 Configuración Adicional de CORS

Si las reglas no solucionan el problema, necesitas configurar CORS en Firebase Storage:

### Opción 1: Usar Firebase CLI

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Configurar CORS
firebase storage:configure-cors
```

### Opción 2: Configurar CORS Manualmente

Crea un archivo `cors.json`:

```json
[
  {
    "origin": ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "maxAgeSeconds": 3600
  }
]
```

Luego ejecuta:
```bash
gsutil cors set cors.json gs://superate-6c730.firebasestorage.app
```

## 🔍 Verificación del Problema

### 1. **Verificar el Bucket de Storage**
- Ve a Firebase Console → Storage
- Verifica que el bucket sea `superate-6c730.firebasestorage.app`
- Asegúrate de que esté en la región correcta

### 2. **Verificar la Configuración del Proyecto**
- Ve a Firebase Console → Project Settings
- Verifica que la configuración de Storage esté habilitada
- Asegúrate de que el proyecto tenga los permisos correctos

### 3. **Verificar las Variables de Entorno**
En tu archivo `.env`, asegúrate de tener:
```env
VITE_FIREBASE_STORAGE_BUCKET=superate-6c730.firebasestorage.app
```

## 🧪 Pruebas Después de la Configuración

### 1. **Prueba Básica**
```javascript
// En la consola del navegador
const storage = firebase.storage();
const testRef = storage.ref('test/hello.txt');
testRef.putString('Hello World!').then(() => {
  console.log('✅ Storage funciona correctamente');
});
```

### 2. **Prueba de Subida de Imagen**
1. **Recarga la aplicación**
2. **Intenta crear una pregunta** con imagen
3. **Verifica en la consola** que no aparezcan errores de CORS

## 🚨 Solución Temporal

Si necesitas una solución inmediata mientras configuras Storage, puedes modificar el componente para **omitir las imágenes temporalmente**:

```typescript
// En handleCreateQuestion, comentar temporalmente las subidas de imágenes
// const informativeImageUrls: string[] = []
// const questionImageUrls: string[] = []
// const finalOptions: QuestionOption[] = options.map(opt => ({
//   ...opt,
//   imageUrl: null // Temporalmente sin imágenes
// }))
```

## 📞 Información para Soporte

Si el problema persiste, proporciona:

1. **Reglas de Storage actuales** en Firebase Console
2. **Configuración del bucket** (región, permisos)
3. **Variables de entorno** (sin claves secretas)
4. **Logs de la consola** después de aplicar las reglas

## 🎯 Resultado Esperado

Después de aplicar las reglas correctas:

1. ✅ **No más errores de CORS** en la consola
2. ✅ **Subida de imágenes exitosa** a Firebase Storage
3. ✅ **Creación de preguntas completa** con imágenes
4. ✅ **Funcionalidad completa** del banco de preguntas

---

**Última actualización**: Enero 2024  
**Estado**: En proceso 🔧
