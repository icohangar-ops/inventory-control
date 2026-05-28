#!/usr/bin/env bash
# Push current branch (and optionally tags) to all three mirrors.
set -euo pipefail

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
EXTRA=()
if [[ "${1:-}" == "--tags" ]]; then EXTRA+=("--tags"); fi

for remote in origin github2 codeberg; do
  if ! git remote | grep -q "^${remote}\$"; then
    echo "skip $remote (not configured — run scripts/setup-remotes.sh)"
    continue
  fi
  echo "==> pushing $BRANCH -> $remote"
  git push "$remote" "$BRANCH" "${EXTRA[@]}"
done

echo "done."
