# 📋 Script de Migración de Usuarios

## 🎯 Propósito

Este script migra usuarios existentes de la estructura antigua (`superate/auth/users`) a la nueva estructura jerárquica organizada por institución y rol:

```
superate/auth/institutions/{institutionId}/
  ├── rectores/{rectorId}
  ├── coordinadores/{coordinadorId}
  ├── profesores/{profesorId}
  └── estudiantes/{estudianteId}
```

## ⚠️ ADVERTENCIAS IMPORTANTES

1. **Hacer backup de la base de datos antes de ejecutar**
2. **Ejecutar primero en ambiente de desarrollo**
3. **Verificar integridad de datos después de la migración**
4. **Los usuarios admin NO se migran** (permanecen en estructura antigua)
5. **No eliminar la estructura antigua** hasta verificar que todo funciona correctamente

## 📋 Requisitos Previos

- Firebase Admin inicializado
- Acceso a la base de datos Firestore
- Permisos para leer y escribir en las colecciones

## 🚀 Uso

### Desarrollo Local

```bash
# 1. Asegúrate de estar en el directorio raíz del proyecto
cd /ruta/al/proyecto

# 2. Instalar dependencias si no están instaladas
npm install

# 3. Compilar TypeScript (si es necesario)
npm run build

# 4. Ejecutar el script
npx ts-node functions/src/scripts/migrateUsersToNewStructure.ts
```

### Con Variables de Entorno

```bash
# Configurar variables de entorno
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
export NODE_ENV="development"

# Ejecutar el script
npx ts-node functions/src/scripts/migrateUsersToNewStructure.ts
```

## 📊 Funcionalidades

### Migración de Usuarios

El script:
1. Obtiene todos los usuarios de la estructura antigua (`superate/auth/users`)
2. Filtra usuarios válidos (con `institutionId` y rol válido)
3. Verifica si ya existen en la nueva estructura (evita duplicados)
4. Migra usuarios a la nueva estructura jerárquica según su institución y rol
5. Mantiene todos los datos originales del usuario
6. Agrega campos `migratedAt` y `migratedFrom` para trazabilidad

### Verificación de Integridad

Después de la migración, el script:
1. Cuenta usuarios en estructura antigua
2. Cuenta usuarios en nueva estructura (por rol)
3. Identifica usuarios duplicados (existen en ambas estructuras)
4. Genera un reporte detallado

## 📈 Estadísticas Generadas

El script genera un reporte con:
- Total de usuarios procesados
- Usuarios migrados exitosamente
- Usuarios omitidos (sin `institutionId` o rol inválido)
- Errores durante la migración
- Desglose por rol
- Lista detallada de errores

## 🔍 Ejemplo de Salida

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

🔍 Verificando integridad de la migración...

📊 Usuarios en estructura antigua: 150
📊 Usuarios en nueva estructura: 145
...
```

## 🧪 Pruebas Post-Migración

Después de ejecutar la migración, verificar:

1. **Crear un nuevo usuario** y verificar que se crea en nueva estructura
2. **Consultar usuarios migrados** por ID y verificar que se encuentran
3. **Actualizar usuarios migrados** y verificar que se actualizan correctamente
4. **Listar usuarios** y verificar que aparecen correctamente
5. **Probar funcionalidades** que dependan de usuarios (login, dashboards, etc.)

## 🗑️ Limpieza Post-Migración

**⚠️ SOLO DESPUÉS DE VERIFICAR QUE TODO FUNCIONA:**

Una vez que hayas verificado que:
- Todos los usuarios migrados funcionan correctamente
- No hay problemas de integridad
- El sistema funciona normalmente con la nueva estructura

Puedes considerar eliminar los usuarios migrados de la estructura antigua. Sin embargo, **se recomienda mantener la estructura antigua durante un período de gracia** (ej: 1-2 semanas) para asegurar que no haya problemas.

## 📝 Notas

- Los usuarios **admin** no se migran (no tienen `institutionId`)
- Los usuarios sin `institutionId` o con rol inválido se omiten
- Los usuarios que ya existen en la nueva estructura se omiten (no duplican)
- El script procesa usuarios en lotes para no sobrecargar Firestore
- Se agrega un pequeño delay entre lotes para evitar cuotas excedidas

## 🐛 Solución de Problemas

### Error: Firebase Admin no inicializado
- Verificar que las credenciales estén configuradas correctamente
- Verificar la variable `GOOGLE_APPLICATION_CREDENTIALS`

### Error: Permisos denegados
- Verificar que el service account tenga permisos de lectura/escritura
- Verificar las reglas de seguridad de Firestore

### Usuarios no se migran
- Verificar que tengan `institutionId` o `inst` en sus datos
- Verificar que el rol sea válido (student, teacher, principal, rector)
- Verificar que la institución exista en la base de datos

## 📚 Referencias

- Documentación completa: `MIGRACION_NUEVA_ESTRUCTURA_USUARIOS.md`
- Resumen de implementación: `RESUMEN_IMPLEMENTACION_NUEVA_ESTRUCTURA.md`
