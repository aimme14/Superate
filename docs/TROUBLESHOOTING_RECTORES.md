# Guía de Troubleshooting - Creación de Rectores

## Problemas Comunes y Soluciones

### 1. Error: "El email ya está en uso"

**Síntomas:**
- Error al intentar crear un rector
- Mensaje: "auth/email-already-in-use"

**Soluciones:**
1. Verificar que el email no esté siendo usado por otro usuario
2. Usar un email diferente
3. Si es necesario, eliminar el usuario existente primero

### 2. Error: "La contraseña es demasiado débil"

**Síntomas:**
- Error al crear usuario en Firebase Auth
- Mensaje: "auth/weak-password"

**Soluciones:**
1. Asegurar que la contraseña tenga al menos 6 caracteres
2. Incluir números y letras
3. Evitar contraseñas comunes como "123456"

### 3. Error: "Formato de email inválido"

**Síntomas:**
- Validación fallida antes de enviar a Firebase
- Mensaje: "El formato del email no es válido"

**Soluciones:**
1. Verificar que el email tenga formato válido: usuario@dominio.com
2. No incluir espacios en el email
3. Asegurar que tenga @ y un dominio válido

### 4. Error: "Campos obligatorios faltantes"

**Síntomas:**
- Error de validación
- Mensaje indicando campos faltantes

**Soluciones:**
1. Completar todos los campos obligatorios:
   - Nombre completo
   - Email válido
   - Institución seleccionada
2. Verificar que no haya campos vacíos

### 5. Error: "Sesión cerrada automáticamente"

**Síntomas:**
- El administrador es deslogueado después de crear un rector
- Mensaje: "Tu sesión se cerrará automáticamente"

**Explicación:**
- Esto es comportamiento esperado
- Firebase Auth cierra la sesión del admin al crear un nuevo usuario
- El admin debe volver a iniciar sesión

**Solución:**
1. Re-iniciar sesión con las credenciales del administrador
2. El rector creado puede hacer login inmediatamente

### 6. Error: "No se encontraron rectores con los filtros aplicados"

**Síntomas:**
- La lista de rectores aparece vacía
- Mensaje en la interfaz

**Soluciones:**
1. Verificar que el rector se creó correctamente
2. Revisar los filtros aplicados
3. Limpiar los filtros de búsqueda
4. Recargar la página

## Pasos de Diagnóstico

### 1. Verificar en la Consola del Navegador

Abrir las herramientas de desarrollador (F12) y revisar:
- Errores en la consola
- Logs de Firebase
- Mensajes de validación

### 2. Verificar en Firebase Console

1. Ir a Firebase Console
2. Revisar Authentication > Users
3. Verificar Firestore > users collection
4. Verificar Firestore > institutions collection

### 3. Verificar Datos del Formulario

```javascript
// En la consola del navegador
console.log('Datos del formulario:', {
  name: 'Nombre del rector',
  email: 'email@institucion.edu',
  institution: 'institution-id',
  password: 'contraseña'
})
```

### 4. Probar Creación Manual

```javascript
// Importar y usar la función de prueba
import { testRectorCreation } from '@/utils/testRectorCreation'
await testRectorCreation()
```

## Logs Importantes

### Logs de Éxito
```
🚀 Iniciando creación de rector con datos: {...}
🔐 Contraseña generada para rector (longitud): 12
📝 Creando cuenta en Firebase Auth...
✅ Cuenta creada en Firebase Auth con UID: abc123
👔 Datos del rector a guardar en Firestore: {...}
✅ Usuario rector creado en Firestore con datos completos
📊 Agregando rector a la estructura jerárquica de instituciones...
✅ Rector agregado a la estructura jerárquica de instituciones
🎉 Rector creado exitosamente. Puede hacer login inmediatamente.
```

### Logs de Error
```
❌ Error al crear cuenta en Firebase Auth: {...}
❌ Error al crear usuario rector en Firestore: {...}
⚠️ No se pudo crear el rector en la estructura jerárquica: {...}
```

## Contacto y Soporte

Si los problemas persisten:
1. Revisar los logs completos en la consola
2. Verificar la configuración de Firebase
3. Comprobar la conectividad a internet
4. Verificar permisos de Firebase Auth y Firestore

## Versión
- Documento creado: Enero 2025
- Versión de la aplicación: 1.0.0
