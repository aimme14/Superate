# Script de PowerShell para generar palabras de vocabulario académico
# Usa el endpoint HTTP desplegado (no requiere credenciales locales)

param(
    [string]$Materia = "matematicas",
    [string[]]$Palabras = @()
)

# URL del endpoint desplegado
$url = "https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch"

# Si no se proporcionaron palabras, usar lista por defecto según la materia
if ($Palabras.Count -eq 0) {
    switch ($Materia) {
        "matematicas" {
            $Palabras = @('coseno', 'tangente', 'geometría', 'ángulo', 'perímetro', 'área', 'volumen', 'teorema', 'postulado', 'axioma')
        }
        "lectura_critica" {
            $Palabras = @('conectores', 'metáfora', 'símil', 'analogía', 'símbolo', 'alegoría', 'ironía', 'sarcasmo', 'paradoja', 'hipérbole')
        }
        "fisica" {
            $Palabras = @('período', 'reflexión', 'refracción', 'difracción', 'interferencia', 'resonancia', 'sonido', 'luz', 'óptica', 'lente')
        }
        "biologia" {
            $Palabras = @('fotosíntesis', 'respiración', 'celular', 'organismo', 'especie', 'género', 'familia', 'orden', 'clase', 'filo')
        }
        "quimica" {
            $Palabras = @('homogénea', 'heterogénea', 'covalente', 'iónico', 'metálico', 'electronegatividad', 'periodicidad', 'tabla periódica', 'grupo', 'período')
        }
        "ingles" {
            $Palabras = @('infinitive', 'gerund', 'participle', 'clause', 'phrase', 'sentence', 'paragraph', 'essay', 'composition', 'reading comprehension')
        }
        "sociales_ciudadanas" {
            $Palabras = @('demanda', 'precio', 'valor', 'producción', 'consumo', 'distribución', 'comercio', 'exportación', 'importación', 'desarrollo')
        }
        default {
            Write-Host "Materia no reconocida. Usando matemáticas por defecto."
            $Palabras = @('coseno', 'tangente', 'geometría', 'ángulo', 'perímetro')
        }
    }
}

Write-Host "Generando palabras de vocabulario para: $Materia" -ForegroundColor Cyan
Write-Host "Palabras a generar: $($Palabras.Count)" -ForegroundColor Yellow
Write-Host "   $($Palabras -join ', ')" -ForegroundColor Gray
Write-Host ""

# Crear el body del request
$body = @{
    materia = $Materia
    palabras = $Palabras
} | ConvertTo-Json -Depth 2

try {
    Write-Host "Enviando request al servidor..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType 'application/json'
    
    Write-Host ""
    Write-Host "RESULTADO:" -ForegroundColor Green
    Write-Host "   Exitosas: $($response.data.success)" -ForegroundColor Green
    Write-Host "   Fallidas: $($response.data.failed)" -ForegroundColor $(if ($response.data.failed -gt 0) { "Red" } else { "Gray" })
    
    if ($response.data.failed -gt 0) {
        Write-Host ""
        Write-Host "Palabras que fallaron:" -ForegroundColor Red
        $response.data.results | Where-Object { -not $_.success } | ForEach-Object {
            Write-Host "   - $($_.palabra): $($_.error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Proceso completado!" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
