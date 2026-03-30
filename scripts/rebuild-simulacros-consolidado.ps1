# Reconstruye Simulacros/consolidado_meta + consolidado_* (Cloud Function HTTP POST).
# Uso:
#   .\scripts\rebuild-simulacros-consolidado.ps1
# Opcional (si configuraste el secreto en la función):
#   $env:CONSOLIDATE_SIMULACROS_SECRET = "tu-secreto"
#   .\scripts\rebuild-simulacros-consolidado.ps1
# Otra URL (otro proyecto / emulador):
#   $env:REBUILD_CONSOLIDATED_URL = "https://us-central1-OTRO.cloudfunctions.net/rebuildSimulacrosConsolidatedHttp"

$ErrorActionPreference = "Stop"

$url = $env:REBUILD_CONSOLIDATED_URL
if (-not $url) {
  $url = "https://us-central1-superate-ia.cloudfunctions.net/rebuildSimulacrosConsolidatedHttp"
}

$headers = @{
  "Content-Type" = "application/json"
}
if ($env:CONSOLIDATE_SIMULACROS_SECRET) {
  $headers["X-Admin-Secret"] = $env:CONSOLIDATE_SIMULACROS_SECRET
}

Write-Host "POST $url" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body "{}" -ContentType "application/json"
$response | ConvertTo-Json -Depth 10
