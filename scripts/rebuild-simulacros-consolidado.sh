#!/usr/bin/env bash
# Reconstruye Simulacros/consolidado_meta + consolidado_* (Cloud Function HTTP POST).
#
# Uso:
#   chmod +x scripts/rebuild-simulacros-consolidado.sh
#   ./scripts/rebuild-simulacros-consolidado.sh
#
# Con secreto (si la función lo exige):
#   export CONSOLIDATE_SIMULACROS_SECRET="tu-secreto"
#   ./scripts/rebuild-simulacros-consolidado.sh
#
# Otra URL:
#   export REBUILD_CONSOLIDATED_URL="https://us-central1-OTRO.cloudfunctions.net/rebuildSimulacrosConsolidatedHttp"

set -euo pipefail

URL="${REBUILD_CONSOLIDATED_URL:-https://us-central1-superate-ia.cloudfunctions.net/rebuildSimulacrosConsolidatedHttp}"

if [[ -n "${CONSOLIDATE_SIMULACROS_SECRET:-}" ]]; then
  curl -sS -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Secret: ${CONSOLIDATE_SIMULACROS_SECRET}" \
    -d '{}'
else
  curl -sS -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d '{}'
fi
echo
