# Vocabulario académico (definitionswords)

## Estado actual (este repositorio)

- **Lectura en producción:** solo el documento `definitionswords/consolidado_{materiaSlug}` con el array `items` (una lectura por materia y carga en servidor), vía `vocabulary.service.ts` y el HTTP `GET .../superateHttp/getVocabularyWords`.
- **No hay** en el código consultas a la subcolección `definitionswords/{materia}/palabras` ni `collectionGroup('palabras')`.
- **Cliente:** `VocabularyBank` llama al endpoint HTTP; no lee Firestore directamente sobre `definitionswords`.

## Si en Firebase aparecen lecturas sobre `.../palabras`

Suelen venir de:

1. **Funciones Cloud antiguas** aún desplegadas en el proyecto (p. ej. `generateVocabularyBatch` como función suelta) que no están en `functions/src/index.ts` actual.
2. **Scripts o consola** ejecutados contra la subcolección.
3. **Otro binario / repo** que aún use el modelo antiguo.

Revisa en Google Cloud Console → Cloud Functions qué funciones existen y elimina las obsoletas. El código unificado expone solo `superateHttp`.

## Despliegue de reglas

Las reglas en `firestore.rules` niegan lectura/escritura cliente sobre `definitionswords` (el acceso útil es Admin SDK en Functions).
