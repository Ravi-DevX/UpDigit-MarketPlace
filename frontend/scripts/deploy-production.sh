#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

timestamp="$(date +%Y%m%d%H%M%S)"
candidate=".next-candidate"
previous=".next-previous-${timestamp}"
failed=".next-failed-${timestamp}"
abandoned=".next-abandoned-${timestamp}"

rollback() {
  trap - ERR
  if [[ -d "$previous" ]]; then
    if [[ -d .next ]]; then
      mv .next "$failed"
    fi
    mv "$previous" .next
    pm2 restart frontend
  fi
}
trap rollback ERR

if [[ -d "$candidate" ]]; then
  mv "$candidate" "$abandoned"
fi

NEXT_DIST_DIR="$candidate" pnpm build

# Retain old hashed assets so open browser sessions can finish loading them.
if [[ -d .next/static ]]; then
  cp -a .next/static/. "$candidate/static/"
fi

pm2 stop frontend
if [[ -d .next ]]; then
  mv .next "$previous"
fi
mv "$candidate" .next
pm2 restart frontend

curl --retry 10 --retry-delay 1 --retry-connrefused --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null
pm2 save
trap - ERR

printf 'Frontend deployed. Previous build retained at %s\n' "$previous"
