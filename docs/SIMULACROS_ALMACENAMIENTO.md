# Cómo se almacenan los Simulacros

Referencia de la estructura en **Firestore** y **Firebase Storage** para el módulo de Simulacros (Saber 11 / ICFES).

---

## 1. Firestore

### Colección principal: `Simulacros`

Cada documento tiene **id** autogenerado y los siguientes campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `grado` | string | "9°", "10°" o "11°" |
| `materia` | string | "matematicas", "lectura-critica", "ciencias-naturales", "sociales", "ingles" o **"icfes"** |
| `titulo` | string | Título del simulacro |
| `formulario` | string | Ej: "Formulario 1", "Formulario 2" |
| `numeroOrden` | number | Orden de visualización |
| `comentario` | string | Enfoque o descripción del simulacro |
| `isActive` | boolean | Activo/inactivo |
| `createdAt` | Timestamp | Fecha de creación (automática) |
| `pdfSimulacroUrl` | string | URL del PDF del simulacro (obligatorio) |
| `pdfHojaRespuestasUrl` | string | URL del PDF de la hoja de respuestas (obligatorio, 1:1) |
| `icfesSeccion1DocumentoUrl` | string? | Solo si materia = ICFES: URL PDF documento sección 1 |
| `icfesSeccion1HojaUrl` | string? | Solo si materia = ICFES: URL PDF hoja respuestas sección 1 |
| `icfesSeccion2DocumentoUrl` | string? | Solo si materia = ICFES: URL PDF documento sección 2 |
| `icfesSeccion2HojaUrl` | string? | Solo si materia = ICFES: URL PDF hoja respuestas sección 2 |

**Ruta del documento:** `Simulacros/{simulacroId}`

---

### Subcolección: Videos (explicativos generales)

**Ruta:** `Simulacros/{simulacroId}/Videos/{videoId}`

Relación **1:N** (un simulacro tiene muchos videos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `titulo` | string | Título del video |
| `descripcion` | string? | Descripción opcional |
| `orden` | number | Orden de aparición |
| `url` | string | URL de descarga (Firebase Storage) |
| `storagePath` | string? | Ruta en Storage (para borrado) |
| `createdAt` | Timestamp | Fecha de creación |

---

### Subcolección: ICFES → Videos (solo materia ICFES)

**Ruta:** `Simulacros/{simulacroId}/ICFES/Videos/{videoId}`

Solo se usa cuando la materia del simulacro es **"icfes"**. Misma estructura que la subcolección `Videos` anterior.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `titulo` | string | Título del video |
| `descripcion` | string? | Descripción opcional |
| `orden` | number | Orden de aparición |
| `url` | string | URL de descarga (Firebase Storage) |
| `storagePath` | string? | Ruta en Storage (para borrado) |
| `createdAt` | Timestamp | Fecha de creación |

---

## 2. Firebase Storage

Todos los archivos están bajo la carpeta **`Simulacros/`**.

### Estructura de carpetas

```
Simulacros/
└── {simulacroId}/
    ├── documento.pdf              ← PDF del simulacro (obligatorio)
    ├── hoja_respuestas.pdf        ← Hoja de respuestas (obligatorio, 1:1)
    ├── videos/                    ← Videos explicativos generales
    │   └── {videoId}_{nombre}.mp4
    └── icfes/                     ← Solo cuando materia = ICFES
        ├── documento_seccion1.pdf
        ├── hoja_respuestas_seccion1.pdf
        ├── documento_seccion2.pdf
        ├── hoja_respuestas_seccion2.pdf
        └── videos/
            └── {videoId}_{nombre}.mp4
```

### Rutas concretas

| Contenido | Ruta en Storage |
|-----------|-----------------|
| PDF simulacro | `Simulacros/{simulacroId}/documento.pdf` |
| PDF hoja respuestas | `Simulacros/{simulacroId}/hoja_respuestas.pdf` |
| Video explicativo | `Simulacros/{simulacroId}/videos/{videoId}_{nombreSeguro}.mp4` (o .webm, .mov) |
| ICFES doc. sección 1 | `Simulacros/{simulacroId}/icfes/documento_seccion1.pdf` |
| ICFES hoja sección 1 | `Simulacros/{simulacroId}/icfes/hoja_respuestas_seccion1.pdf` |
| ICFES doc. sección 2 | `Simulacros/{simulacroId}/icfes/documento_seccion2.pdf` |
| ICFES hoja sección 2 | `Simulacros/{simulacroId}/icfes/hoja_respuestas_seccion2.pdf` |
| Video ICFES | `Simulacros/{simulacroId}/icfes/videos/{videoId}_{nombreSeguro}.mp4` |

---

## 3. Resumen visual

```
Firestore:
  Simulacros (colección)
    └── {simulacroId} (documento: grado, materia, titulo, formulario, PDFs, icfes*)
          ├── Videos (subcolección)           → videos explicativos generales
          └── ICFES (subcolección)
                └── Videos (subcolección)     → videos explicativos ICFES

Storage:
  Simulacros/{simulacroId}/
    ├── documento.pdf
    ├── hoja_respuestas.pdf
    ├── videos/*.mp4
    └── icfes/
        ├── documento_seccion1.pdf, hoja_respuestas_seccion1.pdf
        ├── documento_seccion2.pdf, hoja_respuestas_seccion2.pdf
        └── videos/*.mp4
```

\* Los campos `icfesSeccion1DocumentoUrl`, etc. solo existen cuando `materia === 'icfes'`.
