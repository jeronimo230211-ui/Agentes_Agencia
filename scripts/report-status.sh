#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# report-status.sh — Reporta el estado de un agente a Agency OS via Make
# ═══════════════════════════════════════════════════════════════════════════
# Uso:
#   ./scripts/report-status.sh \
#     --agente    "developer" \
#     --nombre    "Developer" \
#     --estado    "trabajando" \
#     --tarea     "Construyendo módulo de autenticación" \
#     --proyecto  "Agency OS" \
#     --desc      "Inició desarrollo del módulo de auth"
#
# Estados válidos:
#   trabajando | disponible | esperando_aprobacion | listo
# ═══════════════════════════════════════════════════════════════════════════

WEBHOOK_URL="https://agency-os-tau-coral.vercel.app/api/report-status"

# ── Parsear argumentos ─────────────────────────────────────────────────────
AGENTE_ID=""
AGENTE_NOMBRE=""
ESTADO=""
TAREA=""
PROYECTO=""
DESCRIPCION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --agente)   AGENTE_ID="$2";      shift 2 ;;
    --nombre)   AGENTE_NOMBRE="$2";  shift 2 ;;
    --estado)   ESTADO="$2";         shift 2 ;;
    --tarea)    TAREA="$2";          shift 2 ;;
    --proyecto) PROYECTO="$2";       shift 2 ;;
    --desc)     DESCRIPCION="$2";    shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

# ── Validar campos requeridos ──────────────────────────────────────────────
if [[ -z "$AGENTE_ID" || -z "$ESTADO" || -z "$DESCRIPCION" ]]; then
  echo "❌ Faltan campos requeridos: --agente, --estado, --desc"
  exit 1
fi

# ── Construir JSON ─────────────────────────────────────────────────────────
JSON=$(cat <<EOF
{
  "agente_id":     "$AGENTE_ID",
  "agente_nombre": "$AGENTE_NOMBRE",
  "estado":        "$ESTADO",
  "tarea_actual":  "$TAREA",
  "proyecto":      "$PROYECTO",
  "descripcion":   "$DESCRIPCION"
}
EOF
)

# ── Enviar a Make ──────────────────────────────────────────────────────────
if [[ "$WEBHOOK_URL" == "REEMPLAZA"* ]]; then
  echo "⚠️  Webhook no configurado. Simulating: $JSON"
  exit 0
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON")

if [[ "$RESPONSE" == "200" ]]; then
  echo "✅ Estado reportado: [$AGENTE_ID] $ESTADO — $DESCRIPCION"
else
  echo "⚠️  Make respondió HTTP $RESPONSE (el escenario puede no estar activo)"
fi
