#!/usr/bin/env bash
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RELEASE_ROOT"
if [[ $# -gt 1 ]] || [[ $# -eq 1 && "$1" != --dry-run ]]; then
  echo "Uso: pnpm release:mcp [--dry-run]" >&2
  exit 1
fi

if [[ $# -eq 0 ]] && { [[ "$(git branch --show-current)" != main ]] || [[ -n "$(git status --porcelain)" ]]; }; then
  echo "Publique a partir de um checkout limpo da main; --dry-run também aceita branches de revisão." >&2
  exit 1
fi

# Depois do `npm publish`, o npm pode levar alguns minutos para listar a versão
# nova (janela de processamento) — `pnpm add` nessa janela falha com
# ERR_PNPM_NO_MATCHING_VERSION mesmo com a publicação tendo dado certo. Espera
# a versão aparecer via `npm view` antes de instalar. Ver "Publicação pelos
# mantenedores" em packages/mcp/README.md para a janela de processamento e o
# aviso sobre 2FA/E409.
wait_for_registry_version() {
  local package="$1" version="$2"
  local timeout_s=1200 interval_s=15 waited=0
  echo "Aguardando ${package}@${version} aparecer no registry do npm (timeout ${timeout_s}s)..."
  while true; do
    if npm view "${package}@${version}" version >/dev/null 2>&1; then
      echo "${package}@${version} visível no registry (esperou ${waited}s)."
      return 0
    fi
    if (( waited >= timeout_s )); then
      cat >&2 <<EOF

Tempo esgotado (${timeout_s}s) esperando ${package}@${version} aparecer no
registry do npm. Isso NÃO significa que a publicação falhou — o npm pode levar
alguns minutos para propagar uma versão nova (janela de processamento).

Confira antes de fazer qualquer coisa:
  npm view ${package}@${version} version

Se ainda não aparecer, espere e repita esse comando — NÃO rode
\`pnpm release:mcp\` de novo: publicar de novo enquanto a versão anterior está
na janela de processamento falha com 409 "Cannot publish over previously
staged version", e essa versão fica presa até a janela passar.

Se já aparecer, rode a prova pós-registry manualmente:
  mkdir -p /tmp/botozap-mcp-manual-check && cd /tmp/botozap-mcp-manual-check
  printf '{"name":"botozap-registry-consumer","private":true}\\n' > package.json
  pnpm add "${package}@${version}" --ignore-scripts
  pnpm add "@botozap/sdk@${SDK_VERSION:-<versão do SDK publicada junto>}" --ignore-scripts
  pnpm add -D @modelcontextprotocol/sdk@1.29.0 --ignore-scripts
  cp "$RELEASE_ROOT/scripts/packed-tools-only.mjs" ./packed-tools-only.mjs
  cp "$RELEASE_ROOT/packages/mcp/tests/fixtures/release-0.6.0-tools.json" ./release-0.6.0-tools.json
  node ./packed-tools-only.mjs
EOF
      exit 1
    fi
    sleep "$interval_s"
    waited=$(( waited + interval_s ))
  done
}

RELEASE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/botozap-mcp-publish.XXXXXX")"
trap 'rm -rf "$RELEASE_TMP"' EXIT
pnpm --filter @botozap/sdk build
pnpm --filter @botozap/mcp build
(cd packages/mcp && pnpm pack --out "$RELEASE_TMP/mcp.tgz")
node scripts/verify-package.mjs "$RELEASE_TMP/mcp.tgz" \
  packages/mcp/package.json packages/sdk/package.json
npm publish "$RELEASE_TMP/mcp.tgz" --access public --tag latest "$@"

if [[ $# -eq 0 ]]; then
  # Prova pós-registry: sem override ou dependência ligada ao workspace.
  MCP_VERSION="$(node -p 'JSON.parse(require("node:fs").readFileSync("packages/mcp/package.json", "utf8")).version')"
  SDK_VERSION="$(node -p 'JSON.parse(require("node:fs").readFileSync("'"$RELEASE_ROOT"'/packages/sdk/package.json", "utf8")).version')"
  wait_for_registry_version "@botozap/mcp" "$MCP_VERSION"
  mkdir "$RELEASE_TMP/consumer"
  cd "$RELEASE_TMP/consumer"
  printf '{"name":"botozap-registry-consumer","private":true}\n' > package.json
  pnpm add "@botozap/mcp@$MCP_VERSION" --ignore-scripts
  # packed-tools-only.mjs importa @botozap/sdk direto; o pnpm só expõe dependências diretas.
  pnpm add "@botozap/sdk@$SDK_VERSION" --ignore-scripts
  pnpm add -D @modelcontextprotocol/sdk@1.29.0 --ignore-scripts
  cp "$RELEASE_ROOT/scripts/packed-tools-only.mjs" ./packed-tools-only.mjs
  cp "$RELEASE_ROOT/packages/mcp/tests/fixtures/release-0.6.0-tools.json" ./release-0.6.0-tools.json
  node ./packed-tools-only.mjs
fi
