#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# watch-tasks.sh — Monitorea tareas pendientes en Agency OS
# ═══════════════════════════════════════════════════════════════════════════
# Uso:
#   bash scripts/watch-tasks.sh
#
# Cada 30 s consulta la API. Cuando hay tareas pendientes las imprime
# con instrucciones claras para copiar el prompt a Claude Code.
# ═══════════════════════════════════════════════════════════════════════════

API_URL="https://agency-os-tau-coral.vercel.app/api/tasks"
PASSWORD="agencia2026"
INTERVAL=30

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

last_ids=""

echo -e "${BOLD}Agency OS — Watch Tasks${RESET}"
echo -e "${CYAN}Monitoreando tareas cada ${INTERVAL}s...${RESET}"
echo -e "Panel: https://agency-os-tau-coral.vercel.app\n"

while true; do
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${API_URL}?pw=${PASSWORD}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [[ "$HTTP_CODE" != "200" ]]; then
    echo -e "${RED}[$(date +%H:%M)] Error HTTP $HTTP_CODE${RESET}"
    sleep "$INTERVAL"
    continue
  fi

  # Extraer tareas pendientes con jq si está disponible
  if command -v jq &>/dev/null; then
    PENDING=$(echo "$BODY" | jq -r '.data[] | select(.estado=="pendiente") | "\(.id)|\(.agente_nombre)|\(.titulo)|\(.prioridad)|\(.proyecto)"')
    PROGRESO=$(echo "$BODY" | jq -r '.data[] | select(.estado=="en_progreso") | .titulo' | wc -l | tr -d ' ')
    TOTAL=$(echo "$BODY" | jq '.data | length')

    # Detectar tareas nuevas
    current_ids=$(echo "$BODY" | jq -r '.data[] | select(.estado=="pendiente") | .id' | sort | tr '\n' ',')

    if [[ "$current_ids" != "$last_ids" && -n "$PENDING" ]]; then
      echo ""
      echo -e "${YELLOW}════════════════════════════════════════${RESET}"
      echo -e "${BOLD}${YELLOW}  NUEVAS TAREAS PENDIENTES  ${RESET}"
      echo -e "${YELLOW}════════════════════════════════════════${RESET}"

      while IFS='|' read -r id nombre titulo prioridad proyecto; do
        [[ -z "$id" ]] && continue
        PRI_COLOR="$CYAN"
        [[ "$prioridad" == "alta" ]] && PRI_COLOR="$RED"
        echo -e "\n${BOLD}Agente:${RESET} $nombre"
        echo -e "${BOLD}Tarea: ${RESET} $titulo"
        echo -e "${BOLD}Proyecto:${RESET} $proyecto"
        echo -e "${PRI_COLOR}${BOLD}Prioridad: ${prioridad}${RESET}"
        echo -e "${GREEN}→ Ve al panel y pulsa 'Tomar tarea' para obtener el prompt${RESET}"
      done <<< "$PENDING"

      echo -e "\n${YELLOW}════════════════════════════════════════${RESET}\n"
      last_ids="$current_ids"

    elif [[ -z "$PENDING" ]]; then
      last_ids=""
      echo -e "[$(date +%H:%M)] ${GREEN}Sin tareas pendientes${RESET} · $PROGRESO en progreso · total: $TOTAL"
    else
      echo -e "[$(date +%H:%M)] ${YELLOW}${TOTAL} tarea(s) pendiente(s)${RESET} · $PROGRESO en progreso"
    fi

  else
    # Fallback sin jq
    OK=$(echo "$BODY" | grep -o '"ok":true')
    if [[ -n "$OK" ]]; then
      echo -e "[$(date +%H:%M)] API OK — instala jq para ver detalles: brew install jq"
    else
      echo -e "[$(date +%H:%M)] ${RED}API respondió error${RESET}"
    fi
  fi

  sleep "$INTERVAL"
done
