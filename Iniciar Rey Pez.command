#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Instala Node.js 22.13 o posterior dentro de la rama 22, o Node.js 24 o posterior."
  read -r "?Pulsa Enter para cerrar."
  exit 1
fi
# Abrir el servidor de esta app si ya está activo evita iniciar otra instancia.
rey_pez_page=$(curl --fail --silent --max-time 2 http://127.0.0.1:5173/ 2>/dev/null)
if [[ "$rey_pez_page" == *"<title>Rey Pez"* ]]; then
  open http://127.0.0.1:5173/
  exit 0
fi
if [ ! -d node_modules ]; then
  npm ci || exit 1
fi
npm run iniciar -- --open
