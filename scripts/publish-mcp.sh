#!/usr/bin/env bash
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RELEASE_ROOT"
if [[ "$(git branch --show-current)" != main ]] || [[ -n "$(git status --porcelain)" ]]; then
  echo "Publique a partir de um checkout limpo da main." >&2
  exit 1
fi
if [[ $# -gt 1 ]] || [[ $# -eq 1 && "$1" != --dry-run ]]; then
  echo "Uso: pnpm release:mcp [--dry-run]" >&2
  exit 1
fi

RELEASE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/botozap-mcp-publish.XXXXXX")"
trap 'rm -rf "$RELEASE_TMP"' EXIT
pnpm --filter @botozap/sdk build
pnpm --filter @botozap/mcp build
(cd packages/mcp && pnpm pack --out "$RELEASE_TMP/mcp.tgz")
node scripts/verify-package.mjs "$RELEASE_TMP/mcp.tgz" \
  packages/mcp/package.json packages/sdk/package.json
pnpm publish "$RELEASE_TMP/mcp.tgz" --access public --tag latest --publish-branch main "$@"

if [[ $# -eq 0 ]]; then
  # Prova pós-registry: sem override ou dependência ligada ao workspace.
  MCP_VERSION="$(node -p 'JSON.parse(require("node:fs").readFileSync("packages/mcp/package.json", "utf8")).version')"
  mkdir "$RELEASE_TMP/consumer"
  cd "$RELEASE_TMP/consumer"
  printf '{"name":"botozap-registry-consumer","private":true}\n' > package.json
  pnpm add "@botozap/mcp@$MCP_VERSION" --ignore-scripts
  pnpm add -D @modelcontextprotocol/sdk@1.29.0 --ignore-scripts
  cp "$RELEASE_ROOT/scripts/packed-tools-only.mjs" ./packed-tools-only.mjs
  node ./packed-tools-only.mjs
fi
