# 📚 Comandos para Generar Vocabulario Académico

## 🚀 Método Recomendado: Usar el Endpoint HTTP (PowerShell)

### Comando básico:

```powershell
# Desde cualquier directorio
$body = @{
    materia = 'matematicas'
    palabras = @('palabra1', 'palabra2', 'palabra3')
} | ConvertTo-Json

Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

### Usar el script de PowerShell (más fácil):

```powershell
# Desde la carpeta functions
cd functions
.\GENERAR_PALABRAS.ps1 -Materia matematicas -Palabras @('coseno', 'tangente', 'geometría')
```

### Ejemplos por materia:

#### Matemáticas (10 palabras):
```powershell
$body = @{ materia = 'matematicas'; palabras = @('coseno', 'tangente', 'geometría', 'ángulo', 'perímetro', 'área', 'volumen', 'teorema', 'postulado', 'axioma') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Lectura Crítica (10 palabras):
```powershell
$body = @{ materia = 'lectura_critica'; palabras = @('conectores', 'metáfora', 'símil', 'analogía', 'símbolo', 'alegoría', 'ironía', 'sarcasmo', 'paradoja', 'hipérbole') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Física (10 palabras):
```powershell
$body = @{ materia = 'fisica'; palabras = @('período', 'reflexión', 'refracción', 'difracción', 'interferencia', 'resonancia', 'sonido', 'luz', 'óptica', 'lente') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Biología (10 palabras):
```powershell
$body = @{ materia = 'biologia'; palabras = @('fotosíntesis', 'respiración', 'celular', 'organismo', 'especie', 'género', 'familia', 'orden', 'clase', 'filo') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Química (10 palabras):
```powershell
$body = @{ materia = 'quimica'; palabras = @('homogénea', 'heterogénea', 'covalente', 'iónico', 'metálico', 'electronegatividad', 'periodicidad', 'tabla periódica', 'grupo', 'período') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Inglés (10 palabras):
```powershell
$body = @{ materia = 'ingles'; palabras = @('infinitive', 'gerund', 'participle', 'clause', 'phrase', 'sentence', 'paragraph', 'essay', 'composition', 'reading comprehension') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

#### Sociales y Ciudadanas (10 palabras):
```powershell
$body = @{ materia = 'sociales_ciudadanas'; palabras = @('demanda', 'precio', 'valor', 'producción', 'consumo', 'distribución', 'comercio', 'exportación', 'importación', 'desarrollo') } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'
```

## 📋 Verificar palabras generadas:

```powershell
# Obtener palabras de una materia
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/getVocabularyWords?materia=matematicas&limit=10' -Method Get

# Obtener definición de una palabra específica
Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/getVocabularyWord?materia=matematicas&palabra=álgebra' -Method Get
```

## ⚠️ Nota sobre el script npm:

El script `npm run generate-vocabulary` requiere credenciales de Vertex AI configuradas localmente, por lo que puede fallar. **Usa el endpoint HTTP en su lugar**, que ya tiene las credenciales configuradas en producción.
