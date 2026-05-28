#!/usr/bin/env bash
# Configure the three git mirror remotes. Run once after cloning.
# Requires PAT env vars: GITHUB_PAT_CUBICZAN, GITHUB_PAT_ZANMAKER, CODEBERG_PAT
set -euo pipefail

: "${GITHUB_PAT_CUBICZAN:?Set GITHUB_PAT_CUBICZAN (GitHub PAT for Cubiczan)}"
: "${GITHUB_PAT_ZANMAKER:?Set GITHUB_PAT_ZANMAKER (GitHub PAT for zan-maker)}"
: "${CODEBERG_PAT:?Set CODEBERG_PAT (Codeberg PAT for ShyamDesigan)}"

ORIGIN_URL="https://Cubiczan:${GITHUB_PAT_CUBICZAN}@github.com/Cubiczan/inventory-control.git"
GITHUB2_URL="https://zan-maker:${GITHUB_PAT_ZANMAKER}@github.com/zan-maker/inventory-control.git"
CODEBERG_URL="https://ShyamDesigan:${CODEBERG_PAT}@codeberg.org/ShyamDesigan/inventory-control.git"

set_remote() {
  local name="$1" url="$2"
  if git remote | grep -q "^${name}\$"; then
    git remote set-url "$name" "$url"
    echo "updated remote: $name"
  else
    git remote add "$name" "$url"
    echo "added remote:   $name"
  fi
}

set_remote origin   "$ORIGIN_URL"
set_remote github2  "$GITHUB2_URL"
set_remote codeberg "$CODEBERG_URL"

echo
echo "Remotes configured:"
git remote -v | sed -E 's#://[^@]+@#://***@#'
