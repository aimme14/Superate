# 🚀 Guía Completa de Migración a Nueva Estructura

## 📋 Resumen Ejecutivo

Esta guía documenta el proceso completo de migración de usuarios de la estructura antigua a la nueva estructura jerárquica, incluyendo todas las mejoras implementadas para garantizar la integridad de los datos.

## 🎯 Objetivo

Migrar todos los usuarios de la estructura antigua:
```
superate/auth/users/{userId}
```

A la nueva estructura jerárquica:
```
superate/auth/institutions/{institutionId}/
  ├── rectores/{rectorId}
  ├── coordinadores/{coordinadorId}
  ├── profesores/{profesorId}
  └── estudiantes/{estudianteId}
```

## ✅ Mejoras Implementadas

### 1. Manejo de Valores `undefined`
- **Problema**: Firestore no acepta valores `undefined` en documentos
- **Solución**: Función `removeUndefinedValues()` que elimina recursivamente todas las propiedades `undefined` antes de guardar
- **Impacto**: Previene errores al guardar documentos con campos faltantes

### 2. Normalización de Campos
- **Problema**: Campos duplicados con nombres diferentes (`grade` vs `gradeName`, `campus` vs `campusId`)
- **Solución**: Función `normalizeUserData()` que sincroniza campos relacionados
- **Impacto**: Asegura consistencia de datos en la nueva estructura

### 3. Validación de Instituciones
- **Problema**: Usuarios con `institutionId` que no existe en la base de datos
- **Solución**: Verificación previa de existencia de institución antes de migrar
- **Impacto**: Evita errores y datos inconsistentes

### 4. Manejo Robusto de Errores
- **Problema**: Errores no capturados podían detener toda la migración
- **Solución**: Try-catch en cada operación con reporte detallado de errores
- **Impacto**: Migración más resiliente y trazable

### 5. Script de Verificación
- **Problema**: No había forma de verificar la integridad post-migración
- **Solución**: Script `verifyMigration.ts` que compara datos entre estructuras
- **Impacto**: Permite validar que la migración fue exitosa

## 📁 Archivos Creados/Modificados

### Scripts de Migración
- ✅ `functions/src/scripts/migrateUsersToNewStructure.ts` - Script principal de migración (mejorado)
- ✅ `functions/src/scripts/verifyMigration.ts` - Script de verificación post-migración (nuevo)
- ✅ `functions/src/scripts/README_MIGRACION.md` - Documentación actualizada

### Servicios
- ✅ `functions/src/services/studentSummary.service.ts` - Corregido manejo de `undefined`

## 🚀 Proceso de Migración

### Paso 1: Preparación

1. **Hacer backup de la base de datos**
   ```bash
   # Usar Firebase Console o gcloud para exportar datos
   ```

2. **Verificar que estás en el ambiente correcto**
   ```bash
   # Verificar variables de entorno
   echo $NODE_ENV
   ```

3. **Compilar el código**
   ```bash
   cd functions
   npm run build
   cd ..
   ```

### Paso 2: Ejecutar Migración

```bash
# Ejecutar script de migración
npx ts-node functions/src/scripts/migrateUsersToNewStructure.ts
```

**El script:**
- Obtiene todos los usuarios de la estructura antigua
- Valida cada usuario (rol, institutionId, existencia de institución)
- Normaliza y limpia datos
- Migra a la nueva estructura
- Genera reporte detallado

**Salida esperada:**
```
🚀 Iniciando migración de usuarios a nueva estructura jerárquica...

📊 Total de usuarios encontrados en estructura antigua: 150

📦 Procesando lote 1/15...
✅ Usuario abc123 (student) migrado a institutions/inst-001/estudiantes
✅ Usuario def456 (teacher) migrado a institutions/inst-001/profesores
⚠️ Usuario ghi789: Sin institutionId (se omite - probablemente admin)
...

============================================================
📊 RESUMEN DE MIGRACIÓN
============================================================
Total usuarios procesados: 150
✅ Usuarios migrados exitosamente: 145
⚠️ Usuarios omitidos: 3
❌ Errores: 2

📈 Migrados por rol:
   - student: 120
   - teacher: 20
   - principal: 3
   - rector: 2
```

### Paso 3: Verificación

```bash
# Ejecutar script de verificación
npx ts-node functions/src/scripts/verifyMigration.ts
```

**El script verifica:**
- Que todos los usuarios migrados existan en la nueva estructura
- Que los datos coincidan entre estructuras
- Que no haya usuarios faltantes
- Genera reporte de problemas encontrados

**Salida esperada:**
```
🔍 Iniciando verificación de migración...

📊 Total de usuarios en estructura antigua: 150

📦 Verificando lote 1/15...
...

============================================================
📊 RESUMEN DE VERIFICACIÓN
============================================================
Total usuarios verificados: 150
✅ Usuarios OK: 145
⚠️ Usuarios omitidos (admin/sin rol válido): 3
❌ Usuarios faltantes en nueva estructura: 0
⚠️ Usuarios con diferencias de datos: 0
❌ Errores durante verificación: 0

✅ No se encontraron problemas en la migración
```

### Paso 4: Pruebas Funcionales

1. **Probar login con usuarios migrados**
2. **Probar generación de PDFs** (esto era el problema original)
3. **Probar creación de nuevos usuarios** (deben ir a nueva estructura)
4. **Probar consultas de usuarios**
5. **Probar actualización de usuarios**

### Paso 5: Monitoreo (Opcional)

Mantener ambas estructuras durante 1-2 semanas para:
- Verificar que no hay problemas
- Permitir rollback si es necesario
- Asegurar que todo funciona correctamente

## 🔧 Solución de Problemas

### Error: "Cannot use undefined as a Firestore value"

**Causa**: El script intenta guardar valores `undefined` en Firestore

**Solución**: Ya está resuelto con la función `removeUndefinedValues()`. Si persiste:
1. Verificar que el script esté actualizado
2. Recompilar: `cd functions && npm run build`
3. Ejecutar de nuevo

### Usuarios no se migran

**Posibles causas:**
1. **Sin `institutionId`**: Usuarios admin o sin institución asignada (se omiten intencionalmente)
2. **Rol inválido**: Solo se migran roles: `student`, `teacher`, `principal`, `rector`
3. **Institución no existe**: El script verifica que la institución exista antes de migrar

**Solución**: Verificar los logs del script para ver por qué se omitieron

### Usuarios duplicados

**Causa**: Usuario existe en ambas estructuras

**Solución**: El script detecta duplicados y los omite. Si necesitas limpiar:
1. Verificar manualmente cuál estructura tiene los datos más recientes
2. Eliminar el duplicado de la estructura antigua (solo después de verificar)

## 📊 Estadísticas y Reportes

### Durante la Migración

El script genera:
- Total de usuarios procesados
- Usuarios migrados exitosamente
- Usuarios omitidos (con razón)
- Errores (con detalles)
- Desglose por rol

### Durante la Verificación

El script genera:
- Usuarios verificados correctamente
- Usuarios con problemas
- Diferencias de datos encontradas
- Lista detallada de problemas

## ⚠️ Advertencias Importantes

1. **NO eliminar la estructura antigua** hasta verificar que todo funciona
2. **Hacer backup** antes de ejecutar en producción
3. **Probar primero en desarrollo** si es posible
4. **Los usuarios admin NO se migran** (no tienen `institutionId`)
5. **Mantener ambas estructuras** durante período de gracia (1-2 semanas)

## 🎯 Resultado Esperado

Después de la migración exitosa:

✅ Todos los usuarios válidos están en la nueva estructura
✅ Los datos están normalizados y limpios (sin `undefined`)
✅ El sistema funciona correctamente con la nueva estructura
✅ La generación de PDFs funciona sin errores
✅ Los nuevos usuarios se crean automáticamente en la nueva estructura

## 📝 Notas Técnicas

### Normalización de Campos

El script normaliza:
- `grade` ↔ `gradeName`: Si existe uno, se copia al otro
- `campus` ↔ `campusId`: Si existe uno, se copia al otro
- `gradeId`: Se establece desde `grade` o `gradeName` si no existe

### Eliminación de `undefined`

La función `removeUndefinedValues()`:
- Recorre recursivamente el objeto
- Elimina propiedades con valor `undefined`
- Mantiene `null` (Firestore lo acepta)
- Preserva `FieldValue` de Firestore (timestamps, etc.)

### Validaciones

El script valida:
1. Que el usuario tenga un rol válido
2. Que el usuario tenga `institutionId`
3. Que la institución exista en la base de datos
4. Que el usuario no exista ya en la nueva estructura

## 🔗 Referencias

- Documentación del script: `functions/src/scripts/README_MIGRACION.md`
- Script de migración: `functions/src/scripts/migrateUsersToNewStructure.ts`
- Script de verificación: `functions/src/scripts/verifyMigration.ts`
- Documentación de estructura: `MIGRACION_NUEVA_ESTRUCTURA_USUARIOS.md`

## ✅ Checklist Final

Antes de considerar la migración completa:

- [ ] Migración ejecutada sin errores críticos
- [ ] Verificación ejecutada sin problemas
- [ ] Pruebas funcionales pasadas (login, PDFs, etc.)
- [ ] Nuevos usuarios se crean en nueva estructura
- [ ] Sistema funciona normalmente
- [ ] Backup de datos realizado
- [ ] Documentación actualizada
- [ ] Equipo notificado de la migración

---

**Última actualización**: $(date)
**Versión del script**: 2.0 (con mejoras de manejo de undefined y normalización)
