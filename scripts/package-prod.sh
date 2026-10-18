#!/usr/bin/env bash
# Build the Even Hub upload (.ehpk) pointed at a deployed backend.
#   npm run package:prod -- https://aurapet.onrender.com
set -euo pipefail
cd "$(dirname "$0")/.."
B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'

URL="${1:-}"
URL="${URL%/}"
if [[ ! "$URL" =~ ^https:// ]]; then
  echo "${R}Usage:${N} npm run package:prod -- https://<your-render-url>   (must be https)"
  exit 1
fi

# Shared key between this build and the server (APP_KEY on Render). Kept in .env as PROD_APP_KEY so the
# local dev server doesn't start enforcing it.
touch .env
KEY=$(grep -E '^PROD_APP_KEY=.+' .env | head -1 | cut -d= -f2- || true)
if [ -z "$KEY" ]; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")
  printf '\n# Shared key for the deployed backend: set APP_KEY to this same value on Render\nPROD_APP_KEY=%s\n' "$KEY" >> .env
  echo "${Y}!${N} Generated a new app key and saved it to .env as PROD_APP_KEY"
fi

echo "${B}Checking the backend…${N}"
if HEALTH=$(curl -s -m 60 "$URL/api/health"); then
  echo "  ${G}✓${N} $HEALTH"
else
  echo "  ${Y}!${N} $URL didn't answer (a sleeping free Render instance can take ~60s). Packaging anyway."
fi

echo "${B}Pointing app.json's network permission at $URL…${N}"
node -e "
const fs=require('fs'); const p='app.json'; const a=JSON.parse(fs.readFileSync(p,'utf8'));
for (const perm of a.permissions) if (perm.name==='network') perm.whitelist=[process.argv[1]];
fs.writeFileSync(p, JSON.stringify(a,null,2)+'\n');
" "$URL"

echo "${B}Building…${N}"
# Judge mode is off by default; JUDGE_DEFAULT=1 makes fresh installs start in it
VITE_JUDGE_DEFAULT="${JUDGE_DEFAULT:-0}" VITE_BACKEND_URL="$URL" VITE_APP_KEY="$KEY" npm run build --silent
npx --no-install evenhub pack app.json dist -o CompassionCoach.ehpk

echo
echo "${G}${B}Done:${N} CompassionCoach.ehpk  ($(du -h CompassionCoach.ehpk | cut -f1))"
cat <<EOF

${B}Next${N}
  1. Render dashboard → aurapet → Environment → make sure ${B}APP_KEY${N} = the PROD_APP_KEY in .env
  2. hub.evenrealities.com → your app → upload ${B}CompassionCoach.ehpk${N} as a ${B}Beta${N} build
  3. Install the Beta on a phone + G2 and run the end-to-end test
  4. Projector: ${B}$URL/mirror.html${N}
EOF
