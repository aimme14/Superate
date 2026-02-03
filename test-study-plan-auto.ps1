# Prueba automática de generateStudyPlan (sin prompts interactivos)
# Usa variables de entorno o valores por defecto para testing rápido

$functionUrl = $env:FUNCTIONS_URL
if (-not $functionUrl) {
    $functionUrl = "http://127.0.0.1:5001/superate-ia/us-central1/generateStudyPlan"
    Write-Host "⚠️  Usando emulador local. Si falla, despliega con: firebase deploy --only functions" -ForegroundColor Yellow
    Write-Host "   O define FUNCTIONS_URL para probar producción" -ForegroundColor Yellow
}

$studentId = $env:TEST_STUDENT_ID
$phase = $env:TEST_PHASE
$subject = $env:TEST_SUBJECT

if (-not $studentId) { $studentId = "test-student-plan" }
if (-not $phase) { $phase = "first" }
if (-not $subject) { $subject = "Matemáticas" }

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🧪 PRUEBA generateStudyPlan" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   URL: $functionUrl"
Write-Host "   StudentId: $studentId | Phase: $phase | Subject: $subject"
Write-Host ""

$body = @{ studentId = $studentId; phase = $phase; subject = $subject } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $functionUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
    Write-Host "✅ Respuesta recibida: success=$($response.success)" -ForegroundColor Green
    if ($response.data) {
        Write-Host "   Videos: $($response.data.video_resources.Count)"
        Write-Host "   Topics: $($response.data.topics.Count)"
        Write-Host "   Study links: $($response.data.study_links.Count)"
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
