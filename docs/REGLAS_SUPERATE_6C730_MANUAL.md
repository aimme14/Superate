# Reglas en superate-6c730 (Storage ahí) – configuración manual

Si mantienes **Storage en superate-6c730** y la app usa ese proyecto (`.env` con `VITE_FIREBASE_PROJECT_ID=superate-6c730` y el bucket de superate-6c730), las reglas deben estar en **superate-6c730**. Como el CLI no enlaza ese proyecto, se configuran desde la consola.

---

## 1. Firestore (superate-6c730)

La colección **AI_Tools** debe tener regla en superate-6c730.

1. Abre: **https://console.firebase.google.com/project/superate-6c730/firestore/rules**
2. En el archivo de reglas, dentro de `match /databases/{database}/documents { ... }`, añade **antes** de la regla que deniega todo (`match /{document=**}`):

```
// Centro de Herramientas IA: AI_Tools/{toolId}
match /AI_Tools/{toolId} {
  allow read: if request.auth != null;
  allow create, update, delete: if request.auth != null
    && get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.role == 'admin'
    && get(/databases/$(database)/documents/superate/auth/users/$(request.auth.uid)).data.isActive == true;
}
```

Si en superate-6c730 ya usas una función `isAdmin()` u otra estructura de usuarios, adapta la condición de `create, update, delete` a esa función (solo admin activo puede escribir).

---

3. Pulsa **Publicar**.

## 2. Storage (superate-6c730)

1. Abre: **https://console.firebase.google.com/project/superate-6c730/storage**
2. Pestaña **Reglas** (Rules).
3. Sustituye todo el contenido por el siguiente (o pégalo si está vacío):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /AI_Tools_icons/{toolId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    match /questions/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    match /test/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

4. Pulsa **Publicar**.

---

## 3. Tu .env

Para que la app use **Storage (y Firestore) de superate-6c730**, en tu `.env` debe estar el proyecto y el bucket de ese proyecto, por ejemplo:

- `VITE_FIREBASE_PROJECT_ID=superate-6c730`
- `VITE_FIREBASE_STORAGE_BUCKET=superate-6c730.firebasestorage.app`  
  (o el valor que muestre la consola de superate-6c730 en Configuración del proyecto → General → Tu app → storageBucket)

Así los iconos del Centro de Herramientas IA se guardan en **Storage de superate-6c730** y las reglas que publiques ahí los permitirán.
