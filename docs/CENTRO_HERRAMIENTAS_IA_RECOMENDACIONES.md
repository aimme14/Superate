# Centro de Herramientas IA – Recomendaciones

Resumen de mejoras sugeridas tras lo implementado hasta ahora.

---

## 1. Seguridad (prioritario)

### Firestore
- **Hecho:** Se añadió la regla para `AI_Tools/{toolId}` en `firestore.rules`: lectura para usuarios con `canAccess()`, escritura solo para `isAdmin()`.
- **Acción:** Desplegar las reglas: `firebase deploy --only firestore:rules`.

### Storage (iconos)
- Los iconos se suben a `AI_Tools_icons/{toolId}/icon.{ext}`. Si usas reglas de Storage en la consola de Firebase, agrega algo como:
  - **Lectura:** usuarios autenticados (o solo `canAccess`) pueden leer.
  - **Escritura:** solo admin (por ejemplo comprobando un claim `admin` o que el usuario exista en `superate/auth/users` como admin).
- Si hoy no tienes `storage.rules`, los archivos pueden estar abiertos; conviene restringir por rol cuando puedas.

---

## 2. Validación y límites

- **URL de redirección:** Validar que sea URL válida (y opcionalmente que sea `https`) antes de guardar.
- **Tamaño del icono:** Limitar tamaño (ej. máx. 1–2 MB) y/o comprimir en el cliente antes de subir (como en `question.service.ts`).
- **Longitud de textos:** Límites razonables para `nombre` (ej. 100 caracteres), `especialidad` (500), cada prompt (1000) para evitar documentos enormes.
- **Prompts:** Evitar guardar prompts vacíos; ya se filtra por `trim`, pero se puede limitar la cantidad (ej. máx. 20).

---

## 3. UX / UI

- **Orden en el listado:** Ordenar por `nombre` o por `createdAt` (más reciente primero) para una experiencia predecible.
- **Campo “activo”:** Añadir `isActive: boolean` para ocultar una herramienta sin borrarla (útil para pruebas o ofertas temporales). En el listado del admin mostrar estado y filtrar opcionalmente inactivas.
- **Confirmar cancelar edición:** Si el usuario editó algo y pulsa “Cancelar”, preguntar “¿Descartar cambios?”.
- **Scroll al formulario al editar:** Hacer scroll al card del formulario al pulsar “Editar” para que no tenga que buscarlo.

---

## 4. Uso por estudiantes

- **Lectura desde la app:** Crear un hook o servicio de solo lectura (por ejemplo `useAITools()` o `aiToolsService.getActive()`) que consuman estudiantes/docentes para listar las herramientas (y filtrar por módulo o nivel si lo necesitas).
- **Filtros:** Si en el futuro quieres “herramientas para Matemáticas”, guardar `modulosRecomendados` como array permite filtrar en el cliente o con una query compuesta (y en ese caso podría hacer falta un índice compuesto en Firestore).

---

## 5. Modelo de datos (opcional)

- **Orden de aparición:** Campo `orden: number` para definir el orden en que se muestran las herramientas (p. ej. en la vista estudiante). Al listar, ordenar por `orden` y luego por `nombre`.
- **isActive:** Como arriba, para no borrar y solo ocultar.

---

## 6. Mantenimiento y consistencia

- **Nombres duplicados:** Si quieres evitar dos herramientas con el mismo nombre, puedes comprobar en el cliente antes de crear o usar una regla de Firestore (o un Cloud Function) que rechace duplicados.
- **Borrado del icono al actualizar:** Si en “Editar” el usuario quita la imagen y guarda, hoy se mantiene la anterior. Si quieres que “quitar imagen” borre también el archivo en Storage, hay que llamar a `deleteAIToolIcon` y poner `iconUrl: null` en el documento.

---

## 7. Resumen de acciones inmediatas

1. Desplegar `firestore.rules` (ya incluye `AI_Tools`).
2. Revisar/crear reglas de Storage para `AI_Tools_icons` según tu política de acceso.
3. (Opcional) Añadir validación de URL y límite de tamaño de icono en el formulario.
4. (Opcional) Ordenar el listado por nombre o fecha y añadir `isActive` si planeas ocultar herramientas sin eliminarlas.
