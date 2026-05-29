#!/bin/bash
# deploy-vistas.sh — Sincroniza assets/vistas/ al repo y hace push a GitHub

REPO_GIT="/c/Users/Jeronimo/Desktop/Agentes_Agencia/clients/davinchi/Davinchi_APP/repo"
CODE="C:/Users/Jeronimo/Desktop/Agentes_Agencia/clients/davinchi/Davinchi_APP/code"

echo "→ Sincronizando vistas (con borrado de eliminadas)..."
node "C:/Users/Jeronimo/Desktop/Agentes_Agencia/clients/davinchi/Davinchi_APP/scripts/sync-vistas.js"
if [ $? -ne 0 ]; then
  echo "⚠️  Sync falló, verificar manualmente."
  exit 1
fi

echo "→ Sincronizando index.html..."
cp "$CODE/index.html" "$REPO_GIT/index.html"

cd "$REPO_GIT"

# Registrar todo (incluyendo eliminaciones) en git
git add -A assets/vistas/
git add index.html

CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  echo "✓ Sin cambios nuevos, nada que subir."
  exit 0
fi

echo "→ Archivos modificados:"
git status --short

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "Actualiza vistas del catálogo — $TIMESTAMP

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "→ Subiendo a GitHub..."
git push origin main

echo ""
echo "✅ Deploy listo. Vercel actualiza en ~1 minuto."
