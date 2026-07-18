#!/usr/bin/env bash
# Paced terminal reel for the demo video. Runs the on-camera beats in order with
# pauses long enough to read at 1080p, so you record ONE clean take in Descript
# instead of typing commands live.
#
#   bash scripts/demo-film.sh          # full pace (record this)
#   BEAT=cage bash scripts/demo-film.sh   # one beat only, for re-takes
#   FAST=1 bash scripts/demo-film.sh   # rehearse without the pauses
#
# Never runs pnpm dev/preview/atomize/render. Reads only; touches no data/.
set -euo pipefail
cd "$(dirname "$0")/.."

pause() { [ "${FAST:-0}" = 1 ] || sleep "${1:-3}"; }
say()   { printf '\n\033[1;36m%s\033[0m\n' "$1"; pause 2; }
run()   { printf '\033[2m$ %s\033[0m\n' "$1"; pause 1; eval "$1"; pause "${2:-4}"; }

beat_cage() {
  say "The model wrote every lesson. It is not allowed to be trusted."
  run "pnpm demo:tamper" 5
}

beat_offline() {
  say "There is no model running while you learn. Grep the bytes we ship."
  run "pnpm verify:bundle" 4
}

beat_arc() {
  say "Nothing existed. The gates existed. The gates built it."
  run "git --no-pager log --oneline -1 516137e" 3
  printf '\033[2m(at 516137e: no atomizer, no graph, no app — pnpm test is RED on purpose)\033[0m\n'
  pause 3
  say "The same repo, built and checked:"
  run "pnpm gate 2>&1 | grep -E 'OK|ACCEPTANCE'" 5
}

beat_provenance() {
  say "Every lesson traces to a licensed source. Here is the receipt layer, as one file."
  run "head -24 llms.txt" 5
}

case "${BEAT:-all}" in
  cage)        beat_cage ;;
  offline)     beat_offline ;;
  arc)         beat_arc ;;
  provenance)  beat_provenance ;;
  all)
    beat_cage
    beat_offline
    beat_arc
    beat_provenance
    say "CAGE CLOSED. Built with Codex and GPT-5.6."
    ;;
  *) echo "unknown BEAT: ${BEAT}. use: cage | offline | arc | provenance | all" >&2; exit 1 ;;
esac
