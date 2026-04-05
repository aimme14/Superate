# Prueba rápida: lectura del banco de vocabulario vía superateHttp (consolidado).
# La generación masiva por POST no está en este despliegue; edita consolidado_* en Firestore.

param(
    [string]$Materia = "matematicas"
)

$base = "https://us-central1-superate-6c730.cloudfunctions.net/superateHttp"
$url = "$base/getVocabularyWords?materia=$([uri]::EscapeDataString($Materia))&all=1"

Write-Host "GET $url" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    $n = 0
    if ($response.success -and $response.data) { $n = @($response.data).Count }
    Write-Host "OK: success=$($response.success) palabras=$n" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
