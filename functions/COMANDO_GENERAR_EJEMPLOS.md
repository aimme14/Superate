# Comando para Generar Ejemplos en Palabras Existentes

Este documento contiene el comando PowerShell para generar ejemplos de uso en ICFES para palabras de vocabulario que ya existen pero no tienen ejemplo.

## Endpoint

El endpoint es: `POST /definitions/generate-examples`

## Comando Base

```powershell
# Comando genérico para generar ejemplos
$body = @{ 
    materia = 'NOMBRE_MATERIA';
    limit = 50;  # Opcional: límite de palabras a procesar (por defecto: todas)
    batchSize = 10;  # Opcional: tamaño del lote (por defecto: 10)
    delayBetweenBatches = 2000  # Opcional: delay en ms entre lotes (por defecto: 2000)
} | ConvertTo-Json; 

$response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; 

Write-Host "Resultado:" -ForegroundColor Green; 
Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; 
Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; 
Write-Host "  Omitidas (ya tenían ejemplo): $($response.data.skipped)" -ForegroundColor Gray
```

## Comandos por Materia

### Matemáticas

```powershell
$body = @{ materia = 'matematicas'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Lectura Crítica

```powershell
$body = @{ materia = 'lectura_critica'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Física

```powershell
$body = @{ materia = 'fisica'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Biología

```powershell
$body = @{ materia = 'biologia'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Química

```powershell
$body = @{ materia = 'quimica'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Inglés

```powershell
$body = @{ materia = 'ingles'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

### Sociales y Ciudadanas

```powershell
$body = @{ materia = 'sociales_ciudadanas'; limit = 50; batchSize = 10; delayBetweenBatches = 2000 } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyExamples' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; Write-Host "  Omitidas: $($response.data.skipped)" -ForegroundColor Gray
```

## Parámetros

- **materia** (requerido): Nombre de la materia en formato normalizado
- **limit** (opcional): Número máximo de palabras a procesar (por defecto: todas las que no tienen ejemplo)
- **batchSize** (opcional): Número de palabras a procesar por lote (por defecto: 10)
- **delayBetweenBatches** (opcional): Delay en milisegundos entre lotes (por defecto: 2000ms)

## Cómo Usar

1. Abre PowerShell
2. Copia el comando completo de la materia que necesitas
3. Pégalo en PowerShell y presiona Enter
4. Espera a que se complete la generación (puede tardar varios minutos dependiendo de la cantidad de palabras)

## Notas

- El sistema procesa solo las palabras que NO tienen ejemplo
- Las palabras que ya tienen ejemplo se omiten automáticamente
- El proceso se realiza en lotes para evitar rate limits
- Si alguna palabra falla, se muestra en el resultado pero el proceso continúa con las demás

## Nombres de Materias (normalizados)

- `matematicas` - Matemáticas
- `lectura_critica` - Lectura Crítica
- `fisica` - Física
- `biologia` - Biología
- `quimica` - Química
- `ingles` - Inglés
- `sociales_ciudadanas` - Sociales y Ciudadanas
