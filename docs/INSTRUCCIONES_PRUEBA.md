# Instrucciones de Prueba - Sistema de Usuarios

## Cambios Realizados

### 1. Sistema de Contraseñas ✅
- **Estudiantes**: Contraseña = número de documento + "0" (ejemplo: 1234567890)
- **Docentes**: Contraseña personalizada ingresada por el administrador al crear el usuario
- **Coordinadores**: Contraseña personalizada ingresada por el administrador al crear el usuario

### 2. Páginas de Bienvenida ✅
- **Docentes**: Página de dashboard personalizada mostrando:
  - Nombre del docente
  - Email
  - Grado asignado
  - Lista de estudiantes del grado
  - Estadísticas y métricas

- **Coordinadores**: Página de dashboard personalizada mostrando:
  - Nombre del coordinador
  - Email
  - Institución asignada
  - Estadísticas de toda la institución
  - Información de grados y docentes

### 3. Sistema de Login ✅
- **Todos los usuarios**: NO requieren verificación de email para iniciar sesión
- **Estudiantes, Docentes y Coordinadores**: Pueden ingresar inmediatamente después de ser creados
- La verificación de email es opcional y se envía al crear la cuenta, pero no es un requisito para iniciar sesión

### 4. Logs de Depuración ✅
Se agregaron logs detallados en todo el proceso de creación y login para facilitar la depuración:
- Creación de cuenta en Firebase Auth
- Guardado de datos en Firestore
- Verificación de roles
- Proceso de login

## Pasos para Probar el Sistema

### Paso 1: Crear una Institución (si no existe)
1. Ir al dashboard de administrador
2. Ir a "Gestión de Instituciones"
3. Crear una nueva institución con:
   - Nombre de la institución
   - Al menos una sede
   - Al menos un grado en la sede

### Paso 2: Crear un Docente
1. Ir al dashboard de administrador
2. Ir a "Gestión de Usuarios"
3. Hacer clic en "Nuevo Usuario"
4. Llenar el formulario:
   - **Nombre completo**: Juan Pérez
   - **Correo electrónico**: juan.perez@colegio.edu
   - **Rol**: Docente
   - **Institución**: [Seleccionar institución creada]
   - **Sede**: [Seleccionar sede]
   - **Grado**: [Seleccionar grado]
   - **Contraseña**: Docente123
   - **Confirmar contraseña**: Docente123
5. Hacer clic en "Crear Usuario"
6. **Revisar la consola del navegador** para ver los logs de creación

### Paso 3: Crear un Coordinador
1. En "Gestión de Usuarios"
2. Hacer clic en "Nuevo Usuario"
3. Llenar el formulario:
   - **Nombre completo**: María García
   - **Correo electrónico**: maria.garcia@colegio.edu
   - **Rol**: Coordinador
   - **Institución**: [Seleccionar institución]
   - **Sede**: [Seleccionar sede]
   - **Contraseña**: Coordinador123
   - **Confirmar contraseña**: Coordinador123
4. Hacer clic en "Crear Usuario"
5. **Revisar la consola del navegador** para ver los logs de creación

### Paso 4: Probar Login de Docente
1. Cerrar sesión del administrador
2. Ir a la página de login
3. Ingresar credenciales:
   - **Email**: juan.perez@colegio.edu
   - **Contraseña**: Docente123
4. Hacer clic en "Iniciar Sesión"
5. **Revisar la consola del navegador** para ver los logs de login
6. Deberías ser redirigido a `/dashboard/teacher`
7. Verificar que se muestre:
   - Mensaje de bienvenida con el nombre del docente
   - Email del docente
   - Grado asignado
   - Rol: Docente

### Paso 5: Probar Login de Coordinador
1. Cerrar sesión del docente
2. Ir a la página de login
3. Ingresar credenciales:
   - **Email**: maria.garcia@colegio.edu
   - **Contraseña**: Coordinador123
4. Hacer clic en "Iniciar Sesión"
5. **Revisar la consola del navegador** para ver los logs de login
6. Deberías ser redirigido a `/dashboard/principal`
7. Verificar que se muestre:
   - Mensaje de bienvenida con el nombre del coordinador
   - Email del coordinador
   - Institución asignada
   - Rol: Coordinador

## Qué Revisar en la Consola

### Durante la Creación de Usuario
Deberías ver logs como:
```
🚀 Iniciando creación de docente con datos: {name: "...", email: "...", ...}
🔐 Contraseña generada para docente (longitud): 10
📝 Creando cuenta en Firebase Auth...
✅ Cuenta creada en Firebase Auth con UID: abc123...
👨‍🏫 Datos del docente a guardar en Firestore: {role: "teacher", ...}
🎯 Rol del docente: teacher
✅ Usuario docente creado en Firestore con datos completos
📊 Agregando docente a la estructura jerárquica de grados...
✅ Docente agregado a la estructura jerárquica de grados
ℹ️ Docentes no requieren verificación de email
🎉 Docente creado exitosamente. Puede hacer login inmediatamente.
```

### Durante el Login
Deberías ver logs como:
```
🔐 Intentando login para: juan.perez@colegio.edu
✅ Login de Firebase Auth exitoso para UID: abc123...
🔍 Buscando usuario con UID: abc123...
✅ Usuario encontrado: {name: "...", email: "...", role: "teacher"}
👤 Rol del usuario encontrado: teacher
✅ Login completado exitosamente
```

### En el Dashboard
Deberías ver logs como:
```
👨‍🏫 Usuario docente en dashboard: {uid: "...", displayName: "...", role: "teacher"}
🎯 Rol del usuario: teacher
```

## Solución de Problemas

### Si el Login No Funciona
1. **Verificar en Firebase Console**:
   - Ir a Authentication -> Users
   - Verificar que el usuario existe
   - Verificar el email

2. **Verificar en Firestore Console**:
   - Ir a Database -> superate -> auth -> users
   - Buscar el documento con el UID del usuario
   - Verificar que tenga el campo `role` con el valor correcto ("teacher" o "principal")

3. **Revisar la Consola del Navegador**:
   - Buscar errores en rojo
   - Buscar los logs con emojis (🚀, ✅, ❌, etc.)
   - Si hay un error, copiar el mensaje completo

### Si No Se Crea el Usuario
1. **Verificar que todos los campos estén llenos**:
   - Nombre completo
   - Email
   - Institución
   - Sede
   - Grado (para docentes)
   - Contraseña (mínimo 6 caracteres)

2. **Revisar la consola del navegador** para ver el error específico

3. **Verificar que la institución, sede y grado existan**

## Estructura de Datos en Firestore

### Colección `users`
```json
{
  "uid": "abc123...",
  "role": "teacher", // o "principal"
  "name": "Juan Pérez",
  "email": "juan.perez@colegio.edu",
  "institutionId": "inst-123",
  "campusId": "campus-456",
  "gradeId": "grade-789", // solo para docentes
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "createdBy": "admin"
}
```

### Estructura Jerárquica en `institutions`
Los docentes se almacenan en:
```
institutions/{institutionId}/campuses/{campusId}/grades/{gradeId}/teachers[]
```

Los coordinadores se almacenan en:
```
institutions/{institutionId}/campuses/{campusId}/principal{}
```

## Notas Importantes

1. **Los docentes y coordinadores NO necesitan verificar su email** - Pueden hacer login inmediatamente después de ser creados.

2. **Los estudiantes SÍ necesitan verificar su email** - Deben revisar su correo y hacer clic en el enlace de verificación.

3. **Las contraseñas de docentes y coordinadores** son las que el administrador ingresa al crearlos. Si no se ingresa una contraseña, se genera automáticamente usando el formato: `nombre.toLowerCase().replace(/\s+/g, '') + '123'`

4. **La contraseña de estudiantes** siempre es: `documento + '0'`

5. **Los logs en la consola** son tu mejor amigo para depurar problemas. Siempre revisa la consola del navegador.

## Siguiente Paso

Una vez que hayas probado y confirmado que todo funciona correctamente, puedes comenzar a trabajar en las funcionalidades específicas de cada rol (creación de exámenes, gestión de estudiantes, etc.).

