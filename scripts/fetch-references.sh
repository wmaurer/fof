#!/usr/bin/env bash
set -euo pipefail

command -v git >/dev/null 2>&1 || {
  echo "git is required but not found in PATH" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXTERNAL_DIR="$REPO_ROOT/.repos"

mkdir -p "$EXTERNAL_DIR"

# Format: name|url[|ref]
#   ref is optional and may be a branch name, tag, or commit SHA.
#   When omitted, the remote's default branch is fetched.
# Examples:
#   "effect|https://github.com/Effect-TS/effect-smol.git"            # default branch
#   "effect|https://github.com/Effect-TS/effect-smol.git|next-minor" # branch
#   "effect|https://github.com/Effect-TS/effect-smol.git|v3.10.0"    # tag
#   "effect|https://github.com/Effect-TS/effect-smol.git|abc1234"    # commit SHA
#
# NOTE: Effect v4 snapshots (0.0.0-snapshot-<sha>) publish from the
# Effect-TS/effect-smol repo, NOT Effect-TS/effect. Always clone effect-smol
# when you need to read sources that match what's installed under @effect/*.
repos=(
  "effect|https://github.com/Effect-TS/effect-smol.git|effect@4.0.0-beta.66"
  "ink|https://github.com/vadimdemedes/ink.git"
)

for entry in "${repos[@]}"; do
  IFS='|' read -r name url ref <<< "$entry"
  target="$EXTERNAL_DIR/$name"

  if [ -d "$target/.git" ]; then
    echo "✓ $name already present at $target (delete to re-fetch)"
    continue
  fi

  if [ -z "${ref:-}" ]; then
    echo "Cloning $name from $url (default branch)..."
    git clone --depth 1 "$url" "$target"
  else
    echo "Cloning $name from $url at $ref..."
    if ! {
      git init -q "$target" &&
      git -C "$target" remote add origin "$url" &&
      git -C "$target" fetch --depth 1 origin "$ref" &&
      git -C "$target" checkout -q FETCH_HEAD
    }; then
      rm -rf "$target"
      echo "✗ Failed to fetch $name at $ref — cleaned up partial checkout" >&2
      exit 1
    fi
  fi
  echo "✓ Finished cloning $name"
  echo
done

echo "External dependencies ready in $EXTERNAL_DIR"
