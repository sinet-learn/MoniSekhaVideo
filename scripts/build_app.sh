#!/bin/bash
# Builds MoniSekha.app (a Dock app that starts/stops both servers).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/MoniSekha.app}"
rm -rf "$OUT"
cat > /tmp/monisekha.applescript <<AS
property runner : "$ROOT/scripts/monisekha_run.sh"
on run
	do shell script "nohup " & quoted form of runner & " start >/dev/null 2>&1 &"
end run
on reopen
	open location "http://localhost:3005"
end reopen
on quit
	do shell script quoted form of runner & " stop"
	continue quit
end quit
AS
osacompile -s -o "$OUT" /tmp/monisekha.applescript
echo "Built $OUT"
