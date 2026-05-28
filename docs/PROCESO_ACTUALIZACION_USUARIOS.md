# 🔄 Proceso Completo de Actualización de Datos de Usuarios

## 📋 Resumen Ejecutivo

Este documento explica paso a paso cómo funciona el sistema cuando un administrador intenta actualizar los datos de un usuario (estudiante, docente, coordinador, rector) desde la interfaz de administración.

---

## 🎯 Flujo Completo del Proceso

### **FASE 1: Interfaz de Usuario (Componente React)**

**Archivo:** `src/components/admin/UserManagement.tsx`

#### 1.1. Usuario Completa el Formulario
- El administrador abre el modal "Actualizar Estudiante"
- Completa o modifica los campos del formulario:
  - Nombre, Email
  - Institución, Sede, Grado
  - Año académico, Jornada
  - Teléfono del representante
  - Estado activo/inactivo

#### 1.2. Validación en el Cliente
```typescript
// Validaciones básicas antes de enviar
if (!selectedStudent || !editStudentData.name || !editStudentData.email) {
  notifyError({ title: 'Error', message: 'Nombre y email son obligatorios' })
  return
}

if (!editStudentData.institution || !editStudentData.campus || !editStudentData.grade) {
  notifyError({ title: 'Error', message: 'Institución, sede y grado son obligatorios' })
  return
}

if (!editStudentData.academicYear || editStudentData.academicYear.toString().length !== 4) {
  notifyError({ title: 'Error', message: 'El año académico es obligatorio y debe tener 4 dígitos' })
  return
}
```

#### 1.3. Preparación del Payload
```typescript
// Construcción explícita del objeto de actualización
const updatePayload: any = {
  name: editStudentData.name,
  email: editStudentData.email,
  isActive: editStudentData.isActive,
  institutionId: editStudentData.institution,
  campusId: editStudentData.campus,
  gradeId: editStudentData.grade,
  academicYear: editStudentData.academicYear
}

// Campos opcionales se agregan solo si tienen valor
if (editStudentData.representativePhone !== undefined) {
  updatePayload.representativePhone = editStudentData.representativePhone
}
// ... más campos opcionales
```

**Log:** `📤 Componente: Enviando datos de actualización: {...}`

---

### **FASE 2: Hook de Mutación (React Query)**

**Archivo:** `src/hooks/query/useStudentQuery.ts`

#### 2.1. Llamada a la Mutación
```typescript
await updateStudent.mutateAsync({
  studentId: selectedStudent.id,
  studentData: updatePayload
})
```

#### 2.2. React Query Gestiona el Estado
- Maneja el estado de carga (`isLoading`)
- Gestiona errores automáticamente
- Invalida caché después de actualización exitosa
- Actualiza la UI automáticamente

---

### **FASE 3: Controlador (Lógica de Negocio)**

**Archivo:** `src/controllers/student.controller.ts`

#### 3.1. Obtener Datos Actuales del Usuario
```typescript
const studentResult = await dbService.getUserById(studentId)
const currentStudent = studentResult.data
const oldEmail = currentStudent.email
const oldName = currentStudent.name
```

**Propósito:** Necesitamos los datos actuales para:
- Comparar cambios (email, nombre)
- Validar asignaciones si cambió institución/sede/grado
- Reasignar al estudiante si cambió de ubicación

#### 3.2. Preparar Datos para Firestore
```typescript
const updateData: any = {}
// Usar !== undefined para permitir valores falsy válidos (0, '', false)
if (studentData.name !== undefined) updateData.name = studentData.name
if (studentData.email !== undefined) updateData.email = studentData.email
if (studentData.institutionId !== undefined) updateData.inst = studentData.institutionId
if (studentData.campusId !== undefined) updateData.campus = studentData.campusId
if (studentData.gradeId !== undefined) updateData.grade = studentData.gradeId
// ... más campos
```

**Nota Importante:** 
- Se usa `!== undefined` en lugar de truthiness checks
- Esto permite actualizar valores falsy válidos como `0`, `''`, `false`
- Se mapean campos: `institutionId` → `inst`, `campusId` → `campus`, etc.

**Log:** `📤 Controlador: Datos preparados para actualizar: [...]`
**Log:** `📤 Controlador: Valores: {...}`

#### 3.3. Reasignación si Cambió Ubicación
```typescript
if (studentData.institutionId || studentData.campusId || studentData.gradeId) {
  // Remover de asignaciones anteriores
  await removeStudentFromAllAssignments(studentId)
  
  // Asignar a nuevas ubicaciones
  await assignStudentToTeachers(studentId, newInstitutionId, newCampusId, newGradeId)
  await assignStudentToPrincipal(studentId, newInstitutionId, newCampusId)
  await assignStudentToRector(studentId, newInstitutionId)
}
```

**Propósito:** Si el estudiante cambió de institución, sede o grado, debe ser:
- Removido de docentes/coordinador/rector anteriores
- Asignado a los nuevos docentes/coordinador/rector

---

### **FASE 4: Servicio de Base de Datos**

**Archivo:** `src/services/firebase/db.service.ts`

#### 4.1. Validación Inicial
```typescript
// Validar que el ID sea válido
if (!id || typeof id !== 'string' || id.trim() === '') {
  return failure(new ErrorAPI({ 
    message: 'ID de usuario inválido', 
    statusCode: 400 
  }))
}
```

**Log:** `🔄 Iniciando actualización de usuario: {id}`
**Log:** `📊 Datos recibidos para actualizar (antes de limpiar): [...]`
**Log:** `📊 Valores recibidos: {...}`

#### 4.2. Limpieza Profunda de Datos (`deepCleanData`)

**Propósito:** Preparar los datos para Firebase eliminando valores problemáticos.

```typescript
private deepCleanData(obj: any, depth: number = 0, excludeFields: string[] = ['role', 'uid', 'id', 'createdAt']): any
```

**Proceso:**
1. **Protección contra recursión infinita** (máximo 10 niveles)
2. **Manejo de null/undefined:** Se filtran valores `null` y `undefined`
3. **Manejo de arrays:** Limpia cada elemento recursivamente
4. **Manejo de objetos:**
   - Excluye campos protegidos en nivel raíz: `role`, `uid`, `id`, `createdAt`
   - Preserva nombres originales de claves (no capitaliza)
   - Permite valores falsy válidos: `0`, `''`, `false`
5. **Manejo de fechas:** Convierte `Date` a string ISO (`YYYY-MM-DD`)
6. **Valores primitivos:** Se retornan tal cual

**Ejemplo:**
```typescript
// Entrada:
{
  name: "Juan Pérez",
  email: "juan@example.com",
  role: "student",        // ← Se excluye (campo protegido)
  id: "abc123",          // ← Se excluye (campo protegido)
  academicYear: 2026,
  representativePhone: "3152940212",
  undefinedField: undefined,  // ← Se filtra
  nullField: null              // ← Se filtra
}

// Salida:
{
  name: "Juan Pérez",
  email: "juan@example.com",
  academicYear: 2026,
  representativePhone: "3152940212"
}
```

**Log:** `📋 Campos después de limpiar: [...]`
**Log:** `📊 Valores después de limpiar: {...}`
**Log:** `📊 Total de campos a actualizar: {número}`

#### 4.3. Validación de Datos
```typescript
// Validar que haya datos para actualizar
if (!cleanedData || Object.keys(cleanedData).length === 0) {
  console.warn('⚠️ No hay datos válidos para actualizar después de limpiar')
  return failure(new ErrorAPI({ 
    message: 'No se proporcionaron datos válidos para actualizar', 
    statusCode: 400 
  }))
}
```

#### 4.4. Agregar Timestamp de Actualización
```typescript
// Asegurar que updatedAt esté presente SIEMPRE
cleanedData.updatedAt = new Date().toISOString().split('T')[0]
```

#### 4.5. Validación de Institución Activa (Solo para Estudiantes)
```typescript
// Si se está activando un estudiante, verificar que su institución esté activa
if (cleanedData.isActive === true) {
  const currentUser = await this.getUserById(id)
  if (currentUser.role === 'student' && currentIsActive === false) {
    const institution = await this.getInstitutionById(institutionId)
    if (institution.isActive === false) {
      return failure(new ErrorAPI({ 
        message: 'No se puede activar un estudiante de una institución inactiva', 
        statusCode: 400 
      }))
    }
  }
}
```

#### 4.6. Ejecución con Reintentos (`executeUpdateWithRetry`)

**Propósito:** Manejar errores temporales de red con reintentos automáticos.

```typescript
private async executeUpdateWithRetry<T>(
  updateFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<Result<T>>
```

**Proceso:**
1. **Intento 1:** Ejecuta la actualización
2. **Si falla:**
   - Verifica el tipo de error
   - **Errores NO recuperables** (no reintenta):
     - `permission-denied`: Sin permisos
     - `not-found`: Usuario no existe
     - `unauthenticated`: No autenticado
   - **Errores recuperables** (reintenta):
     - Errores de red
     - Timeouts
     - Errores temporales de Firebase
3. **Backoff exponencial:** Espera antes de reintentar
   - Intento 2: 1 segundo
   - Intento 3: 2 segundos
   - Intento 4: 4 segundos (máximo 5 segundos)
4. **Logs:** Registra cada intento y resultado

**Logs:**
- `⚠️ Error en intento 1/3, reintentando en 1000ms...`
- `✅ Actualización exitosa en el intento 2`

#### 4.7. Actualización en Firestore
```typescript
const document = doc(this.getCollection('users'), String(id))
await updateDoc(document, cleanedData)
```

**Ruta del documento:** `superate/auth/users/{userId}`

**Log:** `✅ Usuario actualizado exitosamente en Firebase`

---

### **FASE 5: Firebase Firestore**

#### 5.1. Validación de Reglas de Seguridad

**Archivo:** `firestore.rules`

```javascript
match /superate/auth/users/{userId} {
  // Solo admins activos pueden actualizar usuarios
  allow update: if isAdmin() &&
    (request.resource.data.isActive == true || request.resource.data.isActive == false);
}
```

**Validaciones:**
- Usuario debe estar autenticado
- Usuario debe estar activo
- Institución del usuario debe estar activa
- Usuario debe tener rol `admin`
- Solo se puede cambiar `isActive` si es admin

#### 5.2. Escritura en la Base de Datos
- Firebase valida las reglas
- Si pasa la validación, escribe los datos
- Actualiza el documento en tiempo real
- Propaga cambios a todos los clientes conectados

---

### **FASE 6: Respuesta y Actualización de UI**

#### 6.1. Respuesta del Servicio
```typescript
return success(undefined)  // Éxito
// o
return failure(new ErrorAPI({ ... }))  // Error
```

#### 6.2. React Query Actualiza el Estado
- Marca la mutación como exitosa
- Invalida las queries relacionadas
- Refresca automáticamente los datos en la UI

#### 6.3. Notificación al Usuario
```typescript
notifySuccess({ title: 'Éxito', message: 'Estudiante actualizado correctamente' })
// o
notifyError({ title: 'Error', message: 'Error al actualizar el estudiante' })
```

#### 6.4. Cierre del Modal
```typescript
setIsEditDialogOpen(false)
setSelectedStudent(null)
setEditStudentData({ ... })  // Resetear formulario
```

---

## 🔍 Puntos Críticos del Proceso

### ✅ **Validaciones en Cada Fase**

1. **Componente:** Validación de campos obligatorios
2. **Controlador:** Validación de datos y reasignaciones
3. **Servicio:** Validación de ID, datos limpios, institución activa
4. **Firebase:** Validación de reglas de seguridad

### 🧹 **Limpieza de Datos**

- **Problema:** Firebase no acepta `undefined` en documentos
- **Solución:** `deepCleanData` elimina todos los `undefined` y `null`
- **Resultado:** Solo se envían campos con valores válidos

### 🔄 **Reintentos Automáticos**

- **Problema:** Errores temporales de red pueden fallar actualizaciones
- **Solución:** Reintentos con backoff exponencial
- **Resultado:** Mayor confiabilidad en actualizaciones

### 📊 **Mapeo de Campos**

- **Componente → Controlador:** `institutionId`, `campusId`, `gradeId`
- **Controlador → Firestore:** `inst`, `campus`, `grade`
- **Razón:** Compatibilidad con estructura existente en Firestore

---

## 🐛 Problemas Comunes y Soluciones

### **Problema 1: Solo se actualiza `lastActivity` y `updatedAt`**

**Causa:** El hook `useUserActivity` actualiza `lastActivity` automáticamente, y los datos del formulario no se están pasando correctamente.

**Solución Implementada:**
- Cambio de `if (field)` a `if (field !== undefined)` en el controlador
- Construcción explícita del payload en el componente
- Logging detallado en cada fase

### **Problema 2: Campos con valores falsy no se actualizan**

**Causa:** Uso de truthiness checks que filtran `0`, `''`, `false`.

**Solución Implementada:**
- Uso de `!== undefined` en lugar de truthiness checks
- Preservación de valores falsy válidos en `deepCleanData`

### **Problema 3: Errores temporales de red**

**Causa:** Conexión inestable o timeout de Firebase.

**Solución Implementada:**
- Sistema de reintentos con backoff exponencial
- Manejo diferenciado de errores recuperables vs no recuperables

---

## 📝 Logs del Proceso

Cuando actualizas un usuario, verás estos logs en la consola:

```
📤 Componente: Enviando datos de actualización: {name, email, ...}
📤 Controlador: Datos preparados para actualizar: ['name', 'email', ...]
📤 Controlador: Valores: {name: "...", email: "...", ...}
🔄 Iniciando actualización de usuario: abc123
📊 Datos recibidos para actualizar (antes de limpiar): ['name', 'email', ...]
📊 Valores recibidos: {name: "...", email: "...", ...}
📋 Campos después de limpiar: ['name', 'email', ...]
📊 Valores después de limpiar: {name: "...", email: "...", ...}
📊 Total de campos a actualizar: 8
✅ Usuario actualizado exitosamente en Firebase
```

---

## 🎯 Resumen del Flujo

```
Usuario completa formulario
    ↓
Validación en componente
    ↓
Preparación del payload
    ↓
Hook de mutación (React Query)
    ↓
Controlador (lógica de negocio)
    ↓
Obtener datos actuales
    ↓
Preparar datos para Firestore
    ↓
Reasignar si cambió ubicación
    ↓
Servicio de base de datos
    ↓
Validar ID
    ↓
Limpiar datos (deepCleanData)
    ↓
Validar datos limpios
    ↓
Agregar timestamp
    ↓
Validar institución activa
    ↓
Ejecutar con reintentos
    ↓
Actualizar en Firestore
    ↓
Firebase valida reglas
    ↓
Escribir en base de datos
    ↓
Respuesta exitosa
    ↓
React Query actualiza UI
    ↓
Notificación al usuario
    ↓
Cerrar modal
```

---

**Fecha de creación:** 2026-01-06
**Última actualización:** 2026-01-06
**Versión:** 1.0


