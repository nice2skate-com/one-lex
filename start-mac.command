#!/bin/bash
# DJ KOLJA ONE · Library — lokal auf dem Mac starten (Doppelklick)
cd "$(dirname "$0")"
PORT=8778
URL="http://127.0.0.1:$PORT/"
if command -v python3 >/dev/null 2>&1; then python3 server.py $PORT >/dev/null 2>&1 &
else ruby -run -e httpd . -p $PORT >/dev/null 2>&1 & fi
SERVER=$!
sleep 1
open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
echo "Library läuft unter $URL — dieses Fenster offen lassen. Beenden mit Ctrl+C."
trap "kill $SERVER" EXIT
wait $SERVER
