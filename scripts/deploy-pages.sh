#!/usr/bin/env bash
# Build the static GitHub Pages mirror (no API routes) and push to gh-pages.
set -euo pipefail
cd "$(dirname "$0")/.."

# route handlers can't be statically exported; stash them during the build
mv app/api /tmp/overgrowth-api-stash
trap 'mv /tmp/overgrowth-api-stash app/api' EXIT

rm -rf .next out
PAGES_BASE=/overgrowth npm run build
touch out/.nojekyll

WT=$(mktemp -d)
git worktree add "$WT" gh-pages
rm -rf "$WT"/*
cp -R out/. "$WT"/
cd "$WT"
git add -A
git -c commit.gpgsign=false commit -m "Deploy static export to GitHub Pages" || echo "nothing to deploy"
git push origin gh-pages
cd -
git worktree remove "$WT" --force
echo "Pages deploy done."
