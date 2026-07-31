#!/bin/sh
# Copies the pre-push hook into this clone. Run once per clone, and once per worktree that
# does not share the common git directory.
#
# The hook is copied rather than wired through core.hooksPath: the pre-commit framework
# refuses to install while core.hooksPath is set, and the secret scanner needs that slot.
set -e

root="$(git rev-parse --show-toplevel)"
hooks="$(git rev-parse --git-common-dir)/hooks"

mkdir -p "$hooks"
cp "$root/.claude/coordination/hooks/pre-push" "$hooks/pre-push"
chmod +x "$hooks/pre-push"
echo "installed $hooks/pre-push"
