# 🔧 Solución al Error "Usuario no autenticado"

## 🚨 Problema Identificado

El error **"Usuario no autenticado"** aparece cuando intentas crear preguntas en el banco de preguntas. Este problema se debe a que el sistema no puede verificar que el usuario esté autenticado correctamente o que tenga el rol de administrador.

## 🔍 Diagnóstico Realizado

He agregado código de debug al componente `QuestionBank.tsx` para identificar la causa exacta:

1. **Verificación del contexto de autenticación**
2. **Debug del estado del usuario**
3. **Validación del rol de administrador**

## 🛠️ Cambios Realizados

### 1. Corrección del Contexto de Autenticación

**Archivo**: `src/components/admin/QuestionBank.tsx`

```typescript
// ANTES (incorrecto):
const { currentUser } = useAuthContext()

// DESPUÉS (correcto):
const { user: currentUser } = useAuthContext()
```

### 2. Validación de Rol de Administrador

Se agregó validación adicional para verificar que el usuario tenga rol de administrador:

```typescript
// Verificar que el usuario tenga rol de administrador
if (currentUser.role !== 'admin') {
  notifyError({ 
    title: 'Error', 
    message: 'No tienes permisos para crear preguntas. Solo los administradores pueden realizar esta acción.' 
  })
  return
}
```

### 3. Información de Debug

Se agregó información de debug en la interfaz para verificar el estado de autenticación:

- **Usuario**: Email del usuario autenticado
- **Rol**: Rol del usuario (debe ser 'admin')
- **UID**: Identificador único del usuario

## 📋 Pasos para Solucionar

### Paso 1: Verificar el Estado de Autenticación

1. **Recarga la página** del banco de preguntas
2. **Observa la información de debug** en la parte superior derecha
3. **Verifica que aparezca**:
   - ✅ Usuario: [tu email]
   - ✅ Rol: admin
   - ✅ UID: [tu uid]

### Paso 2: Si No Aparece Información de Usuario

Si ves "No autenticado" en la información de debug:

1. **Cierra sesión** y vuelve a iniciar sesión
2. **Asegúrate de iniciar sesión como administrador**
3. **Verifica que tu usuario tenga el rol 'admin' en Firestore**

### Paso 3: Si Aparece Usuario pero Sin Rol

Si ves tu email pero el rol es "Sin rol" o no es "admin":

1. **Verifica en Firestore** que tu usuario tenga el campo `role: 'admin'`
2. **Ruta en Firestore**: `superate/auth/users/[tu-uid]`
3. **Asegúrate de que el documento contenga**:
   ```json
   {
     "role": "admin",
     "email": "tu@email.com",
     "name": "Tu Nombre"
   }
   ```

### Paso 4: Verificar en la Consola del Navegador

1. **Abre las herramientas de desarrollador** (F12)
2. **Ve a la pestaña Console**
3. **Busca los mensajes de debug** que comienzan con 🔍:
   - `🔍 Estado de autenticación en QuestionBank:`
   - `🔍 Usuario autenticado:`

## 🔧 Soluciones Adicionales

### Opción 1: Crear Usuario Administrador

Si no tienes un usuario administrador, puedes crear uno usando el script existente:

```typescript
// En src/scripts/createAdmin.ts
import { createAdminUser } from '@/utils/createAdminUser'

// Ejecutar en la consola del navegador o crear un script
const adminData = {
  email: 'admin@superate.com',
  password: 'admin123',
  name: 'Administrador',
  role: 'admin'
}

await createAdminUser(adminData)
```

### Opción 2: Actualizar Rol de Usuario Existente

Si ya tienes un usuario pero no tiene rol de administrador:

1. **Ve a Firestore Console**
2. **Navega a**: `superate/auth/users/[tu-uid]`
3. **Edita el documento** y agrega:
   ```json
   {
     "role": "admin"
   }
   ```

### Opción 3: Verificar Configuración de Firebase

Asegúrate de que tu configuración de Firebase esté correcta:

1. **Verifica las variables de entorno** en `.env`:
   ```env
   VITE_FIREBASE_API_KEY=tu_api_key
   VITE_FIREBASE_PROJECT_ID=tu_project_id
   VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
   VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
   VITE_FIREBASE_APP_ID=tu_app_id
   ```

2. **Verifica las reglas de seguridad** de Firestore (ver `FIREBASE_SECURITY_RULES.md`)

## 🧪 Pruebas

Una vez solucionado el problema, deberías poder:

1. ✅ **Ver la información de debug** con tu usuario y rol 'admin'
2. ✅ **Hacer clic en "Nueva Pregunta"** sin que aparezca el error
3. ✅ **Crear preguntas** exitosamente
4. ✅ **Ver el mensaje de éxito** con el código de la pregunta generado

## 🚨 Si el Problema Persiste

Si después de seguir estos pasos el problema persiste:

1. **Revisa la consola del navegador** para errores adicionales
2. **Verifica la conexión a Firebase**
3. **Comprueba las reglas de seguridad** de Firestore
4. **Contacta al equipo de desarrollo** con la información de debug

## 📞 Información de Debug a Proporcionar

Si necesitas ayuda adicional, proporciona:

1. **Información de debug** que aparece en la interfaz
2. **Mensajes de la consola** del navegador
3. **Estructura de tu documento de usuario** en Firestore
4. **Configuración de Firebase** (sin las claves secretas)

---

**Última actualización**: Enero 2024  
**Estado**: Solucionado ✅
