# Script de prueba para generateStudyPlan
# Este script prueba la función desplegada para verificar que los enlaces web se generan correctamente

$functionUrl = "https://us-central1-superate-ia.cloudfunctions.net/generateStudyPlan"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🧪 PRUEBA DE FUNCIÓN generateStudyPlan" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Solicitar parámetros al usuario
Write-Host "📝 Por favor, ingresa los siguientes parámetros:" -ForegroundColor Yellow
Write-Host ""

$studentId = Read-Host "   Student ID (ID del estudiante en Firestore)"
$phase = Read-Host "   Phase (first/second/third)"
$subject = Read-Host "   Subject (materia, ej: matematicas, ciencias, etc.)"

# Validar fase
if ($phase -notin @("first", "second", "third")) {
    Write-Host ""
    Write-Host "❌ Error: phase debe ser 'first', 'second' o 'third'" -ForegroundColor Red
    exit 1
}

# Crear body de la petición
$body = @{
    studentId = $studentId
    phase = $phase
    subject = $subject
} | ConvertTo-Json

Write-Host ""
Write-Host "🚀 Enviando petición a la función..." -ForegroundColor Cyan
Write-Host "   URL: $functionUrl" -ForegroundColor Gray
Write-Host "   Student ID: $studentId" -ForegroundColor Gray
Write-Host "   Phase: $phase" -ForegroundColor Gray
Write-Host "   Subject: $subject" -ForegroundColor Gray
Write-Host ""
Write-Host "⏳ Esto puede tardar varios minutos (la función genera el plan completo)..." -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri $functionUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 600
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ RESPUESTA EXITOSA" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏱️  Tiempo de procesamiento: $([math]::Round($duration, 2)) segundos" -ForegroundColor Cyan
    Write-Host ""
    
    # Verificar éxito
    if ($response.success) {
        Write-Host "✅ Plan de estudio generado exitosamente!" -ForegroundColor Green
        Write-Host ""
        
        # Mostrar información del plan
        if ($response.data) {
            Write-Host "📚 INFORMACIÓN DEL PLAN:" -ForegroundColor Cyan
            Write-Host "   Título: $($response.data.title)" -ForegroundColor White
            Write-Host "   Descripción: $($response.data.description)" -ForegroundColor White
            Write-Host "   Duración estimada: $($response.data.estimatedDuration)" -ForegroundColor White
            Write-Host ""
            
            # Contar topics
            if ($response.data.topics) {
                $topicCount = $response.data.topics.Count
                Write-Host "📖 Topics generados: $topicCount" -ForegroundColor Cyan
                
                # Contar topics con webSearchInfo
                $topicsWithWebSearch = ($response.data.topics | Where-Object { $_.webSearchInfo }).Count
                Write-Host "   Topics con webSearchInfo: $topicsWithWebSearch" -ForegroundColor $(if ($topicsWithWebSearch -gt 0) { "Green" } else { "Yellow" })
                Write-Host ""
            }
            
            # Verificar enlaces web
            if ($response.data.study_links) {
                $linkCount = $response.data.study_links.Count
                Write-Host "🔗 ENLACES WEB ENCONTRADOS: $linkCount" -ForegroundColor $(if ($linkCount -gt 0) { "Green" } else { "Yellow" })
                
                if ($linkCount -gt 0) {
                    Write-Host ""
                    Write-Host "📋 Primeros 10 enlaces:" -ForegroundColor Cyan
                    $response.data.study_links | Select-Object -First 10 | ForEach-Object {
                        Write-Host "   ✅ $($_.title)" -ForegroundColor Green
                        Write-Host "      URL: $($_.url)" -ForegroundColor DarkGray
                        if ($_.description) {
                            Write-Host "      Descripción: $($_.description)" -ForegroundColor DarkGray
                        }
                        Write-Host ""
                    }
                } else {
                    Write-Host "   ⚠️  No se encontraron enlaces web. Revisa los logs de Firebase." -ForegroundColor Yellow
                }
            } else {
                Write-Host "⚠️  No hay campo 'study_links' en la respuesta" -ForegroundColor Yellow
            }
            
            # Verificar videos
            if ($response.data.video_resources) {
                $videoCount = $response.data.video_resources.Count
                Write-Host "🎥 VIDEOS ENCONTRADOS: $videoCount" -ForegroundColor Cyan
            }
        }
        
        Write-Host ""
        Write-Host "📊 Respuesta completa guardada en: response.json" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10 | Out-File -FilePath "response.json" -Encoding UTF8
        
    } else {
        Write-Host "❌ La función reportó un error:" -ForegroundColor Red
        if ($response.error) {
            Write-Host "   $($response.error.message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ ERROR AL LLAMAR LA FUNCIÓN" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles del error:" -ForegroundColor Yellow
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            $errorDetails | ConvertTo-Json -Depth 5
        } catch {
            Write-Host $_.ErrorDetails.Message
        }
    }
    
    Write-Host ""
    Write-Host "💡 SUGERENCIAS:" -ForegroundColor Cyan
    Write-Host "   1. Verifica que el studentId existe en Firestore (proyecto superate-6c730)" -ForegroundColor White
    Write-Host "   2. Verifica que el estudiante tiene resultados de exámenes en la fase y materia especificadas" -ForegroundColor White
    Write-Host "   3. Revisa los logs de Firebase Functions en la consola:" -ForegroundColor White
    Write-Host "      https://console.firebase.google.com/project/superate-ia/functions/logs" -ForegroundColor DarkGray
    Write-Host "   4. Verifica que los secrets GOOGLE_CSE_API_KEY y GOOGLE_CSE_ID estén configurados" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

