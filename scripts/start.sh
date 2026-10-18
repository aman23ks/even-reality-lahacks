#!/usr/bin/env bash
# AuraPet one-command start: servers → IP → network check → QR → mirror → live connection monitor.
#   npm run start:demo        (Ctrl+C stops the monitor only; servers keep running)
#   npm run stop              (stops the servers)
set -uo pipefail
cd "$(dirname "$0")/.."

B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'
ok()   { echo "  ${G}✓${N} $*"; }
warn() { echo "  ${Y}!${N} $*"; }
fail() { echo "  ${R}✗${N} $*"; }
step() { echo; echo "${B}$*${N}"; }

mkdir -p .aurapet

step "1. Checking setup"
[ -d node_modules ] || { warn "Installing dependencies..."; npm install --silent; }
ok "dependencies installed"
if [ ! -f .env ]; then cp .env.example .env; warn "created .env from template — add your keys"; fi
has() { grep -qE "^$1=.+" .env; }
if has ANTHROPIC_API_KEY; then ok "Claude key found (mood + reset checks)"; else warn "no ANTHROPIC_API_KEY — keyword mode only"; fi
if has GROQ_API_KEY || has OPENAI_API_KEY; then ok "speech-to-text key found (glasses audio transcribed on server)"
else echo "  ${D}· no Groq/OpenAI key — phone's built-in speech recognition will be used${N}"; fi

step "2. Finding this laptop on the network"
IP=""
for ifc in en0 en1 en2; do IP=$(ipconfig getifaddr "$ifc" 2>/dev/null) && [ -n "$IP" ] && break; done
if [ -z "$IP" ]; then
  fail "Not connected to Wi-Fi. Join the same Wi-Fi (or the phone's hotspot) as your phone, then re-run."
  exit 1
fi
SSID=$(networksetup -getairportnetwork en0 2>/dev/null | sed 's/^Current Wi-Fi Network: //')
ok "IP ${B}$IP${N}  ${D}(${SSID:-wifi name unavailable})${N}"
APP_URL="http://$IP:5173"
MIRROR_URL="$APP_URL/mirror.html"

step "3. Restarting servers"
for port in 5173 3001; do
  pids=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null && echo "  ${D}· stopped old server on :$port${N}"
done
pkill -f "concurrently npm run dev npm run dev:backend" 2>/dev/null || true
sleep 1
nohup npm run dev:all > .aurapet/server.log 2>&1 &
echo $! > .aurapet/server.pid
for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:3001/api/health && curl -s -o /dev/null http://localhost:5173/ && break
  sleep 1
done
if curl -s -o /dev/null http://localhost:3001/api/health; then
  ok "backend  :3001  $(curl -s http://localhost:3001/api/health | sed -E 's/.*"llm":("?[^",}]*"?).*/(mood: \1)/')"
else fail "backend didn't start — see .aurapet/server.log"; exit 1; fi
curl -s -o /dev/null http://localhost:5173/ && ok "app      :5173" || { fail "app didn't start — see .aurapet/server.log"; exit 1; }

step "4. Checking the phone can reach this laptop"
if curl -s -m 3 -o /dev/null "$APP_URL" && curl -s -m 3 -o /dev/null "http://$IP:3001/api/health"; then
  ok "reachable at $APP_URL"
else
  fail "the app isn't reachable on $IP — check the Mac firewall (System Settings → Network → Firewall)"
fi
echo "  ${D}· The real test is the phone: if the monitor below never sees it, the Wi-Fi is blocking${N}"
echo "  ${D}  device-to-device traffic (common on campus Wi-Fi). Fix: phone hotspot → laptop joins it → re-run.${N}"

step "5. QR code (scan inside the Even App: Even Hub → Scan QR)"
node -e "
const qr=require('qr-image'),fs=require('fs');
const png=qr.imageSync(process.argv[1],{type:'png',size:10,margin:2});
fs.writeFileSync('.aurapet/qr.png',png); fs.writeFileSync('public/qr.png',png); fs.writeFileSync('public/qr-code.png',png);
" "$APP_URL"
npx --no-install evenhub qr -u "$APP_URL" 2>/dev/null || true
[ -z "${NO_OPEN:-}" ] && open .aurapet/qr.png 2>/dev/null || true
ok "QR → ${B}$APP_URL${N}  (also opened as an image)"

step "6. Projector mirror"
[ -z "${NO_OPEN:-}" ] && open "$MIRROR_URL" 2>/dev/null || true
ok "$MIRROR_URL"

step "7. On your phone, in this order"
cat <<EOF
  1. Even App home shows the ${B}glasses connected${N} (Bluetooth on, glasses out of the case)
  2. ${B}Force-quit${N} the Even App, reopen it, wait for the glasses to reconnect
  3. ${B}Even Hub → Scan QR${N} → scan the code above   ${D}(not the phone camera app)${N}
  4. Say ${B}"Hi Mochi"${N} with the glasses on
EOF

step "8. Watching for your phone  ${D}(Ctrl+C to stop watching — servers keep running)${N}"
node scripts/monitor.mjs "$IP"
