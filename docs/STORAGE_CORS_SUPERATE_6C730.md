# CORS en Firebase Storage (Superate)

El icono de las herramientas IA no se sube desde `localhost` porque el navegador bloquea la petición por **CORS**. Hay que configurar CORS en el bucket de Storage.

## Importante: dos proyectos Google Cloud

En este setup hay **dos proyectos**:

| Proyecto          | Uso                                      |
|-------------------|------------------------------------------|
| **superate-ia**   | Gemini, Vertex AI, YouTube API          |
| **superate-6c730**| Firebase (Auth, Firestore, **Storage**)  |

Los datos y el Storage están en **superate-6c730**. Si en tu máquina `gcloud` tiene por defecto **superate-ia** (`gcloud config get-value project`), los comandos de Storage deben indicar **siempre** el proyecto donde está el bucket:

```bash
--project=superate-6c730
```

Si no pones `--project=superate-6c730`, gcloud buscará el bucket en superate-ia y dará **404**.

## 1. Archivo de configuración

El proyecto incluye `storage-cors.json` en la raíz con orígenes permitidos:

- `http://localhost:5173` y `http://127.0.0.1:5173` (Vite por defecto)
- `http://localhost:3000` y `http://127.0.0.1:3000`
- Tu URL de producción (Vercel) si la usas

Puedes editar ese archivo para añadir más orígenes (por ejemplo otro dominio de producción).

## 2. Nombre correcto del bucket

En este proyecto se probaron estos nombres y **todos dieron 404** con `gcloud`:
- `gs://superate-6c730.appspot.com`
- `gs://superate-6c730.firebasestorage.app`
- `gs://superate-6c730`

El nombre que usa la app (`VITE_FIREBASE_STORAGE_BUCKET=superate-6c730.firebasestorage.app`) es el “host” del API; en Google Cloud el bucket puede tener **otro nombre**. Hay que usar el nombre real.

### Cómo ver el nombre real del bucket

1. Entra en **Google Cloud Console**: https://console.cloud.google.com/
2. Arriba selecciona el proyecto **superate-6c730** (o el que uses).
3. Menú ☰ → **Storage** → **Buckets** (o: https://console.cloud.google.com/storage/browser?project=superate-6c730).
4. En la lista verás uno o más buckets. El de Firebase Storage es el que esté asociado a tu app; anota el **nombre** exacto (ej.: `superate-6c730-xxxxx` o similar).
5. Usa ese nombre en los comandos: `gs://NOMBRE_QUE_VES_AQUI`.

Si tienes permiso para listar buckets por terminal (cuenta con rol Owner o Storage Admin):

```bash
gcloud storage buckets list --project=superate-6c730
```

Copia el nombre de la columna "NAME" y úsalo en `gs://NAME`.

## 3. Aplicar la configuración al bucket

Necesitas **Google Cloud SDK** (`gcloud` y/o `gsutil`) instalado y autenticado.

### Opción A: gcloud (recomendada)

**Indica siempre el proyecto donde está Firebase (superate-6c730):**

```bash
gcloud storage buckets update gs://superate-6c730.firebasestorage.app --cors-file=storage-cors.json --project=superate-6c730
```

Si da 404, el nombre del bucket puede ser otro: abre [Cloud Console → Storage](https://console.cloud.google.com/storage/browser?project=superate-6c730), inicia sesión con una cuenta que tenga acceso al proyecto **superate-6c730**, y anota el nombre exacto del bucket. Luego:

```bash
gcloud storage buckets update gs://NOMBRE_REAL --cors-file=storage-cors.json --project=superate-6c730
```

### Opción B: gsutil (clásica)

Antes configura el proyecto: `gcloud config set project superate-6c730`, o usa `-p superate-6c730` si gsutil lo soporta. Luego:

```bash
gsutil cors set storage-cors.json gs://superate-6c730.firebasestorage.app
```

### Comprobar que se aplicó

```bash
gcloud storage buckets describe gs://superate-6c730.firebasestorage.app --format="default(cors_config)"
```

o:

```bash
gsutil cors get gs://superate-6c730.firebasestorage.app
```

## 4. Requisitos

- Tener permisos sobre el bucket (por ejemplo **Storage Admin** o **Owner** del proyecto).
- Si no tienes `gcloud`/`gsutil`: instala [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) y ejecuta `gcloud auth login` (y opcionalmente `gcloud config set project superate-6c730`).

## 5. Si sale "El usuario no está autorizado" al subir el icono

Las reglas de Storage (`storage.rules`) exigen que **haya un usuario autenticado** (`request.auth != null`). Si CORS ya está bien y aun así falla la subida:

1. **Desplegar las reglas de Storage** en el proyecto **superate-6c730**:
   ```bash
   firebase use superate-6c730
   firebase deploy --only storage
   ```
2. **Entrar con un usuario** en la app (login en `/auth/login`) y volver al dashboard antes de subir el icono.
3. Si sigue fallando, cerrar sesión y volver a entrar para refrescar el token y probar de nuevo.

## 6. Después de aplicar CORS

1. Cierra y vuelve a abrir la pestaña del dashboard (o recarga sin caché).
2. Crea de nuevo una herramienta IA y sube el icono. La subida debería completar y ya no debería aparecer “El icono no se subió a tiempo” por CORS.

Si aun así obtienes **404**, el nombre del bucket puede ser distinto (por ejemplo solo `superate-6c730`). En Firebase Console → Storage verás el nombre exacto del bucket para usarlo en `gs://`.
