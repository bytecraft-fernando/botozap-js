#!/usr/bin/env bash

set -euo pipefail

GATE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/botozap-release-gate.XXXXXX")"
GATE_TARBALL_DIR="$GATE_TMP/tarballs"
GATE_CONSUMER_DIR="$GATE_TMP/consumer"

cleanup_release_gate() {
  rm -rf "$GATE_TMP"
}
trap cleanup_release_gate EXIT

mkdir -p "$GATE_TARBALL_DIR" "$GATE_CONSUMER_DIR"

(cd "$GATE_ROOT/packages/sdk" && pnpm pack --out "$GATE_TARBALL_DIR/sdk.tgz")
(cd "$GATE_ROOT/packages/cli" && pnpm pack --out "$GATE_TARBALL_DIR/cli.tgz")
(cd "$GATE_ROOT/packages/mcp" && pnpm pack --out "$GATE_TARBALL_DIR/mcp.tgz")

for package_name in sdk cli mcp; do
  if tar -tzf "$GATE_TARBALL_DIR/$package_name.tgz" \
    | grep -E '/(src|tests?|scripts)/|/\.env|node_modules/'; then
    echo "tarball $package_name contém arquivos que não devem ser publicados" >&2
    exit 1
  fi
done

cd "$GATE_CONSUMER_DIR"
printf '{ "name": "botozap-release-consumer", "private": true }\n' > package.json
printf 'overrides:\n  "@botozap/sdk": "file:%s/sdk.tgz"\n' "$GATE_TARBALL_DIR" \
  > pnpm-workspace.yaml

pnpm add \
  "$GATE_TARBALL_DIR/sdk.tgz" \
  "$GATE_TARBALL_DIR/cli.tgz" \
  "$GATE_TARBALL_DIR/mcp.tgz"
pnpm add -D typescript@5.6 @modelcontextprotocol/sdk@1.29.0

node -e "import('@botozap/sdk').then(m => { if (typeof m.BotoZap !== 'function') process.exit(1) })"
node -e "if (typeof require('@botozap/sdk').BotoZap !== 'function') process.exit(1)"

printf '%s\n' \
  'import { BotoZap, type SendResult } from "@botozap/sdk";' \
  'const boto = new BotoZap({ apiKey: "bz_sandbox_release_gate" });' \
  'export async function smoke(): Promise<SendResult> {' \
  '  return boto.messages.send({ to: "+5500000000001", text: "Olá 😀" });' \
  '}' \
  > index.ts
printf '%s\n' \
  '{ "compilerOptions": { "strict": true, "module": "nodenext", "moduleResolution": "nodenext", "target": "es2022", "noEmit": true } }' \
  > tsconfig.json
pnpm exec tsc -p tsconfig.json

./node_modules/.bin/botozap --version
./node_modules/.bin/botozap --help > /dev/null

cp "$GATE_ROOT/scripts/packed-tools-only.mjs" ./packed-tools-only.mjs
node ./packed-tools-only.mjs
